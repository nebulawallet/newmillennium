/**
 * The economy (Phase 7). Each country starts from its real 2000 figures (World Bank) and moves
 * monthly:
 *  - growth drifts toward a target: potential growth (higher for poorer countries), shocks,
 *    fiscal and monetary policy, stability, modifiers (focuses, laws) and resource income;
 *  - unemployment follows growth (Okun's law) and drifts back to its starting level;
 *  - inflation follows the growth gap and drifts back to its starting anchor;
 *  - the central bank sets interest rates by a Taylor-style rule;
 *  - taxes and spending move toward the government's targets; deficits and interest add to debt;
 *  - factories scale with industry; construction (construction.ts) places buildings in provinces
 *    and pays for them from the budget; the goods market and trade routes are in market.ts.
 * The economic mood that elections and interest groups use is derived from these figures.
 * Values with no World Bank figure use labelled gameplay estimates by income tier.
 */
import { monthlyDue } from "../bucket.ts";
import { tradeIndex } from "../diplomacy/diplomacy.ts";
import type { ContentDB } from "../../content/compile.ts";
import type { SimContext, System } from "../simulation.ts";
import type { CountryState, GameState } from "../state.ts";
import { clamp, countryModifiers } from "../politics/common.ts";
import { aiConstruction, buildDay, buildingModifiers, constructionFactories, type ConstructionItem } from "./construction.ts";
import { tradeGrowthEffect, updateMarket, type GoodMarket, type TradeState } from "./market.ts";

export type { ConstructionItem };

export interface Shock {
  /** Growth effect in points (negative = recession), fading linearly to zero by `until`. */
  growth: number;
  unemployment: number;
  inflation: number;
  start: number;
  until: number;
  source: string;
}

export interface EconomyState {
  /** Trade and sanctions growth on 1 January 2000 (later changes are relative to it). */
  tradeBase?: number;
  population: number;
  /** Billion US dollars (2000 prices). */
  gdp: number;
  /** Annual rates, percent. */
  growth: number;
  trend: number;
  inflation: number;
  inflationAnchor: number;
  unemployment: number;
  naturalUnemployment: number;
  interestRate: number;
  /** Real neutral rate; the neutral nominal rate is this plus the inflation anchor. */
  realRate: number;
  /** Long-run inflation target the anchor converges to. */
  inflationTarget: number;
  /** Percent of GDP. */
  revenue: number;
  spending: number;
  revenueTarget: number;
  spendingTarget: number;
  startDeficit: number;
  debt: number;
  /** Billion USD of reserves. */
  treasury: number;
  industryShare: number;
  /** Factories from the economy's size, plus those built during the game. */
  builtCiv: number;
  builtMil: number;
  militaryShare: number;
  construction: ConstructionItem[];
  shocks: Shock[];
  /** Resource rent per year at 2000 prices, billion USD. */
  resources: Record<string, number>;
  /** Fields that are gameplay estimates (no World Bank figure). */
  estimated: string[];
  /** Economic modifiers in force at the start: only changes from these move the economy (2000 figures already include them). */
  modBase: Record<string, number> | null;
  /** Construction capacity, refreshed monthly: free civilian factories and points per factory per day. */
  capacity?: { factories: number; perFactory: number };
  /** Construction money paid since the last monthly update (billion USD), and the smoothed annual rate (% of GDP). */
  investmentMonth?: number;
  investmentPct?: number;
  /** Civilian factories left idle by construction, summed over days since the last market update (they make industrial goods). */
  idleSum?: number;
  idleDays?: number;
  /** Average idle factories over the last month. */
  idle?: number;
  /** Goods trade (market.ts), refreshed monthly. */
  trade?: TradeState;
  /** Country modifiers from buildings (air bases, ports, power plants, data centres), refreshed monthly. */
  buildingMods?: Record<string, number>;
}

const ECON_MODS = ["gdp_growth", "inflation", "interest_rate", "tax_efficiency", "welfare_cost", "population_growth", "construction_speed"];
/** Economic modifiers relative to those in force when the game started. */
function econMods(db: ContentDB, cs: CountryState): Record<string, number> {
  const mods = countryModifiers(db, cs);
  const e = cs.economy!;
  e.modBase ??= Object.fromEntries(ECON_MODS.map((k) => [k, mods[k] ?? 0]));
  return Object.fromEntries(ECON_MODS.map((k) => [k, (mods[k] ?? 0) - (e.modBase![k] ?? 0)]));
}

