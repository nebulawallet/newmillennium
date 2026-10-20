"""Islamic State, Taliban and Islamic Emirate of Afghanistan trees in the Russia model style (docs/ISG_TAL_TREES_PLAN.md).
Run from the repo root:  python -I -X utf8 scripts/dev/focus-trees/gen_isg_tal.py

Wording rules: neutral and descriptive, as a historian would describe any de facto state; no real people; no violence
against civilians as gameplay. Every named event or date comes from a Wikipedia article fetched with
scripts/research/wiki.ts (listed in each tree's sources). Counterfactual branches are gated with ALT, so the AI on the
historical path never takes them, and no focus declares war or moves provinces.
"""
import json
import sys; sys.path.insert(0, __file__.replace("\\", "/").rsplit("/", 1)[0])
from treelib import *

HAS_FOCUS = lambda f: {"has_completed_focus": f}
TAG = lambda t: {"tag": t}
EXISTS = lambda t: {"exists": t}
AT_WAR = {"at_war": True}
CLAIM = lambda n: {"claim_rival_border": {"count": n}}
DRONES = lambda n: {"add_equipment": {"family": "combat_drone", "amount": n}}
GEAR = lambda fam, n: {"add_equipment": {"family": fam, "amount": n}}
KABUL, KANDAHAR, HERAT, BALKH, NANGARHAR = "AFG-1762", "AFG-1754", "AFG-1742", "AFG-1744", "AFG-1774"
HOLDS_KABUL = {"controls_region": {"adm1": [KABUL], "label": "Kabul"}}
IEA_NAME = "Islamic Emirate of Afghanistan"


def fix_countries(prefix, tags, switched=False):
    """Tree and decision files list every tag that can use them (the Taliban tree serves AFG in 2000-2001 and TAL)."""
    p = f"data/focus_trees/{prefix}.json"
    t = json.load(open(p, encoding="utf8"))
    t["countries"] = tags
    if switched:
        t = {k: t[k] for k in ("id", "name", "countries")} | {"switched_to": True} | {k: v for k, v in t.items() if k not in ("id", "name", "countries")}
    json.dump(t, open(p, "w", encoding="utf8", newline="\n"), indent=2, ensure_ascii=False)
    open(p, "a", encoding="utf8", newline="\n").write("\n")
    p = f"data/decisions/{prefix}.json"
    d = json.load(open(p, encoding="utf8"))
    for x in d["decisions"]: x["countries"] = tags
    json.dump(d, open(p, "w", encoding="utf8", newline="\n"), indent=2, ensure_ascii=False)
    open(p, "a", encoding="utf8", newline="\n").write("\n")


# ====================================================================================== ISLAMIC STATE
write_spirits("isg", "The Islamic State's national spirits (gameplay values). Starting ones are added by the spawn event of January 2014 in data/events/conflicts.json.", [
    spirit("isg_administration_strain", "An overstretched administration", "Services and offices fall behind as the territory grows faster than the administration.", "problem", {"stability_factor": -0.03, "tax_efficiency": -0.05, "production_efficiency": -0.05}),
    spirit("isg_proto_state", "A proto-state", "Councils, offices and courts run the towns the group holds.", "strength", {"political_power_gain": 0.1, "internal_security": 0.05}),
    spirit("isg_war_revenue", "War revenue", "Oil sales, levies and seized assets pay for the group.", "policy", {"tax_efficiency": 0.06, "foreign_influence_resistance": -0.05, "corruption": 0.02}),
    spirit("isg_dinar", "The dinar", "The group issues its own coinage, the dinar, alongside the currencies already in use.", "policy", {"tax_efficiency": 0.03, "trade_efficiency": -0.03}),
    spirit("isg_foreign_recruits", "Foreign recruits", "Recruits from abroad join the group's forces.", "policy", {"manpower_factor": 0.05, "army_org": -0.02, "international_opinion": -0.05}),
    spirit("isg_besieged", "Besieged cities", "The cities are surrounded and supply runs short.", "problem", {"army_defence": 0.05, "production_efficiency": -0.1, "stability_factor": -0.02}),
    spirit("isg_entrenched_state", "An entrenched state", "The administration has outlasted the offensives against it and runs the territory as a state.", "strength", {"stability_factor": 0.03, "army_defence": 0.05, "production_efficiency": 0.03}),
    spirit("isg_insurgency_mode", "Insurgency", "Small cells in the desert and the countryside replace the fixed front lines.", "policy", {"army_org": -0.05, "internal_security": 0.1, "army_defence": 0.03}),
    spirit("isg_desert_networks", "Desert networks", "Hideouts and supply routes across the desert between Iraq and Syria.", "strength", {"army_defence": 0.04, "manpower_factor": 0.03}),
])
write_decisions("isg", "ISG", "Islamic State projects", [
    ("isg_recruitment_drive", "Recruitment drive", "Raise new fighters in the towns the group holds.", "isg_recruitment", 40, [DIVS("infantry_division", 1), UNREST(0.02)], None, 240),
    ("isg_fortify_a_city", "Fortify a city", "Defences around a city under threat.", "isg_defend_the_cities", 30, [MOD("army_defence", 0.04, 365)], AT_WAR, 240),
    ("isg_sell_oil", "Sell oil", "Sell crude from the fields the group holds.", "isg_oil_fields", 20, [TREAS(0.3)], None, 180),
    ("isg_open_a_new_front", "Open a new front", "Concentrate forces for an offensive on a new front.", "isg_expansion", 50, [MOD("army_attack", 0.05, 180), WS(0.02)], ALT, 365),
])

G = Tree("isg", "ISG")
f = G.f
# ---------------------------------------------------------------- administration (x 0-4)
f("proto_state", "A proto-state", "The group organises an administration in the towns it holds, after proclaiming a caliphate in 2014.", 2, 0, [PP(40), G.SPIRIT("proto_state")], ai=6)
f("town_councils", "Town councils", "Councils run the towns and the districts around them.", 0, 1, [STAB(0.03), MOD("tax_efficiency", 0.04, 1460)], pre=["proto_state"])
f("courts", "Courts", "Courts replace the state's courts in the territory.", 2, 1, [MOD("internal_security", 0.05, 1460), IG("religious_establishment", 5)], pre=["proto_state"])
f("services", "Water, power and bread", "Keep the waterworks, power stations and bakeries running.", 4, 1, [STAB(0.02), UNREST(-0.03)], pre=["proto_state"])
f("tax_offices", "Tax offices", "Offices collect levies on trade and farming.", 0, 2, [MOD("tax_efficiency", 0.05, 1460), TREAS(0.2)], pre=["town_councils"])
f("records", "Records and registers", "Registers of land, property and residents.", 2, 2, [MOD("internal_security", 0.03, 1460), PP(20)], pre=["courts|town_councils"])
f("repair_crews", "Repair crews", "Crews repair roads and power lines in the territory.", 4, 2, [G.BUILD("infrastructure", 1), STAB(0.01)], pre=["services"])
f("ease_the_strain", "Ease the strain", "More officials and simpler rules for the administration.", 1, 3, [G.REMOVE("administration_strain"), PP(20)], pre=["tax_offices|records"], avail=G.HAS("administration_strain"), days=105)
f("internal_police", "Internal police", "A police force patrols the towns.", 3, 3, [MOD("internal_security", 0.05, 1460), IG("security_services", 5)], pre=["records|repair_crews"])
f("schools_and_clinics", "Schools and clinics", "The administration takes over schools and clinics.", 4, 3, [MOD("education_quality", -0.02, 1460), MOD("health_outcomes", 0.01, 1460), STAB(0.01)], pre=["repair_crews"])
f("dinar", "The dinar", "Issue the group's own coinage, the dinar, used from 2014 to 2019.", 0, 4, [G.SPIRIT("dinar")], pre=["ease_the_strain"], avail=AFTER("2014-06-10"))
f("provincial_administration", "Provincial administration", "The territory is divided into provinces with their own administrations.", 2, 4, [PP(30), STAB(0.02)], pre=["ease_the_strain|internal_police"])
f("tribal_agreements", "Tribal agreements", "Agreements with tribes in the Euphrates valley.", 4, 4, [IG("rural", 5), UNREST(-0.02)], pre=["schools_and_clinics|internal_police"])

