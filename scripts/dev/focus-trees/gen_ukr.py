"""Generates data/focus_trees/ukr.json (FOCUS_TREES_PLAN.md, conflict countries). Run from the repo root."""
import json

F = []
def f(id, name, desc, x, y, effects, pre=None, excl=None, avail=None, days=70, ai=1):
    d = {"id": "ukr_" + id, "name": name, "description": desc, "x": x, "y": y, "days": days}
    if pre: d["prerequisites"] = [["ukr_" + p for p in g.split("|")] for g in pre]
    if excl: d["mutually_exclusive"] = ["ukr_" + e for e in excl]
    if avail is not None: d["available"] = avail
    d["effects"] = effects
    if ai != 1: d["ai_weight"] = ai
    F.append(d)

IG = lambda g, v: {"add_interest_group_approval": {"group": g, "value": v}}
IGI = lambda g, v: {"add_interest_group_influence": {"group": g, "value": v}}
MOD = lambda m, v, days=1460: {"add_timed_modifier": {"modifier": m, "value": v, "days": days}}
LAW = lambda c, l: {"change_law": {"category": c, "law": l}}
PP = lambda v: {"add_political_power": v}
STAB = lambda v: {"add_stability": v}
WS = lambda v: {"add_war_support": v}
GROUP = lambda g, v: {"add_ideology_support": {"group": g, "value": v}}
OPN = lambda t, v: {"add_opinion": {"target": t, "value": v, "days": 1825}}
AFTER = lambda d: {"date_after": d}
BEFORE = lambda d: {"date_before": d}
ALL = lambda *a: {"all": list(a)}
ANY = lambda *a: {"any": list(a)}
NOT = lambda a: {"not": a}
LEAVE = {"leave_history": True}
PRES = lambda p: {"holds_office": {"person": "ukr." + p, "office": "ukr.president"}}
ALT = ANY({"follows_history": False}, {"is_player": True})
HIST = ANY(*[PRES(p) for p in ["leonid_kuchma", "viktor_yushchenko", "viktor_yanukovych", "oleksandr_turchynov", "petro_poroshenko", "volodymyr_zelenskyy"]])
SUP = lambda g, v: {"ideology_group_support_above": {"group": g, "value": v}}
HAS = lambda g: {"has_party_of_group": g}
RULED = lambda g: {"ruling_ideology_group": g}
WEST = ["USA", "DEU", "FRA", "GBR", "POL"]

# ============================================================ political branch (x 0-17)
f("independent_state", "An independent state", "Consolidate the institutions of an independent Ukraine.", 9, 0, [PP(50), STAB(0.02)], ai=5)
alts = ["eastern_course", "liberal_breakthrough", "red_revival", "national_awakening", "ultranationalist_turn", "army_steps_in"]
def excl(me): return [s for s in ["balancing_act"] + alts if s != me]

# ---- historical path (x 0-3)
f("balancing_act", "Between East and West", "Balance relations with Russia and the West while the institutions of the new state settle. This is the path Ukraine took.", 1, 1,
  [PP(40), STAB(0.03)], pre=["independent_state"], excl=excl("balancing_act"), avail=HIST, ai=20)
f("parliamentary_presidential", "A parliamentary-presidential republic", "Constitutional amendments of 2004 move powers from the President to the Verkhovna Rada and the government. They took force on 1 January 2006.", 0, 2,
  [MOD("political_power_gain", -0.1, 1825), IG("urban_middle_class", 4), STAB(0.02)], pre=["balancing_act"], avail=ALL(HIST, AFTER("2006-01-01")), ai=4)
f("presidential_powers_restored", "Presidential powers restored", "The Constitutional Court overturns the 2004 amendments in 2010, restoring the earlier presidential powers.", 0, 3,
  [PP(60), MOD("political_power_gain", 0.1, 1825), IG("urban_middle_class", -4)], pre=["parliamentary_presidential"], avail=ALL(PRES("viktor_yanukovych"), AFTER("2010-10-01")), ai=4)
f("civil_society", "Civil society", "Independent media, election monitors and civic groups grow after the protests of 2004.", 2, 2,
  [IG("media", 5), IG("youth_students", 4), MOD("press_freedom", 0.05, 2920)], pre=["balancing_act"], avail=ALL(HIST, AFTER("2005-01-23")), ai=3)
f("revolution_of_dignity", "After the Revolution of Dignity", "A new government forms after the protests that began on the Maidan on 21 November 2013 and the President's removal in February 2014.", 2, 3,
  [STAB(0.03), PP(50), IG("urban_middle_class", 6), IG("youth_students", 5), WS(0.05)], pre=["civil_society|presidential_powers_restored"], avail=ALL(HIST, AFTER("2014-02-22")), ai=5)
f("decentralisation", "Decentralisation", "Give amalgamated communities (hromadas) their own budgets and powers, a reform launched on 1 April 2014.", 0, 4,
  [{"add_spirit": "ukr_decentralised"}, IG("rural", 5), IG("minorities", 3)], pre=["revolution_of_dignity"], avail=ALL(HIST, AFTER("2014-04-01")), ai=4)
