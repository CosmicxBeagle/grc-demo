"""
Seed script — inserts ~100 realistic dummy risks into grc_demo.db.
Run from the backend directory:
    venv/Scripts/python.exe seed_risks.py
"""
import sqlite3, random
from datetime import date, datetime, timedelta

DB = "grc_demo.db"

# ── Reference IDs pulled from DB ──────────────────────────────────────────────
ASSET_IDS  = [2, 3, 4, 5, 6, 7, 8, 9]
THREAT_IDS = [1, 2, 3, 4, 5, 6]
USER_IDS   = [1, 2, 3, 4, 5]

TREATMENTS = ["mitigate", "accept", "transfer", "avoid"]
STATUSES   = ["new", "unmanaged", "managed_with_dates", "managed_without_dates", "closed"]
STATUS_W   = [0.25, 0.20, 0.20, 0.20, 0.15]   # rough distribution

OWNERS = [
    "Security Team", "IT Operations", "Compliance", "Finance", "Legal",
    "HR", "DevOps", "Infrastructure", "GRC Team", "Business Continuity",
]

# 100 realistic risk names across cybersecurity, compliance, operational, third-party domains
RISKS = [
    # Cybersecurity
    ("Ransomware attack on corporate endpoints",             4, 5, "mitigate"),
    ("SQL injection on customer-facing web app",             3, 5, "mitigate"),
    ("Credential stuffing attack on login portal",           4, 4, "mitigate"),
    ("Phishing campaign targeting finance team",             5, 4, "mitigate"),
    ("Unpatched critical CVE on internet-facing server",     4, 5, "mitigate"),
    ("Insider threat — privileged admin abuse",              2, 5, "mitigate"),
    ("MFA bypass via SIM-swapping on executive accounts",    2, 5, "mitigate"),
    ("Supply chain compromise via third-party library",      3, 5, "transfer"),
    ("Exposed secrets in public GitHub repository",          3, 4, "mitigate"),
    ("DDoS attack on payment processing platform",           3, 4, "mitigate"),
    ("Misconfigured S3 bucket exposing customer PII",        3, 5, "mitigate"),
    ("Malicious insider exfiltrating IP via USB",            2, 4, "mitigate"),
    ("Zero-day exploit on VPN appliance",                    2, 5, "mitigate"),
    ("Brute-force attack on RDP endpoints",                  4, 3, "mitigate"),
    ("API key leaked in mobile app binary",                  3, 3, "mitigate"),
    ("Cross-site scripting on internal HR portal",           3, 3, "mitigate"),
    ("Man-in-the-middle on unsecured Wi-Fi",                 2, 3, "mitigate"),
    ("Weak encryption on database backups",                  3, 4, "mitigate"),
    ("Dormant admin accounts not deprovisioned",             3, 3, "mitigate"),
    ("Shadow IT cloud usage without security review",         4, 3, "mitigate"),

    # Access & Identity
    ("Excessive privileged access granted to contractors",   3, 4, "mitigate"),
    ("Shared service accounts used across multiple teams",   3, 3, "mitigate"),
    ("Password reuse across corporate and personal accounts",4, 3, "mitigate"),
    ("Failure to revoke access upon employee termination",   4, 4, "mitigate"),
    ("Inadequate logging of privileged user activity",       3, 3, "mitigate"),
    ("PAM solution not covering all critical systems",       3, 4, "mitigate"),
    ("Directory synchronization errors causing orphan accounts", 2, 3, "mitigate"),

    # Data & Privacy
    ("GDPR breach — personal data retained beyond policy",   3, 4, "mitigate"),
    ("CCPA non-compliance — missing opt-out mechanism",      3, 4, "mitigate"),
    ("Cross-border data transfer without SCCs in place",     2, 4, "transfer"),
    ("PII stored unencrypted in log files",                  3, 4, "mitigate"),
    ("Data subject access request not fulfilled in time",    4, 3, "mitigate"),
    ("Biometric data collected without explicit consent",    2, 5, "avoid"),
    ("Customer data shared with vendor without DPA",         2, 4, "mitigate"),
    ("Unstructured PII sprawl across file shares",           4, 3, "mitigate"),

    # Compliance & Regulatory
    ("SOX IT general control deficiency — change management",3, 4, "mitigate"),
    ("SOX ITGC — inadequate segregation of duties in ERP",   3, 5, "mitigate"),
    ("PCI DSS scope creep — cardholder data in out-of-scope system", 3, 5, "mitigate"),
    ("PCI DSS — missing quarterly vulnerability scans",      4, 4, "mitigate"),
    ("HIPAA — PHI accessible to unauthorized workforce members", 2, 5, "mitigate"),
    ("NIST CSF gaps in asset inventory completeness",        4, 3, "mitigate"),
    ("ISO 27001 audit finding — policy not reviewed annually", 4, 2, "mitigate"),
    ("FedRAMP authorization lapse for cloud service",        1, 5, "mitigate"),
    ("Regulatory reporting deadline missed — SEC 10-K filing", 2, 4, "mitigate"),
    ("Export control violation — software shipped to restricted country", 1, 5, "avoid"),

    # Third-Party & Vendor
    ("Critical vendor with no business continuity plan",     3, 4, "transfer"),
    ("Third-party payroll processor experiencing data breach", 2, 5, "transfer"),
    ("SaaS vendor not completing annual SOC 2 Type II",      3, 3, "mitigate"),
    ("Open-source dependency with abandoned maintainer",     4, 3, "mitigate"),
    ("Vendor access not terminated after contract end",      3, 3, "mitigate"),
    ("Fourth-party risk — vendor's vendor data exposure",    2, 4, "transfer"),
    ("Cloud provider outage — no multi-region failover",     2, 5, "mitigate"),
    ("Managed security provider SLA breach",                 2, 4, "mitigate"),

    # Operational & Business Continuity
    ("Disaster recovery plan not tested in 18 months",       3, 4, "mitigate"),
    ("Single point of failure in core network switch",       2, 4, "mitigate"),
    ("No documented runbook for critical system failover",   3, 3, "mitigate"),
    ("Business continuity plan not aligned to new org structure", 3, 3, "mitigate"),
    ("Key-person dependency — sole admin for prod database", 3, 4, "mitigate"),
    ("Backup restoration never tested end-to-end",           3, 4, "mitigate"),
    ("Unmonitored cron jobs processing financial data",      3, 3, "mitigate"),
    ("Production change deployed without CAB approval",      4, 3, "mitigate"),
    ("Legacy system with no vendor support running in prod", 3, 4, "mitigate"),
    ("Inadequate capacity planning causing peak outages",    3, 3, "mitigate"),

    # AI & Emerging Tech
    ("Generative AI tool ingesting confidential data",       4, 4, "mitigate"),
    ("Model hallucination causing incorrect compliance advice", 3, 3, "mitigate"),
    ("Deepfake used in BEC attack targeting CFO",            2, 5, "mitigate"),
    ("AI-generated phishing emails bypassing email filters", 4, 4, "mitigate"),

    # Physical & Environmental
    ("Unauthorized physical access to server room",          2, 4, "mitigate"),
    ("Fire suppression system not tested annually",          2, 3, "mitigate"),
    ("Data center in flood plain without adequate protection", 1, 5, "transfer"),
    ("CCTV blind spots in sensitive data processing area",   2, 3, "mitigate"),

    # HR & People
    ("Inadequate security awareness training completion rate", 5, 3, "mitigate"),
    ("Background checks not performed for privileged roles",  3, 3, "mitigate"),
    ("Disgruntled employee with access to sensitive systems", 2, 4, "mitigate"),
    ("Contractor onboarding bypassing standard access review", 3, 3, "mitigate"),
    ("Social engineering via fake IT help desk calls",        4, 3, "mitigate"),

    # Financial & Fraud
    ("Invoice fraud via BEC email compromise",               3, 4, "mitigate"),
    ("Expense reimbursement fraud due to weak controls",     3, 3, "mitigate"),
    ("Cryptocurrency ransom payment violating OFAC sanctions", 1, 5, "avoid"),
    ("Unauthorized wire transfer — dual-control not enforced", 2, 5, "mitigate"),

    # DevSecOps & Application
    ("Secrets management — hardcoded credentials in CI/CD pipeline", 4, 4, "mitigate"),
    ("SBOM not maintained for production applications",      4, 3, "mitigate"),
    ("Container images built from untrusted base images",   3, 3, "mitigate"),
    ("Infrastructure as code drift — manual changes not tracked", 4, 3, "mitigate"),
    ("Log aggregation gaps — security events not captured", 3, 4, "mitigate"),
    ("SIEM alert fatigue leading to missed incidents",       4, 4, "mitigate"),
    ("Penetration test findings unresolved after 90 days",  3, 4, "mitigate"),
    ("No vulnerability SLA enforced for critical findings", 3, 4, "mitigate"),
    ("Production database accessible from developer laptops", 3, 4, "mitigate"),
    ("Data loss prevention tool not covering cloud uploads", 4, 4, "mitigate"),

    # Governance
    ("Risk register not reviewed quarterly by leadership",   4, 2, "mitigate"),
    ("Incident response plan not updated after last breach", 3, 3, "mitigate"),
    ("No formal exception management process for policy deviations", 3, 3, "mitigate"),
    ("Information security policy not reviewed in 2 years", 4, 2, "mitigate"),
    ("Board-level cyber risk reporting lacks actionable metrics", 3, 3, "mitigate"),
    ("No cyber insurance coverage for ransomware events",   2, 5, "transfer"),
    ("Audit committee not receiving timely GRC dashboards", 3, 2, "mitigate"),
]

