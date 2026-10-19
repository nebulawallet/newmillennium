"""Iraq tree in the Russia model style. Run from the repo root."""
import sys; sys.path.insert(0, __file__.replace("\\", "/").rsplit("/", 1)[0])
from treelib import *

write_spirits("irq", "Iraq's national spirits. The ones with `start` describe the situation on 1 January 2000 and cite sources; the others are granted by focuses and decisions. Values are gameplay estimates.", [
    start_spirit("irq_un_sanctions", "UN sanctions", "A comprehensive UN embargo has been in force since August 1990 and stays tied to disarmament.", "problem", {"trade_efficiency": -0.2, "foreign_investment": -0.2, "gdp_growth": -0.01}, "IRQ", "Sanctions against Iraq"),
    start_spirit("irq_oil_for_food", "Oil-for-Food", "Under a UN programme set up in 1995, Iraq sells oil in controlled quantities for food, medicine and humanitarian goods.", "policy", {"health_outcomes": 0.02, "fossil_output": -0.1}, "IRQ", "Oil-for-Food Programme"),
    start_spirit("irq_no_fly_zones", "No-fly zones", "The United States and the United Kingdom enforce no-fly zones over the north and south, proclaimed after the 1991 war.", "problem", {"air_effectiveness": -0.2, "foreign_influence_resistance": -0.05}, "IRQ", "Iraqi no-fly zones"),
    start_spirit("irq_oil_reserves", "Vast oil reserves", "Iraq holds the world's fifth largest proven oil reserves.", "strength", {"fossil_output": 0.15}, "IRQ", "Petroleum industry in Iraq"),
    start_spirit("irq_war_damage", "War-damaged economy", "The Iran-Iraq War damaged the infrastructure, and the 1991 war and the sanctions hit the economy further.", "problem", {"production_efficiency": -0.08, "construction_speed": -0.05}, "IRQ", "Economy of Iraq"),
    spirit("irq_sectarian_divide", "Sectarian divide", "Distrust between Shia, Sunni and Kurdish communities shapes politics and security.", "problem", {"stability_factor": -0.04, "unrest": 0.03}),
    spirit("irq_national_reconciliation", "National reconciliation", "Power sharing and amnesties narrow the divides between communities.", "strength", {"stability_factor": 0.03, "unrest": -0.02}),
    spirit("irq_power_shortage", "Power shortages", "Generation cannot meet demand at the summer peak.", "problem", {"stability_factor": -0.02, "production_efficiency": -0.03}),
    spirit("irq_reliable_power", "Reliable power", "New plants and gas capture keep the lights on.", "strength", {"production_efficiency": 0.03}),
    spirit("irq_oil_boom", "Oil boom", "Contracts with foreign companies raise production and exports.", "strength", {"fossil_output": 0.15, "foreign_investment": 0.05}),
    spirit("irq_pmf", "Popular Mobilization Forces", "Paramilitary factions formally part of the armed forces under the prime minister.", "policy", {"manpower_factor": 0.05, "internal_security": 0.03, "political_power_gain": -0.05}),
])
write_decisions("irq", "IRQ", "Iraqi state projects", [
    ("irq_oil_contract", "Sign an oil service contract", "A service contract with a foreign oil company for a southern field.", "irq_oil_licensing", 30, [TREAS(2), MOD("fossil_output", 0.03, 1460)], None, 365),
    ("irq_power_plant", "Build a power plant", "A new plant for the summer peak.", "irq_electricity_plan", 30, [TREAS(-1), {"add_buildings": {"building": "renewable_plant", "count": 1}}, STAB(0.01)], CASH(1), 365),
    ("irq_tribal_outreach", "Outreach to the tribes", "Money and jobs for tribal leaders in the west.", "irq_awakening", 30, [UNREST(-0.03), IG("minorities", 3), TREAS(-0.3)], None, 365),
    ("irq_rebuild_a_city", "Rebuild a liberated city", "Housing, water and power for a city retaken from the Islamic State.", "irq_liberate_mosul", 30, [TREAS(-1), {"add_buildings": {"building": "infrastructure", "count": 2}}, STAB(0.01)], CASH(1), 180),
])

