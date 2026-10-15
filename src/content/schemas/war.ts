/** War rules (Phase 10): combat, supply, war score, peace and world tension (data/units/war.json). */
import { z } from "zod";
import { Tag, sourced } from "./common.ts";

const n = (v: number) => z.number().default(v);

export const WarRulesFile = z.strictObject({
  note: z.string().optional(),
  /** Combat width of a province battle. */
  combat_width: n(30),
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
  ...{ source: sourced.source.optional(), confidence: sourced.confidence.optional() },
});
export type WarRules = z.infer<typeof WarRulesFile>;
