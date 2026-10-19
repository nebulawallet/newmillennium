"""Generates data/focus_trees/generic.json (the tree for every country without its own) in the Russia style:
focuses build, grant and swap national spirits, unlock decisions, cost money, and on alternative paths claim
and fight. It names no real place, so claims and war goals go to the least friendly neighbour. Also writes the
generic project decisions into data/decisions/generic.json. Run from the repo root."""
import json

F = []
def f(id, name, desc, x, y, effects, pre=None, excl=None, avail=None, days=70, ai=1):
    d = {"id": id, "name": name, "description": desc, "x": x, "y": y, "days": days}
    if pre: d["prerequisites"] = [[p for p in g.split("|")] for g in pre]
    if excl: d["mutually_exclusive"] = list(excl)
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
SPIRIT = lambda s: {"add_spirit": s}
REMOVE = lambda s: {"remove_spirit": s}
SWAP = lambda a, b: {"swap_spirit": {"from": a, "to": b}}
TREAS = lambda v: {"add_treasury": v}
RB = lambda cat, v=0.2, uses=2: {"add_research_bonus": {"category": cat, "value": v, "uses": uses}}
EQUIP = lambda n: {"add_equipment": {"family": "infantry_equipment", "amount": n}}
DIVS = lambda t, n: {"add_divisions": {"template": t, "count": n}}
BUILD = lambda b, n: {"add_buildings": {"building": b, "count": n}}
ALL = lambda *a: {"all": list(a)}
ANY = lambda *a: {"any": list(a)}
NOT = lambda a: {"not": a}
HAS = lambda s: {"has_spirit": s}
CASH = lambda v: {"treasury_above": v}
LEAVE = {"leave_history": True}
ALT = ANY({"follows_history": False}, {"is_player": True})
SUP = lambda g, v: {"ideology_group_support_above": {"group": g, "value": v}}
HASP = lambda g: {"has_party_of_group": g}
RULED = lambda g: {"ruling_ideology_group": g}

# ============================================================ political paths (x 0-14)
starts = ["path_liberal_opening", "path_socialist_turn", "path_nationalist_turn", "path_ultranationalist_turn", "path_religious_turn", "path_army_steps_in"]
def excl(me): return [s for s in ["path_steady_course"] + starts if s != me]

f("path_question_of_power", "The question of power", "Decide whether the political order stays as it is or changes course.", 7, 0, [PP(30)], ai=5)
f("path_steady_course", "A steady course", "Keep the political order as it is. This is the path most countries took.", 1, 1,
  [STAB(0.05), PP(40), {"add_ruling_party_popularity": 0.02}], pre=["path_question_of_power"], excl=excl("path_steady_course"), ai=20)
f("path_institutional_continuity", "Institutional continuity", "Keep the civil service and the courts out of party politics.", 1, 2,
  [SPIRIT("professional_civil_service"), PP(-20)], pre=["path_steady_course"], ai=3)

f("path_liberal_opening", "Liberal opening", "Open the political system to real competition; the liberal parties gain ground.", 3, 1,
  [LEAVE, GROUP("liberal_democratic", 0.03), IG("urban_middle_class", 5), IG("security_services", -5)],
  pre=["path_question_of_power"], excl=excl("path_liberal_opening"),
  avail=ALL(ALT, HASP("liberal_democratic"), NOT(RULED("liberal_democratic")), ANY({"stability_below": 0.6}, {"ig_approval_below": {"group": "urban_middle_class", "value": 45}})), ai=0.3)
f("path_free_press", "A free press", "End state pressure on the media.", 3, 2,
  [LAW("press_freedom", "regulated_press"), IG("media", 8), GROUP("liberal_democratic", 0.04)], pre=["path_liberal_opening"])
f("path_liberal_government", "A liberal government", "The most popular liberal party forms the government and calls free elections.", 3, 3,
  [{"install_government": {"ideology": "liberal_democratic"}}, LAW("political_freedom", "free_elections"), STAB(-0.05)],
  pre=["path_free_press"], avail=SUP("liberal_democratic", 0.15), days=105)
f("path_rule_of_law", "Rule of law", "Independent courts, full civil liberties and an anti-corruption drive.", 3, 4,
  [LAW("civil_rights", "full_civil_liberties"), SPIRIT("open_society"), REMOVE("endemic_corruption"), IG("security_services", -6), IG("business", 4)], pre=["path_liberal_government"])