T = Tree("irq", "IRQ")
BAGHDAD, BASRA, KIRKUK, MOSUL, NAJAF = "IRQ-3062", "IRQ-3222", "IRQ-3049", "IRQ-3051", "IRQ-3061"
x = T.political_paths(0, "Who rules Iraq", "Which force leads Iraq: the ruling party, or one of the movements of the opposition.",
    "The established order", "Iraq is governed as it historically was in each period: by the Ba'ath Party until 2003, then by the coalitions of the new constitution.", HIST, [
    dict(key="islamist_movement", group="religious", start="The Islamist opposition", start_desc="Shia Islamist parties such as Dawa and the Supreme Council organise for power.", build=("Mosques and charities", "Religious networks build support across the south.", [IG("religious_establishment", 6)]),
         gov_name="An Islamist government", gov_desc="The most popular Islamist party forms the government.", gate=ANY({"stability_below": 0.5}, {"unrest_above": 0.2}),
         extra=[("irq_religious_law", "Religious law", "Religious law in family and public life.", [LAW("religion_state", "religious_law_partial"), T.SPIRIT("religious_revival")]),
                ("irq_shia_alliance", "Alliance with Tehran", "Close ties with Iran.", [OPN("IRN", 25), OPN("USA", -10)])]),
    dict(key="liberal_opposition", group="liberal_democratic", start="The liberal opposition", start_desc="Secular exile parties such as the Iraqi National Congress and the Iraqi National Accord press for a democratic Iraq.", build=("Exiles return", "Exiled politicians build a base at home.", [IG("urban_middle_class", 5)]),
         gov_name="A liberal government", gov_desc="The most popular liberal party forms the government and calls free elections.", gate=ANY({"stability_below": 0.5}, {"ig_approval_below": {"group": "urban_middle_class", "value": 45}}), gov_fx=[LAW("political_freedom", "free_elections")],
         extra=[("irq_open_economy", "Open the economy", "Open trade and invite foreign investment.", [LAW("trade", "free_trade"), MOD("foreign_investment", 0.1, 2920)])]),
    dict(key="workers_front", group="socialist_communist", start="The workers' front", start_desc="The Iraqi Communist Party, one of the oldest parties of the country, organises workers.", build=("Unions in the oil fields", "Unions among oil and port workers.", [IG("labour_unions", 6)]),
         gov_name="A government of the left", gov_desc="The most popular party of the left takes power.", gate=ANY({"gdp_growth_below": 1}, {"unrest_above": 0.25}), gov_type="one_party_state",
         extra=[("irq_public_oil", "Oil for the people", "Oil revenue for wages, pensions and services.", [{"set_budget": {"spending": 2}}, IG("labour_unions", 5)])]),
    dict(key="social_democrats", group="social_democratic", start="The social democrats", start_desc="Centre-left parties such as the Patriotic Union of Kurdistan campaign for a federal, secular Iraq.", build=("A federal programme", "A programme for federalism and public services.", [IG("minorities", 3), IG("labour_unions", 3)]),
         gov_name="A social-democratic government", gov_desc="The most popular social-democratic party forms the government.", gate=ANY({"stability_below": 0.5}, {"gdp_growth_below": 2}), threshold=0.15),
])

# ---- the Ba'athist state under sanctions (x 14-17): historical, until 2003
T.f("sanctions_era", "Survive the sanctions", "Run the state under the UN embargo.", 15, 0, [PP(20), STAB(0.02)], avail=BEFORE("2003-03-20"), ai=5)
T.f("oil_for_food_expansion", "More oil for food", "Press for higher oil sales under the UN programme.", 14, 1, [MOD("health_outcomes", 0.02, 1460), TREAS(0.5)], pre=["sanctions_era"], avail=BEFORE("2003-03-20"))
T.f("air_defence_network", "Air defence network", "Rebuild the air defences under the no-fly zones.", 16, 1, [MOD("army_defence", 0.02, 1460), RB("artillery_missiles", 0.15, 1)], pre=["sanctions_era"], avail=BEFORE("2003-03-20"))
T.f("rebuild_baghdad", "Rebuild the capital", "Repair roads, bridges and power stations in Baghdad.", 14, 2, [T.BUILD("infrastructure", 2, BAGHDAD), TREAS(-0.5)], pre=["oil_for_food_expansion"], avail=ALL(BEFORE("2003-03-20"), CASH(0.5)))
T.f("arab_ties", "Ties with Arab neighbours", "Restore trade with Syria, Jordan and Egypt.", 16, 2, [OPN("SYR", 10), OPN("JOR", 10), OPN("EGY", 5), MOD("trade_efficiency", 0.02, 1460)], pre=["air_defence_network"], avail=BEFORE("2003-03-20"))
T.f("republican_guard", "The Republican Guard", "Equip the elite divisions.", 15, 3, [EQUIP(400), DIVS("mechanised_division", 1)], pre=["rebuild_baghdad|arab_ties"], avail=BEFORE("2003-03-20"))

