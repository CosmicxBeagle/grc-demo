"""
Populate framework_description on all ControlMapping rows using known
CIS Controls v8.1, NIST CSF v2.0, and PCI DSS v4.0.1 reference titles.

Usage:
  cd backend
  python -m data.populate_mapping_descriptions
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.models.models import ControlMapping

# ── CIS Controls v8.1 ───────────────────────────────────────────────────────
CIS = {
    "1":    "Inventory and Control of Enterprise Assets",
    "1.1":  "Establish and Maintain Detailed Enterprise Asset Inventory",
    "1.2":  "Address Unauthorized Assets",
    "1.3":  "Utilize an Active Discovery Tool",
    "2":    "Inventory and Control of Software Assets",
    "2.1":  "Establish and Maintain a Software Inventory",
    "2.2":  "Ensure Authorized Software is Currently Supported",
    "2.3":  "Address Unauthorized Software",
    "2.4":  "Utilize Automated Software Inventory Tools",
    "2.5":  "Allowlist Authorized Software",
    "2.7":  "Allowlist Authorized Libraries",
    "3":    "Data Protection",
    "3.1":  "Establish and Maintain a Data Management Process",
    "3.2":  "Establish and Maintain a Data Inventory",
    "3.3":  "Configure Data Access Control Lists",
    "3.5":  "Securely Dispose of Data",
    "3.9":  "Encrypt Data on Removable Media",
    "3.12": "Segment Data Processing and Storage Based on Sensitivity",
    "3.13": "Deploy a Data Loss Prevention Solution",
    "3.14": "Log Sensitive Data Access",
    "4":    "Secure Configuration of Enterprise Assets and Software",
    "4.1":  "Establish and Maintain a Secure Configuration Process",
    "4.3":  "Configure Automatic Session Locking on Enterprise Assets",
    "4.6":  "Securely Manage Enterprise Assets and Software",
    "4.7":  "Manage Default Accounts on Enterprise Assets and Software",
    "4.9":  "Configure Trusted DNS Servers on Enterprise Assets",
    "4.11": "Enforce Remote Wipe Capability on Portable End-User Devices",
    "4.12": "Separate Enterprise Workspaces on Mobile End-User Devices",
    "5":    "Account Management",
    "5.1":  "Establish and Maintain an Inventory of Accounts",
    "5.2":  "Use Unique Passwords",
    "5.3":  "Disable Dormant Accounts",
    "5.4":  "Restrict Administrator Privileges to Dedicated Administrator Accounts",
    "5.5":  "Establish and Maintain an Inventory of Service Accounts",
    "5.6":  "Centralize Account Management",
    "6":    "Access Control Management",
    "6.5":  "Require MFA for Administrative Access",
    "6.6":  "Establish and Maintain an Inventory of Authentication and Authorization Systems",
    "6.7":  "Centralize Access Control",
    "7":    "Continuous Vulnerability Management",
    "7.4":  "Perform Automated Application Patch Management",
    "7.5":  "Perform Automated Vulnerability Scans of Internal Enterprise Assets",
    "7.6":  "Perform Automated Vulnerability Scans of Externally-Exposed Enterprise Assets",
    "8":    "Audit Log Management",
    "8.1":  "Establish and Maintain an Audit Log Management Process",
    "8.2":  "Collect Audit Logs",
    "8.4":  "Standardize Time Synchronization",
    "8.8":  "Collect Service Provider Logs",
    "8.11": "Conduct Audit Log Reviews",
    "9":    "Email and Web Browser Protections",
    "9.4":  "Restrict Unnecessary or Unauthorized Browser and Email Client Extensions",
    "9.5":  "Implement DMARC",
    "10":   "Malware Defenses",
    "10.2": "Configure Automatic Anti-Malware Signature Updates",
    "10.4": "Configure Anti-Malware Scanning of Removable Media",
    "10.6": "Centrally Manage Anti-Malware Software",
    "10.7": "Use Behavior-Based Anti-Malware Software",
    "11":   "Data Recovery",
    "11.2": "Perform Automated Backups",
    "11.3": "Protect Recovery Data",
    "11.4": "Establish and Maintain an Isolated Instance of Recovery Data",
    "11.5": "Test Data Recovery",
    "12":   "Network Infrastructure Management",
    "12.1": "Ensure Network Infrastructure is Up-to-Date",
    "12.2": "Establish and Maintain a Secure Network Architecture",
    "12.3": "Securely Manage Network Infrastructure",
    "12.5": "Centralize Network Authentication, Authorization, and Auditing (AAA)",
    "12.6": "Use of Secure Network Management and Communication Protocols",
    "12.7": "Ensure Remote Devices Utilize a VPN and Connect to Enterprise AAA Infrastructure",
    "12.8": "Establish and Maintain Dedicated Computing Resources for All Administrative Work",
    "13":   "Network Monitoring and Defense",
    "13.1": "Centralize Security Event Alerting",
    "13.4": "Perform Traffic Filtering Between Network Segments",
    "13.5": "Manage Access Control for Remote Assets",
    "13.9": "Deploy Port-Level Access Control",
    "14":   "Security Awareness and Skills Training",
    "14.5": "Train Workforce Members on Causes of Unintentional Data Exposure",
    "14.6": "Train Workforce Members on Recognizing and Reporting Security Incidents",
}

# ── NIST CSF v2.0 ───────────────────────────────────────────────────────────
NIST = {
    "GV":       "Govern — Establish and monitor the organization's cybersecurity risk management strategy",
    "GV.RM":    "Risk Management Strategy",
    "GV.RM-04": "Strategic-level cybersecurity risk decisions are communicated to and acknowledged by senior executives",
    "ID":       "Identify — Understand the organization's cybersecurity risk to systems, assets, and data",
    "ID.AM":    "Asset Management — Assets are identified and managed consistent with their importance to business objectives",
    "ID.AM-01": "Inventories of hardware managed by the organization are maintained",
    "ID.AM-02": "Inventories of software, services, and systems managed by the organization are maintained",
    "ID.AM-07": "Inventories of data and corresponding metadata for designated data types are maintained",
    "ID.AM-08": "Systems, hardware, software, services, and data are managed throughout their life cycles",
    "ID.RA":    "Risk Assessment — The cybersecurity risk to assets is understood by the organization",
    "ID.RA-06": "Risks to the organization associated with threat actors, threats, vulnerabilities, likelihoods, and impacts are understood and communicated",
    "PR":       "Protect — Safeguards to manage cybersecurity risks are used",
    "PR.AA":    "Identity Management, Authentication, and Access Control — Access to assets is limited to authorized users, services, and hardware",
    "PR.AA-01": "Identities and credentials for authorized users, services, and hardware are managed by the organization",
    "PR.AA-03": "Users, services, and hardware are authenticated",
    "PR.AA-05": "Access permissions, entitlements, and authorizations are defined in a policy, managed, enforced, and reviewed",
    "PR.DS":    "Data Security — Data are managed consistent with the organization's risk strategy",
    "PR.DS-02": "The confidentiality, integrity, and availability of data-in-transit are protected",
    "PR.DS-10": "The confidentiality, integrity, and availability of data-in-use are protected",
    "PR.DS-11": "Backups of data are created, protected, maintained, and tested",
    "PR.IR":    "Technology Infrastructure Resilience — Security architectures are managed with the organization's risk strategy",
    "PR.IR-01": "Networks and environments are protected from unauthorized logical access and usage",
    "PR.PS":    "Platform Security — The hardware, software, and services of physical and virtual platforms are managed consistent with the organization's risk strategy",
    "PR.PS-02": "Software is maintained, replaced, and removed commensurate with risk",
    "PR.PS-03": "Hardware is maintained, replaced, and removed commensurate with risk",
    "PR.PS-04": "Log records are generated and made available for continuous monitoring",
    "PR.PS-05": "Installation and execution of unauthorized software are prevented",
    "DE":       "Detect — Possible cybersecurity attacks and compromises are found and analyzed",
    "DE.AE":    "Adverse Event Analysis — Anomalies, indicators of compromise, and other potentially adverse events are analyzed",
    "DE.AE-06": "Information on adverse events is provided to authorized staff and tools",
    "DE.CM":    "Continuous Monitoring — Assets are monitored to find anomalies, indicators of compromise, and other potentially adverse events",
    "DE.CM-01": "Networks and network services are monitored to find potentially adverse events",
    "DE.CM-03": "Personnel activity and technology usage are monitored to find potentially adverse events",
    "DE.CM-09": "Computing hardware and software, runtime environments, and their data are monitored to find potentially adverse events",
    "RS":       "Respond — Actions regarding a detected cybersecurity incident are taken",
    "RC":       "Recover — Assets and operations affected by a cybersecurity incident are restored",
    "RC.RP":    "Incident Recovery Plan Execution — Restoration activities are performed to ensure operational availability of systems and services",
    "RC.RP-01": "The recovery portion of the incident response plan is executed once initiated from the incident response process",
    "RC.RP-03": "The integrity of backups and other restoration assets is verified before using them in restoration",
    "RC.RP-05": "The integrity of restored assets is verified, systems and services are restored, and normal operating status is confirmed",
}

# ── PCI DSS v4.0.1 ──────────────────────────────────────────────────────────
PCI = {
    # Req 1 – Network Security Controls
    "1.2.5":   "All services, protocols, and ports allowed are identified, approved, and have a defined business need",
    "1.2.6":   "Security features are defined and implemented for all services, protocols, and ports that are in use and considered risky",
    "1.3":     "Network access to and from the cardholder data environment is restricted",
    "1.3.1":   "Inbound traffic to the CDE is restricted to only that which is necessary",
    "1.3.2":   "Outbound traffic from the CDE is restricted to only that which is necessary",
    "1.3.3":   "NSCs are installed between all wireless networks and the CDE, regardless of whether the wireless network is trusted or untrusted",
    "1.4":     "Network connections between trusted and untrusted networks are controlled",
    "1.4.1":   "NSCs are implemented between trusted and untrusted networks",
    "1.4.2":   "Inbound traffic from untrusted networks to trusted networks is restricted to communications with system components authorized to provide publicly accessible services",
    "1.5":     "Risks to the CDE from computing devices that can connect to both untrusted networks and the CDE are mitigated",
    "1.5.1":   "Security controls are implemented on any computing devices that connect to both untrusted networks and the CDE",
    # Req 2 – Secure Configurations
    "2.2.2":   "Vendor default accounts are managed — either removed, disabled, or have passwords changed",
    "2.2.4":   "Only necessary services, protocols, daemons, and functions are enabled; all unnecessary functionality is removed or disabled",
    "2.2.5":   "If any insecure services, protocols, or daemons are present, the business need is documented and additional security features are implemented",
    "2.2.7":   "All non-console administrative access is encrypted using strong cryptography",
    "2.3.1":   "For wireless environments connected to the CDE, all wireless vendor defaults are changed at installation",
    # Req 3 – Protect Stored Account Data
    "3.4":     "Access to displays of full PAN and ability to copy cardholder data are restricted",
    "3.4.2":   "When using remote-access technologies, technical controls prevent copy and/or relocation of PAN for all personnel without documented authorization",
    "3.5":     "Primary account number (PAN) is secured wherever it is stored",
    "3.5.1":   "PAN is secured with strong cryptography wherever it is stored",
    # Req 4 – Cryptography in Transit
    "4.2":     "PAN is protected with strong cryptography during transmission",
    "4.2.1":   "Strong cryptography is used to safeguard PAN during transmission over open, public networks",
    "4.2.1.2": "An inventory of the entity's trusted keys and/or certificates used to protect PAN during transmission is maintained",
    # Req 5 – Anti-Malware
    "5.1":     "Processes and mechanisms for protecting all systems and networks from malicious software are defined and understood",
    "5.3":     "Anti-malware mechanisms and processes are active, maintained, and monitored",
    "5.3.1":   "Anti-malware solution(s) are kept current via automatic updates",
    "5.3.2":   "Anti-malware solution(s) perform periodic scans and active or real-time scans",
    "5.3.2.1": "If periodic malware scans are performed, the frequency is defined in the entity's targeted risk analysis",
    "5.3.3":   "Anti-malware solution(s) for removable electronic media are implemented",
    "5.3.4":   "Audit logs for the anti-malware solution(s) are enabled and retained",
    "5.3.5":   "Anti-malware mechanisms cannot be disabled or altered by users without documented management approval",
    # Req 6 – Secure Development & Vulnerability Management
    "6.3":     "Security vulnerabilities are identified and addressed",
    "6.3.1":   "Security vulnerabilities are identified and managed using an industry-recognized vulnerability ranking process",
    "6.3.2":   "An inventory of bespoke, custom, and third-party software components is maintained to facilitate vulnerability and patch management",
    "6.3.3":   "All system components are protected from known vulnerabilities by installing applicable security patches/updates",
    "6.4":     "Public-facing web applications are protected against attacks",
    "6.4.1":   "New threats and vulnerabilities are addressed on an ongoing basis and public-facing web applications are protected against known attacks",
    "6.4.2":   "An automated technical solution is deployed that continually detects and prevents web-based attacks against public-facing web applications",
    "6.4.3":   "All payment page scripts that are loaded and executed in the consumer's browser are managed",
    "6.5.2":   "Upon confirmation of a bespoke or custom software vulnerability, the affected software is corrected via patching and/or a workaround is implemented",
    # Req 7 – Access Control
    "7.1":     "Processes and mechanisms for restricting access to system components and cardholder data by business need to know are defined and understood",
    "7.2":     "Access to system components and data is appropriately defined and assigned",
    "7.2.1":   "An access control model is defined and includes granting of access based on job classification, functions, and least privileges required",
    "7.2.2":   "Access is assigned to users, including privileged users, based on job classification and least privileges necessary",
    "7.2.4":   "All user accounts and related access privileges, including third-party/vendor accounts, are reviewed at least once every six months",
    "7.2.5":   "All application and system accounts and related access privileges are assigned and managed as follows",
    "7.2.5.1": "All access by application and system accounts and related access privileges are reviewed periodically",
    "7.2.6":   "All user access to query repositories of stored cardholder data is restricted",
    "7.3":     "Access to system components and resources is managed via an access control system",
    "7.3.1":   "An access control system is in place that restricts access based on a user's need to know and covers all system components",
    "7.3.2":   "The access control system is configured to enforce permissions assigned to individuals, applications, and systems/processes",
    "7.3.3":   "The access control system is set to deny all by default",
    # Req 8 – Authentication
    "8.2":     "User identification and related accounts for users and administrators are strictly managed throughout an account's lifecycle",
    "8.2.1":   "All users are assigned a unique ID before allowing them to access system components or cardholder data",
    "8.2.3":   "Inactive user accounts are removed or disabled within 90 days of inactivity",
    "8.2.4":   "User accounts used by third parties to access, support, or maintain system components via remote access are managed",
    "8.2.6":   "Inactive user accounts are removed or disabled within 90 days of inactivity",
    "8.2.7":   "Accounts used by third parties to access, support, or maintain system components via remote access are managed as required",
    "8.2.8":   "If a user session has been idle for more than 15 minutes, the user is required to re-authenticate",
    "8.3":     "Strong authentication for users and administrators is established and managed",
    "8.3.1":   "All user access to system components is authenticated via at least one authentication factor (something you know, have, or are)",
    "8.3.2":   "Strong cryptography is used to render all authentication factors unreadable during transmission and storage on all system components",
    "8.3.3":   "User identity is verified before modifying any authentication factor",
    "8.3.4":   "Invalid authentication attempts are limited by locking out the user ID after not more than ten attempts",
    "8.3.5":   "If passwords/passphrases are used as authentication factors, they meet a minimum length of at least 12 characters",
    "8.3.6":   "If passwords/passphrases are used as authentication factors, they meet a minimum length of at least 12 characters",
    "8.3.7":   "Individuals are not allowed to submit a new password/passphrase that is the same as any of the last four used",
    "8.3.9":   "If passwords/passphrases are used for non-consumer user access, they must be changed at least once every 90 days or the security posture is dynamically analyzed",
    "8.3.10.1":"If passwords/passphrases are the only authentication factor for customer user access, they are changed at least once every 90 days or the security posture is dynamically analyzed",
    "8.3.11":  "Authentication factors such as physical or logical security tokens, smart cards, or certificates are assigned to an individual user and not shared",
    "8.4":     "Multi-factor authentication (MFA) is implemented to secure access into the CDE",
    "8.4.1":   "MFA is implemented for all non-console access into the CDE for personnel with administrative access",
    "8.4.2":   "MFA is implemented for all access into the CDE",
    "8.4.3":   "MFA is implemented for all remote network access originating from outside the entity's network that could access or impact the CDE",
    "8.6":     "Use of application and system accounts and associated authentication factors is strictly managed",
    "8.6.1":   "System and application accounts and associated authentication factors are managed as follows",
    "8.6.3":   "Passwords/passphrases for any application and system accounts are protected against misuse",
    # Req 9 – Physical Access
    "9.4":     "Access to media with cardholder data is controlled",
    "9.4.1":   "All media with cardholder data is physically secured",
    "9.4.1.1": "An up-to-date list of media with cardholder data is maintained",
    "9.4.1.2": "Periodic inspections of POI device surfaces are performed to detect tampering and unauthorized substitution",
    "9.4.5":   "Inventory logs of all media with cardholder data are maintained",
    "9.4.5.1": "Inventories of all media with cardholder data are reviewed at least once every three months",
    "9.4.6":   "Hard-copy materials with cardholder data are destroyed when no longer needed for business or legal reasons",
    "9.4.7":   "Electronic media with cardholder data is destroyed when no longer needed for business or legal reasons",
    "9.5.1":   "POI devices that capture payment card data via direct physical interaction are protected from tampering and unauthorized substitution",
    "9.5.1.1": "An up-to-date list of POI devices is maintained, including device make and model, location, and device serial number or other unique identifier",
    "9.5.1.3": "Training is provided to personnel in POI environments to be aware of attempted tampering or replacement of POI devices",
    # Req 10 – Logging & Monitoring
    "10.2":     "Audit logs are implemented to support detection of anomalies, suspicious activity, and forensic analysis",
    "10.2.1":   "Audit logs capture all individual user access to cardholder data",
    "10.2.1.1": "Audit logs capture all individual user access to cardholder data",
    "10.2.1.2": "Audit logs capture all actions taken by any individual with root or administrative privileges",
    "10.2.1.3": "Audit logs capture access to all audit trails",
    "10.2.1.4": "Audit logs capture all invalid logical access attempts",
    "10.2.1.5": "Audit logs capture all use of and changes to identification and authentication mechanisms",
    "10.2.1.6": "Audit logs capture all initialization, stopping, or pausing of the audit logs",
    "10.2.1.7": "Audit logs capture all creation and deletion of system-level objects",
    "10.2.2":   "Audit logs capture all individual user access to cardholder data",
    "10.3.3":   "Audit logs, including those for external-facing technologies, are promptly backed up to a secure, central, internal log server or other media that is difficult to modify",
    "10.4":     "Audit logs are reviewed to identify anomalies or suspicious activity",
    "10.4.1":   "Security events, logs of all system components in the CDE, and logs of all critical system components are reviewed at least once daily",
    "10.4.1.1": "Automated mechanisms are used to perform audit log reviews",
    "10.4.2":   "Logs of all other system components (not specified in Requirement 10.4.1) are reviewed periodically",
    "10.4.2.1": "The frequency of periodic log reviews for all other system components is defined in the entity's targeted risk analysis",
    "10.4.3":   "Exceptions and anomalies identified during the review process are addressed",
    "10.5":     "Audit log history is retained and available for analysis",
    "10.5.1":   "Retain audit log history for at least 12 months, with at least the most recent three months available for immediate analysis",
    "10.6":     "Time-synchronization mechanisms support consistent time settings across all systems",
    "10.6.1":   "System clocks and time are synchronized using time-synchronization technology",
    "10.6.2":   "Systems are configured to the correct and consistent time as per NTP or similar technology",
    "10.6.3":   "Time synchronization settings and data are protected",
    "10.7":     "Failures of critical security controls are detected, reported, and responded to promptly",
    "10.7.1":   "Failures of critical security controls are detected, alerted, and addressed promptly (service providers)",
    "10.7.2":   "Failures of critical security controls are detected, alerted, and addressed promptly",
    "10.7.3":   "Failures of any critical security controls are responded to promptly",
    # Req 11 – Security Testing
    "11.2":     "Wireless access points are identified and monitored, and unauthorized wireless access points are addressed",
    "11.2.2":   "An inventory of authorized wireless access points is maintained, including a documented business justification",
    "11.3":     "External and internal vulnerabilities are regularly identified, prioritized, and addressed",
    "11.3.1":   "Internal vulnerability scans are performed at least once every three months",
    "11.3.1.2": "Internal vulnerability scans are performed via authenticated scanning",
    "11.3.1.3": "Internal vulnerability scans are performed after any significant change",
    "11.3.2":   "External vulnerability scans are performed at least once every three months",
    "11.3.2.1": "External vulnerability scans are performed after any significant change",
    "11.5":     "Network intrusions and unexpected file changes are detected and responded to",
    "11.5.1":   "Intrusion-detection and/or intrusion-prevention techniques are used to detect and/or prevent intrusions into the network",
    "11.5.1.1": "Intrusion-detection and/or intrusion-prevention techniques detect, alert on/prevent, and address covert malware communication channels (service providers)",
    # Req 12 – Policies & Programs
    "12.1.3":   "Roles and responsibilities for performing activities in Requirement 12 are documented, assigned, and understood",
    "12.2":     "Acceptable use policies for end-user technologies are defined and implemented",
    "12.2.1":   "Acceptable use policies for end-user technologies are documented and implemented",
    "12.3":     "Risks to the cardholder data environment are formally identified, evaluated, and managed",
    "12.3.1":   "Each PCI DSS requirement that provides flexibility for how frequently it is performed is supported by a targeted risk analysis",
    "12.3.2":   "A targeted risk analysis is performed for each PCI DSS requirement that the entity meets with the customized approach",
    "12.4.2":   "Reviews are performed at least once every three months to confirm that personnel are following all security policies and operational procedures (service providers)",
    "12.6.3.1": "Security awareness training includes awareness of threats and vulnerabilities that could impact the CDE, including phishing and social engineering",
    "12.6.3.2": "Security awareness training includes awareness about the acceptable use policy for end-user technologies",
    "12.8.1":   "A list of all third-party service providers (TPSPs) with which account data is shared or that could affect the security of account data is maintained",
    "12.10.1":  "An incident response plan exists and is ready to be activated in the event of a system breach",
    # Appendix A2 – SSL/TLS
    "A2.1":     "POI terminals are confirmed to not be susceptible to vulnerabilities in SSL/early TLS",
    "A2.1.1":   "Where POI devices/terminals use SSL and/or early TLS, the entity confirms the devices are not susceptible to any known exploits for those protocols",
    "A2.1.2":   "Provides a statement confirming that POI devices are not susceptible to any known vulnerabilities for SSL/early TLS",
    # Appendix A3
    "A3.2.5":   "An inventory of POI terminals is maintained and managed",
    "A3.2.5.1": "An inventory of POI terminals is reviewed at defined intervals to confirm the list is accurate and complete",
}

LOOKUPS = {"CIS": CIS, "NIST": NIST, "PCI": PCI}

# ── Update database ──────────────────────────────────────────────────────────
db = SessionLocal()

updated = 0
not_found = []

for fw, lookup in LOOKUPS.items():
    mappings = db.query(ControlMapping).filter(ControlMapping.framework == fw).all()
    for m in mappings:
        desc = lookup.get(m.framework_ref)
        if desc:
            m.framework_description = desc
            updated += 1
        else:
            not_found.append(f"{fw} {m.framework_ref}")

db.commit()
db.close()

print(f"Done.")
print(f"  Updated : {updated}")
print(f"  No match: {len(not_found)}")
if not_found:
    print("  Unmatched refs:")
    for r in sorted(set(not_found)):
        print(f"    {r}")
