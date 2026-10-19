"""Generates data/focus_trees/usa.json and data/decisions/usa.json: the United States in the style of the Russian
model tree. Keeps the ids of the earlier tree (the Bush and Gore branches are tested). Run from the repo root."""
import json

F = []
def f(id, name, desc, x, y, effects, pre=None, excl=None, avail=None, days=70, ai=1):
    d = {"id": "usa_" + id, "name": name, "description": desc, "x": x, "y": y, "days": days}
    if pre: d["prerequisites"] = [["usa_" + p for p in g.split("|")] for g in pre]
    if excl: d["mutually_exclusive"] = ["usa_" + e for e in excl]
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
SPIRIT = lambda s: {"add_spirit": "usa_" + s}
REMOVE = lambda s: {"remove_spirit": "usa_" + s}
SWAP = lambda a, b: {"swap_spirit": {"from": "usa_" + a, "to": "usa_" + b}}
TREAS = lambda v: {"add_treasury": v}
RB = lambda cat, v=0.2, uses=2: {"add_research_bonus": {"category": cat, "value": v, "uses": uses}}
EQUIP = lambda n: {"add_equipment": {"family": "infantry_equipment", "amount": n}}
DIVS = lambda t, n: {"add_divisions": {"template": t, "count": n}}
CASH = lambda v: {"treasury_above": v}
HAS = lambda s: {"has_spirit": "usa_" + s}
def BUILD(b, n, *adm1):
    d = {"building": b, "count": n}
    if adm1: d["regions"] = [{"from": "USA", "adm1": list(adm1)}]
    return {"add_buildings": d}
AFTER = lambda d: {"date_after": d}
BEFORE = lambda d: {"date_before": d}
ALL = lambda *a: {"all": list(a)}
ANY = lambda *a: {"any": list(a)}
NOT = lambda a: {"not": a}
PRES = lambda p: {"holds_office": {"person": "usa." + p, "office": "usa.president"}}
ALT = ANY({"follows_history": False}, {"is_player": True})
HIST = {"follows_history": True}
LEAVE = {"leave_history": True}
CA, TX, FL, NY, IL, PA, OH, MI, AZ, MD = "USA-3521", "USA-3536", "USA-3542", "USA-3559", "USA-3546", "USA-3560", "USA-3550", "USA-3562", "USA-3520", "USA-3555"
WA, GA, VA, LA, OK, AL, HI, MA = "USA-3519", "USA-3543", "USA-3552", "USA-3535", "USA-3533", "USA-3541", "USA-3517", "USA-3513"

# ============================================================ administrations (x 0-11)
f("new_administration", "A new administration", "Set the priorities of the administration for its first term.", 5, 0, [PP(50)], ai=5)
f("bush_tax_cuts", "Economic growth and tax relief", "Pass the tax cuts the President campaigned on. The Economic Growth and Tax Relief Reconciliation Act was signed on 7 June 2001.", 1, 1,
  [IG("business", 6), IG("labour_unions", -3), {"add_economic_mood": 0.05}, MOD("private_sector_output", 0.03, 3650), {"set_budget": {"revenue": -1}}], pre=["new_administration"], avail=PRES("george_w_bush"), ai=10)
f("bush_education", "No Child Left Behind", "Pass a national education bill that ties federal school funding to state standards and testing. The No Child Left Behind Act became law in 2002.", 0, 2,
  [MOD("education_quality", 0.03, 3650), IG("youth_students", 2)], pre=["bush_tax_cuts"], avail=PRES("george_w_bush"), ai=2)
f("bush_medicare", "Medicare prescription drug benefit", "Add prescription drug cover to Medicare. The Medicare Prescription Drug, Improvement, and Modernization Act was signed on 8 December 2003.", 2, 2,
  [MOD("health_outcomes", 0.03, 3650), MOD("welfare_cost", 0.004, 3650), {"add_ruling_party_popularity": 0.01}], pre=["bush_tax_cuts"], avail=PRES("george_w_bush"), ai=2)
f("patriot_act", "The PATRIOT Act", "Expand surveillance powers and information sharing between agencies after the September 11 attacks, as the USA PATRIOT Act did in 2001.", 0, 3,
  [MOD("intelligence_power", 0.1, 3650), IG("security_services", 5), IG("media", -3)], pre=["bush_education|bush_medicare"], avail={"has_global_flag": "september_11"}, ai=3)
f("homeland_security", "Department of Homeland Security", "Create a cabinet department for domestic security. The Homeland Security Act was enacted on 25 November 2002.", 1, 4,
  [SPIRIT("homeland_security_state"), IG("security_services", 6), IG("media", -2)], pre=["patriot_act|bush_education|bush_medicare"], avail={"has_global_flag": "september_11"}, ai=3)
