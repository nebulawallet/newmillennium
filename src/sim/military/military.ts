/**
 * Production and land units (Phase 9).
 *  - Manpower: a share of the population set by the conscription law (and manpower modifiers).
 *  - Equipment: families with variants unlocked by technologies; stockpiles count each variant.
 *  - Production lines turn military factories into equipment; efficiency grows toward a cap.
 *  - Divisions are trained from templates (battalions), drawing manpower at the start and
 *    equipment at the end, and move province by province along land paths.
 *  - Starting armies come from World Bank armed forces personnel (2000).
 */
import { hasAccess } from "../diplomacy/diplomacy.ts";
import type { ContentDB } from "../../content/compile.ts";
import type { EquipmentDef, EquipmentVariant } from "../../content/schemas/units.ts";
import type { SimContext, SimMap, System } from "../simulation.ts";
import type { CountryState, GameState } from "../state.ts";
import { clamp, countryModifiers } from "../politics/common.ts";
import { factories, incomeTier } from "../economy/economy.ts";

export interface ProductionLine {
  id: number;
  equipment: string;
  variant: string;
  factories: number;
  efficiency: number;
  /** Fractional units produced but not yet delivered. */
  progress: number;
}

export interface Template {
  id: string;
  name: string;
  units: Record<string, number>;
}

export interface TrainingItem {
  template: string;
  progress: number;
  days: number;
  manpower: number;
}

export interface MilitaryState {
  manpower: number;
  stockpile: Record<string, number>;
  lines: ProductionLine[];
  templates: Template[];
  training: TrainingItem[];
  nextLineId: number;
}

export interface Division {
  id: number;
  owner: string;
  name: string;
  template: string;
  units: Record<string, number>;
  /** Equipment held, by variant. */
  equipment: Record<string, number>;
  province: number;
  /** Provinces still to cross, in order. */
  path: number[];
  /** Share of the way to path[0]. */
  progress: number;
  /** 0..1 */
  strength: number;
  organisation: number;
  /** Defence bonus built up while standing still (0..max). */
  entrenchment: number;
  /** Province this division is attacking from where it stands (Phase 10). */
  attacking?: number;
  /** Last day it fought (no organisation recovery for a few days after). */
  lastCombat?: number;
}

// ------------------------------------------------------------------ equipment

/** Variants a country can build: those whose technology it has, newest last. */
export function availableVariants(db: ContentDB, cs: CountryState, family: string): EquipmentVariant[] {
  const e = db.equipment.get(family);
  const done = new Set(cs.research?.completed ?? []);
  return (e?.variants ?? []).filter((v) => !v.requires_tech || done.has(v.requires_tech));
}

export const variantOf = (db: ContentDB, variant: string): { family: EquipmentDef; variant: EquipmentVariant } | undefined => {
  for (const f of db.equipment.values()) {
    const v = f.variants.find((x) => x.id === variant);
    if (v) return { family: f, variant: v };
  }
  return undefined;
};

/** Equipment a template needs at full strength, by family. */
export function templateNeeds(db: ContentDB, units: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [u, n] of Object.entries(units)) for (const [eq, c] of Object.entries(db.subUnits.get(u)?.equipment ?? {})) out[eq] = (out[eq] ?? 0) + c * n;
  return out;
}

export function templateStats(db: ContentDB, units: Record<string, number>): { manpower: number; width: number; speed: number; training: number; organisation: number } {
  let manpower = 0, width = 0, speed = Infinity, training = 0, org = 0, count = 0;
  for (const [u, n] of Object.entries(units)) {
    const s = db.subUnits.get(u);
    if (!s) continue;
    manpower += s.manpower * n;
    width += s.width * n;
    speed = Math.min(speed, s.speed);
    training = Math.max(training, s.training_days);
    org += s.organisation * n;
    count += n;
  }
  return { manpower, width, speed: speed === Infinity ? 4 : speed, training, organisation: count ? org / count : 0 };
}

/** Take up to `count` units of a family from a stockpile, best variants first. */
function draw(db: ContentDB, stock: Record<string, number>, family: string, count: number): Record<string, number> {
  const taken: Record<string, number> = {};
  const variants = [...(db.equipment.get(family)?.variants ?? [])].reverse();
  let left = count;
  for (const v of variants) {
    if (left <= 0) break;
    const have = Math.floor(stock[v.id] ?? 0);
    const t = Math.min(have, left);
    if (t > 0) {
      stock[v.id] = (stock[v.id] ?? 0) - t;
      taken[v.id] = t;
      left -= t;
    }
  }
  return taken;
}

