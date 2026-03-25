from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime
from typing import Optional
from app.models.models import User, Control, ControlMapping, TestCycle, TestAssignment, Evidence, Deficiency, Asset, Threat, Risk, RiskControl, ControlException


# ── User Repository ────────────────────────────────────────────────────────

class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> list[User]:
        return self.db.query(User).order_by(User.display_name).all()

    def get_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter(User.username == username).first()

    def create(self, **kwargs) -> User:
        user = User(**kwargs)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user


# ── Control Repository ─────────────────────────────────────────────────────

class ControlRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self, status: Optional[str] = None) -> list[Control]:
        q = self.db.query(Control).options(
            joinedload(Control.mappings),
            joinedload(Control.assignments),
        )
        if status:
            q = q.filter(Control.status == status)
        return q.order_by(Control.control_id).all()

    def get_by_id(self, control_id: int) -> Optional[Control]:
        return (
            self.db.query(Control)
            .options(joinedload(Control.mappings))
            .filter(Control.id == control_id)
            .first()
        )

    def create(self, data: dict, mappings: list[dict] = None) -> Control:
        control = Control(**data)
        self.db.add(control)
        self.db.flush()
        if mappings:
            for m in mappings:
                mapping = ControlMapping(control_id=control.id, **m)
                self.db.add(mapping)
        self.db.commit()
        self.db.refresh(control)
        return control

    def update(self, control: Control, data: dict) -> Control:
        for k, v in data.items():
            if v is not None:
                setattr(control, k, v)
        control.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(control)
        return control

    def delete(self, control: Control) -> None:
        self.db.delete(control)
        self.db.commit()

    def framework_coverage(self) -> dict[str, int]:
        rows = (
            self.db.query(ControlMapping.framework, func.count(func.distinct(ControlMapping.control_id)))
            .group_by(ControlMapping.framework)
            .all()
        )
        return {row[0]: row[1] for row in rows}


# ── Test Cycle Repository ──────────────────────────────────────────────────

class TestCycleRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> list[TestCycle]:
        return (
            self.db.query(TestCycle)
            .options(joinedload(TestCycle.creator))
            .order_by(TestCycle.created_at.desc())
            .all()
        )

    def get_by_id(self, cycle_id: int) -> Optional[TestCycle]:
        return (
            self.db.query(TestCycle)
            .options(
                joinedload(TestCycle.creator),
                joinedload(TestCycle.assignments).joinedload(TestAssignment.control).joinedload(Control.mappings),
                joinedload(TestCycle.assignments).joinedload(TestAssignment.tester),
                joinedload(TestCycle.assignments).joinedload(TestAssignment.reviewer),
                joinedload(TestCycle.assignments).joinedload(TestAssignment.evidence),
                joinedload(TestCycle.assignments).joinedload(TestAssignment.deficiencies),
            )
            .filter(TestCycle.id == cycle_id)
            .first()
        )

    def create(self, data: dict, assignments: list[dict] = None) -> TestCycle:
        cycle = TestCycle(**data)
        self.db.add(cycle)
        self.db.flush()
        if assignments:
            for a in assignments:
                assignment = TestAssignment(test_cycle_id=cycle.id, **a)
                self.db.add(assignment)
        self.db.commit()
        self.db.refresh(cycle)
        return cycle

    def update(self, cycle: TestCycle, data: dict) -> TestCycle:
        for k, v in data.items():
            if v is not None:
                setattr(cycle, k, v)
        self.db.commit()
        self.db.refresh(cycle)
        return cycle


# ── Assignment Repository ──────────────────────────────────────────────────

class AssignmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, assignment_id: int) -> Optional[TestAssignment]:
        return (
            self.db.query(TestAssignment)
            .options(
                joinedload(TestAssignment.control),
                joinedload(TestAssignment.tester),
                joinedload(TestAssignment.reviewer),
                joinedload(TestAssignment.evidence),
                joinedload(TestAssignment.deficiencies),
            )
            .filter(TestAssignment.id == assignment_id)
            .first()
        )

    def bulk_create(self, cycle_id: int, control_ids: list[int]) -> int:
        """Insert multiple assignments, skipping any control already in the cycle. Returns count added."""
        existing = {
            row[0] for row in
            self.db.query(TestAssignment.control_id)
            .filter(TestAssignment.test_cycle_id == cycle_id)
            .all()
        }
        new_assignments = [
            TestAssignment(test_cycle_id=cycle_id, control_id=cid)
            for cid in control_ids
            if cid not in existing
        ]
        if new_assignments:
            self.db.add_all(new_assignments)
            self.db.commit()
        return len(new_assignments)

    def create(self, cycle_id: int, data: dict) -> TestAssignment:
        assignment = TestAssignment(test_cycle_id=cycle_id, **data)
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        return self.get_by_id(assignment.id)

    def update(self, assignment: TestAssignment, data: dict) -> TestAssignment:
        for k, v in data.items():
            setattr(assignment, k, v)
        assignment.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def status_counts(self) -> dict:
        rows = (
            self.db.query(TestAssignment.status, func.count(TestAssignment.id))
            .group_by(TestAssignment.status)
            .all()
        )
        return {row[0]: row[1] for row in rows}


# ── Evidence Repository ────────────────────────────────────────────────────

class EvidenceRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, **kwargs) -> Evidence:
        evidence = Evidence(**kwargs)
        self.db.add(evidence)
        self.db.commit()
        self.db.refresh(evidence)
        return evidence

    def get_by_id(self, evidence_id: int) -> Optional[Evidence]:
        return self.db.query(Evidence).filter(Evidence.id == evidence_id).first()

    def get_by_assignment(self, assignment_id: int) -> list[Evidence]:
        return self.db.query(Evidence).filter(Evidence.assignment_id == assignment_id).all()

    def delete(self, evidence: Evidence) -> None:
        self.db.delete(evidence)
        self.db.commit()

    def total_count(self) -> int:
        return self.db.query(func.count(Evidence.id)).scalar()