f("national_police", "A new national police", "Replace the militsiya with the National Police, formed on 3 July 2015.", 1, 5,
  [MOD("internal_security", 0.05, 2920), MOD("corruption", -0.02, 2920), IG("urban_middle_class", 4), IG("security_services", -2)], pre=["decentralisation|anti_corruption_bureau"], avail=ALL(HIST, AFTER("2015-07-03")), ai=4)
f("anti_corruption_bureau", "National Anti-Corruption Bureau", "An independent bureau that investigates corruption among officials; its first detectives started work on 1 October 2015.", 2, 4,
  [{"add_spirit": "ukr_anti_corruption_institutions"}, IG("business", 3), IG("media", 3), PP(-20)], pre=["revolution_of_dignity"], avail=ALL(HIST, AFTER("2015-10-01")), ai=4)
f("prozorro", "ProZorro public procurement", "An open electronic system for public procurement, developed with civil society and business.", 3, 5,
  [MOD("corruption", -0.04, 3650), MOD("tax_efficiency", 0.02, 3650), IG("business", 4)], pre=["anti_corruption_bureau"], avail=ALL(HIST, AFTER("2015-06-01")), ai=3)
f("euro_atlantic_constitution", "The Euro-Atlantic course in the constitution", "The Verkhovna Rada amends the constitution on 7 February 2019 to name membership of the EU and NATO as strategic goals.", 2, 6,
  [PP(40), STAB(0.02), *[OPN(t, 10) for t in WEST], OPN("RUS", -15)], pre=["national_police|prozorro"], avail=ALL(HIST, AFTER("2019-02-07")), ai=4)
f("wartime_unity", "Wartime unity", "Parties and regions rally behind the government in a war for the country's survival.", 2, 7,
  [STAB(0.03), WS(0.05), PP(50)], pre=["euro_atlantic_constitution"], avail=ALL(HIST, {"at_war_with": "RUS"}), ai=5)

# ---- eastern course (x 4-5): the Party of Regions
f("eastern_course", "Eastern course", "Seek a close partnership with Russia; the Party of Regions, strongest in the east and south, leads the way.", 4, 1,
  [LEAVE, OPN("RUS", 20), IG("minorities", 5), IG("youth_students", -4)],
  pre=["independent_state"], excl=excl("eastern_course"),
  avail=ALL(ALT, NOT({"ruling_party": "ukr.regions"}), {"party_exists": "ukr.regions"}), ai=0.3)
f("regions_rally", "Rally the east and south", "Organise industrial workers and Russian-speaking voters behind the Party of Regions.", 4, 2,
  [{"add_party_popularity": {"party": "ukr.regions", "value": 0.06}}, IG("labour_unions", 3)], pre=["eastern_course"])
f("regions_government", "A Party of Regions government", "The Party of Regions forms the government.", 4, 3,
  [{"install_government": {"party": "ukr.regions"}}, STAB(-0.04)],
  pre=["regions_rally"], avail={"party_popularity_above": {"party": "ukr.regions", "value": 0.25}}, days=105)
f("russian_language_status", "Status for the Russian language", "Give Russian official status in the regions where most people speak it.", 4, 4,
  [IG("minorities", 8), IG("youth_students", -4), {"add_unrest": -0.02}], pre=["regions_government"])
f("eurasian_integration", "Eurasian integration", "Join the economic projects led by Russia instead of the European Union.", 5, 5,
  [OPN("RUS", 25), OPN("BLR", 15), *[OPN(t, -15) for t in WEST], MOD("trade_efficiency", 0.03, 2920), {"add_treasury": 3}], pre=["russian_language_status"])

# ---- liberal breakthrough (x 6-7)
f("liberal_breakthrough", "Liberal breakthrough", "New liberal parties win over voters tired of the old elites.", 6, 1,
  [LEAVE, GROUP("liberal_democratic", 0.04), IG("urban_middle_class", 5), IG("business", 3)],
  pre=["independent_state"], excl=excl("liberal_breakthrough"),
  avail=ALL(ALT, HAS("liberal_democratic"), NOT(RULED("liberal_democratic")), ANY({"stability_below": 0.6}, {"ig_approval_below": {"group": "urban_middle_class", "value": 45}})), ai=0.3)
f("clean_politics", "Clean politics", "Campaign against the influence of business owners on parliament.", 6, 2,
  [GROUP("liberal_democratic", 0.05), MOD("corruption", -0.03, 1825), IG("business", -3)], pre=["liberal_breakthrough"])
f("liberal_government", "A liberal government", "The most popular liberal party forms the government.", 6, 3,
  [{"install_government": {"ideology": "liberal_democratic"}}, LAW("political_freedom", "free_elections"), STAB(-0.04)],
  pre=["clean_politics"], avail=SUP("liberal_democratic", 0.18), days=105)
f("deregulation", "Deregulation", "Cut licences and inspections for small businesses.", 6, 4,
  [MOD("private_sector_output", 0.06, 2920), MOD("foreign_investment", 0.1, 2920), IG("business", 6), IG("security_services", -3)], pre=["liberal_government"])
f("open_government", "Open government", "Publish budgets, contracts and officials' declarations online.", 7, 5,
  [MOD("corruption", -0.05, 3650), IG("media", 5), LAW("press_freedom", "free_press")], pre=["deregulation"])

