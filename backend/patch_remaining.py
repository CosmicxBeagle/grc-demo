import sqlite3

DB = "grc_demo.db"

EXTRAS = {
    # PCI 12.10 sub-requirements
    "12.10.3":  "Specific personnel designated to be available on 24/7 basis to respond to suspected or confirmed incidents",
    "12.10.4":  "Personnel responsible for responding to suspected and confirmed security incidents are appropriately trained",
    "12.10.4.1":"Effectiveness of incident response training is reviewed at least once every 12 months",
    "12.10.5":  "Alerts from security monitoring systems are included in the incident response plan",
    "12.10.6":  "Security incident response plan is modified and evolved according to lessons learned",
    "12.10.7":  "Incident response procedures for detection of and responding to unexpected PAN storage are implemented",
    # PCI A1 sub-requirements
    "A1.1.1":   "Multi-tenant service provider confirms they implement logical separation controls to prevent customers accessing each other's environments",
    "A1.1.2":   "Controls exist to prevent and detect unauthorized access between customer environments",
    "A1.1.3":   "Controls exist to prevent and detect unauthorized access from the Internet",
    "A1.1.4":   "Failure of logical separation controls are detected and reported in a timely manner",
    "A1.2.1":   "Audit log capability is enabled for each customer's environment consistent with PCI DSS Requirement 10",
    "A1.2.2":   "Processes or mechanisms implemented so customers can conduct penetration tests per Requirement 11.4",
    "A1.2.3":   "Processes or mechanisms implemented to report and address suspected or confirmed security incidents",
    # PCI A2 sub-requirements
    "A2.1.3":   "All certificates and related keys for early TLS uses are inventoried and tracked",
    # PCI A3 sub-requirements
    "A3.1.1":   "A targeted risk analysis is performed for any PCI DSS requirement that provides flexibility in how it is implemented",
    "A3.1.2":   "Effectiveness of PCI DSS controls evaluated and reports produced at least once every 12 months",
    "A3.1.3":   "Failures of automated security controls are detected, alerted and addressed promptly",
    "A3.2.4":   "Hardware and software technologies reviewed at least once every 12 months to confirm they continue to meet PCI DSS requirements",
    "A3.2.5.2": "Post-implementation testing performed to verify security controls remain effective after changes",
    # Bad data in source — treat as parent PCI
    "ld":       "PCI DSS — Implement strong access control measures",
}

conn = sqlite3.connect(DB)
c = conn.cursor()
c.execute("SELECT id, framework_ref FROM control_mappings WHERE framework_description IS NULL OR framework_description = ''")
rows = c.fetchall()
updated = 0
for mid, ref in rows:
    desc = EXTRAS.get(ref)
    if desc:
        c.execute("UPDATE control_mappings SET framework_description = ? WHERE id = ?", (desc, mid))
        updated += 1
conn.commit()
c.execute("SELECT COUNT(*) FROM control_mappings WHERE framework_description IS NULL OR framework_description = ''")
remaining = c.fetchone()[0]
conn.close()
print(f"Updated {updated}. Still missing: {remaining}")