f("bank_rescue", "Rescue the banks", "The Emergency Economic Stabilization Act of 3 October 2008 creates the $700 billion Troubled Asset Relief Program.", 2, 3,
  [REMOVE("financial_crisis"), SPIRIT("bank_rescue"), TREAS(-10), IG("business", 4), {"add_ruling_party_popularity": -0.02}], pre=["bush_medicare|bipartisan_compromise"], avail=ALL(HIST, AFTER("2008-10-03"), CASH(10)), ai=5)
f("gore_surplus", "Protect the Social Security surplus", "Dedicate the Social Security surplus to Social Security and paying down the national debt, as the 2000 Gore campaign proposed.", 9, 1,
  [{"add_economic_mood": 0.03}, MOD("interest_rate", -0.005, 3650), IG("labour_unions", 3)], pre=["new_administration"], avail=PRES("al_gore"), ai=10)
f("gore_targeted_tax_cuts", "Targeted tax cuts", "Pass targeted tax cuts for child care, higher education, health insurance and long-term care, as the 2000 Gore campaign proposed.", 8, 2,
  [IG("urban_middle_class", 5), {"add_ruling_party_popularity": 0.01}], pre=["gore_surplus"], avail=PRES("al_gore"), ai=2)
f("gore_trust_funds", "Health, education and environment trust funds", "Create the three trust funds for health care, education and the environment proposed by the 2000 Gore campaign.", 10, 2,
  [MOD("health_outcomes", 0.02, 3650), MOD("education_quality", 0.02, 3650), BUILD("renewable_plant", 2), IG("business", -2)], pre=["gore_surplus"], avail=PRES("al_gore"), ai=2)
f("republican_agenda", "Republican legislative agenda", "Use the position of the party in government to pass its programme.", 4, 1,
  [PP(40), IG("business", 3)], pre=["new_administration"], avail={"ruling_party": "usa.republican"}, ai=2)
f("democratic_agenda", "Democratic legislative agenda", "Use the position of the party in government to pass its programme.", 6, 1,
  [PP(40), IG("labour_unions", 3)], pre=["new_administration"], avail={"ruling_party": "usa.democratic"}, ai=2)
f("bipartisan_compromise", "Bipartisan compromise", "Seek votes across the aisle for major bills.", 5, 2,
  [STAB(0.03), {"add_unrest": -0.03}], pre=["republican_agenda|democratic_agenda"])
f("recovery_act", "American Recovery and Reinvestment Act", "A stimulus of about $787 billion against the Great Recession, signed in February 2009.", 4, 3,
  [TREAS(-8), BUILD("infrastructure", 4), BUILD("renewable_plant", 1), MOD("gdp_growth", 0.004, 1460)], pre=["bipartisan_compromise|democratic_agenda"], avail=ALL(PRES("barack_obama"), AFTER("2009-03-01")), ai=4)
f("affordable_care_act", "Affordable Care Act", "Expand health coverage with subsidised insurance, signed on 23 March 2010; its major provisions took effect in 2014.", 6, 3,
  [SPIRIT("coverage_expansion"), LAW("healthcare", "private_insurance"), IG("labour_unions", 3), {"add_ruling_party_popularity": -0.02}], pre=["democratic_agenda|bipartisan_compromise"], avail=ALL(PRES("barack_obama"), AFTER("2010-03-23")), ai=4)
f("dodd_frank", "Dodd–Frank financial reform", "New rules for Wall Street and a Consumer Financial Protection Bureau, signed on 21 July 2010.", 5, 4,
  [SWAP("bank_rescue", "financial_regulation"), IG("business", -4), IG("urban_middle_class", 3)], pre=["recovery_act|affordable_care_act|bank_rescue"], avail=ALL(HIST, AFTER("2010-07-21")), ai=4)
f("tax_cuts_and_jobs_act", "Tax Cuts and Jobs Act", "Cut corporate and individual tax rates and raise the standard deduction, signed on 22 December 2017.", 3, 5,
  [MOD("private_sector_output", 0.04, 2920), MOD("foreign_investment", 0.05, 2920), {"set_budget": {"revenue": -1}}, IG("business", 6)], pre=["dodd_frank|bipartisan_compromise"], avail=ALL(PRES("donald_trump"), AFTER("2017-12-22")), ai=4)
f("infrastructure_act", "Infrastructure Investment and Jobs Act", "Federal money for roads, bridges, transit and rail, signed on 15 November 2021.", 5, 6,
  [BUILD("infrastructure", 5), TREAS(-5), MOD("construction_speed", 0.05, 2920)], pre=["tax_cuts_and_jobs_act|dodd_frank"], avail=ALL(PRES("joe_biden"), AFTER("2021-11-15")), ai=4)
f("chips_act", "CHIPS and Science Act", "About $52.7 billion for semiconductor plants and research, signed on 9 August 2022.", 4, 7,
  [SPIRIT("industrial_policy"), BUILD("data_centre", 2, AZ, OH), BUILD("civilian_factory", 2, AZ, OH), RB("electronics_cyber", 0.25, 2)], pre=["infrastructure_act"], avail=ALL(PRES("joe_biden"), AFTER("2022-08-09")), ai=4)