# ---- red revival (x 8-9): the Communist Party of Ukraine and other socialist parties
f("red_revival", "Red revival", "Falling wages and pensions turn voters toward the Communist Party of Ukraine and the other parties of the left.", 8, 1,
  [LEAVE, GROUP("socialist_communist", 0.04), IG("labour_unions", 5), IG("business", -5)],
  pre=["independent_state"], excl=excl("red_revival"),
  avail=ALL(ALT, HAS("socialist_communist"), NOT(RULED("socialist_communist")), ANY({"gdp_growth_below": 2}, {"unrest_above": 0.2}, {"ig_approval_below": {"group": "labour_unions", "value": 40}})), ai=0.3)
f("pensioners_and_workers", "Pensioners and workers", "Rallies of pensioners and factory workers behind the left.", 8, 2,
  [GROUP("socialist_communist", 0.05), IG("rural", 3)], pre=["red_revival"])
f("red_government", "A government of the left", "The most popular socialist party takes power and rules as the single governing party.", 8, 3,
  [{"install_government": {"ideology": "socialist_communist", "government_type": "one_party_state"}}, LAW("political_freedom", "single_party_elections"), STAB(-0.05)],
  pre=["pensioners_and_workers"], avail=SUP("socialist_communist", 0.25), days=105)
f("renationalisation", "Renationalisation", "Return the privatised steel works and mines to public ownership.", 8, 4,
  [LAW("economic_system", "state_capitalism"), {"add_spirit": "state_planning"}, {"add_buildings": {"building": "military_factory", "count": 2, "regions": [{"from": "UKR", "adm1": ["UKR-326", "UKR-328"]}]}}, IG("business", -10), IG("labour_unions", 6)], pre=["red_government"])
f("fraternal_ties", "Fraternal ties", "Close ties with Russia and Belarus.", 9, 5,
  [OPN("RUS", 20), OPN("BLR", 20), *[OPN(t, -15) for t in WEST]], pre=["renationalisation"])

# ---- national awakening (x 10-11): Rukh, Svoboda
f("national_awakening", "National awakening", "National-democratic and nationalist parties such as Rukh gain ground on questions of language, history and Russia.", 10, 1,
  [LEAVE, GROUP("nationalist_populist", 0.04), WS(0.03), IG("minorities", -4)],
  pre=["independent_state"], excl=excl("national_awakening"),
  avail=ALL(ALT, HAS("nationalist_populist"), NOT(RULED("nationalist_populist")), ANY({"stability_below": 0.5}, {"war_support_above": 0.5})), ai=0.3)
f("language_and_memory", "Language and memory", "Promote Ukrainian in public life and a national reading of history.", 10, 2,
  [GROUP("nationalist_populist", 0.05), IG("minorities", -5), IG("youth_students", 3)], pre=["national_awakening"])
f("national_government", "A national government", "The most popular nationalist party forms the government.", 10, 3,
  [{"install_government": {"ideology": "nationalist_populist", "government_type": "hybrid_authoritarian"}}, STAB(-0.05)],
  pre=["language_and_memory"], avail=SUP("nationalist_populist", 0.2), days=105)
f("energy_sovereignty", "Energy sovereignty", "End dependence on Russian gas whatever the cost.", 10, 4,
  [MOD("energy_cost", 0.05, 1825), MOD("foreign_influence_resistance", 0.15, 2920), OPN("RUS", -20)], pre=["national_government"])
f("armed_nation", "An armed nation", "Universal military training and a large reserve.", 11, 5,
  [LAW("conscription", "extended_service"), {"add_divisions": {"template": "infantry_division", "count": 3}}, WS(0.05), IG("military", 5)], pre=["energy_sovereignty"])

# ---- ultranationalist (x 12-13): only with a party of the fascist group in the data (none for Ukraine at present)
f("ultranationalist_turn", "Ultranationalist turn", "In a deep crisis, an ultranationalist party gains a mass following and seeks an authoritarian state. This is a counterfactual, not a claim about the party's aims. Available only where such a party exists in the data.", 12, 1,
  [LEAVE, GROUP("fascist", 0.04), WS(0.05), IG("minorities", -8), IG("media", -5)],
  pre=["independent_state"], excl=excl("ultranationalist_turn"),
  avail=ALL(ALT, HAS("fascist"), {"stability_below": 0.4}, {"war_support_above": 0.4}), ai=0.1)
f("street_movement", "A street movement", "Marches and rallies spread the movement in the cities.", 12, 2,
  [GROUP("fascist", 0.06), {"add_unrest": 0.05}], pre=["ultranationalist_turn"])
f("seizure_of_power", "Seizure of power", "The ultranationalist party takes power, abolishes elections and rules as the only party.", 12, 3,
  [{"install_government": {"ideology": "fascist", "government_type": "one_party_state"}}, STAB(-0.08), WS(0.05)],
  pre=["street_movement"], avail=SUP("fascist", 0.2), days=105)
f("total_mobilisation", "Total mobilisation", "State control of the press and the economy for war.", 13, 4,
  [LAW("press_freedom", "total_censorship"), LAW("conscription", "extended_service"), MOD("manpower_factor", 0.1, 2920), WS(0.08), {"every_neighbor": {"effects": [{"add_opinion": {"target": "ROOT", "value": -25, "days": 1825}}]}}], pre=["seizure_of_power"])