# ---------------------------------------------------------------- revenue (x 6-9)
f("revenue", "Revenue", "Pay for the group from the territory it holds. By the end of 2015 its budget was over US$1 billion.", 7, 0, [PP(20)], ai=5)
f("oil_fields", "The oil fields", "Run the oil fields in the territory. Unlocks oil sales.", 6, 1, [TREAS(0.5), MOD("fossil_output", 0.05, 1460)], pre=["revenue"])
f("seized_banks", "Seized banks", "Take over the bank branches in the captured cities.", 8, 1, [TREAS(1)], pre=["revenue"], avail=AFTER("2014-06-10"))
f("makeshift_refineries", "Makeshift refineries", "Small refineries turn crude into fuel.", 6, 2, [G.BUILD("refinery", 1), MOD("energy_cost", -0.03, 1460)], pre=["oil_fields"])
f("war_revenue", "A war economy", "Oil, levies and seized assets fund the war.", 8, 2, [G.SPIRIT("war_revenue")], pre=["seized_banks|oil_fields"])
f("euphrates_farms", "Farms of the Euphrates", "Wheat and barley from the irrigated valley.", 9, 2, [IG("rural", 4), MOD("gdp_growth", 0.001, 1460)], pre=["revenue"])
f("smuggling_routes", "Trade routes", "Fuel and goods move through the borderlands.", 6, 3, [MOD("trade_efficiency", 0.03, 1460), TREAS(0.3)], pre=["makeshift_refineries"])
f("workshops", "Workshops", "Workshops repair vehicles and make spare parts.", 8, 3, [G.BUILD("military_factory", 1)], pre=["war_revenue"])
f("grain_stores", "Grain stores", "Silos and mills store the harvest.", 9, 3, [STAB(0.02), UNREST(-0.02)], pre=["euphrates_farms"])
f("budget_office", "A budget office", "One office plans revenue and spending across the provinces.", 7, 4, [MOD("tax_efficiency", 0.03, 1460), MOD("corruption", -0.02, 1460)], pre=["smuggling_routes|workshops|grain_stores"])

# ---------------------------------------------------------------- forces (x 11-16)
f("forces", "Forces", "Organise the group's fighters into an army.", 13, 0, [PP(20), MOD("army_org", 0.02, 1460)], ai=5)
f("captured_arsenals", "Captured arsenals", "Use the weapons and vehicles left in army depots.", 11, 1, [EQUIP(1200), GEAR("armoured_vehicle", 40)], pre=["forces"], avail=AFTER("2014-06-10"))
f("recruitment", "Recruitment", "Recruit fighters in the territory. Unlocks recruitment drives.", 13, 1, [DIVS("infantry_division", 2), MOD("manpower_factor", 0.05, 1460)], pre=["forces"])
f("training_camps", "Training camps", "Camps train new recruits.", 15, 1, [MOD("training_time", -0.1, 1460), MOD("army_org", 0.02, 1460)], pre=["forces"])
f("mobile_columns", "Mobile columns", "Fast columns of light vehicles.", 11, 2, [DIVS("motorised_division", 1), MOD("army_attack", 0.03, 1460)], pre=["captured_arsenals"])
f("foreign_recruits", "Foreign recruits", "Recruits arrive from abroad.", 13, 2, [G.SPIRIT("foreign_recruits")], pre=["recruitment"])
f("officer_corps", "Former officers", "Experienced officers command the units.", 15, 2, [MOD("army_org", 0.03, 1460), MOD("army_attack", 0.02, 1460)], pre=["training_camps"])
f("artillery_units", "Artillery", "Captured guns and mortars form artillery units.", 11, 3, [GEAR("artillery", 60), RB("artillery_missiles", 0.15, 1)], pre=["mobile_columns"])
f("defend_the_cities", "Defend the cities", "Fortify the cities against offensives. Unlocks city defences.", 13, 3, [MOD("army_defence", 0.05, 1460)], pre=["foreign_recruits|officer_corps"])
f("explosives_workshops", "Explosives workshops", "Workshops make mines and explosives for defence.", 15, 3, [GEAR("support_equipment", 200), MOD("army_defence", 0.02, 1460)], pre=["officer_corps"])
f("drones", "Drones", "Small commercial drones for scouting and attack.", 12, 4, [DRONES(20), RB("air_drones", 0.2, 1)], pre=["artillery_units|defend_the_cities"], avail=AFTER("2016-01-01"))
f("adapt_to_air_campaign", "Adapt to the air campaign", "Disperse, hide vehicles and move at night. Coalition airstrikes began in Iraq on 8 August 2014 and in Syria on 22 September 2014.", 14, 4, [MOD("army_defence", 0.04, 1460), MOD("army_org", 0.02, 1460)], pre=["defend_the_cities|explosives_workshops"], avail=AFTER("2014-08-08"))
f("anti_aircraft", "Anti-aircraft guns", "Guns and missiles against helicopters and aircraft.", 16, 4, [GEAR("air_defence", 30)], pre=["explosives_workshops"])
f("elite_units", "Elite units", "Experienced units for the hardest fighting.", 13, 5, [DIVS("motorised_division", 1), MOD("army_attack", 0.02, 1460)], pre=["drones|adapt_to_air_campaign|anti_aircraft"])

