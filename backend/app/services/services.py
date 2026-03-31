import json
import logging
import uuid
from datetime import datetime as _dt
from pathlib import Path

from fastapi import Request, UploadFile, HTTPException
from sqlalchemy.orm import Session

# ── Audit logger ───────────────────────────────────────────────────────────────
# Each audit event emits one structured JSON line here.
# Azure Container Apps ships stdout → Azure Monitor automatically.
# Forward to Sentinel or any SIEM with a single diagnostic setting toggle.
_audit_logger = logging.getLogger("audit")

from app.config import settings
from app import storage as evidence_storage
from app.repositories.repositories import (
    UserRepository, ControlRepository, TestCycleRepository,
    AssignmentRepository, EvidenceRepository,
)
from app.schemas.schemas import (
    ControlCreate, ControlUpdate,
    TestCycleCreate, TestCycleUpdate,
    TestAssignmentUpdate,
    LoginRequest,
)
from app.auth.local_auth import encode_token
from app.models.models import User


# ── Auth Service ───────────────────────────────────────────────────────────

class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = UserRepository(db)

    def login(self, req: LoginRequest):
        user = self.repo.get_by_username(req.username)
        if not user:
            raise HTTPException(status_code=404, detail=f"User '{req.username}' not found")
        token = encode_token(user.id, user.username, user.role)
        return {"access_token": token, "token_type": "bearer", "user": user}

    def idp_login(self, access_token: str) -> dict:
        """
        Unified IdP login for both Entra ID and Okta.
        Validates the token, upserts the user, and returns the IdP token
        as the session token (the backend re-validates it on every request).
        """
        from app.auth.identity import validate_token, upsert_user
        info = validate_token(access_token)
        user = upsert_user(self.db, info)
        return {
            "access_token": access_token,
            "token_type":   "bearer",
            "user":         user,
        }

    # Keep old name for any remaining references
    def azure_login(self, access_token: str) -> dict:
        return self.idp_login(access_token)


# ── User Service ───────────────────────────────────────────────────────────

