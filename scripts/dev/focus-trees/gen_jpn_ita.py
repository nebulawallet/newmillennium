"""Japan and Italy trees in the Russia model style. Run from the repo root."""
import sys; sys.path.insert(0, __file__.replace("\\", "/").rsplit("/", 1)[0])
from treelib import *

# ============================================================ JAPAN
write_spirits("jpn", "Japan's national spirits. The ones with `start` describe the situation on 1 January 2000 and cite sources. Values are gameplay estimates.", [
    start_spirit("jpn_lost_decade", "The Lost Decade", "The economy has stagnated since the asset price bubble collapsed in 1990, and public debt keeps rising.", "problem", {"gdp_growth": -0.005, "interest_rate": -0.005, "inflation": -0.01}, "JPN", "Lost Decade (Japan)"),
    start_spirit("jpn_ageing_society", "An ageing society", "The population is ageing faster than in any other nation.", "problem", {"population_growth": -0.003, "welfare_cost": 0.005, "manpower_factor": -0.03}, "JPN", "Demographics of Japan"),
    start_spirit("jpn_article_9", "Article 9", "The constitution renounces war as a means of settling international disputes.", "policy", {"war_support_factor": -0.05, "army_attack": -0.05, "diplomatic_reputation": 0.03}, "JPN", "Article 9 of the Japanese Constitution"),
    start_spirit("jpn_us_alliance", "The US alliance", "The security treaty with the United States has been in effect since 23 June 1960.", "strength", {"army_defence": 0.03, "foreign_influence_resistance": -0.03}, "JPN", "Treaty of Mutual Cooperation and Security between the United States and Japan"),
    spirit("jpn_abenomics", "Abenomics", "Monetary easing, fiscal stimulus and structural reform.", "policy", {"gdp_growth": 0.003, "inflation": 0.005, "interest_rate": -0.003}),
    spirit("jpn_collective_self_defence", "Collective self-defence", "The forces may defend allies in certain situations.", "policy", {"army_attack": 0.03, "war_support_factor": 0.02}),
    spirit("jpn_fukushima_recovery", "After Fukushima", "Most reactors are shut and the disaster zone is being rebuilt.", "problem", {"energy_cost": 0.05, "nuclear_output": -0.2}),
])
write_decisions("jpn", "JPN", "Japanese state projects", [
    ("jpn_restart_reactor", "Restart a reactor", "Restart a reactor that passed the new safety checks.", "jpn_reactor_restarts", 30, [MOD("energy_cost", -0.01, 3650), UNREST(0.01)], None, 365),
    ("jpn_regional_revitalisation", "Revitalise a region", "Funds for a rural prefecture.", "jpn_regional_revitalisation", 25, [TREAS(-0.5), IG("rural", 3), {"add_buildings": {"building": "infrastructure", "count": 1}}], CASH(0.5), 365),
])
J = Tree("jpn", "JPN")
x = democracy_paths(J, 0, {"conservative": "the Liberal Democratic Party", "liberal_democratic": "the Democratic Party of Japan and later the CDP and the DPFP", "social_democratic": "the Social Democratic Party",
                            "nationalist_populist": "Nippon Ishin and Sanseito", "socialist_communist": "the Communist Party and Reiwa Shinsengumi"}, junta=False)
