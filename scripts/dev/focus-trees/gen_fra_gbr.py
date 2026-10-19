"""France and United Kingdom trees in the Russia model style. Run from the repo root."""
import sys; sys.path.insert(0, __file__.replace("\\", "/").rsplit("/", 1)[0])
from treelib import *

# ============================================================ FRANCE
write_spirits("fra", "France's national spirits. The ones with `start` describe the situation on 1 January 2000 and cite sources. Values are gameplay estimates.", [
    start_spirit("fra_nuclear_fleet", "Nuclear electricity", "Nuclear power has been the largest source of French electricity since the mid-1980s; EDF is state-owned.", "strength", {"energy_cost": -0.05, "nuclear_output": 0.15}, "FRA", "Nuclear power in France"),
    start_spirit("fra_force_de_frappe", "Force de frappe", "France's own nuclear deterrent, operational since 1964.", "strength", {"diplomatic_reputation": 0.05, "foreign_influence_resistance": 0.05}, "FRA", "Force de dissuasion"),
    start_spirit("fra_35_hour_week", "The 35-hour week", "The legal working week is cut to 35 hours.", "policy", {"production_efficiency": -0.02, "stability_factor": 0.01}, "FRA", "35-hour workweek"),
    spirit("fra_pension_reform", "Pension reform", "A later retirement age keeps the pension system solvent.", "policy", {"welfare_cost": -0.005, "stability_factor": -0.02}),
    spirit("fra_sahel_operations", "Operations in the Sahel", "French troops fight Islamist groups in the Sahel.", "policy", {"army_org": 0.02, "welfare_cost": 0.001}),
    spirit("fra_reindustrialisation", "Reindustrialisation", "Investment in new factories, nuclear reactors and green industry.", "policy", {"private_sector_output": 0.03, "research_speed": 0.03}),
])
write_decisions("fra", "FRA", "French state projects", [
    ("fra_new_reactor", "Order a new reactor", "Order a new EPR reactor.", "fra_new_nuclear", 30, [TREAS(-2), MOD("nuclear_output", 0.03, 3650)], CASH(2), 540),
    ("fra_metro_line", "Open a Grand Paris line", "Open a new line of the Grand Paris Express.", "fra_grand_paris", 30, [TREAS(-1), {"add_buildings": {"building": "infrastructure", "count": 2}}], CASH(1), 365),
])
F = Tree("fra", "FRA")
x = democracy_paths(F, 0, {"social_democratic": "the Socialist Party and the Greens", "conservative": "the RPR, the UMP and later Les Républicains", "liberal_democratic": "Liberal Democracy, later the MoDem and Renaissance",
                            "nationalist_populist": "the National Front, later the National Rally", "socialist_communist": "the Communist Party and later La France Insoumise"}, junta=False)
