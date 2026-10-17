/**
 * Construction (HOI4 style): every building goes in a province, from a queue that civilian
 * factories work through.
 *  - Slots: each province has building slots from its infrastructure, population and terrain
 *    (data/economy/buildings.json "slots"). Factories, refineries, power plants and data centres
 *    take a slot; infrastructure, air bases and ports have their own levels.
 *  - Starting factories (from World Bank 2000 industry, see factories()) and refineries (from 2000
 *    oil rents) are placed on the country's provinces by population and infrastructure, filling
 *    free slots. This placement is derived, not stored: it follows the economy as it grows.
 *  - The queue: civilian factories not tied up making consumer goods are assigned to projects in
 *    order, at most `max_factories_per_project` each. Money is paid from the budget as the work
 *    progresses (cost × price level); spending above the investment allowance adds to the deficit.
 *  - The AI places buildings with the same rules.
 */
import type { ContentDB } from "../../content/compile.ts";
import type { BuildingDef } from "../../content/schemas/economy.ts";
import type { SimContext, SimMap } from "../simulation.ts";
import type { CountryState, GameState } from "../state.ts";
import type { SimProvince } from "../politics/voteModel.ts";
import { clamp } from "../politics/common.ts";
import type { EconomyState } from "./economy.ts";

export interface ConstructionItem {
  building: string;
  /** Province id (every building is placed in a province; older saves may lack it). */
  province?: number;
  progress: number;
  /** Civilian factories working on it on the last day. */
  factories?: number;
  /** Money paid so far (billion USD). */
  spent?: number;
}

// ------------------------------------------------------------------ money

/** Price level for construction money: GDP per person against the reference, within bounds. */
export function priceLevel(db: ContentDB, e: EconomyState): number {
  const r = db.buildingRules;
  return clamp((e.gdp * 1e9) / Math.max(1, e.population) / r.price_reference_gdppc, r.price_level_min, r.price_level_max);
}

/** Money for one building in this country (billion USD), paid as the points are spent. */
export function moneyCost(db: ContentDB, b: BuildingDef, e: EconomyState): number {
  return b.money_bn * priceLevel(db, e);
}

// ------------------------------------------------------------------ slots and placement

const builtIn = (state: GameState, id: number, b: string) => state.provinceBuildings[String(id)]?.[b] ?? 0;

const ownCache = new WeakMap<GameState, { day: number; byOwner: Map<string, SimProvince[]> }>();
/**
 * Each country's populated provinces, indexed once a month (scanning 4,580 provinces per call adds
 * up). Ownership rarely changes within a month, and canBuild checks the owner itself.
 */
export function provincesOf(state: GameState, map: SimMap | undefined, tag: string): SimProvince[] {
  if (!map) return [];
  let hit = ownCache.get(state);
  if (!hit || Math.floor(hit.day / 30) !== Math.floor(state.day / 30)) {
    const byOwner = new Map<string, SimProvince[]>();
    for (const p of map.provinces) {
      const o = state.provinceOwner[p.id - 1];
      if (!o || p.population <= 0) continue;
      (byOwner.get(o) ?? byOwner.set(o, []).get(o)!).push(p);
    }
    ownCache.set(state, (hit = { day: state.day, byOwner }));
  }
  return hit.byOwner.get(tag) ?? [];
}

/** Infrastructure level of a province: the map's estimate plus levels built, capped at 10. */
export function infrastructureOf(state: GameState, p: SimProvince): number {
  return Math.min(10, (p.infrastructure ?? 3) + builtIn(state, p.id, "infrastructure"));
}

/** Building slots of a province. */
export function provinceSlots(db: ContentDB, state: GameState, p: SimProvince): number {
  const r = db.buildingRules.slots;
  const raw = (r.base + r.per_infrastructure * infrastructureOf(state, p) + r.per_sqrt_million * Math.sqrt(Math.max(0, p.population) / 1e6)) * (r.terrain[p.terrain ?? "plains"] ?? 1);
  return clamp(Math.round(raw), 1, r.max);
}

const slotBuildings = (db: ContentDB) => [...db.buildings.values()].filter((b) => b.kind === "slot");

export interface Placement {
  /** Starting (derived) buildings per province id, by building id. */
  organic: Map<number, Record<string, number>>;
  /** Provinces of the country, largest weight first. */
  provinces: SimProvince[];
}

const placementCache = new WeakMap<GameState, Map<string, { key: string; p: Placement }>>();

/**
 * Where a country's starting factories and refineries stand: shares of the national totals by
 * population and infrastructure, filling free slots (largest remainder, then the next province).
 */