J.f("economy", "Economic agenda", "Priorities for the Japanese economy.", x + 2, 0, [PP(20)], ai=5)
J.f("bank_cleanup", "Clean up the banks", "Write off bad loans left by the bubble.", x + 1, 1, [J.SWAP("lost_decade", "balanced_budget"), IG("business", 3), TREAS(-3)], pre=["economy"], avail=CASH(3), days=140, ai=4)
J.f("postal_privatisation", "Postal privatisation", "Privatise the postal savings system; Japan Post Holdings was founded on 23 January 2006 and took over in October 2007.", x + 3, 1, [MOD("private_sector_output", 0.03, 2920), TREAS(5), IG("rural", -4)], pre=["economy"], avail=ALL(HIST, AFTER("2006-01-23")), ai=4)
J.f("abenomics", "Abenomics", "Monetary easing, fiscal stimulus and structural reform from 2012.", x + 2, 2, [J.SPIRIT("abenomics"), J.REMOVE("lost_decade")], pre=["bank_cleanup|postal_privatisation"], avail=ALL(HIST, AFTER("2012-12-26")), ai=4)
J.f("womenomics", "Women at work", "Childcare places and support for working mothers.", x + 1, 3, [MOD("population_growth", 0.001, 3650), MOD("manpower_factor", 0.01, 3650)], pre=["abenomics"])
J.f("robotics", "Robots", "Robots for factories and care homes.", x + 3, 3, [RB("electronics_cyber", 0.2, 2), J.BUILD("civilian_factory", 2)], pre=["abenomics"])
J.f("tpp", "The Pacific trade agreement", "Join the trans-Pacific trade agreement signed on 4 February 2016.", x + 2, 3, [MOD("trade_efficiency", 0.04, 3650), OPN("AUS", 5), OPN("VNM", 5)], pre=["abenomics"], avail=AFTER("2016-02-04"))
J.f("regional_revitalisation", "Revive the regions", "Money and jobs for the shrinking countryside. Unlocks regional projects.", x + 1, 4, [IG("rural", 4), J.BUILD("infrastructure", 2)], pre=["womenomics"])
J.f("chips", "Chip plants", "New semiconductor plants with foreign partners.", x + 3, 4, [J.BUILD("civilian_factory", 2), RB("electronics_cyber", 0.25, 1)], pre=["robotics"], avail=AFTER("2021-01-01"))
J.f("immigration_workers", "Foreign workers", "A visa programme for foreign workers.", x + 2, 4, [LAW("immigration", "managed_immigration"), MOD("manpower_factor", 0.02, 3650)], pre=["tpp|womenomics"], avail=AFTER("2019-04-01"))
x2 = x + 5
J.f("energy", "Energy policy", "Japan's energy after the oil shocks and Fukushima.", x2 + 2, 0, [PP(10)], ai=4)
J.f("fukushima", "After Fukushima", "Respond to the earthquake and tsunami of 11 March 2011 and the Fukushima Daiichi accident.", x2 + 1, 1, [J.SPIRIT("fukushima_recovery"), J.SPIRIT("reconstruction_effort"), J.BUILD("infrastructure", 3), TREAS(-5)], pre=["energy"], avail=AFTER("2011-03-11"), ai=6)
J.f("reactor_restarts", "Restart the reactors", "Restart reactors that pass new safety checks. Unlocks restarts.", x2 + 1, 2, [J.REMOVE("fukushima_recovery"), UNREST(0.01)], pre=["fukushima"], avail=AFTER("2015-01-01"), days=140)
J.f("lng_imports", "LNG imports", "Liquefied gas from Australia, Qatar and the United States.", x2 + 3, 1, [J.BUILD("port", 1), MOD("energy_cost", -0.02, 2920)], pre=["energy"])
J.f("solar_power", "Solar power", "Feed-in tariffs for solar power.", x2 + 2, 2, [J.BUILD("renewable_plant", 2), MOD("renewable_output", 0.1, 3650)], pre=["fukushima|lng_imports"])
J.f("hydrogen", "Hydrogen society", "Hydrogen for cars and power.", x2 + 2, 3, [RB("industry_energy", 0.25, 2)], pre=["solar_power|reactor_restarts"])
x3 = x2 + 5
J.f("defence", "Defence policy", "The Self-Defense Forces and the alliance.", x3 + 2, 0, [IG("military", 2)], ai=4)
J.f("security_council", "A National Security Council", "Set up a National Security Council, as Japan did on 4 December 2013.", x3 + 1, 1, [MOD("intelligence_power", 0.05, 3650), PP(20)], pre=["defence"], avail=AFTER("2013-12-04"))
J.f("missile_defence", "Missile defence", "Missile defence against ballistic missiles.", x3 + 3, 1, [MOD("army_defence", 0.03, 3650), RB("artillery_missiles", 0.2, 1)], pre=["defence"])
J.f("security_legislation", "Collective self-defence", "Laws that allow collective self-defence in certain situations, in effect from March 2016.", x3 + 1, 2, [J.SWAP("article_9", "collective_self_defence"), IG("youth_students", -4)], pre=["security_council"], avail=ALL(HIST, AFTER("2015-09-19")), ai=4)
J.f("southwest_islands", "Defend the south-west islands", "Bases and missiles on the islands near Taiwan.", x3 + 2, 2, [J.BUILD("air_base", 1), J.BUILD("port", 1), MOD("army_defence", 0.02, 3650)], pre=["missile_defence|security_council"], avail=AFTER("2016-01-01"))
J.f("cyber_defence", "Cyber defence", "A cyber defence command.", x3 + 3, 2, [RB("electronics_cyber", 0.2, 2)], pre=["missile_defence"], avail=AFTER("2019-01-01"))
J.f("counterstrike", "Counterstrike capability", "Long-range missiles and a larger defence budget.", x3 + 2, 3, [RB("artillery_missiles", 0.25, 2), J.BUILD("military_factory", 2)], pre=["security_legislation|southwest_islands"], avail=AFTER("2022-12-01"))
J.f("defence_exports", "Defence exports", "Allow arms exports to partners.", x3 + 1, 3, [TREAS(1), MOD("foreign_influence_power", 0.03, 2920)], pre=["security_legislation"])
x4 = x3 + 5
J.f("foreign_policy", "Foreign policy", "Japan in Asia and the world.", x4 + 2, 0, [PP(20)], ai=4)
J.f("us_alliance", "Strengthen the alliance", "Closer cooperation with the United States.", x4 + 1, 1, [OPN("USA", 15)], pre=["foreign_policy"])
J.f("china_trade", "Trade with China", "Trade and investment with China.", x4 + 3, 1, [OPN("CHN", 10), MOD("trade_efficiency", 0.02, 2920)], pre=["foreign_policy"])
J.f("quad", "The Quad", "A security dialogue with the United States, India and Australia.", x4 + 1, 2, [OPN("IND", 10), OPN("AUS", 10)], pre=["us_alliance"])
J.f("korea_relations", "Relations with South Korea", "Mend relations with South Korea.", x4 + 3, 2, [OPN("KOR", 15)], pre=["china_trade"])
J.f("asean_aid", "Aid to South-East Asia", "Development aid and infrastructure in South-East Asia.", x4 + 2, 3, [MOD("foreign_influence_power", 0.05, 2920), TREAS(-1)], pre=["quad|korea_relations"])
society_branch(J, max(f["x"] for f in J.F) + 2)
J.write("Japan", "Japan in the style of the Russian model tree: democratic government as the historical path and alternatives led by real parties of the data; economy (cleaning up the banks, postal privatisation, Abenomics), energy (Fukushima, restarts, LNG, solar), defence (the National Security Council, collective self-defence, missile defence) and foreign policy. Sourced starting spirits in data/spirits/jpn.json. Alternatives are a counterfactual.",
        ["Junichiro Koizumi", "Japan Post Holdings", "Lost Decade (Japan)", "Demographics of Japan", "Article 9 of the Japanese Constitution", "Treaty of Mutual Cooperation and Security between the United States and Japan",
         "Abenomics", "2011 Tōhoku earthquake and tsunami", "Fukushima nuclear accident", "2015 Japanese military legislation", "Comprehensive and Progressive Agreement for Trans-Pacific Partnership", "Defense policy of Japan"])