class UserService:
    def __init__(self, db: Session):
        self.db   = db
        self.repo = UserRepository(db)

    def list_users(self, status: str = None):
        from app.models.models import User as UserModel
        q = self.db.query(UserModel)
        if status:
            q = q.filter(UserModel.status == status)
        return q.order_by(UserModel.display_name).all()

    def get_user(self, user_id: int):
        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

    def create_user(self, data):
        from app.models.models import User as UserModel
        if self.db.query(UserModel).filter(UserModel.email == data.email).first():
            raise HTTPException(400, "A user with that email already exists.")
        user = UserModel(
            username          = data.email,
            display_name      = data.display_name,
            email             = data.email,
            role              = data.role,
            status            = "pending",
            identity_provider = "local",
            department        = data.department,
            job_title         = data.job_title,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_role(self, user_id: int, role: str):
        user = self.get_user(user_id)
        user.role = role
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_status(self, user_id: int, status: str):
        if status not in ("active", "inactive"):
            raise HTTPException(400, "status must be 'active' or 'inactive'")
        user = self.get_user(user_id)
        user.status = status
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete_user(self, user_id: int):
        user = self.get_user(user_id)
        self.db.delete(user)
        self.db.commit()


# ── Control Service ────────────────────────────────────────────────────────

class ControlService:
    def __init__(self, db: Session):
        self.repo = ControlRepository(db)

    def list_controls(self, status: str = None):
        return self.repo.get_all(status)

    def get_control(self, control_id: int):
        ctrl = self.repo.get_by_id(control_id)
        if not ctrl:
            raise HTTPException(status_code=404, detail="Control not found")
        return ctrl

    def create_control(self, data: ControlCreate):
        existing = self.repo.get_all()
        ids = {c.control_id for c in existing}
        if data.control_id in ids:
            raise HTTPException(status_code=409, detail=f"Control ID '{data.control_id}' already exists")
        mappings = [m.model_dump() for m in data.mappings] if data.mappings else []
        ctrl_data = data.model_dump(exclude={"mappings"})
        return self.repo.create(ctrl_data, mappings)

    def update_control(self, control_id: int, data: ControlUpdate):
        ctrl = self.get_control(control_id)
        mappings = None
        if data.mappings is not None:
            mappings = [m.model_dump() for m in data.mappings]
        return self.repo.update(ctrl, data.model_dump(exclude_none=True, exclude={"mappings"}), mappings=mappings)

    def delete_control(self, control_id: int):
        ctrl = self.get_control(control_id)
        self.repo.delete(ctrl)


# ── Test Cycle Service ─────────────────────────────────────────────────────

class TestCycleService:
    def __init__(self, db: Session):
        self.repo = TestCycleRepository(db)

    def list_cycles(self):
        cycles = self.repo.get_all()
        result = []
        for c in cycles:
            total = len(c.assignments)
            complete = sum(1 for a in c.assignments if a.status == "complete")
            in_prog = sum(1 for a in c.assignments if a.status == "in_progress")
            result.append({
                "id": c.id,
                "name": c.name,
                "status": c.status,
                "brand": c.brand,
                "start_date": c.start_date,
                "end_date": c.end_date,
                "total_assignments": total,
                "complete_count": complete,
                "in_progress_count": in_prog,
            })
        return result

    def get_cycle(self, cycle_id: int):
        cycle = self.repo.get_by_id(cycle_id)
        if not cycle:
            raise HTTPException(status_code=404, detail="Test cycle not found")
        return cycle

    def create_cycle(self, data: TestCycleCreate):
        assignments = [a.model_dump() for a in data.assignments] if data.assignments else []
        cycle_data = data.model_dump(exclude={"assignments"})
        return self.repo.create(cycle_data, assignments)

    def update_cycle(self, cycle_id: int, data: TestCycleUpdate):
        cycle = self.get_cycle(cycle_id)
        return self.repo.update(cycle, data.model_dump(exclude_none=True))


# ── Assignment Service ─────────────────────────────────────────────────────

VALID_TRANSITIONS = {
    "not_started":  ["in_progress"],
    "in_progress":  ["needs_review", "not_started", "failed"],
    "needs_review": ["complete", "in_progress", "failed"],
    "complete":     ["needs_review", "failed"],
    "failed":       ["in_progress"],
}

class AssignmentService:
    def __init__(self, db: Session):
        self.repo = AssignmentRepository(db)

    def get_assignment(self, assignment_id: int):
        a = self.repo.get_by_id(assignment_id)
        if not a:
            raise HTTPException(status_code=404, detail="Assignment not found")
        return a

    def add_assignment(self, cycle_id: int, data):
        return self.repo.create(cycle_id, data.model_dump(exclude_none=True))

    def update_assignment(self, assignment_id: int, data: TestAssignmentUpdate):
        assignment = self.get_assignment(assignment_id)
        update_data = data.model_dump(exclude_unset=True)

        if "status" in update_data:
            allowed = VALID_TRANSITIONS.get(assignment.status, [])
            if update_data["status"] != assignment.status and update_data["status"] not in allowed:
                raise HTTPException(
                    status_code=422,
                    detail=f"Cannot transition from '{assignment.status}' to '{update_data['status']}'"
                )
        return self.repo.update(assignment, update_data)


# ── Evidence Service ───────────────────────────────────────────────────────

EVIDENCE_ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt",
    ".png", ".jpg", ".jpeg", ".gif", ".zip", ".msg", ".eml",
}
EVIDENCE_MAX_BYTES = 50 * 1024 * 1024  # 50 MB