export function placement(db: ContentDB, state: GameState, map: SimMap | undefined, tag: string, totals: Record<string, number>): Placement {
  // recomputed only when what it depends on changes: the totals, buildings built and the provinces held
  const own = provincesOf(state, map, tag);
  let builtSig = 0;
  for (const [b, n] of Object.entries(builtByOwner(state).get(tag) ?? {})) builtSig += n * (b.length + 1);
  const key = `${own.length}|${own[0]?.id ?? 0}|${builtSig}|${Object.entries(totals).map(([k, v]) => `${k}${v}`).join(",")}`;
  let byTag = placementCache.get(state);
  if (!byTag) placementCache.set(state, (byTag = new Map()));
  const hit = byTag.get(tag);
  if (hit && hit.key === key) return hit.p;
  const provinces = [...provincesOf(state, map, tag)];
  const weight = (p: SimProvince) => p.population * (0.5 + infrastructureOf(state, p) / 10);
  provinces.sort((a, b) => weight(b) - weight(a));
  const organic = new Map<number, Record<string, number>>();
  const free = new Map<number, number>();
  for (const p of provinces) {
    let used = 0;
    for (const b of slotBuildings(db)) used += builtIn(state, p.id, b.id);
    free.set(p.id, Math.max(0, provinceSlots(db, state, p) - used));
  }
  const total = provinces.reduce((s, p) => s + weight(p), 0) || 1;
  for (const [building, n] of Object.entries(totals)) {
    if (n <= 0 || !provinces.length) continue;
    // ideal shares, rounded down, then the remainders; each limited by free slots
    const want = provinces.map((p) => ({ p, x: (n * weight(p)) / total }));
    let left = n;
    const give = (p: SimProvince, k: number) => {
      const room = free.get(p.id) ?? 0;
      const g = Math.min(k, room, left);
      if (g <= 0) return 0;
      const rec = organic.get(p.id) ?? {};
      rec[building] = (rec[building] ?? 0) + g;
      organic.set(p.id, rec);
      free.set(p.id, room - g);
      left -= g;
      return g;
    };
    for (const w of want) give(w.p, Math.floor(w.x));
    want.sort((a, b) => (b.x % 1) - (a.x % 1));
    for (const w of want) if (left > 0) give(w.p, 1);
    // anything left fills the provinces with room, largest first; with no room at all it stacks on the largest
    for (const p of provinces) if (left > 0) give(p, left);
    if (left > 0) {
      const rec = organic.get(provinces[0]!.id) ?? {};
      rec[building] = (rec[building] ?? 0) + left;
      organic.set(provinces[0]!.id, rec);
    }
  }
  const p: Placement = { organic, provinces };
  byTag.set(tag, { key, p });
  return p;
}

/** Starting-building totals of a country (factories from industry value added, refineries from oil rents). */
export function organicTotals(db: ContentDB, e: EconomyState): Record<string, number> {
  const base = (e.gdp * e.industryShare) / db.economyRules.factory_value_bn;
  const out: Record<string, number> = {
    civilian_factory: Math.max(1, Math.round(base * (1 - e.militaryShare))),
    military_factory: Math.round(base * e.militaryShare),
  };
  for (const b of db.buildings.values()) {
    if (!b.start_per_rent_bn || !b.requires_resource) continue;
    out[b.id] = Math.round((e.resources[b.requires_resource] ?? 0) * b.start_per_rent_bn);
  }
  return out;
}

/** Slot use of a province: starting buildings, those built, and those queued. */
export function slotUse(db: ContentDB, state: GameState, map: SimMap | undefined, cs: CountryState, p: SimProvince): { total: number; used: number; free: number; organic: Record<string, number>; built: Record<string, number>; queued: number } {
  const total = provinceSlots(db, state, p);
  const organic = cs.economy ? placement(db, state, map, cs.tag, organicTotals(db, cs.economy)).organic.get(p.id) ?? {} : {};
  const built: Record<string, number> = {};
  let used = 0;
  for (const b of slotBuildings(db)) {
    const n = builtIn(state, p.id, b.id);
    if (n) built[b.id] = n;
    used += n + (organic[b.id] ?? 0);
  }
  const queued = cs.economy?.construction.filter((c) => c.province === p.id && db.buildings.get(c.building)?.kind === "slot").length ?? 0;
  used += queued;
  return { total, used, free: Math.max(0, total - used), organic, built, queued };
}

