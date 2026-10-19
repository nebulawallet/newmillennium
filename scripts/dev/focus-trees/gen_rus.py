"""Generates data/focus_trees/rus.json: the Russia model tree (FOCUS_TREES_PLAN.md; user feedback of 19 Oct 2026:
focuses must build, fix national problems, claim, unlock and fight, not only move politics). Run from the repo root."""
import json

F = []
def f(id, name, desc, x, y, effects, pre=None, excl=None, avail=None, days=70, ai=1):
    d = {"id": "rus_" + id, "name": name, "description": desc, "x": x, "y": y, "days": days}
    if pre: d["prerequisites"] = [["rus_" + p for p in g.split("|")] for g in pre]
    if excl: d["mutually_exclusive"] = ["rus_" + e for e in excl]
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
SPIRIT = lambda s: {"add_spirit": "rus_" + s if not s.startswith("@") else s[1:]}
REMOVE = lambda s: {"remove_spirit": "rus_" + s if not s.startswith("@") else s[1:]}
SWAP = lambda a, b: {"swap_spirit": {"from": "rus_" + a, "to": "rus_" + b}}
TREAS = lambda v: {"add_treasury": v}
RB = lambda cat, v=0.25, uses=2: {"add_research_bonus": {"category": cat, "value": v, "uses": uses}}
EQUIP = lambda n: {"add_equipment": {"family": "infantry_equipment", "amount": n}}
DIVS = lambda t, n: {"add_divisions": {"template": t, "count": n}}
def BUILD(b, n, *adm1):
    d = {"building": b, "count": n}
    if adm1: d["regions"] = [{"from": "RUS", "adm1": list(adm1)}]
    return {"add_buildings": d}
def CLAIM(tag, *adm1): return {"add_claim": {"regions": [{"from": tag, "adm1": list(adm1)}]}}
AFTER = lambda d: {"date_after": d}
BEFORE = lambda d: {"date_before": d}
ALL = lambda *a: {"all": list(a)}
ANY = lambda *a: {"any": list(a)}
NOT = lambda a: {"not": a}
HAS = lambda s: {"has_spirit": "rus_" + s}
CASH = lambda v: {"treasury_above": v}
PUTIN = {"holds_office": {"person": "rus.vladimir_putin", "office": "rus.president"}}
MEDVEDEV = {"holds_office": {"person": "rus.dmitry_medvedev", "office": "rus.president"}}
ALT = ANY({"follows_history": False}, {"is_player": True})
HIST = ANY({"ruling_party": "rus.unity"}, {"ruling_party": "rus.united_russia"}, PUTIN, MEDVEDEV)
WEST = ["USA", "DEU", "FRA", "GBR"]

# regions (map adm1 codes)
MOSCOW, MOSCOW_OBL, SPB = "RUS-2365", "RUS-2364", "RUS-2337"
KHMAO, TYUMEN, YAMAL_LIKE = "RUS-2396", "RUS-2398", "RUS-2396"
URALS = ["RUS-2379", "RUS-2386", "RUS-3200"]           # Chelyabinsk, Sverdlovsk, Perm
VOLGA = ["RUS-2392", "RUS-2394", "RUS-2357"]           # Samara, Tatarstan, Nizhny Novgorod
SIBERIA = ["RUS-2403", "RUS-2603", "RUS-2602", "RUS-2397"]  # Novosibirsk, Krasnoyarsk, Irkutsk, Omsk
FAR_EAST = ["RUS-2611", "RUS-2614", "RUS-2609"]        # Primorye, Khabarovsk, Amur
SOUTH = ["RUS-2367", "RUS-2371", "RUS-2369"]           # Rostov, Krasnodar, Volgograd
ARCTIC = ["RUS-2333", "RUS-2354"]                      # Murmansk, Arkhangelsk
CHECHNYA, DAGESTAN = "RUS-2416", "RUS-2417"
KALININGRAD, SAKHALIN = "RUS-2324", "RUS-2616"
CRIMEA = ["RUS-283", "RUS-5482"]
DONBAS = ["UKR-327", "UKR-329"]
NORTH_KAZ = ["KAZ-3204", "KAZ-3205", "KAZ-3206"]

alts = ["liberal_opening", "red_restoration", "national_revival", "ultranationalist_turn", "army_steps_in"]
def excl(me): return [s for s in ["power_vertical"] + alts if s != me]

# ============================================================ politics (x 0-17)
f("federal_centre", "Strengthen the federal centre", "Reassert federal authority over the regions and the budget.", 9, 0, [PP(50), STAB(0.02)], ai=5)

# ---- historical path (x 0-3)
f("power_vertical", "The power vertical", "Build a chain of command from the Kremlin through the federal districts and the regions. This is the path Russia took.", 1, 1,
  [SPIRIT("power_vertical"), IG("security_services", 4)], pre=["federal_centre"], excl=excl("power_vertical"), avail=HIST, ai=20)
f("federal_districts", "Federal districts", "Group the federal subjects into federal districts, each with a presidential envoy. Created by decree on 13 May 2000.", 0, 2,
  [STAB(0.03), {"add_unrest": -0.03}, IG("minorities", -3), IG("security_services", 3)], pre=["power_vertical"], avail=PUTIN, ai=5)
f("party_of_power", "Party of power", "Rally the deputies and regional leaders of the governing party behind the government.", 2, 2,
  [{"add_ruling_party_popularity": 0.03}, PP(30)], pre=["power_vertical"], avail=ANY({"ruling_party": "rus.united_russia"}, {"ruling_party": "rus.unity"}), ai=4)
f("harmonise_regional_law", "One law for all regions", "Bring regional constitutions and laws into line with federal law.", 0, 3,
  [STAB(0.02), PP(30), IG("minorities", -3)], pre=["federal_districts"], ai=3)
f("appointed_governors", "Appointed governors", "Regional governors are appointed by regional legislatures on the President's recommendation instead of being elected directly, as from 2005 to 2012.", 1, 4,
  [PP(50), STAB(0.03), IG("minorities", -4), {"add_unrest": 0.01}], pre=["harmonise_regional_law|party_of_power"], avail=ALL(PUTIN, AFTER("2004-09-01")), ai=4)
f("dominant_party", "A dominant party", "The governing party holds a large majority in the Duma and in the regional legislatures.", 2, 3,
  [{"add_ruling_party_popularity": 0.03}, MOD("political_power_gain", 0.1)], pre=["party_of_power"], avail=ALL(HIST, AFTER("2003-12-07")), ai=4)
f("national_projects", "Priority national projects", "Spend oil revenue on four national projects: health, education, housing and agriculture, set out in September 2005. Unlocks yearly funding rounds.", 3, 4,
  [MOD("health_outcomes", 0.03), MOD("education_quality", 0.03), IG("rural", 4), IG("urban_middle_class", 3), BUILD("infrastructure", 2)], pre=["dominant_party"], avail=ALL(HIST, AFTER("2005-09-05")), ai=4)