# ---------------------------------------------------------------- strategy: consolidation or expansion (x 18-22)
f("strategy", "Strategy", "Hold what the group has or push on.", 20, 0, [PP(20)], pre=["proto_state|forces"], ai=4)
f("consolidation", "Consolidation", "Hold Mosul and Raqqa, fortify the territory and administer it.", 18, 1, [STAB(0.03), MOD("army_defence", 0.04, 1460)], pre=["strategy"], excl=["expansion"], ai=10)
f("defence_lines", "Defence lines", "Trenches, berms and minefields around the cities.", 18, 2, [MOD("army_defence", 0.05, 1460)], pre=["consolidation"])
f("hold_mosul", "Hold Mosul", "Mosul, taken between 4 and 10 June 2014, is the largest city the group holds.", 17, 3, [MOD("army_defence", 0.03, 1460), STAB(0.02)], pre=["defence_lines"], avail=AFTER("2014-06-10"))
f("hold_raqqa", "Hold Raqqa", "Raqqa, held since January 2014, is the seat of the administration.", 19, 3, [MOD("internal_security", 0.04, 1460), STAB(0.02)], pre=["defence_lines"])
f("besieged", "Under siege", "Prepare the cities for long sieges: stores, tunnels and shelters.", 18, 4, [G.SPIRIT("besieged"), GEAR("support_equipment", 150)], pre=["hold_mosul|hold_raqqa"], avail=AT_WAR)
f("expansion", "Expansion", "Push toward Baghdad and Damascus.", 21, 1, [LEAVE, WS(0.05), MOD("army_attack", 0.04, 1460)], pre=["strategy"], excl=["consolidation"], avail=ALT, ai=0)
f("claims_in_iraq", "Claims in Iraq", "Mark the next targets along the front.", 21, 2, [CLAIM(4)], pre=["expansion"], avail=ALT)
f("offensive_columns", "Offensive columns", "Columns for a new offensive.", 22, 3, [DIVS("motorised_division", 2)], pre=["claims_in_iraq"], avail=ALT)
f("claims_in_syria", "Claims in Syria", "Mark targets toward the west.", 20, 3, [CLAIM(4)], pre=["claims_in_iraq"], avail=ALT)
f("total_mobilisation", "Total mobilisation", "Every town sends men to the front.", 21, 4, [MOD("manpower_factor", 0.08, 1460), WS(0.05), UNREST(0.03)], pre=["offensive_columns|claims_in_syria"], avail=ALT)
f("open_new_fronts", "Open new fronts", "Attack where the enemy is weakest. Unlocks new fronts.", 21, 5, [MOD("army_attack", 0.04, 1460), PP(20)], pre=["total_mobilisation"], avail=ALT)
f("hold_the_line", "Hold the line", "Whatever the strategy, keep the front.", 19, 5, [MOD("army_defence", 0.03, 1460), MOD("army_org", 0.02, 1460)], pre=["besieged|open_new_fronts"])

# ---------------------------------------------------------------- provinces abroad (x 24-26)
f("provinces_abroad", "Provinces abroad", "Groups in other countries pledge allegiance and are named provinces of the group.", 25, 0, [MOD("foreign_influence_power", 0.05, 1460)], pre=["proto_state"], avail=AFTER("2014-06-10"), ai=3)
f("libya_province", "Libya Province", "Three branches in Libya were formed on 13 November 2014.", 24, 1, [MOD("foreign_influence_power", 0.03, 1460), PP(15)], pre=["provinces_abroad"], avail=AFTER("2014-11-13"))
f("sinai_province", "Sinai Province", "A group in the Sinai became a province of the group during 2014.", 26, 1, [MOD("foreign_influence_power", 0.03, 1460), PP(15)], pre=["provinces_abroad"])
f("khorasan_province", "Khorasan Province", "A province for Afghanistan and Pakistan was announced on 26 January 2015.", 24, 2, [MOD("foreign_influence_power", 0.03, 1460), MOD("manpower_factor", 0.02, 1460)], pre=["libya_province|sinai_province"], avail=AFTER("2015-01-26"))
f("greater_sahara", "The Greater Sahara", "A group in the Sahel, formed on 15 May 2015, joins the network.", 26, 2, [MOD("foreign_influence_power", 0.03, 1460)], pre=["libya_province|sinai_province"], avail=AFTER("2015-05-15"))
f("network_abroad", "A network abroad", "Couriers and money link the provinces abroad.", 25, 3, [MOD("intelligence_power", 0.04, 1460), TREAS(0.2)], pre=["khorasan_province|greater_sahara"])
f("outlast_the_centre", "Outlast the centre", "The provinces abroad keep the group alive if the centre falls.", 25, 4, [MOD("stability_factor", 0.02, 2920), PP(20)], pre=["network_abroad"])

# ---------------------------------------------------------------- after the caliphate (x 28-30)
f("after_the_caliphate", "After the caliphate", "Prepare for the loss of the cities: cells, hideouts and stores in the desert.", 29, 0, [MOD("internal_security", 0.03, 1460), PP(20)], pre=["forces"], avail=ANY(AFTER("2016-10-16"), {"stability_below": 0.3}), ai=3)
f("desert_hideouts", "Desert hideouts", "Hideouts and supply routes across the desert between Iraq and Syria.", 28, 1, [G.SPIRIT("desert_networks")], pre=["after_the_caliphate"])
f("go_underground", "Go underground", "Units break up into cells.", 30, 1, [G.SPIRIT("insurgency_mode"), G.REMOVE("besieged")], pre=["after_the_caliphate"])
f("hidden_stores", "Hidden stores", "Weapons and money stored in hiding places.", 28, 2, [EQUIP(400), TREAS(0.3)], pre=["desert_hideouts"])
f("courier_networks", "Courier networks", "Messages travel by courier, not phone.", 30, 2, [MOD("intelligence_power", 0.04, 1460), MOD("internal_security", 0.03, 1460)], pre=["go_underground"])
f("rural_cells", "Rural cells", "Small cells in the countryside of Iraq and Syria, an insurgency that began in 2017.", 29, 3, [DIVS("infantry_division", 1), MOD("army_defence", 0.03, 1460)], pre=["hidden_stores|courier_networks"], avail=AFTER("2017-01-01"))
f("recover", "Recover", "Rebuild the organisation from the cells.", 29, 4, [PP(30), MOD("manpower_factor", 0.03, 1460)], pre=["rural_cells"])
f("regroup_in_the_desert", "Regroup in the desert", "Larger units form again in the desert.", 29, 5, [DIVS("infantry_division", 1), G.REMOVE("insurgency_mode")], pre=["recover"], avail=ALT)

