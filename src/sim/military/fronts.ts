/**
 * Armies, fronts and battle plans (HOI4 style), shared by the player and the AI.
 *  - An army is a group of divisions with an optional plan: a front against one enemy (or every
 *    enemy), an offensive line (target provinces) and spearhead arrows (province paths).
 *  - Front: the friendly provinces that border provinces held by an enemy at war. Divisions spread
 *    evenly along the army's share of it and hold it; the front follows the border as it moves.
 *  - Offensive (when executing): divisions on the front attack the neighbouring enemy province that
 *    brings them closest to the offensive line, when the divisions next to it have enough power
 *    (`attack_ratio`) or it is empty. Taken provinces move the front, so the army rolls forward.
 *  - Spearhead: the army's fastest divisions push along an arrow, province by province.
 *  - Commanders: the slot stays empty (no generated or real commanders yet).
 * Plans run every `plan_interval_days`; movement and battles stay in military.ts and war.ts.
 */
import type { ContentDB } from "../../content/compile.ts";
import { bucketOf } from "../bucket.ts";
import type { SimContext, SimMap, System } from "../simulation.ts";
import type { GameState } from "../state.ts";
import { canEnter, findPath, provinceDistance, templateStats, type Division } from "./military.ts";
import { divisionStats, hostile } from "./war.ts";

export type ArmyStatus = "idle" | "no_front" | "moving" | "holding" | "advancing" | "waiting" | "objective" | "unreachable";

export interface Army {
  id: number;
  owner: string;
  name: string;
  divisions: number[];
  /** The enemy whose border this army holds; null = every enemy at war. Absent = no front assigned. */
  front?: { enemy: string | null };
  /** Offensive line: enemy provinces to push to. */
  offensive: number[];
  /** Spearhead arrows: ordered province paths. */
  spearheads: number[][];
  /** The battle plan is being carried out (HOI4's execute button). */
  executing: boolean;
  /** Commander slot. Always empty for now: no invented commanders. */
  commander: null;
  /** Managed by the AI planner (it may reshape these armies). */
  ai?: boolean;
  /** Last plan status and counts, for the UI. */
  status: ArmyStatus;
  /** The stretch of front this army holds (friendly provinces), from the last plan run. */
  stretch?: number[];
}

export const STATUS_TEXT: Record<ArmyStatus, string> = {
  idle: "No plan",
  no_front: "No enemy front",
  moving: "Moving into position",
  holding: "Holding the front",
  advancing: "Attacking",
  waiting: "Waiting for strength to attack",
  objective: "Offensive line reached",
  unreachable: "Cannot reach the front",
};

// ------------------------------------------------------------------ symbols

export type MapSymbol = "infantry" | "motorised" | "mechanised" | "armour";

/** The division's map symbol: the symbol of its most numerous line battalion (armour wins ties). */
export function divisionSymbol(db: ContentDB, units: Record<string, number>): MapSymbol {
  const n: Record<MapSymbol, number> = { infantry: 0, motorised: 0, mechanised: 0, armour: 0 };
  for (const [u, c] of Object.entries(units)) {
    const s = db.subUnits.get(u)?.map_symbol;
    if (s) n[s] += c;
  }
  let best: MapSymbol = "infantry";
  for (const s of ["armour", "mechanised", "motorised", "infantry"] as MapSymbol[]) if (n[s] > n[best]) best = s;
  return best;
}

export function divisionPower(db: ContentDB, d: Division): number {
  const s = divisionStats(db, d);
  return (s.soft + s.hard + s.defence * 0.5 + s.breakthrough * 0.5) * d.strength * (0.3 + 0.7 * d.organisation);
}

// ------------------------------------------------------------------ fronts

/** Countries on the same side as `tag` in any of its wars. */
function coBelligerents(state: GameState, tag: string): Set<string> {
  const out = new Set<string>();
  for (const w of state.wars) {
    if (w.attackers.includes(tag)) w.attackers.forEach((t) => out.add(t));
    else if (w.defenders.includes(tag)) w.defenders.forEach((t) => out.add(t));
  }
  out.delete(tag);
  return out;
}

export interface FrontPair { own: number; enemy: number; enemyTag: string }

/**
 * Province pairs along `tag`'s fronts: a friendly province (held by it or a co-belligerent, or
 * where its divisions stand) next to a province held by an enemy at war. `skip` drops enemies
 * (the AI ignores armed-group fronts frozen in historical mode).
 */