f("inflation_reduction_act", "Inflation Reduction Act", "Energy investment, lower drug prices and deficit reduction, signed on 16 August 2022.", 6, 7,
  [BUILD("renewable_plant", 3), MOD("inflation", -0.005, 1460), MOD("energy_cost", -0.03, 2920)], pre=["infrastructure_act"], avail=ALL(PRES("joe_biden"), AFTER("2022-08-16")), ai=4)

# ---- political paths (x 12-17): the two-party system and third parties of the data
starts = ["libertarian_moment", "green_wave", "populist_revolt", "religious_right", "army_steps_in"]
def excl(me): return [s for s in ["two_party_system"] + starts if s != me]
f("question_of_power", "The future of American politics", "Whether the two-party system holds or a third force breaks through.", 15, 0, [PP(20)], ai=3)
f("two_party_system", "The two-party system", "Democrats and Republicans alternate in power. This is the path the United States took.", 12, 1,
  [STAB(0.03), PP(30)], pre=["question_of_power"], excl=excl("two_party_system"), ai=20)
f("libertarian_moment", "A libertarian moment", "Voters tired of both parties turn to the Libertarian Party.", 13, 1,
  [LEAVE, SPIRIT("third_party_surge"), {"add_party_popularity": {"party": "usa.libertarian", "value": 0.06}}],
  pre=["question_of_power"], excl=excl("libertarian_moment"), avail=ALL(ALT, {"party_exists": "usa.libertarian"}, {"stability_below": 0.5}), ai=0.2)
f("libertarian_government", "A Libertarian administration", "The Libertarian Party takes the White House.", 13, 2,
  [{"install_government": {"party": "usa.libertarian"}}, LAW("economic_system", "laissez_faire"), {"set_budget": {"spending": -3, "revenue": -3}}],
  pre=["libertarian_moment"], avail={"party_popularity_above": {"party": "usa.libertarian", "value": 0.2}}, days=105)
f("small_government", "Small government", "Cut agencies and regulations; bring troops home.", 13, 3,
  [MOD("private_sector_output", 0.06, 2920), MOD("foreign_influence_power", -0.1, 2920), REMOVE("homeland_security_state"), IG("military", -6)], pre=["libertarian_government"])
f("green_wave", "A green wave", "Climate and inequality bring voters to the Greens.", 14, 1,
  [LEAVE, SPIRIT("third_party_surge"), GROUP("social_democratic", 0.05)],
  pre=["question_of_power"], excl=excl("green_wave"), avail=ALL(ALT, {"has_party_of_group": "social_democratic"}, {"stability_below": 0.5}), ai=0.2)
f("green_government", "A Green administration", "The Green Party takes the White House.", 14, 2,
  [{"install_government": {"ideology": "social_democratic"}}, LAW("energy_policy", "green_transition"), LAW("healthcare", "national_health_service")],
  pre=["green_wave"], avail={"ideology_group_support_above": {"group": "social_democratic", "value": 0.2}}, days=105)
f("green_new_deal", "A green industrial programme", "Wind, solar and rail across the country.", 14, 3,
  [BUILD("renewable_plant", 5), BUILD("infrastructure", 3), TREAS(-6)], pre=["green_government"])
f("populist_revolt", "A populist revolt", "Anger at trade deals and elites lifts the Reform Party.", 15, 1,
  [LEAVE, SPIRIT("third_party_surge"), GROUP("nationalist_populist", 0.05), IG("labour_unions", 3)],
  pre=["question_of_power"], excl=excl("populist_revolt"), avail=ALL(ALT, {"has_party_of_group": "nationalist_populist"}, {"stability_below": 0.5}), ai=0.2)
f("populist_government", "A Reform administration", "The most popular nationalist party takes the White House.", 15, 2,
  [{"install_government": {"ideology": "nationalist_populist"}}, LAW("trade", "protectionism"), LAW("immigration", "restrictive_immigration")],
  pre=["populist_revolt"], avail={"ideology_group_support_above": {"group": "nationalist_populist", "value": 0.2}}, days=105)
f("tariff_wall", "A tariff wall", "High tariffs to bring factories home.", 15, 3,
  [BUILD("civilian_factory", 4, OH, MI, PA), MOD("trade_efficiency", -0.06, 2920), OPN("CHN", -20), OPN("MEX", -10)], pre=["populist_government"])
f("religious_right", "A religious right", "Christian conservatives leave the Republicans for the Constitution Party.", 16, 1,
  [LEAVE, SPIRIT("third_party_surge"), GROUP("religious", 0.05), IG("religious_establishment", 5)],
  pre=["question_of_power"], excl=excl("religious_right"), avail=ALL(ALT, {"has_party_of_group": "religious"}, {"stability_below": 0.5}), ai=0.2)