# ---- military junta (x 15-16)
f("army_steps_in", "The army steps in", "With the state in crisis, the generals prepare to take over.", 15, 1,
  [LEAVE, IGI("military", 0.08), IG("military", 5)],
  pre=["independent_state"], excl=excl("army_steps_in"),
  avail=ALL(ALT, {"stability_below": 0.3}, ANY({"unrest_above": 0.4}, {"ig_approval_below": {"group": "military", "value": 35}})), ai=0.2)
f("military_council", "Military council", "The armed forces remove the government. The coup may fail.", 15, 2,
  [{"trigger_coup": {"by": "military", "success_chance": 0.6}}], pre=["army_steps_in"], days=35)
f("martial_order", "Martial order", "A state of emergency, a curfew and military courts.", 15, 3,
  [LAW("civil_rights", "security_state"), MOD("internal_security", 0.1), {"add_unrest": -0.08}, IG("youth_students", -6)],
  pre=["military_council"], avail={"government_type": "military_junta"})
f("return_to_barracks", "Return to the barracks", "The council hands power to an elected government.", 16, 4,
  [{"set_government_type": "semi_presidential"}, LAW("political_freedom", "free_elections"), {"hold_election": {"kind": "presidential"}}, STAB(0.05), IGI("military", -0.08)],
  pre=["martial_order"], avail={"government_type": "military_junta"}, days=140, ai=0.5)


# ---- helpers for the action effects (Russia model tree style)
SPIRIT = lambda s: {"add_spirit": s if s in GENERIC else "ukr_" + s}
REMOVE = lambda s: {"remove_spirit": s if s in GENERIC else "ukr_" + s}
SWAP = lambda a, b: {"swap_spirit": {"from": "ukr_" + a, "to": "ukr_" + b}}
TREAS = lambda v: {"add_treasury": v}
RB = lambda cat, v=0.2, uses=2: {"add_research_bonus": {"category": cat, "value": v, "uses": uses}}
EQUIP = lambda n: {"add_equipment": {"family": "infantry_equipment", "amount": n}}
DIVS = lambda t, n: {"add_divisions": {"template": t, "count": n}}
CASH = lambda v: {"treasury_above": v}
HAS = lambda s: {"has_spirit": "ukr_" + s}
def BUILD(b, n, *adm1):
    d = {"building": b, "count": n}
    if adm1: d["regions"] = [{"from": "UKR", "adm1": list(adm1)}]
    return {"add_buildings": d}
def CLAIM(*regions): return {"add_claim": {"regions": [{"from": t, "adm1": list(a)} for t, a in regions]}}
GENERIC = {"war_economy", "reconstruction_effort", "anti_corruption_campaign", "science_drive"}
KYIV, KHARKIV, DNIPRO, DONETSK, LUHANSK, ZAPORIZHZHIA = "UKR-321", "UKR-328", "UKR-326", "UKR-327", "UKR-329", "UKR-331"
ODESA, LVIV, MYKOLAIV, KHERSON, POLTAVA = "UKR-322", "UKR-291", "UKR-284", "UKR-4827", "UKR-330"
CRIMEA = ["RUS-283", "RUS-5482"]
WAR = {"at_war_with": "RUS"}

# ============================================================ economy and finance (x 19-24)
f("economic_recovery", "Economic recovery", "Return to growth after a decade of decline.", 21, 0, [PP(30), {"add_economic_mood": 0.03}], ai=5)
f("hryvnia_stabilisation", "Stabilise the hryvnia", "Tight money and an independent central bank end the inflation of the 1990s.", 19, 1,
  [SWAP("post_soviet_depression", "fragile_recovery"), MOD("inflation", -0.02, 2920), PP(-20)], pre=["economic_recovery"], avail=HAS("post_soviet_depression"), ai=4)
f("privatisation", "Large-scale privatisation", "Sell the large state enterprises to private owners.", 21, 1,
  [MOD("private_sector_output", 0.05, 2920), IG("business", 6), IG("labour_unions", -4), TREAS(2)], pre=["economic_recovery"])
f("tax_reform", "Tax reform", "Simplify taxes and widen the base.", 23, 1,
  [MOD("tax_efficiency", 0.05, 2920), IG("business", 3)], pre=["economic_recovery"])
f("banking_cleanup", "Clean up the banks", "Close insolvent banks and strengthen the central bank's supervision.", 19, 2,
  [MOD("interest_rate", -0.005, 2920), MOD("inflation", -0.01, 2920), IG("business", -2)], pre=["hryvnia_stabilisation|tax_reform"])
f("imf_programme", "An IMF programme", "Loans from the International Monetary Fund in exchange for reforms.", 21, 2,
  [TREAS(5), {"set_budget": {"spending": -0.5}}, IG("labour_unions", -3)], pre=["privatisation|tax_reform"])
f("steel_and_coal", "Steel and coal", "Modernise the steel works and mines of the east.", 23, 2,
  [BUILD("civilian_factory", 2, DNIPRO, DONETSK, ZAPORIZHZHIA), IG("labour_unions", 4)], pre=["privatisation"])
f("recovery_complete", "A full recovery", "The recovery is secure and the banks are sound.", 19, 3,
  [REMOVE("fragile_recovery"), MOD("foreign_investment", 0.05, 2920)], pre=["banking_cleanup", "imf_programme"], avail=HAS("fragile_recovery"), days=105, ai=4)