# ============================================================ ITALY
write_spirits("ita", "Italy's national spirits. The ones with `start` describe the situation on 1 January 2000 and cite sources. Values are gameplay estimates.", [
    start_spirit("ita_public_debt", "High public debt", "Heavy spending from the 1980s produced a severe rise in public debt.", "problem", {"interest_rate": 0.01, "welfare_cost": 0.003}, "ITA", "Economy of Italy"),
    start_spirit("ita_north_south_divide", "North-south divide", "Income per person in the south is far below the north.", "problem", {"production_efficiency": -0.02, "unrest": 0.01}, "ITA", "Economy of Italy"),
    spirit("ita_technocratic_austerity", "Technocratic austerity", "A technocratic government cuts spending and raises taxes in the debt crisis.", "policy", {"interest_rate": -0.005, "stability_factor": -0.03}),
    spirit("ita_citizens_income", "Citizens' income", "A conditional minimum income.", "policy", {"welfare_cost": 0.003, "stability_factor": 0.01}),
    spirit("ita_recovery_plan", "Recovery plan", "EU recovery funds for green and digital investment.", "policy", {"construction_speed": 0.05, "research_speed": 0.03}),
])
write_decisions("ita", "ITA", "Italian state projects", [
    ("ita_southern_investment", "Investment in the south", "Funds for a southern region.", "ita_southern_development", 30, [TREAS(-1), {"add_buildings": {"building": "civilian_factory", "count": 1}}], CASH(1), 365),
])
I = Tree("ita", "ITA")
x = democracy_paths(I, 0, {"social_democratic": "the Democrats of the Left, later the Democratic Party", "conservative": "Forza Italia, later the People of Freedom, and the UDC", "liberal_democratic": "Italy of Values and later Azione",
                            "nationalist_populist": "the National Alliance and later Brothers of Italy", "socialist_communist": "Communist Refoundation"}, junta=False)
