"""Generator for the national focus trees of major countries (Phase 13). Countries without a tree of
their own use the generic tree (data/focus_trees/generic.json).

Real policies are named only where a fetched Wikipedia page confirms them (listed in each tree's
`source`); they are tied to the government that pursued them. Everything else is a national
strategy without factual claims. Effects are gameplay estimates.
Run from the project root: python -I -X utf8 scripts/dev/gen-focus-trees-major.py
"""
import json

ACC = "2026-10-15"
W = lambda page: {"url": "https://en.wikipedia.org/wiki/" + page.replace(" ", "_"), "title": "Wikipedia: " + page, "accessed": ACC}
T = lambda m, v, d=3650: {"add_timed_modifier": {"modifier": m, "value": v, "days": d}}
IG = lambda g, v: {"add_interest_group_approval": {"group": g, "value": v}}
LAW = lambda c, l: {"change_law": {"category": c, "law": l}}
PP = lambda v: {"add_political_power": v}
# the partner thinks better of us (scope switch to the partner, opinion of ROOT)
LIKED = lambda tag, v: {"country": {"tag": tag, "effects": [{"add_opinion": {"target": "ROOT", "value": v, "days": 3650}}]}}
party = lambda p: {"ruling_party": p}
anyp = lambda *ps: {"any": [{"party_in_government": p} for p in ps]}
holds = lambda person, office: {"holds_office": {"person": person, "office": office}}


