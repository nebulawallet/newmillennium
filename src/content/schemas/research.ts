/**
 * Research (Phase 8): technology categories (data/techs/<category>.json) and research rules
 * (data/techs/rules.json). Technologies are gameplay abstractions placed in the year they became
 * broadly available; researching one before its year costs extra.
 */
import { z } from "zod";
import { Id, Modifiers } from "./common.ts";

const n = (v: number) => z.number().default(v);

export const TechDef = z.strictObject({
  id: Id,
  name: z.string().min(1),
  description: z.string().min(1),
  /** Year the technology became broadly available; researching it earlier costs more. */
  year: z.number().int().min(1980).max(2060),
  /** Research days at normal speed. */
  cost: z.number().positive().default(180),
  /** All groups must be met; within a group any one researched technology is enough. */
  prerequisites: z.array(z.array(Id).min(1)).default([]),
  /** Column within the category's tree view. */
  x: z.number().int().min(0),
  /** Permanent modifiers once researched. */
  effects: Modifiers.default({}),
});
export type TechDef = z.infer<typeof TechDef>;

export const TechCategoryFile = z.strictObject({
  id: Id,
  name: z.string(),
  description: z.string(),
  /** Military categories start from military spending rather than income. */
  military: z.boolean().default(false),
  techs: z.array(TechDef).min(1),
});
export type TechCategory = z.infer<typeof TechCategoryFile>;

export const ResearchRulesFile = z.strictObject({
  note: z.string().optional(),
  base_slots: n(3),
  /** Extra research slots for economies above these GDP thresholds (billion USD). */
  slot_gdp_thresholds: z.array(z.number()).default([500, 2000, 8000]),
  max_slots: n(6),
  /** Extra cost per year a technology is researched before its year. */
  ahead_penalty_per_year: n(0.25),
  /** Cost reduction per year a technology is behind the current year (catching up is easier), capped. */
  behind_bonus_per_year: n(0.06),
  max_behind_bonus: n(0.5),
  /** Speed bonus per point of R&D spending (% of GDP) above `rnd_baseline`. */
  rnd_speed_per_point: n(0.12),
  rnd_baseline: n(1),
  /** At the start, a country has every technology from years up to 2000 minus this lag, by income tier. */
  start_lag_years: z.partialRecord(z.enum(["low", "lower_middle", "upper_middle", "high"]), z.number()).default({ high: 0, upper_middle: 3, lower_middle: 6, low: 10 }),
  /** Military categories: lag reduced by this many years per point of military spending (% of GDP) above 2, capped. */
  military_lag_per_point: n(1.5),
  max_military_lag_reduction: n(6),
  /** R&D spending (% of GDP) reduces the civilian lag by this many years per point above the baseline, capped. */
  rnd_lag_per_point: n(1.5),
  max_rnd_lag_reduction: n(3),
});
export type ResearchRules = z.infer<typeof ResearchRulesFile>;
