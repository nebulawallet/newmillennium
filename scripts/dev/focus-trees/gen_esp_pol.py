"""Spain and Poland trees in the Russia model style. Run from the repo root."""
import sys; sys.path.insert(0, __file__.replace("\\", "/").rsplit("/", 1)[0])
from treelib import *

# ============================================================ SPAIN
write_spirits("esp", "Spain's national spirits. The ones with `start` describe the situation on 1 January 2000 and cite sources. Values are gameplay estimates.", [
    start_spirit("esp_eta", "ETA", "ETA, an armed Basque separatist group active since 1959, has not ended its armed activity.", "problem", {"unrest": 0.02, "stability_factor": -0.02}, "ESP", "ETA (separatist group)"),
    start_spirit("esp_property_boom", "Property boom", "House prices have risen since 1996, driving a construction boom.", "policy", {"construction_speed": 0.05, "gdp_growth": 0.002}, "ESP", "Spanish property bubble"),
    start_spirit("esp_unemployment", "High unemployment", "Spain has had the highest unemployment rate in the EU from the early 2000s.", "problem", {"stability_factor": -0.02, "welfare_cost": 0.003}, "ESP", "Unemployment in Spain"),
    start_spirit("esp_high_speed_rail", "High-speed rail", "The first high-speed line, Madrid-Córdoba-Seville, opened in 1992.", "strength", {"trade_efficiency": 0.02}, "ESP", "High-speed rail in Spain"),
    spirit("esp_property_crash", "Property crash", "House prices fall and the banks carry bad loans.", "problem", {"gdp_growth": -0.01, "construction_speed": -0.05, "interest_rate": 0.01}),
    spirit("esp_renewable_leader", "Renewable leader", "Wind and solar make up a large share of the electricity.", "strength", {"energy_cost": -0.04, "renewable_output": 0.15}),
])
write_decisions("esp", "ESP", "Spanish state projects", [
    ("esp_new_ave_line", "Open a high-speed line", "A new AVE line to another region.", "esp_ave_network", 30, [TREAS(-1), {"add_buildings": {"building": "infrastructure", "count": 2}}], CASH(1), 365),
    ("esp_solar_auction", "Solar and wind auction", "Auction new renewable capacity.", "esp_renewables", 25, [{"add_buildings": {"building": "renewable_plant", "count": 1}}], None, 365),
])
E = Tree("esp", "ESP")
x = democracy_paths(E, 0, {"social_democratic": "the PSOE and United Left", "conservative": "the People's Party", "liberal_democratic": "Ciudadanos and UPyD",
                            "nationalist_populist": "Vox", "socialist_communist": "Podemos"}, junta=False)