function fill(db: ContentDB, units: Record<string, number>, equipment: Record<string, number>): number {
  const needs = templateNeeds(db, units);
  let worst = 1;
  for (const [family, need] of Object.entries(needs)) {
    const ids = new Set(db.equipment.get(family)?.variants.map((v) => v.id));
    const have = Object.entries(equipment).filter(([v]) => ids.has(v)).reduce((s, [, n]) => s + n, 0);
    worst = Math.min(worst, have / need);
  }
  return clamp(worst, 0, 1);
}

// ------------------------------------------------------------------ manpower

export function manpowerPool(db: ContentDB, cs: CountryState): number {
  const share = db.militaryRules.manpower_share[cs.laws.conscription ?? ""] ?? 0.015;
  const mod = countryModifiers(db, cs).manpower_factor ?? 0;
  return (cs.economy?.population ?? 0) * share * Math.max(0.1, 1 + mod);
}

export const manpowerInService = (db: ContentDB, state: GameState, tag: string) =>
  state.divisions.filter((d) => d.owner === tag).reduce((s, d) => s + templateStats(db, d.units).manpower, 0);

// ------------------------------------------------------------------ starting forces

/**
 * Modern level of the starting army mix (0 infantry only, 1 adds motorised, 2 adds mechanised and
 * armour): armour needs third-generation tank technology plus either a high income or military
 * spending of at least 2.5% of GDP (World Bank 2000).
 */
function modernLevel(db: ContentDB, cs: CountryState): number {
  const e = cs.economy;
  if (!e) return 0;
  const tier = incomeTier((e.gdp * 1e9) / Math.max(1, e.population));
  const mil = (db.worldBank.countries[cs.tag]?.military_spending_pct_gdp as number | undefined) ?? 0;
  const tanks = cs.research?.completed.includes("arm_third_generation_mbt");
  if (tanks && (tier === "high" || mil >= 2.5)) return 2;
  return tier === "high" || tier === "upper_middle" || tanks ? 1 : 0;
}

/** Build the starting military of a country (called from createInitialState). */
export function initialMilitary(db: ContentDB, cs: CountryState, provinces: { id: number; owner: string; population: number }[], nextId: () => number): { military: MilitaryState; divisions: Division[] } {
  const rules = db.militaryRules;
  const level = modernLevel(db, cs);
  const templates: Template[] = rules.templates.filter((t) => t.modern_level <= level).map((t) => ({ id: t.id, name: t.name, units: { ...t.units } }));
  const military: MilitaryState = { manpower: 0, stockpile: {}, lines: [], templates, training: [], nextLineId: 1 };
  const personnel = (db.worldBank.countries[cs.tag]?.armed_forces_personnel as number | undefined) ?? 0;
  const count = Math.min(300, Math.round((personnel * rules.land_share) / rules.personnel_per_division));
  // starting mix: modern armies field some mechanised and armoured divisions
  const mix: [string, number][] = level === 2 ? [["infantry_division", 0.4], ["mechanised_division", 0.4], ["armoured_division", 0.2]] : level === 1 ? [["infantry_division", 0.5], ["motorised_division", 0.5]] : [["infantry_division", 1]];
  const own = provinces.filter((p) => p.owner === cs.tag).sort((a, b) => b.population - a.population);
  const divisions: Division[] = [];
  // the stockpile starts with the best variants this country can build, enough for its divisions plus a reserve
  const needAll: Record<string, number> = {};
  const plan: string[] = [];
  mix.forEach(([tid, share], i) => {
    const n = i === mix.length - 1 ? count - plan.length : Math.round(count * share);
    for (let k = 0; k < n; k++) plan.push(tid);
  });
  for (const tid of plan) {
    const t = templates.find((x) => x.id === tid) ?? templates[0];
    if (!t) continue;
    for (const [f, c] of Object.entries(templateNeeds(db, t.units))) needAll[f] = (needAll[f] ?? 0) + c;
  }
  for (const [family, need] of Object.entries(needAll)) {
    const vs = availableVariants(db, cs, family);
    const best = vs[vs.length - 1] ?? db.equipment.get(family)?.variants[0];
    if (best) military.stockpile[best.id] = Math.ceil(need * (1 + rules.reserve_stockpile));
  }
  const names = new Map<string, number>();
  plan.forEach((tid, i) => {
    const t = templates.find((x) => x.id === tid) ?? templates[0]!;
    const equipment: Record<string, number> = {};
    for (const [f, c] of Object.entries(templateNeeds(db, t.units))) Object.assign(equipment, mergeCounts(equipment, draw(db, military.stockpile, f, c)));
    const n = (names.get(t.id) ?? 0) + 1;
    names.set(t.id, n);
    divisions.push({
      id: nextId(),
      owner: cs.tag,
      name: `${ordinal(n)} ${t.name}`,
      template: t.id,
      units: { ...t.units },
      equipment,
      province: own.length ? own[i % Math.min(own.length, Math.max(3, Math.ceil(own.length / 3)))]!.id : -1,
      path: [],
      progress: 0,
      strength: fill(db, t.units, equipment),
      organisation: 1,
      entrenchment: 0.1,
    });
  });
  const serving = divisions.reduce((sum, d) => sum + templateStats(db, d.units).manpower, 0);
  military.manpower = Math.max(0, manpowerPool(db, cs) - serving);
  return { military, divisions };
}