/** Neutral nominal interest rate. */
export const neutralRate = (e: EconomyState) => e.realRate + e.inflationAnchor;
/** Catch-up potential growth from income alone. */
export const catchUpTrend = (db: ContentDB, gdppc: number) =>
  db.economyRules.trend_growth_base + db.economyRules.trend_growth_catch_up * clamp(1 - Math.log10(Math.max(100, gdppc)) / 5, 0, 1);

export interface MarketState {
  /** Price index per resource, 1 = 2000 level. */
  prices: Record<string, number>;
  /** World demand index (follows world GDP), 1 = 2000 level. */
  demand: number;
  /** Goods markets (market.ts): price, world supply and demand. */
  goods?: Record<string, GoodMarket>;
}

type Tier = "low" | "lower_middle" | "upper_middle" | "high";
/** World Bank income thresholds for 2000 (GNI per capita, used here on GDP per capita). */
export const incomeTier = (gdppc: number): Tier => (gdppc < 755 ? "low" : gdppc < 2995 ? "lower_middle" : gdppc < 9265 ? "upper_middle" : "high");

/** A starting figure with where it came from. */
export function figure(db: ContentDB, tag: string, key: string, gdppc: number): { value: number; estimated: boolean; year?: number } {
  const wb = db.worldBank.countries[tag];
  const v = wb?.[key];
  if (typeof v === "number") {
    const y = wb?.[`${key}_year`];
    return { value: v, estimated: false, year: typeof y === "number" ? y : undefined };
  }
  const d = db.economyRules.defaults[incomeTier(gdppc)]?.[key];
  return { value: d ?? 0, estimated: true };
}

/** Starting economy for a country from World Bank 2000 data (and the map's population as a fallback). */
export function initialEconomy(db: ContentDB, tag: string, mapPopulation: number): EconomyState {
  const rules = db.economyRules;
  const wb = db.worldBank.countries[tag];
  const estimated: string[] = [];
  const num = (k: string) => (typeof wb?.[k] === "number" ? (wb[k] as number) : undefined);
  const population = num("population") ?? mapPopulation;
  if (num("population") === undefined) estimated.push("population");
  let gdpUsd = num("gdp_usd");
  if (gdpUsd === undefined) {
    // no World Bank GDP: a low-income estimate from population
    gdpUsd = population * 900;
    estimated.push("gdp");
  }
  const gdppc = gdpUsd / Math.max(1, population);
  const fig = (k: string, field: string) => {
    const f = figure(db, tag, k, gdppc);
    if (f.estimated) estimated.push(field);
    return f.value;
  };
  const growth0 = num("gdp_growth_pct");
  const formula = catchUpTrend(db, gdppc);
  const avg = num("gdp_growth_avg_1995_2000");
  const trend = clamp(avg === undefined ? formula : rules.trend_history_weight * clamp(avg, -2, 10) + (1 - rules.trend_history_weight) * formula, -1, 9);
  if (growth0 === undefined) estimated.push("growth");
  const inflation = clamp(fig("inflation_pct", "inflation"), -5, 200);
  const unemployment = clamp(fig("unemployment_pct", "unemployment"), 0.5, 60);
  const lending = clamp(fig("lending_rate_pct", "interest"), 0.5, 80);
  // when only one side of the budget is known, the other keeps the income group's typical gap to it
  // (a default level next to a real figure would invent a large surplus or deficit)
  const rev = figure(db, tag, "revenue_pct_gdp", gdppc), exp = figure(db, tag, "expense_pct_gdp", gdppc);
  const tierDefaults = rules.defaults[incomeTier(gdppc)] ?? {};
  const gap = (tierDefaults.expense_pct_gdp ?? 0) - (tierDefaults.revenue_pct_gdp ?? 0);
  if (rev.estimated && !exp.estimated) rev.value = exp.value - gap;
  if (exp.estimated && !rev.estimated) exp.value = rev.value + gap;
  if (rev.estimated) estimated.push("revenue");
  if (exp.estimated) estimated.push("spending");
  const revenue = clamp(rev.value, 3, 70);
  const spending = clamp(exp.value, 5, 75);
  const debt = clamp(fig("central_gov_debt_pct_gdp", "debt"), 0, 300);
  const industryShare = clamp(fig("industry_pct_gdp", "industry"), 5, 80) / 100;
  const mil = (num("military_spending_pct_gdp") ?? 1.5) / 100;
  const resources: Record<string, number> = {};
  for (const r of rules.resources) {
    const rent = num(r.rent_key);
    if (rent && rent > 0) resources[r.id] = (rent / 100) * (gdpUsd / 1e9);
  }
  return {
    population,
    gdp: gdpUsd / 1e9,
    growth: clamp(growth0 ?? trend, -15, 20),
    trend,
    inflation,
    inflationAnchor: clamp(inflation, 0, 40),
    unemployment,
    naturalUnemployment: unemployment,
    interestRate: lending,
    realRate: clamp(lending - inflation, 1, 10),
    inflationTarget: rules.inflation_targets[incomeTier(gdppc)] ?? 3,
    revenue,
    spending,
    revenueTarget: revenue,
    spendingTarget: spending,
    startDeficit: spending - revenue,
    debt,
    treasury: (num("reserves_usd") ?? 0) / 1e9,
    industryShare,
    builtCiv: 0,
    builtMil: 0,
    militaryShare: clamp(mil * 4, 0.03, 0.5),
    construction: [],
    shocks: [],
    resources,
    estimated,
    modBase: null,
  };
}

