"""
Run this script once to seed the SQLite database with sample data.
  cd backend
  python -m data.sample_data
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date, datetime
from app.db.database import SessionLocal, engine
from app.models.models import Base, User, Control, ControlMapping, TestCycle, TestAssignment

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# ── Clear existing data ────────────────────────────────────────────────────
for model in [TestAssignment, TestCycle, ControlMapping, Control, User]:
    db.query(model).delete()
db.commit()

# ── Users ──────────────────────────────────────────────────────────────────
users = [
    User(username="alice",   display_name="Alice Admin",     email="alice@demo.local",   role="admin"),
    User(username="bob",     display_name="Bob Tester",      email="bob@demo.local",     role="tester"),
    User(username="carol",   display_name="Carol Tester",    email="carol@demo.local",   role="tester"),
    User(username="dave",    display_name="Dave Reviewer",   email="dave@demo.local",    role="reviewer"),
    User(username="eve",     display_name="Eve Reviewer",    email="eve@demo.local",     role="reviewer"),
]
db.add_all(users)
db.commit()
for u in users:
    db.refresh(u)

alice, bob, carol, dave, eve = users

# ── Controls ───────────────────────────────────────────────────────────────
control_defs = [
    {
        "control_id": "CC-001",
        "title": "User Access Review",
        "description": "Quarterly review of user access rights to ensure least-privilege principles.",
        "control_type": "detective",
        "frequency": "quarterly",
        "owner": "IT Security",
        "mappings": [
            ("PCI",  "PCI DSS 7.2.1",    "Ensure only authorized individuals can access systems"),
            ("NIST", "NIST AC-2",         "Account Management"),
            ("CIS",  "CIS Control 5.1",   "Establish and Maintain an Inventory of Accounts"),
            ("SOX",  "SOX ITGC UC-01",    "User Access — Quarterly Certification"),
        ],
    },
    {
        "control_id": "CC-002",
        "title": "Password Policy Enforcement",
        "description": "Enforce minimum password complexity: 12 chars, mixed case, special chars, 90-day rotation.",
        "control_type": "preventive",
        "frequency": "continuous",
        "owner": "IT Security",
        "mappings": [
            ("PCI",  "PCI DSS 8.3.6",  "Password/passphrase minimum length"),
            ("NIST", "NIST IA-5",      "Authenticator Management"),
            ("CIS",  "CIS Control 5.2","Use Unique Passwords"),
            ("SOX",  "SOX ITGC LC-03", "Logical Access — Password Controls"),
        ],
    },
    {
        "control_id": "CC-003",
        "title": "Privileged Access Management",
        "description": "All privileged accounts must use MFA and activity must be logged and reviewed monthly.",
        "control_type": "preventive",
        "frequency": "monthly",
        "owner": "IT Security",
        "mappings": [
            ("PCI",  "PCI DSS 8.4.2",  "MFA for all access to the CDE"),
            ("NIST", "NIST AC-6",      "Least Privilege"),
            ("CIS",  "CIS Control 5.4","Restrict Administrator Privileges to Dedicated Admin Accounts"),
            ("SOX",  "SOX ITGC LC-04", "Logical Access — Privileged Access Review"),
        ],
    },
    {
        "control_id": "CC-004",
        "title": "Change Management Process",
        "description": "All system changes must follow ITSM change process: request, approval, test, deploy, PIR.",
        "control_type": "preventive",
        "frequency": "continuous",
        "owner": "IT Operations",
        "mappings": [
            ("PCI",  "PCI DSS 6.5.1",  "Processes and mechanisms for protecting all system components"),
            ("NIST", "NIST CM-3",      "Configuration Change Control"),
            ("CIS",  "CIS Control 4.1","Establish and Maintain a Secure Configuration Process"),
            ("SOX",  "SOX ITGC PC-01", "Program Change — Formal Change Approval"),
        ],
    },
    {
        "control_id": "CC-005",
        "title": "Vulnerability Management",
        "description": "Monthly vulnerability scans; critical findings remediated within 30 days.",
        "control_type": "detective",
        "frequency": "monthly",
        "owner": "IT Security",
        "mappings": [
            ("PCI",  "PCI DSS 11.3.1", "Internal vulnerability scans"),
            ("NIST", "NIST RA-5",      "Vulnerability Monitoring and Scanning"),
            ("CIS",  "CIS Control 7.1","Perform Automated OS Patch Management"),
            ("SOX",  "SOX ITGC OM-02", "Operations — Vulnerability Remediation"),
        ],
    },
    {
        "control_id": "CC-006",
        "title": "Backup and Recovery Testing",
        "description": "Daily backups; quarterly recovery tests with documented results.",
        "control_type": "corrective",
        "frequency": "quarterly",
        "owner": "IT Operations",
        "mappings": [
            ("PCI",  "PCI DSS 12.3.3", "Cryptographic cipher suites and protocols"),
            ("NIST", "NIST CP-9",      "System Backup"),
            ("CIS",  "CIS Control 11.1","Establish and Maintain a Data Recovery Process"),
            ("SOX",  "SOX ITGC OM-03", "Operations — Backup and Recovery"),
        ],
    },
    {
        "control_id": "CC-007",
        "title": "Security Awareness Training",
        "description": "Annual mandatory security awareness training for all employees; phishing simulation quarterly.",
        "control_type": "preventive",
        "frequency": "annual",
        "owner": "HR / IT Security",
        "mappings": [
            ("PCI",  "PCI DSS 12.6.1", "Security awareness program"),
            ("NIST", "NIST AT-2",      "Literacy Training and Awareness"),
            ("CIS",  "CIS Control 14.1","Establish and Maintain a Security Awareness Program"),
            ("SOX",  "SOX ITGC GN-01", "General — Security Awareness Training"),
        ],
    },
    {
        "control_id": "CC-008",
        "title": "Incident Response Plan",
        "description": "Maintain and test an incident response plan; tabletop exercises bi-annually.",
        "control_type": "corrective",
        "frequency": "annual",
        "owner": "IT Security",
        "mappings": [
            ("PCI",  "PCI DSS 12.10.1","Incident response plan"),
            ("NIST", "NIST IR-8",      "Incident Response Plan"),
            ("CIS",  "CIS Control 17.1","Designate Personnel to Manage Incident Handling"),
            ("SOX",  "SOX ITGC GN-02", "General — Incident Response"),
        ],
    },
    {
        "control_id": "CC-009",
        "title": "Firewall Rule Review",
        "description": "Semi-annual review of all firewall rules; remove unused rules, document exceptions.",
        "control_type": "detective",
        "frequency": "quarterly",
        "owner": "Network Security",
        "mappings": [
            ("PCI",  "PCI DSS 1.3.2",  "Restrict inbound traffic to only that which is necessary"),
            ("NIST", "NIST SC-7",      "Boundary Protection"),
            ("CIS",  "CIS Control 12.2","Establish and Maintain a Secure Network Architecture"),
            ("SOX",  "SOX ITGC LC-05", "Logical Access — Network Access Controls"),
        ],
    },
    {
        "control_id": "CC-010",
        "title": "Data Classification and Handling",
        "description": "All data assets must be classified; handling requirements enforced per classification.",
        "control_type": "preventive",
        "frequency": "annual",
        "owner": "Data Governance",
        "mappings": [
            ("PCI",  "PCI DSS 12.3.1", "Sensitive authentication data (SAD) protection"),
            ("NIST", "NIST AC-16",     "Security and Privacy Attributes"),
            ("CIS",  "CIS Control 3.1","Establish and Maintain a Data Management Process"),
            ("SOX",  "SOX ITGC DC-01", "Data Controls — Classification Policy"),
        ],
    },
    {
        "control_id": "CC-011",
        "title": "Segregation of Duties — Financial Systems",
        "description": "No single user may initiate, approve, and record financial transactions in ERP.",
        "control_type": "preventive",
        "frequency": "continuous",
        "owner": "Finance / IT",
        "mappings": [
            ("PCI",  "PCI DSS 7.2.4",  "Review of user accounts"),
            ("NIST", "NIST AC-5",      "Separation of Duties"),
            ("CIS",  "CIS Control 6.8","Define and Maintain Role-Based Access Control"),
            ("SOX",  "SOX AC-01",      "Access Control — Segregation of Duties"),
        ],
    },
    {
        "control_id": "CC-012",
        "title": "Financial Close Process Controls",
        "description": "Month-end close checklist must be completed and signed off before books are closed.",
        "control_type": "preventive",
        "frequency": "monthly",
        "owner": "Finance",
        "mappings": [
            ("SOX",  "SOX FC-01",      "Financial Close — Completeness and Accuracy"),
            ("NIST", "NIST AU-9",      "Protection of Audit Information"),
        ],
    },
]

for cdef in control_defs:
    mappings_raw = cdef.pop("mappings")
    ctrl = Control(**cdef)
    db.add(ctrl)
    db.flush()
    for framework, ref, desc in mappings_raw:
        db.add(ControlMapping(control_id=ctrl.id, framework=framework, framework_ref=ref, framework_description=desc))
db.commit()

controls = db.query(Control).order_by(Control.id).all()

# ── Test Cycles ────────────────────────────────────────────────────────────
cycle1 = TestCycle(
    name="Q1 2026 — PCI DSS Annual Review",
    description="Annual PCI DSS compliance testing cycle covering all in-scope controls.",
    start_date=date(2026, 1, 6),
    end_date=date(2026, 3, 28),
    status="active",
    created_by=alice.id,
)
cycle2 = TestCycle(
    name="Q2 2026 — SOX ITGC Testing",
    description="Semi-annual SOX ITGC testing for external audit readiness.",
    start_date=date(2026, 4, 1),
    end_date=date(2026, 6, 27),
    status="planned",
    created_by=alice.id,
)
db.add_all([cycle1, cycle2])
db.commit()
db.refresh(cycle1)
db.refresh(cycle2)

# ── Assignments for cycle 1 ────────────────────────────────────────────────
assignments_c1 = [
    TestAssignment(test_cycle_id=cycle1.id, control_id=controls[0].id,  tester_id=bob.id,   reviewer_id=dave.id, status="complete",      tester_notes="All user access reviews completed and documented.", reviewer_comments="Evidence is sufficient. Approved."),
    TestAssignment(test_cycle_id=cycle1.id, control_id=controls[1].id,  tester_id=bob.id,   reviewer_id=dave.id, status="needs_review",  tester_notes="Password policy config screenshots captured from AD."),
    TestAssignment(test_cycle_id=cycle1.id, control_id=controls[2].id,  tester_id=carol.id, reviewer_id=eve.id,  status="in_progress",   tester_notes="MFA enrollment report pulled; working on PAM log review."),
    TestAssignment(test_cycle_id=cycle1.id, control_id=controls[3].id,  tester_id=carol.id, reviewer_id=eve.id,  status="complete",      tester_notes="Sampled 25 change tickets. All had proper approvals.", reviewer_comments="Good sample. Complete."),
    TestAssignment(test_cycle_id=cycle1.id, control_id=controls[4].id,  tester_id=bob.id,   reviewer_id=dave.id, status="in_progress",   tester_notes="Vulnerability scan reports for Jan–Mar pulled."),
    TestAssignment(test_cycle_id=cycle1.id, control_id=controls[5].id,  tester_id=carol.id, reviewer_id=eve.id,  status="not_started"),
    TestAssignment(test_cycle_id=cycle1.id, control_id=controls[6].id,  tester_id=bob.id,   reviewer_id=dave.id, status="not_started"),
    TestAssignment(test_cycle_id=cycle1.id, control_id=controls[8].id,  tester_id=carol.id, reviewer_id=eve.id,  status="needs_review",  tester_notes="Firewall rule export and change log reviewed."),
    TestAssignment(test_cycle_id=cycle1.id, control_id=controls[10].id, tester_id=bob.id,   reviewer_id=dave.id, status="complete",      tester_notes="SoD matrix reviewed; no conflicts identified.", reviewer_comments="Confirmed. No exceptions."),
]
db.add_all(assignments_c1)

# ── Assignments for cycle 2 ────────────────────────────────────────────────
assignments_c2 = [
    TestAssignment(test_cycle_id=cycle2.id, control_id=controls[0].id,  tester_id=carol.id, reviewer_id=eve.id,  status="not_started"),
    TestAssignment(test_cycle_id=cycle2.id, control_id=controls[1].id,  tester_id=bob.id,   reviewer_id=dave.id, status="not_started"),
    TestAssignment(test_cycle_id=cycle2.id, control_id=controls[10].id, tester_id=carol.id, reviewer_id=eve.id,  status="not_started"),
    TestAssignment(test_cycle_id=cycle2.id, control_id=controls[11].id, tester_id=bob.id,   reviewer_id=dave.id, status="not_started"),
]
db.add_all(assignments_c2)
db.commit()

print("✅ Sample data loaded successfully.")
print(f"   Users:       {len(users)}")
print(f"   Controls:    {len(controls)}")
print(f"   Test Cycles: 2")
print(f"   Assignments: {len(assignments_c1) + len(assignments_c2)}")
print()
print("Demo users (use any as the login username):")
for u in users:
    print(f"   {u.username:10s} — {u.display_name:20s} [{u.role}]")
