"""
Load controls from the unified control mapping CSV into the database.
Replaces all existing controls (and their mappings/assignments).
Users and test cycles are preserved, but cycle assignments are cleared.

Usage:
  cd backend
  python -m data.load_controls_csv
"""
import sys, os, csv
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal, engine
from app.models.models import Base, Control, ControlMapping, TestAssignment

CSV_PATH = r"C:\Users\johnf\OneDrive\Desktop\SCF- NIST-CIS- PCI -Threat Model Combined v1.1.csv"

# Column indices
COL_DOMAIN      = 0
COL_TITLE       = 1
COL_SCF_NUM     = 2
COL_DESCRIPTION = 3
COL_CIS         = 18
COL_NIST        = 19
COL_PCI         = 20

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── Clear controls-related data (preserve users & test cycles) ──────────────
print("Clearing existing assignments, mappings, and controls…")
db.query(TestAssignment).delete()
db.query(ControlMapping).delete()
db.query(Control).delete()
db.commit()

# ── Load CSV ────────────────────────────────────────────────────────────────
controls_added = 0
mappings_added = 0
skipped = 0

with open(CSV_PATH, encoding="utf-8-sig", errors="replace", newline="") as f:
    reader = csv.reader(f)
    next(reader)  # skip header row

    for row in reader:
        scf_num = row[COL_SCF_NUM].strip() if COL_SCF_NUM < len(row) else ""
        if not scf_num:
            skipped += 1
            continue

        title       = row[COL_TITLE].strip()       if COL_TITLE < len(row) else ""
        description = row[COL_DESCRIPTION].strip() if COL_DESCRIPTION < len(row) else None
        owner       = row[COL_DOMAIN].strip()      if COL_DOMAIN < len(row) else None

        ctrl = Control(
            control_id=scf_num,
            title=title or scf_num,
            description=description or None,
            owner=owner or None,
            status="active",
        )
        db.add(ctrl)
        db.flush()

        # Build mappings from multi-value cells (newline-separated refs)
        framework_cols = {
            "CIS":  (COL_CIS,  "v8.1"),
            "NIST": (COL_NIST, "v2.0"),
            "PCI":  (COL_PCI,  "v4.0.1"),
        }
        for framework, (col_idx, version) in framework_cols.items():
            cell = row[col_idx].strip() if col_idx < len(row) else ""
            refs = [r.strip() for r in cell.splitlines() if r.strip()]
            for ref in refs:
                db.add(ControlMapping(
                    control_id=ctrl.id,
                    framework=framework,
                    framework_version=version,
                    framework_ref=ref,
                ))
                mappings_added += 1

        controls_added += 1

db.commit()

print(f"\nDone.")
print(f"   Controls loaded : {controls_added}")
print(f"   Mappings created: {mappings_added}")
print(f"   Rows skipped    : {skipped}")
print()
print("Note: test cycle assignments were cleared.")
print("Re-run data/sample_data.py if you want demo assignments, or create new ones via the UI.")
