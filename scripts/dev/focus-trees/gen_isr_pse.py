"""Israel and Palestine trees in the Russia model style. Run from the repo root."""
import sys; sys.path.insert(0, __file__.rsplit("\\", 1)[0].rsplit("/", 1)[0])
from treelib import *

# ============================================================ ISRAEL
write_spirits("isr", "Israel's national spirits. The ones with `start` describe the situation on 1 January 2000 and cite sources; the others are granted by focuses and decisions. Values are gameplay estimates.", [
    start_spirit("isr_conscription", "Compulsory service", "Fixed-term military service has been compulsory since 1948 for Jewish men and women and for Druze and Circassian men.", "strength", {"manpower_factor": 0.05, "army_org": 0.03}, "ISR", "Conscription in Israel"),
    start_spirit("isr_start_up_nation", "Start-up nation", "The Silicon Wadi on the coastal plain is a global centre of advanced technology.", "strength", {"research_speed": 0.05, "private_sector_output": 0.03}, "ISR", "Silicon Wadi"),
    start_spirit("isr_oslo_framework", "The Oslo framework", "The interim Israel-PLO agreements of 1993 and 1995 set the frame for relations with the Palestinians.", "policy", {"diplomatic_reputation": 0.03}, "ISR", "Oslo Accords"),
    spirit("isr_rocket_threat", "Rocket threat", "Rockets from Gaza and Lebanon threaten the towns of the south and north.", "problem", {"stability_factor": -0.03, "war_support_factor": 0.03}),
    spirit("isr_iron_dome", "Iron Dome", "A mobile air-defence system intercepts short-range rockets.", "strength", {"stability_factor": 0.02, "army_defence": 0.03}),
    spirit("isr_gas_exporter", "Offshore gas", "Gas from the offshore fields supplies power plants and exports.", "strength", {"energy_cost": -0.05, "fossil_output": 0.1}),
    spirit("isr_cyber_power", "Cyber power", "A world-class cyber industry and military cyber units.", "strength", {"intelligence_power": 0.08, "research_speed": 0.02}),
    spirit("isr_desalination", "Desalinated water", "Desalination plants end the water shortage.", "strength", {"health_outcomes": 0.02, "gdp_growth": 0.001}),
    spirit("isr_deep_divisions", "A divided society", "Mass protests and a deeply split public.", "problem", {"stability_factor": -0.04, "political_power_gain": -0.05}),
    spirit("isr_national_unity", "National unity", "Parties and the public rally together in a crisis.", "strength", {"stability_factor": 0.03, "war_support_factor": 0.05}),
])
write_decisions("isr", "ISR", "Israeli state projects", [
    ("isr_iron_dome_battery", "Deploy an Iron Dome battery", "Buy and deploy another interceptor battery.", "isr_iron_dome", 30, [TREAS(-0.5), MOD("army_defence", 0.02, 730), STAB(0.01)], CASH(0.5), 365),
    ("isr_tech_incubators", "Fund technology incubators", "State support for new technology companies.", "isr_innovation_authority", 25, [TREAS(-0.3), RB("electronics_cyber", 0.2, 1)], CASH(0.3), 365),
    ("isr_reserve_callup", "Call up reservists", "Mobilise reserve units.", "isr_reserve_system", 40, [DIVS("infantry_division", 2), STAB(-0.01)], {"at_war": True}, 365),
    ("isr_gas_export_deal", "Gas export deal", "Sell gas to Egypt and Jordan.", "isr_leviathan", 25, [TREAS(1), OPN("EGY", 5), OPN("JOR", 5)], None, 540),
])
T = Tree("isr", "ISR")
x = T.political_paths(0, "The coalition question", "Every Israeli government is a coalition; the question is which parties lead it.",
    "Coalition politics", "Governments formed by the largest party with smaller partners, as Israel has always been governed.", HIST, [
    dict(key="centrist_wave", group="liberal_democratic", start="A centrist wave", start_desc="Secular centrist parties draw voters from both blocs.", build=("New faces", "Candidates from the army, the media and business join the centre.", [IG("urban_middle_class", 4)]),
         gov_name="A centrist government", gov_desc="The most popular liberal party leads the coalition.", gate=ANY({"stability_below": 0.6}, {"ig_approval_below": {"group": "urban_middle_class", "value": 45}}),
         extra=[("isr_civil_marriage", "Civil marriage", "Allow civil marriage and public transport on the Sabbath.", [IG("religious_establishment", -8), IG("youth_students", 5), T.SPIRIT("open_society")])]),
    dict(key="left_revival", group="social_democratic", start="Revival of the left", start_desc="Labor and Meretz recover on peace and social justice.", build=("A peace camp", "Rallies for a two-state agreement.", [OPN("PSE", 10)]),
         gov_name="A left-wing government", gov_desc="The most popular party of the left leads the coalition.", gate=ANY({"gdp_growth_below": 2}, {"war_support_above": 0.6}),
         extra=[("isr_final_status_talks", "Final-status talks", "Negotiate borders, Jerusalem and refugees with the Palestinians.", [OPN("PSE", 20), MOD("diplomatic_reputation", 0.05, 2920), WS(-0.05)])]),
    dict(key="religious_bloc", group="religious", start="The religious bloc", start_desc="Religious parties gain from demography and turnout.", build=("Yeshiva networks", "Schools and charities organise the vote.", [IG("religious_establishment", 6)]),
         gov_name="A religious-led government", gov_desc="The most popular religious party leads the coalition.", gate=ANY({"stability_below": 0.5}, {"ig_influence_above": {"group": "religious_establishment", "value": 0.15}}),
         extra=[("isr_religious_law", "Religious law in public life", "Rabbinical courts and the Sabbath gain weight in public life.", [LAW("religion_state", "official_religion"), T.SPIRIT("religious_revival"), IG("youth_students", -5)])]),
    dict(key="national_camp", group="nationalist_populist", start="The national camp", start_desc="Nationalist parties gain on security fears.", build=("Security first", "Campaigns on the army and the settlements.", [WS(0.05)]),
         gov_name="A national-camp government", gov_desc="The most popular nationalist party leads the coalition.", gate=ANY({"war_support_above": 0.5}, {"stability_below": 0.5}),
         extra=[("isr_settlement_expansion", "Expand the settlements", "Build in the West Bank settlements.", [OPN("PSE", -20), MOD("international_opinion", -10, 2920), IG("religious_establishment", 4)])]),
    dict(key="socialist_list", group="socialist_communist", start="A socialist list", start_desc="Hadash and the socialist left win Arab and Jewish voters alike.", build=("Joint struggle", "Arab-Jewish campaigns on wages and housing.", [IG("minorities", 6), IG("labour_unions", 4)]),
         gov_name="A socialist-led government", gov_desc="The most popular socialist party leads the coalition.", gate=ANY({"gdp_growth_below": 1}, {"unrest_above": 0.2}), threshold=0.2,
         extra=[("isr_public_housing", "Public housing", "A large public housing programme.", [MOD("construction_speed", 0.05, 2920), IG("labour_unions", 5), TREAS(-1)])]),
], junta=False)