# ---------------------------------------------------------------- a surviving proto-state (alternative history, x 32-37)
SURV = ALL(ALT, HAS_FOCUS("isg_consolidation"), AFTER("2017-12-09"))
f("surviving_state", "A surviving state", "Alternative history: the group still holds its cities after the offensives of 2016 to 2019 and runs them as a state.", 34, 0, [LEAVE, G.SWAP("besieged", "entrenched_state"), PP(50)], pre=["consolidation"], avail=SURV, ai=0)
f("permanent_ministries", "Permanent ministries", "Offices become ministries with fixed budgets and staff.", 32, 1, [MOD("tax_efficiency", 0.05, 2920), PP(30)], pre=["surviving_state"], avail=ALT)
f("rebuild_the_cities", "Rebuild the cities", "Rebuild housing, roads and markets in the cities held.", 34, 1, [G.BUILD("infrastructure", 3), STAB(0.03)], pre=["surviving_state"], avail=ALT)
f("border_defences", "Border defences", "Fortified lines along the borders of the territory.", 36, 1, [MOD("army_defence", 0.06, 2920), G.BUILD("radar", 1)], pre=["surviving_state"], avail=ALT)
f("state_budget", "A state budget", "An annual budget with revenue and spending plans.", 32, 2, [TREAS(1), MOD("corruption", -0.03, 2920)], pre=["permanent_ministries"], avail=ALT)
f("factories", "Factories", "Reopen factories in the cities.", 34, 2, [G.BUILD("civilian_factory", 2)], pre=["rebuild_the_cities"], avail=ALT)
f("standing_army", "A standing army", "Units become a standing army with ranks and barracks.", 36, 2, [DIVS("infantry_division", 2), DIVS("motorised_division", 1), EQUIP(800)], pre=["border_defences"], avail=ALT)
f("oil_exports", "Oil exports", "Repair the oil fields and pipelines for steady exports.", 32, 3, [G.BUILD("refinery", 1), TREAS(0.8)], pre=["state_budget"], avail=ALT)
f("arms_factories", "Arms factories", "Produce weapons and ammunition at home.", 34, 3, [G.BUILD("military_factory", 2), RB("infantry", 0.2, 2)], pre=["factories|standing_army"], avail=ALT)
f("officer_academy", "An officer academy", "Train officers for the standing army.", 36, 3, [MOD("army_org", 0.04, 2920), RB("doctrine", 0.2, 1)], pre=["standing_army"], avail=ALT)
f("trade_routes", "Trade routes", "Trade with the neighbouring regions.", 32, 4, [MOD("trade_efficiency", 0.05, 2920), MOD("gdp_growth", 0.002, 2920)], pre=["oil_exports"], avail=ALT)
f("internal_consolidation", "Internal consolidation", "Fewer offices, clearer rules and a calmer territory.", 34, 4, [STAB(0.05), UNREST(-0.05)], pre=["arms_factories|trade_routes"], avail=ALT)
f("drone_programme", "A drone programme", "Build drones at home.", 36, 4, [DRONES(30), RB("air_drones", 0.25, 2)], pre=["officer_academy"], avail=ALT)
f("talks_with_neighbours", "Talks with neighbours", "Indirect talks on prisoners, water and trade. No state recognises the group.", 33, 5, [OPN("TUR", 5), OPN("SYR", 5), OPN("IRQ", 5), MOD("international_opinion", 0.03, 2920)], pre=["internal_consolidation"], avail=ALT)
f("entrenched", "An entrenched state", "The territory is run as a state behind fortified borders.", 35, 5, [STAB(0.05), PP(50), MOD("army_defence", 0.03, 2920)], pre=["internal_consolidation|drone_programme"], avail=ALT, days=140)

G.write("Islamic State", "The Islamic State while it holds territory: administration, revenue, forces, a consolidation or expansion strategy, provinces abroad, an insurgency branch for after 2017 and an alternative-history branch for a state that survives past 2019. Neutral and descriptive; the group's rise and fall is scripted in data/events/conflicts.json, and the counterfactual branches are for the player or off-history games only.",
        ["Islamic State", "Fall of Mosul", "Battle of Mosul (2016–2017)", "Raqqa campaign (2016–2017)", "Battle of Baghuz Fawqani", "Islamic State dinar", "American-led intervention in Iraq (2014–2021)", "American-led intervention in the Syrian civil war", "Operation Inherent Resolve", "Islamic State in Libya", "Islamic State – Sinai Province", "Islamic State – Khorasan Province", "Islamic State in the Greater Sahara", "Islamic State insurgency in Iraq (2017–present)"])
fix_countries("isg", ["ISG"])

# ====================================================================================== TALIBAN (AFG in 2000-2001, TAL 2001-2021)
write_spirits("tal", "The Taliban's national spirits (gameplay values). They go with the movement: from AFG to the TAL insurgency in December 2001 and back to AFG at the takeover (the hand_over effect).", [
    spirit("tal_leadership_council", "The Leadership Council", "The movement's leadership council, also called the Quetta Shura, directs it.", "strength", {"political_power_gain": 0.08, "stability_factor": 0.02}),
    spirit("tal_shadow_government", "Shadow government", "Shadow governors and courts work in the districts the movement controls or contests.", "policy", {"tax_efficiency": 0.05, "internal_security": 0.05}),
    spirit("tal_rural_networks", "Rural networks", "Support and recruits in the villages of the south and east.", "strength", {"manpower_factor": 0.05, "foreign_influence_resistance": 0.05}),
    spirit("tal_war_economy", "A war economy", "Levies on trade and farming, including the opium trade, fund the movement.", "policy", {"tax_efficiency": 0.04, "corruption": 0.02}),
    spirit("tal_negotiating_track", "The negotiating track", "Talks run alongside the fighting.", "policy", {"diplomatic_reputation": 0.05, "war_support_factor": -0.02}),
    spirit("tal_military_track", "The military track", "The movement seeks victory on the battlefield.", "policy", {"army_attack": 0.04, "war_support_factor": 0.03, "diplomatic_reputation": -0.03}),
])
write_decisions("tal", "TAL", "Taliban projects", [
    ("tal_recruitment_drive", "Recruitment drive", "Recruit in the villages.", "tal_rural_base", 40, [DIVS("infantry_division", 1)], None, 240),
    ("tal_spring_offensive", "Spring offensive", "A season of attacks on district centres.", "tal_spring_offensives", 40, [MOD("army_attack", 0.05, 180), WS(0.02)], AT_WAR, 365),
    ("tal_local_ceasefire", "Local ceasefire", "A ceasefire for a holiday or an exchange of prisoners.", "tal_talks", 20, [STAB(0.02), WS(-0.01)], None, 365),
])

L = Tree("tal", "TAL")
f = L.f
# ---------------------------------------------------------------- organisation (x 0-4)
f("movement", "The movement", "The Taliban emerged in 1994 and governed most of Afghanistan from 1996 until 2001.", 2, 0, [PP(30)], ai=6)
f("leadership_council", "The Leadership Council", "The movement's leadership council, kept since its first government in 1996, directs it.", 1, 1, [L.SPIRIT("leadership_council")], pre=["movement"])
f("rural_base", "A rural base", "Support in the villages of the south and east. Unlocks recruitment drives.", 3, 1, [L.SPIRIT("rural_networks"), IG("rural", 5)], pre=["movement"])
f("shadow_governors", "Shadow governors", "Governors for each province, alongside the official ones.", 0, 2, [L.SPIRIT("shadow_government")], pre=["leadership_council"], avail=EXISTS("TAL"))
f("religious_courts", "Courts", "The movement's own courts settle disputes in the districts.", 2, 2, [MOD("internal_security", 0.04, 1460), IG("religious_establishment", 5)], pre=["leadership_council|rural_base"])
f("levies", "Levies", "Levies on trade and farming, including the opium trade.", 4, 2, [L.SPIRIT("war_economy"), TREAS(0.3)], pre=["rural_base"])
f("regroup", "Regroup", "Rebuild the leadership and networks after losing power in 2001.", 1, 3, [PP(30), STAB(0.03)], pre=["shadow_governors|religious_courts"], avail=AFTER("2001-12-09"))
f("leadership_transition", "A leadership transition", "A new leader was chosen in July 2015, and the leadership changed again in May 2016.", 3, 3, [STAB(0.03), PP(20)], pre=["religious_courts|levies"], avail=AFTER("2015-07-01"))
f("poppy_ban_2000", "Ban the poppy", "A ban on opium poppy cultivation, as the Taliban government decreed in 2000.", 4, 3, [{"swap_spirit": {"from": "afg_opium_economy", "to": "afg_legal_economy"}}, IG("rural", -6)], pre=["levies|religious_courts"], avail=ALL(TAG("AFG"), {"has_spirit": "afg_opium_economy"}))
f("district_control", "District control", "Hold districts and run them.", 2, 4, [MOD("tax_efficiency", 0.04, 1460), STAB(0.02)], pre=["regroup|leadership_transition"])
f("commissions", "Commissions", "Commissions for the military, finance and other affairs.", 0, 4, [PP(30), MOD("corruption", -0.02, 1460)], pre=["regroup"])
f("border_sanctuaries", "Border regions", "Bases and supply routes in the border regions.", 4, 4, [MOD("army_defence", 0.03, 1460), MOD("manpower_factor", 0.02, 1460)], pre=["leadership_transition|levies"])

