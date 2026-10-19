"""Turkey and Germany trees in the Russia model style. Run from the repo root."""
import sys; sys.path.insert(0, __file__.replace("\\", "/").rsplit("/", 1)[0])
from treelib import *

# ============================================================ TURKEY
write_spirits("tur", "Turkey's national spirits. The ones with `start` describe the situation on 1 January 2000 and cite sources. Values are gameplay estimates.", [
    start_spirit("tur_fiscal_fragility", "Fragile public finances", "Large budget deficits are financed by high-interest bonds held by the banks; the IMF lends to Turkey in late 2000 and a crisis breaks out in February 2001.", "problem", {"interest_rate": 0.02, "inflation": 0.03, "foreign_investment": -0.05}, "TUR", "2001 Turkish economic crisis"),
    start_spirit("tur_eu_candidate", "EU candidate", "The European Union recognised Turkey as a candidate on 12 December 1999 at Helsinki.", "strength", {"foreign_investment": 0.03, "trade_efficiency": 0.02}, "TUR", "Accession of Turkey to the European Union"),
    start_spirit("tur_pkk_insurgency", "PKK insurgency", "An insurgency by the Kurdistan Workers' Party in the south-east, with ceasefires from time to time.", "problem", {"unrest": 0.02, "stability_factor": -0.02}, "TUR", "Kurdistan Workers' Party"),
    start_spirit("tur_conscription", "Conscription", "Military service is compulsory for male citizens.", "strength", {"manpower_factor": 0.05}, "TUR", "Conscription in Turkey"),
    spirit("tur_stable_lira", "A stable lira", "Inflation is down and a new lira has replaced the old one.", "strength", {"inflation": -0.01, "foreign_investment": 0.05}),
    spirit("tur_defence_industry", "National defence industry", "Drones, warships and armoured vehicles made at home.", "strength", {"production_efficiency": 0.04, "foreign_influence_resistance": 0.05}),
    spirit("tur_presidential_system", "Presidential system", "An executive presidency without a prime minister.", "policy", {"political_power_gain": 0.1, "civil_liberties": -0.05}),
    spirit("tur_earthquake_damage", "Earthquake damage", "Cities in the south-east were destroyed by the earthquakes of February 2023.", "problem", {"production_efficiency": -0.03, "stability_factor": -0.02}),
])
write_decisions("tur", "TUR", "Turkish state projects", [
    ("tur_city_hospital", "Open a city hospital", "A large public-private hospital.", "tur_health_transformation", 30, [TREAS(-0.5), MOD("health_outcomes", 0.02, 1460)], CASH(0.5), 365),
    ("tur_drone_order", "Order drones", "An order of armed drones for the forces.", "tur_drones", 30, [TREAS(-0.5), MOD("air_effectiveness", 0.02, 1460)], CASH(0.5), 365),
    ("tur_rebuild_homes", "Rebuild homes", "Rebuild homes in the earthquake zone.", "tur_earthquake_recovery", 30, [TREAS(-1), {"add_buildings": {"building": "infrastructure", "count": 2}}], CASH(1), 180),
])
T = Tree("tur", "TUR")
x = democracy_paths(T, 0, {"social_democratic": "the DSP and the CHP", "conservative": "ANAP, the DYP and later the İYİ Party", "nationalist_populist": "the MHP",
                            "religious": "the Virtue Party, later the AKP and the Felicity Party"})
