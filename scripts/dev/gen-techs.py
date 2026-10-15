"""Generator for data/techs/*.json (kept for reference; edit the JSON directly afterwards).
Technologies are generic gameplay abstractions placed in the year they became broadly available.
Run from the project root: python -I scripts/dev/gen-techs.py
"""
import json

CATS = {}


def cat(id, name, desc, military):
    CATS[id] = {"id": id, "name": name, "description": desc, "military": military, "techs": []}
    return lambda *a, **k: tech(id, *a, **k)


def tech(c, id, name, desc, year, x, effects, pre=None, cost=None):
    t = {"id": id, "name": name, "description": desc, "year": year, "x": x, "effects": effects}
    if pre:
        t["prerequisites"] = pre
    t["cost"] = cost or (500 if year < 1996 else 700 if year < 2005 else 850 if year < 2015 else 1000 if year < 2025 else 1200)
    CATS[c]["techs"].append(t)


t = cat("infantry", "Infantry", "Equipment and protection for infantry.", True)
t("inf_body_armour", "Improved body armour", "Lighter ceramic plates and helmets for every soldier.", 1998, 0, {"army_defence": 0.03})
t("inf_night_vision", "Night vision for all units", "Image-intensifier and thermal sights issued down to squad level.", 2000, 1, {"army_attack": 0.02})
t("inf_atgm_fire_forget", "Fire-and-forget anti-tank missiles", "Portable guided missiles that do not need guiding to the target.", 2004, 2, {"army_attack": 0.04})
t("inf_digital_soldier", "Digitised infantry", "Radios, displays and positioning for every squad.", 2006, 0, {"army_org": 0.03}, [["inf_body_armour"]])
t("inf_mrap", "Mine-resistant vehicles", "Protected vehicles against mines and roadside bombs.", 2007, 1, {"army_defence": 0.04}, [["inf_night_vision"]])
t("inf_squad_drones", "Squad reconnaissance drones", "Small drones for scouting at platoon and squad level.", 2015, 1, {"army_attack": 0.03}, [["inf_digital_soldier", "inf_mrap"]])
t("inf_loitering_munitions", "Portable loitering munitions", "Man-portable drones that strike targets they find.", 2022, 2, {"army_attack": 0.05}, [["inf_atgm_fire_forget"], ["inf_squad_drones"]])
t("inf_exoskeletons", "Load-bearing exoskeletons", "Powered frames that let soldiers carry more for longer.", 2032, 0, {"army_org": 0.03}, [["inf_squad_drones"]])

t = cat("armour", "Armour", "Tanks and armoured vehicles.", True)
t("arm_mbt_modernisation", "Main battle tank modernisation", "New sights, guns and armour for existing tanks.", 1998, 0, {"army_attack": 0.03})
t("arm_digital_fire_control", "Digital fire control", "Hunter-killer sights and ballistic computers.", 2003, 1, {"army_attack": 0.02})
t("arm_composite_armour", "Advanced composite armour", "Layered armour against modern anti-tank weapons.", 2005, 0, {"army_defence": 0.04}, [["arm_mbt_modernisation"]])
t("arm_active_protection", "Active protection systems", "Systems that intercept incoming missiles and rockets.", 2012, 1, {"army_defence": 0.05}, [["arm_composite_armour"]])
t("arm_networked_brigade", "Networked armoured brigade", "Vehicles that share targets and positions automatically.", 2016, 0, {"army_org": 0.04}, [["arm_composite_armour"], ["arm_digital_fire_control"]])
t("arm_next_generation_mbt", "Next-generation main battle tank", "A new tank design with a smaller crew and better protection.", 2028, 1, {"army_attack": 0.05, "army_defence": 0.03}, [["arm_active_protection"]])
t("arm_unmanned_ground_vehicles", "Unmanned ground vehicles", "Remotely operated and autonomous combat vehicles.", 2032, 2, {"army_attack": 0.03}, [["arm_networked_brigade"]])