# ---------------------------------------------------------------- military (x 6-10)
f("fighters", "Fighters", "Organise the fighters.", 8, 0, [PP(20)], ai=5)
f("recruit", "Recruit fighters", "Recruit and train fighters.", 6, 1, [DIVS("infantry_division", 2)], pre=["fighters"])
f("weapons", "Weapons", "Acquire rifles, machine guns and rockets.", 8, 1, [EQUIP(600)], pre=["fighters"])
f("training", "Training", "Camps train fighters in small-unit tactics.", 10, 1, [MOD("training_time", -0.1, 1460), MOD("army_org", 0.02, 1460)], pre=["fighters"])
f("explosives", "Explosives", "Mines and explosives for defence and ambushes against military convoys.", 6, 2, [GEAR("support_equipment", 150), MOD("army_defence", 0.03, 1460)], pre=["recruit|weapons"])
f("spring_offensives", "Spring offensives", "Offensives against district centres each spring. Unlocks spring offensives.", 8, 2, [MOD("army_attack", 0.03, 1460), WS(0.03)], pre=["weapons|training"])
f("special_units", "Special units", "Trained units for the hardest fighting.", 10, 2, [DIVS("motorised_division", 1)], pre=["training"])
f("night_movement", "Move by night", "Move and attack at night to avoid aircraft.", 7, 3, [MOD("army_defence", 0.03, 1460), MOD("army_org", 0.02, 1460)], pre=["explosives|spring_offensives"], avail=AFTER("2001-10-07"))
f("captured_equipment", "Captured equipment", "Vehicles and weapons taken from army posts.", 9, 3, [EQUIP(400), GEAR("armoured_vehicle", 20)], pre=["spring_offensives|special_units"])
f("northern_front", "The northern front", "Push into the north against the United Front.", 10, 3, [MOD("army_attack", 0.02, 730), WS(0.03)], pre=["special_units"], avail=EXISTS("AFN"))
f("motorbike_columns", "Light columns", "Pick-ups and motorbikes for fast moves.", 8, 4, [DIVS("motorised_division", 1), MOD("army_attack", 0.02, 1460)], pre=["night_movement|captured_equipment|northern_front"])

# ---------------------------------------------------------------- diplomacy (x 12-15)
f("diplomacy", "Diplomacy", "Talk to the neighbours and the great powers.", 13, 0, [PP(20)], ai=4)
f("pakistan_ties", "Ties with Pakistan", "Relations with Pakistan across the border.", 12, 1, [OPN("PAK", 10)], pre=["diplomacy"])
f("qatar_office", "A political office", "A political office in Doha, Qatar, for contacts and talks.", 14, 1, [MOD("diplomatic_reputation", 0.04, 1460), OPN("QAT", 10)], pre=["diplomacy"], avail=EXISTS("TAL"))
f("regional_contacts", "Regional contacts", "Contacts with Iran, Russia and China.", 12, 2, [OPN("IRN", 5), OPN("RUS", 5), OPN("CHN", 5)], pre=["pakistan_ties|qatar_office"])
f("talks", "Talks", "Talks with the United States. Unlocks local ceasefires.", 14, 2, [L.SPIRIT("negotiating_track"), OPN("USA", 5)], pre=["qatar_office"])
f("prisoner_exchanges", "Prisoner exchanges", "Exchange prisoners as part of the talks.", 13, 3, [STAB(0.02), MOD("diplomatic_reputation", 0.02, 1460)], pre=["talks"])
f("doha_agreement", "The Doha Agreement", "An agreement with the United States, signed in Doha on 29 February 2020, on the withdrawal of foreign troops. The Afghan government was not a party.", 14, 4, [OPN("USA", 10), WS(0.05), PP(30)], pre=["prisoner_exchanges"], avail=AFTER("2020-02-29"), ai=10)
f("central_asian_contacts", "Central Asian contacts", "Contacts with Uzbekistan and Turkmenistan on trade and the border.", 12, 3, [OPN("UZB", 5), OPN("TKM", 5)], pre=["regional_contacts"])

# ---------------------------------------------------------------- strategy (x 17-19)
f("strategy", "Strategy", "Win by talks or by force.", 18, 0, [PP(20)], pre=["fighters|diplomacy"], ai=4)
f("negotiated_path", "A negotiated path", "Talks with the United States and the region, alongside the fighting.", 17, 1, [L.SPIRIT("negotiating_track"), STAB(0.02)], pre=["strategy"], excl=["military_path"], ai=10)
f("international_contacts", "International contacts", "Delegations travel abroad for talks.", 17, 2, [MOD("diplomatic_reputation", 0.04, 1460), OPN("QAT", 5)], pre=["negotiated_path"])
f("ceasefire_offers", "Ceasefire offers", "Short ceasefires for holidays and talks.", 17, 3, [STAB(0.02), UNREST(-0.02)], pre=["international_contacts"])
f("military_path", "A military path", "Seek victory on the battlefield.", 19, 1, [L.SPIRIT("military_track"), WS(0.05)], pre=["strategy"], excl=["negotiated_path"], ai=2)
f("all_out_offensives", "Offensives everywhere", "Attack on every front at once.", 19, 2, [MOD("army_attack", 0.04, 730), DIVS("infantry_division", 2)], pre=["military_path"])
f("encircle_the_cities", "Encircle the cities", "Take the roads around the provincial capitals.", 19, 3, [MOD("army_attack", 0.03, 730), CLAIM(4)], pre=["all_out_offensives"], avail=ALT)