# ---- security (x 13-18)
T.f("security_doctrine", "Security doctrine", "Review the threats and the answers to them.", 15, 0, [WS(0.03), IG("military", 3)], ai=5)
T.f("leave_lebanon", "Leave southern Lebanon", "Withdraw from the security zone in southern Lebanon, as Israel did in 2000.", 13, 1, [STAB(0.02), WS(-0.02), IG("military", -2)], pre=["security_doctrine"], avail=ALL(HIST, BEFORE("2001-01-01")), ai=6)
T.f("intifada_response", "Answer the Second Intifada", "Military operations and closures after the uprising that began in 2000.", 15, 1, [T.SPIRIT("rocket_threat"), MOD("internal_security", 0.08, 1825), WS(0.05)], pre=["security_doctrine"], avail=AFTER("2000-10-01"), ai=4)
T.f("border_barrier", "The West Bank barrier", "Build a barrier along and inside the West Bank, 708 km long at completion.", 17, 1, [MOD("internal_security", 0.08, 3650), TREAS(-1), OPN("PSE", -15), MOD("international_opinion", -5, 2920)], pre=["security_doctrine"], avail=AFTER("2002-01-01"), ai=3)
T.f("gaza_disengagement", "Disengagement from Gaza", "Withdraw the army from Gaza and dismantle its 21 settlements, as Israel did in 2005.", 13, 2, [STAB(-0.03), MOD("international_opinion", 5, 1825), IG("religious_establishment", -5)], pre=["leave_lebanon|intifada_response"], avail=ALL(HIST, AFTER("2005-01-01")), ai=4)
T.f("home_front_command", "Home Front Command", "Shelters, sirens and civil defence for the towns under fire.", 15, 2, [MOD("stability_factor", 0.02, 2920), T.BUILD("infrastructure", 1)], pre=["intifada_response|border_barrier"])
T.f("iron_dome", "Iron Dome", "Develop a mobile system that intercepts short-range rockets; it was declared operational on 27 March 2011. Unlocks more batteries.", 15, 3, [T.SWAP("rocket_threat", "iron_dome"), RB("artillery_missiles", 0.25, 2)], pre=["home_front_command"], avail=AFTER("2011-03-27"), ai=5)
T.f("intelligence_services", "Intelligence services", "Strengthen the intelligence services and their technology.", 17, 2, [MOD("intelligence_power", 0.1, 3650), IG("security_services", 4)], pre=["border_barrier"])
T.f("cyber_units", "Cyber units", "Military cyber units and a national cyber directorate.", 17, 3, [T.SPIRIT("cyber_power"), RB("electronics_cyber", 0.25, 2)], pre=["intelligence_services"])
T.f("multi_layer_defence", "Layered air defence", "Add systems against longer-range rockets and missiles.", 14, 4, [MOD("army_defence", 0.03, 3650), RB("artillery_missiles", 0.2, 1), TREAS(-1)], pre=["iron_dome"], avail=CASH(1))
T.f("northern_front", "The northern front", "Prepare for war with Hezbollah on the Lebanese border.", 16, 4, [MOD("army_defence", 0.02, 2920), WS(0.03), T.BUILD("air_base", 1)], pre=["iron_dome|cyber_units"])
T.f("gaza_war", "The war in Gaza", "Fight the war that began with the attack of 7 October 2023.", 15, 5, [T.SPIRIT("national_unity"), DIVS("infantry_division", 2), WS(0.1)], pre=["multi_layer_defence|northern_front"], avail=AFTER("2023-10-07"), ai=5)
T.f("hostage_talks", "Hostage negotiations", "Negotiate the return of the hostages through mediators.", 17, 5, [STAB(0.02), OPN("EGY", 5), OPN("QAT", 5)], pre=["gaza_war"], avail=AFTER("2023-10-07"))
T.f("day_after_gaza", "The day after in Gaza", "Plans for the governance of Gaza after the war.", 15, 6, [MOD("diplomatic_reputation", 0.02, 2920), PP(30)], pre=["hostage_talks|gaza_war"], avail=AFTER("2024-01-01"))