t = cat("artillery_missiles", "Artillery and missiles", "Artillery, rockets, missiles and air defence.", True)
t("art_guided_rockets", "Guided multiple rocket launchers", "Rocket artillery with satellite-guided rounds.", 2000, 0, {"army_attack": 0.03})
t("art_counter_battery_radar", "Counter-battery radar", "Radars that locate enemy guns from their shells.", 1999, 2, {"army_defence": 0.03})
t("art_precision_shells", "Precision-guided shells", "Artillery shells that steer to their target.", 2004, 1, {"army_attack": 0.03})
t("art_cruise_missiles", "Long-range cruise missiles", "Ground- and air-launched missiles with ranges over 1,000 km.", 2002, 0, {"army_attack": 0.03}, [["art_guided_rockets"]])
t("art_layered_air_defence", "Layered air defence", "Short-, medium- and long-range air defence working as one network.", 2010, 2, {"air_effectiveness": 0.03, "army_defence": 0.02}, [["art_counter_battery_radar"]])
t("art_hypersonic_missiles", "Hypersonic missiles", "Manoeuvring missiles faster than five times the speed of sound.", 2024, 0, {"army_attack": 0.05}, [["art_cruise_missiles"]])
t("art_directed_energy", "Directed-energy air defence", "Lasers that destroy drones and rockets.", 2034, 2, {"air_effectiveness": 0.05}, [["art_layered_air_defence"]])

t = cat("air_drones", "Air and drones", "Combat aircraft, munitions and unmanned aircraft.", True)
t("air_fighter_upgrades", "Fourth-generation fighter upgrades", "Radar, weapons and engine upgrades for existing fighters.", 1998, 0, {"air_effectiveness": 0.03})
t("air_precision_bombs", "Precision-guided bombs", "Laser- and satellite-guided bombs for all strike aircraft.", 1999, 1, {"air_effectiveness": 0.03, "army_attack": 0.01})
t("air_reconnaissance_drones", "Medium-altitude reconnaissance drones", "Long-endurance unmanned aircraft for surveillance.", 2002, 2, {"intelligence_power": 0.05})
t("air_aesa_radar", "AESA radar", "Electronically scanned radar for fighters.", 2006, 1, {"air_effectiveness": 0.03}, [["air_precision_bombs"]])
t("air_armed_drones", "Armed drones", "Unmanned aircraft that carry missiles and bombs.", 2008, 2, {"air_effectiveness": 0.03, "army_attack": 0.02}, [["air_reconnaissance_drones"]])
t("air_stealth_fighters", "Fifth-generation stealth fighters", "Fighters designed to evade radar.", 2010, 0, {"air_effectiveness": 0.06}, [["air_fighter_upgrades"]])
t("air_drone_swarms", "Drone swarms", "Large numbers of cheap drones coordinated automatically.", 2025, 2, {"air_effectiveness": 0.05}, [["air_armed_drones"]])
t("air_sixth_generation", "Sixth-generation combat aircraft", "Crewed fighters that command unmanned wingmen.", 2035, 0, {"air_effectiveness": 0.08}, [["air_stealth_fighters"], ["air_aesa_radar"]])