const mergeCounts = (a: Record<string, number>, b: Record<string, number>) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
};

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

// ------------------------------------------------------------------ movement

/** Kilometres between two province centroids. */
export function provinceDistance(map: SimMap, a: number, b: number): number {
  const pa = map.provinces[a - 1]?.centroid, pb = map.provinces[b - 1]?.centroid;
  if (!pa || !pb) return 100;
  const lat = ((pa[1] + pb[1]) / 2) * (Math.PI / 180);
  const dx = (pa[0] - pb[0]) * Math.cos(lat) * 111.32, dy = (pa[1] - pb[1]) * 110.57;
  return Math.max(10, Math.hypot(dx, dy));
}

/** Are these two countries enemies (a war or a civil war)? */
function hostileTo(state: GameState, a: string, b: string): boolean {
  if (a === b) return false;
  if (state.countries[a]?.civilWar?.rebel === b || state.countries[b]?.civilWar?.rebel === a) return true;
  return state.wars?.some((w) => (w.attackers.includes(a) && w.defenders.includes(b)) || (w.defenders.includes(a) && w.attackers.includes(b))) ?? false;
}

/** Can a division of `owner` enter this province? Own territory, and that of enemies in a war. */
export function canEnter(state: GameState, owner: string, province: number): boolean {
  const o = state.provinceOwner[province - 1];
  const c = state.provinceController[province - 1];
  if (!o) return false;
  if (o === owner || c === owner) return true;
  if (hasAccess(state, owner, o) && !hostileTo(state, owner, c ?? o)) return true;
  return hostileTo(state, owner, o) || (!!c && hostileTo(state, owner, c));
}

/** Shortest land path (A*) from one province to another through provinces the owner may enter. */
export function findPath(map: SimMap, state: GameState, owner: string, from: number, to: number): number[] | null {
  if (from === to) return [];
  if (!canEnter(state, owner, to)) return null;
  // A* with a binary heap (entries may be stale; skipped when popped after closing)
  const heap: [number, number][] = [[0, from]];
  const push = (f: number, p: number) => {
    heap.push([f, p]);
    for (let i = heap.length - 1; i > 0; ) {
      const j = (i - 1) >> 1;
      if (heap[j]![0] <= heap[i]![0]) break;
      [heap[i], heap[j]] = [heap[j]!, heap[i]!];
      i = j;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0]!, last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
        if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m]!, heap[i]!];
        i = m;
      }
    }
    return top;
  };
  const g = new Map<number, number>([[from, 0]]);
  const came = new Map<number, number>();
  const h = (p: number) => provinceDistance(map, p, to);
  const closed = new Set<number>();
  for (let iter = 0; iter < 40000 && heap.length; iter++) {
    const cur = pop()[1];
    if (closed.has(cur)) continue;
    if (cur === to) {
      const path = [cur];
      while (came.has(path[0]!) && came.get(path[0]!) !== from) path.unshift(came.get(path[0]!)!);
      return path;
    }
    closed.add(cur);
    for (const n of map.neighbours.get(cur) ?? []) {
      if (closed.has(n) || !canEnter(state, owner, n)) continue;
      const cost = g.get(cur)! + provinceDistance(map, cur, n);
      if (cost < (g.get(n) ?? Infinity)) {
        g.set(n, cost);
        came.set(n, cur);
        push(cost + h(n), n);
      }
    }
  }
  return null;
}

export function moveDivision(ctx: SimContext, tag: string, id: number, province: number): { ok: boolean; text: string } {
  const d = ctx.state.divisions.find((x) => x.id === id && x.owner === tag);
  if (!d) return { ok: false, text: "No such division." };
  if (!ctx.map) return { ok: false, text: "No map." };
  const path = findPath(ctx.map, ctx.state, tag, d.province, province);
  if (!path) return { ok: false, text: "No route: the division can only move through your own territory or that of an enemy at war." };
  d.path = path;
  d.progress = 0;
  d.attacking = undefined;
  return { ok: true, text: path.length ? `Moving: ${path.length} provinces.` : "Already there." };
}

