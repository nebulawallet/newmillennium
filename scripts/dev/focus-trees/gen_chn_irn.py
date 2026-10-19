"""China and Iran trees in the Russia model style. Run from the repo root."""
import sys; sys.path.insert(0, __file__.replace("\\", "/").rsplit("/", 1)[0])
from treelib import *

# ============================================================ CHINA
write_spirits("chn", "China's national spirits. The ones with `start` describe the situation on 1 January 2000 and cite sources. Values are gameplay estimates.", [
    start_spirit("chn_one_child_policy", "One-child policy", "Most families have been limited to one child since 1979.", "policy", {"population_growth": -0.004, "manpower_factor": -0.02}, "CHN", "One-child policy"),
    start_spirit("chn_hukou", "Household registration", "The hukou system ties residence and public services to a registered home.", "problem", {"production_efficiency": -0.02, "unrest": 0.01}, "CHN", "Hukou system"),
    start_spirit("chn_socialist_market_economy", "Socialist market economy", "State-owned enterprises sit alongside a large private sector.", "strength", {"state_industry_output": 0.05, "private_sector_output": 0.03}, "CHN", "Economy of China"),
    start_spirit("chn_worlds_factory", "The world's factory", "Cheap labour makes China a producer of low-cost manufactured goods for the world.", "strength", {"production_efficiency": 0.05, "trade_efficiency": 0.05}, "CHN", "Made in China 2025"),
    spirit("chn_wto_member", "WTO member", "Membership of the World Trade Organization opens export markets.", "strength", {"trade_efficiency": 0.08, "foreign_investment": 0.08}),
    spirit("chn_high_tech_industry", "High-tech industry", "Chips, electric cars and batteries made at home.", "strength", {"production_efficiency": 0.05, "research_speed": 0.05}),
    spirit("chn_two_child_policy", "Two-child policy", "Families may have two children.", "policy", {"population_growth": -0.001}),
    spirit("chn_belt_and_road", "Belt and Road", "Infrastructure loans and projects across Asia, Africa and Europe.", "policy", {"foreign_influence_power": 0.1, "trade_efficiency": 0.03}),
    spirit("chn_debt_overhang", "Local government debt", "Borrowing by local governments and developers after the stimulus.", "problem", {"interest_rate": 0.005, "construction_speed": 0.05}),
])
write_decisions("chn", "CHN", "Chinese state projects", [
    ("chn_rail_line", "Open a high-speed line", "A new high-speed railway between two provinces.", "chn_high_speed_rail", 30, [TREAS(-3), {"add_buildings": {"building": "infrastructure", "count": 3}}], CASH(3), 365),
    ("chn_brl_project", "A Belt and Road project", "Finance a port, railway or power plant abroad.", "chn_belt_and_road", 30, [TREAS(-2), MOD("foreign_influence_power", 0.03, 1460)], CASH(2), 365),
    ("chn_tech_fund", "State technology fund", "A fund for chips and new industries.", "chn_made_in_china_2025", 30, [TREAS(-2), RB("electronics_cyber", 0.25, 1)], CASH(2), 365),
])
C = Tree("chn", "CHN")
C.f("question_of_power", "The leading role of the Party", "Whether the Party's rule continues as it is or changes.", 4, 0, [PP(30)], ai=5)
C.f("steady_course", "Party leadership", "The Communist Party leads the state, as it historically did.", 1, 1, [STAB(0.04), PP(40)], pre=["question_of_power"], excl=["democracy_movement", "army_steps_in"], avail=HIST, ai=20)
C.f("three_represents", "The Three Represents", "Admit new social groups to the Party. Jiang Zemin introduced the Three Represents on 25 February 2000.", 0, 2, [IG("business", 6), PP(20)], pre=["steady_course"], avail=ALL(HIST, AFTER("2000-02-25")), ai=4)
C.f("anti_corruption", "Discipline in the Party", "A campaign against corruption among officials.", 2, 2, [C.SPIRIT("anti_corruption_campaign"), IG("security_services", 4)], pre=["steady_course"], avail=AFTER("2012-11-15"), ai=3)
C.f("social_credit", "Credit records", "National credit records for companies and people.", 1, 3, [MOD("internal_security", 0.05, 3650), MOD("tax_efficiency", 0.03, 3650), IG("youth_students", -3)], pre=["three_represents|anti_corruption"], avail=AFTER("2014-01-01"))
C.f("democracy_movement", "A democracy movement", "Liberal dissidents such as the China Democracy Party win a following in a crisis.", 4, 1, [LEAVE, GROUP("liberal_democratic", 0.04), IG("youth_students", 5), IG("security_services", -8)],
    pre=["question_of_power"], excl=["steady_course", "army_steps_in"], avail=ALL(ALT, HASP("liberal_democratic"), {"stability_below": 0.3}), ai=0.1)
C.f("democracy_wall", "Free speech", "Allow open debate and independent newspapers.", 4, 2, [GROUP("liberal_democratic", 0.06), LAW("press_freedom", "regulated_press")], pre=["democracy_movement"])
C.f("democratic_transition", "A democratic transition", "The most popular liberal party forms a transitional government and calls free elections.", 4, 3, [{"install_government": {"ideology": "liberal_democratic", "government_type": "transitional_administration"}}, LAW("political_freedom", "free_elections"), STAB(-0.08)],
    pre=["democracy_wall"], avail=SUP("liberal_democratic", 0.2), days=140)