t = cat("naval", "Naval", "Warships, submarines and naval systems.", True)
t("nav_integrated_combat_systems", "Integrated combat systems", "Ship-wide radar and weapons control.", 1998, 0, {"naval_effectiveness": 0.03})
t("nav_aip_submarines", "Air-independent propulsion", "Conventional submarines that stay submerged for weeks.", 2002, 1, {"naval_effectiveness": 0.04})
t("nav_littoral_ships", "Littoral combat ships", "Fast, modular ships for coastal waters.", 2008, 2, {"naval_effectiveness": 0.02})
t("nav_modern_carriers", "Modern aircraft carriers", "Large carriers with modern launch and recovery systems.", 2010, 0, {"naval_effectiveness": 0.05}, [["nav_integrated_combat_systems"]])
t("nav_sea_missile_defence", "Sea-based missile defence", "Warships that intercept ballistic missiles.", 2012, 1, {"naval_effectiveness": 0.03, "air_effectiveness": 0.02}, [["nav_integrated_combat_systems"]])
t("nav_unmanned_surface_vessels", "Unmanned surface vessels", "Remotely operated and autonomous boats.", 2020, 2, {"naval_effectiveness": 0.03}, [["nav_littoral_ships"]])
t("nav_large_underwater_drones", "Large underwater drones", "Autonomous submarines for patrol and mine warfare.", 2030, 1, {"naval_effectiveness": 0.05}, [["nav_aip_submarines"]])

t = cat("electronics_cyber", "Electronics and cyber", "Computing, communications and cyber capabilities.", False)
t("ele_broadband", "Broadband internet", "Always-on internet access in homes and businesses.", 1999, 0, {"research_speed": 0.03, "private_sector_output": 0.01})
t("ele_civil_gps", "Precision civil GPS", "Accurate satellite positioning for civilian use.", 2000, 1, {"trade_efficiency": 0.02})
t("ele_mobile_3g", "3G mobile networks", "Mobile data networks.", 2002, 0, {"private_sector_output": 0.02}, [["ele_broadband"]])
t("ele_smartphones", "Smartphones", "Pocket computers with internet access.", 2007, 1, {"education_quality": 0.02, "private_sector_output": 0.02}, [["ele_mobile_3g"]])
t("ele_cyber_defence", "National cyber defence", "Agencies and systems that protect government and infrastructure networks.", 2008, 2, {"intelligence_power": 0.05, "internal_security": 0.03})
t("ele_mobile_4g", "4G mobile networks", "Fast mobile broadband.", 2010, 0, {"gdp_growth": 0.002}, [["ele_mobile_3g"]])
t("ele_cyber_operations", "Offensive cyber capabilities", "Units able to disrupt foreign networks.", 2012, 2, {"intelligence_power": 0.08, "foreign_influence_power": 0.05}, [["ele_cyber_defence"]])
t("ele_machine_learning", "Machine learning", "Systems that learn from data at scale.", 2016, 1, {"research_speed": 0.05}, [["ele_smartphones"]])
t("ele_mobile_5g", "5G mobile networks", "High-capacity, low-latency mobile networks.", 2019, 0, {"gdp_growth": 0.002, "private_sector_output": 0.02}, [["ele_mobile_4g"]])
t("ele_generative_ai", "Generative AI", "Large models that write, code and design.", 2023, 1, {"research_speed": 0.05, "private_sector_output": 0.03}, [["ele_machine_learning"]])
t("ele_quantum_computing", "Quantum computing", "Practical quantum computers for science and cryptography.", 2032, 2, {"intelligence_power": 0.05, "research_speed": 0.05}, [["ele_generative_ai"]])

t = cat("industry_energy", "Industry and energy", "Manufacturing methods and power generation.", False)
t("ind_lean_manufacturing", "Lean manufacturing", "Just-in-time production with less waste.", 1997, 0, {"production_efficiency": 0.05})
t("ind_combined_cycle_gas", "Combined-cycle gas power", "Efficient gas power stations.", 1998, 1, {"energy_cost": -0.03, "fossil_output": 0.05})
t("ind_industrial_robotics", "Industrial robotics", "Robots on assembly lines.", 2005, 0, {"production_efficiency": 0.05, "construction_speed": 0.03}, [["ind_lean_manufacturing"]])
t("ind_wind_and_solar", "Utility-scale wind and solar", "Large wind farms and solar parks.", 2008, 2, {"renewable_output": 0.15, "emissions": -0.05})
t("ind_horizontal_drilling", "Horizontal drilling and fracking", "Extracting oil and gas from shale.", 2008, 1, {"fossil_output": 0.1, "energy_cost": -0.03}, [["ind_combined_cycle_gas"]])
t("ind_additive_manufacturing", "Additive manufacturing", "Industrial 3D printing.", 2014, 0, {"production_efficiency": 0.04}, [["ind_industrial_robotics"]])
t("ind_grid_storage", "Grid-scale batteries", "Batteries that store renewable power for the grid.", 2018, 2, {"renewable_output": 0.1, "energy_cost": -0.02}, [["ind_wind_and_solar"]])
t("ind_small_modular_reactors", "Small modular reactors", "Factory-built nuclear reactors.", 2030, 1, {"nuclear_output": 0.2, "emissions": -0.05})
t("ind_green_hydrogen", "Green hydrogen", "Hydrogen made with renewable power for industry.", 2030, 2, {"emissions": -0.08, "renewable_output": 0.05}, [["ind_grid_storage"]])