E.f("economy", "Economic agenda", "Priorities for the Spanish economy.", x + 2, 0, [PP(20)], ai=5)
E.f("ave_network", "Extend the AVE", "High-speed lines to Barcelona, Valencia and Galicia. Unlocks new lines.", x + 1, 1, [E.BUILD("infrastructure", 4), TREAS(-2)], pre=["economy"], avail=CASH(2))
E.f("tourism", "Tourism", "Hotels, airports and marketing.", x + 3, 1, [MOD("gdp_growth", 0.002, 2920), E.BUILD("air_base", 1)], pre=["economy"])
E.f("property_crash", "The property crash", "House prices fall after 2008 and the construction boom ends.", x + 2, 1, [E.SWAP("property_boom", "property_crash")], pre=["economy"], avail=ALL(HIST, AFTER("2008-09-15")), ai=6)
E.f("bank_rescue", "Rescue the banks", "A European Stability Mechanism credit for the banks in 2012; Spain drew €41 billion.", x + 1, 2, [TREAS(5), IG("business", 3)], pre=["property_crash"], avail=ALL(HIST, AFTER("2012-06-01")), ai=4)
E.f("bad_bank", "A bad bank", "Sareb, created on 31 August 2012, takes over the banks' property assets.", x + 2, 2, [E.REMOVE("property_crash"), STAB(0.02)], pre=["bank_rescue"], avail=AFTER("2012-08-31"), days=105, ai=4)
E.f("labour_reform", "Labour reform", "Make contracts more flexible to cut unemployment.", x + 3, 2, [E.REMOVE("unemployment"), IG("labour_unions", -6), MOD("private_sector_output", 0.03, 2920)], pre=["tourism|property_crash"], days=140, ai=3)
E.f("renewables", "Wind and solar", "Spain was the first country where wind was the main source of electricity, in 2013. Unlocks auctions.", x + 3, 3, [E.SPIRIT("renewable_leader"), E.BUILD("renewable_plant", 3)], pre=["labour_reform|tourism"], avail=AFTER("2005-01-01"))
E.f("car_industry", "Car industry", "Car plants and electric vehicle batteries.", x + 1, 3, [E.BUILD("civilian_factory", 3)], pre=["bad_bank|ave_network"])
E.f("next_generation", "Next Generation EU funds", "Spend the EU recovery funds agreed on 21 July 2020.", x + 2, 3, [E.SPIRIT("stimulus"), E.BUILD("data_centre", 1), E.BUILD("infrastructure", 2)], pre=["bad_bank|labour_reform"], avail=AFTER("2021-01-01"))
E.f("green_hydrogen", "Green hydrogen", "Hydrogen from solar power.", x + 3, 4, [RB("industry_energy", 0.25, 2)], pre=["renewables|next_generation"])
x2 = x + 5
E.f("state", "State and regions", "Spain's state and its autonomous communities.", x2 + 2, 0, [PP(20)], ai=4)
E.f("against_eta", "End ETA's violence", "Police cooperation with France against ETA; ETA announced the end of its armed activity in 2011 and dissolved in 2018.", x2 + 1, 1, [E.REMOVE("eta"), STAB(0.03)], pre=["state"], avail=AFTER("2011-10-01"), days=105, ai=5)
E.f("catalan_question", "The Catalan question", "Answer the independence referendum of 1 October 2017, which the Constitutional Court had suspended.", x2 + 3, 1, [STAB(-0.02), IG("minorities", -3), PP(30)], pre=["state"], avail=ALL(HIST, AFTER("2017-10-01")), ai=3)
E.f("regional_financing", "Regional financing", "A new deal on money for the regions.", x2 + 2, 2, [IG("minorities", 5), STAB(0.02)], pre=["against_eta|catalan_question"])
E.f("end_conscription", "A professional army", "End conscription, as Spain did in December 2001.", x2 + 1, 2, [MOD("army_org", 0.03, 3650), IG("youth_students", 5)], pre=["state"], avail=AFTER("2001-12-01"), ai=4)
E.f("navy_and_air", "Navy and air force", "Frigates, an amphibious ship and new fighters.", x2 + 1, 3, [E.BUILD("port", 1), RB("naval", 0.15, 1), RB("air_drones", 0.15, 1)], pre=["end_conscription"])
E.f("latin_america", "Ties with Latin America", "Investment and diplomacy in Latin America.", x2 + 3, 2, [OPN("MEX", 10), OPN("ARG", 10), MOD("foreign_influence_power", 0.03, 2920)], pre=["catalan_question|state"])
E.f("mediterranean", "The Mediterranean", "Cooperation with Morocco on migration and trade.", x2 + 3, 3, [OPN("MAR", 10), MOD("trade_efficiency", 0.02, 2920)], pre=["latin_america"])
society_branch(E, max(f["x"] for f in E.F) + 2)
E.write("Spain", "Spain in the style of the Russian model tree: democratic government as the historical path and alternatives led by real parties of the data; economy (the AVE, the property crash, the 2012 bank rescue and Sareb, renewables, Next Generation EU), state and regions (the end of ETA, the Catalan question, a professional army) and foreign policy. Sourced starting spirits in data/spirits/esp.json. Alternatives are a counterfactual.",
        ["Conscription in Spain", "Same-sex marriage in Spain", "ETA (separatist group)", "High-speed rail in Spain", "Unemployment in Spain", "Spanish property bubble", "Economy of Spain", "Sareb", "2017 Catalan independence referendum", "Wind power in Spain", "Next Generation EU"])

