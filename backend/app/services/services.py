import uuid
import shutil
from pathlib import Path
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
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


# ── Auth Service ───────────────────────────────────────────────────────────

class AuthService:
    def __init__(self, db: Session):
        self.repo = UserRepository(db)

    def login(self, req: LoginRequest):
        user = self.repo.get_by_username(req.username)
        if not user:
            raise HTTPException(status_code=404, detail=f"User '{req.username}' not found")
        token = encode_token(user.id, user.username, user.role)
        return {"access_token": token, "token_type": "bearer", "user": user}


# ── User Service ───────────────────────────────────────────────────────────

class UserService:
    def __init__(self, db: Session):
        self.repo = UserRepository(db)

    def list_users(self):
        return self.repo.get_all()

    def get_user(self, user_id: int):
        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user


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
        return self.repo.update(ctrl, data.model_dump(exclude_none=True))

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

class EvidenceService:
    def __init__(self, db: Session):
        self.assignment_repo = AssignmentRepository(db)
        self.evidence_repo = EvidenceRepository(db)

    async def upload_evidence(self, assignment_id: int, file: UploadFile, description: str, uploader_id: int):
        assignment = self.assignment_repo.get_by_id(assignment_id)
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")

        upload_dir = Path(settings.evidence_upload_dir) / str(assignment_id)
        upload_dir.mkdir(parents=True, exist_ok=True)

        ext = Path(file.filename).suffix if file.filename else ""
        stored_name = f"{uuid.uuid4().hex}{ext}"
        dest = upload_dir / stored_name

        with dest.open("wb") as buf:
            shutil.copyfileobj(file.file, buf)

        return self.evidence_repo.create(
            assignment_id=assignment_id,
            filename=stored_name,
            original_filename=file.filename or stored_name,
            file_path=str(dest),
            description=description,
            uploaded_by=uploader_id,
        )

    def delete_evidence(self, evidence_id: int):
        ev = self.evidence_repo.get_by_id(evidence_id)
        if not ev:
            raise HTTPException(status_code=404, detail="Evidence not found")
        p = Path(ev.file_path)
        if p.exists():
            p.unlink()
        self.evidence_repo.delete(ev)


# ── Dashboard Service ──────────────────────────────────────────────────────

class DashboardService:
    def __init__(self, db: Session):
        self.control_repo = ControlRepository(db)
        self.cycle_repo = TestCycleRepository(db)
        self.assign_repo = AssignmentRepository(db)
        self.evidence_repo = EvidenceRepository(db)
        from app.repositories.repositories import DeficiencyRepository, ControlExceptionRepository
        self.deficiency_repo = DeficiencyRepository(db)
        self.exception_repo = ControlExceptionRepository(db)

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


# ── Deficiency Service ─────────────────────────────────────────────────────

class DeficiencyService:
    def __init__(self, db: Session):
        from app.repositories.repositories import DeficiencyRepository
        self.repo = DeficiencyRepository(db)

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