f("six_year_term", "Six-year presidential term", "Amend the constitution to lengthen the presidential term from four to six years and the Duma's from four to five. The amendment came into force on 31 December 2008.", 0, 5,
  [PP(60), MOD("incumbent_advantage", 0.05, 2190)], pre=["appointed_governors"], avail=ALL(HIST, AFTER("2008-11-05")), ai=4)
f("governor_elections", "Governors elected again", "Restore direct elections of regional governors, in force from 1 June 2012.", 2, 5,
  [IG("minorities", 4), IG("urban_middle_class", 3), STAB(0.02)], pre=["appointed_governors|national_projects"], avail=ALL(HIST, AFTER("2012-06-01")), ai=4)
f("foreign_agents_law", "Foreign agents law", "Require organisations that receive foreign funding and engage in political activity to register as foreign agents, as a 2012 law did.", 0, 6,
  [MOD("foreign_influence_resistance", 0.15, 2920), IG("media", -5), IG("urban_middle_class", -3), IG("security_services", 4)], pre=["six_year_term|governor_elections"], avail=ALL(HIST, AFTER("2012-07-01")), ai=4)
f("managed_pluralism", "Managed pluralism", "Several parties sit in the Duma while the governing party keeps control of the agenda.", 2, 6,
  [PP(40), MOD("stability_factor", 0.03, 1825)], pre=["six_year_term|governor_elections"], avail=HIST, ai=3)
f("constitution_2020", "2020 constitutional amendments", "A package of constitutional amendments approved in a nationwide vote ending on 1 July 2020.", 1, 7,
  [PP(80), STAB(0.03), MOD("incumbent_advantage", 0.05, 2190), IG("religious_establishment", 4)], pre=["foreign_agents_law", "managed_pluralism"], avail=ALL(HIST, AFTER("2020-01-15")), ai=4)
f("state_media_consensus", "A consensus in the national media", "The main national broadcasters present the government's programme.", 3, 7,
  [MOD("propaganda_efficiency", 0.1, 1825), IG("media", -3)], pre=["managed_pluralism"], avail=HIST, ai=2)

# ---- liberal path (x 4-5)
f("liberal_opening", "Liberal opening", "Open the political system to real competition. The liberal parties (Yabloko, the Union of Right Forces, later New People) gain ground.", 4, 1,
  [{"leave_history": True}, GROUP("liberal_democratic", 0.03), IG("urban_middle_class", 5), IG("security_services", -5)],
  pre=["federal_centre"], excl=excl("liberal_opening"),
  avail=ALL(ALT, {"has_party_of_group": "liberal_democratic"}, ANY({"stability_below": 0.6}, {"ig_approval_below": {"group": "urban_middle_class", "value": 45}})), ai=0.3)
f("independent_media", "Independent media", "Return the national broadcasters to independent owners and end pressure on the press.", 4, 2,
  [LAW("press_freedom", "regulated_press"), IG("media", 10), GROUP("liberal_democratic", 0.03), MOD("propaganda_efficiency", -0.1)], pre=["liberal_opening"])
f("round_table", "Round table with the opposition", "Negotiate the rules of a democratic transition with the opposition parties.", 5, 2,
  [GROUP("liberal_democratic", 0.04), {"add_ruling_party_popularity": -0.04}, PP(40)], pre=["liberal_opening"])
f("democratic_transition", "Democratic transition", "The most popular liberal party forms a government and calls free elections.", 4, 3,
  [{"install_government": {"ideology": "liberal_democratic", "government_type": "semi_presidential"}}, LAW("political_freedom", "free_elections"), STAB(-0.05)],
  pre=["independent_media", "round_table"], avail={"ideology_group_support_above": {"group": "liberal_democratic", "value": 0.15}}, days=105)
f("independent_courts", "Independent courts", "Guarantee judicial independence and full civil liberties.", 4, 4,
  [LAW("civil_rights", "full_civil_liberties"), IG("security_services", -8), IG("business", 4), MOD("corruption", -0.05, 2920)], pre=["democratic_transition"])
f("real_federalism", "Real federalism", "Give the regions back their elected governors and their own budgets.", 5, 4,
  [IG("minorities", 8), {"add_unrest": -0.03}, PP(-30)], pre=["democratic_transition"])
f("open_markets", "Open markets", "Lower tariffs and invite foreign investment.", 4, 5,
  [LAW("trade", "free_trade"), MOD("foreign_investment", 0.15, 2920), IG("business", 6), IG("labour_unions", -4)], pre=["independent_courts"])
f("european_course", "A European course", "Seek close relations with the European Union and the United States.", 5, 5,
  [*[OPN(t, 25) for t in WEST], IG("military", -5)], pre=["real_federalism"])
f("open_society", "An open society", "Courts, press and elections that hold the government to account.", 4, 6,
  [SPIRIT("open_society"), REMOVE("power_vertical")], pre=["open_markets", "european_course"])

# ---- communist path (x 6-8)
f("red_restoration", "Red restoration", "Hard times turn voters toward the Communist Party of the Russian Federation and its programme of public ownership and social guarantees.", 7, 1,
  [{"leave_history": True}, GROUP("socialist_communist", 0.04), IG("labour_unions", 5), IG("business", -5)],
  pre=["federal_centre"], excl=excl("red_restoration"),
  avail=ALL(ALT, {"has_party_of_group": "socialist_communist"}, ANY({"gdp_growth_below": 2}, {"unrest_above": 0.2}, {"ig_approval_below": {"group": "labour_unions", "value": 40}})), ai=0.3)
f("workers_committees", "Workers' committees", "Organise committees in the factories and the trade unions behind the party.", 6, 2,
  [GROUP("socialist_communist", 0.04), IGI("labour_unions", 0.05)], pre=["red_restoration"])
f("rural_soviets", "Support in the countryside", "Win over collective farm workers and pensioners in the regions.", 8, 2,
  [GROUP("socialist_communist", 0.03), IG("rural", 5)], pre=["red_restoration"])
f("red_government", "A government of the left", "The Communist Party of the Russian Federation takes power and rules as the single governing party.", 7, 3,
  [{"install_government": {"ideology": "socialist_communist", "government_type": "one_party_state"}}, LAW("political_freedom", "single_party_elections"), STAB(-0.05)],
  pre=["workers_committees", "rural_soviets"], avail={"ideology_group_support_above": {"group": "socialist_communist", "value": 0.25}}, days=105)
f("cprf_nationalisation", "Nationalise natural resources", "Bring natural resources and large industries into public ownership, a stated goal of the Communist Party of the Russian Federation.", 6, 4,
  [LAW("economic_system", "state_capitalism"), IG("labour_unions", 8), IG("business", -10), SPIRIT("state_champions"), TREAS(10)], pre=["red_government"], avail={"ruling_party": "rus.cprf"}, ai=3)