ANK, IST, IZM = None, None, None
T.f("economic_programme", "An economic programme", "A stabilisation programme with the IMF after the crisis of February 2001.", x + 2, 0, [PP(30), TREAS(3)], avail=AFTER("2001-02-21"), ai=6)
T.f("bank_restructuring", "Restructure the banks", "Close failed banks and set up an independent bank regulator.", x + 1, 1, [T.SWAP("fiscal_fragility", "balanced_budget"), IG("business", 3)], pre=["economic_programme"], days=105, ai=5)
T.f("central_bank_independence", "An independent central bank", "Let the central bank target inflation.", x + 3, 1, [MOD("inflation", -0.02, 2920)], pre=["economic_programme"])
T.f("new_lira", "The new Turkish lira", "Replace the old lira with a new lira, as Turkey did in 2005.", x + 2, 2, [T.SPIRIT("stable_lira"), STAB(0.02)], pre=["bank_restructuring", "central_bank_independence"], avail=AFTER("2005-01-01"), ai=4)
T.f("privatisation", "Privatisation", "Sell telecoms, refineries and state banks.", x + 1, 3, [MOD("private_sector_output", 0.04, 2920), TREAS(3), IG("labour_unions", -4)], pre=["new_lira"])
T.f("anatolian_tigers", "Anatolian tigers", "Support the export industries of the Anatolian cities.", x + 3, 3, [T.BUILD("civilian_factory", 4), MOD("trade_efficiency", 0.03, 2920)], pre=["new_lira"])
T.f("construction_boom", "Construction boom", "Housing, airports and bridges.", x + 2, 4, [T.BUILD("infrastructure", 4), MOD("construction_speed", 0.05, 2920), T.BUILD("air_base", 1)], pre=["privatisation|anatolian_tigers"])
T.f("energy_hub", "An energy hub", "Pipelines across Turkey from the Caspian and Russia to Europe.", x + 4, 4, [T.BUILD("refinery", 1), MOD("trade_efficiency", 0.03, 2920), TREAS(1)], pre=["anatolian_tigers"])
T.f("marmaray", "Marmaray", "A rail tunnel under the Bosporus, opened on 29 October 2013.", x + 1, 5, [T.BUILD("infrastructure", 3), MOD("trade_efficiency", 0.02, 3650)], pre=["construction_boom"], avail=AFTER("2013-10-29"), ai=4)
T.f("turkstream", "TurkStream", "A gas pipeline from Russia under the Black Sea, announced on 1 December 2014.", x + 4, 5, [MOD("energy_cost", -0.03, 3650), OPN("RUS", 10)], pre=["energy_hub"], avail=AFTER("2016-01-01"))
T.f("nuclear_plant", "A nuclear power plant", "Turkey's first nuclear plant on the Mediterranean.", x + 3, 5, [MOD("nuclear_output", 0.08, 3650), OPN("RUS", 5)], pre=["energy_hub|construction_boom"], avail=AFTER("2010-01-01"))
T.f("black_sea_gas", "Black Sea gas", "Develop the gas found in the Black Sea.", x + 2, 6, [T.BUILD("refinery", 1), MOD("energy_cost", -0.02, 3650)], pre=["marmaray|turkstream|nuclear_plant"], avail=AFTER("2020-08-01"))
x2 = x + 7
T.f("institutions", "State and constitution", "Reform of the state and its constitution.", x2 + 2, 0, [PP(20)], ai=4)
T.f("eu_reforms", "EU harmonisation packages", "Laws that bring Turkey's rules into line with the European Union.", x2 + 1, 1, [MOD("civil_liberties", 0.05, 2920), IG("minorities", 4), OPN("DEU", 5)], pre=["institutions"])
T.f("eu_negotiations", "Accession negotiations", "Membership negotiations with the European Union, opened on 3 October 2005.", x2 + 1, 2, [MOD("foreign_investment", 0.05, 2920), OPN("DEU", 5), OPN("FRA", 5)], pre=["eu_reforms"], avail=ALL(HIST, AFTER("2005-10-03")), ai=4)
T.f("referendum_2010", "The 2010 constitutional referendum", "Amendments approved on 12 September 2010 with 58 percent.", x2 + 3, 1, [PP(40), STAB(0.01)], pre=["institutions"], avail=ALL(HIST, AFTER("2010-09-12")), ai=4)
T.f("kurdish_peace", "A peace process", "Talks with the PKK and reforms for Kurdish citizens.", x2 + 2, 2, [T.REMOVE("pkk_insurgency"), IG("minorities", 8), STAB(0.03)], pre=["eu_reforms|referendum_2010"], avail=T.HAS("pkk_insurgency"), days=140, ai=2)
T.f("after_the_coup", "After the coup attempt", "Purge the coup plotters after the failed attempt of 15 July 2016.", x2 + 3, 2, [MOD("internal_security", 0.08, 2920), IG("military", -6), IG("security_services", 5), PP(40)], pre=["referendum_2010"], avail=ALL(HIST, AFTER("2016-07-16")), ai=4)
T.f("presidential_system", "An executive presidency", "Amendments approved on 16 April 2017 abolish the post of prime minister.", x2 + 3, 3, [T.SPIRIT("presidential_system"), IG("urban_middle_class", -4)], pre=["after_the_coup"], avail=ALL(HIST, AFTER("2017-04-16")), ai=4)
T.f("earthquake_recovery", "After the earthquakes", "Rebuild the south-east after the earthquakes of 6 February 2023. Unlocks rebuilding homes.", x2 + 2, 4, [T.SPIRIT("earthquake_damage"), T.SPIRIT("reconstruction_effort"), T.BUILD("infrastructure", 3)], pre=["presidential_system|kurdish_peace|eu_negotiations"], avail=AFTER("2023-02-06"), ai=4)
T.f("health_transformation", "Health transformation", "Universal health insurance and new hospitals. Unlocks city hospitals.", x2 + 1, 3, [T.SPIRIT("universal_healthcare"), IG("rural", 4)], pre=["eu_negotiations|kurdish_peace"])
T.f("education_push", "Schools and universities", "A university in every province.", x2 + 1, 4, [MOD("education_quality", 0.04, 3650), IG("youth_students", 4)], pre=["health_transformation"])
x3 = x2 + 6
T.f("defence_review", "Defence review", "Strategy and forces for the new century.", x3 + 2, 0, [IG("military", 3)], ai=4)
T.f("defence_industry", "A national defence industry", "Make warships, armoured vehicles and missiles at home.", x3 + 1, 1, [T.SPIRIT("defence_industry"), T.BUILD("military_factory", 2)], pre=["defence_review"])
T.f("drones", "Armed drones", "Develop armed drones such as the Bayraktar TB2. Unlocks drone orders.", x3 + 3, 1, [RB("air_drones", 0.3, 2), T.BUILD("military_factory", 1)], pre=["defence_review"], avail=AFTER("2012-01-01"))
T.f("navy", "A blue-homeland navy", "Frigates, submarines and a light aircraft carrier.", x3 + 1, 2, [T.BUILD("port", 1), RB("naval", 0.25, 2)], pre=["defence_industry"])
T.f("tanks", "A national tank", "Develop a national main battle tank.", x3 + 2, 2, [RB("armour", 0.2, 2), DIVS("mechanised_division", 1)], pre=["defence_industry|drones"])
T.f("air_defence", "Air defence", "Long-range air defence.", x3 + 3, 2, [MOD("army_defence", 0.03, 2920), RB("artillery_missiles", 0.2, 1)], pre=["drones"])
T.f("commandos", "Commando brigades", "Commandos for the south-east and cross-border operations.", x3 + 2, 3, [DIVS("motorised_division", 2), MOD("army_attack", 0.02, 2920)], pre=["tanks|air_defence"])
T.f("fighter_jet", "A national fighter", "Develop a fifth-generation fighter.", x3 + 3, 3, [RB("air_drones", 0.25, 2), T.BUILD("air_base", 1)], pre=["air_defence"], avail=AFTER("2016-01-01"))
T.f("cross_border", "Cross-border operations", "Operations against PKK bases in northern Iraq and Syria.", x3 + 1, 3, [WS(0.03), MOD("army_attack", 0.02, 1460)], pre=["navy|tanks"], avail=AFTER("2015-01-01"))
x4 = x3 + 5
T.f("foreign_policy", "Foreign policy", "Turkey between Europe, Russia and the Middle East.", x4 + 2, 0, [PP(20)], ai=4)
T.f("nato_ally", "A NATO ally", "Keep Turkey's role in NATO.", x4 + 1, 1, [OPN("USA", 10), OPN("GBR", 5)], pre=["foreign_policy"])
T.f("zero_problems", "Zero problems with neighbours", "Better relations and trade with every neighbour.", x4 + 3, 1, [OPN("SYR", 10), OPN("IRN", 10), OPN("GRC", 10), MOD("trade_efficiency", 0.02, 2920)], pre=["foreign_policy"])
T.f("turkic_states", "The Turkic states", "Closer ties with Azerbaijan and Central Asia.", x4 + 1, 2, [OPN("AZE", 15), OPN("KAZ", 10), OPN("UZB", 10)], pre=["nato_ally|zero_problems"])
T.f("africa_opening", "Opening to Africa", "Embassies, flights and trade across Africa.", x4 + 3, 2, [MOD("foreign_influence_power", 0.05, 2920)], pre=["zero_problems"])
T.f("mediation", "A mediator", "Mediate between Russia and Ukraine and in other conflicts.", x4 + 2, 3, [MOD("diplomatic_reputation", 0.05, 2920), OPN("UKR", 5), OPN("RUS", 5)], pre=["turkic_states|africa_opening"], avail=AFTER("2022-02-24"))
society_branch(T, max(f["x"] for f in T.F) + 2)
T.write("Turkey", "Turkey in the style of the Russian model tree: democratic government as the historical path and alternatives led by real parties of the data (left, conservative, nationalist, religious) plus a junta; economy (the programme after the 2001 crisis, the new lira, Marmaray, TurkStream), state and constitution (EU reforms, the 2010 and 2017 referendums, the 2016 coup attempt, the 2023 earthquakes), defence industry and drones, foreign policy. Sourced starting spirits in data/spirits/tur.json. Alternatives are a counterfactual.",
        ["2001 Turkish economic crisis", "Kemal Derviş", "Accession of Turkey to the European Union", "Kurdistan Workers' Party", "Conscription in Turkey", "Turkish lira", "2010 Turkish constitutional referendum",
         "2017 Turkish constitutional referendum", "Marmaray", "2016 Turkish coup attempt", "Bayraktar TB2", "TurkStream", "2023 Turkey–Syria earthquakes"])