/** Why this building cannot go in this province now, or null. */
export function canBuild(db: ContentDB, state: GameState, map: SimMap | undefined, cs: CountryState, building: string, province?: number): string | null {
  const b = db.buildings.get(building);
  if (!b) return "Unknown building.";
  if (!cs.economy) return "No economy data.";
  if (b.requires_tech && !cs.research?.completed.includes(b.requires_tech)) return `Needs the technology ${db.techs.get(b.requires_tech)?.name ?? b.requires_tech}.`;
  if (b.requires_resource && !((cs.economy.resources[b.requires_resource] ?? 0) > 0)) return `Needs ${db.economyRules.resources.find((r) => r.id === b.requires_resource)?.name.toLowerCase() ?? b.requires_resource} production.`;
  if (!province) return "Choose a province.";
  if (state.provinceOwner[province - 1] !== cs.tag) return "You do not own this province.";
  if (state.provinceController[province - 1] !== cs.tag) return "The province is occupied.";
  const p = map?.provinces[province - 1];
  if (!p) return "Unknown province.";
  if (b.coastal && !p.coastal) return "Only in coastal provinces.";
  const queued = cs.economy.construction.filter((c) => c.building === building && c.province === province).length;
  if (b.kind === "level") {
    const have = building === "infrastructure" ? infrastructureOf(state, p) : builtIn(state, province, building);
    if (have + queued >= (b.max_per_province ?? 1)) return "Already at the maximum level here.";
    return null;
  }
  if (slotUse(db, state, map, cs, p).free <= 0) return "No free building slots here.";
  return null;
}

// ------------------------------------------------------------------ queue

export function queueBuilding(ctx: SimContext, tag: string, building: string, province?: number): { ok: boolean; text: string } {
  const cs = ctx.state.countries[tag];
  if (!cs?.economy) return { ok: false, text: "No economy data." };
  const why = canBuild(ctx.db, ctx.state, ctx.map, cs, building, province);
  if (why) return { ok: false, text: why };
  cs.economy.construction.push({ building, province, progress: 0, spent: 0 });
  const where = province ? ctx.map?.provinces[province - 1]?.name : undefined;
  return { ok: true, text: `${ctx.db.buildings.get(building)?.name} queued${where ? ` in ${where}` : ""}.` };
}

export function moveBuilding(ctx: SimContext, tag: string, index: number, to: number): { ok: boolean; text: string } {
  const q = ctx.state.countries[tag]?.economy?.construction;
  if (!q?.[index]) return { ok: false, text: "Nothing to move." };
  const t = clamp(to, 0, q.length - 1);
  const [item] = q.splice(index, 1);
  q.splice(t, 0, item!);
  return { ok: true, text: t < index ? "Moved up the queue." : "Moved down the queue." };
}

/** Civilian factories free for construction (the rest make consumer goods). */
export function constructionFactories(db: ContentDB, cs: CountryState, civ: number): { free: number; consumerShare: number } {
  const consumerShare = db.economyRules.consumer_goods_share[cs.laws.economic_system ?? ""] ?? 0.35;
  return { free: civ * (1 - consumerShare), consumerShare };
}

/**
 * One day of construction: factories go to projects in queue order (capped per project); points
 * become progress and money is spent in proportion. Returns the factories left idle (they make
 * industrial goods).
 */
export function buildDay(ctx: SimContext, cs: CountryState, free: number, perFactory: number): number {
  const { db, state } = ctx;
  const e = cs.economy!;
  let left = free;
  const level = priceLevel(db, e);
  for (const item of [...e.construction]) {
    const b = db.buildings.get(item.building);
    if (!b) { e.construction.splice(e.construction.indexOf(item), 1); continue; }
    const use = Math.max(0, Math.min(left, db.economyRules.max_factories_per_project));
    item.factories = use;
    if (use <= 0) continue;
    left -= use;
    const points = Math.min(use * perFactory, b.cost - item.progress);
    item.progress += points;
    const money = (b.money_bn * level * points) / b.cost;
    item.spent = (item.spent ?? 0) + money;
    e.investmentMonth = (e.investmentMonth ?? 0) + money;
    if (item.progress < b.cost - 1e-6) continue;
    e.construction.splice(e.construction.indexOf(item), 1);
    if (item.province) {
      const pb = (state.provinceBuildings[String(item.province)] ??= {});
      pb[b.id] = (pb[b.id] ?? 0) + 1;
    }
    e.builtCiv += b.adds.civilian_factories ?? 0;
    e.builtMil += b.adds.military_factories ?? 0;
    if (b.adds.growth) e.trend += b.adds.growth * (10 / Math.max(10, Math.sqrt(e.gdp)));
    if (cs.tag === state.player) ctx.log(cs.tag, "construction", `${b.name} completed${item.province ? ` in ${ctx.map?.provinces[item.province - 1]?.name ?? "a province"}` : ""}`);
  }
  return Math.max(0, left);
}

/**
 * Estimated days until each queue item finishes, simulating the queue at today's capacity
 * (items behind the capacity wait for those ahead). Infinity when nothing will reach it.
 */