class EvidenceService:
    def __init__(self, db: Session):
        self.assignment_repo = AssignmentRepository(db)
        self.evidence_repo = EvidenceRepository(db)

    async def upload_evidence(self, assignment_id: int, file: UploadFile, description: str, uploader_id: int):
        assignment = self.assignment_repo.get_by_id(assignment_id)
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")

        # ── Validate extension ────────────────────────────────────────────
        ext = Path(file.filename).suffix.lower() if file.filename else ""
        if ext not in EVIDENCE_ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{ext or '(none)'}' is not allowed. "
                       f"Allowed: {', '.join(sorted(EVIDENCE_ALLOWED_EXTENSIONS))}",
            )

        # ── Read + validate size / emptiness ─────────────────────────────
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        if len(contents) > EVIDENCE_MAX_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds the {EVIDENCE_MAX_BYTES // (1024 * 1024)} MB upload limit.",
            )

        storage_key = evidence_storage.upload(contents, ext, assignment_id)
        stored_name = Path(storage_key).name

        return self.evidence_repo.create(
            assignment_id=assignment_id,
            filename=stored_name,
            original_filename=file.filename or stored_name,
            file_path=storage_key,
            description=description,
            uploaded_by=uploader_id,
        )

    def delete_evidence(self, evidence_id: int):
        ev = self.evidence_repo.get_by_id(evidence_id)
        if not ev:
            raise HTTPException(status_code=404, detail="Evidence not found")
        evidence_storage.delete(ev.file_path)
        self.evidence_repo.delete(ev)

    def download_evidence(self, evidence_id: int) -> tuple[bytes, str, str]:
        """Returns (bytes, content_type, original_filename)."""
        ev = self.evidence_repo.get_by_id(evidence_id)
        if not ev:
            raise HTTPException(status_code=404, detail="Evidence not found")
        try:
            data, content_type = evidence_storage.download(ev.file_path)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Evidence file not found in storage")
        return data, content_type, ev.original_filename


# ── Audit Service ─────────────────────────────────────────────────────────────

class AuditService:
    """
    Dual-write audit trail:
      1. Writes an AuditLog row inside the current DB transaction.
         If the outer transaction rolls back (e.g. validation error),
         the audit entry rolls back too — no phantom log entries.
      2. Always emits a structured JSON line via the 'audit' logger
         regardless of DB outcome, so SIEM receives every attempt.

    Usage (in a router):
        before = _snap(existing_orm_obj)         # capture state BEFORE
        result = service.update(...)             # do the work
        AuditService(db).log(
            "RISK_UPDATED", actor=current_user,
            resource_type="Risk", resource_id=result.id,
            resource_name=result.name,
            before=before, after=_snap(result),
            request=request,
        )
    """

    def __init__(self, db: Session):
        self.db = db

    # ── private helpers ───────────────────────────────────────────────────

    @staticmethod
    def _diff(before: dict | None, after: dict | None) -> dict:
        if not before or not after:
            return {}
        all_keys = set(before) | set(after)
        return {
            k: {"from": before.get(k), "to": after.get(k)}
            for k in all_keys
            if before.get(k) != after.get(k)
        }

    # ── public API ────────────────────────────────────────────────────────

    def log(
        self,
        action: str,
        *,
        actor: "User | None" = None,
        resource_type: str | None = None,
        resource_id: int | None = None,
        resource_name: str | None = None,
        before: dict | None = None,
        after: dict | None = None,
        request: "Request | None" = None,
        extra: dict | None = None,
    ) -> None:
        from app.models.models import AuditLog

        changes = self._diff(before, after)
        request_id = str(uuid.uuid4())

        ip = ua = None
        if request:
            ip = request.client.host if request.client else None
            ua = (request.headers.get("user-agent") or "")[:500]

        # 1. Write to DB (same transaction as the calling router)
        try:
            entry = AuditLog(
                timestamp=_dt.utcnow(),
                actor_id=actor.id if actor else None,
                actor_email=getattr(actor, "email", None) if actor else None,
                actor_role=getattr(actor, "role", None) if actor else None,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                resource_name=resource_name,
                before_state=json.dumps(before, default=str) if before else None,
                after_state=json.dumps(after, default=str) if after else None,
                changes=json.dumps(changes, default=str) if changes else None,
                ip_address=ip,
                user_agent=ua,
                request_id=request_id,
            )
            self.db.add(entry)
            self.db.commit()
        except Exception:
            # Never let audit failure break the main operation
            _audit_logger.exception("Failed to write audit log to DB for action=%s", action)

        # 2. Emit structured JSON to stdout → Azure Monitor / SIEM
        _audit_logger.info(json.dumps({
            "event":      "audit",
            "timestamp":  _dt.utcnow().isoformat() + "Z",
            "action":     action,
            "actor":      {
                "id":    actor.id    if actor else None,
                "email": getattr(actor, "email", None) if actor else None,
                "role":  getattr(actor, "role",  None) if actor else None,
            },
            "resource":   {"type": resource_type, "id": resource_id, "name": resource_name},
            "changes":    changes,
            "ip":         ip,
            "request_id": request_id,
            **(extra or {}),
        }, default=str))


