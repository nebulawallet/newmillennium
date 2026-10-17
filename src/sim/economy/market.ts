/**
 * World goods market and trade routes.
 *  - Production: civilian factories make consumer goods (the consumer-goods share) and industrial
 *    goods (factories not busy with construction); buildings make goods (refineries: fuel).
 *  - Demand follows GDP and industry, scaled through 2000 so that world supply and demand balance
 *    at a price of 1 (queues fill up over the first months). From 2001 prices move toward
 *    (demand / supply) ^ elasticity.
 *  - A country's surplus is sold along trade routes: every partner weighs by its GDP times its
 *    access (a trade agreement or a shared economic bloc raises it; sanctions close the route).
 *    Deficits are bought at the world price.
 *  - Trade income goes partly to reserves, and its change since 1 January 2000 moves growth (the
 *    2000 figures already include the trade of that year).
 */
import type { ContentDB } from "../../content/compile.ts";
import type { SimContext } from "../simulation.ts";
import type { CountryState, GameState } from "../state.ts";
import { clamp } from "../politics/common.ts";
import type { EconomyState } from "./economy.ts";
import { constructionFactories, organicTotals } from "./construction.ts";

/** Market calibration period from 1 January 2000 (days). */
export const CALIBRATION_DAYS = 365;

export interface GoodMarket {
  price: number;
  /** World production and demand, units a year. */
  supply: number;
  demand: number;
  /** Demand scale fixed at the start (world supply / raw demand). */
  scale: number;
}

export interface TradeState {
  production: Record<string, number>;
  demand: Record<string, number>;
  /** Billion USD a year: exports sold minus imports bought. */
  exports: number;
  imports: number;
  income: number;
  /** Average income over 2000 (the baseline growth is measured against). */
  income0?: number;
  baselineMonths?: number;
  /** Share of an open world market the country's routes reach (1 = open; above with agreements and blocs). */
  access: number;
  /** Largest routes: partner and billion USD a year. */
  routes: { partner: string; value: number; kind: "deal" | "bloc" | "open" }[];
}

/** Goods a country makes in a year. */
export function production(db: ContentDB, state: GameState, cs: CountryState, civ: number, idle: number): Record<string, number> {
  const r = db.goodsRules;
  const out: Record<string, number> = {};
  const { consumerShare } = constructionFactories(db, cs, civ);
  if (db.goods.has("consumer_goods")) out.consumer_goods = civ * consumerShare * r.consumer_goods_per_factory;
  if (db.goods.has("industrial_goods")) out.industrial_goods = idle * r.industrial_goods_per_factory;
  const counts: Record<string, number> = cs.economy ? { ...organicTotals(db, cs.economy) } : {};
  for (const [pid, rec] of Object.entries(state.provinceBuildings)) {
    if (state.provinceOwner[Number(pid) - 1] !== cs.tag) continue;
    for (const [b, n] of Object.entries(rec)) counts[b] = (counts[b] ?? 0) + n;
  }
  for (const [b, n] of Object.entries(counts))
    for (const [g, k] of Object.entries(db.buildings.get(b)?.adds.goods ?? {})) out[g] = (out[g] ?? 0) + n * k;
  return out;
}

/** Raw (unscaled) demand for each good. */
export function rawDemand(db: ContentDB, e: EconomyState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of db.goods.values()) out[g.id] = e.gdp * g.demand_per_gdp_bn + e.gdp * e.industryShare * g.demand_per_industry_bn;
  return out;
}

/** Economic blocs a country belongs to. */
function economicBlocs(db: ContentDB, state: GameState, tag: string): Set<string> {
  const out = new Set<string>();
  for (const [id, members] of Object.entries(state.diplomacy?.blocs ?? {})) if (db.blocs.get(id)?.kind === "economic" && members.includes(tag)) out.add(id);
  return out;
}

