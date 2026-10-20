"""Syria, Afghanistan, Islamic State and Taliban trees in the Russia model style. Run from the repo root."""
import sys; sys.path.insert(0, __file__.replace("\\", "/").rsplit("/", 1)[0])
from treelib import *

# ============================================================ SYRIA
write_spirits("syr", "Syria's national spirits. The ones with `start` describe the situation on 1 January 2000 and cite sources. Values are gameplay estimates.", [
    start_spirit("syr_state_of_emergency", "State of emergency", "A state of emergency has been in force since 1963.", "policy", {"internal_security": 0.1, "civil_liberties": -0.1, "foreign_investment": -0.05}, "SYR", "Damascus Spring"),
    start_spirit("syr_troops_in_lebanon", "Troops in Lebanon", "Syrian forces have been in Lebanon since 1976.", "policy", {"foreign_influence_power": 0.05, "manpower_factor": -0.02}, "SYR", "Syrian occupation of Lebanon"),
    start_spirit("syr_golan_occupied", "The occupied Golan", "Most of the Golan Heights has been occupied by Israel since 1967.", "problem", {"war_support_factor": 0.03, "stability_factor": -0.01}, "SYR", "Golan Heights"),
    spirit("syr_civil_war_damage", "War-torn country", "Years of civil war have destroyed cities, industry and power.", "problem", {"production_efficiency": -0.1, "construction_speed": -0.05, "stability_factor": -0.03}),
    spirit("syr_russian_support", "Russian support", "Russian air power and advisers back the government.", "policy", {"air_effectiveness": 0.05, "foreign_influence_resistance": -0.05}),
    spirit("syr_sanctions", "Western sanctions", "Sanctions on trade, banking and oil.", "problem", {"trade_efficiency": -0.1, "foreign_investment": -0.1}),
    spirit("syr_transition", "Transitional period", "A transitional government under a constitutional declaration.", "policy", {"stability_factor": -0.02, "political_power_gain": 0.05}),
])
write_decisions("syr", "SYR", "Syrian state projects", [
    ("syr_rebuild_a_city", "Rebuild a city", "Housing, water and power for a city damaged by the war.", "syr_reconstruction", 30, [TREAS(-0.5), {"add_buildings": {"building": "infrastructure", "count": 2}}, STAB(0.01)], CASH(0.5), 180),
    ("syr_local_truce", "Local truce", "Negotiate a local truce with an armed group.", "syr_reconciliation_committees", 30, [UNREST(-0.03), WS(-0.02)], {"has_civil_war": True}, 180),
])
S = Tree("syr", "SYR")
S.political_paths(0, "Who rules Syria", "Whether the Ba'ath Party keeps power or another force takes over.",
    "The Ba'athist state", "The Ba'ath Party rules, as it did from 1963 to 2024.", HIST, [
    dict(key="islamist_movement", group="religious", start="The Islamist opposition", start_desc="Islamist groups gain followers in the provinces.", build=("Mosque networks", "Preachers and charities organise support.", [IG("religious_establishment", 6)]),
         gov_name="An Islamist government", gov_desc="The most popular Islamist movement forms the government.", gate=ANY({"stability_below": 0.4}, {"has_civil_war": True}),
         extra=[("syr_islamic_law", "Religious law", "Religious law in public life.", [LAW("religion_state", "religious_law_partial"), S.SPIRIT("religious_revival")])]),
], junta=True)
S.f("damascus_spring", "Damascus Spring", "Allow political forums and debate, as in the year after June 2000.", 9, 0, [IG("urban_middle_class", 5), IG("security_services", -4), MOD("civil_liberties", 0.05, 730)], avail=ALL(AFTER("2000-06-10"), BEFORE("2002-01-01")), ai=3)
S.f("economic_opening", "Economic opening", "Private banks and a social market economy.", 10, 1, [MOD("private_sector_output", 0.04, 2920), IG("business", 5)], pre=["damascus_spring|national_programme"])
S.f("national_programme", "The new president's programme", "The priorities of the government after the succession of 2000.", 11, 0, [PP(30)], ai=5)
S.f("leave_lebanon", "Leave Lebanon", "Withdraw from Lebanon, as Syria did on 30 April 2005.", 12, 1, [S.REMOVE("troops_in_lebanon"), OPN("LBN", 10), OPN("FRA", 5)], pre=["national_programme"], avail=AFTER("2005-03-01"), ai=4)
S.f("oil_fields", "The eastern oil fields", "Develop the oil fields of Deir ez-Zor and Hasakah.", 9, 2, [S.BUILD("refinery", 1), MOD("fossil_output", 0.05, 2920)], pre=["economic_opening"])
S.f("agriculture", "Wheat and cotton", "Irrigation for wheat and cotton in the north-east.", 11, 2, [IG("rural", 5), MOD("gdp_growth", 0.002, 2920)], pre=["economic_opening"])
S.f("tourism", "Tourism", "Hotels at the ancient sites.", 13, 2, [MOD("gdp_growth", 0.001, 2920), S.BUILD("infrastructure", 1)], pre=["leave_lebanon"])
S.f("five_seas", "A trade crossroads", "Make Syria a corridor for trade and pipelines.", 10, 3, [MOD("trade_efficiency", 0.03, 2920), OPN("TUR", 10)], pre=["oil_fields|agriculture"])
S.f("drought_relief", "Drought relief", "Help farmers and the displaced during droughts.", 12, 3, [IG("rural", 4), TREAS(-0.3), UNREST(-0.02)], pre=["agriculture|tourism"])
# civil war
S.f("uprising", "The uprising", "Answer the protests that began in March 2011.", 16, 0, [S.REMOVE("state_of_emergency"), WS(0.05)], avail=AFTER("2011-03-15"), ai=6)
S.f("security_crackdown", "A security campaign", "The army and security services move against the armed opposition.", 15, 1, [MOD("internal_security", 0.08, 1460), IG("youth_students", -6)], pre=["uprising"])
S.f("reform_package", "A reform package", "A new constitution and the end of the state of emergency.", 17, 1, [STAB(0.02), IG("urban_middle_class", 3)], pre=["uprising"])
S.f("national_defence_forces", "National Defence Forces", "Local militias support the army.", 15, 2, [DIVS("infantry_division", 3)], pre=["security_crackdown"], avail={"has_civil_war": True})
S.f("reconciliation_committees", "Reconciliation committees", "Local deals with towns and armed groups. Unlocks local truces.", 17, 2, [UNREST(-0.03)], pre=["reform_package"])
S.f("russian_intervention", "Russian intervention", "Ask Russia for military help, as the government did in September 2015.", 15, 3, [S.SPIRIT("russian_support"), OPN("RUS", 20), EQUIP(1000)], pre=["national_defence_forces"], avail=AFTER("2015-09-01"), ai=4)
S.f("iranian_advisers", "Iranian advisers", "Advisers and volunteers from Iran.", 17, 3, [OPN("IRN", 15), DIVS("infantry_division", 2)], pre=["reconciliation_committees|national_defence_forces"], avail=AFTER("2012-01-01"))
S.f("retake_aleppo", "Retake Aleppo", "The offensive on Aleppo.", 16, 4, [MOD("army_attack", 0.03, 730), WS(0.03)], pre=["russian_intervention|iranian_advisers"], avail={"has_civil_war": True})
S.f("war_damage", "Count the damage", "Survey the destruction of cities and industry.", 16, 5, [S.SPIRIT("civil_war_damage"), S.SPIRIT("sanctions"), PP(20)], pre=["retake_aleppo|iranian_advisers"], avail=AFTER("2012-06-01"))
# transition and reconstruction
S.f("transition", "The transitional government", "A transitional government under a constitutional declaration, established on 29 March 2025.", 20, 0, [S.SPIRIT("transition"), PP(40)], avail=AFTER("2025-03-29"), ai=5)
S.f("sanctions_relief", "Sanctions relief", "Seek the lifting of sanctions.", 19, 1, [S.REMOVE("sanctions"), OPN("USA", 10), OPN("DEU", 5)], pre=["transition"], ai=4)
S.f("unified_army", "A unified army", "Merge the armed factions into one army.", 21, 1, [DIVS("infantry_division", 2), MOD("army_org", 0.03, 1460)], pre=["transition"])
S.f("reconstruction", "Reconstruction", "Rebuild housing, water and power. Unlocks city rebuilding.", 19, 2, [S.SWAP("civil_war_damage", "reconstruction_effort"), S.BUILD("infrastructure", 3), TREAS(-1)], pre=["sanctions_relief|war_damage"], avail=AFTER("2017-01-01"))
S.f("refugee_return", "The return of refugees", "Help refugees return home.", 21, 2, [MOD("population_growth", 0.002, 2920), STAB(0.02)], pre=["unified_army|sanctions_relief"])
S.f("new_constitution", "A permanent constitution", "Draft a permanent constitution.", 20, 3, [S.REMOVE("transition"), STAB(0.03), PP(30)], pre=["reconstruction|refugee_return"], days=140)
S.f("power_and_water", "Power and water", "Repair power plants and water networks.", 19, 3, [S.BUILD("renewable_plant", 1), MOD("health_outcomes", 0.02, 2920)], pre=["reconstruction"])
S.f("industry_restart", "Restart industry", "Reopen the factories of Aleppo and Homs.", 21, 3, [S.BUILD("civilian_factory", 2), IG("labour_unions", 3)], pre=["refugee_return|reconstruction"])
# military and foreign
S.f("army_reform", "Army reform", "Modernise the army.", 24, 0, [MOD("army_org", 0.02, 1460)], ai=4)
S.f("air_defence", "Air defence", "Modern air defences.", 23, 1, [MOD("army_defence", 0.02, 2920), RB("artillery_missiles", 0.15, 1)], pre=["army_reform"])
S.f("armour", "Armour", "Tanks and mechanised units.", 25, 1, [DIVS("mechanised_division", 1), RB("armour", 0.15, 1)], pre=["army_reform"])
S.f("missiles", "Missile forces", "Expand the missile forces.", 24, 2, [RB("artillery_missiles", 0.2, 1)], pre=["air_defence|armour"])
S.f("foreign_policy", "Foreign policy", "Syria among its neighbours.", 28, 0, [PP(20)], ai=4)
S.f("russia_ties", "Ties with Russia", "Arms and diplomatic support from Russia.", 27, 1, [OPN("RUS", 15)], pre=["foreign_policy"])
S.f("iran_ties", "Alliance with Iran", "A strategic alliance with Iran.", 29, 1, [OPN("IRN", 15)], pre=["foreign_policy"])
S.f("arab_league_return", "Return to the Arab League", "Restore ties with the Arab states.", 28, 2, [OPN("SAU", 15), OPN("ARE", 10), TREAS(0.5)], pre=["russia_ties|iran_ties"], avail=AFTER("2023-01-01"))
S.f("turkey_ties", "Relations with Turkey", "Trade and borders with Turkey.", 27, 2, [OPN("TUR", 10), MOD("trade_efficiency", 0.02, 2920)], pre=["russia_ties"])
S.f("golan_diplomacy", "The Golan question", "Seek the return of the Golan through diplomacy.", 29, 2, [MOD("diplomatic_reputation", 0.02, 2920), OPN("ISR", 5)], pre=["iran_ties"])
# ---- more depth
S.f("phosphates", "Phosphate mines", "Expand the phosphate mines near Palmyra.", 8, 3, [S.BUILD("civilian_factory", 1), TREAS(0.3)], pre=["oil_fields"])
S.f("textiles", "Textile industry", "Cotton mills in Aleppo.", 11, 4, [S.BUILD("civilian_factory", 1), IG("labour_unions", 3)], pre=["five_seas|drought_relief"])
S.f("banking_reform", "Private banks", "License private banks and a stock exchange.", 9, 4, [MOD("foreign_investment", 0.04, 2920), MOD("interest_rate", -0.003, 2920)], pre=["five_seas"])
S.f("power_plants", "Power plants", "Gas power plants for the cities.", 13, 3, [S.BUILD("renewable_plant", 1), MOD("energy_cost", -0.02, 2920)], pre=["tourism"])
S.f("republican_guard", "The Republican Guard", "Expand the elite units around the capital.", 14, 3, [DIVS("mechanised_division", 1), EQUIP(400)], pre=["security_crackdown"])
S.f("air_campaign", "Air campaign", "Use the air force against the armed opposition.", 14, 4, [MOD("air_effectiveness", 0.04, 1460), WS(0.02)], pre=["republican_guard|russian_intervention"], avail={"has_civil_war": True})
S.f("hold_damascus", "Hold Damascus", "Secure the capital and its suburbs.", 18, 4, [MOD("army_defence", 0.04, 1460), MOD("internal_security", 0.03, 1460)], pre=["iranian_advisers|reconciliation_committees"], avail={"has_civil_war": True})
S.f("fight_isis", "Fight the Islamic State", "Offensives against the Islamic State in the desert and the east.", 17, 5, [MOD("army_attack", 0.02, 1460), WS(0.02)], pre=["retake_aleppo|hold_damascus"], avail={"exists": "ISG"})
S.f("amnesty", "Amnesty", "Amnesties for fighters who lay down their arms.", 18, 5, [UNREST(-0.03), STAB(0.01)], pre=["hold_damascus"])
S.f("transitional_justice", "Transitional justice", "Commissions on the missing and on war crimes.", 22, 2, [STAB(0.02), MOD("diplomatic_reputation", 0.03, 2920)], pre=["unified_army"])
S.f("kurdish_integration", "Integrate the north-east", "Agreements to bring the north-east into the state.", 22, 3, [IG("minorities", 6), STAB(0.02)], pre=["transitional_justice|industry_restart"])
S.f("oil_recovery", "Recover the oil fields", "Restart oil production in the east.", 20, 4, [S.BUILD("refinery", 1), TREAS(0.5)], pre=["power_and_water|kurdish_integration"])
S.f("investment_conference", "Investment conference", "Invite Gulf and Turkish investors.", 21, 4, [MOD("foreign_investment", 0.08, 2920), OPN("SAU", 5), OPN("TUR", 5)], pre=["industry_restart|new_constitution"])
S.f("navy", "Coastal defence", "Coastal defence at Latakia and Tartus.", 25, 2, [S.BUILD("port", 1), RB("naval", 0.15, 1)], pre=["armour"])
S.f("chemical_disarmament", "Disarmament of chemical weapons", "Hand over chemical weapons for destruction under international supervision.", 23, 2, [MOD("diplomatic_reputation", 0.03, 2920), OPN("USA", 5)], pre=["air_defence"], avail=AFTER("2013-09-01"))
S.f("china_ties", "Ties with China", "Trade and reconstruction loans from China.", 28, 3, [OPN("CHN", 10), TREAS(0.3)], pre=["arab_league_return|turkey_ties|golan_diplomacy"])
S.f("lebanon_relations", "Relations with Lebanon", "Borders, trade and refugees with Lebanon.", 30, 1, [OPN("LBN", 10)], pre=["foreign_policy"])
S.f("jordan_trade", "Trade with Jordan", "Reopen the border crossing with Jordan.", 30, 2, [OPN("JOR", 10), MOD("trade_efficiency", 0.02, 2920)], pre=["lebanon_relations"])