def rand_date_ago(min_days: int, max_days: int) -> datetime:
    days_ago = random.randint(min_days, max_days)
    return datetime.utcnow() - timedelta(days=days_ago)

def main():
    conn = sqlite3.connect(DB)
    c = conn.cursor()

    # Get next ID
    c.execute("SELECT MAX(id) FROM risks")
    max_id = c.fetchone()[0] or 0

    inserted = 0
    for name, likelihood, impact, treatment in RISKS:
        status = random.choices(STATUSES, weights=STATUS_W, k=1)[0]
        owner  = random.choice(OWNERS)
        owner_id = random.choice(USER_IDS + [None, None])
        asset_id  = random.choice(ASSET_IDS + [None])
        threat_id = random.choice(THREAT_IDS + [None])
        created_at = rand_date_ago(1, 420)
        updated_at = created_at + timedelta(days=random.randint(0, 30))

        # Residual — roughly half the risks have residual values
        res_l = res_i = res_s = None
        if random.random() > 0.5:
            res_l = max(1, likelihood - random.randint(1, 2))
            res_i = max(1, impact - random.randint(1, 2))
            res_s = res_l * res_i

        inherent_score = likelihood * impact

        # Managed dates
        msd = med = None
        if status == "managed_with_dates":
            msd = (date.today() - timedelta(days=random.randint(30, 180))).isoformat()
            med = (date.today() + timedelta(days=random.randint(30, 180))).isoformat()

        # Description (optional, ~60% have one)
        desc = None
        if random.random() < 0.6:
            desc = (
                f"Risk identified during {random.choice(['annual review','audit','pen test','vendor assessment','incident post-mortem','compliance review'])}. "
                f"Affects {random.choice(['production','all environments','corporate network','cloud infrastructure','endpoints'])}. "
                f"Remediation tracked by {owner}."
            )

        c.execute("""
            INSERT INTO risks (
                name, description, likelihood, impact,
                residual_likelihood, residual_impact,
                treatment, status, owner, owner_id,
                asset_id, threat_id, parent_risk_id,
                managed_start_date, managed_end_date,
                created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            name, desc, likelihood, impact,
            res_l, res_i,
            treatment, status, owner, owner_id,
            asset_id, threat_id, None,
            msd, med,
            created_at.isoformat(), updated_at.isoformat(),
        ))
        inserted += 1

    conn.commit()
    conn.close()
    print(f"Done. Inserted {inserted} risks into {DB}")

if __name__ == "__main__":
    main()