f("religious_government", "A Constitution Party administration", "The most popular religious party takes the White House.", 16, 2,
  [{"install_government": {"ideology": "religious"}}, IG("religious_establishment", 8), IG("youth_students", -5)],
  pre=["religious_right"], avail={"ideology_group_support_above": {"group": "religious", "value": 0.2}}, days=105)
f("army_steps_in", "The army steps in", "With the republic in crisis, the generals prepare to take over.", 17, 1,
  [LEAVE, IGI("military", 0.08)], pre=["question_of_power"], excl=excl("army_steps_in"),
  avail=ALL(ALT, {"stability_below": 0.2}, {"unrest_above": 0.5}), ai=0.05)
f("military_council", "Military council", "The armed forces remove the government. The coup may fail.", 17, 2,
  [{"trigger_coup": {"by": "military", "success_chance": 0.4}}], pre=["army_steps_in"], days=35)
f("return_to_barracks", "Return to the barracks", "The council hands power back to an elected government.", 17, 3,
  [{"set_government_type": "presidential"}, LAW("political_freedom", "free_elections"), {"hold_election": {"kind": "presidential"}}, STAB(0.05)],
  pre=["military_council"], avail={"government_type": "military_junta"}, days=140, ai=0.5)

# ============================================================ economy and energy (x 19-25)
f("economic_agenda", "Economic agenda", "Set the economic priorities of the administration.", 22, 0, [PP(20), {"add_economic_mood": 0.02}], ai=4)
f("dotcom_crash", "After the dot-com crash", "Let the bubble deflate and support the recovery.", 19, 1,
  [REMOVE("dotcom_bubble"), MOD("interest_rate", -0.005, 1460)], pre=["economic_agenda"], avail=ALL(HAS("dotcom_bubble"), AFTER("2001-06-01")), ai=4)
f("trade_agenda", "Trade agenda", "Negotiate new trade agreements.", 21, 1,
  [MOD("trade_efficiency", 0.04, 3650), IG("business", 3), IG("labour_unions", -2)], pre=["economic_agenda"])
f("energy_policy", "National energy policy", "Set a national energy strategy.", 23, 1,
  [MOD("energy_cost", -0.03, 3650), BUILD("refinery", 1, TX)], pre=["economic_agenda"])
f("housing_market", "Homeownership", "Encourage home buying with cheap credit.", 25, 1,
  [MOD("construction_speed", 0.05, 2920), MOD("gdp_growth", 0.002, 1460), IG("urban_middle_class", 3)], pre=["economic_agenda"])
f("tech_sector", "Silicon Valley", "Support for software, cloud and the internet economy.", 19, 2,
  [BUILD("data_centre", 2, CA, WA), RB("economy_digital", 0.2, 2)], pre=["dotcom_crash|trade_agenda"])
f("shale_revolution", "Shale oil and gas", "Horizontal drilling and fracking open new fields in Texas, North Dakota and Pennsylvania.", 23, 2,
  [SPIRIT("shale_boom"), BUILD("refinery", 2, TX, PA)], pre=["energy_policy"], avail=AFTER("2008-01-01"), ai=3)
f("gulf_refining", "Gulf Coast refining", "Expand the refineries and petrochemical plants of the Gulf Coast.", 24, 3,
  [BUILD("refinery", 2, TX, LA), BUILD("port", 1, TX)], pre=["shale_revolution"])
f("lng_exports", "Gas exports", "Liquefied gas terminals for exports to Europe and Asia.", 22, 3,
  [BUILD("port", 1, LA), MOD("trade_efficiency", 0.03, 2920), TREAS(3)], pre=["shale_revolution"], avail=AFTER("2016-01-01"))
f("usmca", "United States–Mexico–Canada Agreement", "A new trade agreement replacing NAFTA, in force from 1 July 2020.", 21, 2,
  [MOD("trade_efficiency", 0.03, 3650), OPN("MEX", 10), OPN("CAN", 10), BUILD("civilian_factory", 1, MI)], pre=["trade_agenda"], avail=ALL(HIST, AFTER("2020-07-01")), ai=3)
f("manufacturing_renewal", "Manufacturing renewal", "Bring factories back to the Midwest.", 20, 3,
  [BUILD("civilian_factory", 3, OH, MI, IL), IG("labour_unions", 4)], pre=["usmca|trade_agenda"])
f("housing_bubble", "Housing finance", "Mortgage lending and home building grow fast.", 25, 2,
  [MOD("construction_speed", 0.03, 1460), MOD("gdp_growth", 0.001, 1460)], pre=["housing_market"])
f("space_industry", "Commercial space", "Contracts for private launch companies.", 19, 3,
  [BUILD("data_centre", 1, FL), RB("air_drones", 0.15, 1)], pre=["tech_sector"])
f("clean_energy", "Clean energy", "Tax credits for wind, solar and batteries.", 23, 4,
  [BUILD("renewable_plant", 3, CA, TX), MOD("renewable_output", 0.1, 3650)], pre=["gulf_refining|lng_exports"])