# ============================================================ GERMANY
write_spirits("deu", "Germany's national spirits. The ones with `start` describe the situation on 1 January 2000 and cite sources. Values are gameplay estimates.", [
    start_spirit("deu_conscription", "Conscription", "Military service has been compulsory since 1956.", "policy", {"manpower_factor": 0.03, "welfare_cost": 0.001}, "DEU", "Conscription in Germany"),
    start_spirit("deu_nuclear_power", "Nuclear power", "Nuclear power plants provide a large share of the electricity.", "strength", {"energy_cost": -0.03, "nuclear_output": 0.1}, "DEU", "Nuclear power in Germany"),
    spirit("deu_labour_market_reform", "Labour market reform", "Welfare and unemployment benefits tied to work, from the Agenda 2010.", "policy", {"private_sector_output": 0.04, "welfare_cost": -0.005}),
    spirit("deu_debt_brake", "Debt brake", "The constitution limits the federal structural deficit to 0.35 percent of GDP.", "policy", {"interest_rate": -0.005, "construction_speed": -0.03}),
    spirit("deu_energiewende", "Energy transition", "Renewables replace nuclear power and coal.", "policy", {"renewable_output": 0.15, "energy_cost": 0.03}),
    spirit("deu_bundeswehr_fund", "Special fund for the armed forces", "A €100 billion fund for the Bundeswehr outside the normal budget.", "policy", {"production_efficiency": 0.03, "army_org": 0.03}),
])
write_decisions("deu", "DEU", "German federal projects", [
    ("deu_wind_farm", "Offshore wind farm", "Fund an offshore wind farm in the North Sea.", "deu_energiewende", 30, [TREAS(-1), {"add_buildings": {"building": "renewable_plant", "count": 1}}], CASH(1), 365),
    ("deu_procurement", "Bundeswehr procurement", "A large order from the special fund.", "deu_zeitenwende", 30, [TREAS(-2), {"add_equipment": {"family": "infantry_equipment", "amount": 1000}}], CASH(2), 365),
])
G = Tree("deu", "DEU")
x = democracy_paths(G, 0, {"social_democratic": "the SPD, the Greens and later Die Linke", "conservative": "the CDU and the CSU", "liberal_democratic": "the FDP",
                            "nationalist_populist": "the Republicans, the NPD and later the AfD", "socialist_communist": "later the BSW"}, junta=False)
