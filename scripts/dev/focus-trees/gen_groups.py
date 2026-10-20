"""Small trees for the armed groups that became playable on 20 October 2026: Hamas (HAM), Hezbollah (HEZ), the Syrian
opposition (SYO), the Syrian Democratic Forces (SDF) and the Donetsk and Luhansk People's Republics (DPR, LPR).
Run from the repo root:  python -I -X utf8 scripts/dev/focus-trees/gen_groups.py

Same rules as gen_isg_tal.py: neutral and descriptive, no real people, no violence against civilians as gameplay, no
focus that declares war or moves provinces. Relations named in focuses come from the groups' Wikipedia articles
(fetched 20 October 2026, listed in each tree's sources). Counterfactual focuses are gated with ALT (ai_weight 0).
"""
import json
import sys; sys.path.insert(0, __file__.replace("\\", "/").rsplit("/", 1)[0])
from treelib import *

AT_WAR = {"at_war": True}
CLAIM = lambda n: {"claim_rival_border": {"count": n}}
GEAR = lambda fam, n: {"add_equipment": {"family": fam, "amount": n}}


def group_tree(p, tag, name, note, sources, s):
    """s: a spec with the group's own wording; every group gets organisation, forces, relations and a strategy choice."""
    T = Tree(p, tag)
    f = T.f
    write_spirits(p, f"{name}: national spirits (gameplay values).", [
        spirit(f"{p}_organised_movement", s["spirit_name"], s["spirit_desc"], "strength", {"political_power_gain": 0.06, "internal_security": 0.05}),
        spirit(f"{p}_entrenched", "Entrenched positions", "Fortified positions across the territory held.", "strength", {"army_defence": 0.06}),
        spirit(f"{p}_external_support", "External support", "Money, arms and training from outside backers.", "policy", {"production_efficiency": 0.04, "foreign_influence_resistance": -0.05}),
        spirit(f"{p}_negotiating", "Talks", "The leadership pursues talks alongside the fighting.", "policy", {"diplomatic_reputation": 0.05, "war_support_factor": -0.02}),
    ])
    write_decisions(p, tag, f"{name} projects", [
        (f"{p}_recruitment_drive", "Recruitment drive", "Recruit in the territory held.", f"{p}_recruitment", 40, [DIVS("infantry_division", 1)], AT_WAR, 730),
        (f"{p}_fortify", "Fortify a sector", "Dig in on a threatened sector.", f"{p}_defensive_positions", 30, [MOD("army_defence", 0.04, 365)], AT_WAR, 240),
    ])
    # ---- organisation (x 0-4)
    f("movement", s["root"], s["root_desc"], 2, 0, [PP(30), T.SPIRIT("organised_movement")], ai=6)
    f("leadership", "Leadership", s["leadership_desc"], 0, 1, [PP(30), STAB(0.03)], pre=["movement"])
    f("administration", "Administration", s["admin_desc"], 2, 1, [MOD("tax_efficiency", 0.05, 1460), STAB(0.02)], pre=["movement"])
    f("recruitment", "Recruitment", "Recruit and train members. Unlocks recruitment drives.", 4, 1, [DIVS("infantry_division", 2), MOD("manpower_factor", 0.04, 1460)], pre=["movement"])
    f("services", "Services", s["services_desc"], 1, 2, [STAB(0.02), UNREST(-0.03)], pre=["leadership|administration"])
    f("revenue", "Revenue", s["revenue_desc"], 3, 2, [TREAS(0.4), MOD("tax_efficiency", 0.03, 1460)], pre=["administration|recruitment"])
    f("internal_security", "Internal security", "A security service for the territory held.", 2, 3, [MOD("internal_security", 0.05, 1460)], pre=["services|revenue"])
    f(s["special_id"], s["special_name"], s["special_desc"], 2, 4, s["special_fx"], pre=["internal_security"], avail=s.get("special_avail"))
    # ---- forces (x 6-10)
    f("forces", "Forces", "Organise the fighters into units.", 8, 0, [PP(20), MOD("army_org", 0.02, 1460)], ai=5)
    f("training", "Training", "Training for officers and units.", 6, 1, [MOD("training_time", -0.1, 1460), MOD("army_org", 0.02, 1460)], pre=["forces"])
    f("weapons", "Weapons", "Rifles, machine guns and ammunition.", 8, 1, [EQUIP(600)], pre=["forces"])
    f("anti_armour", "Anti-armour weapons", "Anti-tank weapons against armoured attacks.", 10, 1, [GEAR("anti_tank_weapons", 80), MOD("army_defence", 0.02, 1460)], pre=["forces"])
    f("defensive_positions", "Defensive positions", "Fortify the front. Unlocks fortifications.", 7, 2, [T.SPIRIT("entrenched")], pre=["training|weapons"])
    f("workshops", "Workshops", "Workshops repair and produce equipment.", 9, 2, [T.BUILD("military_factory", 1)], pre=["weapons|anti_armour"])
    f("drones", "Drones", "Drones for scouting.", 10, 2, [GEAR("combat_drone", 10), RB("air_drones", 0.15, 1)], pre=["anti_armour"], avail=AFTER("2014-01-01"))
    f("mobile_units", "Mobile units", "Units on light vehicles.", 8, 3, [DIVS("motorised_division", 1)], pre=["defensive_positions|workshops|drones"])
    f("hold_the_line", "Hold the line", "Defend every position.", 8, 4, [MOD("army_defence", 0.04, 1460), WS(0.03)], pre=["mobile_units"])
    # ---- relations (x 12-15)
    f("relations", "Relations", s["relations_desc"], 13, 0, [PP(20)], ai=4)
    for i, (rid, rname, rdesc, rfx) in enumerate(s["relations"]):
        f(rid, rname, rdesc, 12 + i, 1, rfx, pre=["relations"])
    f("external_support", "External support", "Money, arms and training from backers.", 13, 2, [T.SPIRIT("external_support"), EQUIP(400)], pre=["|".join(r[0] for r in s["relations"])])
    f("talks", s["talks_name"], s["talks_desc"], 13, 3, [T.SPIRIT("negotiating"), STAB(0.02)], pre=["external_support"], avail=s.get("talks_avail"))
    # ---- strategy (x 17-18)
    f("strategy", "Strategy", "Defend what is held, or push on.", 17, 0, [PP(20)], pre=["movement|forces"], ai=4)
    f("defend", s["defend_name"], s["defend_desc"], 17, 1, [MOD("army_defence", 0.05, 1460), STAB(0.03)], pre=["strategy"], excl=["advance"], ai=10)
    f("advance", "Advance", "Alternative history: go on the offensive to take more ground.", 18, 1, [LEAVE, CLAIM(3), MOD("army_attack", 0.04, 1460), WS(0.05)], pre=["strategy"], excl=["defend"], avail=ALT, ai=0)
    f("consolidate", "Consolidate", "Make the territory held work as a whole.", 17, 2, [T.BUILD("infrastructure", 1), STAB(0.03)], pre=["defend|advance"])
    f(s["end_id"], s["end_name"], s["end_desc"], 17, 3, [LEAVE, PP(50), STAB(0.05), MOD("diplomatic_reputation", 0.05, 2920)], pre=["consolidate"], avail=ALT, ai=0, days=140)
    T.write(name, note, sources, accessed="2026-10-20")