C.f("federal_china", "A federal China", "Autonomy for the provinces and regions.", 4, 4, [C.SPIRIT("open_society"), IG("minorities", 8)], pre=["democratic_transition"])
C.f("army_steps_in", "The army steps in", "In a crisis the generals prepare to take over.", 6, 1, [LEAVE, IGI("military", 0.08)], pre=["question_of_power"], excl=["steady_course", "democracy_movement"], avail=ALL(ALT, {"stability_below": 0.2}, {"unrest_above": 0.5}), ai=0.05)
C.f("military_council", "Military council", "The army removes the government. The coup may fail.", 6, 2, [{"trigger_coup": {"by": "military", "success_chance": 0.5}}], pre=["army_steps_in"], days=35)
C.f("martial_order", "Martial order", "A state of emergency and military rule.", 6, 3, [C.SPIRIT("military_rule"), UNREST(-0.08)], pre=["military_council"], avail={"government_type": "military_junta"})
# economy
C.f("reform_and_opening", "Reform and opening up", "Continue the policy of reform and opening up.", 10, 0, [PP(30), {"add_economic_mood": 0.03}], ai=5)
C.f("wto_entry", "Join the World Trade Organization", "China joined the WTO on 11 December 2001 after lengthy negotiations.", 8, 1, [C.SPIRIT("wto_member"), IG("business", 5), IG("rural", -3)], pre=["reform_and_opening"], avail=ALL(HIST, AFTER("2001-12-11")), ai=6)
C.f("state_enterprise_reform", "State enterprise reform", "Restructure loss-making state enterprises.", 10, 1, [MOD("state_industry_output", 0.04, 2920), IG("labour_unions", -5), C.BUILD("civilian_factory", 2)], pre=["reform_and_opening"])
C.f("western_development", "Western Development", "Invest in the western provinces and regions to reduce the gap with the coast.", 12, 1, [C.BUILD("infrastructure", 4), C.BUILD("civilian_factory", 2), IG("minorities", 3)], pre=["reform_and_opening"], ai=4)
C.f("export_zones", "Coastal export zones", "Expand export manufacturing on the coast.", 8, 2, [C.BUILD("civilian_factory", 4), C.BUILD("port", 2)], pre=["wto_entry"])
C.f("go_out", "Go Out", "Encourage Chinese companies to invest abroad.", 10, 2, [MOD("foreign_influence_power", 0.05, 2920), TREAS(-2)], pre=["state_enterprise_reform"], avail=CASH(2))
C.f("three_gorges", "Three Gorges Dam", "Finish the dam on the Yangtze, the largest power station in the world; the dam body was completed in 2006.", 12, 2, [C.BUILD("renewable_plant", 3), MOD("energy_cost", -0.04, 3650)], pre=["western_development"], avail=AFTER("2006-01-01"), ai=4)
C.f("stimulus_2008", "The 2008 stimulus", "A stimulus of 4 trillion yuan against the global recession, announced on 9 November 2008.", 9, 3, [C.BUILD("infrastructure", 6), MOD("gdp_growth", 0.01, 1095), C.SPIRIT("debt_overhang"), TREAS(-10)], pre=["export_zones|go_out"], avail=ALL(AFTER("2008-11-09"), CASH(10)), ai=4)
C.f("high_speed_rail", "High-speed rail", "Build the world's longest high-speed rail network. Unlocks new lines.", 11, 3, [C.BUILD("infrastructure", 5), MOD("trade_efficiency", 0.03, 3650)], pre=["three_gorges|go_out"], avail=AFTER("2007-01-01"))
C.f("deleveraging", "Control local debt", "Rein in borrowing by local governments.", 9, 4, [C.REMOVE("debt_overhang"), MOD("gdp_growth", -0.002, 1095)], pre=["stimulus_2008"], avail=C.HAS("debt_overhang"), days=140, ai=3)
C.f("made_in_china_2025", "Made in China 2025", "An industrial plan, signed in May 2015, to move up from cheap manufacturing to high technology. Unlocks a state technology fund.", 11, 4, [C.SWAP("worlds_factory", "high_tech_industry"), RB("electronics_cyber", 0.25, 2), C.BUILD("data_centre", 2)], pre=["high_speed_rail"], avail=AFTER("2015-05-01"), ai=4)
C.f("electric_vehicles", "Electric vehicles", "Subsidies for electric cars and batteries.", 10, 5, [C.BUILD("civilian_factory", 3), MOD("renewable_output", 0.1, 3650)], pre=["made_in_china_2025|deleveraging"])
C.f("domestic_demand", "Domestic demand first", "Rely more on domestic consumption and self-reliance.", 12, 5, [MOD("foreign_influence_resistance", 0.08, 3650), MOD("private_sector_output", 0.03, 2920)], pre=["made_in_china_2025"], avail=AFTER("2020-01-01"))
C.f("solar_and_wind", "Solar and wind", "The largest solar and wind build-out in the world.", 11, 6, [C.BUILD("renewable_plant", 4), MOD("energy_cost", -0.03, 3650)], pre=["electric_vehicles|domestic_demand"])
# society
C.f("social_policy", "A moderately prosperous society", "Health, schools and pensions for everyone.", 16, 0, [PP(20)], ai=4)
C.f("rural_health", "Rural health insurance", "Health insurance for the countryside.", 15, 1, [MOD("health_outcomes", 0.04, 3650), IG("rural", 5), TREAS(-1)], pre=["social_policy"], avail=CASH(1))
C.f("hukou_reform", "Hukou reform", "Let migrant workers register in the cities where they work.", 17, 1, [C.REMOVE("hukou"), IG("urban_middle_class", 3), IG("rural", 4)], pre=["social_policy"], avail=AFTER("2014-01-01"), days=140, ai=3)
C.f("two_child_policy", "Two-child policy", "Allow two children per family, as from 2016.", 15, 2, [C.SWAP("one_child_policy", "two_child_policy")], pre=["rural_health"], avail=AFTER("2016-01-01"), ai=4)
C.f("three_child_policy", "Three-child policy", "Allow three children per family, as from 2021.", 15, 3, [C.REMOVE("two_child_policy"), MOD("population_growth", 0.001, 3650)], pre=["two_child_policy"], avail=AFTER("2021-01-01"), ai=3)
C.f("universities", "World-class universities", "Fund leading universities.", 17, 2, [MOD("education_quality", 0.04, 3650), RB("economy_digital", 0.2, 2)], pre=["hukou_reform|social_policy"])
C.f("beijing_olympics", "The Beijing Olympics", "Host the Olympic Games in Beijing, 8 to 24 August 2008.", 16, 3, [STAB(0.03), MOD("diplomatic_reputation", 0.05, 1460), C.BUILD("infrastructure", 2)], pre=["universities|rural_health"], avail=ALL(AFTER("2008-08-08"), BEFORE("2009-06-01")), ai=4)
C.f("space_programme", "Space programme", "Crewed flights, a space station and lunar probes.", 17, 3, [RB("air_drones", 0.2, 2), MOD("diplomatic_reputation", 0.03, 2920)], pre=["universities"])
C.f("pensions", "Pensions for all", "A basic pension for rural and urban residents.", 16, 4, [IG("rural", 4), {"set_budget": {"spending": 0.5}}], pre=["beijing_olympics|three_child_policy"])
# military
C.f("military_modernisation", "Military modernisation", "Shift the armed forces from numbers to technology.", 21, 0, [MOD("army_org", 0.03, 2920), IG("military", 4)], ai=4)
C.f("navy", "A blue-water navy", "Aircraft carriers, destroyers and submarines.", 19, 1, [C.BUILD("port", 2), RB("naval", 0.25, 2), C.BUILD("military_factory", 2)], pre=["military_modernisation"])
C.f("rocket_force", "Missile forces", "Expand the missile forces.", 21, 1, [RB("artillery_missiles", 0.25, 2)], pre=["military_modernisation"])
C.f("air_force", "A modern air force", "Stealth fighters and modern air bases.", 23, 1, [C.BUILD("air_base", 2), RB("air_drones", 0.2, 2)], pre=["military_modernisation"])
C.f("defence_industry", "Defence industry", "Large state defence corporations.", 21, 2, [C.BUILD("military_factory", 4), EQUIP(3000)], pre=["navy|rocket_force|air_force"])
C.f("army_reform", "Theatre commands", "Reorganise the army into joint theatre commands.", 19, 2, [MOD("army_org", 0.04, 3650), RB("doctrine", 0.25, 2)], pre=["navy"], avail=AFTER("2015-01-01"))
C.f("cyber_force", "Cyber and space forces", "A force for cyber, space and electronic warfare.", 23, 2, [RB("electronics_cyber", 0.25, 2), MOD("intelligence_power", 0.05, 3650)], pre=["air_force"], avail=AFTER("2015-01-01"))
C.f("south_china_sea", "Bases in the South China Sea", "Build up reefs into bases.", 20, 3, [C.BUILD("air_base", 1), C.BUILD("port", 1), OPN("VNM", -15), OPN("PHL", -15)], pre=["army_reform|defence_industry"], avail=AFTER("2013-01-01"))
C.f("overseas_base", "An overseas base", "A support base abroad for the navy.", 22, 3, [MOD("foreign_influence_power", 0.05, 3650)], pre=["defence_industry|cyber_force"], avail=AFTER("2016-01-01"))
C.f("reunification_drills", "Pressure on Taiwan", "Large exercises around Taiwan and a claim on the island.", 21, 4, [{"add_claim": {"regions": [{"from": "TWN"}]}}, OPN("TWN", -20), OPN("USA", -10), WS(0.05)], pre=["south_china_sea|overseas_base"], avail=AFTER("2016-01-01"))
# foreign
C.f("foreign_policy", "Foreign policy", "China's place in the world.", 27, 0, [PP(20)], ai=4)
C.f("good_neighbours", "Good neighbours", "Settle borders and expand trade with the neighbours.", 25, 1, [OPN("RUS", 10), OPN("KAZ", 10), OPN("VNM", 5)], pre=["foreign_policy"])
C.f("sco", "Shanghai Cooperation Organisation", "Security cooperation with Russia and Central Asia.", 27, 1, [OPN("RUS", 10), OPN("UZB", 10), MOD("bloc_integration", 0.05, 2920)], pre=["foreign_policy"])
C.f("africa_ties", "China and Africa", "Loans, trade and infrastructure in Africa.", 29, 1, [MOD("foreign_influence_power", 0.05, 2920), TREAS(-1)], pre=["foreign_policy"], avail=CASH(1))
C.f("belt_and_road", "Belt and Road Initiative", "Infrastructure across Asia, Africa and Europe, announced in 2013. Unlocks overseas projects.", 27, 2, [C.SPIRIT("belt_and_road"), TREAS(-3)], pre=["good_neighbours|sco|africa_ties"], avail=ALL(AFTER("2013-09-01"), CASH(3)), ai=4)
C.f("russia_partnership", "Partnership with Russia", "Energy, arms and diplomacy with Russia.", 25, 2, [OPN("RUS", 15), MOD("energy_cost", -0.02, 2920)], pre=["good_neighbours|sco"])
C.f("asian_bank", "An Asian development bank", "A new development bank for Asia's infrastructure.", 29, 2, [MOD("diplomatic_reputation", 0.04, 3650), TREAS(-1)], pre=["africa_ties"], avail=AFTER("2015-01-01"))
C.f("global_development", "Global initiatives", "Development and security initiatives for the Global South.", 27, 3, [MOD("foreign_influence_power", 0.05, 3650)], pre=["belt_and_road|asian_bank"], avail=AFTER("2021-01-01"))
C.f("trade_war", "Answer the trade war", "Tariffs and controls in response to US tariffs.", 25, 3, [OPN("USA", -15), MOD("foreign_influence_resistance", 0.05, 2920)], pre=["russia_partnership"], avail=AFTER("2018-06-01"))
# ---- more depth
C.f("pearl_river_delta", "The Pearl River Delta", "Factories and ports around Guangzhou and Shenzhen.", 7, 3, [C.BUILD("civilian_factory", 3), C.BUILD("port", 1)], pre=["export_zones"])
C.f("yangtze_delta", "The Yangtze Delta", "Industry and finance around Shanghai.", 7, 4, [C.BUILD("civilian_factory", 3), C.BUILD("data_centre", 1)], pre=["pearl_river_delta"])
C.f("northeast_revival", "Revive the north-east", "Restructure the old industrial base of the north-east.", 13, 3, [C.BUILD("civilian_factory", 2), IG("labour_unions", 3)], pre=["western_development"], avail=AFTER("2003-01-01"))
C.f("rise_of_central_china", "The rise of central China", "Investment in the central provinces.", 13, 4, [C.BUILD("infrastructure", 3), C.BUILD("civilian_factory", 2)], pre=["northeast_revival|high_speed_rail"], avail=AFTER("2004-01-01"))
C.f("coal_power", "Coal power", "Build coal power plants to meet demand.", 8, 5, [MOD("energy_cost", -0.03, 3650), C.BUILD("refinery", 1)], pre=["stimulus_2008|export_zones"])
C.f("nuclear_power", "Nuclear power", "A large programme of nuclear reactors.", 12, 7, [MOD("nuclear_output", 0.1, 3650), RB("industry_energy", 0.2, 2)], pre=["solar_and_wind"])
C.f("semiconductors", "Semiconductors", "A national effort to make advanced chips.", 13, 6, [C.BUILD("civilian_factory", 2), RB("electronics_cyber", 0.3, 2)], pre=["domestic_demand"], avail=AFTER("2014-01-01"))
C.f("artificial_intelligence", "Artificial intelligence", "A national plan for artificial intelligence.", 13, 7, [C.BUILD("data_centre", 3), RB("economy_digital", 0.3, 2)], pre=["semiconductors"], avail=AFTER("2017-01-01"))
C.f("digital_payments", "Digital payments", "Mobile payments and a digital currency.", 9, 6, [MOD("tax_efficiency", 0.03, 3650), C.BUILD("data_centre", 1)], pre=["electric_vehicles"])
C.f("financial_reform", "Financial reform", "Open the capital markets step by step.", 9, 5, [MOD("foreign_investment", 0.05, 2920), MOD("interest_rate", -0.003, 2920)], pre=["deleveraging|stimulus_2008"])
C.f("grain_security", "Grain security", "Protect farmland and grain output.", 14, 1, [IG("rural", 5), MOD("gdp_growth", 0.001, 3650)], pre=["social_policy|western_development"])
C.f("poverty_alleviation", "End extreme poverty", "Targeted programmes to lift the poorest villages out of poverty.", 14, 2, [IG("rural", 6), {"set_budget": {"spending": 0.5}}, STAB(0.02)], pre=["grain_security"], avail=AFTER("2013-01-01"))
C.f("urbanisation", "New urbanisation", "Move hundreds of millions to the cities.", 14, 3, [C.BUILD("infrastructure", 3), MOD("construction_speed", 0.05, 2920)], pre=["poverty_alleviation|hukou_reform"])
C.f("clean_air", "Clean air", "Cut coal use and pollution in the cities.", 14, 4, [MOD("health_outcomes", 0.03, 3650), MOD("energy_cost", 0.02, 2920)], pre=["urbanisation"], avail=AFTER("2013-01-01"))
C.f("ageing_society", "An ageing society", "Pensions and care for the elderly.", 15, 4, [{"set_budget": {"spending": 0.5}}, IG("rural", 3)], pre=["three_child_policy"])
C.f("hong_kong_macau", "Hong Kong and Macau", "Integrate Hong Kong and Macau with the Greater Bay Area.", 17, 4, [MOD("trade_efficiency", 0.03, 2920), C.BUILD("infrastructure", 1)], pre=["space_programme"])
C.f("tibet_xinjiang", "Development of the western regions", "Railways and investment in Tibet and Xinjiang.", 17, 5, [C.BUILD("infrastructure", 2), MOD("internal_security", 0.03, 2920), IG("minorities", -3)], pre=["hong_kong_macau|pensions"])
C.f("carriers", "Aircraft carriers", "Build aircraft carriers at home.", 19, 3, [RB("naval", 0.3, 2), C.BUILD("port", 1)], pre=["army_reform|defence_industry"], avail=AFTER("2012-01-01"))
C.f("amphibious", "Amphibious forces", "Landing ships and marines.", 19, 4, [DIVS("motorised_division", 2), RB("naval", 0.2, 1)], pre=["carriers"])
C.f("hypersonic", "Hypersonic missiles", "Hypersonic glide vehicles.", 23, 3, [RB("artillery_missiles", 0.3, 2)], pre=["cyber_force"], avail=AFTER("2017-01-01"))
C.f("drones", "Military drones", "Drones for all services.", 23, 4, [RB("air_drones", 0.3, 2)], pre=["hypersonic"])
C.f("pla_professional", "A professional army", "Cut the army and raise its training.", 20, 5, [MOD("army_org", 0.04, 3650), MOD("training_time", -0.1, 3650)], pre=["amphibious|reunification_drills"])
C.f("europe_trade", "Trade with Europe", "Freight trains and investment in Europe.", 29, 3, [OPN("DEU", 10), MOD("trade_efficiency", 0.03, 2920)], pre=["asian_bank"])
C.f("latin_america", "Partners in Latin America", "Trade and loans in Latin America.", 29, 4, [OPN("BRA", 10), OPN("ARG", 10), MOD("foreign_influence_power", 0.03, 2920)], pre=["europe_trade|global_development"])
C.f("brics", "Emerging economies", "Cooperation with Brazil, Russia, India and South Africa.", 26, 4, [MOD("diplomatic_reputation", 0.03, 2920), OPN("IND", 5)], pre=["trade_war|global_development"], avail=AFTER("2009-01-01"))
C.f("middle_east_mediation", "Mediation in the Middle East", "Broker talks between Saudi Arabia and Iran.", 28, 4, [OPN("SAU", 10), OPN("IRN", 10), MOD("diplomatic_reputation", 0.03, 2920)], pre=["global_development"], avail=AFTER("2023-01-01"))
C.f("asean_trade", "Free trade with ASEAN", "A free-trade area with South-East Asia.", 25, 4, [MOD("trade_efficiency", 0.04, 3650), OPN("VNM", 5), OPN("IDN", 10)], pre=["russia_partnership|trade_war"])