f("path_socialist_turn", "Socialist turn", "Hard times turn voters toward the socialist and communist parties.", 5, 1,
  [LEAVE, GROUP("socialist_communist", 0.04), IG("labour_unions", 5), IG("business", -5)],
  pre=["path_question_of_power"], excl=excl("path_socialist_turn"),
  avail=ALL(ALT, HASP("socialist_communist"), NOT(RULED("socialist_communist")), ANY({"gdp_growth_below": 2}, {"unrest_above": 0.2}, {"ig_approval_below": {"group": "labour_unions", "value": 40}})), ai=0.3)
f("path_workers_movement", "Workers' movement", "Strikes and committees in the factories rally behind the party.", 5, 2,
  [GROUP("socialist_communist", 0.05), IGI("labour_unions", 0.05)], pre=["path_socialist_turn"])
f("path_socialist_government", "A socialist government", "The most popular socialist party takes power and rules as the single governing party.", 5, 3,
  [{"install_government": {"ideology": "socialist_communist", "government_type": "one_party_state"}}, LAW("political_freedom", "single_party_elections"), STAB(-0.05)],
  pre=["path_workers_movement"], avail=SUP("socialist_communist", 0.25), days=105)
f("path_public_ownership", "Public ownership", "Bring the large industries and the banks into public ownership and plan investment.", 5, 4,
  [LAW("economic_system", "state_capitalism"), SPIRIT("state_planning"), BUILD("civilian_factory", 2), BUILD("military_factory", 1), IG("business", -10), IG("labour_unions", 6)], pre=["path_socialist_government"])

f("path_nationalist_turn", "Nationalist turn", "Nationalist parties gain from a mood of national grievance.", 7, 1,
  [LEAVE, GROUP("nationalist_populist", 0.04), WS(0.03), IG("minorities", -5)],
  pre=["path_question_of_power"], excl=excl("path_nationalist_turn"),
  avail=ALL(ALT, HASP("nationalist_populist"), NOT(RULED("nationalist_populist")), ANY({"stability_below": 0.5}, {"war_support_above": 0.5})), ai=0.3)
f("path_patriotic_rallies", "Patriotic rallies", "Mass rallies around national symbols and grievances.", 7, 2,
  [GROUP("nationalist_populist", 0.05), WS(0.03)], pre=["path_nationalist_turn"])
f("path_nationalist_government", "A nationalist government", "The most popular nationalist party forms the government.", 7, 3,
  [{"install_government": {"ideology": "nationalist_populist", "government_type": "hybrid_authoritarian"}}, STAB(-0.05)],
  pre=["path_patriotic_rallies"], avail=SUP("nationalist_populist", 0.2), days=105)
f("path_national_sovereignty", "National sovereignty first", "Restrict immigration, limit foreign influence and raise new divisions.", 7, 4,
  [LAW("immigration", "restrictive_immigration"), MOD("foreign_influence_resistance", 0.1, 2920), DIVS("infantry_division", 2), IG("minorities", -6)], pre=["path_nationalist_government"])
f("path_border_claims", "Claims on the border", "Claim border provinces of the least friendly neighbour.", 7, 5,
  [{"claim_rival_border": {"count": 3}}, WS(0.05)], pre=["path_national_sovereignty"])

f("path_ultranationalist_turn", "Ultranationalist turn", "In a deep crisis, an ultranationalist party gains a mass following and seeks an authoritarian state. This is a counterfactual, not a claim about the party's aims.", 9, 1,
  [LEAVE, GROUP("fascist", 0.04), WS(0.05), IG("minorities", -8), IG("media", -5)],
  pre=["path_question_of_power"], excl=excl("path_ultranationalist_turn"),
  avail=ALL(ALT, HASP("fascist"), {"stability_below": 0.4}, {"war_support_above": 0.4}), ai=0.1)
f("path_street_movement", "A street movement", "Marches and rallies spread the movement in the cities.", 9, 2,
  [GROUP("fascist", 0.06), {"add_unrest": 0.05}, IG("security_services", 3)], pre=["path_ultranationalist_turn"])
f("path_seizure_of_power", "Seizure of power", "The ultranationalist party takes power, abolishes elections and rules as the only party.", 9, 3,
  [{"install_government": {"ideology": "fascist", "government_type": "one_party_state"}}, STAB(-0.08), WS(0.05)],
  pre=["path_street_movement"], avail=SUP("fascist", 0.2), days=105)