# ---- military (x 20-25)
T.f("idf_plan", "A multi-year plan for the army", "Set the army's budget and structure for five years.", 22, 0, [MOD("army_org", 0.02, 1825), IG("military", 3)], ai=4)
T.f("reserve_system", "The reserve system", "Train and equip the reserve brigades. Unlocks reserve call-ups.", 20, 1, [MOD("manpower_factor", 0.03, 2920)], pre=["idf_plan"])
T.f("air_force", "Air superiority", "New fighter aircraft and air bases.", 22, 1, [T.BUILD("air_base", 1), RB("air_drones", 0.25, 2)], pre=["idf_plan"])
T.f("navy", "Protect the gas fields", "Corvettes and a naval base to protect the offshore gas fields.", 24, 1, [T.BUILD("port", 1), RB("naval", 0.2, 1)], pre=["idf_plan"])
T.f("armoured_corps", "Protected armour", "Heavily armoured vehicles with active protection.", 20, 2, [RB("armour", 0.25, 2), DIVS("mechanised_division", 1)], pre=["reserve_system"])
T.f("drones", "Drones", "Reconnaissance and strike drones.", 22, 2, [RB("air_drones", 0.2, 1), MOD("air_effectiveness", 0.03, 2920)], pre=["air_force"])
T.f("defence_industry", "Defence industry", "Arms makers that build and export missiles, drones and electronics.", 24, 2, [T.BUILD("military_factory", 2), TREAS(1)], pre=["navy|air_force"])
T.f("precision_weapons", "Precision weapons", "Guided munitions and missiles.", 21, 3, [RB("artillery_missiles", 0.2, 1), EQUIP(500)], pre=["armoured_corps|drones"])
T.f("arms_exports", "Arms exports", "Sell defence systems abroad.", 24, 3, [TREAS(2), MOD("foreign_influence_power", 0.05, 2920)], pre=["defence_industry"])
T.f("special_forces", "Commando units", "Expand the commando units.", 22, 4, [MOD("army_attack", 0.03, 2920), DIVS("motorised_division", 1)], pre=["precision_weapons"])
T.f("space_and_satellites", "Satellites", "Reconnaissance satellites and launchers.", 24, 4, [MOD("intelligence_power", 0.05, 3650), RB("electronics_cyber", 0.15, 1)], pre=["arms_exports"])