# ---- the new state (x 19-24): historical, from 2003
T.f("new_iraq", "A new Iraq", "Build the institutions of the state after the invasion of March 2003.", 21, 0, [PP(40)], avail=AFTER("2003-04-21"), ai=5)
T.f("end_of_sanctions", "The end of the sanctions", "The UN lifts the sanctions in May 2003 and the no-fly zones end.", 19, 1, [T.REMOVE("un_sanctions"), T.REMOVE("no_fly_zones"), T.REMOVE("oil_for_food"), MOD("trade_efficiency", 0.05, 1460)], pre=["new_iraq"], avail=AFTER("2003-05-22"), ai=8)
T.f("de_baathification", "De-Ba'athification", "Remove members of the Ba'ath Party from public posts, as the occupation authority ordered in May 2003.", 21, 1, [T.SPIRIT("sectarian_divide"), IG("minorities", -6), IG("security_services", -5), PP(30)], pre=["new_iraq"], avail=ALL(HIST, AFTER("2003-05-16")), ai=5)
T.f("transfer_of_sovereignty", "Return of sovereignty", "The occupation authority hands power to an Iraqi government at the end of June 2004.", 23, 1, [STAB(0.03), PP(30), MOD("foreign_influence_resistance", 0.05, 1460)], pre=["new_iraq"], avail=AFTER("2004-06-28"), ai=5)
T.f("constitution_2005", "The 2005 constitution", "A federal constitution approved in the referendum of 15 October 2005.", 21, 2, [STAB(0.03), LAW("political_freedom", "free_elections"), IG("minorities", 3)], pre=["de_baathification|transfer_of_sovereignty"], avail=AFTER("2005-10-15"), ai=5)
T.f("first_parliament", "An elected parliament", "Elect the Council of Representatives, as Iraq did on 15 December 2005.", 23, 2, [STAB(0.02), POP(0.02)], pre=["transfer_of_sovereignty"], avail=AFTER("2005-12-15"), ai=4)
T.f("awakening", "The Awakening", "Pay and arm the Sunni tribes of Anbar who turned against al-Qaeda in Iraq. Unlocks tribal outreach.", 19, 3, [UNREST(-0.05), IG("minorities", 6), DIVS("infantry_division", 1)], pre=["constitution_2005"], avail=AFTER("2006-01-01"), ai=4)
T.f("national_reconciliation", "National reconciliation", "Amnesties, power sharing and the return of former officers.", 21, 3, [T.SWAP("sectarian_divide", "national_reconciliation"), PP(-30)], pre=["awakening|first_parliament"], avail=T.HAS("sectarian_divide"), days=105, ai=3)
T.f("full_sovereignty", "Full sovereignty", "Agree the withdrawal of foreign troops, completed at the end of 2011.", 23, 3, [MOD("foreign_influence_resistance", 0.08, 2920), STAB(0.02), OPN("USA", -5)], pre=["first_parliament"], avail=AFTER("2011-12-31"), ai=4)
T.f("kurdistan_relations", "Relations with Kurdistan", "Settle budgets, oil and disputed territories with the Kurdistan Region.", 22, 4, [IG("minorities", 5), STAB(0.02)], pre=["national_reconciliation|full_sovereignty"])
T.f("referendum_response", "After the Kurdish referendum", "Restore federal control of the disputed territories after the independence referendum of 25 September 2017.", 24, 4, [STAB(0.02), IG("military", 3), IG("minorities", -5)], pre=["full_sovereignty"], avail=ALL(HIST, AFTER("2017-09-25")), ai=3)
T.f("tishreen", "Answer the protests", "Respond to the protests that began on 1 October 2019 over jobs, services and corruption.", 20, 5, [T.SPIRIT("anti_corruption_campaign"), IG("youth_students", 6), STAB(0.02)], pre=["kurdistan_relations|national_reconciliation"], avail=AFTER("2019-10-01"), ai=3)
T.f("early_elections", "Early elections", "A new electoral law and early elections.", 22, 5, [STAB(0.02), IG("youth_students", 3), {"hold_election": {"kind": "legislative"}}], pre=["tishreen"], avail=AFTER("2020-06-01"), ai=2)
T.f("integrate_pmf", "Integrate the PMF", "Bring the Popular Mobilization Forces fully under state command.", 24, 5, [T.REMOVE("pmf"), MOD("internal_security", 0.03, 2920), IG("military", 4)], pre=["referendum_response"], avail=T.HAS("pmf"), ai=2)