f("path_national_mobilisation", "National mobilisation", "State control of the press, universal military training and a war economy.", 9, 4,
  [LAW("press_freedom", "total_censorship"), SPIRIT("mobilised_nation"), SPIRIT("war_economy"), DIVS("infantry_division", 4), EQUIP(1500)], pre=["path_seizure_of_power"])
f("path_lost_territories", "The lost territories", "Claim the border lands of the least friendly neighbour and prepare for war.", 9, 5,
  [{"claim_rival_border": {"count": 6}}, {"wargoal_on_rival": True}, {"every_neighbor": {"effects": [{"add_opinion": {"target": "ROOT", "value": -25, "days": 1825}}]}}], pre=["path_national_mobilisation"])

f("path_religious_turn", "Religious turn", "Religious parties gain support as faith becomes central to politics.", 11, 1,
  [LEAVE, GROUP("religious", 0.04), IG("religious_establishment", 6), IG("youth_students", -3)],
  pre=["path_question_of_power"], excl=excl("path_religious_turn"),
  avail=ALL(ALT, HASP("religious"), NOT(RULED("religious")), ANY({"stability_below": 0.5}, {"ig_influence_above": {"group": "religious_establishment", "value": 0.15}})), ai=0.3)
f("path_faith_networks", "Faith networks", "Charities and congregations organise for the religious parties.", 11, 2,
  [GROUP("religious", 0.05), IGI("religious_establishment", 0.05)], pre=["path_religious_turn"])
f("path_religious_government", "A religious government", "The most popular religious party forms the government.", 11, 3,
  [{"install_government": {"ideology": "religious"}}, STAB(-0.04)], pre=["path_faith_networks"], avail=SUP("religious", 0.2), days=105)
f("path_faith_in_public_life", "Faith in public life", "An official religion and religious education in state schools.", 11, 4,
  [LAW("religion_state", "official_religion"), SPIRIT("religious_revival"), IG("religious_establishment", 8), IG("minorities", -5)], pre=["path_religious_government"])

f("path_army_steps_in", "The army steps in", "With the state in crisis, the generals prepare to take over.", 13, 1,
  [LEAVE, IGI("military", 0.08), IG("military", 5)],
  pre=["path_question_of_power"], excl=excl("path_army_steps_in"),
  avail=ALL(ALT, {"stability_below": 0.3}, ANY({"unrest_above": 0.4}, {"ig_approval_below": {"group": "military", "value": 35}})), ai=0.2)
f("path_military_council", "Military council", "The armed forces remove the government. The coup may fail.", 13, 2,
  [{"trigger_coup": {"by": "military", "success_chance": 0.65}}], pre=["path_army_steps_in"], days=35)
f("path_martial_order", "Martial order", "A state of emergency, a curfew and military courts.", 13, 3,
  [LAW("civil_rights", "security_state"), SPIRIT("military_rule"), {"add_unrest": -0.08}, IG("youth_students", -6)],
  pre=["path_military_council"], avail={"government_type": "military_junta"})
f("path_officers_economy", "Officers in the economy", "Army-run companies and a larger defence industry.", 12, 4,
  [BUILD("military_factory", 2), IG("business", -4), IG("military", 4)], pre=["path_martial_order"], avail={"government_type": "military_junta"})
f("path_return_to_barracks", "Return to the barracks", "The council hands power to an elected government.", 14, 4,
  [{"set_government_type": "transitional_administration"}, LAW("political_freedom", "free_elections"), REMOVE("military_rule"), STAB(0.05), IGI("military", -0.08)],
  pre=["path_martial_order"], avail={"government_type": "military_junta"}, days=140, ai=0.5)

# ============================================================ state and government (x 16-19)
f("pol_national_agenda", "National agenda", "Set out the government's priorities for its term.", 17, 0, [PP(40)], ai=4)
f("pol_institutions", "Strengthen institutions", "Invest in the civil service and the courts.", 16, 1,
  [STAB(0.04), MOD("corruption", -0.02, 2920)], pre=["pol_national_agenda"])
f("pol_public_outreach", "Public outreach", "Explain the government's programme across the country.", 18, 1,
  [{"add_ruling_party_popularity": 0.02}, IG("urban_middle_class", 3)], pre=["pol_national_agenda"])
