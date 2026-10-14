"""One-off generator for data/focus_trees/usa.json and rus.json (kept for reference; edit the JSON directly).
Run from the project root: python -I scripts/dev/gen-focus-trees.py
"""
import json

ACC = "2026-10-14"
T = lambda m, v, d=3650: {"add_timed_modifier": {"modifier": m, "value": v, "days": d}}
IG = lambda g, v: {"add_interest_group_approval": {"group": g, "value": v}}


def tree():
    focuses = []

    def f(id, name, desc, x, y, effects, pre=None, me=None, avail=None, days=70, ai=1):
        d = {"id": id, "name": name, "description": desc, "x": x, "y": y, "days": days, "effects": effects}
        if pre:
            d["prerequisites"] = pre
        if me:
            d["mutually_exclusive"] = me
        if avail is not None:
            d["available"] = avail
        if ai != 1:
            d["ai_weight"] = ai
        focuses.append(d)

    return focuses, f


# ---------------- USA
F, f = tree()
pres = lambda p: {"holds_office": {"person": p, "office": "usa.president"}}
f("usa_new_administration", "A new administration", "Set the priorities of the administration for its first term.", 5, 0, [{"add_political_power": 50}])
f("usa_bush_tax_cuts", "Economic growth and tax relief", "Pass the tax cuts the President campaigned on. In the historical timeline the Economic Growth and Tax Relief Reconciliation Act became law in June 2001.", 1, 1,
  [IG("business", 6), IG("labour_unions", -3), {"add_economic_mood": 0.05}, T("private_sector_output", 0.03)], [["usa_new_administration"]], avail=pres("usa.george_w_bush"), ai=3)
f("usa_bush_education", "No Child Left Behind", "Pass a national education bill. In the historical timeline the No Child Left Behind Act became law in 2002.", 0, 2,
  [T("education_quality", 0.03), IG("youth_students", 2)], [["usa_bush_tax_cuts"]], avail=pres("usa.george_w_bush"), ai=2)
f("usa_bush_medicare", "Medicare prescription drug benefit", "Add prescription drug cover to Medicare. In the historical timeline the Medicare Prescription Drug, Improvement, and Modernization Act of 2003 created Medicare Part D.", 2, 2,
  [T("health_outcomes", 0.03), T("welfare_cost", 0.02), {"add_ruling_party_popularity": 0.01}], [["usa_bush_tax_cuts"]], avail=pres("usa.george_w_bush"), ai=2)
f("usa_homeland_security", "Department of Homeland Security", "Create a cabinet department for domestic security. Congress created the Department of Homeland Security after the September 11 attacks.", 1, 3,
  [T("internal_security", 0.1), IG("security_services", 6), IG("media", -2)], [["usa_bush_education", "usa_bush_medicare"]], avail={"has_global_flag": "september_11"}, ai=3)
f("usa_gore_surplus", "Protect the Social Security surplus", "Dedicate the Social Security surplus to Social Security and paying down the national debt, as the 2000 Gore campaign proposed.", 9, 1,
  [{"add_economic_mood": 0.03}, T("interest_rate", -0.005), IG("labour_unions", 3)], [["usa_new_administration"]], avail=pres("usa.al_gore"), ai=3)
f("usa_gore_targeted_tax_cuts", "Targeted tax cuts", "Pass targeted tax cuts for child care, higher education, health insurance and long-term care, as the 2000 Gore campaign proposed.", 8, 2,
  [IG("urban_middle_class", 5), {"add_ruling_party_popularity": 0.01}], [["usa_gore_surplus"]], avail=pres("usa.al_gore"), ai=2)
f("usa_gore_trust_funds", "Health, education and environment trust funds", "Create the three trust funds for health care, education and the environment proposed by the 2000 Gore campaign.", 10, 2,
  [T("health_outcomes", 0.02), T("education_quality", 0.02), T("renewable_output", 0.05), IG("business", -2)], [["usa_gore_surplus"]], avail=pres("usa.al_gore"), ai=2)
f("usa_republican_agenda", "Republican legislative agenda", "Use the position of the party in government to pass its programme.", 4, 1,
  [{"add_political_power": 40}, IG("business", 3)], [["usa_new_administration"]], avail={"ruling_party": "usa.republican"}, ai=2)
f("usa_democratic_agenda", "Democratic legislative agenda", "Use the position of the party in government to pass its programme.", 6, 1,
  [{"add_political_power": 40}, IG("labour_unions", 3)], [["usa_new_administration"]], avail={"ruling_party": "usa.democratic"}, ai=2)
f("usa_bipartisan_compromise", "Bipartisan compromise", "Seek votes across the aisle for major bills.", 5, 2,
  [{"add_stability": 0.03}, {"add_unrest": -0.03}], [["usa_republican_agenda", "usa_democratic_agenda"]])
f("usa_defence_review", "Quadrennial defence review", "Review strategy, forces and budgets.", 13, 1, [{"add_war_support": 0.03}, IG("military", 4)], [["usa_new_administration"]])
f("usa_missile_defence", "Missile defence", "Fund national missile defence programmes.", 12, 2, [T("air_effectiveness", 0.03), IG("military", 3)], [["usa_defence_review"]])
f("usa_force_transformation", "Force transformation", "Restructure the armed forces around lighter, networked units.", 14, 2, [T("army_org", 0.05)], [["usa_defence_review"]])
f("usa_trade_agenda", "Trade agenda", "Negotiate new trade agreements.", 16, 1, [T("trade_efficiency", 0.05), IG("business", 3), IG("labour_unions", -2)], [["usa_new_administration"]])
f("usa_energy_policy", "National energy policy", "Set a national energy strategy.", 16, 2, [T("energy_cost", -0.03)], [["usa_trade_agenda"]])
usa = {
    "id": "usa", "name": "United States", "countries": ["USA"],
    "note": "Branches depend on the governing party and on who is President. Policies named after real laws or campaign proposals are cited; effects are gameplay estimates.",
    "focuses": F,
    "source": [
        {"url": "https://en.wikipedia.org/wiki/Presidency_of_George_W._Bush", "title": "Wikipedia: Presidency of George W. Bush", "accessed": ACC},
        {"url": "https://en.wikipedia.org/wiki/Al_Gore_2000_presidential_campaign", "title": "Wikipedia: Al Gore 2000 presidential campaign", "accessed": ACC},
    ],
    "confidence": "verified",
}
json.dump(usa, open("data/focus_trees/usa.json", "w", encoding="utf8", newline="\n"), indent=2, ensure_ascii=False)

