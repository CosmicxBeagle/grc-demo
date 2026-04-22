"""
Backfill framework_description in control_mappings.
Uses hierarchical fallback: if exact ref not found, tries progressively
shorter parent refs (e.g. 9.5.1.1 -> 9.5.1 -> 9.5 -> 9).

Run from backend directory:
    venv/Scripts/python.exe backfill_mapping_descriptions.py
"""
import sqlite3
import openpyxl

XLSX = "scf_import.xlsx"
DB   = "grc_demo.db"

SHEET_CFG = [
    ("CIS",          "CIS",  14, 0, 1),
    ("NIST CSF 2.0", "NIST", 14, 0, 1),
    ("PCI",          "PCI",  14, 0, 1),
]

# Standard CIS v8.1 control group titles (single-digit refs like "1", "2" …)
CIS_GROUPS = {
    "1":  "Inventory and Control of Enterprise Assets",
    "2":  "Inventory and Control of Software Assets",
    "3":  "Data Protection",
    "4":  "Secure Configuration of Enterprise Assets and Software",
    "5":  "Account Management",
    "6":  "Access Control Management",
    "7":  "Continuous Vulnerability Management",
    "8":  "Audit Log Management",
    "9":  "Email and Web Browser Protections",
    "10": "Malware Defenses",
    "11": "Data Recovery",
    "12": "Network Infrastructure Management",
    "13": "Network Monitoring and Defense",
    "14": "Security Awareness and Skills Training",
    "15": "Service Provider Management",
    "16": "Application Software Security",
    "17": "Incident Response Management",
    "18": "Penetration Testing",
}

# Standard NIST CSF 2.0 function / category group titles
NIST_GROUPS = {
    "GV":      "GOVERN — Organizational context, risk management strategy, roles and responsibilities",
    "GV.OC":   "Organizational Context — mission, stakeholder expectations, legal requirements understood",
    "GV.RM":   "Risk Management Strategy — priorities, constraints, appetite and tolerances established",
    "GV.RR":   "Roles, Responsibilities, and Authorities — established and communicated",
    "GV.PO":   "Policy — organizational cybersecurity policy established and communicated",
    "GV.OV":   "Oversight — results of organization-wide cybersecurity risk management activities reviewed",
    "GV.SC":   "Cybersecurity Supply Chain Risk Management — processes identified, established, managed",
    "ID":      "IDENTIFY — Current cybersecurity risks understood",
    "ID.AM":   "Asset Management — assets inventoried and prioritized based on objectives and risk strategy",
    "ID.RA":   "Risk Assessment — cybersecurity risk identified, analyzed, prioritized, and communicated",
    "ID.IM":   "Improvement — improvements identified from evaluations, incidents and lessons learned",
    "PR":      "PROTECT — Safeguards to manage cybersecurity risks",
    "PR.AA":   "Identity Management, Authentication and Access Control — access to assets is limited",
    "PR.AT":   "Awareness and Training — personnel are provided with training on cybersecurity risks",
    "PR.DS":   "Data Security — data-at-rest and in-transit are managed to protect confidentiality",
    "PR.PS":   "Platform Security — hardware, software and services managed to reduce vulnerabilities",
    "PR.IR":   "Technology Infrastructure Resilience — security architectures manage and bound risk",
    "DE":      "DETECT — Possible cybersecurity attacks and compromises identified",
    "DE.CM":   "Continuous Monitoring — assets monitored to find anomalies, indicators of compromise",
    "DE.AE":   "Adverse Event Analysis — anomalies analyzed to characterize cybersecurity events",
    "RS":      "RESPOND — Actions taken regarding detected cybersecurity incidents",
    "RS.MA":   "Incident Management — cybersecurity incidents are contained and eradicated",
    "RS.AN":   "Incident Analysis — investigations conducted to ensure effective response and recovery",
    "RS.CO":   "Incident Response Reporting and Communication — coordinated with internal/external stakeholders",
    "RS.MI":   "Incident Mitigation — activities performed to prevent expansion and eradicate incidents",
    "RC":      "RECOVER — Assets and operations restored after cybersecurity incident",
    "RC.RP":   "Incident Recovery Plan Execution — restoration activities performed and communicated",
    "RC.CO":   "Incident Recovery Communication — restoration activities communicated to stakeholders",
}


def build_lookup(wb) -> dict[str, dict[str, str]]:
    lookup: dict[str, dict[str, str]] = {}
    for sheet_name, fw_key, start_row, ref_col, desc_col in SHEET_CFG:
        ws = wb[sheet_name]
        fw_map: dict[str, str] = {}
        for row in ws.iter_rows(min_row=start_row, values_only=True):
            ref  = row[ref_col]  if len(row) > ref_col  else None
            desc = row[desc_col] if len(row) > desc_col else None
            if ref and desc:
                fw_map[str(ref).strip()] = str(desc).strip()
        # Inject group-level headings
        if fw_key == "CIS":
            fw_map.update(CIS_GROUPS)
        if fw_key == "NIST":
            fw_map.update(NIST_GROUPS)
        lookup[fw_key] = fw_map
        print(f"  {fw_key}: {len(fw_map)} descriptions (incl. group headings)")
    return lookup


def resolve(lookup_fw: dict[str, str], ref: str) -> str | None:
    """Try exact match then progressively shorter parent refs."""
    if ref in lookup_fw:
        return lookup_fw[ref]
    # NIST style: GV.SC-04 -> GV.SC -> GV
    if "-" in ref:
        parent = ref.rsplit("-", 1)[0]
        if parent in lookup_fw:
            return lookup_fw[parent]
        # also try the function group (before the dot)
        func = parent.split(".")[0]
        if func in lookup_fw:
            return lookup_fw[func]
    # Dotted style: 9.5.1.1 -> 9.5.1 -> 9.5 -> 9
    parts = ref.split(".")
    for n in range(len(parts) - 1, 0, -1):
        parent = ".".join(parts[:n])
        if parent in lookup_fw:
            return lookup_fw[parent]
    return None


def main():
    print(f"Loading {XLSX} ...")
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    lookup = build_lookup(wb)
    wb.close()

    conn = sqlite3.connect(DB)
    c = conn.cursor()
    c.execute("SELECT id, framework, framework_ref FROM control_mappings")
    rows = c.fetchall()

    updated = missing = 0
    for mapping_id, framework, ref in rows:
        desc = resolve(lookup.get(framework, {}), ref)
        if desc:
            c.execute(
                "UPDATE control_mappings SET framework_description = ? WHERE id = ?",
                (desc, mapping_id)
            )
            updated += 1
        else:
            missing += 1

    conn.commit()
    conn.close()
    print(f"Done.  Updated: {updated}  Still missing: {missing}")


if __name__ == "__main__":
    main()