# ---------------------------------------------------------------- the takeover (x 21-23)
f("takeover", "Toward Kabul", "Prepare to take the country.", 22, 0, [PP(20)], pre=["strategy"], avail=ANY(AFTER("2021-05-01"), ALT), ai=3)
f("offensive_2021", "The offensive", "An offensive across the country. The real one began on 1 May 2021 as foreign troops withdrew.", 21, 1, [MOD("army_attack", 0.04, 365), WS(0.05)], pre=["takeover"])
f("district_surrenders", "District surrenders", "Talks with local officials for the handover of districts.", 23, 1, [STAB(0.02), MOD("army_attack", 0.02, 365)], pre=["takeover"])
f("provincial_capitals", "The provincial capitals", "Take the provincial capitals.", 22, 2, [DIVS("infantry_division", 2), WS(0.03)], pre=["offensive_2021|district_surrenders"])
f("kabul", "Kabul", "Enter Kabul. The Taliban took Kabul on 15 August 2021.", 22, 3, [PP(40), STAB(0.03)], pre=["provincial_capitals"], avail=ANY(AFTER("2021-08-15"), ALL(ALT, HOLDS_KABUL)))
WON = ALL(ALT, ANY(ALL(TAG("TAL"), HOLDS_KABUL), ALL(TAG("AFG"), HOLDS_KABUL, NOT(EXISTS("AFN")))))
PROCLAIM = [
    {"set_global_flag": "iea_formed"},
    {"if": {"limit": TAG("TAL"), "then": [{"hand_over": {"to": "AFG"}}, {"end_armed_group": {"group": "TAL", "into": "AFG", "disband_army_of": "AFG"}}]}},
    {"country": {"tag": "AFG", "effects": [
        {"if": {"limit": NOT({"ruling_party": "afg.taliban"}), "then": [{"install_government": {"party": "afg.taliban", "government_type": "theocracy"}}]}},
        {"set_country_name": {"name": IEA_NAME, "flag": "x-taliban"}},
        {"set_focus_tree": {"tree": "iea"}},
        LEAVE,
    ]}},
]
f("proclaim_emirate", "Proclaim the Islamic Emirate of Afghanistan", "Alternative history: with the war won and Kabul held, the movement proclaims the Islamic Emirate of Afghanistan and takes over the state. Afghanistan is renamed and gets the Islamic Emirate's focus tree.", 22, 4, PROCLAIM, pre=["kabul|encircle_the_cities|movement"], avail=ALL(WON, NOT({"has_global_flag": "iea_formed"})), ai=0, days=35)

L.write("Taliban", "The Taliban from 2000 to 2021: the movement's organisation, its forces, diplomacy, a negotiated or military strategy and the takeover. Afghanistan uses it while the Taliban govern it (2000-2001, start_focus_tree in data/world/countries.json) and the TAL insurgency from December 2001 (hand_over). It ends with \"Proclaim the Islamic Emirate of Afghanistan\", which a player (or an off-history game) can take once the war is won; on the historical path the takeover of 15 August 2021 is scripted in data/events/conflicts.json.",
        ["Taliban", "Islamic Emirate of Afghanistan", "Leadership Council of the Islamic Emirate of Afghanistan", "Doha Agreement (2020)", "2021 Taliban offensive", "Fall of Kabul (2021)", "2001 United States invasion of Afghanistan", "Northern Alliance", "Opium production in Afghanistan"])
fix_countries("tal", ["TAL", "AFG"])

# ====================================================================================== ISLAMIC EMIRATE OF AFGHANISTAN (AFG after the takeover)
write_spirits("iea", "Spirits of the Islamic Emirate of Afghanistan (AFG after the Taliban takeover; gameplay values).", [
    spirit("iea_unrecognised", "An unrecognised government", "Few states recognise the government, which limits trade, credit and aid.", "problem", {"trade_efficiency": -0.06, "foreign_investment": -0.1, "diplomatic_reputation": -0.05}),
    spirit("iea_caretaker_government", "A caretaker government", "Acting ministers run the ministries.", "policy", {"political_power_gain": 0.05, "stability_factor": 0.02, "tax_efficiency": -0.03}),
    spirit("iea_central_revenue", "Central revenue", "Customs and taxes are collected centrally.", "strength", {"tax_efficiency": 0.06, "corruption": -0.03}),
    spirit("iea_poppy_ban", "Poppy ban", "Opium poppy cultivation is banned.", "policy", {"corruption": -0.03, "gdp_growth": -0.002}),
    spirit("iea_water_projects", "Water projects", "Canals and dams bring new land under irrigation.", "strength", {"gdp_growth": 0.002, "stability_factor": 0.01}),
    spirit("iea_regional_opening", "Opening to the region", "Trade and transit deals with the neighbours.", "policy", {"trade_efficiency": 0.05, "foreign_influence_resistance": -0.03}),
    spirit("iea_self_reliance", "Self-reliance", "The economy is run with little outside involvement.", "policy", {"foreign_influence_resistance": 0.08, "trade_efficiency": -0.03, "stability_factor": 0.01}),
    spirit("iea_mining_drive", "Mining drive", "Contracts for copper, iron and coal.", "policy", {"gdp_growth": 0.002, "foreign_investment": 0.04}),
    spirit("iea_national_army", "A national army", "The movement's fighters and captured equipment form a national army.", "strength", {"army_org": 0.04, "internal_security": 0.05}),
])
write_decisions("iea", "AFG", "Islamic Emirate projects", [
    ("iea_customs_drive", "Customs drive", "Collect customs at the border crossings.", "iea_customs", 20, [TREAS(0.2)], None, 180),
    ("iea_canal_works", "Canal works", "Another stretch of canal for the farmers of the north.", "iea_qosh_tepa_canal", 30, [TREAS(-0.2), MOD("gdp_growth", 0.002, 1460), IG("rural", 3)], CASH(0.2), 365),
    ("iea_trade_mission", "Trade mission", "A delegation to a neighbour to sign trade deals.", "iea_regional_trade", 25, [MOD("trade_efficiency", 0.02, 730)], None, 365),
])