# ---- war with the Islamic State (x 26-30): from 2014
T.f("fall_of_mosul", "After the fall of Mosul", "Rebuild the army after the Islamic State took Mosul in June 2014.", 28, 0, [WS(0.08), STAB(-0.02), PP(30)], avail=AFTER("2014-06-10"), ai=6)
T.f("popular_mobilization", "Popular Mobilization Forces", "Volunteer factions join the fight against the Islamic State.", 26, 1, [T.SPIRIT("pmf"), DIVS("infantry_division", 3)], pre=["fall_of_mosul"], ai=5)
T.f("counter_terrorism_service", "Counter-Terrorism Service", "Expand the elite counter-terrorism units.", 28, 1, [DIVS("motorised_division", 2), MOD("army_attack", 0.02, 1460)], pre=["fall_of_mosul"], ai=5)
T.f("coalition_support", "Coalition support", "Air support, training and advisers from the international coalition.", 30, 1, [MOD("air_effectiveness", 0.05, 1460), EQUIP(800), OPN("USA", 10)], pre=["fall_of_mosul"], ai=5)
T.f("retake_anbar", "Retake Anbar", "Retake Ramadi and Fallujah.", 27, 2, [MOD("army_attack", 0.02, 1460), WS(0.03)], pre=["popular_mobilization|counter_terrorism_service"], avail=WAR_WITH("ISG"))
T.f("liberate_mosul", "Liberate Mosul", "The offensive to retake Mosul that began on 16 October 2016. Unlocks the rebuilding of liberated cities.", 29, 2, [MOD("army_attack", 0.03, 730), WS(0.03), DIVS("infantry_division", 1)], pre=["counter_terrorism_service|coalition_support"], avail=AFTER("2016-10-16"), ai=5)
T.f("victory_over_isis", "Victory over the Islamic State", "Declare the end of the war after the last towns are retaken.", 28, 3, [STAB(0.05), WS(-0.05), PP(50)], pre=["retake_anbar", "liberate_mosul"], avail={"not": {"exists": "ISG"}}, ai=5)
T.f("rebuild_the_north", "Rebuild the north", "Rebuild Mosul and the towns of Nineveh and Anbar.", 28, 4, [T.SPIRIT("reconstruction_effort"), T.BUILD("infrastructure", 3, MOSUL), TREAS(-2)], pre=["victory_over_isis"], avail=CASH(2))
T.f("border_with_syria", "Secure the Syrian border", "Fortify the western border.", 30, 3, [MOD("army_defence", 0.03, 2920), MOD("internal_security", 0.03, 2920)], pre=["liberate_mosul"])