f("cprf_agriculture", "Public ownership in agriculture", "Bring large farms into public ownership, part of the programme of the party.", 8, 4,
  [IG("rural", 6), IG("business", -3), MOD("gdp_growth", 0.002, 1825)], pre=["red_government"], avail={"ruling_party": "rus.cprf"}, ai=2)
f("social_guarantees", "Social guarantees", "A national health service and guaranteed pensions paid from resource revenue.", 6, 5,
  [LAW("healthcare", "national_health_service"), {"set_budget": {"spending": 2}}, IG("labour_unions", 5)], pre=["cprf_nationalisation"])
f("planned_economy", "State planning", "Direct investment through state plans for heavy industry and defence.", 8, 5,
  [LAW("economic_system", "command_economy"), SPIRIT("planned_economy"), BUILD("military_factory", 3, *URALS), BUILD("civilian_factory", 2, *VOLGA), IG("business", -8)], pre=["cprf_agriculture"])
f("union_state", "Deepen the Union State", "Draw closer to Belarus within the Union State and to the other former Soviet republics.", 7, 6,
  [OPN("BLR", 30), OPN("KAZ", 10), *[OPN(t, -15) for t in WEST]], pre=["social_guarantees|planned_economy"])
f("union_reunification", "Reunite with Belarus", "If Belarus agrees, the two states merge into one.", 7, 7,
  [{"country": {"tag": "BLR", "limit": {"opinion_of_above": {"target": "RUS", "value": 60}}, "effects": [{"dissolve_country": {"into": "RUS"}}]}}, PP(50)],
  pre=["union_state"], avail={"country": {"tag": "BLR", "trigger": {"opinion_of_above": {"target": "RUS", "value": 60}}}}, days=140)

# ---- national-populist path (x 9-11): Rodina (2003-2006)
f("national_revival", "National revival", "Nationalist parties such as Rodina gain from a mood of national grievance.", 10, 1,
  [{"leave_history": True}, GROUP("nationalist_populist", 0.04), WS(0.03), IG("military", 3), IG("minorities", -5)],
  pre=["federal_centre"], excl=excl("national_revival"),
  avail=ALL(ALT, {"has_party_of_group": "nationalist_populist"}, ANY({"stability_below": 0.5}, {"war_support_above": 0.5})), ai=0.3)
f("patriotic_rallies", "Patriotic rallies", "Mass rallies around national symbols and grievances.", 9, 2,
  [GROUP("nationalist_populist", 0.04), WS(0.03)], pre=["national_revival"])
f("against_the_oligarchs", "Against the oligarchs", "Campaign against the business owners who grew rich in the 1990s.", 11, 2,
  [GROUP("nationalist_populist", 0.03), IG("business", -6), IG("labour_unions", 3), TREAS(5)], pre=["national_revival"])
f("nationalist_government", "A nationalist government", "The most popular nationalist party forms the government.", 10, 3,
  [{"install_government": {"ideology": "nationalist_populist", "government_type": "hybrid_authoritarian"}}, STAB(-0.05)],
  pre=["patriotic_rallies", "against_the_oligarchs"], avail={"ideology_group_support_above": {"group": "nationalist_populist", "value": 0.2}}, days=105)
f("compatriots_abroad", "Compatriots abroad", "Make the Russian-speaking population of the neighbouring states a priority of foreign policy, and claim Crimea.", 9, 4,
  [WS(0.05), CLAIM("UKR", *CRIMEA), OPN("UKR", -20), MOD("foreign_influence_power", 0.1, 2920)], pre=["nationalist_government"])
f("border_control", "Control the borders", "Restrict immigration from Central Asia and the Caucasus.", 11, 4,
  [LAW("immigration", "restrictive_immigration"), IG("minorities", -8), IG("rural", 3)], pre=["nationalist_government"])
f("great_power_army", "An army for a great power", "Raise defence spending, lengthen service and raise new divisions.", 9, 5,
  [LAW("conscription", "extended_service"), DIVS("motorised_division", 4), {"set_budget": {"spending": 1}}, IG("military", 6)], pre=["compatriots_abroad"])
f("break_with_west", "Break with the West", "Turn away from cooperation with the United States and the European Union.", 11, 5,
  [*[OPN(t, -25) for t in WEST], OPN("CHN", 10), MOD("foreign_influence_resistance", 0.1, 2920), SPIRIT("import_substitution")], pre=["border_control"])
f("crimean_question", "The Crimean question", "Press the claim on Crimea: a war goal against Ukraine.", 10, 6,
  [{"add_wargoal": {"target": "UKR", "type": "claim"}}, WS(0.05)], pre=["great_power_army", "break_with_west"], avail={"has_claim_on": "UKR"})

# ---- ultranationalist path (x 12-14): the LDPR
f("ultranationalist_turn", "Ultranationalist turn", "In a deep crisis, an ultranationalist party gains a mass following and seeks an authoritarian state. This is a counterfactual, not a claim about the party's aims.", 13, 1,
  [{"leave_history": True}, GROUP("fascist", 0.04), WS(0.05), IG("minorities", -8), IG("media", -5)],
  pre=["federal_centre"], excl=excl("ultranationalist_turn"),
  avail=ALL(ALT, {"has_party_of_group": "fascist"}, {"stability_below": 0.4}, {"war_support_above": 0.4}), ai=0.1)
f("street_movement", "A street movement", "Uniformed marches and rallies spread the movement in the cities.", 12, 2,
  [GROUP("fascist", 0.05), {"add_unrest": 0.05}], pre=["ultranationalist_turn"])
f("security_sympathies", "Sympathy in the security services", "Officers in the army and the security services side with the movement.", 14, 2,
  [GROUP("fascist", 0.03), IG("security_services", 5), IG("military", 5)], pre=["ultranationalist_turn"])
f("ultranationalist_seizure", "Seizure of power", "The ultranationalist party takes power, abolishes elections and rules as the only party.", 13, 3,
  [{"install_government": {"ideology": "fascist", "government_type": "one_party_state"}}, STAB(-0.08), WS(0.05)],
  pre=["street_movement", "security_sympathies"], avail={"ideology_group_support_above": {"group": "fascist", "value": 0.2}}, days=105)
f("total_control", "Total control of the press", "All media come under state control and opposition parties are banned from the airwaves.", 12, 4,
  [LAW("press_freedom", "total_censorship"), LAW("civil_rights", "police_state"), MOD("internal_security", 0.15, 2920), IG("media", -15)], pre=["ultranationalist_seizure"])
f("national_mobilisation", "National mobilisation", "Universal military training, a war economy and new divisions.", 14, 4,
  [SPIRIT("mobilised_nation"), SPIRIT("@war_economy"), DIVS("infantry_division", 6), EQUIP(3000)], pre=["ultranationalist_seizure"])
f("revanchist_doctrine", "Revanchist doctrine", "A doctrine that treats the former Soviet borders as Russia's sphere: claims on Crimea, the Donbas and northern Kazakhstan. The neighbours and the West regard Russia as a threat.", 13, 5,
  [CLAIM("UKR", *CRIMEA, *DONBAS), CLAIM("KAZ", *NORTH_KAZ), *[OPN(t, -40) for t in WEST], {"every_neighbor": {"effects": [{"add_opinion": {"target": "ROOT", "value": -30, "days": 1825}}]}}, WS(0.05)],
  pre=["total_control|national_mobilisation"])