/** Monthly: prices from world supply and demand, then every country's trade and routes. */
export function updateMarket(ctx: SimContext, idleOf: (cs: CountryState) => number, civOf: (cs: CountryState) => number): void {
  const { db, state } = ctx;
  if (!db.goods.size) return;
  const r = db.goodsRules;
  const countries = Object.values(state.countries).filter((c) => c.active && c.economy && state.provinceOwner.includes(c.tag));
  const prod = new Map<string, Record<string, number>>(), dem = new Map<string, Record<string, number>>();
  const supply: Record<string, number> = {}, demand: Record<string, number> = {};
  for (const cs of countries) {
    const p = production(db, state, cs, civOf(cs), idleOf(cs));
    const d = rawDemand(db, cs.economy!);
    prod.set(cs.tag, p);
    dem.set(cs.tag, d);
    for (const g of db.goods.keys()) {
      supply[g] = (supply[g] ?? 0) + (p[g] ?? 0);
      demand[g] = (demand[g] ?? 0) + (d[g] ?? 0);
    }
  }
  const goods = (state.market.goods ??= {});
  // the first year calibrates: demand scales to supply and prices stay at 1
  const calibrating = state.day < CALIBRATION_DAYS;
  for (const g of db.goods.keys()) {
    const m = (goods[g] ??= { price: 1, supply: 0, demand: 0, scale: 1 });
    if (calibrating) m.scale = demand[g]! > 0 ? (supply[g] ?? 0) / demand[g]! : 1;
    m.supply = supply[g] ?? 0;
    m.demand = (demand[g] ?? 0) * m.scale;
    const target = m.supply > 0 ? clamp((m.demand / m.supply) ** r.price_elasticity, r.price_min, r.price_max) : r.price_max;
    m.price = calibrating ? 1 : clamp(m.price + (target - m.price) * r.price_adjustment, r.price_min, r.price_max);
  }
  // trade routes: partners by GDP and access
  const d = state.diplomacy;
  const sanctions = new Set((d?.sanctions ?? []).map(([a, b]) => `${a}>${b}`));
  const deals = new Set((d?.tradeDeals ?? []).flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
  const unSanctioned = new Set((d?.unsc.resolutions ?? []).filter((x) => x.kind === "sanctions" && x.passed && (x.until ?? 0) > state.day).map((x) => x.target));
  const blocs = new Map(countries.map((c) => [c.tag, economicBlocs(db, state, c.tag)]));
  for (const cs of countries) {
    const e = cs.economy!;
    const p = prod.get(cs.tag)!, dr = dem.get(cs.tag)!;
    let exp = 0, imp = 0;
    const demandNow: Record<string, number> = {};
    for (const [g, m] of Object.entries(goods)) {
      const want = (dr[g] ?? 0) * m.scale;
      demandNow[g] = want;
      const net = (p[g] ?? 0) - want;
      const value = db.goods.get(g)?.value_bn ?? 1;
      if (net > 0) exp += net * m.price * value;
      else imp += -net * m.price * value;
    }
    const mine = blocs.get(cs.tag)!;
    const routes: TradeState["routes"] = [];
    let reach = 0, open = 0;
    for (const o of countries) {
      if (o === cs) continue;
      const g = o.economy!.gdp;
      open += g;
      let acc = 1, kind: "deal" | "bloc" | "open" = "open";
      if (sanctions.has(`${cs.tag}>${o.tag}`) || sanctions.has(`${o.tag}>${cs.tag}`)) acc = 0;
      else if (deals.has(`${cs.tag}|${o.tag}`)) { acc = r.deal_access; kind = "deal"; }
      else if ([...mine].some((b) => blocs.get(o.tag)?.has(b))) { acc = r.bloc_access; kind = "bloc"; }
      if (unSanctioned.has(cs.tag) || unSanctioned.has(o.tag)) acc *= 0.3;
      reach += g * acc;
      if (acc > 0) routes.push({ partner: o.tag, value: g * acc, kind });
    }
    const access = open > 0 ? Math.min(r.max_access, reach / open) : 0;
    const sold = exp * access;
    const total = routes.reduce((s, x) => s + x.value, 0) || 1;
    routes.sort((a, b) => b.value - a.value);
    const top = routes.slice(0, 8).map((x) => ({ ...x, value: (sold * x.value) / total }));
    const income = sold - imp;
    const prev = e.trade;
    // the baseline is the average over the calibration year (2000)
    const months = prev?.baselineMonths ?? 0;
    const income0 = calibrating ? ((prev?.income0 ?? 0) * months + income) / (months + 1) : prev?.income0 ?? income;
    e.trade = { production: p, demand: demandNow, exports: sold, imports: imp, income, income0, baselineMonths: calibrating ? months + 1 : months, access, routes: top };
    e.treasury = Math.max(0, e.treasury + (income / 12) * r.treasury_share * (income >= 0 ? 1 : 0.5));
  }
}

/** Growth points from goods trade income changed since 2000 (for the growth target). */
export function tradeGrowthEffect(db: ContentDB, e: EconomyState): number {
  const t = e.trade;
  if (!t || t.income0 === undefined || (t.baselineMonths ?? 0) < 12) return 0;
  const r = db.goodsRules;
  return clamp(((t.income - t.income0) / Math.max(1, e.gdp)) * 100 * r.growth_per_pct_gdp, -r.max_growth_effect, r.max_growth_effect);
}