# ---------------- RUS
F, f = tree()
putin = {"holds_office": {"person": "rus.vladimir_putin", "office": "rus.president"}}
f("rus_federal_centre", "Strengthen the federal centre", "Reassert federal authority over the regions and the budget.", 5, 0, [{"add_political_power": 50}, {"add_stability": 0.02}])
f("rus_federal_districts", "Federal districts", "Group the federal subjects into federal districts that monitor whether regional law is consistent with federal law.", 1, 1,
  [{"add_stability": 0.04}, {"add_unrest": -0.03}, IG("minorities", -3), IG("security_services", 3)], [["rus_federal_centre"]], avail=putin, ai=3)
f("rus_flat_tax", "13 percent flat income tax", "Replace the progressive income tax with a single 13 percent rate, a reform of the early Putin years.", 0, 2,
  [IG("business", 6), T("tax_efficiency", 0.05), {"add_economic_mood": 0.04}], [["rus_federal_districts"]], avail=putin, ai=3)
f("rus_stabilization_fund", "Stabilization fund", "Save part of the oil revenue in a fund that balances the budget when prices fall. The real fund was established in 2004.", 2, 2,
  [T("inflation", -0.02), {"add_economic_mood": 0.03}], [["rus_federal_districts"]], avail=putin, ai=2)
f("rus_national_champions", "National champions in energy", "Build large state-controlled companies in the energy sector.", 1, 3,
  [T("state_industry_output", 0.05), IG("business", -3), IG("security_services", 3)], [["rus_flat_tax", "rus_stabilization_fund"]], avail=putin, ai=2)
f("rus_cprf_nationalisation", "Nationalise natural resources", "Bring natural resources and large industries into public ownership, a stated goal of the Communist Party of the Russian Federation.", 9, 1,
  [{"change_law": {"category": "economic_system", "law": "state_capitalism"}}, IG("labour_unions", 8), IG("business", -10)], [["rus_federal_centre"]], avail={"ruling_party": "rus.cprf"}, ai=3)
f("rus_cprf_agriculture", "Public ownership in agriculture", "Bring large farms into public ownership, part of the programme of the party.", 9, 2,
  [IG("rural", 6), IG("business", -3)], [["rus_cprf_nationalisation"]], avail={"ruling_party": "rus.cprf"}, ai=2)
f("rus_party_of_power", "Party of power", "Rally the deputies and regional leaders of the governing party behind the government.", 5, 1,
  [{"add_ruling_party_popularity": 0.03}, {"add_political_power": 30}], [["rus_federal_centre"]], avail={"any": [{"ruling_party": "rus.united_russia"}, {"ruling_party": "rus.unity"}]}, ai=2)
f("rus_military_reform", "Military reform", "Reorganise the armed forces and their command.", 13, 1, [T("army_org", 0.05), IG("military", 4)], [["rus_federal_centre"]])
f("rus_contract_service", "Contract service", "Expand contract soldiers alongside conscripts.", 12, 2, [T("army_org", 0.03), IG("youth_students", 3)], [["rus_military_reform"]])
f("rus_strategic_forces", "Strategic forces", "Maintain and modernise strategic forces.", 14, 2, [{"add_war_support": 0.03}, IG("military", 3)], [["rus_military_reform"]])
f("rus_energy_exports", "Energy exports", "Expand oil and gas export capacity.", 16, 1, [T("fossil_output", 0.1), {"add_economic_mood": 0.05}], [["rus_federal_centre"]])
f("rus_eurasian_cooperation", "Eurasian cooperation", "Deepen economic ties with neighbouring former Soviet states.", 16, 2, [T("trade_efficiency", 0.03)], [["rus_energy_exports"]])
rus = {
    "id": "rus", "name": "Russia", "countries": ["RUS"],
    "note": "Branches depend on the governing party and on who is President. Policies named after real reforms or party programmes are cited; effects are gameplay estimates.",
    "focuses": F,
    "source": [
        {"url": "https://en.wikipedia.org/wiki/Presidency_of_Vladimir_Putin", "title": "Wikipedia: Presidency of Vladimir Putin", "accessed": ACC},
        {"url": "https://en.wikipedia.org/wiki/Federal_districts_of_Russia", "title": "Wikipedia: Federal districts of Russia", "accessed": ACC},
        {"url": "https://en.wikipedia.org/wiki/Stabilization_Fund_of_the_Russian_Federation", "title": "Wikipedia: Stabilization Fund of the Russian Federation", "accessed": ACC},
        {"url": "https://en.wikipedia.org/wiki/Communist_Party_of_the_Russian_Federation", "title": "Wikipedia: Communist Party of the Russian Federation", "accessed": ACC},
    ],
    "confidence": "verified",
}
json.dump(rus, open("data/focus_trees/rus.json", "w", encoding="utf8", newline="\n"), indent=2, ensure_ascii=False)
print("wrote usa.json and rus.json")