f("semiconductors", "Semiconductors", "New chip plants at home.", 20, 4,
  [BUILD("civilian_factory", 2, AZ, TX), RB("electronics_cyber", 0.2, 2)], pre=["manufacturing_renewal|space_industry"])
f("ai_research", "Artificial intelligence", "Data centres and research for artificial intelligence.", 21, 5,
  [BUILD("data_centre", 3, VA, CA, TX), RB("economy_digital", 0.25, 2)], pre=["semiconductors"], avail=AFTER("2016-01-01"))
f("grid_modernisation", "Modernise the grid", "Transmission lines and storage for a modern grid.", 24, 5,
  [MOD("energy_cost", -0.03, 3650), BUILD("infrastructure", 2)], pre=["clean_energy"])

# ============================================================ military (x 27-33)
f("defence_review", "Quadrennial defence review", "Review strategy, forces and budgets.", 30, 0, [WS(0.03), IG("military", 4)], ai=4)
f("missile_defence", "Missile defence", "Fund national missile defence programmes.", 28, 1,
  [MOD("air_effectiveness", 0.03, 3650), RB("artillery_missiles", 0.2, 2), IG("military", 3)], pre=["defence_review"])
f("force_transformation", "Force transformation", "Restructure the armed forces around lighter, networked units.", 30, 1,
  [MOD("army_org", 0.04, 3650), RB("doctrine", 0.2, 2)], pre=["defence_review"])
f("carrier_fleet", "Carrier fleet", "New aircraft carriers and naval bases.", 32, 1,
  [BUILD("port", 2, VA, CA), RB("naval", 0.25, 2)], pre=["defence_review"])
f("special_operations", "Special operations", "Expand Special Operations Command for counter-terrorism.", 28, 2,
  [DIVS("motorised_division", 2), MOD("army_attack", 0.02, 2920)], pre=["force_transformation"], avail={"has_global_flag": "september_11"})
f("drone_programme", "Armed drones", "Armed drones for surveillance and strikes.", 30, 2,
  [RB("air_drones", 0.25, 2), BUILD("air_base", 1, AZ)], pre=["force_transformation|missile_defence"])
f("arsenal_of_democracy", "Defence industry", "Expand the arms plants and ammunition production.", 32, 2,
  [BUILD("military_factory", 3, PA, TX, AL), EQUIP(3000)], pre=["carrier_fleet"])
f("iraq_surge", "The surge in Iraq", "More than 20,000 additional troops, mostly to Baghdad, announced in January 2007.", 28, 3,
  [MOD("army_attack", 0.02, 1460), WS(-0.02), {"add_ruling_party_popularity": -0.02}], pre=["special_operations"], avail=ALL(HIST, AFTER("2007-01-10")), ai=4)
f("cyber_command", "Cyber command", "A command for cyber operations.", 30, 3,
  [RB("electronics_cyber", 0.25, 2), MOD("intelligence_power", 0.05, 3650)], pre=["drone_programme"])
f("global_bases", "Global basing", "Air bases and ports for global reach.", 32, 3,
  [BUILD("air_base", 2, HI, FL), MOD("foreign_influence_power", 0.05, 3650)], pre=["arsenal_of_democracy"])
f("leave_iraq", "Withdrawal from Iraq", "Bring the troops home from Iraq; the withdrawal was mostly completed by December 2011.", 28, 4,
  [WS(0.02), STAB(0.02), TREAS(3)], pre=["iraq_surge"], avail=ALL(HIST, AFTER("2011-12-01")), ai=4)
f("inherent_resolve", "Operation Inherent Resolve", "Lead the international coalition against the Islamic State in Iraq and Syria from 15 June 2014.", 30, 4,
  [MOD("air_effectiveness", 0.03, 2920), OPN("IRQ", 10), WS(0.02)], pre=["cyber_command|leave_iraq"], avail=AFTER("2014-06-15"), ai=4)
f("space_force", "United States Space Force", "A space service branch of the armed forces, established on 20 December 2019.", 32, 4,
  [RB("air_drones", 0.2, 1), RB("electronics_cyber", 0.2, 1), MOD("intelligence_power", 0.05, 3650)], pre=["global_bases|cyber_command"], avail=AFTER("2019-12-20"), ai=3)
f("leave_afghanistan", "Withdrawal from Afghanistan", "Withdraw from Afghanistan; the Department of Defense completed the withdrawal on 30 August 2021.", 29, 5,
  [STAB(0.01), TREAS(2), WS(-0.02)], pre=["inherent_resolve"], avail=ALL(HIST, AFTER("2021-08-30")), ai=3)
f("great_power_competition", "Great-power competition", "Rebuild forces for competition with China and Russia.", 31, 5,
  [BUILD("military_factory", 2, OH, GA), MOD("army_org", 0.02, 2920)], pre=["inherent_resolve|space_force"], avail=AFTER("2017-01-01"))