f("pol_anti_corruption", "Anti-corruption drive", "Audit public contracts and strengthen oversight bodies. Unlocks anti-corruption audits.", 16, 2,
  [SWAP("endemic_corruption", "anti_corruption_campaign"), IG("business", 2), IG("media", 3)], pre=["pol_institutions"])
f("pol_civic_education", "Civic education", "Fund civic education in schools and universities.", 18, 2,
  [MOD("education_quality", 0.03, 3650), IG("youth_students", 5)], pre=["pol_public_outreach"])
f("pol_civil_service_reform", "Civil service reform", "Hire and promote officials on merit.", 16, 3,
  [REMOVE("anti_corruption_campaign"), SPIRIT("professional_civil_service"), PP(-20)], pre=["pol_anti_corruption"], days=105)
f("pol_e_government", "E-government", "Taxes, permits and records online.", 17, 4,
  [SPIRIT("digital_government"), BUILD("data_centre", 1), TREAS(-1)], pre=["pol_civil_service_reform|pol_civic_education"], avail=CASH(1))
f("pol_regional_development", "Regional development", "Roads, schools and clinics for the poorer regions.", 19, 3,
  [BUILD("infrastructure", 2), IG("rural", 4), TREAS(-1.5)], pre=["pol_civic_education"], avail=CASH(1.5))
f("pol_reconciliation", "National reconciliation", "Bring regions and communities into the political settlement.", 18, 4,
  [{"add_unrest": -0.1}, STAB(0.05), IG("minorities", 5)], pre=["pol_civic_education", "pol_regional_development|pol_anti_corruption"], days=105)

# ============================================================ economy (x 21-27)
f("eco_economic_council", "Economic council", "Convene ministers, employers and unions on the economy.", 24, 0, [PP(30), IG("business", 3)], ai=4)
f("eco_fiscal_review", "Fiscal review", "Review spending and the tax base.", 22, 1,
  [MOD("tax_efficiency", 0.04, 2920), {"add_economic_mood": 0.03}], pre=["eco_economic_council"])
f("eco_infrastructure", "Infrastructure programme", "Build and repair roads, rail and ports. Unlocks public works.", 25, 1,
  [BUILD("infrastructure", 3), IG("rural", 4), TREAS(-2)], pre=["eco_economic_council"], avail=CASH(2))
f("eco_austerity", "Austerity", "Cut spending to balance the budget.", 21, 2,
  [SPIRIT("austerity"), TREAS(3)], pre=["eco_fiscal_review"], excl=["eco_stimulus"])
f("eco_stimulus", "Stimulus", "Borrow to fund public investment.", 23, 2,
  [SPIRIT("stimulus"), BUILD("civilian_factory", 1), TREAS(-2)], pre=["eco_fiscal_review"], excl=["eco_austerity"])
f("eco_balanced_budget", "A balanced budget", "The deficit is closed and borrowing becomes cheaper.", 22, 3,
  [SWAP("austerity", "balanced_budget"), REMOVE("stimulus")], pre=["eco_austerity|eco_stimulus"], days=105)
f("eco_market_reform", "Market reform", "Open sectors to competition and private investment.", 21, 4,
  [IG("business", 6), IG("labour_unions", -4), MOD("private_sector_output", 0.05, 3650), MOD("foreign_investment", 0.05, 2920)], pre=["eco_balanced_budget"], excl=["eco_state_led"])
f("eco_state_led", "State-led development", "Direct investment through state enterprises and development banks.", 23, 4,
  [IG("labour_unions", 6), IG("business", -4), MOD("state_industry_output", 0.05, 3650), BUILD("civilian_factory", 1)], pre=["eco_balanced_budget"], excl=["eco_market_reform"])
f("eco_industrial_parks", "Industrial parks", "Serviced land and tax breaks for new factories.", 25, 2,
  [BUILD("civilian_factory", 2), MOD("foreign_investment", 0.03, 2920), TREAS(-2)], pre=["eco_infrastructure"], avail=CASH(2))
f("eco_ports_and_airports", "Ports and airports", "Modern ports and airports for trade.", 27, 2,
  [BUILD("port", 1), BUILD("air_base", 1), MOD("trade_efficiency", 0.03, 2920)], pre=["eco_infrastructure"])