t = cat("economy_digital", "Economy and digital", "Commerce, government services and finance.", False)
t("eco_e_commerce", "E-commerce", "Buying and selling online.", 1999, 0, {"trade_efficiency": 0.03, "private_sector_output": 0.01})
t("eco_container_logistics", "Global container logistics", "Integrated shipping and supply chains.", 2000, 2, {"trade_efficiency": 0.04})
t("eco_online_banking", "Online banking", "Banking services over the internet.", 2002, 0, {"private_sector_output": 0.02}, [["eco_e_commerce"]])
t("eco_e_government", "E-government", "Public services and tax filing online.", 2003, 1, {"tax_efficiency": 0.03, "corruption": -0.02})
t("eco_cloud_computing", "Cloud computing", "Computing rented as a service.", 2010, 1, {"research_speed": 0.03, "private_sector_output": 0.02}, [["eco_e_government"]])
t("eco_mobile_payments", "Mobile payments", "Payments by phone.", 2012, 0, {"tax_efficiency": 0.02, "private_sector_output": 0.02}, [["eco_online_banking"]])
t("eco_platform_economy", "Platform economy", "Online marketplaces for services and work.", 2015, 2, {"gdp_growth": 0.002}, [["eco_cloud_computing"], ["eco_mobile_payments"]])
t("eco_service_automation", "Service automation", "Automated customer service and back offices.", 2027, 1, {"production_efficiency": 0.03, "private_sector_output": 0.03}, [["eco_platform_economy"]])

t = cat("doctrine", "Doctrine", "How the armed forces organise and fight.", True)
t("doc_rapid_reaction", "Rapid reaction forces", "Units ready to deploy within days.", 1999, 0, {"army_org": 0.03})
t("doc_network_centric", "Network-centric warfare", "Sharing information across all units in real time.", 2003, 1, {"army_org": 0.03, "air_effectiveness": 0.02})
t("doc_counterinsurgency", "Counter-insurgency doctrine", "Securing populations and working with local forces.", 2006, 0, {"internal_security": 0.05}, [["doc_rapid_reaction"]])
t("doc_territorial_defence", "Total territorial defence", "Reservists and local units trained to defend their regions.", 2015, 2, {"manpower_factor": 0.1, "army_defence": 0.03})
t("doc_multi_domain", "Multi-domain operations", "Land, sea, air, space and cyber forces planned as one.", 2018, 1, {"army_org": 0.04, "naval_effectiveness": 0.02, "air_effectiveness": 0.02}, [["doc_network_centric"]])
t("doc_drone_warfare", "Drone-centric warfare", "Organising units around large numbers of drones.", 2024, 1, {"army_attack": 0.05}, [["doc_multi_domain"]])