# ---- oil and economy (x 32-38)
T.f("oil_ministry", "The oil ministry", "Plan the future of the oil industry.", 35, 0, [PP(20)], ai=4)
T.f("southern_fields", "The southern fields", "Repair wells and pipelines around Basra.", 33, 1, [T.BUILD("refinery", 1, BASRA), MOD("fossil_output", 0.05, 2920)], pre=["oil_ministry"])
T.f("kirkuk_fields", "The Kirkuk fields", "Restore output at Kirkuk.", 35, 1, [T.BUILD("refinery", 1, KIRKUK), MOD("fossil_output", 0.03, 2920)], pre=["oil_ministry"])
T.f("basra_port", "The port of Basra", "Rebuild the oil terminals and the port of Umm Qasr.", 37, 1, [T.BUILD("port", 1, BASRA), MOD("trade_efficiency", 0.03, 2920)], pre=["oil_ministry"])
T.f("oil_licensing", "Oil licensing rounds", "Award service contracts for the giant fields to foreign companies. Unlocks oil contracts.", 33, 2, [T.SPIRIT("oil_boom"), TREAS(3)], pre=["southern_fields"], avail=ALL(AFTER("2009-01-01"), NOT(T.HAS("un_sanctions"))), ai=4)
T.f("gas_capture", "Capture the flared gas", "Capture associated gas for power instead of flaring it.", 35, 2, [MOD("energy_cost", -0.03, 3650), T.BUILD("refinery", 1, BASRA)], pre=["kirkuk_fields|southern_fields"])
T.f("electricity_plan", "An electricity plan", "New power plants for the summer peak. Unlocks plant building.", 37, 2, [T.SPIRIT("power_shortage"), T.BUILD("renewable_plant", 1)], pre=["basra_port"], avail=NOT(T.HAS("un_sanctions")))
T.f("reliable_power", "Reliable power", "Enough power for the summer at last.", 37, 3, [T.SWAP("power_shortage", "reliable_power")], pre=["electricity_plan", "gas_capture"], days=140, ai=3)
T.f("rebuild_industry", "Rebuild industry", "Restart the state factories and attract private investors.", 34, 3, [T.SWAP("war_damage", "reconstruction_effort"), T.BUILD("civilian_factory", 2), TREAS(-1)], pre=["gas_capture|oil_licensing"], avail=ALL(NOT(T.HAS("un_sanctions")), CASH(1)), ai=3)
T.f("agriculture", "Farms of the two rivers", "Irrigation and credit for farmers along the Tigris and Euphrates.", 32, 3, [IG("rural", 5), MOD("gdp_growth", 0.002, 2920)], pre=["oil_licensing"])
T.f("development_road", "The development road", "A road and rail corridor from Basra to Turkey.", 36, 4, [T.BUILD("infrastructure", 3), MOD("trade_efficiency", 0.03, 3650), OPN("TUR", 5)], pre=["reliable_power|rebuild_industry"], avail=AFTER("2023-01-01"))
T.f("sovereign_fund", "A development fund", "Save oil revenue for development.", 33, 4, [T.SPIRIT("sovereign_wealth_fund"), TREAS(-2)], pre=["agriculture|rebuild_industry"], avail=CASH(2))
T.f("private_sector", "A private sector", "Banking reform and loans for small firms.", 34, 5, [MOD("private_sector_output", 0.05, 2920), MOD("interest_rate", -0.003, 2920)], pre=["sovereign_fund|development_road"])

# ---- military (x 40-44)
T.f("army_rebuilding", "Rebuild the army", "Build a new army and police.", 42, 0, [PP(10)], avail=AFTER("2003-06-01"), ai=4)
T.f("army_divisions", "New army divisions", "Recruit and train new divisions.", 40, 1, [DIVS("infantry_division", 2), EQUIP(500)], pre=["army_rebuilding"])
T.f("federal_police", "Federal police", "A national police for the cities.", 42, 1, [MOD("internal_security", 0.05, 2920)], pre=["army_rebuilding"])
T.f("air_force", "Rebuild the air force", "Buy fighters and helicopters.", 44, 1, [T.BUILD("air_base", 1), RB("air_drones", 0.2, 1)], pre=["army_rebuilding"])
T.f("armour", "Armoured divisions", "Tanks and armoured vehicles.", 40, 2, [DIVS("mechanised_division", 1), RB("armour", 0.2, 1)], pre=["army_divisions"])
T.f("intelligence", "Intelligence services", "A new intelligence service.", 42, 2, [MOD("intelligence_power", 0.05, 2920)], pre=["federal_police"])
T.f("arms_purchases", "Arms purchases", "Buy weapons from the United States, Russia and others.", 44, 2, [EQUIP(800), TREAS(-1)], pre=["air_force"], avail=CASH(1))
T.f("officer_academies", "Officer academies", "Train a new officer corps.", 41, 3, [MOD("army_org", 0.03, 2920), RB("doctrine", 0.15, 1)], pre=["armour|intelligence"])
T.f("border_guard", "Border guard", "Guard the borders with Syria and Iran.", 43, 3, [MOD("army_defence", 0.02, 2920)], pre=["arms_purchases|intelligence"])

