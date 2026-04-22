"""
Import full SCF control library from Excel into grc_demo.db.
Clears existing controls (and cascades to mappings) then reinserts all rows.

Run from backend directory:
    venv/Scripts/python.exe import_controls.py
"""
import sqlite3
import openpyxl

XLSX = "scf_import.xlsx"
DB   = "grc_demo.db"

# Column indices (0-based) in "3 Frameworks Combined" sheet
COL_DOMAIN  = 0   # A  SCF Domain
COL_TITLE   = 1   # B  SCF Control
COL_SCF_ID  = 3   # D  SCF #
COL_DESC    = 4   # E  SCF Control Description
COL_QUEST   = 7   # H  SCF Control Question
COL_WEIGHT  = 8   # I  Relative Control Weighting
COL_CIS     = 24  # Y  CIS CSC v8.1
COL_NIST    = 25  # Z  NIST CSF v2.0
COL_PCI     = 26  # AA PCI DSS v4.0.1
COL_SOX     = 27  # AB US SOX

FRAMEWORK_META = [
    (COL_CIS,  "CIS",  "v8.1"),
    (COL_NIST, "NIST", "v2.0"),
    (COL_PCI,  "PCI",  "v4.0.1"),
    (COL_SOX,  "SOX",  ""),
]


def cell(row, idx):
    """Safe cell value — returns None if index out of range or cell empty."""
    try:
        v = row[idx]
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None
    except IndexError:
        return None


def main():
    print(f"Loading {XLSX} ...")
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    ws = wb["3 Frameworks Combined"]

    rows = list(ws.iter_rows(min_row=2, values_only=True))
    wb.close()

    conn = sqlite3.connect(DB)
    c = conn.cursor()

    # ── Wipe existing controls (cascade deletes mappings via FK) ──────────────
    # SQLite doesn't enforce FK cascades by default — delete mappings first
    c.execute("DELETE FROM control_mappings")
    c.execute("DELETE FROM controls")
    conn.commit()
    print("Cleared existing controls and mappings.")

    controls_inserted = 0
    mappings_inserted = 0
    skipped = 0

    for row in rows:
        scf_id = cell(row, COL_SCF_ID)
        title  = cell(row, COL_TITLE)

        # Skip rows without an SCF control ID or title
        if not scf_id or not title:
            skipped += 1
            continue

        domain  = cell(row, COL_DOMAIN)
        desc    = cell(row, COL_DESC)
        quest   = cell(row, COL_QUEST)
        raw_wt  = cell(row, COL_WEIGHT)
        weight  = int(raw_wt) if raw_wt and str(raw_wt).isdigit() else None

        c.execute("""
            INSERT INTO controls (control_id, title, description, scf_question, scf_domain, scf_weight, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
        """, (scf_id, title, desc, quest, domain, weight))

        new_id = c.lastrowid
        controls_inserted += 1

        # ── Framework mappings ─────────────────────────────────────────────────
        for col_idx, framework, version in FRAMEWORK_META:
            raw = cell(row, col_idx)
            if not raw:
                continue
            # Values are newline-separated references (e.g. "1\n1.1\n2.1")
            refs = [r.strip() for r in raw.split("\n") if r.strip()]
            for ref in refs:
                c.execute("""
                    INSERT INTO control_mappings (control_id, framework, framework_ref, framework_version)
                    VALUES (?, ?, ?, ?)
                """, (new_id, framework, ref, version))
                mappings_inserted += 1

    conn.commit()
    conn.close()

    print(f"Done.")
    print(f"  Controls inserted : {controls_inserted}")
    print(f"  Mappings inserted : {mappings_inserted}")
    print(f"  Rows skipped      : {skipped}")


if __name__ == "__main__":
    main()
