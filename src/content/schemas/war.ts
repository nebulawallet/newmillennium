/** War rules (Phase 10): combat, supply, war score, peace and world tension (data/units/war.json). */
import { z } from "zod";
import { Tag, sourced } from "./common.ts";

const n = (v: number) => z.number().default(v);

export const WarRulesFile = z.strictObject({
  note: z.string().optional(),
  /** Combat width of a province battle. */
  combat_width: n(80),
  /** Organisation and strength lost per point of effective attack (per day). */
  org_damage: n(0.02),
  strength_damage: n(0.0025),
  /** Defence bonus by terrain. */
  terrain_defence: z.record(z.string(), z.number()).default({ plains: 0, forest: 0.15, hills: 0.25, mountains: 0.5, desert: 0, jungle: 0.25, marsh: 0.2, urban: 0.3, arctic: 0.1 }),
  /** Daily entrenchment gain for divisions that stay put, and the cap. */
  entrenchment_per_day: n(0.02),
  max_entrenchment: n(0.25),
  /** Attack penalty when the attacker's piercing is below the defender's armour (and vice versa). */
  armour_penalty: n(0.5),
  /** Bonus for the side with air superiority, scaled by the superiority ratio. */
  air_superiority_bonus: n(0.15),
  /** Divisions a province supplies: base + per infrastructure level; halved in enemy territory. */
  supply_base: n(2),
  supply_per_infrastructure: n(1.2),
  /** Daily strength loss for divisions over the supply limit. */
  out_of_supply_attrition: n(0.002),
  /** Attack lost at zero supply (scaled by how far a division is over its province's supply). */
  out_of_supply_combat_penalty: n(0.5),
  /** Attack bonus per extra province the attack comes from, and its cap. */
  flanking_bonus_per_direction: n(0.1),
  max_flanking_bonus: n(0.3),
  /** Attack penalty crossing a river (needs river data in the map; not used until it exists). */
  river_crossing_penalty: n(0.2),
  /** A side capitulates when its enemies hold this share of its population. */
  capitulation_share: n(0.7),
  /** War support lost each month of war, and the level at which a side accepts a white peace. */
  war_exhaustion_monthly: n(0.03),
  white_peace_war_support: n(0.15),
  /** No white peace before a war has lasted this many months. */
  white_peace_min_months: n(6),
  /** War support of an invaded country rises to at least this on a declaration of war. */
  defender_rally: n(0.5),
  /** Monthly war support gained per share of the enemy's population held. */
  occupation_war_support: n(0.15),
  /** World tension added by a declaration of war, and monthly decay. */
  tension_per_war: n(0.15),
  tension_decay: n(0.02),
  /** Countries with nuclear weapons in 2000 (sourced): wars against them raise world tension far more. */
  nuclear_states_2000: z.array(Tag).default([]),
  nuclear_tension_multiplier: n(2.5),
  /** Fronts and battle plans (src/sim/military/fronts.ts), shared by the player and the AI. */
  fronts: z.strictObject({
    /** Plans are carried out every this many days. */
    plan_interval_days: n(2),
    /** A defended province is attacked when the divisions next to it have this much more power than its defenders. */
    attack_ratio: n(1.3),
    /** Divisions attack only with at least this organisation, and break off below `break_off_organisation`. */
    attack_organisation: n(0.6),
    break_off_organisation: n(0.25),
    /** Share of an army (its fastest divisions) that follows a spearhead arrow. */
    spearhead_share: n(0.34),
    /** The AI goes on the offensive against an enemy when its army has this share of the enemy's power. */
    ai_offensive_ratio: n(0.9),
  }).default({ plan_interval_days: 2, attack_ratio: 1.3, attack_organisation: 0.6, break_off_organisation: 0.25, spearhead_share: 0.34, ai_offensive_ratio: 0.9 }),
  ...{ source: sourced.source.optional(), confidence: sourced.confidence.optional() },
});
export type WarRules = z.infer<typeof WarRulesFile>;