C.write("China", "China in the style of the Russian model tree: Party leadership as the historical path, a democratic transition led by a real party of the data (the China Democracy Party) and a junta as alternatives; economy (WTO, Western Development, the 2008 stimulus, high-speed rail, Made in China 2025), society (the one-, two- and three-child policies, hukou reform), military and foreign policy (Belt and Road). Sourced starting spirits in data/spirits/chn.json. Alternatives are a counterfactual.",
        ["Three Represents", "China Western Development", "Go Out policy", "One-child policy", "Hukou system", "Economy of China", "Made in China 2025", "China and the World Trade Organization", "Three Gorges Dam",
         "2008 Chinese economic stimulus plan", "High-speed rail in China", "2008 Summer Olympics", "Belt and Road Initiative", "Two-child policy"])

# ============================================================ IRAN
write_spirits("irn", "Iran's national spirits. The ones with `start` describe the situation on 1 January 2000 and cite sources. Values are gameplay estimates.", [
    start_spirit("irn_energy_reserves", "Oil and gas reserves", "Iran holds about a tenth of the world's proven oil reserves and about a seventh of its gas reserves.", "strength", {"fossil_output": 0.15}, "IRN", "Economy of Iran"),
    start_spirit("irn_public_sector", "A large public sector", "The economy is mixed, with a large public sector.", "policy", {"state_industry_output": 0.05, "private_sector_output": -0.03}, "IRN", "Economy of Iran"),
    start_spirit("irn_war_legacy", "Legacy of the war with Iraq", "The war with Iraq from 1980 to 1988 left deep losses and a culture of self-reliance in defence.", "policy", {"war_support_factor": 0.03, "foreign_influence_resistance": 0.05}, "IRN", "Iran–Iraq War"),
    spirit("irn_nuclear_sanctions", "Nuclear sanctions", "International sanctions over the nuclear programme.", "problem", {"trade_efficiency": -0.15, "foreign_investment": -0.15, "fossil_output": -0.1}),
    spirit("irn_resistance_economy", "Resistance economy", "Self-reliance in industry and finance under sanctions.", "policy", {"state_industry_output": 0.04, "foreign_influence_resistance": 0.08, "trade_efficiency": -0.03}),
    spirit("irn_gas_exporter", "South Pars gas", "Gas from the world's largest gas field for power and exports.", "strength", {"energy_cost": -0.04, "fossil_output": 0.1}),
])
write_decisions("irn", "IRN", "Iranian state projects", [
    ("irn_south_pars_phase", "Open a South Pars phase", "Bring another phase of the gas field into production.", "irn_south_pars", 30, [TREAS(-1), {"add_buildings": {"building": "refinery", "count": 1}}], CASH(1), 365),
    ("irn_missile_test", "Missile test", "Test a new missile.", "irn_missile_forces", 25, [WS(0.02), RB("artillery_missiles", 0.15, 1)], None, 365),
])
I = Tree("irn", "IRN")
I.f("question_of_power", "The direction of the Islamic Republic", "Which camp leads the government within the Islamic Republic.", 4, 0, [PP(30)], ai=5)
I.f("steady_course", "The Islamic Republic", "The government changes hands between the camps through elections, as it historically did.", 1, 1, [STAB(0.04), PP(40)], pre=["question_of_power"], excl=["reformist_turn", "principlist_turn", "army_steps_in"], avail=HIST, ai=20)
I.f("dialogue_among_civilizations", "Dialogue Among Civilizations", "Promote dialogue with other cultures, the idea President Mohammad Khatami put forward.", 0, 2, [MOD("diplomatic_reputation", 0.04, 2920), OPN("FRA", 5), OPN("DEU", 5)], pre=["steady_course"], avail=I.PRES("irn.mohammad_khatami", "irn.president"), ai=4)
I.f("revolutionary_values", "Revolutionary values", "Reassert the values of the revolution.", 2, 2, [IG("religious_establishment", 5), MOD("internal_security", 0.03, 2920)], pre=["steady_course"], avail={"ruling_party": "irn.principlists"})
I.f("reformist_turn", "A reformist turn", "The reformist camp presses for more freedom and openness.", 4, 1, [LEAVE, IG("urban_middle_class", 5), IG("youth_students", 5)], pre=["question_of_power"], excl=["steady_course", "principlist_turn", "army_steps_in"], avail=ALL(ALT, {"party_exists": "irn.reformists"}, NOT({"ruling_party": "irn.reformists"})), ai=0.3)
I.f("reformist_government", "A reformist government", "The reformists form the government.", 4, 2, [{"install_government": {"party": "irn.reformists"}}, LAW("press_freedom", "regulated_press")], pre=["reformist_turn"], avail={"party_popularity_above": {"party": "irn.reformists", "value": 0.25}}, days=105)
I.f("civil_society", "Civil society", "More room for newspapers and associations.", 4, 3, [MOD("civil_liberties", 0.08, 2920), IG("media", 6)], pre=["reformist_government"])
I.f("principlist_turn", "A principlist turn", "The principlist camp presses for revolutionary values and self-reliance.", 6, 1, [LEAVE, IG("religious_establishment", 5), IG("security_services", 4)], pre=["question_of_power"], excl=["steady_course", "reformist_turn", "army_steps_in"], avail=ALL(ALT, {"party_exists": "irn.principlists"}, NOT({"ruling_party": "irn.principlists"})), ai=0.3)
I.f("principlist_government", "A principlist government", "The principlists form the government.", 6, 2, [{"install_government": {"party": "irn.principlists"}}, LAW("press_freedom", "state_controlled_media")], pre=["principlist_turn"], avail={"party_popularity_above": {"party": "irn.principlists", "value": 0.25}}, days=105)
I.f("guards_in_economy", "The Guards in the economy", "Revolutionary Guards companies take large state contracts.", 6, 3, [MOD("state_industry_output", 0.04, 2920), IG("military", 4), IG("business", -3)], pre=["principlist_government"])
I.f("army_steps_in", "The Guards step in", "In a crisis the Revolutionary Guards prepare to take over.", 8, 1, [LEAVE, IGI("military", 0.08)], pre=["question_of_power"], excl=["steady_course", "reformist_turn", "principlist_turn"], avail=ALL(ALT, {"stability_below": 0.25}, {"unrest_above": 0.4}), ai=0.1)
I.f("military_council", "Military council", "The Guards remove the government. The coup may fail.", 8, 2, [{"trigger_coup": {"by": "military", "success_chance": 0.5}}], pre=["army_steps_in"], days=35)
I.f("martial_order", "Martial order", "Military rule and a state of emergency.", 8, 3, [I.SPIRIT("military_rule"), UNREST(-0.08)], pre=["military_council"], avail={"government_type": "military_junta"})
# nuclear and sanctions
I.f("nuclear_programme", "The nuclear programme", "Expand enrichment for a civilian programme; the IAEA board found Iran in non-compliance with its obligations, and sanctions followed.", 12, 0, [I.SPIRIT("nuclear_sanctions"), MOD("nuclear_output", 0.05, 3650), RB("industry_energy", 0.2, 2)], avail=AFTER("2003-01-01"), ai=3)
I.f("resistance_economy", "A resistance economy", "Self-reliance in industry and finance under sanctions.", 11, 1, [I.SPIRIT("resistance_economy"), I.BUILD("civilian_factory", 2)], pre=["nuclear_programme"])
I.f("nuclear_deal", "The nuclear deal", "Limit the nuclear programme in return for sanctions relief: the Joint Comprehensive Plan of Action, finalised in Vienna on 14 July 2015.", 13, 1, [I.REMOVE("nuclear_sanctions"), MOD("foreign_investment", 0.05, 2920), OPN("FRA", 10), OPN("DEU", 10)], pre=["nuclear_programme"], avail=ALL(AFTER("2015-07-14"), I.HAS("nuclear_sanctions")), ai=4)
I.f("sanctions_evasion", "Trade with the East", "Sell oil to Asian buyers despite sanctions.", 11, 2, [TREAS(1), OPN("CHN", 10)], pre=["resistance_economy"])
I.f("deal_economy", "Open to investment", "Invite European and Asian companies after the deal.", 13, 2, [MOD("foreign_investment", 0.05, 2920), I.BUILD("civilian_factory", 1)], pre=["nuclear_deal"])
# economy
I.f("oil_ministry", "Oil and gas", "Raise oil and gas output and manage the revenue.", 17, 0, [PP(20)], ai=4)
I.f("south_pars", "South Pars", "Develop Iran's share of South Pars, the world's largest gas field. Unlocks new phases.", 16, 1, [I.SPIRIT("gas_exporter"), I.BUILD("refinery", 2)], pre=["oil_ministry"], ai=4)
I.f("refineries", "Refineries at home", "Refine petrol at home instead of importing it.", 18, 1, [I.BUILD("refinery", 2), MOD("energy_cost", -0.02, 3650)], pre=["oil_ministry"])
I.f("petrochemicals", "Petrochemicals", "Petrochemical plants on the Gulf coast.", 16, 2, [I.BUILD("civilian_factory", 2), MOD("trade_efficiency", 0.02, 2920)], pre=["south_pars"])
I.f("subsidy_reform", "Cash for subsidies", "Replace fuel subsidies with cash payments.", 18, 2, [MOD("welfare_cost", -0.01, 3650), UNREST(0.02), IG("rural", 3)], pre=["refineries"], avail=AFTER("2010-01-01"))
I.f("car_industry", "Car industry", "Expand the car makers.", 17, 3, [I.BUILD("civilian_factory", 2)], pre=["petrochemicals|subsidy_reform"])
I.f("privatisation", "Privatisation", "Sell state companies.", 18, 3, [I.SWAP("public_sector", "export_led_growth"), IG("business", 5)], pre=["subsidy_reform"], days=105)
I.f("tehran_metro", "Metro and rail", "Metro lines and railways.", 16, 3, [I.BUILD("infrastructure", 3), TREAS(-1)], pre=["petrochemicals"], avail=CASH(1))
I.f("knowledge_economy", "Knowledge-based companies", "Tax breaks for technology start-ups.", 17, 4, [RB("economy_digital", 0.2, 2), I.BUILD("data_centre", 1)], pre=["car_industry|tehran_metro|privatisation"])
# military
I.f("defence_review", "Defence review", "Strategy, forces and budgets.", 22, 0, [IG("military", 3)], ai=4)
I.f("missile_forces", "Missile forces", "Expand the missile forces. Unlocks missile tests.", 21, 1, [RB("artillery_missiles", 0.3, 2), I.BUILD("military_factory", 1)], pre=["defence_review"])
I.f("drones", "Drones", "Develop and build drones.", 23, 1, [RB("air_drones", 0.25, 2), I.BUILD("military_factory", 1)], pre=["defence_review"])
I.f("naval_forces", "Naval forces in the Gulf", "Fast boats and coastal missiles.", 21, 2, [RB("naval", 0.2, 1), I.BUILD("port", 1)], pre=["missile_forces"])
I.f("basij", "The Basij", "Train the volunteer militia.", 23, 2, [MOD("manpower_factor", 0.04, 2920), DIVS("infantry_division", 2)], pre=["drones"])
I.f("air_defence", "Air defence", "Air defence around nuclear sites and cities.", 22, 3, [MOD("army_defence", 0.03, 2920)], pre=["naval_forces|basij"])
I.f("arms_industry", "Self-sufficiency in arms", "Domestic tanks, aircraft and munitions.", 22, 4, [I.BUILD("military_factory", 2), EQUIP(1000)], pre=["air_defence"])
# foreign
I.f("foreign_policy", "Foreign policy", "Iran among its neighbours and the powers.", 27, 0, [PP(20)], ai=4)
I.f("iraq_ties", "Ties with Iraq", "Trade, gas and pilgrims with the new Iraq.", 25, 1, [OPN("IRQ", 15)], pre=["foreign_policy"], avail=AFTER("2004-01-01"))
I.f("syria_alliance", "Alliance with Syria", "A strategic alliance with Damascus.", 27, 1, [OPN("SYR", 15), MOD("foreign_influence_power", 0.05, 2920)], pre=["foreign_policy"])
I.f("lebanon_ties", "Ties in Lebanon", "Support for allies in Lebanon.", 29, 1, [OPN("LBN", 10), MOD("foreign_influence_power", 0.05, 2920)], pre=["foreign_policy"])
I.f("look_east", "Look East", "Close ties with Russia and China.", 26, 2, [OPN("RUS", 15), OPN("CHN", 15)], pre=["iraq_ties|syria_alliance"])
I.f("gulf_detente", "Detente with the Gulf", "Restore relations with Saudi Arabia.", 28, 2, [OPN("SAU", 20), STAB(0.01)], pre=["syria_alliance|lebanon_ties"], avail=AFTER("2023-01-01"))
I.f("sco_brics", "Join the eastern blocs", "Membership of the Shanghai Cooperation Organisation.", 27, 3, [MOD("diplomatic_reputation", 0.03, 2920), OPN("CHN", 5)], pre=["look_east|gulf_detente"], avail=AFTER("2021-01-01"))
# ---- more depth
I.f("electricity", "Power plants", "Gas power plants and grid expansion.", 18, 4, [I.BUILD("renewable_plant", 1), MOD("energy_cost", -0.02, 3650)], pre=["car_industry|privatisation"])
I.f("water_crisis", "Save the water", "Dams, canals and limits on wells against drought.", 16, 4, [IG("rural", 4), TREAS(-0.5)], pre=["tehran_metro"], avail=CASH(0.5))
I.f("agriculture", "Self-sufficiency in wheat", "Support wheat farmers.", 15, 4, [IG("rural", 5), MOD("gdp_growth", 0.001, 3650)], pre=["water_crisis"])
I.f("steel", "Steel industry", "Steel mills in Isfahan and the south.", 18, 5, [I.BUILD("civilian_factory", 2)], pre=["electricity"])
I.f("free_zones", "Free trade zones", "Kish, Qeshm and Chabahar as free zones.", 16, 5, [I.BUILD("port", 1), MOD("trade_efficiency", 0.03, 2920)], pre=["agriculture|knowledge_economy"])
I.f("north_south_corridor", "The north-south corridor", "A trade route from India through Iran to Russia.", 17, 6, [I.BUILD("infrastructure", 3), OPN("IND", 10), OPN("RUS", 5)], pre=["free_zones|steel"])
I.f("tourism", "Tourism", "Hotels for visitors to the historic cities.", 15, 5, [MOD("gdp_growth", 0.001, 2920)], pre=["agriculture"])
I.f("space_programme", "Space programme", "Satellites and launchers.", 21, 3, [RB("air_drones", 0.2, 1), MOD("diplomatic_reputation", 0.02, 2920)], pre=["missile_forces|naval_forces"])
I.f("cyber_army", "Cyber forces", "A cyber command.", 23, 3, [RB("electronics_cyber", 0.25, 2), MOD("intelligence_power", 0.05, 3650)], pre=["basij"])
I.f("ground_forces", "Ground forces", "Modernise the army's ground forces.", 21, 4, [DIVS("mechanised_division", 1), RB("armour", 0.2, 1)], pre=["space_programme|air_defence"])
I.f("quds_force", "Regional allies", "Train and arm allied groups abroad.", 23, 4, [MOD("foreign_influence_power", 0.08, 2920), TREAS(-0.5)], pre=["cyber_army|air_defence"])
I.f("deterrence", "Deterrence doctrine", "A doctrine of deterrence through missiles and allies.", 22, 5, [WS(0.03), MOD("army_defence", 0.02, 2920)], pre=["arms_industry|quds_force|ground_forces"])
I.f("health_network", "Rural health houses", "Health houses in every village.", 11, 3, [MOD("health_outcomes", 0.03, 3650), IG("rural", 3)], pre=["sanctions_evasion"])
I.f("universities", "Universities", "More universities and research centres.", 13, 3, [MOD("education_quality", 0.04, 3650), RB("economy_digital", 0.2, 1)], pre=["deal_economy"])
I.f("nanotechnology", "Nanotechnology and biotech", "Research in nanotechnology and medicine.", 12, 4, [RB("electronics_cyber", 0.2, 1), MOD("research_speed", 0.03, 2920)], pre=["health_network|universities"])
I.f("internet", "The national internet", "A national information network.", 12, 5, [LAW("internet_surveillance", "filtered_internet"), MOD("foreign_influence_resistance", 0.05, 3650), IG("youth_students", -5)], pre=["nanotechnology"])
I.f("protests_response", "Answer the protests", "Respond to the protests that began on 16 September 2022.", 10, 4, [UNREST(-0.04), IG("youth_students", -4), IG("security_services", 4)], pre=["civil_society|guards_in_economy|steady_course"], avail=AFTER("2022-09-16"))
I.f("caspian", "The Caspian", "Oil, gas and ports on the Caspian Sea.", 25, 2, [I.BUILD("port", 1), OPN("RUS", 5), OPN("KAZ", 5)], pre=["look_east"])
I.f("afghan_border", "The eastern border", "Water, trade and refugees on the Afghan border.", 25, 3, [OPN("AFG", 10), MOD("internal_security", 0.02, 2920)], pre=["caspian"])
I.f("turkey_trade", "Trade with Turkey", "Gas and trade with Turkey.", 29, 2, [OPN("TUR", 10), TREAS(0.5)], pre=["lebanon_ties"])
I.f("europe_talks", "Talks with Europe", "Diplomacy with the European powers.", 29, 3, [OPN("FRA", 5), OPN("DEU", 5), OPN("GBR", 5)], pre=["turkey_trade|gulf_detente"])

I.write("Iran", "Iran in the style of the Russian model tree: the Islamic Republic with elections between camps as the historical path; reformist and principlist turns that install real parties of the data, and a Guards takeover; nuclear programme and sanctions (the JCPOA), oil and gas (South Pars), military and foreign policy branches. Sourced starting spirits in data/spirits/irn.json. Alternatives are a counterfactual.",
        ["Dialogue Among Civilizations", "Economy of Iran", "Iran–Iraq War", "Mohammad Khatami", "Joint Comprehensive Plan of Action", "Iran and weapons of mass destruction", "South Pars/North Dome Gas-Condensate field", "Islamic Revolutionary Guard Corps"])
