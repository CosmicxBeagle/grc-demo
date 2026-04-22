"""
Import SCF threat library (NT-1–NT-14, MT-1–MT-23) into grc_demo.db threats table.
Skips any threat whose name already exists.

Run from backend directory:
    venv/Scripts/python.exe import_threats.py
"""
import sqlite3
import sys

sys.stdout.reconfigure(encoding="utf-8")

DB = "grc_demo.db"

THREATS = [
    # ── Natural Threats ───────────────────────────────────────────────────────
    {
        "ref": "NT-1",
        "name": "Drought & Water Shortage",
        "description": (
            "Regardless of geographic location, periods of reduced rainfall are expected. "
            "For non-agricultural industries, drought may not be impactful to operations "
            "until it reaches the extent of water rationing."
        ),
        "threat_category": "natural",
        "source": "environmental",
    },
    {
        "ref": "NT-2",
        "name": "Earthquakes",
        "description": (
            "Earthquakes are sudden rolling or shaking events caused by movement under the "
            "earth's surface. Although earthquakes usually last less than one minute, the "
            "scope of devastation can be widespread and have long-lasting impact."
        ),
        "threat_category": "natural",
        "source": "environmental",
    },
    {
        "ref": "NT-3",
        "name": "Fire & Wildfires",
        "description": (
            "Regardless of geographic location or even building material, fire is a concern "
            "for every business. When thinking of a fire in a building, envision a total loss "
            "to all technology hardware, including backup tapes, and all paper files being "
            "consumed in the fire."
        ),
        "threat_category": "natural",
        "source": "environmental",
    },
    {
        "ref": "NT-4",
        "name": "Floods",
        "description": (
            "Flooding is the most common of natural hazards and requires an understanding of "
            "the local environment, including floodplains and the frequency of flooding events. "
            "Location of critical technologies should be considered (e.g., server room is in "
            "the basement or first floor of the facility)."
        ),
        "threat_category": "natural",
        "source": "environmental",
    },
    {
        "ref": "NT-5",
        "name": "Hurricanes & Tropical Storms",
        "description": (
            "Hurricanes and tropical storms are among the most powerful natural disasters "
            "because of their size and destructive potential. In addition to high winds, "
            "regional flooding and infrastructure damage should be considered when assessing "
            "hurricanes and tropical storms."
        ),
        "threat_category": "natural",
        "source": "environmental",
    },
    {
        "ref": "NT-6",
        "name": "Landslides & Debris Flow",
        "description": (
            "Landslides occur throughout the world and can be caused by a variety of factors "
            "including earthquakes, storms, volcanic eruptions, fire, and by human modification "
            "of land. Landslides can occur quickly, often with little notice. Location of "
            "critical technologies should be considered (e.g., server room is in the basement "
            "or first floor of the facility)."
        ),
        "threat_category": "natural",
        "source": "environmental",
    },
    {
        "ref": "NT-7",
        "name": "Pandemic (Disease) Outbreaks",
        "description": (
            "Due to the wide variety of possible scenarios, consideration should be given both "
            "to the magnitude of what can reasonably happen during a pandemic outbreak "
            "(e.g., COVID-19, Influenza, SARS, Ebola, etc.) and what actions the business "
            "can be taken to help lessen the impact of a pandemic on operations."
        ),
        "threat_category": "natural",
        "source": "environmental",
    },
    {
        "ref": "NT-8",
        "name": "Severe Weather",
        "description": (
            "Severe weather is a broad category of meteorological events that include events "
            "that range from damaging winds to hail."
        ),
        "threat_category": "natural",
        "source": "environmental",
    },
    {
        "ref": "NT-9",
        "name": "Space Weather",
        "description": (
            "Space weather includes natural events in space that can affect the near-earth "
            "environment and satellites. Most commonly, this is associated with solar flares "
            "from the Sun, so an understanding of how solar flares may impact the business "
            "is of critical importance in assessing this threat."
        ),
        "threat_category": "natural",
        "source": "environmental",
    },
    {
        "ref": "NT-10",
        "name": "Thunderstorms & Lightning",
        "description": (
            "Thunderstorms are most prevalent in the spring and summer months and generally "
            "occur during the afternoon and evening hours, but they can occur year-round and "
            "at all hours. Many hazardous weather events are associated with thunderstorms. "
            "Under the right conditions, rainfall from thunderstorms causes flash flooding "
            "and lightning is responsible for equipment damage, fires and fatalities."
        ),
        "threat_category": "natural",
        "source": "environmental",
    },
    {
        "ref": "NT-11",
        "name": "Tornadoes",
        "description": (
            "Tornadoes occur in many parts of the world, including the US, Australia, Europe, "
            "Africa, Asia, and South America. Tornadoes can happen at any time of year and "
            "occur at any time of day or night, but most tornadoes occur between 4-9 p.m. "
            "Tornadoes (with winds up to about 300 mph) can destroy all but the best-built "
            "man-made structures."
        ),
        "threat_category": "natural",
        "source": "environmental",
    },
    {
        "ref": "NT-12",
        "name": "Tsunamis",
        "description": (
            "All tsunamis are potentially dangerous, even though they may not damage every "
            "coastline they strike. A tsunami can strike anywhere along most of the US "
            "coastline. The most destructive tsunamis have occurred along the coasts of "
            "California, Oregon, Washington, Alaska and Hawaii."
        ),
        "threat_category": "natural",
        "source": "environmental",
    },
    {
        "ref": "NT-13",
        "name": "Volcanoes",
        "description": (
            "While volcanoes are geographically fixed objects, volcanic fallout can have "
            "significant downwind impacts for thousands of miles. Far outside of the blast "
            "zone, volcanoes can significantly damage or degrade transportation systems and "
            "also cause electrical grids to fail."
        ),
        "threat_category": "natural",
        "source": "environmental",
    },
    {
        "ref": "NT-14",
        "name": "Winter Storms & Extreme Cold",
        "description": (
            "Winter storms is a broad category of meteorological events that include events "
            "that range from ice storms, to heavy snowfall, to unseasonably cold temperatures. "
            "Winter storms can significantly impact business operations and transportation "
            "systems over a wide geographic region."
        ),
        "threat_category": "natural",
        "source": "environmental",
    },
    # ── Man-Made Threats ──────────────────────────────────────────────────────
    {
        "ref": "MT-1",
        "name": "Civil or Political Unrest",
        "description": (
            "Civil or political unrest can be singular or wide-spread events that can be "
            "unexpected and unpredictable. These events can occur anywhere, at any time."
        ),
        "threat_category": "physical",
        "source": "external",
    },
    {
        "ref": "MT-2",
        "name": "Hacking & Other Cybersecurity Crimes",
        "description": (
            "Unlike physical threats that prompt immediate action (e.g., 'stop, drop, and roll' "
            "in the event of a fire), cyber incidents are often difficult to identify as the "
            "incident is occurring. Detection generally occurs after the incident has occurred, "
            "with the exception of 'denial of service' attacks. The spectrum of cybersecurity "
            "risks is limitless and threats can have wide-ranging effects on the individual, "
            "organizational, geographic, and national levels."
        ),
        "threat_category": "cyber",
        "source": "external",
    },
    {
        "ref": "MT-3",
        "name": "Hazardous Materials Emergencies",
        "description": (
            "Hazardous materials emergencies are focused on accidental disasters that occur "
            "in industrialized nations. These incidents can range from industrial chemical "
            "spills to groundwater contamination."
        ),
        "threat_category": "operational",
        "source": "environmental",
    },
    {
        "ref": "MT-4",
        "name": "Nuclear, Biological and Chemical (NBC) Weapons",
        "description": (
            "The use of NBC weapons are in the possible arsenals of international terrorists "
            "and it must be a consideration. Terrorist use of a 'dirty bomb' is considered "
            "far more likely than use of a traditional nuclear explosive device. This may be "
            "a combination of a conventional explosive device with radioactive, chemical, or "
            "biological material and be designed to scatter lethal and sub-lethal amounts of "
            "material over a wide area."
        ),
        "threat_category": "physical",
        "source": "external",
    },
    {
        "ref": "MT-5",
        "name": "Physical Crime",
        "description": (
            "Physical crime includes 'traditional' crimes of opportunity. These incidents can "
            "range from theft, to vandalism, riots, looting, arson and other forms of "
            "criminal activities."
        ),
        "threat_category": "physical",
        "source": "external",
    },
    {
        "ref": "MT-6",
        "name": "Terrorism & Armed Attacks",
        "description": (
            "Armed attacks, regardless of the motivation of the attacker, can impact a "
            "business. Scenarios can range from single actors (e.g., disgruntled employee) "
            "all the way to a coordinated terrorist attack by multiple assailants. These "
            "incidents can range from the use of blade weapons, blunt objects, to firearms "
            "and explosives."
        ),
        "threat_category": "physical",
        "source": "external",
    },
    {
        "ref": "MT-7",
        "name": "Utility Service Disruption",
        "description": (
            "Utility service disruptions are focused on the sustained loss of electricity, "
            "Internet, natural gas, water, and/or sanitation services. These incidents can "
            "have a variety of causes but directly impact the fulfillment of utility services "
            "that your business needs to operate."
        ),
        "threat_category": "operational",
        "source": "external",
    },
    {
        "ref": "MT-8",
        "name": "Dysfunctional Management Practices",
        "description": (
            "Dysfunctional management practices are a man-made threat that expose an "
            "organization to significant risk. The threat stems from the inability of weak, "
            "ineffective and/or incompetent management to (1) make a risk-based decision and "
            "(2) support that decision. The resulting risk manifests due to (1) an absence of "
            "a required control or (2) a control deficiency."
        ),
        "threat_category": "operational",
        "source": "internal",
    },
    {
        "ref": "MT-9",
        "name": "Human Error",
        "description": (
            "Human error is a broad category that includes non-malicious actions that are "
            "unexpected and unpredictable by humans. These incidents can range from "
            "misconfigurations, to misunderstandings or other unintentional accidents."
        ),
        "threat_category": "operational",
        "source": "internal",
    },
    {
        "ref": "MT-10",
        "name": "Technical / Mechanical Failure",
        "description": (
            "Technical/mechanical failure is a broad category that includes non-malicious "
            "failure due to a defect in the technology, materials or workmanship. "
            "Technical/mechanical failures are unexpected and unpredictable, even when "
            "routine and preventative maintenance is performed. These incidents can range "
            "from malfunctions, to reliability concerns to catastrophic damage."
        ),
        "threat_category": "operational",
        "source": "internal",
    },
    {
        "ref": "MT-11",
        "name": "Statutory / Regulatory / Contractual Obligation",
        "description": (
            "Laws, regulations and/or contractual obligations that directly or indirectly "
            "weaken an organization's security & privacy controls. This includes hostile "
            "nation states that leverage statutory and/or regulatory means for economic or "
            "political espionage and/or cyberwarfare activities."
        ),
        "threat_category": "compliance",
        "source": "external",
    },
    {
        "ref": "MT-12",
        "name": "Redundant, Obsolete/Outdated, Toxic or Trivial (ROT) Data",
        "description": (
            "Redundant, Obsolete/Outdated, Toxic or Trivial (ROT) data is information an "
            "organization utilizes for business processes even though the data is "
            "untrustworthy, due to the data's currency, accuracy, integrity and/or "
            "applicability."
        ),
        "threat_category": "data-breach",
        "source": "internal",
    },
    {
        "ref": "MT-13",
        "name": "Artificial Intelligence & Autonomous Technologies (AAT)",
        "description": (
            "Artificial Intelligence & Autonomous Technologies (AAT) is a broad category "
            "that ranges from non-malicious failure due to a defect in the algorithm to "
            "emergent properties or unintended consequences. AAT failures can be due to "
            "hardware failures, inherent biases or other flaws in the underlying algorithm. "
            "These incidents can range from malfunctions, to reliability concerns to "
            "catastrophic damage (including loss of life)."
        ),
        "threat_category": "cyber",
        "source": "external",
    },
    {
        "ref": "MT-14",
        "name": "Willful Criminal Conduct",
        "description": (
            "Willful criminal conduct is a broad category that includes consciously-committed "
            "criminal acts performed by individuals (mens rea). These incidents can range from "
            "theft, to illegal content to other criminal activities. Criminal conduct generally "
            "involves one of the following kinds of mens rea: (1) intent, (2) knowledge, "
            "(3) recklessness and/or (4) negligence."
        ),
        "threat_category": "insider",
        "source": "internal",
    },
    {
        "ref": "MT-15",
        "name": "Conflict of Interest (COI)",
        "description": (
            "Conflict of Interest (COI) is a broad category but pertains to an ethical "
            "incompatibility. COI exists when (1) the concerns or goals of different parties "
            "are incompatible or (2) a person in a decision-making position is able to derive "
            "personal benefit from actions taken or decisions made in their official capacity."
        ),
        "threat_category": "insider",
        "source": "internal",
    },
    {
        "ref": "MT-16",
        "name": "Macroeconomics",
        "description": (
            "Macroeconomic factors that can negatively affect the global supply chain. "
            "Macroeconomic factors directly impact unemployment rates, interest rates, "
            "exchange rates and commodity prices. Due to how fiscal and monetary policies "
            "can negatively affect the global supply chain, this can disrupt or degrade an "
            "organization's business operations."
        ),
        "threat_category": "operational",
        "source": "external",
    },
    {
        "ref": "MT-17",
        "name": "Foreign Ownership, Control, or Influence (FOCI)",
        "description": (
            "Foreign Ownership, Control, or Influence (FOCI) is a Supply Chain Risk "
            "Management (SCRM) threat category that pertains to the ownership of, control "
            "of, or influence over an organization. Primarily, the concern is if a foreign "
            "interest (e.g., foreign government or parties owned or controlled by a foreign "
            "government) has the direct or indirect ability to influence decisions that "
            "affect the management or operations of the organization."
        ),
        "threat_category": "compliance",
        "source": "external",
    },
    {
        "ref": "MT-18",
        "name": "Geopolitical",
        "description": (
            "Geopolitical is a Supply Chain Risk Management (SCRM) threat category that "
            "pertains to a specific geographic location, or region of relevance, that affects "
            "the supply chain. Primarily, the concern is if a foreign state can affect the "
            "supply chain through political intervention within the host nation."
        ),
        "threat_category": "operational",
        "source": "external",
    },
    {
        "ref": "MT-19",
        "name": "Sanctions",
        "description": (
            "Sanctions is a Supply Chain Risk Management (SCRM) threat category that pertains "
            "to past or present fraudulent activity or corruption. Primarily, the concern is "
            "if the third-party is subject to suspension, exclusion or other sanctions that "
            "can affect the supply chain."
        ),
        "threat_category": "compliance",
        "source": "external",
    },
    {
        "ref": "MT-20",
        "name": "Counterfeit / Non-Conforming Products",
        "description": (
            "Counterfeit/Non-Conforming Products is a Supply Chain Risk Management (SCRM) "
            "threat category that pertains to the integrity of components within the supply "
            "chain. Counterfeits are products introduced to the supply chain that falsely "
            "claim to be produced by the legitimate Original Equipment Manufacturer (OEM), "
            "whereas non-conforming are OEM products/materials that fail to meet customer "
            "specifications. Both can have a detrimental effect on the supply chain."
        ),
        "threat_category": "operational",
        "source": "external",
    },
    {
        "ref": "MT-21",
        "name": "Operational Environment",
        "description": (
            "Operational Environment is a Supply Chain Risk Management (SCRM) threat category "
            "that pertains to the user environment (e.g., place of performance). Primarily, "
            "the concern is if the operational environment is hazardous that could expose the "
            "organization operationally or financially."
        ),
        "threat_category": "operational",
        "source": "external",
    },
    {
        "ref": "MT-22",
        "name": "Supply Chain Interdependencies",
        "description": (
            "Supply Chain Interdependencies is a Supply Chain Risk Management (SCRM) threat "
            "category pertaining to interdependencies related to data, systems and mission "
            "functions."
        ),
        "threat_category": "operational",
        "source": "external",
    },
    {
        "ref": "MT-23",
        "name": "Third-Party Quality Deficiencies",
        "description": (
            "Third-Party Quality Deficiencies is a Supply Chain Risk Management (SCRM) threat "
            "category that provides insights into the ability of the third-party to produce "
            "and deliver products and/or services as expected. This includes an understanding "
            "of the quality assurance practices associated with preventing mistakes or defects "
            "in manufactured/developed products and avoiding problems when delivering "
            "solutions or services to customers."
        ),
        "threat_category": "operational",
        "source": "external",
    },
]


def main():
    conn = sqlite3.connect(DB)
    c = conn.cursor()

    # Fetch existing names (case-insensitive) to avoid duplicates
    c.execute("SELECT LOWER(name) FROM threats")
    existing = {row[0] for row in c.fetchall()}

    inserted = 0
    skipped  = 0

    for t in THREATS:
        if t["name"].lower() in existing:
            print(f"  SKIP  {t['ref']:5s}  {t['name']}")
            skipped += 1
            continue

        c.execute("""
            INSERT INTO threats (name, description, threat_category, source, created_at, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        """, (t["name"], t["description"], t["threat_category"], t["source"]))
        print(f"  OK    {t['ref']:5s}  {t['name']}")
        inserted += 1

    conn.commit()
    conn.close()

    print(f"\nDone.  Inserted: {inserted}  |  Skipped (duplicates): {skipped}")


if __name__ == "__main__":
    main()