# ---- economy (x 27-32)
T.f("economic_plan", "Economic plan", "Set the economic priorities of the government.", 29, 0, [PP(20)], ai=4)
T.f("stabilise_economy", "Stabilise the economy", "Cut spending and taxes after the recession of the early 2000s.", 27, 1, [T.SPIRIT("balanced_budget"), {"set_budget": {"spending": -1}}, IG("labour_unions", -4)], pre=["economic_plan"])
T.f("innovation_authority", "Innovation authority", "Grants and incubators for technology companies. Unlocks incubator funding.", 29, 1, [RB("economy_digital", 0.2, 2), T.BUILD("data_centre", 1)], pre=["economic_plan"])
T.f("ports_reform", "New ports", "New private ports in Haifa and Ashdod.", 31, 1, [T.BUILD("port", 1), MOD("trade_efficiency", 0.03, 2920)], pre=["economic_plan"])
T.f("tamar", "The Tamar gas field", "Develop the offshore Tamar field west of Haifa, with proven reserves of 200 billion cubic metres.", 27, 2, [T.BUILD("refinery", 1), MOD("energy_cost", -0.03, 3650)], pre=["stabilise_economy|ports_reform"], avail=AFTER("2009-06-01"), ai=4)
T.f("tech_exits", "Tech companies", "Global companies buy and build research centres in Israel.", 29, 2, [MOD("foreign_investment", 0.08, 2920), T.BUILD("data_centre", 1)], pre=["innovation_authority"])
T.f("desalination", "Desalination", "Large desalination plants on the coast.", 31, 2, [T.SPIRIT("desalination"), TREAS(-1), T.BUILD("infrastructure", 1)], pre=["ports_reform"], avail=CASH(1))
T.f("leviathan", "The Leviathan gas field", "Develop the Leviathan field 130 km west of Haifa for power and exports. Unlocks gas export deals.", 27, 3, [T.SPIRIT("gas_exporter"), T.BUILD("refinery", 1)], pre=["tamar"], avail=AFTER("2011-01-01"), ai=4)
T.f("chip_plants", "Chip plants", "Semiconductor plants in the south.", 29, 3, [T.BUILD("civilian_factory", 2), RB("electronics_cyber", 0.2, 1)], pre=["tech_exits"])
T.f("housing_costs", "Lower housing costs", "Release state land and build more homes after the 2011 cost-of-living protests.", 31, 3, [MOD("construction_speed", 0.05, 2920), IG("youth_students", 4), IG("urban_middle_class", 4)], pre=["desalination"], avail=AFTER("2011-08-01"))
T.f("rail_network", "A national rail network", "Fast trains between Tel Aviv, Jerusalem and Haifa.", 28, 4, [T.BUILD("infrastructure", 3), TREAS(-1)], pre=["leviathan|chip_plants"], avail=CASH(1))
T.f("east_med_pipeline", "Eastern Mediterranean gas", "Export gas to Egypt and Jordan and plan routes to Europe.", 30, 4, [TREAS(2), OPN("EGY", 10), OPN("JOR", 10)], pre=["leviathan"])
T.f("solar_south", "Solar power in the Negev", "Solar plants in the desert.", 32, 4, [T.BUILD("renewable_plant", 1), MOD("energy_cost", -0.02, 3650)], pre=["housing_costs"])
T.f("ai_sector", "Artificial intelligence", "Research centres for artificial intelligence.", 29, 5, [RB("economy_digital", 0.25, 2), T.BUILD("data_centre", 1)], pre=["rail_network|east_med_pipeline"], avail=AFTER("2016-01-01"))

# ---- foreign policy (x 34-39)
T.f("foreign_policy", "Foreign policy", "Set the priorities of Israeli foreign policy.", 36, 0, [PP(30)], ai=4)
T.f("us_alliance", "The alliance with the United States", "Military aid and diplomatic support from the United States.", 34, 1, [OPN("USA", 15), EQUIP(500), MOD("diplomatic_reputation", 0.02, 2920)], pre=["foreign_policy"])
T.f("peace_partners", "Egypt and Jordan", "Keep the peace treaties with Egypt and Jordan.", 36, 1, [OPN("EGY", 10), OPN("JOR", 10)], pre=["foreign_policy"])
T.f("europe_ties", "Ties with Europe", "Trade and research agreements with the European Union.", 38, 1, [MOD("trade_efficiency", 0.03, 2920), OPN("DEU", 5), OPN("FRA", 5)], pre=["foreign_policy"])
T.f("iran_policy", "Containing Iran", "Diplomacy and covert pressure against Iran's nuclear programme.", 34, 2, [OPN("IRN", -20), OPN("USA", 5), MOD("intelligence_power", 0.03, 2920)], pre=["us_alliance"])
T.f("abraham_accords", "Abraham Accords", "Normalise relations with the United Arab Emirates and Bahrain, signed in Washington on 15 September 2020.", 36, 2, [OPN("ARE", 25), OPN("BHR", 20), MOD("trade_efficiency", 0.03, 2920), TREAS(1)], pre=["peace_partners|us_alliance"], avail=ALL(HIST, AFTER("2020-09-15")), ai=4)
T.f("asia_trade", "Trade with Asia", "Trade agreements with India, China and Japan.", 38, 2, [OPN("IND", 10), OPN("CHN", 5), MOD("trade_efficiency", 0.02, 2920)], pre=["europe_ties"])
T.f("gulf_normalisation", "Normalisation with the Gulf", "Seek normal relations with more Arab states.", 36, 3, [OPN("SAU", 10), MOD("diplomatic_reputation", 0.03, 2920)], pre=["abraham_accords"])
T.f("africa_outreach", "Outreach to Africa", "Aid, water technology and embassies in Africa.", 38, 3, [MOD("foreign_influence_power", 0.05, 2920), TREAS(-0.5)], pre=["asia_trade"])
T.f("two_state_talks", "Talks with the Palestinians", "Negotiations with the Palestinian Authority.", 34, 3, [OPN("PSE", 15), STAB(0.01), IG("religious_establishment", -3)], pre=["iran_policy|peace_partners"])