f("dcfta", "Free trade with the EU", "The trade part of the Association Agreement, a deep and comprehensive free trade area, applies from 1 January 2016.", 21, 3,
  [LAW("trade", "free_trade"), SPIRIT("european_integration"), BUILD("civilian_factory", 1, LVIV)], pre=["imf_programme|steel_and_coal"], avail=ALL(HIST, AFTER("2016-01-01")), ai=4)
f("agricultural_exports", "Grain and oilseed exports", "Invest in grain and sunflower-oil exports through the Black Sea ports.", 23, 3,
  [BUILD("port", 1, ODESA), BUILD("infrastructure", 1, MYKOLAIV), MOD("trade_efficiency", 0.03, 2920), IG("rural", 5)], pre=["steel_and_coal"])
f("farmland_market", "A farmland market", "Allow the sale of farmland.", 19, 4,
  [MOD("gdp_growth", 0.002, 2920), IG("business", 4), IG("rural", -4)], pre=["recovery_complete|dcfta"])
f("it_sector", "Information technology", "Tax incentives for software and IT services.", 21, 4,
  [BUILD("data_centre", 1, KYIV), RB("economy_digital", 0.2, 2), IG("youth_students", 4)], pre=["dcfta|agricultural_exports"])
f("food_processing", "Food processing", "Process grain and oilseeds at home.", 23, 4,
  [BUILD("civilian_factory", 2, POLTAVA, "UKR-319"), IG("rural", 3)], pre=["agricultural_exports"])
f("reconstruction", "Reconstruction", "Rebuild housing, power and transport damaged by war.", 21, 5,
  [SPIRIT("reconstruction_effort"), BUILD("infrastructure", 3), TREAS(-2)], pre=["it_sector|food_processing|farmland_market"], avail=ANY(WAR, AFTER("2022-02-24")))

# ============================================================ energy, industry and infrastructure (x 26-31)
f("energy_strategy", "Energy strategy", "Plan the country's energy for the coming decades.", 28, 0, [PP(20)], ai=4)
f("gas_production", "Domestic gas", "Raise gas output from the fields of Poltava and Kharkiv.", 26, 1,
  [BUILD("refinery", 1, POLTAVA), MOD("fossil_output", 0.05, 2920)], pre=["energy_strategy"])
f("energy_efficiency", "Energy efficiency", "Insulate homes and meter heat and gas to cut consumption.", 28, 1,
  [MOD("energy_cost", -0.04, 3650), TREAS(-1)], pre=["energy_strategy"], avail=CASH(1))
f("ports_and_rail", "Ports and railways", "Modernise the Black Sea ports and the railways to the west.", 30, 1,
  [BUILD("infrastructure", 3), BUILD("port", 1, MYKOLAIV)], pre=["energy_strategy"])
f("reverse_gas_flows", "Reverse gas flows", "Import gas from the west through the pipelines that once carried it only one way.", 26, 2,
  [SWAP("gas_dependence", "gas_diversified"), OPN("RUS", -5)], pre=["gas_production", "energy_efficiency"], avail=HAS("gas_dependence"), days=105, ai=4)
f("nuclear_fuel", "Nuclear fuel diversification", "Buy fuel for the nuclear power plants from more than one supplier.", 28, 2,
  [MOD("nuclear_output", 0.05, 3650), MOD("energy_cost", -0.02, 3650)], pre=["energy_efficiency"])
f("roads_to_europe", "Roads to Europe", "Motorways and border crossings to Poland and Romania.", 30, 2,
  [BUILD("infrastructure", 2, LVIV, "UKR-288"), MOD("trade_efficiency", 0.02, 2920)], pre=["ports_and_rail"])
f("aerospace_industry", "Aerospace industry", "Aircraft and engines from the plants of Kyiv, Kharkiv and Zaporizhzhia.", 26, 3,
  [BUILD("military_factory", 1, KHARKIV), BUILD("civilian_factory", 1, ZAPORIZHZHIA), RB("air_drones", 0.2, 1)], pre=["reverse_gas_flows|nuclear_fuel"])
f("renewables", "Wind and solar", "Wind and solar farms in the south.", 28, 3,
  [BUILD("renewable_plant", 1, KHERSON), MOD("energy_cost", -0.02, 3650)], pre=["nuclear_fuel"])
f("machine_building", "Machine building", "Tractors, turbines and rail cars for export.", 30, 3,
  [BUILD("civilian_factory", 2, KHARKIV, DNIPRO), MOD("trade_efficiency", 0.02, 2920)], pre=["roads_to_europe"])
f("power_grid_europe", "Join the European grid", "Synchronise the power grid with continental Europe.", 28, 4,
  [MOD("energy_cost", -0.03, 3650), OPN("POL", 5)], pre=["renewables|aerospace_industry"], avail=AFTER("2015-01-01"))
f("industrial_parks", "Industrial parks", "Serviced land and tax breaks for new plants in the west.", 30, 4,
  [BUILD("civilian_factory", 2, LVIV, "UKR-318"), MOD("foreign_investment", 0.03, 2920)], pre=["machine_building"])

