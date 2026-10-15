"""Generator for data/units/*.json (kept for reference; edit the JSON directly afterwards).
Run from the project root: python -I scripts/dev/gen-units.py
"""
import json


def V(id, name, cost, stats, tech=None):
    d = {"id": id, "name": name, "cost": cost, "stats": stats}
    if tech:
        d["requires_tech"] = tech
    return d


eq = [
    {"id": "infantry_equipment", "name": "Infantry equipment", "description": "Rifles, machine guns, radios and personal protection.", "domain": "land", "variants": [
        V("infantry_equipment_1", "Infantry weapons (1980s)", 0.5, {"soft_attack": 3, "hard_attack": 0.5, "defence": 6, "piercing": 1}),
        V("infantry_equipment_2", "Modernised infantry kit", 0.7, {"soft_attack": 4, "hard_attack": 0.8, "defence": 8, "piercing": 2}, "inf_digital_soldier"),
        V("infantry_equipment_3", "Future soldier systems", 1.0, {"soft_attack": 5, "hard_attack": 1, "defence": 10, "piercing": 3}, "inf_exoskeletons")]},
    {"id": "support_equipment", "name": "Support equipment", "description": "Trucks, communications and engineering gear.", "domain": "land", "variants": [
        V("support_equipment_1", "Support equipment", 1.5, {"defence": 1}),
        V("support_equipment_2", "Networked support equipment", 2.0, {"defence": 2, "soft_attack": 1}, "doc_network_centric")]},
    {"id": "anti_tank_weapons", "name": "Anti-tank weapons", "description": "Guided and unguided anti-tank weapons.", "domain": "land", "variants": [
        V("anti_tank_weapons_1", "Wire-guided anti-tank missiles", 1.0, {"hard_attack": 4, "piercing": 10, "defence": 2}),
        V("anti_tank_weapons_2", "Fire-and-forget anti-tank missiles", 1.5, {"hard_attack": 7, "piercing": 14, "defence": 3}, "inf_atgm_fire_forget"),
        V("anti_tank_weapons_3", "Loitering anti-armour munitions", 2.0, {"hard_attack": 10, "piercing": 16, "defence": 3, "soft_attack": 2}, "inf_loitering_munitions")]},
    {"id": "armoured_vehicle", "name": "Armoured vehicles", "description": "Armoured personnel carriers and infantry fighting vehicles.", "domain": "land", "variants": [
        V("armoured_vehicle_1", "Armoured personnel carrier", 4, {"soft_attack": 4, "defence": 6, "armour": 8, "breakthrough": 2}),
        V("armoured_vehicle_2", "Infantry fighting vehicle", 6, {"soft_attack": 6, "hard_attack": 2, "defence": 8, "armour": 12, "breakthrough": 4, "piercing": 8}, "arm_digital_fire_control"),
        V("armoured_vehicle_3", "Protected infantry fighting vehicle", 8, {"soft_attack": 7, "hard_attack": 3, "defence": 10, "armour": 16, "breakthrough": 5, "piercing": 10}, "arm_active_protection")]},
    {"id": "main_battle_tank", "name": "Main battle tanks", "description": "Heavily armoured tanks with large guns.", "domain": "land", "variants": [
        V("main_battle_tank_1", "Older main battle tank", 7, {"soft_attack": 5, "hard_attack": 7, "defence": 3, "breakthrough": 8, "armour": 20, "piercing": 20}),
        V("main_battle_tank_2", "Third-generation main battle tank", 10, {"soft_attack": 6, "hard_attack": 10, "defence": 4, "breakthrough": 12, "armour": 30, "piercing": 30}, "arm_third_generation_mbt"),
        V("main_battle_tank_3", "Modernised main battle tank", 13, {"soft_attack": 7, "hard_attack": 12, "defence": 5, "breakthrough": 14, "armour": 38, "piercing": 36}, "arm_composite_armour"),
        V("main_battle_tank_4", "Next-generation main battle tank", 16, {"soft_attack": 8, "hard_attack": 15, "defence": 6, "breakthrough": 17, "armour": 46, "piercing": 42}, "arm_next_generation_mbt")]},
    {"id": "artillery", "name": "Artillery", "description": "Guns and rocket launchers.", "domain": "land", "variants": [
        V("artillery_1", "Towed artillery", 3, {"soft_attack": 12, "breakthrough": 2}),
        V("artillery_2", "Self-propelled artillery", 6, {"soft_attack": 16, "breakthrough": 3, "armour": 4}, "art_self_propelled_artillery"),
        V("artillery_3", "Precision artillery", 8, {"soft_attack": 22, "hard_attack": 3, "breakthrough": 4, "armour": 4}, "art_precision_shells")]},
    {"id": "air_defence", "name": "Air defence", "description": "Anti-aircraft guns and missiles.", "domain": "land", "variants": [
        V("air_defence_1", "Short-range air defence", 3, {"air_attack": 8, "hard_attack": 1}),
        V("air_defence_2", "Layered air defence", 6, {"air_attack": 16, "hard_attack": 2}, "art_layered_air_defence")]},
    {"id": "fighter", "name": "Fighter aircraft", "description": "Combat aircraft for air superiority and strike (air combat arrives in Phase 10).", "domain": "air", "variants": [
        V("fighter_1", "Older jet fighter", 20, {"air_attack": 10}),
        V("fighter_2", "Fourth-generation fighter", 30, {"air_attack": 16, "soft_attack": 4}, "air_fourth_generation_fighters"),
        V("fighter_3", "Stealth fighter", 60, {"air_attack": 28, "soft_attack": 6}, "air_stealth_fighters"),
        V("fighter_4", "Sixth-generation fighter", 90, {"air_attack": 40, "soft_attack": 8}, "air_sixth_generation")]},
    {"id": "combat_drone", "name": "Combat drones", "description": "Unmanned aircraft for reconnaissance and strike (air combat arrives in Phase 10).", "domain": "air", "variants": [
        V("combat_drone_1", "Armed drone", 6, {"soft_attack": 6, "hard_attack": 3}, "air_armed_drones"),
        V("combat_drone_2", "Drone swarm", 4, {"soft_attack": 8, "hard_attack": 4}, "air_drone_swarms")]},
]
json.dump({"note": "Generic equipment families. Each variant needs its technology; costs are military-factory days per unit (gameplay values).", "equipment": eq},
          open("data/units/equipment.json", "w", encoding="utf8", newline="\n"), indent=2, ensure_ascii=False)