f("war_for_the_lost_lands", "War for the lost lands", "Go to war with Ukraine for the claimed regions.", 12, 6,
  [{"declare_war": {"target": "UKR", "goal": "limited", "zone": [{"from": "UKR", "adm1": CRIMEA + DONBAS}]}}], pre=["revanchist_doctrine"],
  avail=ALL({"has_claim_on": "UKR"}, {"at_war": False}), days=35, ai=0.5)
f("steppe_claims", "Pressure on Kazakhstan", "A war goal against Kazakhstan over its northern regions.", 14, 6,
  [{"add_wargoal": {"target": "KAZ", "type": "claim"}}, OPN("KAZ", -30)], pre=["revanchist_doctrine"], avail={"has_claim_on": "KAZ"})

# ---- military junta (x 15-17)
f("army_steps_in", "The army steps in", "With the state in crisis, the generals prepare to take over.", 16, 1,
  [{"leave_history": True}, IGI("military", 0.08), IG("military", 5)],
  pre=["federal_centre"], excl=excl("army_steps_in"),
  avail=ALL(ALT, {"stability_below": 0.3}, ANY({"unrest_above": 0.4}, {"ig_approval_below": {"group": "military", "value": 35}})), ai=0.2)
f("military_council", "Military council", "The armed forces remove the government. The coup may fail.", 16, 2,
  [{"trigger_coup": {"by": "military", "success_chance": 0.65}}], pre=["army_steps_in"], days=35)
f("martial_order", "Martial order", "A state of emergency, a curfew and military courts.", 15, 3,
  [LAW("civil_rights", "security_state"), MOD("internal_security", 0.1), {"add_unrest": -0.08}, IG("youth_students", -6)], pre=["military_council"], avail={"government_type": "military_junta"})
f("officers_government", "A government of officers", "Officers take the ministries; the defence budget comes first.", 17, 3,
  [{"set_budget": {"spending": 1}}, SPIRIT("rearmament"), BUILD("military_factory", 2, *URALS), IG("military", 6), IG("business", -4)], pre=["military_council"], avail={"government_type": "military_junta"})
f("return_to_barracks", "Return to the barracks", "The council hands power to an elected government.", 16, 4,
  [{"set_government_type": "semi_presidential"}, LAW("political_freedom", "free_elections"), {"hold_election": {"kind": "presidential"}}, STAB(0.05), IGI("military", -0.08)],
  pre=["martial_order|officers_government"], avail={"government_type": "military_junta"}, days=140, ai=0.5)

# ============================================================ economy and finance (x 19-24)
f("economic_recovery", "Economic recovery", "Rebuild the state's finances after the 1998 crisis.", 21, 0, [PP(30), {"add_economic_mood": 0.03}], ai=5)
f("debt_restructuring", "Restructure the debt", "Agree new terms with creditors for the debt left by the 1998 default.", 19, 1,
  [SWAP("crisis_1998", "crisis_recovery"), PP(-20)], pre=["economic_recovery"], avail=HAS("crisis_1998"), ai=4)
f("flat_tax", "13 percent flat income tax", "Replace the progressive income tax with a single 13 percent rate, introduced in 2001.", 21, 1,
  [SPIRIT("flat_tax"), IG("business", 6)], pre=["economic_recovery"], avail=HIST, ai=4)
f("bank_recapitalisation", "Recapitalise the banks", "Close insolvent banks and recapitalise the sound ones.", 23, 1,
  [TREAS(-3), MOD("interest_rate", -0.005, 1825), IG("business", 3)], pre=["economic_recovery"], avail=CASH(3))
f("repay_foreign_debt", "Repay the foreign debt early", "Use oil revenue to pay off the debt to foreign creditors ahead of schedule.", 19, 2,
  [TREAS(-15), REMOVE("crisis_recovery"), MOD("foreign_investment", 0.05, 2920)], pre=["debt_restructuring", "stabilization_fund"], avail=ALL(HAS("crisis_recovery"), CASH(16)), ai=4)
f("tax_collection", "A single tax service", "One federal tax service and fewer exemptions.", 21, 2,
  [MOD("tax_efficiency", 0.04, 2920), MOD("corruption", -0.02, 2920), IG("business", -2)], pre=["flat_tax"])
f("stabilization_fund", "Stabilization fund", "Save part of the oil revenue in a fund that balances the budget when prices fall. The real fund was established on 1 January 2004.", 23, 2,
  [SPIRIT("stabilization_fund"), TREAS(5)], pre=["bank_recapitalisation|flat_tax"], ai=3)
f("sovereign_funds", "Reserve Fund and National Welfare Fund", "Split the stabilization fund into a Reserve Fund for the budget and a National Welfare Fund for pensions, as Russia did in February 2008.", 23, 3,
  [SWAP("stabilization_fund", "sovereign_funds"), TREAS(15)], pre=["stabilization_fund"], avail=ALL(AFTER("2008-02-01"), HAS("stabilization_fund")), ai=3)
f("central_bank_targeting", "Inflation targeting", "The central bank targets inflation and lets the ruble float.", 21, 3,
  [MOD("inflation", -0.02, 2920), MOD("interest_rate", -0.005, 2920)], pre=["tax_collection"])
f("special_economic_zones", "Special economic zones", "Tax breaks and simpler customs for investors in chosen regions.", 19, 3,
  [SPIRIT("special_economic_zones"), BUILD("civilian_factory", 1, "RUS-2394"), BUILD("civilian_factory", 1, KALININGRAD)], pre=["repay_foreign_debt|tax_collection"])
f("financial_centre", "A financial centre in Moscow", "Make Moscow a regional financial centre.", 19, 4,
  [MOD("foreign_investment", 0.05, 2920), MOD("trade_efficiency", 0.02, 2920), BUILD("data_centre", 1, MOSCOW)], pre=["special_economic_zones"])
f("pension_reform", "Pension reform", "Raise the retirement age step by step to keep the pension system solvent.", 21, 4,
  [MOD("welfare_cost", -0.005, 3650), IG("labour_unions", -6), {"add_ruling_party_popularity": -0.02}, STAB(-0.02)], pre=["central_bank_targeting"])
f("national_payment_system", "A national payment system", "A domestic card network and payment system.", 23, 4,
  [MOD("foreign_influence_resistance", 0.05, 3650), BUILD("data_centre", 1, MOSCOW_OBL)], pre=["sovereign_funds|central_bank_targeting"])
f("import_substitution", "Import substitution", "Replace imported goods with domestic production behind trade barriers.", 22, 5,
  [SPIRIT("import_substitution"), BUILD("civilian_factory", 2, *VOLGA)], pre=["national_payment_system|pension_reform"])