F.f("economy", "Economic agenda", "Priorities for the French economy.", x + 2, 0, [PP(20)], ai=5)
F.f("euro_cash", "Euro notes and coins", "Replace the franc with euro notes and coins on 1 January 2002.", x + 1, 1, [MOD("trade_efficiency", 0.03, 3650), STAB(0.01)], pre=["economy"], avail=AFTER("2002-01-01"), ai=5)
F.f("tgv_network", "Extend the TGV", "New high-speed lines to the east and the west.", x + 3, 1, [F.BUILD("infrastructure", 3)], pre=["economy"])
F.f("pension_reform", "Pension reform", "Raise the retirement age, as the 2023 reform raised it from 62 to 64.", x + 1, 2, [F.SPIRIT("pension_reform"), IG("labour_unions", -8)], pre=["euro_cash"], avail=AFTER("2023-01-01"))
F.f("grand_paris", "Grand Paris Express", "Four new metro lines and 200 km of track around Paris. Unlocks new lines.", x + 3, 2, [F.BUILD("infrastructure", 3), TREAS(-2)], pre=["tgv_network"], avail=ALL(AFTER("2010-01-01"), CASH(2)))
F.f("aerospace", "Aerospace", "Airliners, satellites and rockets.", x + 2, 2, [F.BUILD("civilian_factory", 2), RB("air_drones", 0.2, 1)], pre=["euro_cash|tgv_network"])
F.f("labour_reform", "Labour reform", "Make hiring and firing easier.", x + 1, 3, [F.REMOVE("35_hour_week"), MOD("private_sector_output", 0.03, 2920), IG("labour_unions", -6)], pre=["pension_reform|aerospace"], days=105)
F.f("start_ups", "A start-up nation", "Tax breaks and a campus for start-ups.", x + 2, 3, [RB("economy_digital", 0.2, 2), F.BUILD("data_centre", 1)], pre=["aerospace"])
F.f("yellow_vests", "Answer the yellow vests", "Respond to the protests over fuel prices that began on 17 November 2018.", x + 3, 3, [UNREST(-0.03), {"set_budget": {"spending": 0.5}}, IG("rural", 4)], pre=["grand_paris|aerospace"], avail=AFTER("2018-11-17"))
F.f("new_nuclear", "New nuclear reactors", "A new generation of reactors. Unlocks reactor orders.", x + 2, 4, [MOD("nuclear_output", 0.05, 3650), RB("industry_energy", 0.2, 2)], pre=["start_ups|labour_reform"], avail=AFTER("2022-01-01"))
F.f("reindustrialisation", "Reindustrialisation", "Bring factories back to France.", x + 3, 4, [F.SPIRIT("reindustrialisation"), F.BUILD("civilian_factory", 3)], pre=["yellow_vests|start_ups"], avail=AFTER("2020-01-01"))
x2 = x + 5
F.f("defence", "Defence policy", "Forces for France's role in the world.", x2 + 2, 0, [IG("military", 2)], ai=4)
F.f("professional_army", "A professional army", "Finish the move to a professional army after conscription was phased out between 1997 and 2001.", x2 + 1, 1, [MOD("army_org", 0.04, 3650), IG("youth_students", 3)], pre=["defence"])
F.f("deterrent", "Modernise the deterrent", "New submarines and missiles for the force de frappe.", x2 + 3, 1, [RB("artillery_missiles", 0.2, 2), RB("naval", 0.15, 1)], pre=["defence"])
F.f("rafale", "The Rafale", "Equip the air force with Rafale fighters and sell them abroad.", x2 + 2, 2, [RB("air_drones", 0.2, 2), F.BUILD("military_factory", 1), TREAS(1)], pre=["professional_army|deterrent"])
F.f("sahel", "Operations in the Sahel", "Operation Serval in Mali from 2013 and Operation Barkhane from 1 August 2014.", x2 + 1, 2, [F.SPIRIT("sahel_operations"), MOD("army_attack", 0.02, 2920)], pre=["professional_army"], avail=AFTER("2013-01-11"), ai=3)
F.f("leave_sahel", "Leave the Sahel", "End Operation Barkhane, as France did on 9 November 2022.", x2 + 1, 3, [F.REMOVE("sahel_operations"), STAB(0.01)], pre=["sahel"], avail=AFTER("2022-11-09"), ai=3)
F.f("carrier", "A new aircraft carrier", "Plan a successor to the carrier Charles de Gaulle.", x2 + 3, 2, [F.BUILD("port", 1), RB("naval", 0.2, 1)], pre=["deterrent"])
F.f("defence_budget", "A larger defence budget", "Raise defence spending after 2022.", x2 + 2, 3, [F.BUILD("military_factory", 2), EQUIP(1000)], pre=["rafale|carrier"], avail=AFTER("2022-03-01"))
x3 = x2 + 5
F.f("foreign_policy", "Foreign policy", "France in Europe and the world.", x3 + 2, 0, [PP(20)], ai=4)
F.f("european_defence", "European defence", "A defence policy for the European Union.", x3 + 1, 1, [OPN("DEU", 10), MOD("diplomatic_reputation", 0.03, 2920)], pre=["foreign_policy"])
F.f("africa_partners", "Partners in Africa", "Aid and security partnerships in Africa.", x3 + 3, 1, [MOD("foreign_influence_power", 0.05, 2920)], pre=["foreign_policy"])
F.f("nato_role", "France in NATO", "A full role in NATO's command, which France left in 1966.", x3 + 2, 2, [OPN("USA", 10), OPN("GBR", 5)], pre=["european_defence|africa_partners"], avail=AFTER("2009-01-01"))
F.f("indo_pacific", "The Indo-Pacific", "France's territories and partners in the Indo-Pacific.", x3 + 3, 2, [OPN("IND", 10), OPN("AUS", 5)], pre=["africa_partners"])
society_branch(F, max(f["x"] for f in F.F) + 2)
F.write("France", "France in the style of the Russian model tree: democratic government as the historical path and alternatives led by real parties of the data; economy (the euro, the TGV, Grand Paris Express, pension and labour reforms, new nuclear reactors), defence (a professional army, the deterrent, the Sahel) and foreign policy. Sourced starting spirits in data/spirits/fra.json. Alternatives are a counterfactual.",
        ["35-hour workweek", "Conscription in France", "Nuclear power in France", "Force de dissuasion", "Euro", "2023 French pension reform protests", "Grand Paris Express", "France and NATO", "Operation Serval", "Operation Barkhane", "Yellow vests movement"])

