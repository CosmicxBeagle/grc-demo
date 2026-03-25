"""
Import controls and their framework mappings from an Excel or CSV file.

Usage:
  python import_controls.py path/to/file.xlsx [--commit]

By default runs in dry-run mode and prints a preview. Use --commit to write to DB.

Expect either:
- Two-sheet Excel: sheet 'controls' and sheet 'mappings'
- Single-sheet Excel/CSV: columns: control_id,title,description,control_type,frequency,owner,status
  and optional mapping columns prefixed with mapping_ (mapping_1_framework, mapping_1_ref, mapping_1_description, ...)

This script uses the project's SQLAlchemy models. Run from the `backend/` folder or ensure the package imports work.
"""
import sys
import argparse
from pathlib import Path
import pandas as pd
import re
from typing import List, Dict, Any

# Ensure package imports work when running from backend/
from app.db.database import SessionLocal, engine, Base
from app.models import models  # ensure models are registered
from app.models.models import Control, ControlMapping

VALID_FREQUENCIES = {"annual", "quarterly", "monthly", "continuous", ""}


def read_file(path: Path) -> Dict[str, pd.DataFrame]:
    if path.suffix.lower() in {".xls", ".xlsx"}:
        xls = pd.read_excel(path, sheet_name=None)
        return xls
    else:
        # treat as CSV single-sheet
        df = pd.read_csv(path)
        return {"controls": df}


def normalize_col(s: str) -> str:
    # lowercase, replace any non-alphanumeric with underscore, collapse underscores
    t = s.strip().lower()
    t = re.sub(r"[^a-z0-9]+", "_", t)
    t = re.sub(r"_+", "_", t)
    return t.strip("_")


def build_controls_from_df(df: pd.DataFrame) -> List[Dict[str, Any]]:
    # Normalize column names
    df = df.rename(columns={c: normalize_col(c) for c in df.columns})
    controls = []
    for _, row in df.iterrows():
        ctrl = {
            "control_id": str(row.get("control_id", "")).strip(),
            "title": str(row.get("title", "")).strip(),
            "description": row.get("description") if pd.notna(row.get("description")) else None,
            "control_type": row.get("control_type") if pd.notna(row.get("control_type")) else None,
            "frequency": str(row.get("frequency", "")).strip().lower(),
            "owner": row.get("owner") if pd.notna(row.get("owner")) else None,
            "status": row.get("status") if pd.notna(row.get("status")) else "active",
            "mappings": [],
        }
        # collect mapping_* columns (backwards-compatible)
        mapping_cols = [c for c in df.columns if c.startswith("mapping_")]
        if mapping_cols:
            # Expect mapping_1_framework, mapping_1_ref, mapping_1_description, mapping_2_...
            mappings_by_index = {}
            for col in mapping_cols:
                parts = col.split("_")  # mapping, 1, framework
                if len(parts) < 3:
                    continue
                idx = parts[1]
                key = "_".join(parts[2:])
                mappings_by_index.setdefault(idx, {})[key] = row.get(col)
            for idx in sorted(mappings_by_index.keys(), key=lambda x: int(x) if x.isdigit() else x):
                m = mappings_by_index[idx]
                if pd.isna(m.get("framework")) and pd.isna(m.get("framework_ref")):
                    continue
                ctrl["mappings"].append({
                    "framework": str(m.get("framework")).strip() if pd.notna(m.get("framework")) else None,
                    "framework_ref": str(m.get("framework_ref")).strip() if pd.notna(m.get("framework_ref")) else None,
                    "framework_description": m.get("framework_description") if pd.notna(m.get("framework_description")) else None,
                })
        controls.append(ctrl)
    return controls