E = Tree("iea", "AFG")
f = E.f
# ---------------------------------------------------------------- the state (x 0-4)
f("the_emirate", "The Emirate", "Run the Islamic Emirate of Afghanistan.", 2, 0, [PP(40), E.SPIRIT("caretaker_government")], ai=6)
f("caretaker_cabinet", "The caretaker cabinet", "Acting ministers take over the ministries. The real caretaker government was announced on 7 September 2021.", 0, 1, [PP(30), STAB(0.03)], pre=["the_emirate"])
f("leadership_council", "The Leadership Council", "The leadership council advises the supreme leader.", 2, 1, [STAB(0.02), IG("religious_establishment", 5)], pre=["the_emirate"])
f("provincial_governors", "Provincial governors", "Governors and police chiefs for every province.", 4, 1, [MOD("internal_security", 0.04, 2920), STAB(0.02)], pre=["the_emirate"])
f("ministries", "The ministries", "The ministries resume work with their civil servants.", 0, 2, [MOD("tax_efficiency", 0.03, 2920), PP(20)], pre=["caretaker_cabinet"])
f("courts", "Courts", "Courts across the provinces.", 2, 2, [MOD("internal_security", 0.04, 2920), IG("religious_establishment", 4)], pre=["leadership_council"])
f("district_administration", "District administration", "Officials for every district.", 4, 2, [STAB(0.02), UNREST(-0.02)], pre=["provincial_governors"])
f("civil_service", "The civil service", "Pay and rules for the civil service.", 0, 3, [MOD("corruption", -0.03, 2920), {"set_budget": {"spending": 0.5}}], pre=["ministries"])
f("customs", "Customs", "Customs at the border crossings. Unlocks customs drives.", 1, 3, [MOD("tax_efficiency", 0.04, 2920), TREAS(0.3)], pre=["ministries|courts"])
f("central_revenue", "Central revenue", "All revenue goes to the treasury in Kabul.", 2, 4, [E.SPIRIT("central_revenue")], pre=["customs"])
f("permanent_cabinet", "Permanent ministers", "Acting ministers become ministers.", 0, 4, [E.REMOVE("caretaker_government"), PP(40), STAB(0.03)], pre=["civil_service"])
f("police", "Police", "A police force for the cities and highways.", 4, 3, [MOD("internal_security", 0.05, 2920), IG("security_services", 4)], pre=["district_administration"])
f("census", "Registers", "Registers of land and residents.", 3, 3, [PP(20), MOD("tax_efficiency", 0.02, 2920)], pre=["district_administration|courts"])
f("national_ids", "Identity cards", "Electronic identity cards for residents.", 4, 4, [E.BUILD("data_centre", 1), MOD("internal_security", 0.02, 2920)], pre=["police|census"])
f("a_settled_state", "A settled state", "The state's institutions settle into routine.", 2, 5, [STAB(0.05), PP(40)], pre=["central_revenue|permanent_cabinet|national_ids"], days=105)

# ---------------------------------------------------------------- the economy (x 6-11)
f("economy", "An economy without aid", "Run the economy with little foreign aid.", 8, 0, [PP(20), MOD("tax_efficiency", 0.03, 2920)], ai=5)
f("poppy_ban", "Ban the poppy", "Ban opium poppy cultivation, as the Taliban also did in 2000.", 6, 1, [{"swap_spirit": {"from": "afg_opium_economy", "to": "iea_poppy_ban"}}, IG("rural", -6)], pre=["economy"], days=105)
f("irrigation", "Irrigation", "Repair canals and build new ones.", 8, 1, [IG("rural", 4), MOD("gdp_growth", 0.001, 2920)], pre=["economy"])
f("mines", "Mines", "Survey and contract the mineral deposits.", 10, 1, [E.SPIRIT("mining_drive")], pre=["economy"])
f("alternative_crops", "Alternative crops", "Seed and credit for wheat, fruit and cotton.", 6, 2, [IG("rural", 4), MOD("gdp_growth", 0.001, 2920)], pre=["poppy_ban"])
f("qosh_tepa_canal", "The Qosh Tepa Canal", "A 285 km canal from the Amu Darya through Balkh, Jowzjan and Faryab. Construction began in early 2022. Unlocks canal works.", 8, 2, [E.SPIRIT("water_projects"), E.BUILD("infrastructure", 1, BALKH), TREAS(-0.5)], pre=["irrigation"], avail=AFTER("2022-01-01"), days=140)
f("copper", "Copper", "Mes Aynak, the country's largest known copper deposit.", 10, 2, [E.BUILD("civilian_factory", 1), TREAS(0.4), OPN("CHN", 5)], pre=["mines"])
f("coal_exports", "Coal exports", "Export coal to the neighbours.", 11, 2, [TREAS(0.5), MOD("fossil_output", 0.05, 2920)], pre=["mines"])
f("dams", "Dams", "Dams for power and irrigation.", 7, 3, [E.BUILD("renewable_plant", 1), IG("rural", 3)], pre=["alternative_crops|qosh_tepa_canal"])
f("power_imports", "Power from the north", "Buy power from Central Asia over the existing lines.", 9, 3, [MOD("energy_cost", -0.04, 2920)], pre=["qosh_tepa_canal|copper"])
f("ring_road", "The ring road", "Repair the ring road between the cities.", 11, 3, [E.BUILD("infrastructure", 3), TREAS(-0.5)], pre=["coal_exports|copper"], avail=CASH(0.5))
f("tapi_pipeline", "The gas pipeline", "The Turkmenistan-Afghanistan-Pakistan-India pipeline, finished on the Turkmen side in 2024, extends into Herat.", 9, 4, [E.BUILD("infrastructure", 1, HERAT), OPN("TKM", 10), TREAS(0.3)], pre=["power_imports"], avail=AFTER("2024-01-01"))
f("light_industry", "Light industry", "Workshops and factories in Kabul and Herat.", 7, 4, [E.BUILD("civilian_factory", 1, KABUL), E.BUILD("civilian_factory", 1, HERAT)], pre=["dams|power_imports"])
f("railways", "Railways", "Rail links to Uzbekistan and Turkmenistan.", 11, 4, [E.BUILD("infrastructure", 2), MOD("trade_efficiency", 0.03, 2920)], pre=["ring_road"])
f("a_working_economy", "A working economy", "Revenue, farms and trade keep the economy running.", 9, 5, [MOD("gdp_growth", 0.002, 2920), STAB(0.03)], pre=["tapi_pipeline|light_industry|railways"], days=105)

# ---------------------------------------------------------------- the army (x 13-16)
f("army", "The army", "Turn the movement's fighters into a national army.", 14, 0, [PP(20)], ai=5)
f("captured_equipment", "Captured equipment", "Equipment left by the former army.", 13, 1, [EQUIP(1500), GEAR("armoured_vehicle", 60), GEAR("artillery", 40)], pre=["army"])
f("army_corps", "Army corps", "Corps for each region of the country.", 15, 1, [E.SPIRIT("national_army"), DIVS("infantry_division", 2)], pre=["army"])
f("repair_depots", "Repair depots", "Repair captured vehicles and aircraft.", 13, 2, [E.BUILD("military_factory", 1)], pre=["captured_equipment"])
f("border_forces", "Border forces", "Border guards for the long borders.", 15, 2, [MOD("army_defence", 0.04, 2920), DIVS("infantry_division", 1)], pre=["army_corps"])
f("air_wing", "An air wing", "Fly the helicopters and aircraft left behind.", 13, 3, [E.BUILD("air_base", 1), RB("air_drones", 0.2, 1)], pre=["repair_depots"])
f("mechanised_units", "Mechanised units", "Units with the captured armoured vehicles.", 14, 3, [DIVS("motorised_division", 1)], pre=["repair_depots|border_forces"])
f("internal_security", "Internal security", "Units against armed opponents inside the country.", 16, 3, [MOD("internal_security", 0.05, 2920), UNREST(-0.03)], pre=["border_forces"])
f("military_academy", "A military academy", "Train officers.", 14, 4, [MOD("army_org", 0.04, 2920), RB("doctrine", 0.2, 1)], pre=["air_wing|mechanised_units|internal_security"])
f("drones", "Drones", "Buy and build drones.", 13, 5, [{"add_equipment": {"family": "combat_drone", "amount": 15}}, RB("air_drones", 0.2, 1)], pre=["military_academy"], avail=AFTER("2023-01-01"))
f("conscription_registers", "Recruitment", "Regular recruitment for the army.", 15, 5, [MOD("manpower_factor", 0.04, 2920)], pre=["military_academy"])