I.f("economy", "Economic agenda", "Priorities for the Italian economy.", x + 2, 0, [PP(20)], ai=5)
I.f("monti_government", "A technocratic government", "A technocratic government under Mario Monti, sworn in on 16 November 2011, in the debt crisis.", x + 1, 1, [I.SPIRIT("technocratic_austerity"), TREAS(5), IG("labour_unions", -5)], pre=["economy"], avail=ALL(HIST, AFTER("2011-11-16")), ai=4)
I.f("jobs_act", "The Jobs Act", "A labour reform presented on 12 March 2014.", x + 3, 1, [MOD("private_sector_output", 0.03, 2920), IG("labour_unions", -4)], pre=["economy"], avail=ALL(HIST, AFTER("2014-03-12")), ai=3)
I.f("debt_reduction", "Cut the debt", "A primary surplus to bring the debt down.", x + 1, 2, [I.SWAP("public_debt", "balanced_budget"), I.REMOVE("technocratic_austerity")], pre=["monti_government"], days=140, ai=3)
I.f("citizens_income", "Citizens' income", "A conditional minimum income, in effect from April 2019 to January 2024.", x + 3, 2, [I.SPIRIT("citizens_income"), IG("rural", 3)], pre=["jobs_act"], avail=ALL(HIST, AFTER("2019-04-01"), BEFORE("2024-01-01")), ai=3)
I.f("made_in_italy", "Made in Italy", "Support fashion, machinery and food exports.", x + 2, 2, [I.BUILD("civilian_factory", 3), MOD("trade_efficiency", 0.03, 2920)], pre=["monti_government|jobs_act"])
I.f("recovery_plan", "The recovery plan", "Spend Italy's large share of the EU recovery funds.", x + 2, 3, [I.SPIRIT("recovery_plan"), I.BUILD("infrastructure", 4), I.BUILD("data_centre", 1)], pre=["made_in_italy|debt_reduction"], avail=AFTER("2021-01-01"))
I.f("southern_development", "Develop the south", "Roads, ports and factories in the south. Unlocks southern investment.", x + 1, 3, [I.REMOVE("north_south_divide"), I.BUILD("infrastructure", 2), I.BUILD("port", 1)], pre=["debt_reduction|made_in_italy"], days=140, ai=3)
I.f("messina_bridge", "The Strait of Messina Bridge", "A 3.6 km suspension bridge to Sicily, approved by the government in August 2025.", x + 1, 4, [I.BUILD("infrastructure", 3), TREAS(-3)], pre=["southern_development"], avail=ALL(AFTER("2025-08-01"), CASH(3)))
I.f("renewables", "Solar and wind", "Solar and wind in the south.", x + 3, 3, [I.BUILD("renewable_plant", 2), MOD("energy_cost", -0.02, 3650)], pre=["citizens_income|made_in_italy"])
x2 = x + 5
I.f("defence", "Defence policy", "Italy's forces in NATO and the Mediterranean.", x2 + 2, 0, [IG("military", 2)], ai=4)
I.f("professional_forces", "Professional forces", "Professional forces in place of conscripts.", x2 + 1, 1, [MOD("army_org", 0.03, 3650)], pre=["defence"])
I.f("navy", "The Mediterranean navy", "Carriers and frigates for the Mediterranean.", x2 + 3, 1, [I.BUILD("port", 1), RB("naval", 0.2, 2)], pre=["defence"])
I.f("mare_nostrum", "Mare Nostrum", "A naval and air operation, from 18 October 2013 to 31 October 2014, that rescued at least 150,000 migrants.", x2 + 3, 2, [MOD("diplomatic_reputation", 0.03, 1460), TREAS(-0.5)], pre=["navy"], avail=ALL(AFTER("2013-10-18"), BEFORE("2014-11-01")), ai=3)
I.f("aerospace", "Aerospace and defence industry", "Helicopters, frigates and aircraft parts.", x2 + 1, 2, [I.BUILD("military_factory", 2), RB("air_drones", 0.15, 1)], pre=["professional_forces"])
I.f("missions", "Missions abroad", "Peacekeeping in Lebanon and the Balkans.", x2 + 2, 3, [MOD("army_org", 0.02, 2920), OPN("LBN", 5)], pre=["aerospace|mare_nostrum"])
x3 = x2 + 5
I.f("foreign_policy", "Foreign policy", "Italy in Europe and the Mediterranean.", x3 + 2, 0, [PP(20)], ai=4)
I.f("eu_core", "At the core of Europe", "Keep Italy at the core of the EU and the euro.", x3 + 1, 1, [OPN("FRA", 10), OPN("DEU", 10)], pre=["foreign_policy"])
I.f("libya_energy", "Energy from North Africa", "Gas pipelines from Libya and Algeria.", x3 + 3, 1, [MOD("energy_cost", -0.02, 2920), OPN("LBY", 5), OPN("DZA", 10)], pre=["foreign_policy"])
I.f("mediterranean_plan", "A Mediterranean plan", "Investment in North Africa to slow migration.", x3 + 2, 2, [MOD("foreign_influence_power", 0.05, 2920), TREAS(-0.5)], pre=["eu_core|libya_energy"], avail=AFTER("2023-01-01"))
society_branch(I, max(f["x"] for f in I.F) + 2)
I.write("Italy", "Italy in the style of the Russian model tree: democratic government as the historical path and alternatives led by real parties of the data; economy (the Monti government, the Jobs Act, the citizens' income, the recovery plan, the south, the Messina Bridge), defence (Mare Nostrum) and foreign policy. Sourced starting spirits in data/spirits/ita.json. Alternatives are a counterfactual.",
        ["Contract with the Italians", "Military service", "Economy of Italy", "Mario Monti", "Jobs Act (Italy)", "Reddito di cittadinanza", "Next Generation EU", "Operation Mare Nostrum", "Strait of Messina Bridge"])