# ---- society (x 41-44)
T.f("social_agenda", "Social agenda", "Priorities at home: housing, schools and integration.", 42, 0, [PP(20)], ai=3)
T.f("immigrant_absorption", "Absorb immigrants", "Housing, language classes and jobs for new immigrants.", 41, 1, [MOD("population_growth", 0.001, 2920), IG("urban_middle_class", 2), TREAS(-0.5)], pre=["social_agenda"])
T.f("arab_development", "Development in Arab towns", "A five-year plan for Arab towns.", 43, 1, [IG("minorities", 8), T.BUILD("infrastructure", 1), TREAS(-0.5)], pre=["social_agenda"])
T.f("haredi_employment", "Jobs and training for the Haredi community", "Vocational training and employment programmes.", 41, 2, [MOD("private_sector_output", 0.02, 2920), IG("religious_establishment", -2)], pre=["immigrant_absorption"])
T.f("periphery", "Develop the periphery", "Jobs and services in the Negev and the Galilee.", 43, 2, [T.BUILD("civilian_factory", 1), IG("rural", 4)], pre=["arab_development"])
T.f("national_reconciliation", "Heal the divisions", "Dialogue between the camps after the protests of 2023.", 42, 3, [T.REMOVE("deep_divisions"), STAB(0.03)], pre=["haredi_employment|periphery"], avail=T.HAS("deep_divisions"), days=105)
T.f("judicial_reform", "Judicial reform", "Change how judges are chosen and limit judicial review, as the government proposed in 2023.", 44, 3, [T.SPIRIT("deep_divisions"), PP(50), IG("urban_middle_class", -6)], pre=["periphery"], avail=ALL(HIST, AFTER("2023-01-01")), ai=2)
T.f("nation_state_law", "The Nation-State Law", "A basic law defining Israel as the nation-state of the Jewish people, passed on 19 July 2018.", 41, 3, [IG("minorities", -6), IG("religious_establishment", 3)], pre=["immigrant_absorption"], avail=ALL(HIST, AFTER("2018-07-19")), ai=3)
# ---- more depth
T.f("border_fence_egypt", "The southern border", "A fence along the border with Egypt in Sinai.", 13, 3, [MOD("internal_security", 0.04, 3650), TREAS(-0.5)], pre=["gaza_disengagement"], avail=AFTER("2010-01-01"))
T.f("tunnel_detection", "Tunnel detection", "Sensors and barriers against cross-border tunnels.", 13, 4, [MOD("army_defence", 0.02, 2920), RB("electronics_cyber", 0.15, 1)], pre=["border_fence_egypt"])
T.f("lebanon_border", "Lebanon border defences", "Fortify the northern border.", 17, 4, [MOD("army_defence", 0.02, 2920), T.BUILD("infrastructure", 1)], pre=["cyber_units"])
T.f("reservist_support", "Support for reservists", "Grants and job protection for reservists and their families.", 13, 5, [STAB(0.02), MOD("manpower_factor", 0.02, 1460), TREAS(-0.5)], pre=["tunnel_detection"])
T.f("hezbollah_deterrence", "Deterrence in the north", "Air and missile strikes deter attacks from Lebanon.", 17, 6, [WS(0.03), MOD("air_effectiveness", 0.02, 1460)], pre=["hostage_talks|lebanon_border"], avail=AFTER("2023-10-08"))
T.f("laser_defence", "Laser air defence", "A laser interceptor against rockets and drones.", 14, 5, [MOD("army_defence", 0.03, 3650), RB("electronics_cyber", 0.2, 1)], pre=["multi_layer_defence"], avail=AFTER("2020-01-01"))
T.f("submarine_fleet", "Submarines", "A fleet of modern submarines.", 25, 2, [RB("naval", 0.2, 1), MOD("naval_effectiveness", 0.03, 3650)], pre=["navy"])
T.f("military_intelligence", "Military intelligence", "Signals and satellite intelligence for the army.", 20, 3, [MOD("intelligence_power", 0.05, 3650)], pre=["armoured_corps"])
T.f("ground_forces_reform", "Ground forces reform", "Smaller, more mobile ground forces.", 20, 4, [MOD("army_org", 0.02, 2920), RB("doctrine", 0.2, 1)], pre=["military_intelligence|special_forces"])
T.f("air_refuelling", "Long-range air operations", "Tankers and long-range strike aircraft.", 23, 5, [MOD("air_effectiveness", 0.03, 3650)], pre=["special_forces|space_and_satellites"])
T.f("pharma_exports", "Pharmaceuticals", "Generic drugs and medical devices for export.", 27, 4, [T.BUILD("civilian_factory", 1), TREAS(1)], pre=["leviathan|tamar"])
T.f("agritech", "Farm technology", "Drip irrigation and farm technology for export.", 31, 5, [MOD("trade_efficiency", 0.02, 2920), IG("rural", 3)], pre=["solar_south"])
T.f("financial_markets", "Capital markets", "Reform the stock exchange and the pension funds.", 27, 5, [MOD("foreign_investment", 0.04, 2920), MOD("interest_rate", -0.003, 2920)], pre=["pharma_exports"])
T.f("cost_of_living", "Cost of living", "Open markets for food and imports to lower prices.", 32, 3, [MOD("inflation", -0.005, 2920), IG("urban_middle_class", 3)], pre=["desalination"])
T.f("india_partnership", "Partnership with India", "Arms, water and technology cooperation with India.", 38, 4, [OPN("IND", 15), TREAS(1)], pre=["asia_trade|africa_outreach"])
T.f("mediterranean_partners", "Partners in the Mediterranean", "Gas and defence cooperation with Greece and Cyprus.", 36, 4, [OPN("GRC", 15), OPN("CYP", 15)], pre=["gulf_normalisation|europe_ties"])
T.f("us_aid_agreement", "A ten-year aid agreement", "A long-term military aid agreement with the United States.", 34, 4, [EQUIP(800), OPN("USA", 10)], pre=["two_state_talks|iran_policy"], avail=AFTER("2016-01-01"))
T.f("education_reform", "Education reform", "Science and English in every school.", 42, 4, [MOD("education_quality", 0.04, 3650), RB("economy_digital", 0.15, 1)], pre=["national_reconciliation|nation_state_law|judicial_reform"])
T.f("health_system", "Health system", "More hospital beds and doctors in the periphery.", 43, 5, [MOD("health_outcomes", 0.03, 3650), TREAS(-0.5)], pre=["education_reform"])
T.f("public_transport", "Public transport", "Light rail in Jerusalem and Tel Aviv.", 41, 5, [T.BUILD("infrastructure", 2), IG("urban_middle_class", 3)], pre=["education_reform"])