f("eco_export_drive", "Export drive", "Manufacturing for export markets.", 25, 3,
  [SPIRIT("export_led_growth"), BUILD("civilian_factory", 1)], pre=["eco_industrial_parks"])
f("eco_energy_security", "Energy security", "Diversify energy supplies and build new power plants.", 27, 3,
  [MOD("energy_cost", -0.04, 3650), BUILD("renewable_plant", 1)], pre=["eco_ports_and_airports"])
f("eco_refining", "Fuel refining", "Refine fuel at home instead of importing it.", 26, 4,
  [BUILD("refinery", 1), MOD("energy_cost", -0.02, 3650)], pre=["eco_energy_security|eco_export_drive"])
f("eco_agriculture", "Modern agriculture", "Credit, irrigation and machinery for farmers.", 24, 4,
  [IG("rural", 6), MOD("gdp_growth", 0.002, 2920)], pre=["eco_export_drive|eco_balanced_budget"])
f("eco_innovation", "Innovation agenda", "Fund research and new industries.", 27, 5,
  [RB("economy_digital", 0.2, 2), BUILD("data_centre", 1), IG("youth_students", 3)], pre=["eco_refining"])
f("eco_sovereign_fund", "Sovereign wealth fund", "Save resource revenue for future generations.", 25, 5,
  [SPIRIT("sovereign_wealth_fund"), TREAS(-3)], pre=["eco_agriculture|eco_refining"], avail=CASH(3))
f("eco_long_term_growth", "Long-term growth plan", "Commit to a ten-year plan for growth.", 22, 5,
  [{"add_economic_mood": 0.1}, MOD("gdp_growth", 0.003, 3650), BUILD("civilian_factory", 2)], pre=["eco_market_reform|eco_state_led"], days=105)

# ============================================================ military (x 29-34)
f("mil_defence_review", "Defence review", "Review threats, forces and budgets.", 31, 0, [WS(0.03), IG("military", 3)], ai=4)
f("mil_professional_forces", "Professional forces", "Move to an all-volunteer professional military.", 29, 1,
  [LAW("conscription", "volunteer_force"), MOD("army_org", 0.05, 3650), IG("youth_students", 5)], pre=["mil_defence_review"], excl=["mil_mass_reserve"])
f("mil_mass_reserve", "Mass reserve", "Keep universal service and a large trained reserve. Unlocks mobilisation of the reserves.", 31, 1,
  [LAW("conscription", "universal_conscription"), MOD("manpower_factor", 0.08, 3650), IG("military", 5), IG("youth_students", -5)], pre=["mil_defence_review"], excl=["mil_professional_forces"])
f("mil_intelligence", "Intelligence reform", "Reorganise and fund the intelligence services.", 33, 1,
  [MOD("intelligence_power", 0.1, 3650), IG("security_services", 5)], pre=["mil_defence_review"])
f("mil_modernisation", "Force modernisation", "Replace ageing equipment.", 30, 2,
  [EQUIP(800), RB("infantry", 0.2, 2), TREAS(-1.5)], pre=["mil_professional_forces|mil_mass_reserve"], avail=CASH(1.5))
f("mil_defence_industry", "Defence industry", "Build arms and ammunition at home. Unlocks arms orders.", 32, 2,
  [BUILD("military_factory", 2)], pre=["mil_professional_forces|mil_mass_reserve"])
f("mil_border_security", "Border security", "Tighten control of borders and ports.", 34, 2,
  [MOD("internal_security", 0.05, 3650), {"add_unrest": -0.03}, MOD("army_defence", 0.02, 2920)], pre=["mil_intelligence"])
f("mil_air_force", "Air force", "New aircraft and air bases.", 29, 3,
  [BUILD("air_base", 1), RB("air_drones", 0.2, 2)], pre=["mil_modernisation"])
f("mil_armour", "Armoured units", "Tanks and armoured vehicles.", 31, 3,
  [RB("armour", 0.2, 2), DIVS("motorised_division", 1)], pre=["mil_modernisation|mil_defence_industry"])
f("mil_navy", "Coastal navy", "Patrol boats and a naval base.", 33, 3,
  [BUILD("port", 1), RB("naval", 0.2, 1)], pre=["mil_defence_industry|mil_border_security"])
f("mil_special_forces", "Special forces", "A special operations command.", 30, 4,
  [MOD("army_attack", 0.03, 2920), DIVS("infantry_division", 1)], pre=["mil_air_force|mil_armour"])