/** Civilian and military factories: industry value added divided by the value of one factory, plus those built. */
export function factories(db: ContentDB, e: EconomyState): { civ: number; mil: number } {
  const total = (e.gdp * e.industryShare) / db.economyRules.factory_value_bn;
  return {
    civ: Math.max(1, Math.round(total * (1 - e.militaryShare))) + e.builtCiv,
    mil: Math.round(total * e.militaryShare) + e.builtMil,
  };
}

/** Construction points per day: civilian factories not tied up making consumer goods. */
export function constructionPerDay(db: ContentDB, cs: CountryState): { factories: number; consumerShare: number; points: number; perFactory: number } {
  const e = cs.economy!;
  const { free, consumerShare } = constructionFactories(db, cs, factories(db, e).civ);
  const perFactory = db.economyRules.construction_per_factory * (1 + (econMods(db, cs).construction_speed ?? 0));
  return { factories: free, consumerShare, points: free * perFactory, perFactory };
}

/** Active shock effect now (linear fade). */
export function shockNow(e: EconomyState, day: number): { growth: number; unemployment: number; inflation: number } {
  const out = { growth: 0, unemployment: 0, inflation: 0 };
  for (const s of e.shocks) {
    if (day < s.start || day >= s.until) continue;
    const left = (s.until - day) / Math.max(1, s.until - s.start);
    out.growth += s.growth * left;
    out.unemployment += s.unemployment * left;
    out.inflation += s.inflation * left;
  }
  return out;
}

export interface GrowthPart {
  label: string;
  value: number;
}

/** What the growth rate is moving toward, and why (for the tooltip). */
export function growthTarget(db: ContentDB, state: GameState, cs: CountryState): { target: number; parts: GrowthPart[] } {
  const e = cs.economy!;
  const r = db.economyRules;
  const mods = econMods(db, cs);
  const shock = shockNow(e, state.day);
  const parts: GrowthPart[] = [{ label: "Potential growth", value: e.trend }];
  const fiscal = r.fiscal_multiplier * (e.spending - e.revenue - e.startDeficit);
  if (Math.abs(fiscal) >= 0.01) parts.push({ label: "Fiscal stance", value: fiscal });
  const monetary = -r.rate_effect * (e.interestRate - neutralRate(e));
  if (Math.abs(monetary) >= 0.01) parts.push({ label: "Interest rates", value: monetary });
  const stab = (cs.stability - 0.5) * 2;
  if (Math.abs(stab) >= 0.01) parts.push({ label: "Stability", value: stab });
  if (cs.civilWar) parts.push({ label: "Civil war", value: -4 });
  const modGrowth = (mods.gdp_growth ?? 0) * 100;
  if (Math.abs(modGrowth) >= 0.01) parts.push({ label: "Policies and focuses", value: modGrowth });
  const debtDrag = -Math.max(0, e.debt - 90) * 0.02;
  if (debtDrag < -0.01) parts.push({ label: "High public debt", value: debtDrag });
  const resource = resourceIncomeEffect(db, state, e);
  if (Math.abs(resource) >= 0.01) parts.push({ label: "Resource prices", value: resource });
  if (Math.abs(shock.growth) >= 0.01) parts.push({ label: "Economic shocks", value: shock.growth });
  const trade = tradeIndex(db, state, cs.tag) - (e.tradeBase ??= tradeIndex(db, state, cs.tag));
  if (Math.abs(trade) >= 0.01) parts.push({ label: "Trade agreements, blocs and sanctions", value: trade });
  const goods = tradeGrowthEffect(db, e);
  if (Math.abs(goods) >= 0.01) parts.push({ label: "Goods trade since 2000", value: goods });
  return { target: parts.reduce((s, p) => s + p.value, 0), parts };
}