# ---- foreign policy (x 46-50)
T.f("foreign_policy", "Foreign policy", "Iraq's place among its neighbours.", 48, 0, [PP(20)], ai=4)
T.f("iran_relations", "Relations with Iran", "Trade, gas and pilgrims.", 46, 1, [OPN("IRN", 15), MOD("energy_cost", -0.02, 2920)], pre=["foreign_policy"])
T.f("us_relations", "Relations with the United States", "A strategic framework with the United States.", 48, 1, [OPN("USA", 10), EQUIP(300)], pre=["foreign_policy"], avail=AFTER("2003-06-01"))
T.f("arab_return", "Return to the Arab fold", "Restore ties with Saudi Arabia and the Gulf.", 50, 1, [OPN("SAU", 15), OPN("KWT", 10), TREAS(0.5)], pre=["foreign_policy"], avail=AFTER("2004-01-01"))
T.f("turkey_relations", "Relations with Turkey", "Water, trade and the pipeline to Ceyhan.", 47, 2, [OPN("TUR", 10), MOD("trade_efficiency", 0.02, 2920)], pre=["iran_relations|us_relations"])
T.f("regional_mediator", "A regional mediator", "Host talks between rival neighbours.", 49, 2, [MOD("diplomatic_reputation", 0.05, 2920)], pre=["us_relations|arab_return"], avail=AFTER("2018-01-01"))
T.f("china_deals", "Deals with China", "Oil-for-construction deals with Chinese firms.", 48, 3, [OPN("CHN", 10), T.BUILD("infrastructure", 2)], pre=["turkey_relations|regional_mediator"], avail=AFTER("2015-01-01"))
# ---- more depth
T.f("marshes", "Restore the marshes", "Restore the southern marshes.", 32, 4, [IG("rural", 4), MOD("health_outcomes", 0.01, 2920)], pre=["agriculture"])
T.f("dates_and_wheat", "Dates and wheat", "Revive date palms and wheat farms.", 32, 5, [MOD("gdp_growth", 0.001, 2920), IG("rural", 3)], pre=["marshes"])
T.f("faw_port", "The Grand Faw Port", "A new deep-water port on the Gulf.", 37, 4, [T.BUILD("port", 1, BASRA), MOD("trade_efficiency", 0.03, 3650)], pre=["reliable_power|basra_port"], avail=AFTER("2010-01-01"))
T.f("refinery_karbala", "New refineries", "New refineries to end fuel imports.", 36, 5, [T.BUILD("refinery", 2), MOD("energy_cost", -0.02, 3650)], pre=["development_road|faw_port"])
T.f("housing", "Housing programme", "Housing for the growing cities.", 35, 5, [MOD("construction_speed", 0.05, 2920), IG("urban_middle_class", 3), TREAS(-1)], pre=["private_sector|development_road"], avail=CASH(1))
T.f("anti_corruption_commission", "Integrity commission", "Strengthen the commission against corruption.", 22, 6, [MOD("corruption", -0.03, 3650), IG("youth_students", 3)], pre=["early_elections|tishreen"])
T.f("special_forces", "Special forces", "Expand the special forces.", 44, 3, [DIVS("motorised_division", 1)], pre=["arms_purchases"])
T.f("river_patrol", "River and coast guard", "Patrol boats for the rivers and the Gulf.", 44, 4, [T.BUILD("port", 1), RB("naval", 0.1, 1)], pre=["special_forces"])
T.f("army_aviation", "Army aviation", "Helicopters for the army.", 42, 4, [RB("air_drones", 0.15, 1), MOD("air_effectiveness", 0.02, 2920)], pre=["officer_academies|border_guard"])
T.f("jordan_egypt", "Iraq, Jordan and Egypt", "Economic cooperation with Jordan and Egypt.", 50, 2, [OPN("JOR", 10), OPN("EGY", 10), MOD("trade_efficiency", 0.02, 2920)], pre=["arab_return"])
T.f("water_talks", "Water talks", "Talks with Turkey and Iran on the rivers.", 47, 3, [OPN("TUR", 5), OPN("IRN", 5), IG("rural", 3)], pre=["turkey_relations"])

T.write("Iraq", "Iraq in the style of the Russian model tree: the established order in each period (the Ba'athist state under sanctions until 2003, then the new constitutional state) as the historical path, and alternatives led by real parties of the data (Islamist, liberal, communist, Kurdish regionalist, social-democratic) plus a junta; branches for the sanctions era, the new state, the war with the Islamic State from 2014, oil and economy, the army and foreign policy. Sourced starting spirits in data/spirits/irq.json, decisions in data/decisions/irq.json. Wars stay in the scripted conflict events. Alternatives are a counterfactual, not a claim about the parties.",
        ["Sanctions against Iraq", "Oil-for-Food Programme", "Iraqi no-fly zones", "Petroleum industry in Iraq", "Economy of Iraq", "Coalition Provisional Authority", "De-Ba'athification",
         "2005 Iraqi constitutional referendum", "December 2005 Iraqi parliamentary election", "Sons of Iraq", "Fall of Mosul", "Popular Mobilization Forces", "Battle of Mosul (2016–2017)",
         "2017 Kurdistan Region independence referendum", "2019–2021 Iraqi protests", "Electricity sector in Iraq", "Islamic Dawa Party", "Iraqi Communist Party", "Kurdistan Democratic Party", "Patriotic Union of Kurdistan"])