# ============================================================ foreign policy (x 35-40)
f("foreign_policy", "Foreign policy priorities", "Set the course of American foreign policy.", 37, 0, [PP(30), MOD("diplomatic_reputation", 0.03, 1825)], ai=4)
f("war_on_terror_coalition", "A coalition against terrorism", "Build an international coalition after the September 11 attacks.", 35, 1,
  [OPN("GBR", 10), OPN("PAK", 10), MOD("diplomatic_reputation", 0.03, 2920)], pre=["foreign_policy"], avail={"has_global_flag": "september_11"}, ai=3)
f("nato_enlargement", "NATO enlargement", "Support NATO membership for the democracies of Central and Eastern Europe.", 37, 1,
  [OPN("POL", 10), OPN("RUS", -10), MOD("foreign_influence_power", 0.05, 2920)], pre=["foreign_policy"])
f("free_trade_partners", "Free trade partners", "Trade agreements with allies in Asia and the Americas.", 39, 1,
  [MOD("trade_efficiency", 0.03, 3650), OPN("KOR", 10), OPN("AUS", 10)], pre=["foreign_policy"])
f("new_start", "New START", "A strategic arms treaty with Russia, signed in Prague on 8 April 2010 and in force from 5 February 2011.", 36, 2,
  [OPN("RUS", 15), MOD("diplomatic_reputation", 0.03, 2920), TREAS(1)], pre=["nato_enlargement"], avail=ALL(HIST, AFTER("2010-04-08")), ai=3)
f("israel_partnership", "Partnership with Israel", "Military aid and diplomatic support for Israel.", 35, 2,
  [OPN("ISR", 20), OPN("IRN", -10)], pre=["war_on_terror_coalition"])
f("pivot_to_asia", "Pivot to Asia", "Shift forces and diplomacy toward the Asia-Pacific.", 39, 2,
  [OPN("JPN", 10), OPN("CHN", -5), BUILD("port", 1, HI)], pre=["free_trade_partners"])
f("sanctions_on_russia", "Sanctions on Russia", "Sanctions on Russia after the annexation of Crimea in 2014.", 37, 3,
  [OPN("RUS", -20), OPN("UKR", 15), MOD("foreign_influence_power", 0.03, 2920)], pre=["new_start|nato_enlargement"], avail=AFTER("2014-03-18"))
f("indo_pacific", "Indo-Pacific partners", "Closer ties with India, Japan and Australia.", 39, 3,
  [OPN("IND", 15), OPN("AUS", 10), OPN("JPN", 10)], pre=["pivot_to_asia"])
f("ukraine_aid", "Security assistance for Ukraine", "Training, equipment and advisers for Ukraine's defence.", 37, 4,
  [OPN("UKR", 20), TREAS(-3), {"country": {"tag": "UKR", "effects": [{"add_equipment": {"family": "infantry_equipment", "amount": 1500}}]}}], pre=["sanctions_on_russia"], avail=ALL(AFTER("2022-02-24"), CASH(3)))
f("rally_allies", "Rally the allies", "Unite NATO and the G7 behind common aims.", 35, 3,
  [MOD("diplomatic_reputation", 0.05, 2920), OPN("DEU", 10), OPN("FRA", 10)], pre=["israel_partnership|new_start"])
f("tech_controls", "Technology export controls", "Restrict exports of advanced chips to rivals.", 39, 4,
  [OPN("CHN", -15), MOD("foreign_influence_resistance", 0.05, 3650)], pre=["indo_pacific"], avail=AFTER("2018-01-01"))

# ============================================================ society and science (x 42-45)
f("domestic_agenda", "Domestic agenda", "Priorities at home: schools, health and science.", 43, 0, [PP(20)], ai=3)
f("research_funding", "Federal research funding", "More money for national laboratories and universities.", 42, 1,
  [RB("industry_energy", 0.2, 2), MOD("research_speed", 0.03, 2920)], pre=["domestic_agenda"])
f("community_colleges", "Community colleges", "Job training at community colleges.", 44, 1,
  [MOD("education_quality", 0.03, 3650), IG("labour_unions", 2)], pre=["domestic_agenda"])
f("broadband", "Broadband for rural America", "High-speed internet in the countryside.", 43, 2,
  [BUILD("data_centre", 1), BUILD("infrastructure", 2), IG("rural", 4)], pre=["research_funding|community_colleges"])
f("medical_research", "Medical research", "Double funding for medical research.", 42, 3,
  [MOD("health_outcomes", 0.03, 3650), RB("economy_digital", 0.15, 1)], pre=["broadband"])
f("infrastructure_bank", "Water and transit", "Replace old water pipes and expand transit.", 44, 3,
  [BUILD("infrastructure", 2), MOD("health_outcomes", 0.01, 3650), TREAS(-1)], pre=["broadband"], avail=CASH(1))