# ============================================================ UNITED KINGDOM
write_spirits("gbr", "The United Kingdom's national spirits. The ones with `start` describe the situation on 1 January 2000 and cite sources. Values are gameplay estimates.", [
    start_spirit("gbr_independent_central_bank", "An independent central bank", "The Bank of England became an independent public organisation in 1998.", "strength", {"inflation": -0.01, "interest_rate": -0.003}, "GBR", "Bank of England"),
    start_spirit("gbr_devolution", "Devolution", "The Scotland Act 1998 set up a Scottish Parliament and government.", "policy", {"unrest": -0.01, "political_power_gain": -0.03}, "GBR", "Scotland Act 1998"),
    start_spirit("gbr_good_friday", "The Good Friday Agreement", "The agreement signed on 10 April 1998 ended most of the violence of the Troubles.", "strength", {"stability_factor": 0.02}, "GBR", "Good Friday Agreement"),
    spirit("gbr_austerity", "Austerity", "Spending cuts to close the deficit.", "policy", {"welfare_cost": -0.01, "stability_factor": -0.02}),
    spirit("gbr_outside_the_eu", "Outside the European Union", "The United Kingdom has left the European Union.", "policy", {"trade_efficiency": -0.04, "foreign_influence_resistance": 0.05}),
    spirit("gbr_bank_rescue", "Bank rescue", "The state has rescued failing banks.", "policy", {"interest_rate": -0.003, "gdp_growth": -0.002}),
])
write_decisions("gbr", "GBR", "British state projects", [
    ("gbr_offshore_wind", "Offshore wind farm", "Fund an offshore wind farm in the North Sea.", "gbr_offshore_wind_programme", 30, [TREAS(-1), {"add_buildings": {"building": "renewable_plant", "count": 1}}], CASH(1), 365),
    ("gbr_frigate_order", "Order frigates", "Order new frigates for the Royal Navy.", "gbr_royal_navy", 30, [TREAS(-1), RB("naval", 0.15, 1)], CASH(1), 540),
])
B = Tree("gbr", "GBR")
x = democracy_paths(B, 0, {"social_democratic": "Labour", "liberal_democratic": "the Liberal Democrats", "conservative": "the Conservatives and the Ulster Unionists",
                            "nationalist_populist": "UKIP, the Brexit Party and later Reform UK", "socialist_communist": "Respect"}, junta=False)