group_tree("ham", "HAM", "Hamas", "Hamas while it holds Gaza (from June 2007 in data/events/conflicts.json): organisation, forces, relations and a strategy choice. Neutral and descriptive; the wars are scripted in the conflict events.",
    ["Hamas", "Hamas Political Bureau", "Gaza Strip"], dict(
    root="The movement", root_desc="Hamas governs the Gaza Strip from June 2007.", spirit_name="An organised movement", spirit_desc="A political bureau, a consultative council and an armed wing.",
    leadership_desc="The Political Bureau and the consultative council lead the movement.", admin_desc="Ministries run Gaza's services and collect revenue.",
    services_desc="Keep schools, clinics and water running in Gaza.", revenue_desc="Taxes and fees in Gaza.",
    special_id="charter_2017", special_name="The 2017 charter", special_desc="A new charter in 2017 supported a Palestinian state within the 1967 borders, without recognising Israel.", special_fx=[MOD("diplomatic_reputation", 0.03, 2920), PP(20)], special_avail=AFTER("2017-01-01"),
    relations_desc="Hamas has historically sought relations with Egypt, Iran, Qatar, Saudi Arabia, Syria and Turkey.",
    relations=[("egypt", "Egypt", "Relations with Egypt, Gaza's southern neighbour.", [OPN("EGY", 10)]), ("qatar", "Qatar", "Relations with Qatar.", [OPN("QAT", 10), TREAS(0.2)]),
               ("iran", "Iran", "Relations with Iran.", [OPN("IRN", 10)]), ("turkey", "Turkey", "Relations with Turkey.", [OPN("TUR", 10)])],
    talks_name="Ceasefire talks", talks_desc="Indirect talks on ceasefires through mediators.", defend_name="Hold Gaza", defend_desc="Defend the Gaza Strip.",
    end_id="recognised_government", end_name="A recognised administration", end_desc="Alternative history: other states deal with the Gaza administration directly."))