export function frontPairs(state: GameState, map: SimMap, tag: string, skip?: Set<string>): FrontPair[] {
  const ctrl = state.provinceController;
  const allies = coBelligerents(state, tag);
  const standing = new Set<number>();
  for (const d of state.divisions) if (d.owner === tag) standing.add(d.province);
  const enemyCache = new Map<string, boolean>();
  const isEnemy = (c: string) => {
    let v = enemyCache.get(c);
    if (v === undefined) enemyCache.set(c, (v = hostile(state, tag, c) && !skip?.has(c)));
    return v;
  };
  const out: FrontPair[] = [];
  for (let i = 0; i < ctrl.length; i++) {
    const c = ctrl[i]!;
    const p = i + 1;
    if (c !== tag && !allies.has(c) && !(standing.has(p) && !hostile(state, tag, c))) continue;
    for (const n of map.neighbours.get(p) ?? []) {
      const e = ctrl[n - 1];
      if (e && e !== tag && isEnemy(e)) out.push({ own: p, enemy: n, enemyTag: e });
    }
  }
  return out;
}

/** Enemies an AI country leaves alone: armed groups whose fronts are frozen in historical mode (src/sim/conflicts). */
export function frozenEnemies(state: GameState, tag: string): Set<string> | undefined {
  if (state.rules.electionMode !== "historical" || tag === state.player) return undefined;
  const out = new Set<string>();
  for (const w of state.wars) {
    if (!w.armedGroup) continue;
    if (w.attackers.includes(tag)) w.defenders.forEach((t) => out.add(t));
    else if (w.defenders.includes(tag)) w.attackers.forEach((t) => out.add(t));
  }
  return out.size ? out : undefined;
}

/** Order provinces along the front's main axis (so armies take neighbouring stretches). */
function orderAlong(map: SimMap, ids: number[]): number[] {
  if (ids.length < 3) return ids;
  const pts = ids.map((id) => {
    const c = map.provinces[id - 1]?.centroid;
    return { x: c?.[0] ?? 0, y: c?.[1] ?? 0 };
  });
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length, my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  let sxx = 0, sxy = 0, syy = 0;
  for (const { x, y } of pts) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2; }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ax = Math.cos(angle), ay = Math.sin(angle);
  return ids.map((id, i) => ({ id, t: (pts[i]!.x - mx) * ax + (pts[i]!.y - my) * ay })).sort((a, b) => a.t - b.t).map((e) => e.id);
}

/** The land provinces each division of `tag` can reach (connected components over enterable land). */
export function components(state: GameState, map: SimMap, tag: string): Map<number, number> {
  const comp = new Map<number, number>();
  let next = 0;
  const starts = new Set<number>();
  for (const d of state.divisions) if (d.owner === tag) starts.add(d.province);
  for (const s of starts) {
    if (comp.has(s)) continue;
    const id = next++;
    const stack = [s];
    comp.set(s, id);
    while (stack.length) {
      const p = stack.pop()!;
      for (const n of map.neighbours.get(p) ?? []) {
        if (comp.has(n) || !canEnter(state, tag, n)) continue;
        comp.set(n, id);
        stack.push(n);
      }
    }
  }
  return comp;
}

// ------------------------------------------------------------------ commands

export function createArmy(state: GameState, tag: string, divisions: number[], name?: string, ai = false): Army {
  const taken = new Set(divisions);
  for (const a of state.armies) if (a.owner === tag) a.divisions = a.divisions.filter((d) => !taken.has(d));
  const n = state.armies.filter((a) => a.owner === tag).length + 1;
  const army: Army = { id: state.nextArmyId++, owner: tag, name: name ?? `${ordinalWord(n)} Army`, divisions: [...taken], offensive: [], spearheads: [], executing: false, commander: null, status: "idle", ...(ai ? { ai: true } : {}) };
  state.armies.push(army);
  dropEmpty(state, tag);
  return army;
}

function dropEmpty(state: GameState, tag: string): void {
  state.armies = state.armies.filter((a) => a.owner !== tag || a.divisions.length > 0);
}

const ORD = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth"];
const ordinalWord = (n: number) => ORD[n - 1] ?? `${n}th`;

export type PlanCommand =
  | { type: "create_army"; tag: string; divisions: number[]; name?: string; front?: string | null; offensive?: number[]; execute?: boolean; ai?: boolean }
  | { type: "disband_army"; tag: string; army: number }
  | { type: "assign_divisions"; tag: string; army: number; divisions: number[] }
  | { type: "set_front"; tag: string; army: number; enemy: string | null | false }
  | { type: "set_offensive"; tag: string; army: number; provinces: number[] }
  | { type: "add_spearhead"; tag: string; army: number; path: number[] }
  | { type: "clear_plan"; tag: string; army: number }
  | { type: "execute_plan"; tag: string; army: number; on: boolean };