# ── Dashboard Service ──────────────────────────────────────────────────────

class DashboardService:
    def __init__(self, db: Session):
        self.control_repo = ControlRepository(db)
        self.cycle_repo = TestCycleRepository(db)
        self.assign_repo = AssignmentRepository(db)
        self.evidence_repo = EvidenceRepository(db)
        from app.repositories.repositories import DeficiencyRepository, ControlExceptionRepository, RiskRepository
        self.deficiency_repo = DeficiencyRepository(db)
        self.exception_repo = ControlExceptionRepository(db)
        self.risk_repo = RiskRepository(db)

    def _pci_testing_breakdown(self, all_controls):
        """
        For every control that has at least one PCI DSS mapping, determine its
        'best' assignment status and bucket the counts.

        Priority (high → low): failed > complete > needs_review > in_progress > not_started > never_tested
        """
        STATUS_RANK = {
            "failed":       6,
            "complete":     5,
            "needs_review": 4,
            "in_progress":  3,
            "not_started":  2,
        }

        pci_controls = [
            c for c in all_controls
            if any(m.framework == "PCI" for m in c.mappings)
        ]

        buckets = {
            "total":        len(pci_controls),
            "never_tested": 0,
            "not_started":  0,
            "in_progress":  0,
            "needs_review": 0,
            "complete":     0,
            "failed":       0,
        }

        for ctrl in pci_controls:
            if not ctrl.assignments:
                buckets["never_tested"] += 1
            else:
                # pick the assignment with the highest-priority status
                best = max(
                    ctrl.assignments,
                    key=lambda a: STATUS_RANK.get(a.status, 0)
                )
                bucket_key = best.status if best.status in buckets else "never_tested"
                buckets[bucket_key] += 1

        return buckets

    def get_stats(self):
        all_controls = self.control_repo.get_all()
        all_cycles = self.cycle_repo.get_all()
        status_counts = self.assign_repo.status_counts()
        total_evidence = self.evidence_repo.total_count()
        framework_cov = self.control_repo.framework_coverage()
        def_counts = {d.status: 0 for d in []}
        for d in self.deficiency_repo.get_all():
            def_counts[d.status] = def_counts.get(d.status, 0) + 1

        return {
            "total_controls": len(all_controls),
            "active_controls": sum(1 for c in all_controls if c.status == "active"),
            "total_test_cycles": len(all_cycles),
            "active_test_cycles": sum(1 for c in all_cycles if c.status == "active"),
            "total_assignments": sum(status_counts.values()),
            "not_started": status_counts.get("not_started", 0),
            "in_progress": status_counts.get("in_progress", 0),
            "needs_review": status_counts.get("needs_review", 0),
            "complete": status_counts.get("complete", 0),
            "failed": status_counts.get("failed", 0),
            "total_evidence": total_evidence,
            "framework_coverage": framework_cov,
            "deficiency_open": def_counts.get("open", 0),
            "deficiency_in_remediation": def_counts.get("in_remediation", 0),
            "deficiency_remediated": def_counts.get("remediated", 0),
            "deficiency_risk_accepted": def_counts.get("risk_accepted", 0),
            "pci_testing": self._pci_testing_breakdown(all_controls),
            "risk_aging": self._risk_aging_breakdown(self.risk_repo.get_all()),
            **self._exception_stats(),
        }

    def _exception_stats(self):
        from datetime import date, timedelta
        all_exc = self.exception_repo.get_all()
        soon = date.today() + timedelta(days=30)
        return {
            "exception_pending":  sum(1 for e in all_exc if e.status == "pending_approval"),
            "exception_approved": sum(1 for e in all_exc if e.status == "approved"),
            "exception_expiring_soon": sum(
                1 for e in all_exc
                if e.status == "approved" and e.expiry_date and e.expiry_date <= soon
            ),
        }

    def _risk_aging_breakdown(self, risks):
        from datetime import datetime
        today = datetime.utcnow()
        buckets = {"0_30": 0, "30_60": 0, "60_90": 0, "90_180": 0, "180_365": 0, "365_plus": 0}
        for r in risks:
            if not r.created_at:
                continue
            days = (today - r.created_at).days
            if days <= 30:
                buckets["0_30"] += 1
            elif days <= 60:
                buckets["30_60"] += 1
            elif days <= 90:
                buckets["60_90"] += 1
            elif days <= 180:
                buckets["90_180"] += 1
            elif days <= 365:
                buckets["180_365"] += 1
            else:
                buckets["365_plus"] += 1
        return buckets