S.write("Syria", "Syria in the style of the Russian model tree: the Ba'athist state as the historical path until 2024, an Islamist alternative led by a real party of the data and a junta; branches for the early 2000s (the Damascus Spring, leaving Lebanon), the civil war from 2011, the transition and reconstruction from 2025, the army and foreign policy. Sourced starting spirits in data/spirits/syr.json. Wars stay in the scripted conflict events. Alternatives are a counterfactual, not a claim about the parties.",
        ["Ba'athist Syria", "Damascus Spring", "Syrian occupation of Lebanon", "Golan Heights", "Death and state funeral of Hafez al-Assad", "Syrian civil war", "Russian military intervention in the Syrian civil war", "Fall of the Assad regime", "Syrian transitional government", "Hay'at Tahrir al-Sham"])

# ============================================================ AFGHANISTAN
write_spirits("afg", "Afghanistan's national spirits. The ones with `start` describe the situation on 1 January 2000 and cite sources. Values are gameplay estimates.", [
    start_spirit("afg_un_sanctions", "UN sanctions", "Security Council Resolution 1267, adopted on 15 October 1999, put sanctions on the Taliban and al-Qaida.", "problem", {"trade_efficiency": -0.15, "foreign_investment": -0.15}, "AFG", "United Nations Security Council Resolution 1267"),
    start_spirit("afg_divided_country", "A divided country", "The Taliban rule most of the country; the Northern Alliance holds the north-east and keeps the UN seat.", "problem", {"stability_factor": -0.05, "political_power_gain": -0.05}, "AFG", "Taliban government (1996–2001)"),
    start_spirit("afg_opium_economy", "Opium economy", "Afghanistan produces most of the world's illicit opium.", "problem", {"corruption": 0.05, "tax_efficiency": -0.05}, "AFG", "Opium production in Afghanistan"),
    spirit("afg_international_aid", "International aid", "Donors pay for much of the state budget and the army.", "policy", {"welfare_cost": -0.01, "foreign_influence_resistance": -0.1}),
    spirit("afg_insurgency", "Insurgency", "An insurgency fights the government in the south and east.", "problem", {"stability_factor": -0.04, "unrest": 0.03}),
    spirit("afg_legal_economy", "A legal economy", "Farmers grow other crops and the state collects taxes.", "strength", {"tax_efficiency": 0.04, "corruption": -0.02}),
])
write_decisions("afg", "AFG", "Afghan state projects", [
    ("afg_donor_conference", "Donor conference", "Ask donors for a new round of aid.", "afg_donor_support", 30, [TREAS(0.5)], None, 365),
    ("afg_irrigation_project", "Irrigation project", "A canal or dam for farmers.", "afg_irrigation", 30, [TREAS(-0.2), MOD("gdp_growth", 0.002, 1460), IG("rural", 3)], CASH(0.2), 365),
])
A = Tree("afg", "AFG")
A.political_paths(0, "Who rules Afghanistan", "Which force governs Afghanistan.",
    "The government of the day", "Afghanistan is governed as it historically was, from the end of Taliban rule in December 2001 until the takeover of August 2021.", HIST, [
    dict(key="broad_coalition", group="non_aligned", start="A broad coalition", start_desc="Regional and ethnic parties form a broad coalition.", build=("Regional leaders", "Leaders of the regions join the coalition.", [IG("minorities", 6)]),
         gov_name="A coalition government", gov_desc="The most popular non-aligned party leads the government.", gate=ANY({"stability_below": 0.4}, {"unrest_above": 0.3}), threshold=0.15),
], junta=True)
KABUL, KANDAHAR, HERAT, BALKH, NANGARHAR = "AFG-1762", "AFG-1754", "AFG-1742", "AFG-1744", "AFG-1774"
A.f("new_state", "A new state", "Build the state after the fall of the Emirate and the Bonn Agreement of 5 December 2001.", 11, 0, [A.REMOVE("un_sanctions"), A.REMOVE("divided_country"), A.SPIRIT("international_aid"), PP(40)], avail=AFTER("2001-12-22"), ai=6)
A.f("loya_jirga", "Grand assembly", "A grand assembly chooses the transitional government.", 10, 1, [STAB(0.03), IG("minorities", 3)], pre=["new_state"])
A.f("donor_support", "Donor support", "Aid from the international donors. Unlocks donor conferences.", 12, 1, [TREAS(2), MOD("construction_speed", 0.05, 2920)], pre=["new_state"])
A.f("new_constitution", "A new constitution", "An Islamic republic with an elected president.", 10, 2, [LAW("political_freedom", "free_elections"), STAB(0.02)], pre=["loya_jirga"], avail=AFTER("2004-01-01"))
A.f("national_army", "The Afghan National Army", "Recruit and train a new national army.", 12, 2, [DIVS("infantry_division", 2), EQUIP(500)], pre=["donor_support"], avail=AFTER("2002-01-01"))
A.f("counter_insurgency", "Counter-insurgency", "Fight the insurgency in the south and east.", 11, 3, [A.SPIRIT("insurgency"), MOD("internal_security", 0.05, 1460), WS(0.03)], pre=["national_army|new_constitution"], avail=AFTER("2005-01-01"))
A.f("security_handover", "Security handover", "Take over security from international forces as they leave by 2014.", 12, 4, [DIVS("infantry_division", 2), MOD("army_org", 0.02, 1460), A.REMOVE("international_aid")], pre=["counter_insurgency"], avail=AFTER("2014-01-01"))
A.f("peace_talks", "Peace talks", "Talks with the Taliban after the Doha agreement of 29 February 2020.", 10, 4, [A.REMOVE("insurgency"), STAB(0.02), WS(-0.05)], pre=["counter_insurgency"], avail=AFTER("2020-02-29"))
A.f("economy_plan", "Rebuild the economy", "Roads, power and farms.", 20, 0, [PP(20)], ai=4)
A.f("ring_road", "The ring road", "Rebuild the ring road between the cities.", 19, 1, [A.BUILD("infrastructure", 3), TREAS(-0.5)], pre=["economy_plan"], avail=CASH(0.5))
A.f("irrigation", "Irrigation", "Repair canals and build dams. Unlocks irrigation projects.", 21, 1, [IG("rural", 5), MOD("gdp_growth", 0.002, 2920)], pre=["economy_plan"])
A.f("alternative_crops", "Alternative crops", "Help farmers grow other crops instead of poppy.", 20, 2, [A.SWAP("opium_economy", "legal_economy"), IG("rural", -3)], pre=["irrigation"], avail=A.HAS("opium_economy"), days=140)
A.f("power_imports", "Power from the north", "Power lines from Central Asia.", 19, 2, [MOD("energy_cost", -0.03, 2920), A.BUILD("renewable_plant", 1)], pre=["ring_road"])
A.f("kabul_growth", "A growing capital", "Housing and services for Kabul.", 19, 3, [A.BUILD("infrastructure", 1, KABUL), A.BUILD("civilian_factory", 1, KABUL)], pre=["power_imports"])
A.f("telecoms", "Mobile networks", "Mobile phone networks across the country.", 21, 3, [A.BUILD("data_centre", 1), RB("economy_digital", 0.15, 1)], pre=["alternative_crops|power_imports"])
A.f("schools", "Schools", "Schools in every district.", 20, 4, [MOD("education_quality", 0.04, 3650), IG("youth_students", 4)], pre=["kabul_growth|telecoms"])
# ---- more depth
A.f("police", "A national police", "Train a national police force.", 13, 2, [MOD("internal_security", 0.05, 2920)], pre=["donor_support"])
A.f("air_force", "An air force", "Helicopters and light attack aircraft.", 13, 3, [A.BUILD("air_base", 1), RB("air_drones", 0.15, 1)], pre=["national_army|police"])
A.f("special_forces", "Commandos", "Commando battalions.", 13, 4, [DIVS("motorised_division", 1)], pre=["air_force"])
A.f("elections", "Elections", "Presidential and parliamentary elections.", 9, 3, [STAB(0.02), IG("youth_students", 3)], pre=["new_constitution"], avail=AFTER("2004-06-01"))
A.f("provincial_councils", "Provincial councils", "Elected councils in the provinces.", 9, 4, [IG("minorities", 3), STAB(0.01)], pre=["elections"])
A.f("anti_corruption", "Anti-corruption office", "An office to fight corruption.", 10, 5, [A.SPIRIT("anti_corruption_campaign")], pre=["provincial_councils|peace_talks"])
A.f("women_education", "Girls' schools", "Schools for girls across the country.", 21, 4, [MOD("education_quality", 0.03, 3650), IG("youth_students", 3)], pre=["telecoms"], avail=ALL(AFTER("2002-01-01"), BEFORE("2021-08-15")))
A.f("health_clinics", "Health clinics", "Clinics in every district.", 19, 4, [MOD("health_outcomes", 0.04, 3650), TREAS(-0.2)], pre=["kabul_growth"])
A.f("mining", "Mines", "Copper and iron mines.", 22, 2, [A.BUILD("civilian_factory", 1), TREAS(0.3)], pre=["irrigation"])
A.f("dams", "Dams", "Dams for power and irrigation.", 22, 3, [A.BUILD("renewable_plant", 1), IG("rural", 3)], pre=["mining"])
A.f("airports", "Airports", "Rebuild the airports of Kabul, Kandahar and Herat.", 18, 2, [A.BUILD("air_base", 1), MOD("trade_efficiency", 0.02, 2920)], pre=["ring_road"])
A.f("trade_corridors", "Trade corridors", "Routes to Iran's ports and Central Asia.", 18, 3, [MOD("trade_efficiency", 0.03, 2920), OPN("IRN", 5)], pre=["airports"])
A.f("pakistan_relations", "Relations with Pakistan", "Trade and the border with Pakistan.", 24, 1, [OPN("PAK", 10)], pre=["foreign_policy"])
A.f("india_ties", "Ties with India", "Aid and trade with India.", 26, 1, [OPN("IND", 10), TREAS(0.2)], pre=["foreign_policy"])
A.f("foreign_policy", "Foreign policy", "Afghanistan among its neighbours.", 25, 0, [PP(20)], ai=4)
A.f("central_asia_ties", "Central Asian neighbours", "Power and rail from Uzbekistan and Turkmenistan.", 25, 2, [OPN("UZB", 10), OPN("TKM", 10), MOD("energy_cost", -0.02, 2920)], pre=["pakistan_relations|india_ties"])
A.f("regional_conference", "A regional conference", "Host a regional conference on trade and security.", 25, 3, [MOD("diplomatic_reputation", 0.03, 2920)], pre=["central_asia_ties"])

society_branch(A, max(f["x"] for f in A.F) + 2)
A.write("Afghanistan", "Afghanistan from December 2001 to August 2021 in the style of the Russian model tree (AFG uses the Taliban tree before and the Islamic Emirate tree after, see gen_isg_tal.py): the government of the day as the historical path, a broad-coalition alternative and a junta; branches for the Islamic Republic and for the economy (roads, irrigation, alternative crops). Sourced starting spirits in data/spirits/afg.json. Wars stay in the scripted conflict events.",
        ["Taliban government (1996–2001)", "Northern Alliance", "United Nations Security Council Resolution 1267", "Opium production in Afghanistan", "2001 United States invasion of Afghanistan", "Bonn Agreement (Afghanistan)", "Afghan National Army", "International Security Assistance Force", "Fall of Kabul (2021)", "Doha Agreement (2020)"])

# The Islamic State, Taliban and Islamic Emirate trees are in gen_isg_tal.py.