G.f("economic_reform", "Economic reform", "Make the economy and the welfare state fit for the new century.", x + 2, 0, [PP(20)], ai=5)
G.f("agenda_2010", "Agenda 2010", "Reform the welfare state and the labour market, as Chancellor Schröder announced on 14 March 2003.", x + 1, 1, [G.SPIRIT("labour_market_reform"), IG("labour_unions", -6), IG("business", 5)], pre=["economic_reform"], avail=ALL(HIST, AFTER("2003-03-14")), ai=5)
G.f("hartz_reforms", "The Hartz reforms", "Reform the job centres and unemployment benefits; the first laws took force on 1 January 2003.", x + 1, 2, [MOD("private_sector_output", 0.03, 2920), POP(-0.02)], pre=["agenda_2010"], avail=AFTER("2003-01-01"))
G.f("mittelstand", "The Mittelstand", "Support the family firms that make machines for export.", x + 3, 1, [G.BUILD("civilian_factory", 3), MOD("trade_efficiency", 0.03, 2920)], pre=["economic_reform"])
G.f("debt_brake", "The debt brake", "Limit the federal structural deficit, as the constitution has done since 2009.", x + 2, 2, [G.SPIRIT("debt_brake"), STAB(0.01)], pre=["agenda_2010|mittelstand"], avail=AFTER("2009-01-01"), ai=4)
G.f("export_champions", "Export champions", "Cars, chemicals and machines for world markets.", x + 3, 2, [G.SPIRIT("export_led_growth"), G.BUILD("civilian_factory", 2), G.BUILD("port", 1)], pre=["mittelstand"])
G.f("industry_40", "Industry 4.0", "Digital factories and robots.", x + 3, 3, [RB("economy_digital", 0.25, 2), G.BUILD("data_centre", 2)], pre=["export_champions"], avail=AFTER("2011-01-01"))
G.f("short_time_work", "Short-time work", "Pay firms to keep workers in a recession.", x + 1, 3, [STAB(0.02), IG("labour_unions", 4), TREAS(-2)], pre=["hartz_reforms"], avail=AFTER("2008-10-01"))
G.f("minimum_wage", "A minimum wage", "A national minimum wage.", x + 1, 4, [IG("labour_unions", 6), IG("business", -3)], pre=["short_time_work"], avail=AFTER("2014-01-01"))
G.f("infrastructure_fund", "Rebuild infrastructure", "Bridges, railways and broadband.", x + 2, 4, [G.BUILD("infrastructure", 4), TREAS(-3)], pre=["debt_brake|industry_40"], avail=CASH(3))
G.f("electric_cars", "Electric cars", "Turn the car industry to electric cars.", x + 3, 4, [G.BUILD("civilian_factory", 2), RB("industry_energy", 0.2, 1)], pre=["industry_40"], avail=AFTER("2015-01-01"))
G.f("chip_fabs", "Chip factories", "Subsidise new chip factories.", x + 3, 5, [G.BUILD("civilian_factory", 2), RB("electronics_cyber", 0.25, 2)], pre=["electric_cars"], avail=AFTER("2021-01-01"))
G.f("skilled_immigration", "Skilled immigration", "Bring in skilled workers from abroad.", x + 1, 5, [LAW("immigration", "managed_immigration"), MOD("population_growth", 0.001, 3650)], pre=["minimum_wage|infrastructure_fund"])
x2 = x + 5
G.f("energy_policy", "Energy policy", "The energy mix for the coming decades.", x2 + 2, 0, [PP(10)], ai=4)
G.f("nuclear_phase_out", "Nuclear phase-out", "Close the nuclear plants: the government decided after Fukushima in 2011, and the last plants closed in April 2023.", x2 + 1, 1, [G.REMOVE("nuclear_power"), IG("youth_students", 4)], pre=["energy_policy"], avail=ALL(HIST, AFTER("2011-03-15")), ai=4)
G.f("energiewende", "The energy transition", "Wind and solar replace nuclear and coal. Unlocks offshore wind farms.", x2 + 2, 1, [G.SPIRIT("energiewende"), G.BUILD("renewable_plant", 3)], pre=["energy_policy"], avail=AFTER("2010-09-01"), ai=4)
G.f("nord_stream", "Nord Stream", "A gas pipeline from Russia under the Baltic, in service from 2011.", x2 + 3, 1, [MOD("energy_cost", -0.03, 3650), OPN("RUS", 10)], pre=["energy_policy"], avail=ALL(HIST, AFTER("2011-11-01")), ai=3)
G.f("coal_exit", "Exit from coal", "End coal power by 2038 at the latest.", x2 + 2, 2, [MOD("energy_cost", 0.02, 3650), IG("labour_unions", -3), G.BUILD("renewable_plant", 2)], pre=["energiewende"], avail=AFTER("2019-01-01"))
G.f("lng_terminals", "LNG terminals", "Terminals for liquefied gas after Russian gas stopped in 2022.", x2 + 3, 2, [G.BUILD("port", 1), MOD("energy_cost", -0.02, 2920), OPN("RUS", -10)], pre=["nord_stream"], avail=AFTER("2022-08-31"))
G.f("hydrogen", "Hydrogen", "A national hydrogen strategy.", x2 + 2, 3, [RB("industry_energy", 0.25, 2)], pre=["coal_exit|lng_terminals"], avail=AFTER("2020-01-01"))
x3 = x2 + 5
G.f("bundeswehr", "The Bundeswehr", "Reform the armed forces.", x3 + 2, 0, [IG("military", 2)], ai=4)
G.f("end_conscription", "Suspend conscription", "Suspend conscription, as Germany did on 1 July 2011.", x3 + 1, 1, [G.REMOVE("conscription"), MOD("army_org", 0.03, 3650), IG("youth_students", 5)], pre=["bundeswehr"], avail=ALL(HIST, AFTER("2011-07-01")), ai=4)
G.f("missions_abroad", "Missions abroad", "Deploy to Kosovo, Afghanistan and Mali.", x3 + 3, 1, [MOD("army_org", 0.02, 2920), MOD("diplomatic_reputation", 0.02, 2920)], pre=["bundeswehr"])
G.f("zeitenwende", "Zeitenwende", "Announce a €100 billion fund for the armed forces, as Chancellor Scholz did on 27 February 2022. Unlocks procurement.", x3 + 2, 2, [G.SPIRIT("bundeswehr_fund"), G.BUILD("military_factory", 3), TREAS(-5)], pre=["end_conscription|missions_abroad"], avail=AFTER("2022-02-27"), ai=5)
G.f("air_defence", "Air defence for Europe", "A European air-defence shield.", x3 + 1, 3, [MOD("army_defence", 0.03, 3650), RB("artillery_missiles", 0.2, 1)], pre=["zeitenwende"])
G.f("brigade_lithuania", "A brigade in Lithuania", "Station a brigade permanently in Lithuania.", x3 + 3, 3, [DIVS("mechanised_division", 1), OPN("LTU", 15)], pre=["zeitenwende"], avail=AFTER("2023-06-01"))
G.f("defence_industry", "Ammunition and tanks", "Expand ammunition and tank production.", x3 + 2, 4, [G.BUILD("military_factory", 2), RB("armour", 0.2, 2), EQUIP(1500)], pre=["air_defence|brigade_lithuania"])
x4 = x3 + 5
G.f("foreign_policy", "Foreign policy", "Germany in Europe and the world.", x4 + 2, 0, [PP(20)], ai=4)
G.f("eu_enlargement", "EU enlargement", "Support the entry of Central and Eastern Europe into the EU.", x4 + 1, 1, [OPN("POL", 10), OPN("CZE", 10), MOD("trade_efficiency", 0.03, 2920)], pre=["foreign_policy"])
G.f("franco_german", "The Franco-German engine", "Lead the EU together with France.", x4 + 3, 1, [OPN("FRA", 15), MOD("diplomatic_reputation", 0.03, 2920)], pre=["foreign_policy"])
G.f("eurozone_rescue", "Rescue the eurozone", "Rescue funds for Greece and others in the debt crisis.", x4 + 2, 2, [TREAS(-3), OPN("GRC", -5), MOD("diplomatic_reputation", 0.03, 2920)], pre=["eu_enlargement|franco_german"], avail=AFTER("2010-05-01"))
G.f("refugees", "Take in refugees", "Take in refugees in the crisis of 2015, when about 1.3 million people applied for asylum in Europe.", x4 + 1, 2, [MOD("population_growth", 0.002, 2920), IG("minorities", 5), GROUP("nationalist_populist", 0.02)], pre=["eu_enlargement"], avail=AFTER("2015-08-01"))
G.f("support_ukraine", "Support for Ukraine", "Weapons and money for Ukraine.", x4 + 3, 2, [OPN("UKR", 20), OPN("RUS", -20), TREAS(-1)], pre=["franco_german"], avail=AFTER("2022-02-24"))
G.f("china_trade", "Trade with China", "Cars and machines for China.", x4 + 2, 3, [OPN("CHN", 10), MOD("trade_efficiency", 0.02, 2920)], pre=["eurozone_rescue|support_ukraine"])
society_branch(G, max(f["x"] for f in G.F) + 2)
G.write("Germany", "Germany in the style of the Russian model tree: democratic government as the historical path and alternatives led by real parties of the data (left, conservative, liberal, national-populist, left-populist); economy (Agenda 2010, the Hartz reforms, the debt brake), energy (nuclear phase-out, the energy transition, Nord Stream, LNG), the Bundeswehr (end of conscription, the Zeitenwende) and foreign policy. Sourced starting spirits in data/spirits/deu.json. Alternatives are a counterfactual.",
        ["Agenda 2010", "Hartz concept", "Nuclear power in Germany", "Conscription in Germany", "Energiewende", "Debt brake (Germany)", "Nord Stream", "European migrant crisis", "Zeitenwende speech"])
