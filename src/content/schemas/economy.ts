/**
 * Economy definitions: the 2000 World Bank figures (data/economy/worldbank_2000.json, fetched by
 * npm run fetch-worldbank), economic rules and defaults (data/economy/economy.json) and buildings
 * (data/economy/buildings.json).
 */
import { z } from "zod";
import { Id, Modifiers, SourceRef } from "./common.ts";

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
  /**
   * Average interest rate on the debt stock: a blend of the neutral rate and the current policy rate (weight
   * debt_rate_policy_weight), times debt_rate_scale. High-inflation countries pay high rates, so inflation does not
   * simply melt their debt.
   */
  debt_rate_policy_weight: n(0.3),
  debt_rate_scale: n(0.75),
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
  /** Icon name from the shell's icon set (src/ui/icons.tsx). */
  icon: z.string().optional(),
  /** Construction points. */
  cost: z.number().positive(),
  /** Money in billion US dollars at the reference price level, paid from the budget as the work progresses. */
  money_bn: z.number().min(0).default(0),
  /** slot: takes one of the province's building slots; level: its own track per province up to `max_per_province`. */
  kind: z.enum(["slot", "level"]),
  max_per_province: z.number().int().positive().optional(),
  /** Technology needed before it can be built. */
  requires_tech: Id.optional(),
  /** The country must have rents from this resource (World Bank 2000), e.g. oil for refineries. */
  requires_resource: Id.optional(),
  /** Only in coastal provinces. */
  coastal: z.boolean().default(false),
  /** What one building (or level) adds. */
  adds: z.strictObject({
    infrastructure: z.number().optional(),
    civilian_factories: z.number().optional(),
    military_factories: z.number().optional(),
    growth: z.number().optional(),
    /** Goods produced per year (data/economy/goods.json units). */
    goods: z.record(Id, z.number()).optional(),
  }),
  /** Country modifiers per building, summed over every one built and capped at `modifier_cap` times these. */
  modifiers: Modifiers.default({}),
  modifier_cap: z.number().positive().optional(),
  /** Radar: the owner sees foreign divisions within this many km of the province (fog of war on the map). */
  detection_radius_km: z.number().positive().optional(),
  /** Starting buildings of this type per billion dollars of the resource's 2000 rent (placed like factories). */
  start_per_rent_bn: z.number().min(0).optional(),
});
export type BuildingDef = z.infer<typeof BuildingDef>;

/** Building slots per province: (base + per infrastructure level + per square root of millions of people) × terrain, capped. */
export const SlotRules = z.strictObject({
  base: n(1),
  per_infrastructure: n(0.5),
  per_sqrt_million: n(2),
  terrain: z.record(z.string(), z.number()).default({}),
  max: n(25),
});
export type SlotRules = z.infer<typeof SlotRules>;

export const BuildingsFile = z.strictObject({
  buildings: z.array(BuildingDef),
  slots: SlotRules.default({ base: 1, per_infrastructure: 0.5, per_sqrt_million: 2, terrain: {}, max: 25 }),
  /** Share of GDP the 2000 budgets already spend on public investment: construction spending above it adds to the deficit. */
  investment_allowance_pct_gdp: n(2),
  /** Money costs scale with GDP per person (price level) relative to this reference, within the bounds. */
  price_reference_gdppc: n(10000),
  price_level_min: n(0.2),
  price_level_max: n(1.5),
  note: z.string().optional(),
});

/** A good traded on the world market. Production comes from factories and buildings; demand follows the economy. */
export const GoodDef = z.strictObject({
  id: Id,
  name: z.string(),
  description: z.string(),
  color: z.string(),
  /** Billion US dollars per unit at a price index of 1. */
  value_bn: n(1),
  /** Demand per year: per billion dollars of GDP, and per billion of industry value added. */
  demand_per_gdp_bn: n(0),
  demand_per_industry_bn: n(0),
});
export type GoodDef = z.infer<typeof GoodDef>;

export const GoodsFile = z.strictObject({
  note: z.string().optional(),
  goods: z.array(GoodDef),
  /** Goods each civilian factory makes per year: consumer goods (the consumer share of factories) and industrial goods (factories not busy with construction). */
  consumer_goods_per_factory: n(1),
  industrial_goods_per_factory: n(1),
  /** Monthly price move toward (demand / supply) ^ elasticity, and the price bounds. */
  price_elasticity: n(0.8),
  price_adjustment: n(0.25),
  price_min: n(0.3),
  price_max: n(3),
  /** Trade routes: partners weigh by GDP times this access: a trade agreement, a shared economic bloc; sanctions close a route. */
  deal_access: n(1.6),
  bloc_access: n(1.4),
  /** Exports can reach at most this multiple of what an open world market would take. */
  max_access: n(1.5),
  /** Share of trade income added to reserves, and growth points per percent of GDP of trade income changed since 2000. */
  treasury_share: n(0.2),
  growth_per_pct_gdp: n(0.25),
  max_growth_effect: n(2),
});
export type GoodsRules = z.infer<typeof GoodsFile>;