def S(id, name, desc, kind, mp, eqp, org, hp, width, speed, days=90):
    return {"id": id, "name": name, "description": desc, "kind": kind, "manpower": mp, "equipment": eqp,
            "organisation": org, "hp": hp, "width": width, "speed": speed, "training_days": days}


su = [
    S("infantry", "Infantry battalion", "Foot infantry.", "battalion", 1000, {"infantry_equipment": 100, "support_equipment": 5}, 60, 3, 2, 4),
    S("motorised_infantry", "Motorised infantry battalion", "Infantry carried by trucks.", "battalion", 1000, {"infantry_equipment": 100, "support_equipment": 30}, 60, 3, 2, 12),
    S("mechanised_infantry", "Mechanised infantry battalion", "Infantry in armoured vehicles.", "battalion", 900, {"infantry_equipment": 80, "armoured_vehicle": 40}, 50, 3, 2, 12, 120),
    S("armour", "Armoured battalion", "Main battle tanks.", "battalion", 500, {"main_battle_tank": 40, "support_equipment": 10}, 30, 2, 2, 10, 150),
    S("artillery", "Artillery battalion", "Guns or rocket launchers.", "battalion", 500, {"artillery": 24, "support_equipment": 5}, 20, 0.6, 3, 4),
    S("air_defence", "Air defence battalion", "Air defence guns and missiles.", "battalion", 400, {"air_defence": 20, "support_equipment": 5}, 20, 0.6, 1, 4),
    S("anti_tank", "Anti-tank battalion", "Anti-tank missile teams.", "battalion", 500, {"anti_tank_weapons": 30, "support_equipment": 5}, 30, 1, 1, 4),
    S("reconnaissance", "Reconnaissance company", "Scouts that find the enemy.", "support", 200, {"infantry_equipment": 30, "support_equipment": 20}, 20, 0.5, 0, 12, 60),
    S("engineers", "Engineer company", "Bridging, fortification and mine clearance.", "support", 300, {"infantry_equipment": 20, "support_equipment": 30}, 20, 0.5, 0, 4, 60),
]
json.dump({"note": "Battalions and support companies. Stats are gameplay values.", "sub_units": su},
          open("data/units/sub_units.json", "w", encoding="utf8", newline="\n"), indent=2, ensure_ascii=False)

mil = {
    "note": "Military rules. Starting armies come from World Bank armed forces personnel (2000); the shares and division sizes here are gameplay values.",
    "manpower_share": {"volunteer_force": 0.006, "selective_conscription": 0.015, "universal_conscription": 0.03, "extended_service": 0.05, "total_mobilisation": 0.12},
    "templates": [
        {"id": "infantry_division", "name": "Infantry division", "units": {"infantry": 9, "artillery": 2, "reconnaissance": 1, "engineers": 1}, "modern_level": 0},
        {"id": "motorised_division", "name": "Motorised division", "units": {"motorised_infantry": 6, "artillery": 2, "anti_tank": 1, "reconnaissance": 1}, "modern_level": 1},
        {"id": "mechanised_division", "name": "Mechanised division", "units": {"mechanised_infantry": 6, "armour": 2, "artillery": 2, "air_defence": 1, "reconnaissance": 1}, "modern_level": 2},
        {"id": "armoured_division", "name": "Armoured division", "units": {"armour": 6, "mechanised_infantry": 4, "artillery": 2, "air_defence": 1, "reconnaissance": 1}, "modern_level": 2},
    ],
}
json.dump(mil, open("data/units/military.json", "w", encoding="utf8", newline="\n"), indent=2, ensure_ascii=False)
print("wrote data/units/equipment.json, sub_units.json, military.json")