# ---- more depth
f("army_modernisation", "Army modernisation", "New armoured vehicles, helicopters and networks for the Army.", 27, 3,
  [RB("armour", 0.2, 2), EQUIP(1000)], pre=["special_operations|drone_programme"])
f("stryker_brigades", "Medium brigades", "Wheeled brigades that deploy faster than heavy armour.", 27, 4,
  [DIVS("motorised_division", 2)], pre=["army_modernisation"])
f("national_guard", "The National Guard", "Train and equip the National Guard for deployments abroad and disasters at home.", 33, 3,
  [MOD("manpower_factor", 0.03, 2920), DIVS("infantry_division", 2)], pre=["arsenal_of_democracy"])
f("fifth_generation_fighters", "Fifth-generation fighters", "New stealth fighters for the Air Force, Navy and Marines.", 33, 2,
  [RB("air_drones", 0.25, 2), BUILD("air_base", 1, TX)], pre=["carrier_fleet"])
f("hypersonics", "Hypersonic weapons", "Research into hypersonic missiles and defences.", 33, 5,
  [RB("artillery_missiles", 0.25, 2)], pre=["space_force|global_bases"], avail=AFTER("2018-01-01"))
f("shipbuilding", "Shipbuilding", "Expand the naval shipyards.", 33, 4,
  [BUILD("military_factory", 1, VA), BUILD("port", 1, WA), RB("naval", 0.2, 1)], pre=["global_bases|national_guard"])
f("africa_partners", "Partners in Africa", "A command for Africa, training and aid for partner states.", 35, 4,
  [MOD("foreign_influence_power", 0.05, 2920), TREAS(-1)], pre=["rally_allies"])
f("americas_partners", "Partners in the Americas", "Trade, aid and security cooperation in Latin America.", 36, 5,
  [OPN("MEX", 10), OPN("COL", 15), OPN("BRA", 10)], pre=["rally_allies|sanctions_on_russia"])
f("g20_summits", "G20 leaders' summits", "Coordinate the response to economic crises with the largest economies.", 38, 5,
  [MOD("diplomatic_reputation", 0.04, 2920), MOD("trade_efficiency", 0.02, 2920)], pre=["ukraine_aid|indo_pacific|sanctions_on_russia"])
f("iran_pressure", "Pressure on Iran", "Sanctions and diplomacy over Iran's nuclear programme.", 34, 3,
  [OPN("IRN", -15), OPN("ISR", 5), MOD("foreign_influence_power", 0.03, 2920)], pre=["israel_partnership"])
f("korea_diplomacy", "Diplomacy on Korea", "Talks and deterrence on the Korean peninsula.", 40, 3,
  [OPN("KOR", 10), OPN("JPN", 5)], pre=["pivot_to_asia"])
f("climate_diplomacy", "Climate diplomacy", "International agreements on emissions.", 40, 4,
  [MOD("diplomatic_reputation", 0.03, 2920), MOD("renewable_output", 0.05, 2920)], pre=["korea_diplomacy|indo_pacific"])
f("farm_exports", "Farm exports", "Open markets for American grain, soy and meat.", 25, 3,
  [MOD("trade_efficiency", 0.02, 2920), IG("rural", 5), BUILD("port", 1, LA)], pre=["housing_bubble|trade_agenda"])
f("auto_industry", "The car industry", "Help the car makers through the recession and into electric cars.", 22, 4,
  [BUILD("civilian_factory", 2, MI, OH), IG("labour_unions", 4), TREAS(-2)], pre=["manufacturing_renewal|lng_exports"], avail=CASH(2))
f("rail_freight", "Rail and freight", "Faster freight rail and new intermodal terminals.", 25, 4,
  [BUILD("infrastructure", 3), MOD("trade_efficiency", 0.02, 2920)], pre=["farm_exports"])
f("nuclear_power", "Nuclear power", "Extend the life of reactors and build new ones.", 25, 5,
  [MOD("nuclear_output", 0.08, 3650), MOD("energy_cost", -0.02, 3650)], pre=["rail_freight|clean_energy"])
f("immigration_reform", "Immigration reform", "Border security and new rules for workers and students.", 45, 1,
  [LAW("immigration", "managed_immigration"), MOD("population_growth", 0.001, 2920), IG("business", 3)], pre=["domestic_agenda"])
f("border_security", "Border security", "More agents, barriers and technology on the southern border.", 45, 2,
  [MOD("internal_security", 0.03, 2920), TREAS(-1), IG("rural", 2)], pre=["immigration_reform"], avail=CASH(1))
f("student_aid", "Student aid", "Grants and loans for college students.", 44, 2,
  [MOD("education_quality", 0.03, 3650), IG("youth_students", 4), TREAS(-1)], pre=["community_colleges"], avail=CASH(1))
f("veterans_affairs", "Care for veterans", "Health care and benefits for veterans of the wars in Iraq and Afghanistan.", 45, 3,
  [STAB(0.02), IG("military", 4), TREAS(-1)], pre=["border_security|student_aid"], avail=AFTER("2004-01-01"))