# ============================================================ POLAND
write_spirits("pol", "Poland's national spirits. The ones with `start` describe the situation on 1 January 2000 and cite sources. Values are gameplay estimates.", [
    start_spirit("pol_nato_member", "NATO member", "Poland joined NATO on 12 March 1999.", "strength", {"army_defence": 0.03, "foreign_influence_resistance": 0.05}, "POL", "Poland–NATO relations"),
    start_spirit("pol_coal_power", "Coal power", "Coal dominates Poland's energy.", "policy", {"energy_cost": -0.02, "fossil_output": 0.05, "health_outcomes": -0.02}, "POL", "Energy in Poland"),
    spirit("pol_eu_member", "EU member", "Membership of the European Union brings funds and an open market.", "strength", {"trade_efficiency": 0.05, "foreign_investment": 0.08, "construction_speed": 0.05}),
    spirit("pol_homeland_defence", "Homeland defence", "A larger army and defence spending of 3 percent of GDP.", "policy", {"manpower_factor": 0.04, "army_org": 0.03, "welfare_cost": 0.002}),
    spirit("pol_energy_diversified", "Diversified energy", "Gas from Norway and LNG; less coal.", "strength", {"foreign_influence_resistance": 0.05, "energy_cost": -0.01}),
])
write_decisions("pol", "POL", "Polish state projects", [
    ("pol_motorway_section", "Build a motorway section", "A new section of motorway with EU funds.", "pol_motorways", 25, [TREAS(-0.5), {"add_buildings": {"building": "infrastructure", "count": 2}}], CASH(0.5), 365),
    ("pol_arms_purchase", "Arms purchase", "Buy tanks, howitzers or aircraft.", "pol_homeland_defence", 30, [TREAS(-1), {"add_equipment": {"family": "infantry_equipment", "amount": 600}}], CASH(1), 365),
])
P = Tree("pol", "POL")
x = democracy_paths(P, 0, {"conservative": "AWS, Civic Platform and the PSL", "social_democratic": "the SLD and Razem", "liberal_democratic": "the Freedom Union and later Modern",
                            "nationalist_populist": "Law and Justice, the LPR and later Konfederacja", "socialist_communist": "Self-Defence"}, junta=False)