export function applyPlanCommand(ctx: SimContext, c: PlanCommand): { ok: boolean; text: string } {
  const { state } = ctx;
  if (c.type === "create_army") {
    const own = c.divisions.filter((id) => state.divisions.some((d) => d.id === id && d.owner === c.tag));
    if (!own.length) return { ok: false, text: "Select divisions first." };
    const a = createArmy(state, c.tag, own, c.name, c.ai);
    if (c.front !== undefined) a.front = { enemy: c.front };
    if (c.offensive) a.offensive = [...c.offensive];
    if (c.execute) a.executing = true;
    return { ok: true, text: `${a.name} formed with ${own.length} division${own.length > 1 ? "s" : ""}.` };
  }
  const army = state.armies.find((a) => a.id === c.army && a.owner === c.tag);
  if (!army) return { ok: false, text: "No such army." };
  switch (c.type) {
    case "disband_army":
      state.armies = state.armies.filter((a) => a !== army);
      for (const d of state.divisions) if (army.divisions.includes(d.id)) d.path = [];
      return { ok: true, text: `${army.name} disbanded.` };
    case "assign_divisions": {
      const own = c.divisions.filter((id) => state.divisions.some((d) => d.id === id && d.owner === c.tag));
      for (const a of state.armies) if (a.owner === c.tag && a !== army) a.divisions = a.divisions.filter((d) => !own.includes(d));
      army.divisions = [...new Set([...army.divisions, ...own])];
      dropEmpty(state, c.tag);
      return { ok: true, text: `${own.length} division${own.length === 1 ? "" : "s"} joined ${army.name}.` };
    }
    case "set_front":
      if (c.enemy === false) delete army.front;
      else army.front = { enemy: c.enemy };
      return { ok: true, text: c.enemy === false ? "Front removed." : "Front assigned." };
    case "set_offensive":
      army.offensive = [...new Set(c.provinces)];
      army.front ??= { enemy: null };
      return { ok: true, text: c.provinces.length ? `Offensive line: ${c.provinces.length} provinces.` : "Offensive line removed." };
    case "add_spearhead":
      if (c.path.length < 1) return { ok: false, text: "Draw the arrow across at least one province." };
      army.spearheads.push(c.path);
      army.front ??= { enemy: null };
      return { ok: true, text: "Spearhead added." };
    case "clear_plan":
      army.offensive = [];
      army.spearheads = [];
      army.executing = false;
      return { ok: true, text: "Battle plan cleared." };
    case "execute_plan":
      army.executing = c.on;
      if (!c.on) for (const d of state.divisions) if (army.divisions.includes(d.id) && d.attacking === undefined) d.path = d.path.slice(0, 1);
      return { ok: true, text: c.on ? `${army.name} executes its plan.` : `${army.name} stops and holds.` };
  }
}

// ------------------------------------------------------------------ executor

interface RunCache {
  pairs: Map<string, FrontPair[]>;
  comps: Map<string, Map<number, number>>;
  power: Map<number, number>;
  enemyPowerAt: Map<string, Map<number, number>>;
}

/** Order a division to a province if it can get there; returns false when there is no route. */
function send(ctx: SimContext, d: Division, to: number): boolean {
  if (d.province === to) { d.path = []; return true; }
  if (d.path.length && d.path[d.path.length - 1] === to) return true;
  const path = findPath(ctx.map!, ctx.state, d.owner, d.province, to);
  if (!path) return false;
  d.path = path;
  d.progress = 0;
  d.attacking = undefined;
  return true;
}

function enemyPowerAt(ctx: SimContext, cache: RunCache, tag: string): Map<number, number> {
  let m = cache.enemyPowerAt.get(tag);
  if (m) return m;
  m = new Map();
  for (const d of ctx.state.divisions) {
    if (!hostile(ctx.state, tag, d.owner)) continue;
    m.set(d.province, (m.get(d.province) ?? 0) + power(ctx.db, cache, d));
  }
  cache.enemyPowerAt.set(tag, m);
  return m;
}

function power(db: ContentDB, cache: RunCache, d: Division): number {
  let p = cache.power.get(d.id);
  if (p === undefined) cache.power.set(d.id, (p = divisionPower(db, d)));
  return p;
}