f("diversification", "Economic diversification", "Reduce the economy's dependence on oil and gas.", 20, 5,
  [MOD("gdp_growth", 0.004, 2920), MOD("private_sector_output", 0.05, 2920), BUILD("civilian_factory", 2)], pre=["financial_centre|pension_reform"])

# ============================================================ energy, industry and infrastructure (x 25-31)
f("industrial_base", "Rebuild the industrial base", "Bring the factories of the Soviet era back to work.", 28, 0, [PP(20), BUILD("civilian_factory", 1)], ai=5)
f("energy_exports", "Energy exports", "Expand oil and gas production in Western Siberia.", 25, 1,
  [BUILD("refinery", 2, KHMAO, TYUMEN), MOD("fossil_output", 0.05, 2920)], pre=["industrial_base"], ai=3)
f("modernise_soviet_industry", "Modernise Soviet-era industry", "Replace worn-out machinery in the old industrial cities.", 28, 1,
  [TREAS(-3), BUILD("civilian_factory", 2, *URALS), MOD("production_efficiency", 0.02, 2920)], pre=["industrial_base"], avail=CASH(3), ai=3)
f("roads_and_rail", "Roads and railways", "A federal programme for roads and railways. Unlocks a yearly regional road programme.", 30, 1,
  [BUILD("infrastructure", 3), MOD("construction_speed", 0.05, 2920)], pre=["industrial_base"], ai=3)
f("state_energy_majors", "State energy majors", "Bring the largest oil and gas producers under state ownership.", 25, 2,
  [SPIRIT("state_champions"), IG("business", -3), IG("security_services", 3)], pre=["energy_exports"], ai=2)
f("rosneft_expansion", "Expansion of Rosneft", "The state oil company Rosneft acquires Yuganskneftegaz, the main production unit of Yukos, sold at auction in December 2004.", 25, 3,
  [BUILD("refinery", 1, KHMAO), TREAS(5), IG("business", -4)], pre=["state_energy_majors"], avail=ALL(HIST, AFTER("2004-12-22")), ai=3)
f("pipelines", "New export pipelines", "Pipelines to Europe and to Asia that diversify export routes. Unlocks pipeline projects.", 26, 3,
  [MOD("trade_efficiency", 0.05, 2920), BUILD("infrastructure", 1, TYUMEN)], pre=["state_energy_majors"])
f("automotive_industry", "Automotive industry", "Joint ventures with foreign car makers in the Volga region.", 27, 2,
  [BUILD("civilian_factory", 2, "RUS-2392", "RUS-2394"), MOD("foreign_investment", 0.03, 2920)], pre=["modernise_soviet_industry"])
f("metallurgy", "Steel and metals", "Modernise the steel works and smelters of the Urals and Siberia.", 29, 2,
  [BUILD("civilian_factory", 1, "RUS-2379"), BUILD("civilian_factory", 1, "RUS-2603"), MOD("private_sector_output", 0.03, 2920)], pre=["modernise_soviet_industry"])
f("trans_siberian", "Upgrade the Trans-Siberian railway", "Double tracks and electrify the line across Siberia.", 31, 2,
  [BUILD("infrastructure", 4, *SIBERIA), MOD("trade_efficiency", 0.02, 2920)], pre=["roads_and_rail"])
f("aviation_industry", "Aviation industry", "Merge the aircraft makers into one corporation and build a new airliner.", 28, 3,
  [BUILD("military_factory", 1, "RUS-2392"), BUILD("civilian_factory", 1, MOSCOW_OBL), RB("air_drones", 0.2, 2)], pre=["automotive_industry|metallurgy"])
f("far_east", "Develop the Far East", "Ports, plants and roads in Primorye, Khabarovsk and Amur. Unlocks a Far East investment programme.", 30, 3,
  [BUILD("civilian_factory", 2, *FAR_EAST), BUILD("infrastructure", 2, *FAR_EAST), BUILD("port", 1, "RUS-2611")], pre=["trans_siberian"])
f("nuclear_power", "Nuclear power", "Build new reactors at home and for export.", 26, 4,
  [MOD("nuclear_output", 0.1, 3650), MOD("energy_cost", -0.03, 3650), RB("industry_energy", 0.2, 2)], pre=["pipelines|rosneft_expansion"])
f("shipbuilding", "Shipbuilding", "Modernise the shipyards of St Petersburg and the Far East.", 28, 4,
  [BUILD("military_factory", 1, SPB), BUILD("port", 1, SPB), RB("naval", 0.2, 2)], pre=["aviation_industry"])
f("sakhalin_projects", "Sakhalin oil and gas", "Offshore oil and gas around Sakhalin with liquefied gas for Asia.", 30, 4,
  [BUILD("refinery", 1, SAKHALIN), BUILD("port", 1, SAKHALIN), MOD("fossil_output", 0.04, 2920)], pre=["far_east"])
f("arctic_development", "Arctic development", "Develop Arctic oil, gas and shipping along the northern sea route.", 27, 5,
  [BUILD("port", 1, ARCTIC[0]), BUILD("infrastructure", 2, *ARCTIC), MOD("fossil_output", 0.04, 3650)], pre=["nuclear_power|shipbuilding"])
f("power_grid", "A national power grid", "New power lines and plants for the growing cities.", 29, 5,
  [MOD("energy_cost", -0.04, 3650), BUILD("renewable_plant", 1, "RUS-2602"), BUILD("infrastructure", 1)], pre=["shipbuilding|sakhalin_projects"])
f("modern_industry", "Modernised industry", "The last of the Soviet-era plants are rebuilt or closed.", 28, 6,
  [SWAP("soviet_industry", "modern_industry"), BUILD("civilian_factory", 2)], pre=["arctic_development|power_grid", "diversification|import_substitution"], avail=HAS("soviet_industry"), days=105, ai=3)
f("agricultural_revival", "Agricultural revival", "Credit and subsidies for farms; Russia becomes a large grain exporter.", 31, 5,
  [IG("rural", 6), MOD("gdp_growth", 0.002, 2920), MOD("trade_efficiency", 0.02, 2920)], pre=["power_grid"])

# ============================================================ military (x 33-39)
f("military_reform", "Military reform", "Reorganise the armed forces and their command.", 36, 0, [MOD("army_org", 0.03), IG("military", 4)], ai=4)
f("chechnya", "Counter-terrorism in Chechnya", "Federal forces fight the insurgency in Chechnya. Unlocks counter-terrorism operations.", 33, 1,
  [MOD("internal_security", 0.05, 1825), IG("security_services", 4), IG("minorities", -3)], pre=["military_reform"], ai=4)
f("chechen_administration", "A pro-federal administration in Chechnya", "Hand the running of Chechnya to a local administration loyal to Moscow.", 33, 2,
  [SWAP("chechen_war", "north_caucasus_insurgency"), STAB(0.02)], pre=["chechnya"], avail=ALL(HAS("chechen_war"), AFTER("2003-01-01")), ai=4)