f("mil_doctrine", "A new doctrine", "Rewrite the doctrine for modern war.", 32, 4,
  [RB("doctrine", 0.25, 2), MOD("army_org", 0.03, 2920)], pre=["mil_armour|mil_navy"])
f("mil_armed_neutrality", "Armed neutrality", "Strong defences and no alliances.", 34, 4,
  [SPIRIT("armed_neutrality")], pre=["mil_navy|mil_border_security"], excl=["dip_regional_cooperation"])
f("mil_peacekeepers", "Peacekeepers", "Send units on UN peacekeeping missions for experience and standing.", 31, 5,
  [MOD("army_org", 0.02, 2920), MOD("diplomatic_reputation", 0.03, 2920)], pre=["mil_special_forces|mil_doctrine"])

# ============================================================ diplomacy (x 36-40)
f("dip_foreign_policy_review", "Foreign policy review", "Define the country's place in the world.", 38, 0, [PP(30)], ai=4)
f("dip_regional_cooperation", "Regional cooperation", "Seek closer ties and trade with neighbours.", 37, 1,
  [MOD("trade_efficiency", 0.04, 3650), IG("business", 3), {"every_neighbor": {"effects": [{"add_opinion": {"target": "ROOT", "value": 10, "days": 1825}}]}}],
  pre=["dip_foreign_policy_review"], excl=["dip_independent_course", "mil_armed_neutrality"])
f("dip_independent_course", "Independent course", "Keep freedom of action and limit foreign influence.", 39, 1,
  [MOD("foreign_influence_resistance", 0.1, 3650), IG("military", 3)], pre=["dip_foreign_policy_review"], excl=["dip_regional_cooperation"])
f("dip_trade_agreements", "Trade agreements", "Free-trade agreements with the main partners.", 36, 2,
  [MOD("trade_efficiency", 0.04, 3650), MOD("foreign_investment", 0.04, 2920)], pre=["dip_regional_cooperation"])
f("dip_international_standing", "International standing", "Raise the country's profile in international bodies.", 38, 2,
  [MOD("diplomatic_reputation", 0.05, 3650)], pre=["dip_regional_cooperation|dip_independent_course"])
f("dip_arms_purchases", "Arms purchases abroad", "Buy modern equipment from foreign suppliers.", 40, 2,
  [EQUIP(1000), TREAS(-2)], pre=["dip_independent_course"], avail=CASH(2))
f("dip_development_aid", "Development aid", "Attract loans and grants for development.", 37, 3,
  [TREAS(3), MOD("foreign_influence_resistance", -0.05, 2920)], pre=["dip_trade_agreements|dip_international_standing"])
f("dip_diaspora", "The diaspora", "Courting citizens abroad for investment and remittances.", 39, 3,
  [TREAS(1.5), MOD("foreign_investment", 0.03, 2920)], pre=["dip_international_standing|dip_arms_purchases"])
f("dip_regional_leadership", "Regional leadership", "Lead the region's diplomacy and mediate its disputes.", 38, 4,
  [MOD("diplomatic_reputation", 0.05, 3650), PP(40)], pre=["dip_development_aid|dip_diaspora"])

# ============================================================ society and science (x 42-45)
f("soc_social_policy", "Social policy", "Set the government's priorities for health, schools and science.", 43, 0, [PP(20)], ai=3)
f("soc_public_health", "Public health", "Clinics, vaccination and clean water.", 42, 1,
  [MOD("health_outcomes", 0.04, 3650), TREAS(-1)], pre=["soc_social_policy"], avail=CASH(1))
f("soc_schools", "Schools for all", "More schools and teachers.", 44, 1,
  [MOD("education_quality", 0.04, 3650), IG("youth_students", 3), TREAS(-1)], pre=["soc_social_policy"], avail=CASH(1))
f("soc_universal_healthcare", "Universal healthcare", "Public health insurance for everyone.", 42, 2,
  [SPIRIT("universal_healthcare"), LAW("healthcare", "social_insurance")], pre=["soc_public_health"])
f("soc_universities", "Research universities", "Fund universities and laboratories. Unlocks research grants.", 44, 2,
  [SPIRIT("science_drive"), RB("industry_energy", 0.2, 2)], pre=["soc_schools"])