# ── Deficiency Repository ──────────────────────────────────────────────────

class DeficiencyRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_assignment(self, assignment_id: int) -> list:
        return (
            self.db.query(Deficiency)
            .filter(Deficiency.assignment_id == assignment_id)
            .order_by(Deficiency.created_at.desc())
            .all()
        )

    def get_all(self, status: str = None) -> list:
        q = self.db.query(Deficiency)
        if status:
            q = q.filter(Deficiency.status == status)
        return q.order_by(Deficiency.created_at.desc()).all()

    def get_by_id(self, deficiency_id: int):
        return self.db.query(Deficiency).filter(Deficiency.id == deficiency_id).first()

    def create(self, data: dict):
        d = Deficiency(**data)
        self.db.add(d)
        self.db.commit()
        self.db.refresh(d)
        return d

    def update(self, deficiency, data: dict):
        for k, v in data.items():
            setattr(deficiency, k, v)
        deficiency.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(deficiency)
        return deficiency

    def delete(self, deficiency) -> None:
        self.db.delete(deficiency)
        self.db.commit()


# ── Asset Repository ───────────────────────────────────────────────────────

class AssetRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self):
        return self.db.query(Asset).order_by(Asset.name).all()

    def get_by_id(self, id: int):
        return self.db.query(Asset).filter(Asset.id == id).first()

    def create(self, data: dict):
        obj = Asset(**data)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def update(self, obj: Asset, data: dict):
        for k, v in data.items():
            setattr(obj, k, v)
        obj.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete(self, obj: Asset):
        self.db.delete(obj)
        self.db.commit()


# ── Threat Repository ──────────────────────────────────────────────────────

class ThreatRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self):
        return self.db.query(Threat).order_by(Threat.name).all()

    def get_by_id(self, id: int):
        return self.db.query(Threat).filter(Threat.id == id).first()

    def create(self, data: dict):
        obj = Threat(**data)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def update(self, obj: Threat, data: dict):
        for k, v in data.items():
            setattr(obj, k, v)
        obj.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete(self, obj: Threat):
        self.db.delete(obj)
        self.db.commit()


# ── Risk Repository ────────────────────────────────────────────────────────

class RiskRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self):
        return (
            self.db.query(Risk)
            .options(
                joinedload(Risk.asset),
                joinedload(Risk.threat),
                joinedload(Risk.controls).joinedload(RiskControl.control),
            )
            .order_by(Risk.created_at.desc())
            .all()
        )

    def get_by_id(self, id: int):
        return (
            self.db.query(Risk)
            .options(
                joinedload(Risk.asset),
                joinedload(Risk.threat),
                joinedload(Risk.controls).joinedload(RiskControl.control),
            )
            .filter(Risk.id == id)
            .first()
        )

    def create(self, data: dict):
        obj = Risk(**data)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return self.get_by_id(obj.id)

    def update(self, obj: Risk, data: dict):
        for k, v in data.items():
            setattr(obj, k, v)
        obj.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(obj)
        return self.get_by_id(obj.id)

    def delete(self, obj: Risk):
        self.db.delete(obj)
        self.db.commit()

    def add_control(self, risk_id: int, control_id: int, notes: str = None):
        existing = self.db.query(RiskControl).filter_by(risk_id=risk_id, control_id=control_id).first()
        if existing:
            return existing
        rc = RiskControl(risk_id=risk_id, control_id=control_id, notes=notes)
        self.db.add(rc)
        self.db.commit()
        self.db.refresh(rc)
        return rc

    def remove_control(self, risk_id: int, control_id: int):
        rc = self.db.query(RiskControl).filter_by(risk_id=risk_id, control_id=control_id).first()
        if rc:
            self.db.delete(rc)
            self.db.commit()

    def get_risks_for_control(self, control_id: int):
        return (
            self.db.query(Risk)
            .join(RiskControl, RiskControl.risk_id == Risk.id)
            .options(
                joinedload(Risk.asset),
                joinedload(Risk.threat),
                joinedload(Risk.controls).joinedload(RiskControl.control),
            )
            .filter(RiskControl.control_id == control_id)
            .all()
        )


# ── Control Exception Repository ───────────────────────────────────────────

class ControlExceptionRepository:
    def __init__(self, db: Session):
        self.db = db

    def _base_query(self):
        return (
            self.db.query(ControlException)
            .options(
                joinedload(ControlException.control).joinedload(Control.mappings),
                joinedload(ControlException.requester),
                joinedload(ControlException.approver),
            )
        )

    def get_all(self, status: str = None, control_id: int = None):
        q = self._base_query()
        if status:
            q = q.filter(ControlException.status == status)
        if control_id:
            q = q.filter(ControlException.control_id == control_id)
        return q.order_by(ControlException.created_at.desc()).all()

    def get_by_id(self, exception_id: int):
        return self._base_query().filter(ControlException.id == exception_id).first()

    def create(self, data: dict) -> ControlException:
        exc = ControlException(**data)
        self.db.add(exc)
        self.db.commit()
        self.db.refresh(exc)
        return self.get_by_id(exc.id)

    def update(self, exc: ControlException, data: dict) -> ControlException:
        for k, v in data.items():
            setattr(exc, k, v)
        self.db.commit()
        self.db.refresh(exc)
        return self.get_by_id(exc.id)

    def delete(self, exc: ControlException):
        self.db.delete(exc)
        self.db.commit()
