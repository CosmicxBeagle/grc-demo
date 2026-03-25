from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Date, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    asset_type = Column(String(50))   # application / database / infrastructure / network / data / physical / process / people
    criticality = Column(String(20))  # critical / high / medium / low
    owner = Column(String(100))
    status = Column(String(20), default="active")  # active / decommissioned
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    risks = relationship("Risk", back_populates="asset")


class Threat(Base):
    __tablename__ = "threats"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    threat_category = Column(String(50))  # cyber / access / data-breach / insider / physical / natural / compliance / operational
    source = Column(String(20))           # internal / external / environmental
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    risks = relationship("Risk", back_populates="threat")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    role = Column(String(20), nullable=False)  # admin, tester, reviewer


class Control(Base):
    __tablename__ = "controls"

    id = Column(Integer, primary_key=True, index=True)
    control_id = Column(String(50), unique=True, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    control_type = Column(String(50))   # preventive, detective, corrective
    frequency = Column(String(50))      # annual, quarterly, monthly, continuous
    owner = Column(String(100))
    status = Column(String(20), default="active")
    # SOX ITGC scoping
    sox_in_scope   = Column(Boolean, default=False, nullable=False)
    sox_itgc_domain = Column(String(50))   # Access Controls / Change Management / Computer Operations / Program Development
    sox_systems    = Column(Text)          # comma-separated system names, e.g. "SAP, Oracle, Active Directory"
    sox_assertions = Column(Text)          # comma-separated assertions, e.g. "Completeness, Accuracy"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    mappings = relationship("ControlMapping", back_populates="control", cascade="all, delete-orphan")
    assignments = relationship("TestAssignment", back_populates="control")
    risk_controls = relationship("RiskControl", back_populates="control", cascade="all, delete-orphan")
    exceptions = relationship("ControlException", back_populates="control", cascade="all, delete-orphan")


class ControlMapping(Base):
    __tablename__ = "control_mappings"

    id = Column(Integer, primary_key=True, index=True)
    control_id = Column(Integer, ForeignKey("controls.id"), nullable=False)
    framework = Column(String(20), nullable=False)  # PCI, NIST, CIS, SOX
    framework_version = Column(String(20))           # e.g. v4.0.1, v2.0, v8.1
    framework_ref = Column(String(100), nullable=False)
    framework_description = Column(Text)

    control = relationship("Control", back_populates="mappings")


class TestCycle(Base):
    __tablename__ = "test_cycles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(String(20), default="planned")  # planned, active, completed
    brand = Column(String(50))
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User", foreign_keys=[created_by])
    assignments = relationship("TestAssignment", back_populates="test_cycle", cascade="all, delete-orphan")


class TestAssignment(Base):
    __tablename__ = "test_assignments"

    id = Column(Integer, primary_key=True, index=True)
    test_cycle_id = Column(Integer, ForeignKey("test_cycles.id"), nullable=False)
    control_id = Column(Integer, ForeignKey("controls.id"), nullable=False)
    tester_id = Column(Integer, ForeignKey("users.id"))
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(30), default="not_started")
    # not_started | in_progress | needs_review | complete
    tester_notes = Column(Text)
    reviewer_comments = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    test_cycle = relationship("TestCycle", back_populates="assignments")
    control = relationship("Control", back_populates="assignments")
    tester = relationship("User", foreign_keys=[tester_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    evidence = relationship("Evidence", back_populates="assignment", cascade="all, delete-orphan")
    deficiencies = relationship("Deficiency", back_populates="assignment", cascade="all, delete-orphan")


class Deficiency(Base):
    __tablename__ = "deficiencies"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("test_assignments.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    severity = Column(String(20), nullable=False, default="high")  # critical/high/medium/low
    remediation_plan = Column(Text)
    status = Column(String(30), nullable=False, default="open")  # open/in_remediation/remediated/risk_accepted
    due_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assignment = relationship("TestAssignment", back_populates="deficiencies")


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("test_assignments.id"), nullable=False)
    filename = Column(String(255), nullable=False)          # stored filename (uuid-based)
    original_filename = Column(String(255), nullable=False) # original upload name
    file_path = Column(String(500), nullable=False)
    description = Column(Text)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    assignment = relationship("TestAssignment", back_populates="evidence")
    uploader = relationship("User", foreign_keys=[uploaded_by])


class Risk(Base):
    __tablename__ = "risks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)
    threat_id = Column(Integer, ForeignKey("threats.id"), nullable=True)
    likelihood = Column(Integer, default=3)   # 1-5
    impact = Column(Integer, default=3)       # 1-5
    # inherent_score = likelihood * impact (computed property)
    treatment = Column(String(20), default="mitigate")  # mitigate / accept / transfer / avoid
    status = Column(String(20), default="open")         # open / mitigated / accepted / transferred / closed
    owner = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    asset = relationship("Asset", back_populates="risks")
    threat = relationship("Threat", back_populates="risks")
    controls = relationship("RiskControl", back_populates="risk", cascade="all, delete-orphan")


class RiskControl(Base):
    __tablename__ = "risk_controls"

    id = Column(Integer, primary_key=True, index=True)
    risk_id = Column(Integer, ForeignKey("risks.id"), nullable=False)
    control_id = Column(Integer, ForeignKey("controls.id"), nullable=False)
    notes = Column(Text)

    risk = relationship("Risk", back_populates="controls")
    control = relationship("Control", back_populates="risk_controls")


class ControlException(Base):
    __tablename__ = "control_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    control_id = Column(Integer, ForeignKey("controls.id"), nullable=False)

    title          = Column(String(200), nullable=False)
    exception_type = Column(String(30), nullable=False, default="exception")
    # exception | risk_acceptance | compensating_control

    justification        = Column(Text, nullable=False)
    compensating_control = Column(Text)   # what alternative mitigates the risk
    risk_level           = Column(String(20), default="high")
    # critical / high / medium / low  — residual risk while exception is active

    status       = Column(String(30), nullable=False, default="pending_approval")
    # draft | pending_approval | approved | rejected | expired

    requested_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    approver_notes = Column(Text)

    expiry_date  = Column(Date, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    control   = relationship("Control", back_populates="exceptions")
    requester = relationship("User", foreign_keys=[requested_by])
    approver  = relationship("User", foreign_keys=[approved_by])