f("chechnya_reconstruction", "Rebuild Grozny", "Federal funds for the reconstruction of Chechnya after the counter-terrorism operation ended in April 2009.", 33, 3,
  [TREAS(-3), BUILD("infrastructure", 2, CHECHNYA), BUILD("civilian_factory", 1, CHECHNYA), {"add_unrest": -0.03}, IG("minorities", 4)], pre=["chechen_administration"], avail=ALL(AFTER("2009-05-01"), CASH(3)), ai=3)
f("caucasus_development", "Develop the North Caucasus", "Jobs, roads and resorts to end the insurgency's recruitment.", 33, 4,
  [REMOVE("north_caucasus_insurgency"), BUILD("infrastructure", 1, DAGESTAN), BUILD("civilian_factory", 1, DAGESTAN)], pre=["chechnya_reconstruction"], avail=ALL(HAS("north_caucasus_insurgency"), CASH(2), AFTER("2011-01-01")), days=105, ai=3)
f("contract_service", "Contract service", "Expand contract soldiers alongside conscripts.", 35, 1,
  [SPIRIT("contract_army"), IG("youth_students", 3)], pre=["military_reform"])
f("strategic_forces", "Strategic forces", "Maintain and modernise strategic forces.", 37, 1,
  [WS(0.02), RB("artillery_missiles", 0.2, 2), IG("military", 3)], pre=["military_reform"])
f("air_force", "A new air force", "New fighters and helicopters, and modern air bases.", 39, 1,
  [BUILD("air_base", 2), RB("air_drones", 0.2, 2)], pre=["military_reform"])
f("new_look", "The 2008 reform", "Cut the officer corps and turn divisions into brigades, as the reform announced in October 2008 did.", 35, 2,
  [MOD("army_org", 0.04, 2920), MOD("training_time", -0.1, 2920), RB("doctrine", 0.25, 2), IG("military", -3)], pre=["contract_service"], avail=AFTER("2008-10-01"), ai=3)
f("missile_defence", "Air and missile defence", "New air-defence systems around the capital and the bases.", 37, 2,
  [MOD("army_defence", 0.03, 2920), RB("artillery_missiles", 0.2, 1)], pre=["strategic_forces"])
f("long_range_aviation", "Long-range aviation", "Modernise the strategic bombers and their bases.", 39, 2,
  [BUILD("air_base", 1, ARCTIC[0]), MOD("air_effectiveness", 0.03, 2920)], pre=["air_force"])
f("rearmament", "Rearmament programme", "A ten-year programme to replace Soviet-era equipment.", 35, 3,
  [SPIRIT("rearmament"), EQUIP(2000), BUILD("military_factory", 2, *URALS), TREAS(-4)], pre=["new_look"], avail=CASH(4))
f("defence_industry", "Defence industry", "Merge the defence plants into state corporations. Unlocks state defence orders.", 37, 3,
  [BUILD("military_factory", 2, "RUS-2368", "RUS-2357"), RB("armour", 0.2, 2)], pre=["new_look|missile_defence"])
f("navy", "Rebuild the navy", "New submarines and frigates for the Northern and Pacific fleets.", 39, 3,
  [BUILD("port", 1, "RUS-2611"), RB("naval", 0.25, 2), MOD("naval_effectiveness", 0.04, 2920)], pre=["long_range_aviation"])
f("airborne_forces", "Airborne and special forces", "Expand the airborne troops and special forces as a rapid-reaction force.", 34, 4,
  [DIVS("motorised_division", 2), MOD("army_attack", 0.02, 2920)], pre=["rearmament"])
f("armoured_forces", "New armoured vehicles", "A new generation of tanks and infantry fighting vehicles.", 36, 4,
  [RB("armour", 0.25, 2), EQUIP(1000)], pre=["rearmament|defence_industry"])
f("drones_and_electronic_warfare", "Drones and electronic warfare", "Reconnaissance drones and electronic warfare units.", 38, 4,
  [RB("air_drones", 0.25, 2), RB("electronics_cyber", 0.2, 1)], pre=["defence_industry|navy"])
f("readiness_exercises", "Snap readiness exercises", "Large unannounced exercises across the military districts. Unlocks exercises as a decision.", 35, 5,
  [MOD("army_org", 0.03, 1825), WS(0.02)], pre=["airborne_forces|armoured_forces"])
f("reserve_system", "A reserve system", "A trained reserve that can be mobilised quickly.", 37, 5,
  [MOD("manpower_factor", 0.04, 2920), DIVS("infantry_division", 2)], pre=["armoured_forces|drones_and_electronic_warfare"])
f("kaliningrad_garrison", "Garrison Kaliningrad", "Reinforce the exclave on the Baltic.", 39, 5,
  [BUILD("air_base", 1, KALININGRAD), BUILD("port", 1, KALININGRAD)], pre=["drones_and_electronic_warfare"])
f("arctic_brigades", "Arctic brigades", "Units and bases for the Arctic coast.", 36, 6,
  [BUILD("air_base", 1, ARCTIC[1]), MOD("army_defence", 0.02, 2920)], pre=["readiness_exercises|reserve_system"])

# ============================================================ foreign policy (x 41-47)
f("foreign_policy", "Foreign policy concept", "Set the priorities of Russian foreign policy for the new decade.", 44, 0, [PP(30), MOD("diplomatic_reputation", 0.05, 1825)], ai=4)
f("cis_integration", "The Commonwealth of Independent States", "Make the CIS the frame for relations with the former Soviet republics.", 41, 1,
  [MOD("bloc_integration", 0.05, 2920), OPN("BLR", 10), OPN("KAZ", 10)], pre=["foreign_policy"])
f("strategic_partnership_china", "Partnership with China", "Settle the remaining border questions and expand trade with China.", 43, 1,
  [OPN("CHN", 20), MOD("trade_efficiency", 0.02, 2920)], pre=["foreign_policy"])
f("partnership_europe", "Partnership with Europe", "Expand trade and energy ties with the European Union.", 45, 1,
  [OPN("DEU", 15), OPN("FRA", 15), MOD("foreign_investment", 0.05, 2920)], pre=["foreign_policy"])
f("cooperation_with_us", "Cooperation with the United States", "Work with the United States on terrorism and arms control.", 47, 1,
  [OPN("USA", 15), MOD("international_opinion", 5, 1825)], pre=["foreign_policy"])
f("csto", "Collective Security Treaty Organization", "Turn the Collective Security Treaty into a regional organisation with a charter, as its members did in 2002.", 41, 2,
  [MOD("bloc_integration", 0.05, 2920), OPN("ARM", 10), OPN("KAZ", 10), OPN("KGZ", 10), OPN("TJK", 10)], pre=["cis_integration"], avail=AFTER("2003-01-01"), ai=3)
f("union_state_belarus", "Union State with Belarus", "Deepen the Union State with Belarus: cheap gas for close ties.", 42, 2,
  [OPN("BLR", 25), TREAS(-1)], pre=["cis_integration"])