group_tree("hez", "HEZ", "Hezbollah", "Hezbollah while it holds South Lebanon in the game (the wars of 2006, 2023-24 and 2026 in data/events/conflicts.json). Neutral and descriptive.",
    ["Hezbollah", "Secretary-General of Hezbollah", "2006 Lebanon War"], dict(
    root="The movement", root_desc="Hezbollah, founded in 1982, holds South Lebanon in the game's wars.", spirit_name="An organised movement", spirit_desc="A secretary-general, a council and an armed wing.",
    leadership_desc="The Secretary-General and the council lead the movement.", admin_desc="Services and offices in the areas it holds.",
    services_desc="Schools, clinics and welfare in the south.", revenue_desc="Revenue from members and supporters.",
    special_id="lebanese_politics", special_name="Lebanese politics", special_desc="Work with allies in Lebanon's political system.", special_fx=[OPN("LBN", 10), STAB(0.02)],
    relations_desc="Hezbollah was founded in close cooperation with Iran and has strong ties with it.",
    relations=[("iran", "Iran", "Ties with Iran.", [OPN("IRN", 15)]), ("syria", "Syria", "Relations with Syria.", [OPN("SYR", 10)])],
    talks_name="Ceasefire talks", talks_desc="Indirect talks on ceasefires through mediators.", defend_name="Hold the south", defend_desc="Defend South Lebanon.",
    end_id="recognised_role", end_name="A recognised role", end_desc="Alternative history: a settlement recognises the movement's role in the south."))

group_tree("syo", "SYO", "Syrian opposition", "The Syrian opposition while it holds land (July 2012 to December 2024 in data/events/conflicts.json). Neutral and descriptive.",
    ["Syrian opposition", "National Coalition of Syrian Revolution and Opposition Forces", "Syrian National Council"], dict(
    root="The opposition", root_desc="Opposition councils and armed groups hold territory in the north from 2012.", spirit_name="Opposition councils", spirit_desc="Local councils and a national coalition.",
    leadership_desc="The National Coalition, founded in November 2012, represents the opposition abroad.", admin_desc="Local councils run the towns.",
    services_desc="Keep bakeries, clinics and schools open.", revenue_desc="Revenue from trade and aid.",
    special_id="interim_government", special_name="An interim government", special_desc="An interim government for the areas held.", special_fx=[PP(30), STAB(0.03)], special_avail=AFTER("2012-11-11"),
    relations_desc="The Syrian National Council was recognised or supported by at least 17 UN member states, including France, the United Kingdom and the United States.",
    relations=[("turkey", "Turkey", "Relations with Turkey; opposition conferences met in Antalya and Istanbul.", [OPN("TUR", 10)]), ("france_uk", "France and the United Kingdom", "Support from France and the United Kingdom.", [OPN("FRA", 5), OPN("GBR", 5)]),
               ("united_states", "The United States", "Support from the United States.", [OPN("USA", 10)])],
    talks_name="Peace talks", talks_desc="Talks on a political transition.", defend_name="Hold the north", defend_desc="Defend the territory held in the north.",
    end_id="transition", end_name="A political transition", end_desc="Alternative history: talks lead to a transition in which the opposition shares power."))