P.f("economy", "Economic agenda", "Priorities for the Polish economy.", x + 2, 0, [PP(20)], ai=5)
P.f("eu_accession", "Join the European Union", "The referendum of June 2003 approved entry, and Poland joined the EU on 1 May 2004.", x + 1, 1, [P.SPIRIT("eu_member"), OPN("DEU", 10)], pre=["economy"], avail=ALL(HIST, AFTER("2004-05-01")), ai=6)
P.f("privatisation", "Privatisation", "Finish the sale of state companies.", x + 3, 1, [MOD("private_sector_output", 0.04, 2920), TREAS(2)], pre=["economy"])
P.f("motorways", "Motorways", "Build a motorway network with EU funds. Unlocks motorway sections.", x + 1, 2, [P.BUILD("infrastructure", 4)], pre=["eu_accession"])
P.f("no_recession", "Through the crisis", "Poland was the only EU economy to avoid recession in the 2008 crisis.", x + 2, 2, [STAB(0.02), MOD("gdp_growth", 0.003, 1460)], pre=["eu_accession|privatisation"], avail=AFTER("2009-01-01"))
P.f("special_zones", "Special economic zones", "Tax breaks for investors.", x + 3, 2, [P.BUILD("civilian_factory", 3), MOD("foreign_investment", 0.05, 2920)], pre=["privatisation"])
P.f("family_benefits", "Family benefits", "A monthly child benefit for families.", x + 1, 3, [MOD("population_growth", 0.001, 3650), {"set_budget": {"spending": 1}}, IG("rural", 4)], pre=["motorways|no_recession"], avail=AFTER("2016-01-01"))
P.f("baltic_pipe", "Baltic Pipe", "A gas pipeline from Norway, operational from 27 September 2022.", x + 2, 3, [P.SPIRIT("energy_diversified"), OPN("RUS", -5), OPN("NOR", 10)], pre=["no_recession|special_zones"], avail=AFTER("2022-09-27"), ai=4)
P.f("lng_terminal", "An LNG terminal", "A terminal for liquefied gas on the Baltic.", x + 3, 3, [P.BUILD("port", 1), MOD("energy_cost", -0.01, 3650)], pre=["special_zones"], avail=AFTER("2015-01-01"))
P.f("leave_coal", "Leave coal", "Replace coal with wind, solar and nuclear.", x + 2, 4, [P.REMOVE("coal_power"), P.BUILD("renewable_plant", 3), IG("labour_unions", -5)], pre=["baltic_pipe|lng_terminal"], days=140, ai=3)
P.f("nuclear_plant", "A nuclear power plant", "Poland's first nuclear power plant.", x + 3, 4, [MOD("nuclear_output", 0.05, 3650), RB("industry_energy", 0.2, 1)], pre=["lng_terminal"], avail=AFTER("2020-01-01"))
P.f("central_airport", "A central airport", "A new central airport and rail hub.", x + 1, 4, [P.BUILD("air_base", 1), P.BUILD("infrastructure", 2), TREAS(-1)], pre=["family_benefits"], avail=ALL(AFTER("2018-01-01"), CASH(1)))
x2 = x + 5
P.f("defence", "Defence policy", "Poland's forces in NATO.", x2 + 2, 0, [IG("military", 2)], ai=4)
P.f("professional_army", "A professional army", "End conscription and build a professional army.", x2 + 1, 1, [MOD("army_org", 0.03, 3650)], pre=["defence"], avail=AFTER("2008-01-01"))
P.f("missions", "Missions abroad", "Deploy to Iraq and Afghanistan with the allies.", x2 + 3, 1, [MOD("army_org", 0.02, 2920), OPN("USA", 10)], pre=["defence"], avail=AFTER("2003-01-01"))
P.f("homeland_defence", "Homeland Defence Act", "A law of 11 March 2022: 300,000 soldiers and defence spending of 3 percent of GDP. Unlocks arms purchases.", x2 + 2, 2, [P.SPIRIT("homeland_defence"), DIVS("mechanised_division", 2), P.BUILD("military_factory", 2)], pre=["professional_army|missions"], avail=ALL(HIST, AFTER("2022-03-11")), ai=5)
P.f("territorial_defence", "Territorial defence", "A territorial defence force of volunteers.", x2 + 1, 2, [DIVS("infantry_division", 2), MOD("army_defence", 0.02, 3650)], pre=["professional_army"], avail=AFTER("2017-01-01"))
P.f("air_defence", "Air and missile defence", "Patriot batteries and air defence.", x2 + 3, 2, [MOD("army_defence", 0.03, 3650), RB("artillery_missiles", 0.2, 1)], pre=["missions"])
P.f("armour", "Tanks and howitzers", "Hundreds of new tanks and howitzers.", x2 + 2, 3, [RB("armour", 0.25, 2), EQUIP(1500)], pre=["homeland_defence|territorial_defence|air_defence"])
x3 = x2 + 5
P.f("foreign_policy", "Foreign policy", "Poland in Europe and NATO.", x3 + 2, 0, [PP(20)], ai=4)
P.f("weimar_triangle", "The Weimar Triangle", "Cooperation with Germany and France.", x3 + 1, 1, [OPN("DEU", 10), OPN("FRA", 10)], pre=["foreign_policy"])
P.f("us_partnership", "US partnership", "US troops and bases in Poland.", x3 + 3, 1, [OPN("USA", 15), MOD("army_defence", 0.02, 2920)], pre=["foreign_policy"])
P.f("three_seas", "The Three Seas", "Infrastructure between the Baltic, the Adriatic and the Black Sea.", x3 + 2, 2, [MOD("trade_efficiency", 0.02, 2920), OPN("CZE", 5), OPN("ROU", 5)], pre=["weimar_triangle|us_partnership"], avail=AFTER("2016-01-01"))
P.f("help_ukraine", "Help Ukraine", "Weapons, transit and shelter for refugees.", x3 + 2, 3, [OPN("UKR", 25), OPN("RUS", -20), TREAS(-1)], pre=["three_seas|us_partnership"], avail=AFTER("2022-02-24"))
society_branch(P, max(f["x"] for f in P.F) + 2)
P.write("Poland", "Poland in the style of the Russian model tree: democratic government as the historical path and alternatives led by real parties of the data; economy (EU accession, motorways, avoiding recession in 2009, Baltic Pipe, leaving coal), defence (the Homeland Defence Act) and foreign policy. Sourced starting spirits in data/spirits/pol.json. Alternatives are a counterfactual.",
        ["Jerzy Buzek", "2003 Polish European Union membership referendum", "Military service", "Poland–NATO relations", "Accession of Poland to the European Union", "Economy of Poland", "Energy in Poland", "Baltic Pipe", "Homeland Defence Act"])