/** Carry out every army's plan once. `skipFor` drops enemies per owner (frozen armed-group fronts). */
export function runPlans(ctx: SimContext, owners?: Set<string>, skipFor?: (tag: string) => Set<string> | undefined): void {
  const { state, map, db } = ctx;
  if (!map) return;
  const rules = db.warRules.fronts;
  const alive = new Map(state.divisions.map((d) => [d.id, d]));
  const cache: RunCache = { pairs: new Map(), comps: new Map(), power: new Map(), enemyPowerAt: new Map() };
  // armies sharing a front split it in stretches, in army order
  const byFront = new Map<string, Army[]>();
  for (const a of state.armies) {
    a.divisions = a.divisions.filter((id) => alive.get(id)?.owner === a.owner);
    if (owners && !owners.has(a.owner)) continue;
    if (!a.front) { a.status = "idle"; continue; }
    const key = `${a.owner}:${a.front.enemy ?? "*"}`;
    byFront.set(key, [...(byFront.get(key) ?? []), a]);
  }
  state.armies = state.armies.filter((a) => a.divisions.length > 0);
  for (const [key, armies] of byFront) {
    const [tag, enemy] = key.split(":") as [string, string];
    let pairs = cache.pairs.get(tag);
    if (!pairs) cache.pairs.set(tag, (pairs = frontPairs(state, map, tag, skipFor?.(tag))));
    const mine = enemy === "*" ? pairs : pairs.filter((p) => p.enemyTag === enemy);
    let comp = cache.comps.get(tag);
    if (!comp) cache.comps.set(tag, (comp = components(state, map, tag)));
    const live = armies.filter((a) => a.divisions.length);
    if (!mine.length) { for (const a of live) { a.status = "no_front"; a.stretch = []; } continue; }
    const front = orderAlong(map, [...new Set(mine.map((p) => p.own))]);
    const total = live.reduce((s, a) => s + a.divisions.length, 0);
    let start = 0;
    for (const a of live) {
      const share = Math.max(1, Math.round((front.length * a.divisions.length) / Math.max(1, total)));
      const stretch = a === live[live.length - 1] ? front.slice(start) : front.slice(start, start + share);
      start += share;
      runArmy(ctx, cache, a, stretch.length ? stretch : front.slice(-1), mine, comp, alive, rules);
    }
  }
}