# ============================================================ military (x 33-38)
f("defence_review", "Defence review", "Review the armed forces inherited from the Soviet Union.", 35, 0, [WS(0.02), IG("military", 3)], ai=4)
f("smaller_army", "A smaller, better army", "Cut the size of the forces and spend more per soldier.", 33, 1,
  [MOD("army_org", 0.02, 1460), MOD("manpower_factor", -0.03, 1460)], pre=["defence_review"])
f("contract_soldiers", "Contract soldiers", "More professional soldiers alongside conscripts.", 35, 1,
  [MOD("army_org", 0.02, 1460), IG("youth_students", 3)], pre=["defence_review"])
f("border_guard", "Border guard", "Strengthen the border guard on the eastern and southern borders.", 37, 1,
  [MOD("internal_security", 0.05, 2920), MOD("army_defence", 0.01, 1460)], pre=["defence_review"])
f("nato_standards", "NATO standards", "Train and organise the forces to NATO standards.", 33, 2,
  [MOD("training_time", -0.05, 1460), RB("doctrine", 0.2, 2), OPN("USA", 5)], pre=["smaller_army|contract_soldiers"])
f("defence_industry", "Defence industry", "Restart production of armoured vehicles, missiles and ammunition at home. Unlocks defence orders.", 35, 2,
  [BUILD("military_factory", 2, KHARKIV, KYIV), EQUIP(300)], pre=["contract_soldiers"])
f("rebuild_the_navy", "Rebuild the navy", "A navy and coastal defences based in Odesa and Mykolaiv instead of Sevastopol.", 37, 2,
  [SWAP("fleet_in_sevastopol", "navy_rebuilt"), BUILD("port", 1, ODESA)], pre=["border_guard"], avail=ALL(HAS("fleet_in_sevastopol"), ANY(AFTER("2014-03-18"), ALT)), ai=3)
f("armour", "Armoured vehicles", "Modernise tanks and armoured vehicles at the Kharkiv and Kyiv plants.", 33, 3,
  [RB("armour", 0.2, 2), DIVS("mechanised_division", 1)], pre=["nato_standards|defence_industry"])
f("missiles", "Missiles and artillery", "Domestic missiles and artillery ammunition.", 35, 3,
  [RB("artillery_missiles", 0.25, 2), BUILD("military_factory", 1, DNIPRO)], pre=["defence_industry"])
f("air_defence", "Air defence", "Modernise and extend air defence around cities and power plants.", 37, 3,
  [MOD("army_defence", 0.02, 1460), BUILD("air_base", 1)], pre=["rebuild_the_navy|border_guard"])
f("drones", "Drones", "Reconnaissance and strike drones built by domestic firms and volunteers.", 34, 4,
  [SPIRIT("drone_industry"), RB("air_drones", 0.25, 2)], pre=["armour|missiles"], avail=AFTER("2014-03-01"))
f("special_operations", "Special operations forces", "A separate command for special operations.", 36, 4,
  [MOD("army_attack", 0.02, 1460), DIVS("motorised_division", 1)], pre=["missiles|air_defence"])
f("reserve_army", "A trained reserve", "Regular refresher training for former soldiers.", 38, 4,
  [MOD("manpower_factor", 0.03, 1460), DIVS("infantry_division", 1)], pre=["air_defence"])

# ============================================================ the war with Russia (x 40-44): historical path, from 2014
f("defence_of_ukraine", "The defence of Ukraine", "Organise the country's defence after the annexation of Crimea and the start of the war in the Donbas in 2014.", 42, 0,
  [WS(0.05), STAB(0.02), PP(30)], avail=AFTER("2014-03-01"), ai=5)
f("volunteer_battalions", "Volunteer battalions into the army", "Bring the volunteer battalions under the command of the armed forces and the National Guard.", 40, 1,
  [DIVS("infantry_division", 1), MOD("army_org", 0.02, 1460)], pre=["defence_of_ukraine"])
f("donbas_front", "Fortify the Donbas front", "Trenches and strongpoints along the line of contact.", 42, 1,
  [MOD("army_defence", 0.03, 1460), BUILD("infrastructure", 1, DONETSK)], pre=["defence_of_ukraine"])
f("crimea_is_ukraine", "Crimea is Ukraine", "Ukraine does not recognise the annexation of Crimea and claims it back.", 44, 1,
  [CLAIM(("RUS", CRIMEA)), OPN("RUS", -20), WS(0.03)], pre=["defence_of_ukraine"], avail=AFTER("2014-03-18"))
f("territorial_defence", "Territorial Defence Forces", "Volunteer reservists organised in every region, a separate branch of the armed forces from January 2022.", 40, 2,
  [SPIRIT("nation_in_arms"), DIVS("infantry_division", 2)], pre=["volunteer_battalions"], avail=AFTER("2022-01-01"), ai=5)
f("western_aid", "Western military aid", "Training, intelligence and weapons from NATO members.", 42, 2,
  [EQUIP(800), MOD("army_org", 0.02, 1460), OPN("USA", 10), OPN("GBR", 10)], pre=["donbas_front|volunteer_battalions"], avail=AFTER("2014-06-01"))