T.write("Israel", "Israel in the style of the Russian model tree: coalition politics with alternative coalitions led by real parties (centrist, left, religious, national, socialist), security, military, economy (the offshore gas fields), foreign policy and society branches; sourced starting spirits in data/spirits/isr.json and decisions in data/decisions/isr.json. Wars stay in the scripted conflict events. Alternatives are a counterfactual, not a claim about the parties.",
        ["Conscription in Israel", "Silicon Wadi", "Oslo Accords", "South Lebanon conflict (1985–2000)", "Second Intifada", "Israeli West Bank barrier", "Israel's unilateral disengagement plan", "Iron Dome",
         "Tamar gas field", "Leviathan gas field", "Abraham Accords", "Basic Law: Israel as the Nation-State of the Jewish People", "2023 Israeli judicial reform protests", "Gaza war"])

# ============================================================ PALESTINE
write_spirits("pse", "Palestine's national spirits. The ones with `start` describe the situation on 1 January 2000 and cite sources. Values are gameplay estimates.", [
    start_spirit("pse_limited_self_rule", "Limited self-rule", "Under the Oslo Accords the Palestinian Authority has partial civil control in parts of the West Bank and Gaza.", "problem", {"tax_efficiency": -0.1, "foreign_influence_resistance": -0.1}, "PSE", "Palestinian National Authority"),
    start_spirit("pse_occupation", "Under occupation", "The West Bank and the Gaza Strip are under Israeli occupation.", "problem", {"production_efficiency": -0.05, "unrest": 0.03, "trade_efficiency": -0.05}, "PSE", "State of Palestine"),
    spirit("pse_divided_territories", "Divided territories", "The West Bank and Gaza are ruled by rival governments.", "problem", {"stability_factor": -0.05, "political_power_gain": -0.1}),
    spirit("pse_national_unity", "National unity", "Fatah and Hamas share one government.", "strength", {"stability_factor": 0.04}),
    spirit("pse_state_recognition", "International recognition", "A growing number of states recognise the State of Palestine.", "strength", {"diplomatic_reputation": 0.08}),
    spirit("pse_donor_support", "Donor support", "Aid from donors pays salaries and builds infrastructure.", "policy", {"welfare_cost": -0.01, "foreign_influence_resistance": -0.05}),
])
write_decisions("pse", "PSE", "Palestinian projects", [
    ("pse_donor_conference", "Call a donor conference", "Ask donors for a new round of aid.", "pse_donor_coordination", 30, [TREAS(0.5), OPN("NOR", 5)], None, 365),
    ("pse_un_campaign", "Campaign at the UN", "Seek new recognitions at the UN.", "pse_un_status", 30, [MOD("diplomatic_reputation", 0.02, 730)], None, 365),
])
P = Tree("pse", "PSE")
x = P.political_paths(0, "The Palestinian question", "Which movement leads the Palestinian national cause.",
    "Fatah and the Authority", "Fatah leads the Palestinian Authority, as it did from its foundation.", HIST, [
    dict(key="islamist_rise", group="religious", start="The Islamist movement rises", start_desc="Islamist movements such as Hamas gain support.", build=("Charity networks", "Schools, clinics and charities build support.", [IG("religious_establishment", 6)]),
         gov_name="An Islamist government", gov_desc="The most popular Islamist party forms the government.", gate=ANY({"stability_below": 0.5}, {"unrest_above": 0.2}),
         extra=[("pse_islamic_law", "Religious law", "Religious law in family and public life.", [LAW("religion_state", "religious_law_partial"), P.SPIRIT("religious_revival")])]),
    dict(key="left_fronts", group="socialist_communist", start="The left fronts", start_desc="The Marxist fronts win back students and workers.", build=("Unions and students", "Organise unions and student councils.", [IG("labour_unions", 5), IG("youth_students", 5)]),
         gov_name="A left-wing government", gov_desc="The most popular party of the left forms the government.", gate=ANY({"gdp_growth_below": 1}, {"unrest_above": 0.25})),
    dict(key="third_way", group="liberal_democratic", start="A third way", start_desc="Independent and liberal reformers offer an alternative to both big movements.", build=("Clean government", "Campaign on transparency and public finances.", [IG("urban_middle_class", 5)]),
         gov_name="A reformist government", gov_desc="The most popular liberal party forms the government.", gate=ANY({"stability_below": 0.6}, {"ig_approval_below": {"group": "urban_middle_class", "value": 45}}),
         extra=[("pse_transparent_finances", "Transparent finances", "Publish budgets and audit the ministries.", [P.SPIRIT("professional_civil_service"), MOD("foreign_investment", 0.05, 2920)])]),
], junta=False)
P.f("statehood", "Building a state", "Build the institutions of a future state.", 10, 0, [PP(30), STAB(0.02)], ai=5)
P.f("civil_service", "A civil service", "Pay and train the Authority's officials.", 9, 1, [MOD("tax_efficiency", 0.05, 2920), TREAS(-0.2)], pre=["statehood"])
P.f("donor_coordination", "Coordinate the donors", "One plan for the donors' money. Unlocks donor conferences.", 11, 1, [P.SPIRIT("donor_support"), TREAS(0.5)], pre=["statehood"])
P.f("security_forces", "Security forces", "Train and unify the security services.", 13, 1, [MOD("internal_security", 0.05, 2920), DIVS("infantry_division", 1)], pre=["statehood"])
P.f("fiscal_reform", "Fiscal reform", "A single treasury account and audited budgets.", 9, 2, [MOD("corruption", -0.03, 2920), P.SPIRIT("anti_corruption_campaign")], pre=["civil_service"])
P.f("municipal_elections", "Local elections", "Elect mayors and councils.", 11, 2, [STAB(0.02), IG("urban_middle_class", 3)], pre=["donor_coordination|civil_service"])
P.f("unity_talks", "Reconciliation talks", "Talks between Fatah and Hamas to reunite the West Bank and Gaza.", 13, 2, [P.SWAP("divided_territories", "national_unity"), STAB(0.02)], pre=["security_forces"], avail=AFTER("2007-07-01"), days=105)
P.f("un_status", "Status at the United Nations", "Seek a higher status at the UN and recognition as a state. Unlocks UN campaigns.", 10, 3, [P.SPIRIT("state_recognition"), MOD("diplomatic_reputation", 0.05, 2920)], pre=["fiscal_reform|municipal_elections"], avail=AFTER("2011-01-01"))
P.f("international_courts", "International courts", "Join international treaties and courts.", 12, 3, [MOD("diplomatic_reputation", 0.03, 2920), OPN("ISR", -10)], pre=["municipal_elections|unity_talks"], avail=AFTER("2012-06-01"))
P.f("economy_plan", "A Palestinian economy", "Plan for an economy that can stand on its own.", 16, 0, [PP(20)], ai=4)
P.f("agriculture", "Olive groves and farms", "Credit and water for farmers.", 15, 1, [IG("rural", 5), MOD("gdp_growth", 0.002, 2920)], pre=["economy_plan"])
P.f("industrial_zones", "Industrial zones", "Industrial parks near Jenin and Hebron.", 17, 1, [P.BUILD("civilian_factory", 1), MOD("foreign_investment", 0.03, 2920)], pre=["economy_plan"])
P.f("tech_hub", "A technology hub", "Software and outsourcing companies in Ramallah.", 15, 2, [P.BUILD("data_centre", 1), RB("economy_digital", 0.2, 1)], pre=["agriculture|industrial_zones"])
P.f("gaza_power_and_water", "Power and water for Gaza", "A power plant and desalination for Gaza.", 17, 2, [P.BUILD("renewable_plant", 1), MOD("health_outcomes", 0.02, 2920), TREAS(-0.3)], pre=["industrial_zones"])
P.f("tourism", "Tourism", "Hotels and services for pilgrims and visitors.", 16, 3, [MOD("gdp_growth", 0.002, 2920), P.BUILD("infrastructure", 1)], pre=["tech_hub|gaza_power_and_water"])
P.f("reconstruction", "Rebuild Gaza", "Rebuild housing, water and power after the wars.", 16, 4, [P.SPIRIT("reconstruction_effort"), P.BUILD("infrastructure", 2)], pre=["tourism|gaza_power_and_water"], avail=AFTER("2009-01-01"))
P.f("diplomacy", "Diplomacy", "Seek support for Palestinian statehood.", 20, 0, [PP(20)], ai=4)
P.f("arab_support", "Arab support", "Aid and diplomatic backing from the Arab League.", 19, 1, [OPN("EGY", 10), OPN("JOR", 10), TREAS(0.3)], pre=["diplomacy"])
P.f("european_support", "European support", "Aid and recognition from European states.", 21, 1, [OPN("FRA", 10), OPN("ESP", 10), TREAS(0.3)], pre=["diplomacy"])
P.f("peace_talks", "Peace talks", "Negotiate with Israel on a final settlement.", 20, 2, [OPN("ISR", 15), STAB(0.01)], pre=["arab_support|european_support"])
P.f("global_recognition", "Recognition by more states", "Win recognition from more states in Europe and the Americas.", 20, 3, [MOD("diplomatic_reputation", 0.04, 2920), OPN("IRL", 10), OPN("NOR", 10)], pre=["peace_talks"], avail=AFTER("2014-01-01"))
# ---- more depth
P.f("police_reform", "A civil police", "A professional civil police force.", 13, 3, [MOD("internal_security", 0.03, 2920), STAB(0.01)], pre=["unity_talks|security_forces"])
P.f("basic_law", "A basic law", "A constitution for the future state.", 9, 3, [STAB(0.02), PP(20)], pre=["fiscal_reform"])
P.f("elections_renewed", "Hold national elections", "Presidential and legislative elections for the whole territory.", 11, 4, [STAB(0.02), IG("youth_students", 4)], pre=["un_status|international_courts"])
P.f("anti_corruption", "Anti-corruption commission", "An independent commission against corruption.", 9, 4, [MOD("corruption", -0.03, 3650), IG("urban_middle_class", 3)], pre=["basic_law"])
P.f("youth_jobs", "Jobs for the young", "Training and start-up loans for young people.", 13, 4, [IG("youth_students", 5), TREAS(-0.2)], pre=["police_reform"])
P.f("health_service", "Health service", "Clinics and hospitals across the West Bank and Gaza.", 15, 4, [MOD("health_outcomes", 0.03, 3650), TREAS(-0.2)], pre=["tourism"])
P.f("schools", "Schools", "Schools and universities.", 17, 4, [MOD("education_quality", 0.03, 3650)], pre=["tourism"])
P.f("roads_and_utilities", "Roads and utilities", "Roads, water networks and power lines.", 15, 5, [P.BUILD("infrastructure", 2), TREAS(-0.3)], pre=["health_service|reconstruction"])
P.f("gaza_port", "A port for Gaza", "Plans for a seaport in Gaza.", 17, 5, [P.BUILD("port", 1), MOD("trade_efficiency", 0.03, 2920)], pre=["schools|reconstruction"])
P.f("stone_and_marble", "Stone and marble", "Quarries and stone works for export.", 16, 6, [P.BUILD("civilian_factory", 1)], pre=["roads_and_utilities|gaza_port"])
P.f("diaspora_investment", "Diaspora investment", "Investment from Palestinians abroad.", 18, 1, [TREAS(0.3), MOD("foreign_investment", 0.03, 2920)], pre=["economy_plan"])
P.f("banking", "A monetary authority", "A monetary authority that supervises the banks.", 18, 2, [MOD("interest_rate", -0.003, 2920)], pre=["diaspora_investment"])
P.f("trade_routes", "Trade through Jordan", "Trade routes through the Allenby crossing.", 18, 3, [MOD("trade_efficiency", 0.03, 2920), OPN("JOR", 5)], pre=["banking"])
P.f("turkey_qatar", "Support from Turkey and Qatar", "Aid and backing from Turkey and Qatar.", 22, 2, [OPN("TUR", 10), OPN("QAT", 10), TREAS(0.3)], pre=["european_support"])
P.f("russia_china", "Ties with Russia and China", "Diplomatic support from Russia and China.", 22, 3, [OPN("RUS", 10), OPN("CHN", 10)], pre=["turkey_qatar"])
P.f("refugee_services", "Services for refugees", "Work with the UN agency for refugees.", 19, 2, [STAB(0.01), IG("minorities", 3)], pre=["arab_support"])
P.f("ceasefire", "A lasting ceasefire", "Seek a lasting ceasefire for Gaza.", 19, 3, [STAB(0.02), WS(-0.03)], pre=["refugee_services|peace_talks"], avail=AFTER("2009-01-01"))
P.f("international_conference", "An international conference", "A peace conference under international sponsorship.", 21, 4, [MOD("diplomatic_reputation", 0.03, 2920)], pre=["global_recognition|ceasefire"])
P.f("full_membership", "Full UN membership", "Apply for full membership of the United Nations.", 20, 5, [MOD("diplomatic_reputation", 0.05, 3650), PP(30)], pre=["international_conference"], avail=AFTER("2024-01-01"))

P.write("Palestine", "Palestine in the style of the Russian model tree: the Palestinian Authority under Fatah as the historical path and alternatives led by real movements of the data (Islamist, left fronts, liberal reformers); state-building, economy and diplomacy branches; sourced starting spirits in data/spirits/pse.json. Alternatives are a counterfactual, not a claim about the movements.",
        ["Palestinian National Authority", "State of Palestine", "Oslo Accords", "Battle of Gaza (2007)", "Blockade of the Gaza Strip"])