# ── Deficiency Service ─────────────────────────────────────────────────────

class DeficiencyService:
    def __init__(self, db: Session):
        from app.repositories.repositories import DeficiencyRepository
        self.repo = DeficiencyRepository(db)

    def get(self, deficiency_id: int):
        d = self.repo.get_by_id(deficiency_id)
        if not d:
            raise HTTPException(status_code=404, detail="Deficiency not found")
        return d

    def list_all(self, status: str = None):
        return self.repo.get_all(status)

    def list_for_assignment(self, assignment_id: int):
        return self.repo.get_by_assignment(assignment_id)

    def create(self, data):
        return self.repo.create(data.model_dump())

    def update(self, deficiency_id: int, data):
        d = self.repo.get_by_id(deficiency_id)
        if not d:
            raise HTTPException(status_code=404, detail="Deficiency not found")
        return self.repo.update(d, data.model_dump(exclude_unset=True))

    def delete(self, deficiency_id: int):
        d = self.repo.get_by_id(deficiency_id)
        if not d:
            raise HTTPException(status_code=404, detail="Deficiency not found")
        self.repo.delete(d)


# ── Asset Service ──────────────────────────────────────────────────────────

class AssetService:
    def __init__(self, db: Session):
        from app.repositories.repositories import AssetRepository
        self.repo = AssetRepository(db)

    def list_all(self):
        return self.repo.get_all()

    def get(self, id: int):
        obj = self.repo.get_by_id(id)
        if not obj:
            raise HTTPException(404, "Asset not found")
        return obj

    def create(self, data):
        return self.repo.create(data.model_dump())

    def update(self, id: int, data):
        obj = self.get(id)
        return self.repo.update(obj, data.model_dump(exclude_unset=True))

    def delete(self, id: int):
        self.repo.delete(self.get(id))


# ── Threat Service ─────────────────────────────────────────────────────────

class ThreatService:
    def __init__(self, db: Session):
        from app.repositories.repositories import ThreatRepository
        self.repo = ThreatRepository(db)

    def list_all(self):
        return self.repo.get_all()

    def get(self, id: int):
        obj = self.repo.get_by_id(id)
        if not obj:
            raise HTTPException(404, "Threat not found")
        return obj

    def create(self, data):
        return self.repo.create(data.model_dump())

    def update(self, id: int, data):
        obj = self.get(id)
        return self.repo.update(obj, data.model_dump(exclude_unset=True))

    def delete(self, id: int):
        self.repo.delete(self.get(id))


# ── Risk Service ───────────────────────────────────────────────────────────

class RiskService:
    def __init__(self, db: Session):
        from app.repositories.repositories import RiskRepository
        self.repo = RiskRepository(db)

    def list_all(self):
        return self.repo.get_all()

    def get(self, id: int):
        obj = self.repo.get_by_id(id)
        if not obj:
            raise HTTPException(404, "Risk not found")
        return obj

    def create(self, data):
        return self.repo.create(data.model_dump())

    def update(self, id: int, data):
        obj = self.get(id)
        return self.repo.update(obj, data.model_dump(exclude_unset=True))

    def delete(self, id: int):
        self.repo.delete(self.get(id))

    def add_control(self, risk_id: int, control_id: int, notes: str = None):
        self.get(risk_id)
        return self.repo.add_control(risk_id, control_id, notes)

    def remove_control(self, risk_id: int, control_id: int):
        self.get(risk_id)
        self.repo.remove_control(risk_id, control_id)

    def get_risks_for_control(self, control_id: int):
        return self.repo.get_risks_for_control(control_id)