f("energy_diplomacy", "Energy diplomacy", "Long-term gas contracts as a tool of foreign policy.", 44, 2,
  [MOD("foreign_influence_power", 0.1, 2920), TREAS(5)], pre=["strategic_partnership_china|partnership_europe"])
f("arms_exports", "Arms exports", "Sell aircraft, air defences and tanks abroad.", 46, 2,
  [TREAS(4), MOD("foreign_influence_power", 0.05, 2920), BUILD("military_factory", 1)], pre=["partnership_europe|cooperation_with_us"])
f("eurasian_union", "Eurasian Economic Union", "A single market with Belarus and Kazakhstan, founded by treaty on 29 May 2014.", 41, 3,
  [MOD("trade_efficiency", 0.04, 3650), OPN("BLR", 15), OPN("KAZ", 15), OPN("ARM", 10), OPN("KGZ", 10)], pre=["csto|union_state_belarus"], avail=ALL(AFTER("2014-05-29"), HIST), ai=3)
f("security_council", "A voice in the Security Council", "Use the permanent seat on the UN Security Council to shape crises.", 43, 3,
  [MOD("diplomatic_reputation", 0.05, 2920), PP(40)], pre=["energy_diplomacy"])
f("visa_dialogue", "Visa dialogue with the EU", "Negotiate easier travel with the European Union.", 45, 3,
  [OPN("DEU", 10), OPN("FRA", 10), IG("urban_middle_class", 3), IG("youth_students", 3)], pre=["energy_diplomacy|arms_exports"])
f("middle_east_policy", "A Middle East policy", "Ties with Syria, Iran and the Gulf states.", 47, 3,
  [OPN("SYR", 20), OPN("IRN", 15), MOD("foreign_influence_power", 0.05, 2920)], pre=["arms_exports"])
f("central_asia", "Central Asia", "Bases, migrant labour and gas routes in Central Asia.", 41, 4,
  [OPN("UZB", 15), OPN("TJK", 10), MOD("foreign_influence_power", 0.05, 2920), BUILD("air_base", 1)], pre=["eurasian_union|csto"])
f("asian_pivot", "Turn to Asia", "Shift trade and pipelines toward China and the Pacific.", 43, 4,
  [OPN("CHN", 15), MOD("trade_efficiency", 0.03, 2920), BUILD("port", 1, "RUS-2611")], pre=["security_council"])
f("international_media", "International broadcasting", "State-funded broadcasting abroad in many languages.", 45, 4,
  [MOD("foreign_influence_power", 0.1, 2920), MOD("propaganda_efficiency", 0.05, 2920)], pre=["visa_dialogue|security_council"])
f("syria_alliance", "Alliance with Damascus", "Military advisers, a naval base at Tartus and arms for the Syrian government.", 47, 4,
  [OPN("SYR", 25), TREAS(-1), MOD("naval_effectiveness", 0.02, 2920)], pre=["middle_east_policy"])
f("sanctions_resilience", "Resilience to sanctions", "Reserves, domestic payments and new trade partners to withstand Western sanctions.", 42, 5,
  [MOD("foreign_influence_resistance", 0.1, 3650), MOD("trade_efficiency", 0.02, 3650), TREAS(3)], pre=["central_asia|asian_pivot"])
f("multipolar_world", "A multipolar world", "Present Russia as one of several centres of a multipolar world order.", 44, 5,
  [PP(50), MOD("diplomatic_reputation", 0.05, 3650), WS(0.02)], pre=["asian_pivot|international_media|syria_alliance"])
f("global_south", "Partners in the Global South", "Trade and arms deals with India, Africa and Latin America.", 46, 5,
  [OPN("IND", 15), TREAS(3), MOD("foreign_influence_power", 0.05, 2920)], pre=["international_media|syria_alliance"])

# ============================================================ society and science (x 49-54)
f("social_policy", "Social policy", "Set out the government's priorities for health, families and science.", 51, 0, [PP(20), IG("urban_middle_class", 2)], ai=4)
f("healthcare_modernisation", "Modernise healthcare", "New equipment for hospitals and clinics.", 49, 1,
  [TREAS(-2), MOD("health_outcomes", 0.04, 2920), BUILD("infrastructure", 1)], pre=["social_policy"], avail=CASH(2))
f("family_support", "Support for families", "Payments for families with a second child, housing help and longer parental leave.", 51, 1,
  [SPIRIT("family_support"), IG("rural", 3), IG("urban_middle_class", 3)], pre=["social_policy"])
f("education_reform", "Education reform", "A national school-leaving exam and new research universities.", 53, 1,
  [MOD("education_quality", 0.04, 3650), IG("youth_students", 3), RB("economy_digital", 0.15, 1)], pre=["social_policy"])
f("anti_alcohol_campaign", "Campaign against alcohol and smoking", "Higher excise taxes, sales limits and public campaigns.", 49, 2,
  [MOD("health_outcomes", 0.03, 3650), MOD("tax_efficiency", 0.01, 3650), IG("rural", -2)], pre=["healthcare_modernisation"])
f("housing_programme", "Affordable housing", "Mortgage subsidies and new housing estates.", 51, 2,
  [TREAS(-2), MOD("construction_speed", 0.05, 2920), MOD("population_growth", 0.001, 2920), IG("urban_middle_class", 4)], pre=["family_support"], avail=CASH(2))
f("science_drive", "Science drive", "Grants, research universities and labs that bring researchers home. Unlocks research grants.", 53, 2,
  [SPIRIT("science_drive"), RB("economy_digital", 0.2, 2)], pre=["education_reform"])
f("healthy_nation", "A healthier nation", "Life expectancy rises and the population decline slows.", 50, 3,
  [SPIRIT("healthy_nation")], pre=["anti_alcohol_campaign", "housing_programme"])
f("demographic_turnaround", "Demographic turnaround", "Births catch up with deaths at last.", 50, 4,
  [REMOVE("demographic_decline"), STAB(0.02)], pre=["healthy_nation"], avail=ALL(HAS("demographic_decline"), AFTER("2009-01-01")), days=140, ai=3)
f("skolkovo", "Skolkovo innovation centre", "A technology park near Moscow with its own tax and legal regime, announced in November 2009 and set up by law in September 2010.", 53, 3,
  [BUILD("data_centre", 1, MOSCOW_OBL), RB("electronics_cyber", 0.25, 2), IG("youth_students", 3)], pre=["science_drive"], avail=AFTER("2009-11-12"), ai=3)
f("space_programme", "Space programme", "A new launch site in the Far East and new launch vehicles.", 52, 4,
  [BUILD("infrastructure", 1, "RUS-2609"), RB("air_drones", 0.15, 1), MOD("diplomatic_reputation", 0.02, 2920)], pre=["skolkovo|science_drive"])
f("digital_economy", "Digital economy", "Broadband, e-government and data centres across the country.", 54, 4,
  [BUILD("data_centre", 2), RB("economy_digital", 0.2, 2), MOD("tax_efficiency", 0.02, 2920)], pre=["skolkovo"])