function runArmy(
  ctx: SimContext, cache: RunCache, a: Army, stretch: number[], pairs: FrontPair[], comp: Map<number, number>,
  alive: Map<number, Division>, rules: ContentDB["warRules"]["fronts"],
): void {
  const { state, map, db } = ctx;
  const m = map!;
  a.stretch = stretch;
  const divs = a.divisions.map((id) => alive.get(id)!).filter(Boolean);
  // worn-out attackers break off
  for (const d of divs) if (d.attacking && d.organisation < rules.break_off_organisation) { d.attacking = undefined; d.path = []; }
  // divisions that cannot reach the front (another landmass, no route) are left alone
  const frontComps = new Set(stretch.map((p) => comp.get(p)).filter((x) => x !== undefined));
  const reach = divs.filter((d) => frontComps.has(comp.get(d.province) ?? -1));
  if (!reach.length) { a.status = "unreachable"; return; }

  // spearheads: the fastest divisions push along each arrow
  const spear = new Set<number>();
  if (a.executing && a.spearheads.length) {
    const n = Math.max(1, Math.round(reach.length * rules.spearhead_share));
    const fast = [...reach].sort((x, y) => templateStats(db, y.units).speed - templateStats(db, x.units).speed || power(db, cache, y) - power(db, cache, x)).slice(0, n);
    fast.forEach((d, i) => {
      const arrow = a.spearheads[i % a.spearheads.length]!;
      spear.add(d.id);
      if (d.path.length || d.attacking) return;
      const nextIdx = arrow.findIndex((p) => state.provinceController[p - 1] !== d.owner);
      if (nextIdx < 0) return; // arrow complete: the division holds at its tip
      const target = arrow[nextIdx]!;
      if ((m.neighbours.get(d.province) ?? []).includes(target) || nextIdx === 0) {
        if (d.organisation >= rules.attack_organisation || !enemyPowerAt(ctx, cache, d.owner).get(target)) send(ctx, d, target);
      } else send(ctx, d, arrow[nextIdx - 1]!);
    });
  }

  const holders = reach.filter((d) => !spear.has(d.id));
  // offensive: attack toward the offensive line from where divisions stand on the front
  let attacked = false, waiting = false;
  const targetsLeft = a.offensive.filter((p) => state.provinceController[p - 1] !== a.owner && hostile(state, a.owner, state.provinceController[p - 1]!));
  if (a.executing && targetsLeft.length) {
    const onFront = new Set(stretch);
    const enemyPow = enemyPowerAt(ctx, cache, a.owner);
    const distToLine = (p: number) => Math.min(...targetsLeft.map((t) => provinceDistance(m, p, t)));
    // candidate attacks: for each ready division on the front, the enemy neighbour nearest the line
    const plans = new Map<number, Division[]>();
    for (const d of holders) {
      if (d.path.length || d.attacking || d.organisation < rules.attack_organisation || !onFront.has(d.province)) continue;
      const here = distToLine(d.province);
      let best = 0, bestDist = Infinity;
      for (const p of pairs) {
        if (p.own !== d.province || !canEnter(state, d.owner, p.enemy)) continue;
        const dist = distToLine(p.enemy);
        if (dist < bestDist && (dist < here || targetsLeft.includes(p.enemy))) { bestDist = dist; best = p.enemy; }
      }
      // AI armies also take empty enemy provinces off the axis (HOI4's AI fills its front forward)
      if (!best && a.ai) for (const p of pairs) if (p.own === d.province && !enemyPow.get(p.enemy) && canEnter(state, d.owner, p.enemy)) { best = p.enemy; break; }
      if (best) plans.set(best, [...(plans.get(best) ?? []), d]);
    }
    for (const [target, ds] of plans) {
      const def = enemyPow.get(target) ?? 0;
      const att = ds.reduce((s, d) => s + power(db, cache, d), 0);
      if (def === 0) { send(ctx, ds[0]!, target); attacked = true; }
      else if (att >= def * rules.attack_ratio) { for (const d of ds) send(ctx, d, target); attacked = true; }
      else waiting = true;
    }
  }

  // hold: spread the rest evenly along the stretch, keeping divisions that already stand on a slot
  const free = holders.filter((d) => !d.attacking && !(d.path.length && !stretch.includes(d.path[d.path.length - 1]!)) && frontComps.has(comp.get(d.province) ?? -1));
  // threatened provinces (enemy divisions next door) are covered first, then the rest evenly
  const enemyPow = enemyPowerAt(ctx, cache, a.owner);
  const threat = new Map<number, number>();
  for (const p of pairs) {
    const e = enemyPow.get(p.enemy) ?? 0;
    if (e > 0) threat.set(p.own, Math.max(threat.get(p.own) ?? 0, e));
  }
  const threatened = stretch.filter((p) => threat.has(p)).sort((x, y) => threat.get(y)! - threat.get(x)!);
  const slots: number[] = threatened.slice(0, free.length);
  const rest = stretch.filter((p) => !slots.includes(p));
  const spread = Math.min(rest.length, free.length - slots.length);
  for (let i = 0; i < spread; i++) slots.push(rest[Math.floor(((i + 0.5) * rest.length) / spread)]!);
  // more divisions than provinces: the extras reinforce the most threatened, else spread again
  const extra = threatened.length ? threatened : stretch;
  for (let i = 0; slots.length < free.length; i++) slots.push(extra[i % extra.length]!);
  const need = new Map<number, number>();
  for (const s of slots) need.set(s, (need.get(s) ?? 0) + 1);
  const unplaced: Division[] = [];
  for (const d of free) {
    const at = d.path.length ? d.path[d.path.length - 1]! : d.province;
    const k = need.get(at) ?? 0;
    if (k > 0) need.set(at, k - 1);
    else unplaced.push(d);
  }
  let moving = 0;
  for (const [slot, k] of need) {
    for (let j = 0; j < k && unplaced.length; j++) {
      unplaced.sort((x, y) => provinceDistance(m, x.province, slot) - provinceDistance(m, y.province, slot));
      const d = unplaced.shift()!;
      if (d && send(ctx, d, slot) && d.path.length) moving++;
    }
  }
  if (divs.some((d) => d.path.length && !d.attacking)) moving++;
  a.status = a.executing && a.offensive.length && !targetsLeft.length ? "objective"
    : attacked || divs.some((d) => d.attacking) ? "advancing"
    : waiting ? "waiting"
    : moving ? "moving"
    : "holding";
}

/** Carries out battle plans: each owner's armies every `plan_interval_days`, spread over the days. */
export const frontsSystem: System = {
  id: "fronts",
  daily(ctx) {
    const { state, db } = ctx;
    if (!state.armies.length) return;
    const every = Math.max(1, db.warRules.fronts.plan_interval_days);
    const owners = new Set<string>();
    for (const a of state.armies) if (bucketOf(a.owner, every) === state.day % every) owners.add(a.owner);
    if (owners.size) runPlans(ctx, owners, (tag) => frozenEnemies(state, tag));
  },
};