export function queueEstimates(db: ContentDB, e: EconomyState, free: number, perFactory: number): number[] {
  const items = e.construction.map((c) => ({ left: Math.max(0, (db.buildings.get(c.building)?.cost ?? 0) - c.progress), done: Infinity }));
  if (free <= 0 || perFactory <= 0) return items.map(() => Infinity);
  let day = 0;
  while (day < 3650 && items.some((i) => i.done === Infinity)) {
    // jump to the next completion at the current allocation
    let cap = free, step = Infinity;
    const rate = items.map((i) => {
      if (i.done !== Infinity || cap <= 0) return 0;
      const use = Math.min(cap, db.economyRules.max_factories_per_project);
      cap -= use;
      return use * perFactory;
    });
    items.forEach((i, k) => { if (rate[k]! > 0) step = Math.min(step, i.left / rate[k]!); });
    if (step === Infinity) break;
    step = Math.max(1, Math.ceil(step));
    day += step;
    items.forEach((i, k) => {
      if (rate[k]! <= 0) return;
      i.left -= rate[k]! * step;
      if (i.left <= 1e-6) i.done = day;
    });
  }
  return items.map((i) => i.done);
}

// ------------------------------------------------------------------ building effects

const countsCache = new WeakMap<GameState, { day: number; size: number; byOwner: Map<string, Record<string, number>> }>();
/** Buildings built during play, summed per owner (cached for the day). */
export function builtByOwner(state: GameState): Map<string, Record<string, number>> {
  const keys = Object.keys(state.provinceBuildings);
  const hit = countsCache.get(state);
  if (hit && hit.day === state.day && hit.size === keys.length) return hit.byOwner;
  const byOwner = new Map<string, Record<string, number>>();
  for (const pid of keys) {
    const owner = state.provinceOwner[Number(pid) - 1];
    if (!owner) continue;
    let rec = byOwner.get(owner);
    if (!rec) byOwner.set(owner, (rec = {}));
    for (const [b, n] of Object.entries(state.provinceBuildings[pid]!)) rec[b] = (rec[b] ?? 0) + n;
  }
  countsCache.set(state, { day: state.day, size: keys.length, byOwner });
  return byOwner;
}

/** Country modifiers from buildings (refreshed monthly; read by countryModifiers). */
export function buildingModifiers(db: ContentDB, state: GameState, tag: string): Record<string, number> {
  const count = builtByOwner(state).get(tag) ?? {};
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(count)) {
    const b = db.buildings.get(id);
    if (!b) continue;
    const k = Math.min(n, b.modifier_cap ?? n);
    for (const [m, v] of Object.entries(b.modifiers)) out[m] = (out[m] ?? 0) + v * k;
  }
  return out;
}

/** Buildings of one type a country has (built plus starting ones). */
export function buildingCount(db: ContentDB, state: GameState, map: SimMap | undefined, cs: CountryState, building: string): { built: number; organic: number } {
  const built = builtByOwner(state).get(cs.tag)?.[building] ?? 0;
  const organic = cs.economy ? organicTotals(db, cs.economy)[building] ?? 0 : 0;
  return { built, organic };
}

// ------------------------------------------------------------------ AI

const AI_MAX_COST_SHARE = 0.03;

/** AI: keep a short queue, placing buildings where the rules allow (populous provinces first). */
export function aiConstruction(ctx: SimContext, cs: CountryState): void {
  const { db, state, rng, map } = ctx;
  const e = cs.economy!;
  if (e.construction.length >= 3 || !map) return;
  const own = provincesOf(state, map, cs.tag).filter((p) => state.provinceController[p.id - 1] === cs.tag);
  if (!own.length) return;
  const roll = rng.next();
  const atWar = state.wars.some((w) => w.attackers.includes(cs.tag) || w.defenders.includes(cs.tag));
  const options: [string, number][] = [
    ["civilian_factory", 0.43],
    ["military_factory", atWar ? 0.35 : 0.24],
    ["infrastructure", 0.28],
    ["refinery", 0.03],
    ["renewable_plant", 0.02],
    ["data_centre", 0.02],
    ["air_base", atWar ? 0.04 : 0.01],
    ["port", 0.01],
  ];
  const total = options.reduce((s, [, w]) => s + w, 0);
  let x = roll * total, pick = "civilian_factory";
  for (const [id, w] of options) { if ((x -= w) <= 0) { pick = id; break; } }
  // only what the budget can carry: one building at most 3% of a year's GDP
  const b = db.buildings.get(pick);
  if (!b || moneyCost(db, b, e) > e.gdp * AI_MAX_COST_SHARE) return;
  // a few tries at populous provinces where it is allowed
  const weights = own.map((q) => q.population);
  for (let i = 0; i < 6; i++) {
    const p = own[rng.weighted(weights)]!;
    if (!canBuild(db, state, map, cs, pick, p.id)) { e.construction.push({ building: pick, province: p.id, progress: 0, spent: 0 }); return; }
  }
}