// ------------------------------------------------------------------ commands

export function addLine(ctx: SimContext, tag: string, family: string, factoryCount: number): { ok: boolean; text: string } {
  const cs = ctx.state.countries[tag];
  const m = cs?.military;
  if (!cs || !m) return { ok: false, text: "No military for this country." };
  const vs = availableVariants(ctx.db, cs, family);
  const best = vs[vs.length - 1];
  if (!best) return { ok: false, text: "No variant of this equipment is available yet: research it first." };
  m.lines.push({ id: m.nextLineId++, equipment: family, variant: best.id, factories: Math.max(1, Math.min(ctx.db.militaryRules.max_factories_per_line, factoryCount)), efficiency: ctx.db.militaryRules.base_efficiency, progress: 0 });
  return { ok: true, text: `Production of ${best.name} started.` };
}

export function trainDivision(ctx: SimContext, tag: string, templateId: string): { ok: boolean; text: string } {
  const cs = ctx.state.countries[tag];
  const m = cs?.military;
  const t = m?.templates.find((x) => x.id === templateId);
  if (!cs || !m || !t) return { ok: false, text: "Unknown template." };
  const st = templateStats(ctx.db, t.units);
  if (m.manpower < st.manpower) return { ok: false, text: `Needs ${st.manpower.toLocaleString("en")} manpower (${Math.floor(m.manpower).toLocaleString("en")} available).` };
  m.manpower -= st.manpower;
  const mods = countryModifiers(ctx.db, cs);
  m.training.push({ template: t.id, progress: 0, days: Math.round(st.training * Math.max(0.3, 1 + (mods.training_time ?? 0))), manpower: st.manpower });
  return { ok: true, text: `Training ${t.name}.` };
}

export function setTemplate(ctx: SimContext, tag: string, t: Template): { ok: boolean; text: string } {
  const m = ctx.state.countries[tag]?.military;
  if (!m) return { ok: false, text: "No military for this country." };
  const units = Object.fromEntries(Object.entries(t.units).filter(([u, n]) => ctx.db.subUnits.has(u) && n > 0));
  if (!Object.keys(units).length) return { ok: false, text: "A template needs at least one battalion." };
  const width = templateStats(ctx.db, units).width;
  if (width > ctx.db.militaryRules.max_division_width) return { ok: false, text: `Too wide: ${width} of ${ctx.db.militaryRules.max_division_width}.` };
  const existing = m.templates.findIndex((x) => x.id === t.id);
  const tpl = { id: t.id, name: t.name.trim() || "Division", units };
  if (existing >= 0) m.templates[existing] = tpl;
  else m.templates.push(tpl);
  return { ok: true, text: `Template ${tpl.name} saved.` };
}

// ------------------------------------------------------------------ system

function capitalProvince(state: GameState, map: SimMap | undefined, tag: string): number {
  let best = -1, pop = -1;
  for (const p of map?.provinces ?? []) if (state.provinceOwner[p.id - 1] === tag && p.population > pop) { pop = p.population; best = p.id; }
  return best;
}