f("sovereign_internet", "A sovereign internet", "Infrastructure to run the Russian internet separately from the global network.", 54, 5,
  [LAW("internet_surveillance", "sovereign_internet"), MOD("foreign_influence_resistance", 0.1, 3650), IG("youth_students", -5)], pre=["digital_economy"], avail=ALL(HIST, AFTER("2019-05-01")), ai=2)
f("brain_gain", "Bring the researchers home", "Grants and laboratories for scientists who return from abroad.", 52, 5,
  [MOD("research_speed", 0.03, 2920), RB("electronics_cyber", 0.15, 1)], pre=["space_programme|digital_economy"])

# ---- more depth (added to every branch)
f("mining_and_fertilisers", "Mining and fertilisers", "Expand nickel, potash and fertiliser production.", 24, 5,
  [BUILD("civilian_factory", 1, "RUS-2603"), BUILD("civilian_factory", 1, "RUS-3200"), MOD("trade_efficiency", 0.02, 2920)], pre=["import_substitution|national_payment_system"])
f("black_sea_resorts", "Black Sea resorts", "Roads, airports and hotels on the Black Sea coast.", 31, 6,
  [BUILD("infrastructure", 2, "RUS-2371"), BUILD("air_base", 1, "RUS-2371"), MOD("gdp_growth", 0.001, 2920)], pre=["agricultural_revival"])
f("timber_and_pulp", "Timber and pulp", "Process timber at home instead of exporting logs.", 26, 6,
  [BUILD("civilian_factory", 1, "RUS-2354"), BUILD("civilian_factory", 1, "RUS-2602")], pre=["arctic_development"])
f("black_sea_fleet", "Black Sea Fleet", "New ships and a new base at Novorossiysk.", 38, 6,
  [BUILD("port", 1, "RUS-2371"), MOD("naval_effectiveness", 0.03, 2920)], pre=["reserve_system|kaliningrad_garrison"])
f("cyber_command", "Information operations troops", "A command for cyber defence and information operations.", 34, 6,
  [RB("electronics_cyber", 0.25, 2), MOD("intelligence_power", 0.05, 2920)], pre=["readiness_exercises"])
f("military_space", "Aerospace forces", "Merge the air force and the space troops into one service.", 37, 7,
  [MOD("air_effectiveness", 0.03, 2920), RB("air_drones", 0.15, 1)], pre=["arctic_brigades|black_sea_fleet"])
f("japan_dialogue", "Dialogue with Japan", "Talks on the Kuril Islands and Japanese investment in the Far East.", 47, 2,
  [OPN("JPN", 15), MOD("foreign_investment", 0.03, 2920)], pre=["cooperation_with_us"])
f("turkish_gas_route", "A gas route through Turkey", "A pipeline under the Black Sea to Turkey.", 46, 6,
  [OPN("TUR", 15), TREAS(3), BUILD("refinery", 1, "RUS-2371")], pre=["global_south|multipolar_world"])
f("balkan_ties", "Ties in the Balkans", "Close ties with Yugoslavia and later Serbia.", 41, 5,
  [OPN("YUG", 20)], pre=["central_asia"])
f("arctic_claims", "The Arctic shelf", "Submit a claim to the Arctic seabed to the UN commission.", 43, 6,
  [MOD("fossil_output", 0.02, 3650), MOD("diplomatic_reputation", 0.02, 2920)], pre=["multipolar_world|sanctions_resilience"])
f("regional_universities", "Federal universities", "Large federal universities in the regions.", 53, 5,
  [MOD("education_quality", 0.03, 3650), IG("youth_students", 3)], pre=["space_programme|science_drive"])
f("pension_indexation", "Index pensions", "Raise pensions with prices every year.", 49, 3,
  [{"set_budget": {"spending": 0.5}}, IG("rural", 4), {"add_ruling_party_popularity": 0.02}], pre=["anti_alcohol_campaign|housing_programme"])
f("volunteer_movement", "Volunteer and youth movement", "State support for volunteer groups and youth organisations.", 51, 4,
  [IG("youth_students", 4), MOD("propaganda_efficiency", 0.03, 1825)], pre=["healthy_nation|housing_programme"])

tree = {
    "id": "rus",
    "name": "Russia",
    "countries": ["RUS"],
    "note": "Russia model tree. Politics: the historical path (the power vertical) and five mutually exclusive alternatives (liberal, communist, national-populist, ultranationalist with the LDPR, military), each bringing to power only a real party of the data; alternatives are a counterfactual, not a claim about the parties. Economy, industry, military, foreign policy and society branches build, fix Russia's starting national spirits (data/spirits/rus.json), unlock decisions (data/decisions/rus.json), grant research bonuses and, on alternative paths only, claim land and go to war. Policies named after real reforms are cited; effects are gameplay estimates.",
    "source": [{"url": "https://en.wikipedia.org/wiki/" + t.replace(" ", "_"), "title": "Wikipedia: " + t, "accessed": a} for t, a in [
        ("Presidency of Vladimir Putin", "2026-10-14"), ("Federal districts of Russia", "2026-10-19"), ("Flat tax", "2026-10-19"),
        ("Stabilization Fund of the Russian Federation", "2026-10-19"), ("Governor (Russia)", "2026-10-19"), ("Second Chechen War", "2026-10-19"),
        ("National Priority Projects (Russia)", "2026-10-19"), ("2008 amendments to the Constitution of Russia", "2026-10-19"), ("Skolkovo Innovation Center", "2026-10-19"),
        ("2020 amendments to the Constitution of Russia", "2026-10-19"), ("Eurasian Economic Union", "2026-10-19"), ("Collective Security Treaty Organization", "2026-10-19"),
        ("2008 Russian military reform", "2026-10-19"), ("Russian foreign agent law", "2026-10-19"), ("Rosneft", "2026-10-19"),
        ("1998 Russian financial crisis", "2026-10-19"), ("Economy of Russia", "2026-10-19"),
        ("Communist Party of the Russian Federation", "2026-10-19"), ("Liberal Democratic Party of Russia", "2026-10-19"), ("Rodina (political party)", "2026-10-19"),
        ("Yabloko", "2026-10-19"), ("Union of Right Forces", "2026-10-19")]],
    "confidence": "verified",
    "focuses": F,
}
ids = [x["id"] for x in F]
assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
pos = [(x["x"], x["y"]) for x in F]
assert len(pos) == len(set(pos)), [p for p in pos if pos.count(p) > 1]
idset = set(ids)
for x in F:
    for g in x.get("prerequisites", []):
        for p in g: assert p in idset, (x["id"], p)
    for m in x.get("mutually_exclusive", []): assert m in idset, (x["id"], m)
json.dump(tree, open("data/focus_trees/rus.json", "w", encoding="utf8", newline="\n"), indent=2, ensure_ascii=False)
open("data/focus_trees/rus.json", "a", encoding="utf8", newline="\n").write("\n")
print(len(F), "focuses")