f("occupied_regions", "The occupied regions", "Claim back every region Russia or its proxies hold.", 44, 2,
  [CLAIM(("RUS", [DONETSK, LUHANSK, ZAPORIZHZHIA, KHERSON]), ("DPR", [DONETSK]), ("LPR", [LUHANSK])), WS(0.03)], pre=["crimea_is_ukraine"], avail=AFTER("2014-04-12"))
f("wartime_economy", "A wartime economy", "Put the economy on a war footing.", 40, 3,
  [SPIRIT("war_economy"), BUILD("military_factory", 2, LVIV, "UKR-323")], pre=["territorial_defence"], avail=WAR)
f("long_range_strikes", "Long-range strikes", "Drones and missiles that reach depots and airfields far behind the front.", 42, 3,
  [RB("artillery_missiles", 0.25, 2), RB("air_drones", 0.25, 1)], pre=["western_aid"], avail=AFTER("2022-02-24"))
f("black_sea_denial", "Deny the Black Sea", "Coastal missiles and sea drones push the Russian fleet away from the coast.", 44, 3,
  [MOD("naval_effectiveness", 0.04, 1460), RB("naval", 0.2, 1)], pre=["western_aid|occupied_regions"], avail=AFTER("2022-02-24"))
f("energy_resilience", "Energy resilience", "Repair and protect the power grid under attack.", 41, 4,
  [BUILD("renewable_plant", 1), MOD("energy_cost", -0.02, 1460), TREAS(-1)], pre=["wartime_economy|long_range_strikes"], avail=WAR)
f("counteroffensive", "Prepare a counteroffensive", "Train and equip new brigades for an offensive.", 43, 4,
  [DIVS("mechanised_division", 2), EQUIP(500), MOD("army_attack", 0.02, 730)], pre=["long_range_strikes|black_sea_denial"], avail=WAR)

# ============================================================ foreign policy (x 46-51)
f("foreign_policy", "Foreign policy priorities", "Set the course of foreign policy for an independent Ukraine.", 48, 0, [PP(30), MOD("diplomatic_reputation", 0.05, 1825)], ai=4)
f("european_choice", "European choice", "Make membership of the European Union the long-term goal.", 47, 1,
  [OPN("POL", 10), OPN("DEU", 10), OPN("FRA", 10), IG("urban_middle_class", 4), IG("youth_students", 3)], pre=["foreign_policy"], excl=["eurasian_choice"], ai=6)
f("eurasian_choice", "Eurasian choice", "Tie the economy to Russia and its partners instead.", 49, 1,
  [SPIRIT("eurasian_integration"), OPN("RUS", 20), OPN("BLR", 10), IG("minorities", 4), IG("youth_students", -3)], pre=["foreign_policy"], excl=["european_choice"], avail=ALT, ai=0.3)
f("kharkiv_pact", "Kharkiv agreements", "Extend the lease of the Russian Black Sea Fleet's base in Crimea to 2042 in exchange for discounted gas, as agreed on 21 April 2010.", 51, 1,
  [MOD("energy_cost", -0.04, 1460), OPN("RUS", 15), IG("military", -3)], pre=["foreign_policy"], avail=ALL(PRES("viktor_yanukovych"), AFTER("2010-04-21"), BEFORE("2014-02-22")), ai=3)
f("nato_perspective", "A NATO perspective", "Seek a path to NATO membership; at the Bucharest summit in April 2008 the allies agreed that Ukraine would become a member, without a Membership Action Plan.", 46, 2,
  [OPN("USA", 10), OPN("GBR", 5), OPN("RUS", -15), WS(0.02)], pre=["european_choice"], avail=AFTER("2008-04-02"), ai=3)
f("association_agreement", "Association Agreement with the EU", "Sign the Association Agreement with the European Union: political provisions on 21 March 2014, provisional application from 1 November 2014, full force on 1 September 2017.", 48, 2,
  [MOD("trade_efficiency", 0.04, 3650), MOD("foreign_investment", 0.05, 3650), OPN("DEU", 10), OPN("FRA", 10), OPN("POL", 10), OPN("RUS", -10)], pre=["european_choice"], avail=ALL(HIST, AFTER("2014-03-21")), ai=5)
f("eurasian_customs", "A customs union in the east", "Join a customs union with Russia and its partners.", 50, 2,
  [MOD("trade_efficiency", 0.03, 3650), BUILD("civilian_factory", 1, KHARKIV), OPN("RUS", 15), OPN("POL", -10)], pre=["eurasian_choice"])
f("minsk_agreements", "Minsk agreements", "Ceasefire agreements for the Donbas signed in September 2014 and on 12 February 2015.", 51, 3,
  [STAB(0.03), {"add_unrest": -0.02}, WS(-0.03), OPN("DEU", 5), OPN("FRA", 5)], pre=["kharkiv_pact|association_agreement"], avail=ALL(HIST, AFTER("2014-09-05"), BEFORE("2022-02-24")), ai=3)
f("polish_partnership", "Partnership with Poland", "A close partnership with Poland as the gateway to the European Union.", 46, 3,
  [OPN("POL", 20), BUILD("infrastructure", 1, LVIV)], pre=["nato_perspective|association_agreement"])
f("eu_candidate", "EU candidate status", "The European Council grants Ukraine candidate status on 23 June 2022.", 48, 3,
  [PP(50), STAB(0.03), MOD("foreign_investment", 0.05, 3650), OPN("DEU", 10), OPN("FRA", 10)], pre=["association_agreement"], avail=ALL(HIST, AFTER("2022-06-23")), ai=5)
