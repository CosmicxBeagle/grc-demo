"""
Seed script: populates Assets, Threats, Risks, and RiskControl links for the GRC demo.
Run from the backend directory:
    python data/seed_risks.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal, Base, engine
from app.models.models import Asset, Threat, Risk, RiskControl, Control

# Ensure tables exist
from app.models import models as _models_module  # noqa
Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    # ── Guard against double-seeding ─────────────────────────────────────────
    if db.query(Asset).count() > 0:
        print("Assets already seeded - skipping.")
        db.close()
        sys.exit(0)

    # ── Assets ────────────────────────────────────────────────────────────────
    assets_data = [
        dict(name="Customer Database", description="Primary PostgreSQL database holding all customer PII and transaction history", asset_type="database", criticality="critical", owner="Database Engineering", status="active"),
        dict(name="Payment Processing App", description="PCI-scoped application handling card transactions and payment gateway integration", asset_type="application", criticality="critical", owner="Payments Team", status="active"),
        dict(name="Active Directory", description="Corporate identity provider managing user authentication and group policies", asset_type="infrastructure", criticality="high", owner="IT Operations", status="active"),
        dict(name="Corporate Network", description="Internal LAN and WAN infrastructure including firewalls, switches, and VPN endpoints", asset_type="network", criticality="high", owner="Network Engineering", status="active"),
        dict(name="ERP System", description="Enterprise resource planning system managing finance, HR, and supply chain data", asset_type="application", criticality="high", owner="Enterprise Systems", status="active"),
        dict(name="Customer PII Data Store", description="Data lake containing personally identifiable information for marketing and analytics", asset_type="data", criticality="critical", owner="Data Governance", status="active"),
    ]
    assets = []
    for a in assets_data:
        obj = Asset(**a)
        db.add(obj)
        assets.append(obj)
    db.flush()
    print(f"Created {len(assets)} assets")

    # ── Threats ───────────────────────────────────────────────────────────────
    threats_data = [
        dict(name="Ransomware Attack", description="Malicious actors encrypt critical systems and demand ransom, disrupting business operations", threat_category="cyber", source="external"),
        dict(name="Unauthorized Privileged Access", description="Threat actors or insiders exploit elevated credentials to access sensitive systems", threat_category="access", source="internal"),
        dict(name="SQL Injection", description="Attackers inject malicious SQL via application inputs to extract or corrupt database records", threat_category="cyber", source="external"),
        dict(name="Insider Data Theft", description="Employees or contractors exfiltrate sensitive customer or business data for personal gain", threat_category="insider", source="internal"),
        dict(name="Unpatched Vulnerabilities", description="Exploitation of known CVEs in unpatched software leading to system compromise", threat_category="cyber", source="external"),
        dict(name="Phishing / Social Engineering", description="Employees deceived into revealing credentials or executing malicious payloads via email or phone", threat_category="cyber", source="external"),
    ]
    threats = []
    for t in threats_data:
        obj = Threat(**t)
        db.add(obj)
        threats.append(obj)
    db.flush()
    print(f"Created {len(threats)} threats")

    # Helper maps
    asset_map = {a.name: a for a in assets}
    threat_map = {t.name: t for t in threats}

    # ── Risks ─────────────────────────────────────────────────────────────────
    risks_data = [
        dict(name="Customer PII exposed via ransomware", description="Ransomware infection encrypts or exfiltrates the customer database, causing regulatory breach and business disruption", asset="Customer Database", threat="Ransomware Attack", likelihood=3, impact=5, treatment="mitigate", status="open", owner="CISO"),
        dict(name="Payment card data stolen through SQL injection", description="Web application input vulnerabilities allow attackers to extract card numbers and CVVs from the payments database", asset="Payment Processing App", threat="SQL Injection", likelihood=2, impact=5, treatment="mitigate", status="mitigated", owner="Payments Team"),
        dict(name="Admin account compromise via phishing", description="IT admin credentials phished allowing full domain compromise through Active Directory", asset="Active Directory", threat="Phishing / Social Engineering", likelihood=4, impact=4, treatment="mitigate", status="open", owner="IT Operations"),
        dict(name="Lateral movement across corporate network", description="Attacker exploits unpatched network device firmware to pivot from DMZ into internal network segments", asset="Corporate Network", threat="Unpatched Vulnerabilities", likelihood=3, impact=4, treatment="mitigate", status="open", owner="Network Engineering"),
        dict(name="ERP financial data exfiltrated by insider", description="Finance employee exports large volumes of GL data and transmits externally before detection", asset="ERP System", threat="Insider Data Theft", likelihood=2, impact=4, treatment="mitigate", status="accepted", owner="Enterprise Systems"),
        dict(name="Customer PII exfiltrated by privileged user", description="DBA abuses production access rights to copy customer records to personal cloud storage", asset="Customer PII Data Store", threat="Unauthorized Privileged Access", likelihood=3, impact=5, treatment="mitigate", status="open", owner="Data Governance"),
        dict(name="Ransomware encrypts ERP backups", description="Ransomware variant targets backup servers connected to ERP, destroying recovery capability", asset="ERP System", threat="Ransomware Attack", likelihood=2, impact=5, treatment="transfer", status="open", owner="Enterprise Systems"),
        dict(name="Network device compromise via CVE exploitation", description="Known vulnerability in unpatched firewall exploited to redirect traffic and intercept credentials", asset="Corporate Network", threat="Unpatched Vulnerabilities", likelihood=4, impact=3, treatment="mitigate", status="open", owner="Network Engineering"),
        dict(name="Insider steals customer PII before offboarding", description="Departing employee copies customer contact list to personal devices during notice period", asset="Customer PII Data Store", threat="Insider Data Theft", likelihood=3, impact=4, treatment="mitigate", status="open", owner="HR / Security"),
        dict(name="AD domain admin account brute-forced", description="Attacker achieves domain admin via password spray against accounts without MFA", asset="Active Directory", threat="Unauthorized Privileged Access", likelihood=2, impact=5, treatment="mitigate", status="mitigated", owner="IT Operations"),
    ]

    risks = []
    for r in risks_data:
        asset_obj = asset_map.get(r.pop("asset"))
        threat_obj = threat_map.get(r.pop("threat"))
        obj = Risk(
            asset_id=asset_obj.id if asset_obj else None,
            threat_id=threat_obj.id if threat_obj else None,
            **r
        )
        db.add(obj)
        risks.append(obj)
    db.flush()
    print(f"Created {len(risks)} risks")

    # ── Link Controls to Risks ─────────────────────────────────────────────────
    # Fetch existing controls
    existing_controls = db.query(Control).order_by(Control.id).all()
    ctrl_map = {c.control_id: c for c in existing_controls}

    # Map risk names to control IDs to link
    control_links = [
        # Ransomware risk -> Asset Inventories, Audit Trails
        ("Customer PII exposed via ransomware", ["AST-02", "MON-03.2"]),
        # SQL injection -> compensating countermeasures
        ("Payment card data stolen through SQL injection", ["RSK-06.2"]),
        # Admin account -> Privileged Account Inventories, Periodic Review
        ("Admin account compromise via phishing", ["IAC-16.1", "IAC-17"]),
        # Lateral movement -> Host Containment
        ("Lateral movement across corporate network", ["NET-08.3"]),
        # Insider data -> Audit Trails, Privileged Inventories
        ("Customer PII exfiltrated by privileged user", ["IAC-16.1", "MON-03.2"]),
        # AD brute force -> Privileged Account Inventories, Periodic Review
        ("AD domain admin account brute-forced", ["IAC-16.1", "IAC-17"]),
    ]

    risk_name_map = {r.name: r for r in risks}
    link_count = 0
    for risk_name, ctrl_ids in control_links:
        risk_obj = risk_name_map.get(risk_name)
        if not risk_obj:
            print(f"  WARNING: Risk not found: {risk_name}")
            continue
        for ctrl_id in ctrl_ids:
            ctrl_obj = ctrl_map.get(ctrl_id)
            if not ctrl_obj:
                print(f"  WARNING: Control not found: {ctrl_id}")
                continue
            existing = db.query(RiskControl).filter_by(risk_id=risk_obj.id, control_id=ctrl_obj.id).first()
            if not existing:
                rc = RiskControl(risk_id=risk_obj.id, control_id=ctrl_obj.id)
                db.add(rc)
                link_count += 1

    db.commit()
    print(f"Created {link_count} risk-control links")
    print("Seed complete.")

except Exception as e:
    db.rollback()
    print(f"ERROR: {e}")
    raise
finally:
    db.close()