/** Growth effect of resource prices: rent at today's prices versus 2000, as a share of GDP. */
function resourceIncomeEffect(db: ContentDB, state: GameState, e: EconomyState): number {
  let gain = 0;
  for (const [res, rent] of Object.entries(e.resources)) gain += rent * ((state.market?.prices[res] ?? 1) - 1);
  return clamp((gain / Math.max(1, e.gdp)) * 100 * 0.25, -4, 4);
}

/** The economic mood (-1..1) used by elections and interest groups. */
export function economicMood(e: EconomyState, day: number): number {
  const shock = shockNow(e, day);
  return clamp(
    (e.growth - e.trend) / 4 - (e.unemployment - e.naturalUnemployment) / 6 - Math.max(0, e.inflation - Math.max(6, e.inflationAnchor + 3)) / 20 + shock.growth / 25,
    -1,
    1,
  );
}

function monthlyCountry(ctx: SimContext, cs: CountryState): void {
  const { db, state, rng } = ctx;
  const e = cs.economy!;
  const r = db.economyRules;
  const mods = econMods(db, cs);
  const shock = shockNow(e, state.day);
  // slow structural change: potential growth converges on the catch-up path, inflation on its target
  e.trend += (catchUpTrend(db, (e.gdp * 1e9) / Math.max(1, e.population)) - e.trend) * r.trend_convergence;
  e.inflationAnchor += (e.inflationTarget - e.inflationAnchor) * r.anchor_convergence;
  e.realRate += (2.5 - e.realRate) * 0.005;
  const { target } = growthTarget(db, state, cs);
  e.growth = clamp(e.growth + (target - e.growth) * r.growth_adjustment + 0.25 * rng.normal(), -20, 25);
  e.gdp *= (1 + e.growth / 100) ** (1 / 12);
  // unemployment: Okun's law plus reversion to the starting rate
  const gap = e.growth - e.trend;
  e.unemployment = clamp(e.unemployment - (r.okun * gap) / 12 + (e.naturalUnemployment - e.unemployment) * r.unemployment_reversion + shock.unemployment / 12, 0.5, 60);
  // inflation: demand pressure plus reversion to the anchor
  e.inflation = clamp(
    e.inflation + (r.inflation_gap_weight * gap) / 12 + (e.inflationAnchor + (mods.inflation ?? 0) * 100 + shock.inflation - e.inflation) * r.inflation_reversion,
    -10,
    300,
  );
  // central bank: lean against inflation and the growth gap
  const rateTarget = clamp(neutralRate(e) + 1.5 * (e.inflation - e.inflationAnchor) + 0.5 * gap + (mods.interest_rate ?? 0) * 100, 0, 80);
  e.interestRate += (rateTarget - e.interestRate) * 0.15;
  // budget: move toward targets; automatic stabilisers on spending; deficit and interest add to debt
  e.revenue += (e.revenueTarget * (1 + (mods.tax_efficiency ?? 0)) - e.revenue) * r.budget_adjustment;
  // construction money: the 2000 budgets already contain some public investment; spending above it adds to the deficit
  const invNow = ((e.investmentMonth ?? 0) * 12 * 100) / Math.max(1, e.gdp);
  e.investmentMonth = 0;
  e.investmentPct = (e.investmentPct ?? invNow) + (invNow - (e.investmentPct ?? invNow)) * 0.3;
  const extra = Math.max(0, e.investmentPct - db.buildingRules.investment_allowance_pct_gdp);
  e.spending += (e.spendingTarget + (mods.welfare_cost ?? 0) * 100 + Math.max(0, e.unemployment - e.naturalUnemployment) * 0.2 + extra - e.spending) * r.budget_adjustment;
  // AI governments follow a simple fiscal rule: aim for a modest deficit, consolidate above the debt ceiling
  if (cs.tag !== state.player) {
    const goal = r.ai_target_deficit - Math.max(0, e.debt - r.ai_debt_ceiling) / 20;
    e.spendingTarget = clamp(e.spendingTarget + (e.revenueTarget + goal - e.spendingTarget) * r.ai_fiscal_adjustment, 5, 75);
  }
  // the average rate on the debt stock: between the neutral rate and today's policy rate (old debt reprices slowly)
  const w = r.debt_rate_policy_weight;
  const interest = (e.debt * Math.max(0.5, ((1 - w) * neutralRate(e) + w * e.interestRate) * r.debt_rate_scale)) / 100;
  const deficit = e.spending - e.revenue + interest;
  const nominal = e.growth + e.inflation;
  e.debt = clamp(e.debt + deficit / 12 - (e.debt * nominal) / 1200, 0, 500);
  // reserves follow resource income
  for (const [res, rent] of Object.entries(e.resources)) e.treasury = Math.max(0, e.treasury + (rent * ((state.market.prices[res] ?? 1) - 1)) / 12 * 0.2);
  // population
  e.population *= (1 + (((db.worldBank.countries[cs.tag]?.pop_growth_pct as number | undefined) ?? 1.5) + (mods.population_growth ?? 0) * 100) / 100) ** (1 / 12);
  cs.economicMood = economicMood(e, state.day);
}