def build_controls_from_scf_df(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Special parser for the provided SCF CSV/Excel layout. It will try to
    auto-detect columns for control id, title, description and framework
    mappings (PCI/CIS/NIST/SOX). Returns the same control structure as
    build_controls_from_df.
    """
    # normalize headers
    orig_cols = list(df.columns)
    lc_cols = [normalize_col(c) for c in orig_cols]
    col_map = dict(zip(lc_cols, orig_cols))

    # heuristics for key columns
    def find_col(candidates):
        for cand in candidates:
            for lc in lc_cols:
                if cand in lc:
                    return col_map[lc]
        return None

    # Prefer positional columns for the provided SCF CSV:
    # Column D (index 3) -> common control (title)
    # Column Y (index 24) -> CIS
    # Column Z (index 25) -> NIST
    # Column AA (index 26) -> PCI
    title_col = None
    description_col = None
    control_id_col = None
    cis_col = None
    nist_col = None
    pci_col = None

    # positional lookup if DataFrame has enough columns
    if len(orig_cols) >= 27:
        try:
            title_col = orig_cols[3]
            cis_col = orig_cols[24]
            nist_col = orig_cols[25]
            pci_col = orig_cols[26]
        except Exception:
            pass

    # fallback to header-name heuristics
    if not title_col:
        title_col = find_col(["scf control", "scf_control", "control", "scf_control_name", "common control"])
    if not description_col:
        description_col = find_col(["control description", "control_description", "secure controls framework"])
    if not control_id_col:
        control_id_col = find_col(["scf #", "scf_#", "scf_no", "scf_", "scf#", "scf", "id", "ast-"])

    # also try to detect CIS/NIST/PCI columns by header text
    if not cis_col:
        cis_col = find_col(["cis", "csc"])
    if not nist_col:
        nist_col = find_col(["nist"])
    if not pci_col:
        pci_col = find_col(["pci"])

    # If no control_id_col, try to locate common pattern like AST-02 or codes in any cell
    if not control_id_col:
        for col in orig_cols[:6]:
            # look for a short code pattern in the column values
            if df[col].astype(str).str.match(r"[A-Z]{2,}-?\d+").any():
                control_id_col = col
                break

    # detect framework columns
    framework_cols = []
    for lc, orig in zip(lc_cols, orig_cols):
        if any(k in lc for k in ["cisl", "cis", "nist", "pci", "sox", "csc"]):
            framework_cols.append((orig, lc))

    controls = []
    for _, row in df.iterrows():
        title = str(row[title_col]).strip() if title_col and pd.notna(row.get(title_col)) else None
        desc = row[description_col] if description_col and pd.notna(row.get(description_col)) else None
        cid = str(row[control_id_col]).strip() if control_id_col and pd.notna(row.get(control_id_col)) else None
        # fallback: if no cid, build one from domain+title
        if not cid:
            domain = row.get(col_map.get(normalize_col(orig_cols[0]), orig_cols[0])) if orig_cols else None
            cid = (str(domain).strip() + " - " + (title or "")).strip() if domain else (title or "").strip()

        ctrl = {
            "control_id": cid,
            "title": title or cid,
            "description": desc,
            "control_type": None,
            "frequency": None,
            "owner": None,
            "status": "active",
            "mappings": [],
        }

        # explicit columns (Y/Z/AA) take priority
        if cis_col:
            val = row.get(cis_col)
            if pd.notna(val) and str(val).strip():
                items = [i.strip() for i in re.split(r"[\n,;]+", str(val)) if i.strip()]
                for item in items:
                    ctrl["mappings"].append({"framework": "CIS", "framework_ref": item, "framework_description": None})
        if nist_col:
            val = row.get(nist_col)
            if pd.notna(val) and str(val).strip():
                items = [i.strip() for i in re.split(r"[\n,;]+", str(val)) if i.strip()]
                for item in items:
                    ctrl["mappings"].append({"framework": "NIST", "framework_ref": item, "framework_description": None})
        if pci_col:
            val = row.get(pci_col)
            if pd.notna(val) and str(val).strip():
                items = [i.strip() for i in re.split(r"[\n,;]+", str(val)) if i.strip()]
                for item in items:
                    ctrl["mappings"].append({"framework": "PCI", "framework_ref": item, "framework_description": None})

        # fallback: any other detected framework_cols
        for orig, lc in framework_cols:
            if orig in {cis_col, nist_col, pci_col}:
                continue
            val = row.get(orig)
            if pd.isna(val) or (isinstance(val, str) and val.strip() == ""):
                continue
            if "pci" in lc:
                fw = "PCI"
            elif "nist" in lc:
                fw = "NIST"
            elif "cis" in lc or "csc" in lc:
                fw = "CIS"
            elif "sox" in lc:
                fw = "SOX"
            else:
                fw = orig.strip()
            items = [i.strip() for i in re.split(r"[\n,;]+", str(val)) if i.strip()]
            for item in items:
                ctrl["mappings"].append({"framework": fw, "framework_ref": item, "framework_description": None})

        controls.append(ctrl)
    return controls


def build_mappings_from_df(df: pd.DataFrame) -> List[Dict[str, Any]]:
    # Expect columns: control_id, framework, framework_ref, framework_description
    df = df.rename(columns={c: normalize_col(c) for c in df.columns})
    mappings = []
    for _, row in df.iterrows():
        if pd.isna(row.get("control_id")):
            continue
        mappings.append({
            "control_id": str(row.get("control_id")).strip(),
            "framework": str(row.get("framework")).strip(),
            "framework_ref": str(row.get("framework_ref")) if pd.notna(row.get("framework_ref")) else None,
            "framework_description": row.get("framework_description") if pd.notna(row.get("framework_description")) else None,
        })
    return mappings


def apply_import(controls: List[Dict[str, Any]], mappings: List[Dict[str, Any]], commit: bool = False):
    db = SessionLocal()
    created = 0
    updated = 0
    try:
        # Upsert controls by control_id
        ctrl_map = {c["control_id"]: c for c in controls if c["control_id"]}
        for cid, data in ctrl_map.items():
            existing = db.query(Control).filter(Control.control_id == cid).first()
            if existing:
                existing.title = data["title"]
                existing.description = data["description"]
                existing.control_type = data["control_type"]
                existing.frequency = data["frequency"]
                existing.owner = data["owner"]
                existing.status = data["status"]
                updated += 1
            else:
                new = Control(
                    control_id=data["control_id"],
                    title=data["title"],
                    description=data["description"],
                    control_type=data["control_type"],
                    frequency=data["frequency"],
                    owner=data["owner"],
                    status=data["status"],
                )
                db.add(new)
                db.flush()  # assign id
                existing = new
                created += 1
            # handle mappings embedded in controls
            # remove existing mappings and recreate
            if data.get("mappings"):
                # clear and re-add
                db.query(ControlMapping).filter(ControlMapping.control_id == existing.id).delete()
                for m in data["mappings"]:
                    if not m.get("framework"):
                        continue
                    cm = ControlMapping(
                        control_id=existing.id,
                        framework=m.get("framework"),
                        framework_ref=m.get("framework_ref") or "",
                        framework_description=m.get("framework_description"),
                    )
                    db.add(cm)
        # process separate mappings sheet
        for m in mappings:
            # find control by control_id
            ctrl = db.query(Control).filter(Control.control_id == m["control_id"]).first()
            if not ctrl:
                print(f"Warning: mapping for unknown control_id {m['control_id']}")
                continue
            # avoid duplicates: check if mapping exists
            exists = db.query(ControlMapping).filter(
                ControlMapping.control_id == ctrl.id,
                ControlMapping.framework == m["framework"],
                ControlMapping.framework_ref == (m.get("framework_ref") or ""),
            ).first()
            if not exists:
                cm = ControlMapping(
                    control_id=ctrl.id,
                    framework=m.get("framework"),
                    framework_ref=m.get("framework_ref") or "",
                    framework_description=m.get("framework_description"),
                )
                db.add(cm)
                created += 1
        if commit:
            db.commit()
        else:
            db.rollback()
    finally:
        db.close()
    return created, updated


def main(argv):
    p = argparse.ArgumentParser()
    p.add_argument("file", help="Path to Excel (.xlsx/.xls) or CSV file")
    p.add_argument("--commit", action="store_true", help="Write changes to DB")
    args = p.parse_args(argv)

    path = Path(args.file)
    if not path.exists():
        print("File not found:", path)
        return 2

    sheets = read_file(path)
    controls = []
    mappings = []

    if "controls" in (k.lower() for k in sheets.keys()):
        # case-insensitive key lookup
        key = next(k for k in sheets.keys() if k.lower() == "controls")
        controls = build_controls_from_df(sheets[key])
    else:
        # if only a single sheet, treat as controls
        if len(sheets) == 1:
            key = list(sheets.keys())[0]
            controls = build_controls_from_df(sheets[key])
        else:
            # look for mappings sheet
            if "mappings" in (k.lower() for k in sheets.keys()):
                ckey = next(k for k in sheets.keys() if k.lower() == "controls") if any(k.lower()=="controls" for k in sheets.keys()) else None
                if ckey:
                    controls = build_controls_from_df(sheets[ckey])
                mappings_key = next(k for k in sheets.keys() if k.lower() == "mappings")
                mappings = build_mappings_from_df(sheets[mappings_key])
            else:
                # fallback: pick first sheet as controls
                key = list(sheets.keys())[0]
                controls = build_controls_from_df(sheets[key])

    print(f"Parsed {len(controls)} controls and {len(mappings)} mappings from {path.name}")
    # show preview
    for c in controls[:10]:
        print(c["control_id"], "-", c["title"], "(mappings:", len(c.get("mappings",[])), ")")

    if not args.commit:
        print("Dry-run: no changes written. Rerun with --commit to apply to DB.")

    created, updated = apply_import(controls, mappings, commit=args.commit)
    print(f"Created mappings/controls: {created}, Updated controls: {updated}")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