group_tree("sdf", "SDF", "Syrian Democratic Forces", "The Syrian Democratic Forces while they hold land (October 2015 to August 2026 in data/events/conflicts.json). Neutral and descriptive.",
    ["Syrian Democratic Forces"], dict(
    root="The alliance", root_desc="The SDF, formed on 10 October 2015, is an alliance of Kurdish, Arab and Assyrian/Syriac forces.", spirit_name="A multi-ethnic alliance", spirit_desc="Kurdish, Arab and Assyrian/Syriac forces under one command.",
    leadership_desc="The general command leads the alliance.", admin_desc="Councils run the towns of the north-east.",
    services_desc="Keep water, power and schools running.", revenue_desc="Revenue from trade and the oil fields of the north-east.",
    special_id="raqqa", special_name="Raqqa", special_desc="The SDF took Raqqa on 17 October 2017.", special_fx=[STAB(0.03), PP(20)], special_avail=AFTER("2017-10-17"),
    relations_desc="The SDF was formed with American support; Turkey opposed it.",
    relations=[("united_states", "The United States", "Support from the United States.", [OPN("USA", 15)]), ("turkey_talks", "Turkey", "Seek calmer relations with Turkey.", [OPN("TUR", 10)])],
    talks_name="Talks with Damascus", talks_desc="Talks on the future of the north-east within Syria.", defend_name="Hold the north-east", defend_desc="Defend the territory held.",
    end_id="autonomy", end_name="Recognised autonomy", end_desc="Alternative history: a settlement recognises the autonomy of the north-east."))

for p, tag, name, city in (("dpr", "DPR", "Donetsk People's Republic", "Donetsk"), ("lpr", "LPR", "Luhansk People's Republic", "Luhansk")):
    group_tree(p, tag, name, f"The {name} while it holds land (from 2014 until the annexation of September 2022 in data/events/conflicts.json). Neutral and descriptive.",
        [name, "Minsk agreements", "War in Donbas"], dict(
        root="The republic", root_desc=f"The {name}, created in 2014, declared itself an independent state; it was internationally unrecognised.", spirit_name="A de facto administration", spirit_desc="A head of the republic, a council and armed units.",
        leadership_desc="The head of the republic leads the administration.", admin_desc=f"Ministries run {city} and the towns held.",
        services_desc="Keep water, power and pensions paid.", revenue_desc="Revenue from industry and trade.",
        special_id="industry", special_name="The mines and mills", special_desc="Restart the mines and steel mills of the Donbas.", special_fx=[T_BUILD := {"add_buildings": {"building": "civilian_factory", "count": 1}}, TREAS(0.3)],
        relations_desc="The republic was created by Russian-backed forces.",
        relations=[("russia", "Russia", "Support from Russia.", [OPN("RUS", 15)]), ("neighbour", "The other republic", "Co-operation with the neighbouring republic.", [OPN("LPR" if tag == "DPR" else "DPR", 15)])],
        talks_name="The Minsk talks", talks_desc="Talks in Minsk with Ukraine, Russia and the OSCE, with French and German mediation.", defend_name="Hold the front", defend_desc="Defend the line of contact.",
        end_id="recognition", end_name="Wider recognition", end_desc="Alternative history: more states recognise the republic."))