B.f("economy", "Economic agenda", "Priorities for the British economy.", x + 2, 0, [PP(20)], ai=5)
B.f("public_services", "Invest in public services", "More money for schools and hospitals.", x + 1, 1, [MOD("health_outcomes", 0.03, 2920), MOD("education_quality", 0.03, 2920), {"set_budget": {"spending": 1}}], pre=["economy"])
B.f("city_of_london", "The City of London", "Keep London a global financial centre.", x + 3, 1, [MOD("foreign_investment", 0.05, 2920), B.BUILD("data_centre", 1)], pre=["economy"])
B.f("bank_rescue", "Rescue the banks", "Nationalise failing banks such as Northern Rock in the financial crisis.", x + 1, 2, [B.SPIRIT("bank_rescue"), TREAS(-5)], pre=["public_services|city_of_london"], avail=ALL(AFTER("2008-01-01"), CASH(5)), ai=4)
B.f("austerity", "Austerity", "Cut spending to close the deficit after the crisis.", x + 2, 2, [B.SPIRIT("austerity"), B.REMOVE("bank_rescue"), TREAS(3), IG("labour_unions", -5)], pre=["bank_rescue|city_of_london"], avail=AFTER("2010-05-01"))
B.f("fintech", "Fintech", "Make Britain a centre for financial technology.", x + 3, 2, [RB("economy_digital", 0.2, 2)], pre=["city_of_london"])
B.f("hs2", "High Speed 2", "A new high-speed railway from London to the north, under construction since 2020.", x + 1, 3, [B.BUILD("infrastructure", 3), TREAS(-3)], pre=["austerity|bank_rescue"], avail=ALL(AFTER("2020-01-01"), CASH(3)))
B.f("offshore_wind_programme", "Offshore wind", "The largest offshore wind fleet in the world. Unlocks new wind farms.", x + 2, 3, [B.BUILD("renewable_plant", 2), MOD("energy_cost", -0.02, 3650)], pre=["austerity|fintech"], avail=AFTER("2010-01-01"))
B.f("levelling_up", "Levelling up", "Investment in the poorer regions of the north and the Midlands.", x + 3, 3, [B.BUILD("civilian_factory", 2), IG("labour_unions", 2)], pre=["fintech"], avail=AFTER("2019-12-01"))
B.f("new_nuclear", "New nuclear plants", "New reactors at Hinkley Point and Sizewell.", x + 2, 4, [MOD("nuclear_output", 0.05, 3650), RB("industry_energy", 0.2, 1)], pre=["offshore_wind_programme|hs2"], avail=AFTER("2016-01-01"))
x2 = x + 5
B.f("constitution", "The union and the constitution", "Devolution, Northern Ireland and Europe.", x2 + 2, 0, [PP(20)], ai=4)
B.f("northern_ireland_assembly", "Power sharing in Northern Ireland", "Keep the institutions of the Good Friday Agreement working.", x2 + 1, 1, [STAB(0.02), IG("minorities", 3)], pre=["constitution"])
B.f("scottish_referendum", "The Scottish referendum", "Hold a referendum on Scottish independence; on 18 September 2014 Scotland voted No by 55.3 to 44.7 percent.", x2 + 3, 1, [STAB(0.01), PP(20)], pre=["constitution"], avail=ALL(HIST, AFTER("2014-09-18")), ai=4)
B.f("leave_the_eu", "Leave the European Union", "The United Kingdom left the European Union on 31 January 2020.", x2 + 2, 2, [B.SPIRIT("outside_the_eu"), OPN("FRA", -10), OPN("DEU", -10), PP(50)], pre=["northern_ireland_assembly|scottish_referendum"], avail=ALL(HIST, AFTER("2020-01-31")), ai=5)
B.f("trade_deals", "New trade deals", "Trade agreements with Australia, Japan and the Pacific partnership.", x2 + 2, 3, [MOD("trade_efficiency", 0.03, 3650), OPN("AUS", 10), OPN("JPN", 10)], pre=["leave_the_eu"])
B.f("devolution_settlement", "A new devolution settlement", "More powers for Scotland and Wales.", x2 + 3, 2, [B.REMOVE("devolution"), IG("minorities", 4), STAB(0.01)], pre=["scottish_referendum"], days=105)
x3 = x2 + 5
B.f("defence", "Defence review", "Strategy and forces for the new century.", x3 + 2, 0, [IG("military", 2)], ai=4)
B.f("expeditionary_forces", "Expeditionary forces", "Forces that deploy far from home, as in Iraq from 2003 and Afghanistan.", x3 + 1, 1, [MOD("army_org", 0.03, 2920), DIVS("mechanised_division", 1)], pre=["defence"])
B.f("royal_navy", "Rebuild the Royal Navy", "Two new aircraft carriers and new frigates. Unlocks frigate orders.", x3 + 3, 1, [B.BUILD("port", 1), RB("naval", 0.25, 2)], pre=["defence"])
B.f("sdsr_2010", "The 2010 defence review", "A Strategic Defence and Security Review published on 19 October 2010.", x3 + 1, 2, [MOD("army_org", 0.02, 2920), TREAS(2), IG("military", -3)], pre=["expeditionary_forces"], avail=ALL(HIST, AFTER("2010-10-19")), ai=3)
B.f("trident", "Renew Trident", "New submarines for the nuclear deterrent.", x3 + 3, 2, [RB("artillery_missiles", 0.2, 1), MOD("diplomatic_reputation", 0.03, 3650)], pre=["royal_navy"])
B.f("aukus", "AUKUS", "A security pact with Australia and the United States, announced on 15 September 2021.", x3 + 2, 3, [OPN("AUS", 15), OPN("USA", 10), RB("naval", 0.2, 1)], pre=["trident|sdsr_2010"], avail=ALL(HIST, AFTER("2021-09-15")), ai=4)
B.f("support_ukraine", "Support for Ukraine", "Training and weapons for Ukraine.", x3 + 1, 3, [OPN("UKR", 20), OPN("RUS", -20), TREAS(-1)], pre=["sdsr_2010|expeditionary_forces"], avail=AFTER("2022-02-24"))
B.f("defence_industry", "Defence industry", "Combat aircraft, warships and munitions.", x3 + 2, 4, [B.BUILD("military_factory", 2), EQUIP(800)], pre=["aukus|support_ukraine"])
society_branch(B, max(f["x"] for f in B.F) + 2)
B.write("United Kingdom", "The United Kingdom in the style of the Russian model tree: democratic government as the historical path and alternatives led by real parties of the data; economy (public services, the bank rescue, austerity, HS2, offshore wind), the union and the constitution (Northern Ireland, the Scottish referendum, leaving the EU), defence (the 2010 review, Trident, AUKUS). Sourced starting spirits in data/spirits/gbr.json. Alternatives are a counterfactual.",
        ["Five economic tests", "Premiership of Tony Blair", "Bank of England", "Scotland Act 1998", "Good Friday Agreement", "Northern Rock", "2014 Scottish independence referendum", "Brexit", "High Speed 2", "AUKUS", "Strategic Defence and Security Review 2010"])
