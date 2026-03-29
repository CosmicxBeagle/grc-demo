from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.models import TreatmentPlan, TreatmentMilestone
from app.schemas.schemas import (
    TreatmentPlanCreate, TreatmentPlanUpdate,
    TreatmentMilestoneCreate, TreatmentMilestoneUpdate,
)


class TreatmentPlanService:

    @staticmethod
    def get_by_risk(db: Session, risk_id: int) -> TreatmentPlan | None:
        return db.query(TreatmentPlan).filter(TreatmentPlan.risk_id == risk_id).first()

    @staticmethod
    def create(db: Session, data: TreatmentPlanCreate) -> TreatmentPlan:
        existing = db.query(TreatmentPlan).filter(TreatmentPlan.risk_id == data.risk_id).first()
        if existing:
            raise HTTPException(400, "A treatment plan already exists for this risk")
        plan = TreatmentPlan(**data.model_dump())
        db.add(plan)
        db.commit()
        db.refresh(plan)
        return plan

    @staticmethod
    def update(db: Session, plan_id: int, data: TreatmentPlanUpdate) -> TreatmentPlan:
        plan = db.query(TreatmentPlan).filter(TreatmentPlan.id == plan_id).first()
        if not plan:
            raise HTTPException(404, "Treatment plan not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(plan, field, value)
        plan.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(plan)
        return plan

    @staticmethod
    def delete(db: Session, plan_id: int) -> None:
        plan = db.query(TreatmentPlan).filter(TreatmentPlan.id == plan_id).first()
        if not plan:
            raise HTTPException(404, "Treatment plan not found")
        db.delete(plan)
        db.commit()

    # ── Milestones ────────────────────────────────────────────────────────

    @staticmethod
    def add_milestone(db: Session, plan_id: int, data: TreatmentMilestoneCreate) -> TreatmentMilestone:
        plan = db.query(TreatmentPlan).filter(TreatmentPlan.id == plan_id).first()
        if not plan:
            raise HTTPException(404, "Treatment plan not found")
        milestone = TreatmentMilestone(plan_id=plan_id, **data.model_dump())
        db.add(milestone)
        db.commit()
        db.refresh(milestone)
        return milestone

    @staticmethod
    def update_milestone(db: Session, milestone_id: int, data: TreatmentMilestoneUpdate) -> TreatmentMilestone:
        m = db.query(TreatmentMilestone).filter(TreatmentMilestone.id == milestone_id).first()
        if not m:
            raise HTTPException(404, "Milestone not found")
        updates = data.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(m, field, value)
        # Auto-stamp completed_at when status flips to completed
        if "status" in updates:
            if updates["status"] == "completed" and not m.completed_at:
                m.completed_at = datetime.utcnow()
            elif updates["status"] != "completed":
                m.completed_at = None
        db.commit()
        db.refresh(m)
        return m

    @staticmethod
    def delete_milestone(db: Session, milestone_id: int) -> None:
        m = db.query(TreatmentMilestone).filter(TreatmentMilestone.id == milestone_id).first()
        if not m:
            raise HTTPException(404, "Milestone not found")
        db.delete(m)
        db.commit()