f("russian_gas_deal", "A long-term gas deal with Russia", "Cheap gas for a long-term transit contract.", 50, 3,
  [REMOVE("gas_dependence"), MOD("energy_cost", -0.05, 3650), OPN("RUS", 10)], pre=["eurasian_customs"])
f("sanctions_coalition", "A sanctions coalition", "Rally partners to keep economic pressure on Russia.", 47, 4,
  [MOD("diplomatic_reputation", 0.05, 2920), OPN("RUS", -20), OPN("USA", 5), OPN("GBR", 5)], pre=["polish_partnership|eu_candidate"], avail=WAR)
f("black_sea_grain", "Black Sea grain exports", "Keep the sea route for grain exports open.", 49, 4,
  [MOD("trade_efficiency", 0.05, 2920), {"add_economic_mood": 0.03}, IG("rural", 4)], pre=["eu_candidate|minsk_agreements"])

# ============================================================ society and state (x 53-56)
f("social_policy", "Social policy", "Set the government's priorities for health, schools and science.", 54, 0, [PP(20)], ai=3)
f("health_reform", "Health reform", "Money follows the patient; family doctors and new hospitals.", 53, 1,
  [MOD("health_outcomes", 0.04, 3650), TREAS(-1)], pre=["social_policy"], avail=CASH(1))
f("education_reform", "The new Ukrainian school", "A twelve-year school with new curricula.", 55, 1,
  [MOD("education_quality", 0.04, 3650), IG("youth_students", 3)], pre=["social_policy"])
f("digital_state", "A state in a smartphone", "Public services online, from documents to permits.", 54, 2,
  [BUILD("data_centre", 1, KYIV), MOD("tax_efficiency", 0.03, 3650), MOD("corruption", -0.02, 3650)], pre=["health_reform|education_reform"], avail=AFTER("2015-01-01"))
f("research_institutes", "Research institutes", "Fund the academy's institutes and the universities.", 56, 2,
  [SPIRIT("science_drive"), RB("industry_energy", 0.2, 1)], pre=["education_reform"])
f("veterans_care", "Care for veterans", "Rehabilitation, housing and jobs for veterans.", 53, 3,
  [STAB(0.02), IG("military", 4), TREAS(-1)], pre=["health_reform"], avail=AFTER("2015-01-01"))
f("displaced_people", "Help for the displaced", "Housing and work for people who fled the war zones.", 55, 3,
  [STAB(0.02), {"add_unrest": -0.02}, TREAS(-1)], pre=["digital_state|research_institutes"], avail=ANY(WAR, AFTER("2014-06-01")))

tree = {
    "id": "ukr",
    "name": "Ukraine",
    "countries": ["UKR"],
    "note": "Ukraine, in the style of the Russian model tree: economy, energy, military, war, foreign policy and society branches build, fix Ukraine's sourced starting spirits (data/spirits/ukr.json), unlock decisions (data/decisions/ukr.json), claim the occupied regions and grant research. The political branch has the historical path (between East and West, then the reforms after 2014) and six mutually exclusive alternatives: an eastern course (the Party of Regions), liberal, left, national, ultranationalist (needs a party of the fascist group, which Ukraine does not have in the data) and a military junta. Each alternative brings to power only a real party of the data. Alternatives are a counterfactual, not a claim about the parties. Policies named after real reforms are cited; effects are gameplay estimates. Wars stay in data/events/conflicts.json; no focus declares one.",
    "source": [{"url": "https://en.wikipedia.org/wiki/" + t.replace(" ", "_"), "title": "Wikipedia: " + t, "accessed": "2026-10-19"} for t in [
        "Orange Revolution", "Constitution of Ukraine", "Kharkiv Pact", "Euromaidan", "Ukraine–European Union Association Agreement",
        "2008 Bucharest summit", "Decentralization in Ukraine", "National Anti-Corruption Bureau of Ukraine", "Prozorro", "National Police of Ukraine",
        "Minsk agreements", "Territorial Defense Forces (Ukraine)", "Ukraine–European Union relations", "Annexation of Crimea by the Russian Federation", "War in Donbas",
        "Economy of Ukraine", "Russia–Ukraine gas disputes", "Communist Party of Ukraine", "Party of Regions", "People's Movement of Ukraine", "Svoboda (political party)", "Servant of the People (political party)"]],
    "confidence": "verified",
    "focuses": F,
}
ids = [x["id"] for x in F]
assert len(ids) == len(set(ids))
pos = [(x["x"], x["y"]) for x in F]
assert len(pos) == len(set(pos)), [p for p in pos if pos.count(p) > 1]
json.dump(tree, open("data/focus_trees/ukr.json", "w", encoding="utf8", newline="\n"), indent=2, ensure_ascii=False)
open("data/focus_trees/ukr.json", "a", encoding="utf8", newline="\n").write("\n")
idset = set(x["id"] for x in F)
for x in F:
    for g in x.get("prerequisites", []):
        for p in g: assert p in idset, (x["id"], p)
    for m in x.get("mutually_exclusive", []): assert m in idset, (x["id"], m)
print(len(F), "focuses")