# ---------------------------------------------------------------- foreign relations (x 18-22)
f("foreign_relations", "Foreign relations", "Seek relations with the world. The government is widely unrecognised.", 20, 0, [PP(20), E.SPIRIT("unrecognised")], ai=5)
f("pakistan", "Pakistan", "Trade and the border with Pakistan.", 18, 1, [OPN("PAK", 10), MOD("trade_efficiency", 0.02, 2920)], pre=["foreign_relations"])
f("china", "China", "Mining and trade with China.", 20, 1, [OPN("CHN", 10), MOD("foreign_investment", 0.03, 2920)], pre=["foreign_relations"])
f("qatar", "Qatar", "Contacts through Doha.", 22, 1, [OPN("QAT", 10), MOD("diplomatic_reputation", 0.02, 2920)], pre=["foreign_relations"])
f("iran", "Iran", "Trade and water on the western border.", 18, 2, [OPN("IRN", 10)], pre=["pakistan"])
f("central_asia", "Central Asia", "Power, rail and trade with Uzbekistan, Turkmenistan and Tajikistan.", 20, 2, [OPN("UZB", 10), OPN("TKM", 10), OPN("TJK", 5)], pre=["china|pakistan"])
f("russia", "Russia", "Relations with Russia. In July 2025 Russia became the first country to recognise the Islamic Emirate.", 22, 2, [OPN("RUS", 15), MOD("diplomatic_reputation", 0.02, 2920)], pre=["qatar|china"])
f("embassies", "Embassies", "Send diplomats to the embassies abroad.", 19, 3, [MOD("diplomatic_reputation", 0.03, 2920)], pre=["iran|central_asia"])
f("first_recognition", "First recognition", "Recognition by a first state.", 22, 3, [E.REMOVE("unrecognised"), MOD("trade_efficiency", -0.02, 2920), PP(30)], pre=["russia"], avail=AFTER("2025-07-01"), ai=10)
f("regional_trade", "Regional trade", "Trade and transit deals with the region. Unlocks trade missions.", 20, 4, [MOD("trade_efficiency", 0.03, 2920)], pre=["embassies|first_recognition"])
f("un_seat", "Seek the UN seat", "Ask for the country's seat at the United Nations.", 22, 4, [MOD("diplomatic_reputation", 0.03, 2920)], pre=["first_recognition|embassies"])
f("wider_recognition", "Wider recognition", "Alternative history: more states recognise the government.", 21, 5, [MOD("foreign_investment", 0.05, 2920), MOD("trade_efficiency", 0.03, 2920), OPN("USA", 5)], pre=["un_seat|regional_trade"], avail=ALT, ai=0)

# ---------------------------------------------------------------- society (x 24-27)
f("society", "Society", "Schools, health and religious institutions.", 25, 0, [PP(20)], ai=4)
f("madrasas", "Religious schools", "Religious schools in every province.", 24, 1, [IG("religious_establishment", 5), MOD("education_quality", 0.01, 2920)], pre=["society"])
f("clinics", "Clinics", "Keep the clinics and hospitals open.", 26, 1, [MOD("health_outcomes", 0.03, 2920), TREAS(-0.2)], pre=["society"])
f("mosques_and_endowments", "Religious endowments", "A ministry runs the mosques and endowments.", 24, 2, [IG("religious_establishment", 4), STAB(0.02)], pre=["madrasas"])
f("returnees", "Returnees", "Land and shelter for refugees who return from Pakistan and Iran.", 26, 2, [STAB(0.02), MOD("population_growth", 0.001, 2920)], pre=["clinics"])
f("universities", "Universities", "Keep the universities running.", 25, 3, [MOD("education_quality", 0.02, 2920), RB("economy_digital", 0.1, 1)], pre=["mosques_and_endowments|returnees"])
f("drought_relief", "Drought relief", "Food stores and wells for dry years.", 27, 3, [STAB(0.02), IG("rural", 3)], pre=["returnees"])
f("vaccination", "Vaccination", "Vaccination campaigns with the international agencies.", 26, 4, [MOD("health_outcomes", 0.02, 2920)], pre=["universities|drought_relief"])
f("mobile_networks", "Mobile networks", "Mobile and internet coverage.", 24, 4, [E.BUILD("data_centre", 1), RB("economy_digital", 0.15, 1)], pre=["universities"])
f("social_order", "Social order", "The state settles into the society it governs.", 25, 5, [STAB(0.04), UNREST(-0.04)], pre=["vaccination|mobile_networks"], days=105)

# ---------------------------------------------------------------- strategic choices (x 29-32)
f("direction", "Direction", "How the Emirate deals with the world and its economy.", 30, 0, [PP(20)], pre=["the_emirate"], ai=4)
f("open_to_region", "Open to the region", "Trade, transit and mining deals with the neighbours.", 29, 1, [E.SPIRIT("regional_opening"), OPN("UZB", 5), OPN("CHN", 5)], pre=["direction"], excl=["self_reliance"], ai=10)
f("transit_hub", "A transit hub", "Roads and rail for transit between Central and South Asia.", 29, 2, [E.BUILD("infrastructure", 2), MOD("trade_efficiency", 0.03, 2920)], pre=["open_to_region"])
f("foreign_contracts", "Foreign contracts", "Contracts with foreign companies for mines and power.", 29, 3, [MOD("foreign_investment", 0.05, 2920), E.BUILD("civilian_factory", 1)], pre=["transit_hub"])
f("self_reliance", "Self-reliance", "Run the economy with little outside involvement.", 31, 1, [E.SPIRIT("self_reliance"), STAB(0.02)], pre=["direction"], excl=["open_to_region"], ai=3)
f("local_production", "Local production", "Workshops make what imports used to supply.", 31, 2, [E.BUILD("civilian_factory", 1), MOD("production_efficiency", 0.03, 2920)], pre=["self_reliance"])
f("state_projects", "State projects", "The state builds roads and canals with its own revenue.", 31, 3, [E.BUILD("infrastructure", 2), TREAS(-0.4)], pre=["local_production"], avail=CASH(0.4))
f("long_term_plan", "A long-term plan", "A plan for the next decade.", 30, 4, [PP(40), MOD("gdp_growth", 0.002, 3650)], pre=["foreign_contracts|state_projects"], days=105)

E.write(IEA_NAME, "The Islamic Emirate of Afghanistan: AFG switches to this tree when the Taliban take over (15 August 2021 in data/events/conflicts.json, or earlier through the Taliban tree's last focus). No end date. Branches for the state, the economy without aid, the army, foreign relations, society and two exclusive directions; neutral and descriptive.",
        ["Islamic Emirate of Afghanistan", "Fall of Kabul (2021)", "Leadership Council of the Islamic Emirate of Afghanistan", "Qosh Tepa Canal", "Mes Aynak", "Turkmenistan–Afghanistan–Pakistan–India Pipeline", "Afghanistan–Russia relations", "Opium production in Afghanistan"])
fix_countries("iea", ["AFG"], switched=True)
