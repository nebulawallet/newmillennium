/**
 * Economy definitions: the 2000 World Bank figures (data/economy/worldbank_2000.json, fetched by
 * npm run fetch-worldbank), economic rules and defaults (data/economy/economy.json) and buildings
 * (data/economy/buildings.json).
 */
import { z } from "zod";
import { Id, SourceRef } from "./common.ts";

const n = (v: number) => z.number().default(v);

/** Raw World Bank file: values as published, keyed by ISO3 (aggregates included). */
export const WorldBankFile = z.object({
  year: z.number(),
  source: z.array(SourceRef),
  indicators: z.record(z.string(), z.string()),
  note: z.string().optional(),
  countries: z.record(z.string(), z.record(z.string(), z.union([z.number(), z.string()]))),
});
export type WorldBank = z.infer<typeof WorldBankFile>;

export const Resource = z.strictObject({
  id: Id,
  name: z.string(),
  /** World Bank rent indicator key in worldbank_2000.json (share of GDP). */
  rent_key: z.string(),
  color: z.string(),
});

export const EconomyRulesFile = z.strictObject({
  note: z.string().optional(),
  /** Industry value added (billion USD) represented by one factory. */
  factory_value_bn: n(8),
  /** Construction points per civilian factory per day. */
  construction_per_factory: n(5),
  /** Most civilian factories a single construction project can use. */
  max_factories_per_project: n(15),
  /** Share of civilian factories producing consumer goods, by economic system law. */
  consumer_goods_share: z.record(Id, z.number().min(0).max(0.9)).default({}),
  /** Potential growth (%/year) = base + catch_up * (1 - log10(GDP per capita) / 5), blended with real 1995-2000 average growth. */
  trend_growth_base: n(1.2),
  trend_growth_catch_up: n(5.5),
  /** Weight of the real 1995-2000 average growth in potential growth (the rest is the catch-up formula). */
  trend_history_weight: n(0.6),
  /** Monthly share of the gap closed between potential growth and the catch-up formula (convergence over decades). */
  trend_convergence: n(0.002),
  /** Inflation the central bank aims for in the long run, by income tier; starting inflation converges to it. */
  inflation_targets: z.partialRecord(z.enum(["low", "lower_middle", "upper_middle", "high"]), z.number()).default({ low: 6, lower_middle: 5, upper_middle: 4, high: 2 }),
  /** Monthly share of the gap closed between the inflation anchor and its target. */
  anchor_convergence: n(0.01),
  /** AI governments: deficit they aim for (% of GDP) when debt is low, and how fast spending follows. */
  ai_target_deficit: n(1.5),
  ai_debt_ceiling: n(60),
  ai_fiscal_adjustment: n(0.02),
  /** Monthly share of the gap to the growth target closed. */
  growth_adjustment: n(0.25),
  /** Okun coefficient: unemployment change per point of growth above trend (yearly). */
  okun: n(0.4),
  /** Share of the gap to the starting (natural) unemployment rate closed each month. */
  unemployment_reversion: n(0.03),
  /** Inflation response to the growth gap, and monthly reversion toward its anchor. */
  inflation_gap_weight: n(0.3),
  inflation_reversion: n(0.06),
  /** Growth effects of policy: per point of deficit above its starting level, per point of interest above neutral. */
  fiscal_multiplier: n(0.15),
  rate_effect: n(0.25),
  /** Monthly share of the gap to tax and spending targets closed. */
  budget_adjustment: n(0.1),
  /** Gameplay estimates for countries without a World Bank figure, by income tier. */
  defaults: z.partialRecord(z.enum(["low", "lower_middle", "upper_middle", "high"]), z.record(z.string(), z.number())).default({}),
  resources: z.array(Resource).default([]),
  /** How strongly world resource prices react to the gap between demand and supply each month. */
  price_elasticity: n(0.15),
});
export type EconomyRules = z.infer<typeof EconomyRulesFile>;

export const BuildingDef = z.strictObject({
  id: Id,
  name: z.string(),
  description: z.string(),
  /** Construction points. */
  cost: z.number().positive(),
  /** province: built in a province (with a per-province maximum); national: adds to a national count. */
  level: z.enum(["province", "national"]),
  max_per_province: z.number().int().positive().optional(),
  /** What one level adds. */
  adds: z.strictObject({
    infrastructure: z.number().optional(),
    civilian_factories: z.number().optional(),
    military_factories: z.number().optional(),
    growth: z.number().optional(),
  }),
});
export type BuildingDef = z.infer<typeof BuildingDef>;
export const BuildingsFile = z.strictObject({ buildings: z.array(BuildingDef), note: z.string().optional() });