f("soc_housing", "Housing programme", "Affordable housing in the growing cities.", 43, 3,
  [MOD("construction_speed", 0.05, 2920), IG("urban_middle_class", 4), TREAS(-1.5)], pre=["soc_universal_healthcare|soc_universities"], avail=CASH(1.5))
f("soc_keep_talent", "Keep the talent", "Better pay for researchers and doctors so they stay.", 45, 3,
  [REMOVE("brain_drain"), RB("electronics_cyber", 0.2, 1)], pre=["soc_universities"])
f("soc_digital_society", "Digital society", "Broadband and digital skills across the country.", 44, 4,
  [BUILD("data_centre", 1), RB("economy_digital", 0.2, 1)], pre=["soc_housing|soc_keep_talent"])

tree = {
    "id": "generic",
    "name": "National priorities",
    "countries": [],
    "note": "The generic focus tree for every country without its own, in the style of the Russian model tree: focuses build, grant and swap national spirits (data/spirits/generic.json), unlock the project decisions, cost money and grant research. The political branch has a steady course (the historical path) and six mutually exclusive alternatives; each brings to power only a real party of the country's data and shows only where one exists, except the military junta. It names no real place, so claims and war goals on the nationalist paths target the least friendly neighbour. Alternatives are a counterfactual, not a claim about the parties. Effects are gameplay estimates.",
    "focuses": F,
}
ids = [x["id"] for x in F]
assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
pos = [(x["x"], x["y"]) for x in F]
assert len(pos) == len(set(pos)), [p for p in pos if pos.count(p) > 1]
for x in F:
    for g in x.get("prerequisites", []):
        for p in g: assert p in ids, (x["id"], p)
    for m in x.get("mutually_exclusive", []): assert m in ids, (x["id"], m)
json.dump(tree, open("data/focus_trees/generic.json", "w", encoding="utf8", newline="\n"), indent=2, ensure_ascii=False)
open("data/focus_trees/generic.json", "a", encoding="utf8", newline="\n").write("\n")

# ---- project decisions unlocked by the generic tree
P = "data/decisions/generic.json"
dd = json.load(open(P, encoding="utf8"))
dd["categories"] = [c for c in dd["categories"] if c["id"] != "projects"] + [{"id": "projects", "name": "National projects", "description": "Projects that the national focuses open up."}]
dd["decisions"] = [d for d in dd["decisions"] if d.get("category") != "projects"]
def dec(id, name, desc, focus, cost_pp, effects, cash=None, cooldown=365, ai=2, avail=None):
    d = {"id": id, "name": name, "description": desc, "category": "projects", "visible": {"has_completed_focus": focus}}
    if cash: d["available"] = {"treasury_above": cash}
    if avail: d["available"] = avail
    d.update({"cost": {"political_power": cost_pp}, "effects": effects, "cooldown_days": cooldown, "ai_weight": ai})
    dd["decisions"].append(d)
dec("public_works", "Public works", "A year of road, rail and port building.", "eco_infrastructure", 30, [TREAS(-1.5), BUILD("infrastructure", 2)], cash=1.5)
dec("industrial_subsidies", "Industrial subsidies", "Subsidise a new factory.", "eco_industrial_parks", 30, [TREAS(-1.5), BUILD("civilian_factory", 1)], cash=1.5)
dec("arms_order", "Arms order", "An order for the defence industry.", "mil_defence_industry", 30, [TREAS(-1), EQUIP(500), IG("military", 2)], cash=1)
dec("mobilise_reserves", "Mobilise the reserves", "Call up reservists into new divisions.", "mil_mass_reserve", 50, [DIVS("infantry_division", 2), STAB(-0.02), WS(0.02)], cooldown=730, ai=1, avail={"at_war": True})
dec("anti_corruption_audit", "Anti-corruption audit", "Audit a ministry's contracts.", "pol_anti_corruption", 25, [MOD("corruption", -0.02, 730), IG("business", -2), IG("media", 2)])
dec("research_grants_generic", "Research grants", "A round of state research grants.", "soc_universities", 30, [TREAS(-1), RB("industry_energy", 0.2, 1), RB("economy_digital", 0.2, 1)], cash=1)
json.dump(dd, open(P, "w", encoding="utf8", newline="\n"), indent=2, ensure_ascii=False)
open(P, "a", encoding="utf8", newline="\n").write("\n")
print(len(F), "focuses;", len([d for d in dd["decisions"] if d["category"] == "projects"]), "project decisions")