f("opportunity_zones", "Investment in poorer areas", "Tax breaks for investment in struggling towns and neighbourhoods.", 43, 4,
  [BUILD("civilian_factory", 1), MOD("private_sector_output", 0.02, 2920)], pre=["medical_research|infrastructure_bank"])
f("disaster_resilience", "Disaster resilience", "Levees, building codes and an emergency agency ready for hurricanes and fires.", 44, 4,
  [BUILD("infrastructure", 1, LA, FL), STAB(0.01)], pre=["infrastructure_bank"])

tree = {
    "id": "usa", "name": "United States", "countries": ["USA"],
    "note": "The United States in the style of the Russian model tree. The administrations branch follows the real laws of 2001-2022 on their dates; the political branch has the two-party system (the historical path) and third-party turns that bring to power only real parties of the data (Libertarian, Green, Reform, Constitution) plus a military junta; alternatives are a counterfactual, not a claim about the parties. Economy, military, foreign policy and society branches build, fix the starting spirits (data/spirits/usa.json), unlock decisions (data/decisions/usa.json) and grant research. Policies named after real laws are cited; effects are gameplay estimates. Wars stay in the scripted conflict events.",
    "source": [{"url": "https://en.wikipedia.org/wiki/" + t.replace(" ", "_"), "title": "Wikipedia: " + t, "accessed": "2026-10-19"} for t in [
        "Presidency of George W. Bush", "Al Gore 2000 presidential campaign", "Economic Growth and Tax Relief Reconciliation Act of 2001", "No Child Left Behind Act",
        "USA PATRIOT Act", "Homeland Security Act", "Medicare Prescription Drug, Improvement, and Modernization Act", "Emergency Economic Stabilization Act of 2008",
        "American Recovery and Reinvestment Act of 2009", "Affordable Care Act", "Dodd–Frank Wall Street Reform and Consumer Protection Act", "New START",
        "Iraq War troop surge of 2007", "Withdrawal of United States troops from Iraq (2007–2011)", "2020–2021 U.S. troop withdrawal from Afghanistan", "Tax Cuts and Jobs Act",
        "United States–Mexico–Canada Agreement", "CHIPS and Science Act", "Inflation Reduction Act", "Infrastructure Investment and Jobs Act", "United States Space Force",
        "Operation Inherent Resolve", "Ukraine Security Assistance Initiative", "Economy of the United States", "Dot-com bubble", "United States Armed Forces",
        "Libertarian Party (United States)", "Green Party of the United States", "Constitution Party (United States)", "Reform Party of the United States of America"]],
    "confidence": "verified",
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
json.dump(tree, open("data/focus_trees/usa.json", "w", encoding="utf8", newline="\n"), indent=2, ensure_ascii=False)
open("data/focus_trees/usa.json", "a", encoding="utf8", newline="\n").write("\n")

dec = {"categories": [{"id": "usa_projects", "name": "American federal projects", "description": "Projects that the US national focuses open up."}], "decisions": []}
def D(id, name, desc, focus, pp, effects, avail=None, cooldown=365, ai=2):
    d = {"id": id, "name": name, "description": desc, "category": "usa_projects", "countries": ["USA"], "visible": {"has_completed_focus": "usa_" + focus}}
    if avail: d["available"] = avail
    d.update({"cost": {"political_power": pp}, "effects": effects, "cooldown_days": cooldown, "ai_weight": ai})
    dec["decisions"].append(d)
D("usa_highway_bill", "Highway bill", "A federal highway and transit bill.", "infrastructure_act", 30, [TREAS(-2), BUILD("infrastructure", 3)], CASH(2))
D("usa_defence_appropriation", "Defence supplemental", "Extra money for procurement.", "arsenal_of_democracy", 30, [TREAS(-3), EQUIP(1500), IG("military", 2)], CASH(3))
D("usa_strategic_petroleum_release", "Release from the Strategic Petroleum Reserve", "Sell oil from the reserve to calm prices.", "energy_policy", 30, [MOD("energy_cost", -0.03, 365), TREAS(1)], cooldown=730, ai=1)
D("usa_research_grants", "National research grants", "A round of grants from the national science agencies.", "research_funding", 25, [TREAS(-1), RB("economy_digital", 0.2, 1), RB("industry_energy", 0.2, 1)], CASH(1))
D("usa_fab_subsidy", "Subsidise a chip plant", "Federal money for a new semiconductor plant.", "semiconductors", 30, [TREAS(-2), BUILD("civilian_factory", 1, AZ, TX, OH)], CASH(2))
json.dump(dec, open("data/decisions/usa.json", "w", encoding="utf8", newline="\n"), indent=2, ensure_ascii=False)
open("data/decisions/usa.json", "a", encoding="utf8", newline="\n").write("\n")
print(len(F), "focuses;", len(dec["decisions"]), "decisions")