export const militarySystem: System = {
  id: "military",
  daily(ctx) {
    const { db, state, map } = ctx;
    const rules = db.militaryRules;
    for (const cs of Object.values(state.countries)) {
      const m = cs.military;
      if (!cs.active || !m || !cs.economy) continue;
      // production
      if (m.lines.length) {
        const mil = factories(db, cs.economy).mil;
        const assigned = m.lines.reduce((s, l) => s + l.factories, 0);
        const scale = assigned > mil ? mil / assigned : 1;
        const pe = countryModifiers(db, cs).production_efficiency ?? 0;
        for (const l of m.lines) {
          const v = variantOf(db, l.variant)?.variant;
          if (!v) continue;
          const cap = rules.efficiency_cap + pe;
          l.efficiency = Math.min(cap, l.efficiency + rules.efficiency_growth * (cap - l.efficiency));
          l.progress += (l.factories * scale * l.efficiency) / v.cost;
          const whole = Math.floor(l.progress);
          if (whole > 0) {
            l.progress -= whole;
            m.stockpile[l.variant] = (m.stockpile[l.variant] ?? 0) + whole;
          }
        }
      }
      // training
      for (const t of [...m.training]) {
        t.progress += 1;
        if (t.progress < t.days) continue;
        m.training.splice(m.training.indexOf(t), 1);
        const tpl = m.templates.find((x) => x.id === t.template);
        if (!tpl) continue;
        const equipment: Record<string, number> = {};
        for (const [f, c] of Object.entries(templateNeeds(db, tpl.units))) Object.assign(equipment, mergeCounts(equipment, draw(db, m.stockpile, f, c)));
        const n = state.divisions.filter((d) => d.owner === cs.tag && d.template === tpl.id).length + 1;
        state.divisions.push({
          id: state.nextDivisionId++,
          owner: cs.tag,
          name: `${ordinal(n)} ${tpl.name}`,
          template: tpl.id,
          units: { ...tpl.units },
          equipment,
          province: capitalProvince(state, map, cs.tag),
          path: [],
          progress: 0,
          strength: fill(db, tpl.units, equipment),
          organisation: 0.5,
          entrenchment: 0,
        });
        if (cs.tag === state.player) ctx.log(cs.tag, "military", `${ordinal(n)} ${tpl.name} deployed`);
      }
    }
    // movement, attacks, occupation and organisation recovery
    if (map) {
      let occupied = false;
      const enemyAt = (province: number, owner: string) => state.divisions.some((x) => x.province === province && hostileTo(state, x.owner, owner));
      for (const d of state.divisions) {
        if (!d.path.length) {
          if (!d.attacking && state.day - (d.lastCombat ?? -99) > 3) {
            d.organisation = Math.min(1, d.organisation + 0.02);
            d.entrenchment = Math.min(db.warRules.max_entrenchment, d.entrenchment + db.warRules.entrenchment_per_day);
          }
          continue;
        }
        d.entrenchment = 0;
        const next = d.path[0]!;
        if (!canEnter(state, d.owner, next)) {
          d.path = [];
          d.progress = 0;
          continue;
        }
        // enemy divisions in the way: attack from here (the war system fights the battle)
        if (enemyAt(next, d.owner)) {
          d.attacking = next;
          continue;
        }
        d.attacking = undefined;
        const kmPerDay = templateStats(db, d.units).speed * rules.march_hours;
        d.progress += kmPerDay / provinceDistance(map, d.province, next);
        d.organisation = Math.max(0.3, d.organisation - 0.005);
        if (d.progress >= 1) {
          d.province = next;
          d.path.shift();
          d.progress = 0;
          const c = state.provinceController[next - 1];
          if (c && c !== d.owner && hostileTo(state, c, d.owner)) {
            // occupy: an enemy province, or liberate one of our own held by the enemy
            state.provinceController[next - 1] = d.owner;
            occupied = true;
          }
        }
      }
      if (occupied) ctx.emit({ type: "map_changed" });
    }
  },
  monthly(ctx) {
    const { db, state } = ctx;
    for (const cs of Object.values(state.countries)) {
      const m = cs.military;
      if (!cs.active || !m) continue;
      // manpower recovers toward the pool not already serving
      const free = Math.max(0, manpowerPool(db, cs) - manpowerInService(db, state, cs.tag) - m.training.reduce((s, t) => s + t.manpower, 0));
      m.manpower += (free - m.manpower) * db.militaryRules.manpower_recovery * 4;
      // AI: keep equipment lines running for the families its templates use
      if (cs.tag !== state.player && !m.lines.length && cs.economy) {
        const mil = factories(db, cs.economy).mil;
        const families = ["infantry_equipment", "support_equipment", "artillery"];
        families.forEach((f, i) => {
          const share = i === 0 ? 0.5 : 0.25;
          const n = Math.floor(mil * share);
          if (n >= 1) addLine(ctx, cs.tag, f, n);
        });
      }
      // lines switch to the newest variant when its technology arrives
      for (const l of m.lines) {
        const vs = availableVariants(db, cs, l.equipment);
        const best = vs[vs.length - 1];
        if (best && best.id !== l.variant && cs.tag !== state.player) {
          l.variant = best.id;
          l.efficiency = Math.max(db.militaryRules.base_efficiency, l.efficiency * 0.7);
        }
      }
      // divisions refit from the stockpile
      for (const d of state.divisions) {
        if (d.owner !== cs.tag || d.strength >= 1) continue;
        const needs = templateNeeds(db, d.units);
        for (const [f, need] of Object.entries(needs)) {
          const ids = new Set(db.equipment.get(f)?.variants.map((v) => v.id));
          const have = Object.entries(d.equipment).filter(([v]) => ids.has(v)).reduce((s, [, n]) => s + n, 0);
          if (have < need) Object.assign(d.equipment, mergeCounts(d.equipment, draw(db, m.stockpile, f, need - have)));
        }
        d.strength = fill(db, d.units, d.equipment);
      }
    }
  },
};