# ---- older root technologies most countries already have in 2000
cat_ref = {k: (lambda k: (lambda *a, **kw: tech(k, *a, **kw)))(k) for k in CATS}
t = cat_ref["infantry"]
t("inf_modern_rifles", "Modern assault rifles and radios", "Standard rifles, radios and helmets for a modern army.", 1985, 3, {'army_attack': 0.02})
t = cat_ref["armour"]
t("arm_third_generation_mbt", "Third-generation main battle tank", "Tanks with composite armour and stabilised guns.", 1985, 2, {'army_defence': 0.02})
t = cat_ref["artillery_missiles"]
t("art_self_propelled_artillery", "Self-propelled artillery", "Armoured guns that move with the army.", 1985, 1, {'army_attack': 0.02})
t = cat_ref["air_drones"]
t("air_fourth_generation_fighters", "Fourth-generation fighters", "Agile multirole fighters with modern radar.", 1985, 1, {'air_effectiveness': 0.03})
t = cat_ref["naval"]
t("nav_guided_missile_ships", "Guided-missile warships", "Frigates and destroyers armed with anti-ship and air-defence missiles.", 1985, 2, {'naval_effectiveness': 0.03})
t = cat_ref["electronics_cyber"]
t("ele_personal_computers", "Personal computers", "Computers in offices and homes.", 1985, 3, {'research_speed': 0.02})
t = cat_ref["industry_energy"]
t("ind_nuclear_power", "Nuclear power", "Large nuclear power stations.", 1980, 3, {'nuclear_output': 0.1})
t = cat_ref["economy_digital"]
t("eco_electronic_banking", "Electronic banking and card payments", "Computerised banks, cash machines and payment cards.", 1988, 3, {'private_sector_output': 0.01})
t = cat_ref["doctrine"]
t("doc_combined_arms", "Combined-arms manoeuvre", "Infantry, armour, artillery and air power fighting together.", 1985, 3, {'army_org': 0.02})
t = cat_ref["electronics_cyber"]
t("ele_mobile_2g", "2G mobile phones", "Digital mobile phone networks.", 1993, 3, {"private_sector_output": 0.01}, [["ele_personal_computers"]])
t("ele_internet", "The internet", "A public worldwide computer network.", 1994, 2, {"research_speed": 0.02}, [["ele_personal_computers"]])
# first technologies of each category build on the roots
ROOT_OF = {"infantry": "inf_modern_rifles", "armour": "arm_third_generation_mbt", "artillery_missiles": "art_self_propelled_artillery", "air_drones": "air_fourth_generation_fighters", "naval": "nav_guided_missile_ships", "electronics_cyber": "ele_personal_computers", "industry_energy": "ind_nuclear_power", "economy_digital": "eco_electronic_banking", "doctrine": "doc_combined_arms"}
FIRST_EXTRA = {"ele_broadband": "ele_internet", "ele_mobile_3g": "ele_mobile_2g", "eco_e_commerce": "ele_internet"}
for c in CATS.values():
    ids = {t["id"] for t in c["techs"]}
    for t in c["techs"]:
        if t["id"] == ROOT_OF[c["id"]] or t["id"] in ("ele_mobile_2g", "ele_internet"):
            continue
        if not t.get("prerequisites") and t["year"] >= 1996:
            t["prerequisites"] = [[ROOT_OF[c["id"]]]]
for c in CATS.values():
    for t in c["techs"]:
        if t["id"] in FIRST_EXTRA:
            t.setdefault("prerequisites", []).append([FIRST_EXTRA[t["id"]]])
for c in CATS.values():
    c["techs"].sort(key=lambda t: (t["year"], t["x"]))

for c in CATS.values():
    json.dump(c, open(f"data/techs/{c['id']}.json", "w", encoding="utf8", newline="\n"), indent=2, ensure_ascii=False)
json.dump(
    {"note": "Research rules. Starting technologies are derived from real 2000 figures (income tier, R&D and military spending from the World Bank); the lags are gameplay estimates."},
    open("data/techs/rules.json", "w", encoding="utf8", newline="\n"), indent=2)
print(sum(len(c["techs"]) for c in CATS.values()), "techs in", len(CATS), "categories")