class Tree:
    def __init__(self, tag, name, note, sources):
        self.tag, self.name, self.note, self.sources, self.focuses = tag, name, note, sources, []

    def f(self, id, name, desc, x, y, effects, pre=None, me=None, avail=None, days=70, ai=1):
        d = {"id": f"{self.tag.lower()}_{id}", "name": name, "description": desc, "x": x, "y": y, "days": days, "effects": effects}
        if pre:
            d["prerequisites"] = [[f"{self.tag.lower()}_{p}" for p in group] for group in pre]
        if me:
            d["mutually_exclusive"] = [f"{self.tag.lower()}_{m}" for m in me]
        if avail is not None:
            d["available"] = avail
        if ai != 1:
            d["ai_weight"] = ai
        self.focuses.append(d)

    def standard(self, root_name, root_desc, mil_partner=None, partners=(), bloc_name="our partners"):
        """Shared skeleton: root, military and foreign-policy branches (no factual claims)."""
        self.f("national_programme", root_name, root_desc, 8, 0, [PP(50), {"add_stability": 0.02}])
        self.f("defence_review", "Defence review", "Review strategy, forces and budgets for the new decade.", 11, 1, [{"add_war_support": 0.02}, IG("military", 4)], [["national_programme"]])
        self.f("modern_forces", "Modern forces", "Equip the armed forces with modern communications and precision weapons.", 11, 3, [T("army_attack", 0.05), T("air_effectiveness", 0.05), IG("military", 3)], [["defence_review"]], days=105)
        self.f("intelligence_services", "Intelligence services", "Expand the foreign and domestic intelligence services.", 12, 2, [T("intelligence_power", 0.1), IG("security_services", 4)], [["defence_review"]])
        self.f("foreign_policy", "Foreign policy priorities", "Set the course of foreign policy.", 14, 1, [T("diplomatic_reputation", 0.05), PP(20)], [["national_programme"]])
        eff = [T("bloc_integration", 0.1), T("trade_efficiency", 0.03)] + [LIKED(p, 15) for p in partners]
        self.f("partners", f"Closer ties with {bloc_name}", f"Deepen political and economic ties with {bloc_name}.", 14, 2, eff, [["foreign_policy"]])
        self.f("international_standing", "International standing", "Raise the country's profile in international institutions and summits.", 15, 3, [T("diplomatic_reputation", 0.1), T("international_opinion", 0.05)], [["partners", "own_course"]])
        self.f("own_course", "An independent course", "Keep a free hand in foreign policy and trade.", 16, 2, [T("foreign_influence_resistance", 0.1), {"add_war_support": 0.02}], [["foreign_policy"]], me=["partners"], ai=0.5)
        self.f("economic_council", "Economic council", "Bring ministries, employers and unions together on economic priorities.", 5, 1, [{"add_economic_mood": 0.03}, PP(15)], [["national_programme"]])
        self.f("infrastructure", "Infrastructure programme", "Invest in transport, power grids and communications.", 5, 3, [T("construction_speed", 0.1), {"add_economic_mood": 0.02}], [["economic_council"]], days=105)
        self.f("research_programme", "Research and innovation", "Fund universities, research institutes and new industries.", 6, 4, [T("research_speed", 0.05), T("education_quality", 0.02)], [["infrastructure"]], days=105)

    def dump(self):
        ids = {x["id"] for x in self.focuses}
        for x in self.focuses:
            for g in x.get("prerequisites", []):
                for p in g:
                    assert p in ids, (x["id"], p)
        pos = [(x["x"], x["y"]) for x in self.focuses]
        assert len(pos) == len(set(pos)), (self.tag, [p for p in pos if pos.count(p) > 1])
        out = {"id": self.tag.lower(), "name": self.name, "countries": [self.tag], "note": self.note, "focuses": self.focuses, "source": self.sources, "confidence": "verified"}
        with open(f"data/focus_trees/{self.tag.lower()}.json", "w", encoding="utf8", newline="\n") as fh:
            json.dump(out, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        return len(self.focuses)


NOTE = "Branches depend on the governing parties and office holders. Policies named after real reforms are cited; effects are gameplay estimates."
trees = []

# ---------------- Germany
t = Tree("DEU", "Germany", NOTE, [W("Agenda 2010"), W("Hartz concept"), W("Nuclear power in Germany"), W("Conscription in Germany")])
t.standard("Germany in the new century", "Set the priorities of the federal government.", partners=["FRA", "POL", "NLD"], bloc_name="our European neighbours")
t.f("agenda_2010", "Agenda 2010", "Reform the welfare state and labour market. Chancellor Gerhard Schröder outlined the Agenda 2010 reforms to the Bundestag on 14 March 2003.", 1, 1,
    [T("welfare_cost", -0.015), T("private_sector_output", 0.02), IG("business", 6), IG("labour_unions", -8)], [["national_programme"]], avail=party("deu.spd"), ai=3)
t.f("hartz_reforms", "Hartz reforms", "Restructure unemployment benefits and job placement. The Hartz I to III measures took effect from 2003, and Hartz IV on 1 January 2005.", 0, 2,
    [T("welfare_cost", -0.01), {"add_economic_mood": 0.02}, IG("labour_unions", -6), {"add_ruling_party_popularity": -0.02}], [["agenda_2010"]], avail=party("deu.spd"), ai=2)
t.f("nuclear_phaseout", "Nuclear phase-out", "Wind down nuclear power. Germany decided in 2002 to phase out nuclear power.", 2, 2,
    [LAW("energy_policy", "nuclear_phaseout"), T("renewable_output", 0.1), IG("youth_students", 4), IG("business", -3)], [["agenda_2010", "social_market_renewal"]], avail=anyp("deu.greens", "deu.spd"), ai=2)
t.f("social_market_renewal", "Renew the social market economy", "Lower taxes and labour costs while keeping social partnership.", 3, 1,
    [T("private_sector_output", 0.04), IG("business", 5), IG("rural", 2)], [["national_programme"]], avail=anyp("deu.cdu", "deu.csu", "deu.fdp"), ai=2)
t.f("federalism_reform", "Federalism reform", "Clarify the division of powers between the federation and the states.", 2, 3, [{"add_stability": 0.03}, T("law_change_cost", -0.1)], [["hartz_reforms", "nuclear_phaseout", "social_market_renewal"]])
t.f("suspend_conscription", "Suspend conscription", "Move to an all-volunteer Bundeswehr. Germany put conscription into abeyance on 1 July 2011.", 10, 2,
    [LAW("conscription", "volunteer_force"), T("army_org", 0.05), IG("youth_students", 5), IG("military", -2)], [["defence_review"]], ai=1.5)
t.f("export_industry", "Export industry", "Support the engineering and car industries on world markets.", 7, 2, [T("trade_efficiency", 0.05), T("production_efficiency", 0.03)], [["economic_council"]])
t.f("energy_transition", "Energy transition", "Expand wind and solar power and modernise the grid.", 8, 3, [T("renewable_output", 0.15), T("emissions", -0.05), T("energy_cost", 0.02)], [["export_industry"]], days=105)
trees.append(t)

# ---------------- United Kingdom
t = Tree("GBR", "United Kingdom", NOTE, [W("Five economic tests"), W("Premiership of Tony Blair")])
t.standard("A programme for government", "Set the priorities of Her Majesty's Government.", partners=["USA", "FRA", "DEU"], bloc_name="the Atlantic alliance and Europe")
t.f("public_services", "Investment in public services", "Raise spending on health and education.", 1, 1, [T("health_outcomes", 0.03), T("education_quality", 0.03), T("welfare_cost", 0.02), IG("urban_middle_class", 3)], [["national_programme"]], avail=party("gbr.labour"), ai=3)
t.f("five_tests", "The five economic tests", "Assess whether to join the euro. The Treasury published its assessment of the five economic tests in June 2003.", 0, 2, [{"add_economic_mood": 0.02}, PP(20)], [["public_services"]], avail=party("gbr.labour"), ai=2)
t.f("constitutional_reform", "Constitutional reform", "Continue the reform of the constitution and the House of Lords.", 2, 2, [{"add_stability": 0.02}, T("civil_liberties", 0.03)], [["public_services"]], avail=party("gbr.labour"))
t.f("lower_taxes", "Lower taxes", "Cut income and business taxes.", 3, 1, [T("private_sector_output", 0.04), IG("business", 5), T("welfare_cost", -0.02)], [["national_programme"]], avail=party("gbr.conservative"), ai=3)
t.f("sovereignty", "Defend sovereignty", "Resist further transfers of power to European institutions.", 4, 2, [T("foreign_influence_resistance", 0.1), {"add_ruling_party_popularity": 0.01}], [["lower_taxes"]], avail=party("gbr.conservative"))
t.f("financial_centre", "The City of London", "Keep London a leading financial centre.", 7, 2, [T("foreign_investment", 0.05), IG("business", 3)], [["economic_council"]])
t.f("north_sea", "North Sea energy", "Manage the North Sea oil and gas fields as output declines.", 8, 3, [T("fossil_output", 0.05), T("energy_cost", -0.02)], [["financial_centre"]])
t.f("expeditionary_forces", "Expeditionary forces", "Build forces that can deploy far from home.", 10, 2, [T("army_org", 0.05), T("naval_effectiveness", 0.05)], [["defence_review"]])
trees.append(t)

# ---------------- France
t = Tree("FRA", "France", NOTE, [W("35-hour workweek"), W("Conscription in France")])
t.standard("La France du nouveau siècle", "Set the priorities of the government.", partners=["DEU", "ESP", "ITA"], bloc_name="the European Union")
t.f("thirty_five_hours", "The 35-hour week", "Cut the legal working week to share out work. The Aubry 2 law of January 2000, under Prime Minister Lionel Jospin, set the 35-hour week.", 1, 1,
    [IG("labour_unions", 8), IG("business", -6), T("private_sector_output", -0.02), {"add_unrest": -0.02}], [["national_programme"]], avail=party("fra.ps"), ai=3)
t.f("plural_left", "The plural left", "Hold together the coalition of Socialists, Communists, Greens and Radicals.", 0, 2, [{"add_ruling_party_popularity": 0.02}, PP(20)], [["thirty_five_hours"]], avail=party("fra.ps"))
t.f("liberalise", "Loosen the 35-hour week", "Allow more overtime and simplify labour rules.", 3, 1, [IG("business", 5), IG("labour_unions", -5), T("private_sector_output", 0.03)], [["national_programme"]], avail=anyp("fra.rpr", "fra.ump", "fra.udf", "fra.dl", "fra.lr"), ai=2)
t.f("decentralisation", "Decentralisation", "Transfer powers to the regions and departments.", 2, 2, [{"add_stability": 0.02}, T("tax_efficiency", 0.02)], [["plural_left", "liberalise"]])
t.f("professional_army", "Professional army", "Complete the move to an all-volunteer force. France phased out conscription between 1997 and 2001.", 10, 2,
    [LAW("conscription", "volunteer_force"), T("army_org", 0.05), IG("youth_students", 4)], [["defence_review"]], ai=2)
t.f("nuclear_power", "Nuclear power", "Keep nuclear plants at the core of electricity supply.", 7, 2, [T("nuclear_output", 0.1), T("energy_cost", -0.03)], [["economic_council"]])
t.f("aerospace", "Aerospace and defence industry", "Back the aerospace and arms industries.", 8, 3, [T("production_efficiency", 0.04), T("air_effectiveness", 0.03)], [["nuclear_power"]], days=105)
trees.append(t)

# ---------------- China
t = Tree("CHN", "China", NOTE, [W("China Western Development"), W("Three Represents"), W("Go Out policy")])
t.standard("Reform and opening up", "Continue the policy of reform and opening up.", partners=["RUS"], bloc_name="our neighbours")
t.f("three_represents", "The Three Represents", "Admit new social groups to the Party. Jiang Zemin introduced the Three Represents on 25 February 2000.", 1, 1,
    [PP(40), IG("business", 5), {"add_stability": 0.02}], [["national_programme"]], avail=party("chn.ccp"), ai=3)
t.f("western_development", "Western Development", "Invest in the western provinces. The State Council set up a leading group for Western China development in January 2000.", 0, 2,
    [T("construction_speed", 0.1), IG("minorities", 2), IG("rural", 3)], [["three_represents"]], avail=party("chn.ccp"), ai=3, days=105)
t.f("go_out", "Go Out", "Encourage Chinese companies to invest abroad. Jiang Zemin announced the Go Out policy as a national strategy in March 2000.", 2, 2,
    [T("foreign_investment", 0.04), T("trade_efficiency", 0.04), IG("business", 3)], [["three_represents"]], avail=party("chn.ccp"), ai=3)
t.f("state_enterprise_reform", "State enterprise reform", "Restructure loss-making state enterprises.", 1, 3, [T("state_industry_output", 0.05), IG("labour_unions", -3)], [["western_development", "go_out"]])
t.f("manufacturing", "Workshop of the world", "Expand export manufacturing on the coast.", 7, 2, [T("production_efficiency", 0.05), T("trade_efficiency", 0.04)], [["economic_council"]])
t.f("power_grid", "Power for growth", "Build coal, hydro and nuclear plants to meet demand.", 8, 3, [T("fossil_output", 0.08), T("nuclear_output", 0.05), T("emissions", 0.03)], [["manufacturing"]], days=105)
t.f("military_modernisation", "Military modernisation", "Shift the armed forces from numbers to technology.", 10, 2, [T("army_attack", 0.05), T("naval_effectiveness", 0.05)], [["defence_review"]], days=105)
trees.append(t)

# ---------------- Japan
t = Tree("JPN", "Japan", NOTE, [W("Junichiro Koizumi"), W("Japan Post Holdings")])
t.standard("Revive the economy", "Lead Japan out of the long slowdown of the 1990s.", partners=["USA", "KOR"], bloc_name="the United States and Asian neighbours")
t.f("structural_reform", "Structural reform", "Deal with bad bank debts and reform the public sector, as Prime Minister Junichiro Koizumi set out to do.", 1, 1,
    [T("private_sector_output", 0.03), IG("business", 4), IG("rural", -3)], [["national_programme"]], avail=holds("jpn.junichiro_koizumi", "jpn.prime_minister"), ai=3)
t.f("postal_privatisation", "Postal privatisation", "Privatise the postal savings system. Japan Post Holdings was founded in January 2006 and took over Japan Post's functions in October 2007.", 0, 2,
    [T("foreign_investment", 0.03), T("private_sector_output", 0.02), IG("rural", -4)], [["structural_reform"]], avail=holds("jpn.junichiro_koizumi", "jpn.prime_minister"), ai=2)
t.f("public_works", "Public works stimulus", "Spend on public works to support demand.", 3, 1, [T("construction_speed", 0.1), {"add_economic_mood": 0.03}, IG("rural", 4)], [["national_programme"]], avail=party("jpn.ldp"), ai=2)
t.f("bank_cleanup", "Clean up the banks", "Force banks to write off bad loans.", 2, 2, [{"add_economic_mood": 0.03}, T("interest_rate", -0.005)], [["structural_reform", "public_works"]])
t.f("electronics", "Electronics and robotics", "Lead in electronics, robotics and cars.", 7, 2, [T("research_speed", 0.04), T("production_efficiency", 0.03)], [["economic_council"]])
t.f("ageing_society", "An ageing society", "Prepare pensions and care for an ageing population.", 8, 3, [T("welfare_cost", 0.02), T("health_outcomes", 0.03), T("immigration", 0.02)], [["electronics"]])
t.f("self_defence_forces", "Self-Defense Forces", "Modernise the Self-Defense Forces within the constitution.", 10, 2, [T("air_effectiveness", 0.04), T("naval_effectiveness", 0.04)], [["defence_review"]])
trees.append(t)

# ---------------- Italy
t = Tree("ITA", "Italy", NOTE, [W("Contract with the Italians"), W("Military service")])
t.standard("A programme for Italy", "Set the priorities of the government.", partners=["FRA", "DEU", "ESP"], bloc_name="the European Union")
t.f("contract_with_italians", "Contract with the Italians", "Carry out the programme Silvio Berlusconi signed on 8 May 2001: lower taxes, public works and more jobs.", 3, 1,
    [T("private_sector_output", 0.03), T("construction_speed", 0.05), IG("business", 5)], [["national_programme"]], avail=holds("ita.silvio_berlusconi", "ita.prime_minister"), ai=3)
t.f("olive_tree", "The Olive Tree", "Govern as a broad centre-left coalition.", 1, 1, [{"add_ruling_party_popularity": 0.02}, IG("labour_unions", 3)], [["national_programme"]], avail=anyp("ita.ds", "ita.ppi", "ita.democrats"), ai=2)
t.f("euro_discipline", "Meet the euro rules", "Keep the deficit within the limits of the Stability and Growth Pact.", 1, 2, [T("interest_rate", -0.005), {"add_economic_mood": 0.02}, IG("labour_unions", -2)], [["olive_tree"]])
t.f("southern_development", "Develop the South", "Invest in the Mezzogiorno.", 2, 2, [T("construction_speed", 0.05), IG("rural", 3), {"add_unrest": -0.02}], [["olive_tree", "contract_with_italians"]])
t.f("end_conscription", "End conscription", "Move to an all-volunteer army. Italy had mandatory military service until 31 December 2004.", 10, 2,
    [LAW("conscription", "volunteer_force"), T("army_org", 0.04), IG("youth_students", 4)], [["defence_review"]], ai=2)
t.f("made_in_italy", "Made in Italy", "Promote fashion, design, food and machinery exports.", 7, 2, [T("trade_efficiency", 0.05), T("consumer_goods_factor", -0.02)], [["economic_council"]])
t.f("tourism", "Tourism", "Invest in heritage and tourism.", 8, 3, [{"add_economic_mood": 0.02}, T("foreign_investment", 0.03)], [["made_in_italy"]])
trees.append(t)

# ---------------- Spain
t = Tree("ESP", "Spain", NOTE, [W("Conscription in Spain"), W("Same-sex marriage in Spain")])
t.standard("Spain in Europe", "Set the priorities of the government.", partners=["FRA", "PRT", "DEU"], bloc_name="the European Union")
t.f("end_conscription", "End the mili", "Abolish compulsory military service. José María Aznar brought its end forward to 2001; conscription ended in December 2001.", 10, 2,
    [LAW("conscription", "volunteer_force"), IG("youth_students", 6), T("army_org", 0.03)], [["defence_review"]], avail=holds("esp.jose_maria_aznar", "esp.prime_minister"), ai=3)
t.f("balanced_budget", "Balanced budget", "Eliminate the budget deficit and cut taxes.", 3, 1, [T("interest_rate", -0.005), IG("business", 5), T("welfare_cost", -0.02)], [["national_programme"]], avail=party("esp.pp"), ai=3)
t.f("social_rights", "Extend civil rights", "Widen civil rights. Under José Luis Rodríguez Zapatero, same-sex marriage became legal in Spain on 3 July 2005.", 1, 1,
    [T("civil_liberties", 0.05), IG("youth_students", 5), IG("religious_establishment", -6)], [["national_programme"]], avail=party("esp.psoe"), ai=2)
t.f("autonomies", "The autonomous communities", "Negotiate powers and funding with the autonomous communities.", 2, 2, [{"add_stability": 0.02}, IG("minorities", 4)], [["social_rights", "balanced_budget"]])
t.f("construction_boom", "Housing and transport", "Build housing, motorways and high-speed rail.", 7, 2, [T("construction_speed", 0.1), {"add_economic_mood": 0.03}], [["economic_council"]])
t.f("tourism", "Tourism", "Expand tourism.", 8, 3, [T("foreign_investment", 0.03), {"add_economic_mood": 0.02}], [["construction_boom"]])
trees.append(t)

# ---------------- Turkey
t = Tree("TUR", "Turkey", NOTE, [W("Kemal Derviş"), W("Accession of Turkey to the European Union")])
t.standard("A stronger Turkey", "Set the priorities of the government.", partners=["DEU", "USA", "AZE"], bloc_name="Europe and our neighbours")
t.f("economic_programme", "Economic stabilisation", "Bring in an economic manager to stabilise the economy. Kemal Derviş returned from the World Bank and became Minister of State for Economic Affairs on 13 March 2001, under Prime Minister Bülent Ecevit.", 1, 1,
    [T("inflation", -0.03), {"add_economic_mood": 0.03}, IG("business", 4)], [["national_programme"]], avail=holds("tur.bulent_ecevit", "tur.prime_minister"), ai=3)
t.f("eu_harmonisation", "EU harmonisation", "Align laws with the European Union. Turkey was recognised as a candidate for membership at the Helsinki summit on 12 December 1999.", 0, 2,
    [T("civil_liberties", 0.04), T("bloc_integration", 0.1), IG("minorities", 4), IG("military", -3)], [["economic_programme", "new_government"]], ai=2)
t.f("new_government", "A new governing programme", "Govern with a programme of growth, services and reform.", 3, 1, [{"add_ruling_party_popularity": 0.02}, PP(25)], [["national_programme"]], avail=party("tur.akp"), ai=2)
t.f("anatolian_growth", "Anatolian growth", "Support businesses in the cities of Anatolia.", 2, 2, [T("private_sector_output", 0.03), IG("rural", 3), IG("business", 3)], [["new_government", "economic_programme"]])
t.f("energy_corridor", "Energy corridor", "Bring oil and gas pipelines from the Caspian through Turkey.", 7, 2, [T("energy_cost", -0.03), T("trade_efficiency", 0.03)], [["economic_council"]])
t.f("defence_industry", "National defence industry", "Build armoured vehicles, ships and drones at home.", 10, 2, [T("production_efficiency", 0.03), T("army_attack", 0.03)], [["defence_review"]], days=105)
trees.append(t)

# ---------------- Iran
t = Tree("IRN", "Iran", NOTE, [W("Dialogue Among Civilizations")])
t.standard("The Islamic Republic in the new century", "Set the priorities of the government.", partners=["RUS", "CHN"], bloc_name="friendly states")
t.f("dialogue_among_civilizations", "Dialogue Among Civilizations", "Promote dialogue with other cultures, the idea President Mohammad Khatami put forward.", 1, 1,
    [T("international_opinion", 0.05), IG("youth_students", 4), IG("religious_establishment", -2)], [["national_programme"]], avail=holds("irn.mohammad_khatami", "irn.president"), ai=3)
t.f("civil_society", "Civil society", "Allow more room for newspapers and associations.", 0, 2, [T("press_freedom", 0.05), IG("media", 5), IG("security_services", -4)], [["dialogue_among_civilizations"]], avail=party("irn.reformists"), ai=2)
t.f("revolutionary_values", "Revolutionary values", "Reassert the values of the revolution.", 3, 1, [{"add_stability": 0.03}, IG("religious_establishment", 5), IG("youth_students", -3)], [["national_programme"]], avail=party("irn.principlists"), ai=2)
t.f("oil_revenue", "Oil revenue", "Raise oil and gas output and manage the revenue.", 7, 2, [T("fossil_output", 0.08), {"add_economic_mood": 0.02}], [["economic_council"]])
t.f("self_sufficiency", "Self-sufficiency", "Reduce dependence on imports under sanctions.", 8, 3, [T("state_industry_output", 0.04), T("foreign_influence_resistance", 0.05)], [["oil_revenue"]])
t.f("missile_forces", "Missile forces", "Expand the missile forces.", 10, 2, [T("army_attack", 0.03), {"add_war_support": 0.03}, IG("military", 3)], [["defence_review"]])
trees.append(t)

# ---------------- Poland
t = Tree("POL", "Poland", NOTE, [W("Jerzy Buzek"), W("2003 Polish European Union membership referendum"), W("Military service")])
t.standard("Poland's return to Europe", "Set the priorities of the government.", partners=["DEU", "USA", "LTU"], bloc_name="our allies and neighbours")
t.f("four_reforms", "The four reforms", "Carry through the reforms of local government, pensions, education and health care that Jerzy Buzek's cabinet introduced.", 1, 1,
    [T("tax_efficiency", 0.03), T("education_quality", 0.02), T("welfare_cost", -0.02), IG("labour_unions", -3)], [["national_programme"]], avail=holds("pol.jerzy_buzek", "pol.prime_minister"), ai=3)
t.f("eu_referendum", "The road to the Union", "Prepare the country for membership of the European Union. Poland held its referendum on joining on 7 and 8 June 2003.", 2, 2,
    [T("bloc_integration", 0.1), T("foreign_investment", 0.04), IG("rural", -2)], [["four_reforms", "social_programme"]], ai=2)
t.f("social_programme", "A social programme", "Protect those who lost out in the transition.", 3, 1, [T("welfare_cost", 0.02), IG("labour_unions", 4), IG("rural", 3)], [["national_programme"]], avail=anyp("pol.sld", "pol.psl", "pol.up"), ai=2)
t.f("professional_army", "Professional army", "Move to an all-volunteer army. Poland suspended compulsory military service on 5 December 2008.", 10, 2,
    [LAW("conscription", "volunteer_force"), T("army_org", 0.04), IG("youth_students", 4)], [["defence_review"]], ai=1.5)
t.f("motorways", "Motorways", "Build a national motorway network.", 7, 2, [T("construction_speed", 0.08), {"add_economic_mood": 0.02}], [["economic_council"]])
t.f("coal_and_energy", "Coal and energy security", "Keep coal mining while diversifying gas supply.", 8, 3, [T("fossil_output", 0.05), T("foreign_influence_resistance", 0.04)], [["motorways"]])
trees.append(t)

# ---------------- Israel
t = Tree("ISR", "Israel", NOTE, [W("OECD")])
t.standard("Security and prosperity", "Set the priorities of the government.", partners=["USA", "DEU"], bloc_name="our allies")
t.f("market_reforms", "Market reforms", "Cut public spending and taxes and open markets.", 3, 1, [T("private_sector_output", 0.04), IG("business", 5), IG("labour_unions", -4)], [["national_programme"]], avail=party("isr.likud"), ai=2)
t.f("social_agenda", "A social agenda", "Invest in education and social services.", 1, 1, [T("education_quality", 0.03), T("welfare_cost", 0.02), IG("labour_unions", 3)], [["national_programme"]], avail=party("isr.labor"), ai=2)
t.f("oecd", "Join the OECD", "Meet the standards of the OECD. Israel became a member in 2010.", 2, 2, [T("foreign_investment", 0.05), T("diplomatic_reputation", 0.05)], [["market_reforms", "social_agenda"]])
t.f("high_tech", "High-tech economy", "Back technology start-ups and research.", 7, 2, [T("research_speed", 0.06), T("foreign_investment", 0.03)], [["economic_council"]])
t.f("water", "Water security", "Invest in desalination and water recycling.", 8, 3, [T("construction_speed", 0.04), {"add_stability": 0.02}], [["high_tech"]])
t.f("missile_defence", "Missile defence", "Build layered missile defences.", 10, 2, [T("air_effectiveness", 0.06), IG("military", 3)], [["defence_review"]], days=105)
trees.append(t)

for t in trees:
    print(t.tag, t.dump(), "focuses")