/** Daily construction: factories work through the queue; the idle ones are counted for industrial goods. */
function dailyConstruction(ctx: SimContext, cs: CountryState): void {
  const { db } = ctx;
  const e = cs.economy!;
  e.capacity ??= refreshCapacity(db, cs);
  const idle = e.construction.length ? buildDay(ctx, cs, e.capacity.factories, e.capacity.perFactory) : e.capacity.factories;
  e.idleSum = (e.idleSum ?? 0) + idle;
  e.idleDays = (e.idleDays ?? 0) + 1;
}

function refreshCapacity(db: ContentDB, cs: CountryState): { factories: number; perFactory: number } {
  const c = constructionPerDay(db, cs);
  return { factories: c.factories, perFactory: c.perFactory };
}

export { canBuild } from "./construction.ts";

export const economySystem: System = {
  id: "economy",
  daily(ctx) {
    const { db, state } = ctx;
    for (const cs of Object.values(state.countries)) {
      if (!cs.active || !cs.economy) continue;
      dailyConstruction(ctx, cs);
      // the monthly update runs on the country's own day of the month (spreads the load)
      if (monthlyDue(cs.tag, state.day)) {
        monthlyCountry(ctx, cs);
        cs.economy.capacity = refreshCapacity(db, cs);
        cs.economy.buildingMods = buildingModifiers(db, state, cs.tag);
        if (cs.tag !== state.player) aiConstruction(ctx, cs);
        cs.economy.shocks = cs.economy.shocks.filter((s) => s.until > state.day);
      }
    }
  },
  monthly(ctx) {
    const { db, state } = ctx;
    const countries = Object.values(state.countries).filter((c) => c.active && c.economy);
    // world resource market: demand follows world GDP, supply is fixed at 2000 capacity
    let worldGdp = 0, worldGdp0 = 0;
    for (const cs of countries) {
      worldGdp += cs.economy!.gdp;
      worldGdp0 += (db.worldBank.countries[cs.tag]?.gdp_usd as number | undefined ?? 0) / 1e9 || cs.economy!.gdp;
    }
    state.market.demand = worldGdp0 > 0 ? worldGdp / worldGdp0 : 1;
    // goods: the average idle factories over the last month make industrial goods
    for (const cs of countries) {
      const e = cs.economy!;
      e.idle = e.idleDays ? (e.idleSum ?? 0) / e.idleDays : (e.capacity?.factories ?? 0);
      e.idleSum = 0;
      e.idleDays = 0;
    }
    updateMarket(ctx, (cs) => cs.economy!.idle ?? 0, (cs) => factories(db, cs.economy!).civ);
    for (const r of db.economyRules.resources) {
      const p = state.market.prices[r.id] ?? 1;
      const pressure = state.market.demand ** 0.6 - 1;
      state.market.prices[r.id] = clamp(p * (1 + db.economyRules.price_elasticity * (pressure - (p - 1) * 0.3) / 12), 0.3, 4);
    }
  },
};

/** An economic shock (from events): growth, unemployment and inflation effects fading over `months`. */
export function applyShock(ctx: SimContext, cs: CountryState, s: { growth: number; months: number; unemployment?: number; inflation?: number }, source: string): void {
  if (!cs.economy) return;
  cs.economy.shocks.push({
    growth: s.growth,
    unemployment: s.unemployment ?? 0,
    inflation: s.inflation ?? 0,
    start: ctx.state.day,
    until: ctx.state.day + Math.round(s.months * 30.4),
    source,
  });
}
