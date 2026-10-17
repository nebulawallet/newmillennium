/**
 * AI (Phase 12). Every AI decision is a `Command`, the same objects the player issues, so the
 * planners are pure functions of the state (worker-ready) and the system only applies their output.
 *  - Strategic and diplomatic (once a month per country, spread over the month in buckets):
 *    improve relations, trade agreements, bloc applications, sanctions on aggressors, guarantees for
 *    threatened friends, war justification and declaration for aggressive regimes off the
 *    historical path, foreign influence; recruitment and production upkeep.
 *  - Military (countries at war, every few days in buckets): armies on each enemy front with an
 *    offensive line, through the same battle-plan commands as the player (military/fronts.ts).
 * Weights come from the ruling sub-ideology's `ai_weights` (aggression, trade, integration).
 * Political AI (laws, budget, research, focuses, decisions, events, coalitions) lives with those
 * systems; this module adds what involves other countries and armies.
 */
import { bucketOf, monthlyDue } from "../bucket.ts";
import type { ContentDB } from "../../content/compile.ts";
import { applyCommand, type Command } from "../commands.ts";
import {
  atWarWith,
  blocVote,
  blocsOf,
  defensiveAllies,
  inBloc,
  justification,
  opinion,
} from "../diplomacy/diplomacy.ts";
import { factories } from "../economy/economy.ts";
import { divisionStats } from "../military/war.ts";
import { provinceDistance, templateNeeds, templateStats, type Division } from "../military/military.ts";
import { components, frontPairs, frozenEnemies } from "../military/fronts.ts";
import { rulingSubIdeology } from "../politics/common.ts";
import { countryNeighbours, evalTrigger } from "../scripting/engine.ts";
import type { SimContext, SimMap, System } from "../simulation.ts";
import type { CountryState, GameState } from "../state.ts";

export { bucketOf };

interface Weights {
  aggression: number;
  trade: number;
  integration: number;
  militarism: number;
  influence: number;
}

function weights(db: ContentDB, cs: CountryState): Weights {
  const sub = db.countries.get(cs.tag)?.country ? rulingSubIdeology(db, cs) : null;
  const w = (sub ? db.subIdeologies.get(sub)?.ai_weights : undefined) ?? {};
  return { aggression: w.aggression ?? 1, trade: w.trade ?? 1, integration: w.integration ?? 1, militarism: w.militarism ?? 1, influence: w.foreign_influence ?? 1 };
}

const gdp = (state: GameState, tag: string) => state.countries[tag]?.economy?.gdp ?? 0;

/** Countries ranked by GDP (largest first), cached per month. */
const rankCache = new WeakMap<GameState, { month: number; order: string[] }>();
function gdpRanking(state: GameState): string[] {
  const month = Math.floor(state.day / 30);
  const c = rankCache.get(state);
  if (c && c.month === month) return c.order;
  const order = Object.values(state.countries).filter((x) => x.economy && state.provinceOwner.includes(x.tag)).map((x) => x.tag).sort((a, b) => gdp(state, b) - gdp(state, a));
  rankCache.set(state, { month, order });
  return order;
}

/** Fighting power of a country's divisions (attack and defence, scaled by strength and organisation). */
export function armyPower(db: ContentDB, state: GameState, tag: string): number {
  let p = 0;
  for (const d of state.divisions) if (d.owner === tag) p += divisionPower(db, d);
  return p;
}

function divisionPower(db: ContentDB, d: Division): number {
  const s = divisionStats(db, d);
  return (s.soft + s.hard + s.defence) * d.strength * (0.5 + 0.5 * d.organisation);
}

const isAi = (state: GameState, tag: string) => tag !== state.player && !!state.countries[tag];
const historicalPath = (state: GameState, cs: CountryState) => state.rules.electionMode === "historical" && cs.followsHistory;

// ------------------------------------------------------------------ strategic planner

/** One month of strategic decisions for an AI country. */
export function planStrategic(ctx: SimContext, cs: CountryState): Command[] {
  const { db, state, rng } = ctx;
  const out: Command[] = [];
  const me = cs.tag;
  const d = state.diplomacy;
  const r = db.diplomacyRules;
  const w = weights(db, cs);
  const politics = !!db.countries.get(me)?.country;
  const ranking = gdpRanking(state);
  const rank = ranking.indexOf(me);
  const neighbours = countryNeighbours(ctx, me);
  let pp = cs.politicalPower;
  const reserve = 40;

  if (politics) {
    // improve relations with an important or neighbouring country that does not like us much
    const slots = Math.max(1, Math.round(w.integration * 1.5));
    const using = d.improving.filter(([a]) => a === me).length;
    if (using < Math.min(slots, r.improve_slots) && pp > reserve + r.improve_pp_monthly * 6) {
      const pool = new Set([...ranking.slice(0, 12), ...neighbours]);
      let best: string | null = null, bestScore = 0;
      for (const t of pool) {
        if (t === me || atWarWith(state, me, t) || d.improving.some(([a, b]) => a === me && b === t)) continue;
        const op = opinion(db, state, t, me);
        if (op >= 40) continue;
        const score = (gdp(state, t) / Math.max(1, gdp(state, ranking[0]!))) * 2 + (neighbours.includes(t) ? 0.6 : 0) + (op < 0 ? 0.3 * (2 - w.aggression) : 0);
        if (score > bestScore) { bestScore = score; best = t; }
      }
      if (best) out.push({ type: "improve_relations", tag: me, target: best, on: true });
    }

    // trade agreements with large economies that like us
    const deals = d.tradeDeals.filter(([a, b]) => a === me || b === me).length;
    if (deals < Math.round(1 + 2 * w.trade) && rng.chance(0.5)) {
      const partner = ranking.slice(0, 40).find((t) => t !== me && !d.tradeDeals.some(([a, b]) => (a === me && b === t) || (a === t && b === me)) && !d.sanctions.some(([a, b]) => (a === me && b === t) || (a === t && b === me)) && opinion(db, state, t, me) >= r.trade_opinion + 10 && opinion(db, state, me, t) >= 0);
      if (partner) out.push({ type: "trade_deal", tag: me, target: partner, on: true });
    }

    // bloc applications (off the historical path: real enlargements are events)
    if (!historicalPath(state, cs) && w.integration >= 1 && !d.applications.some((a) => a.tag === me) && rng.chance(0.25)) {
      const threatened = neighbours.some((n) => atWarWith(state, n, me) || justification(state, n, me) || (d.aggressors[n] !== undefined && opinion(db, state, me, n) < -20));
      for (const b of db.blocs.values()) {
        if (inBloc(state, me, b.id)) continue;
        if (b.kind === "military" && !threatened) continue;
        if (!(d.blocs[b.id] ?? []).some((m) => neighbours.includes(m))) continue;
        if (b.join_trigger !== undefined && !evalTrigger(ctx, { tag: me, root: me, from: null }, b.join_trigger)) continue;
        if (!blocVote(db, state, me, b.id).ok) continue;
        out.push({ type: "apply_to_bloc", tag: me, bloc: b.id });
        break;
      }
    }

    // sanctions on aggressors we dislike; lift them once the target is at peace
    if (rank >= 0 && rank < 40 && pp > reserve + r.sanction_pp) {
      for (const [agg, day] of Object.entries(d.aggressors)) {
        if (agg === me || state.day - day > 365 || d.sanctions.some(([a, b]) => a === me && b === agg)) continue;
        if (blocsOf(state, me).some((b) => inBloc(state, agg, b)) || opinion(db, state, me, agg) >= -10) continue;
        out.push({ type: "sanction", tag: me, target: agg, on: true });
        pp -= r.sanction_pp;
        break;
      }
    }
    for (const [a, t] of d.sanctions) {
      if (a !== me || d.aggressors[t] !== undefined || state.wars.some((x) => x.attackers.includes(t) || x.defenders.includes(t))) continue;
      if (rng.chance(0.08)) out.push({ type: "sanction", tag: me, target: t, on: false });
    }

    // major powers guarantee friends that someone is preparing to attack
    if (rank >= 0 && rank < 15 && pp > reserve + r.guarantee_pp && d.guarantees.filter(([g]) => g === me).length < 3) {
      for (const j of d.justifications) {
        if (j.target === me || j.tag === me || d.guarantees.some(([g, t]) => g === me && t === j.target)) continue;
        if (defensiveAllies(db, state, j.tag).includes(me)) continue;
        if (opinion(db, state, me, j.target) > 40 && opinion(db, state, me, j.tag) < 20) {
          out.push({ type: "guarantee", tag: me, target: j.target, on: true });
          pp -= r.guarantee_pp;
          break;
        }
      }
    }

    // aggressive regimes off the historical path may go to war with a much weaker, hostile neighbour
    if (!historicalPath(state, cs) && cs.civilWar === null && w.aggression >= 1.2) {
      const ready = d.justifications.find((j) => j.tag === me && j.done <= state.day && j.expires > state.day);
      if (ready) {
        if (!atWarWith(state, me, ready.target) && warViable(db, state, me, ready.target)) out.push({ type: "declare_war", tag: me, target: ready.target, goal: "conquest" });
      } else if (!d.justifications.some((j) => j.tag === me) && !state.wars.some((x) => x.attackers.includes(me) || x.defenders.includes(me)) && cs.stability > 0.4 && pp > reserve + r.justify_pp && rng.chance(0.03 * w.aggression * (0.5 + state.worldTension))) {
        const target = neighbours.filter((t) => opinion(db, state, me, t) < -30 && warViable(db, state, me, t)).sort((a, b) => armyPower(db, state, a) - armyPower(db, state, b))[0];
        if (target) out.push({ type: "justify_war", tag: me, target });
      }
    }

    // foreign influence: regimes that favour it fund a like-minded party in a hostile neighbour
    if (w.influence >= 1.2 && pp > reserve + 20 && !d.campaigns.some((c) => c.owner === me) && rng.chance(0.03 * w.influence)) {
      const mySub = rulingSubIdeology(db, cs);
      const myGroup = mySub ? db.subIdeologies.get(mySub)?.group : undefined;
      for (const t of neighbours) {
        const tcs = state.countries[t];
        if (!tcs?.active || opinion(db, state, me, t) >= 0) continue;
        const party = Object.keys(tcs.partyPopularity).find((p) => tcs.partyStatus[p] === "active" && db.subIdeologies.get(db.parties.get(p)?.sub_ideology ?? "")?.group === myGroup);
        if (party) {
          out.push({ type: "start_influence", tag: me, target: t, kind: "fund_party", arg: party });
          break;
        }
      }
    }
  }

  out.push(...planForces(ctx, cs, w));
  return out;
}

/** Is a war against `target` sensible: clearly stronger, no great-power protectors, no nuclear arsenal? */
function warViable(db: ContentDB, state: GameState, me: string, target: string): boolean {
  if (!state.countries[target]?.active) return false;
  if (db.warRules.nuclear_states_2000.includes(target)) return false;
  const mine = armyPower(db, state, me);
  let theirs = armyPower(db, state, target);
  for (const ally of defensiveAllies(db, state, target)) if (!defensiveAllies(db, state, me).includes(ally)) theirs += armyPower(db, state, ally);
  return mine > 2 * theirs;
}

/** Recruitment and production upkeep: keep lines on all military factories; train when threatened. */
function planForces(ctx: SimContext, cs: CountryState, w: Weights): Command[] {
  const { db, state, rng } = ctx;
  const out: Command[] = [];
  const m = cs.military;
  if (!m || !cs.economy) return out;
  const me = cs.tag;
  // new military factories go to the largest line
  const mil = factories(db, cs.economy).mil;
  const used = m.lines.reduce((s, l) => s + l.factories, 0);
  if (mil > used && m.lines.length) {
    const line = [...m.lines].sort((a, b) => a.factories - b.factories)[0]!;
    out.push({ type: "set_line_factories", tag: me, line: line.id, factories: Math.min(db.militaryRules.max_factories_per_line, line.factories + (mil - used)) });
  }
  // train when at war, threatened, or under a modest peacetime army
  const atWar = state.wars.some((w) => w.attackers.includes(me) || w.defenders.includes(me)) || !!cs.civilWar;
  // militaristic regimes also build up in peacetime, now and then
  const threatened = state.diplomacy.justifications.some((j) => j.target === me) || state.worldTension > 0.5 || (w.militarism >= 1.4 && rng.chance(0.15));
  const divisions = state.divisions.filter((d) => d.owner === me).length;
  if ((atWar || threatened) && m.training.length < (atWar ? 3 : 1)) {
    const tpl = [...m.templates].reverse().find((t) => {
      const needs = templateNeeds(db, t.units);
      const stock = (f: string) => (db.equipment.get(f)?.variants ?? []).reduce((s, v) => s + (m.stockpile[v.id] ?? 0), 0);
      return m.manpower >= templateStats(db, t.units).manpower && Object.entries(needs).every(([f, n]) => stock(f) >= n * 0.5);
    });
    if (tpl && divisions < 400) out.push({ type: "train_division", tag: me, template: tpl.id });
  }
  return out;
}

// ------------------------------------------------------------------ military planner

/**
 * Armies and battle plans for one AI country at war, through the same commands the player uses
 * (src/sim/military/fronts.ts carries them out):
 *  - one army per enemy front, made of the nearest divisions that can reach it (capped by the
 *    front's length and the enemy's strength; the rest stay home);
 *  - an offensive line on its own provinces the enemy holds, plus the enemy capital when the army
 *    is strong enough (or the war's zone in a limited war), executed at once.
 */
export function planMilitary(ctx: SimContext, tag: string): Command[] {
  const { db, state, map } = ctx;
  if (!map) return [];
  const out: Command[] = [];
  const rules = db.warRules.fronts;
  const pairs = frontPairs(state, map, tag, frozenEnemies(state, tag));
  const fronts = new Map<string, number[]>();
  for (const p of pairs) fronts.set(p.enemyTag, [...(fronts.get(p.enemyTag) ?? []), p.own]);
  const armies = state.armies.filter((a) => a.owner === tag);
  // armies whose enemy is gone (peace, or the front closed) are disbanded; their divisions are free again
  const gone = new Set<number>();
  for (const a of armies) if (a.ai && (!a.front?.enemy || !fronts.has(a.front.enemy))) { out.push({ type: "disband_army", tag, army: a.id }); gone.add(a.id); }
  const live = armies.filter((a) => !gone.has(a.id));
  const assigned = new Set(live.flatMap((a) => a.divisions));
  const free = state.divisions.filter((d) => d.owner === tag && !assigned.has(d.id) && d.strength > 0.2);
  const enemyDivs = new Map<string, number>(), enemyPower = new Map<string, number>();
  for (const d of state.divisions)
    if (fronts.has(d.owner)) {
      enemyDivs.set(d.owner, (enemyDivs.get(d.owner) ?? 0) + 1);
      enemyPower.set(d.owner, (enemyPower.get(d.owner) ?? 0) + divisionPower(db, d));
    }
  const comp = components(state, map, tag);
  const reachable = (d: Division, targets: number[]) => targets.some((t) => comp.get(t) !== undefined && comp.get(t) === comp.get(d.province));
  for (const [enemy, own] of fronts) {
    const provinces = [...new Set(own)];
    let army = live.find((a) => a.ai && a.front?.enemy === enemy);
    const size = army?.divisions.length ?? 0;
    const cap = Math.max(4, Math.ceil(provinces.length * 2), Math.ceil((enemyDivs.get(enemy) ?? 0) * 1.5));
    if (size < cap && free.length) {
      // nearest free divisions first, if they can get there
      free.sort((x, y) => nearest(map, x.province, provinces) - nearest(map, y.province, provinces));
      const take: number[] = [];
      for (let i = 0; i < free.length && size + take.length < cap; ) {
        const d = free[i]!;
        if (reachable(d, provinces)) { take.push(d.id); free.splice(i, 1); } else i++;
      }
      if (take.length) {
        if (army) out.push({ type: "assign_divisions", tag, army: army.id, divisions: take });
        else out.push({ type: "create_army", tag, divisions: take, front: enemy, ai: true });
      }
    }
    // the battle plan
    const lost = provinceIdsWhere(state, (i) => state.provinceOwner[i] === tag && state.provinceController[i] === enemy);
    const limited = state.wars.find((w) => w.goal === "limited" && w.attackers.includes(tag) && w.defenders.includes(enemy) && !w.armedGroup);
    const byId = new Map(state.divisions.map((d) => [d.id, d]));
    const ours = (army?.divisions ?? []).reduce((s, id) => { const d = byId.get(id); return d ? s + divisionPower(db, d) : s; }, 0) || armyPower(db, state, tag);
    let targets = lost;
    if (limited) targets = [...lost, ...(limited.zone ?? []).filter((p) => state.provinceController[p - 1] === enemy)];
    else if (ours >= (enemyPower.get(enemy) ?? 0) * rules.ai_offensive_ratio) {
      const cap2 = capitalHeldBy(map, state, enemy);
      if (cap2) targets = [...lost, cap2];
    }
    if (army) {
      const same = army.offensive.length === targets.length && targets.every((t) => army!.offensive.includes(t));
      if (!same) out.push({ type: "set_offensive", tag, army: army.id, provinces: targets });
      if (army.executing !== targets.length > 0) out.push({ type: "execute_plan", tag, army: army.id, on: targets.length > 0 });
    } else {
      const created = out.find((c) => c.type === "create_army" && c.front === enemy);
      if (created && created.type === "create_army") { created.offensive = targets; created.execute = targets.length > 0; }
    }
  }
  return out;
}

const nearest = (map: SimMap, from: number, to: number[]) => Math.min(...to.map((t) => provinceDistance(map, from, t)));

function provinceIdsWhere(state: GameState, f: (i: number) => boolean): number[] {
  const out: number[] = [];
  for (let i = 0; i < state.provinceOwner.length; i++) if (f(i)) out.push(i + 1);
  return out;
}

/** The enemy's most populous province it still holds (where offensives drive). */
function capitalHeldBy(map: SimMap, state: GameState, tag: string): number {
  let best = 0, pop = -1;
  for (const q of map.provinces) if (state.provinceController[q.id - 1] === tag && state.provinceOwner[q.id - 1] === tag && q.population > pop) { pop = q.population; best = q.id; }
  if (best) return best;
  for (const q of map.provinces) if (state.provinceController[q.id - 1] === tag && q.population > pop) { pop = q.population; best = q.id; }
  return best;
}

// ------------------------------------------------------------------ system

function apply(ctx: SimContext, cmds: Command[]): void {
  for (const c of cmds) applyCommand(ctx, c);
}

export const aiSystem: System = {
  id: "ai",
  daily(ctx) {
    const { state } = ctx;
    // strategic planning: each country once a month, on its bucket day (1st-28th)
    for (const cs of Object.values(state.countries)) {
      // cheap checks first: owning land is a scan over every province
      if (!cs.active || !monthlyDue(cs.tag, state.day) || !isAi(state, cs.tag) || !state.provinceOwner.includes(cs.tag)) continue;
      apply(ctx, planStrategic(ctx, cs));
    }
    // armies at war: every third day per country
    if (!state.wars.length && !Object.values(state.countries).some((c) => c.civilWar)) {
      if (state.day % 30 === 0) for (const a of [...state.armies]) if (a.ai) applyCommand(ctx, { type: "disband_army", tag: a.owner, army: a.id });
      return;
    }
    // historical mode: wars with armed groups are frozen (src/sim/conflicts), so they need no planning
    const frozen = state.rules.electionMode === "historical";
    const fighting = new Set<string>();
    for (const w of state.wars) if (!(frozen && w.armedGroup)) for (const t of [...w.attackers, ...w.defenders]) fighting.add(t);
    for (const cs of Object.values(state.countries)) if (cs.civilWar) { fighting.add(cs.tag); fighting.add(cs.civilWar.rebel); }
    for (const tag of fighting) if (isAi(state, tag) && bucketOf(tag, 3) === state.day % 3) apply(ctx, planMilitary(ctx, tag));
    // AI armies left from a war that ended stand down
    if (state.day % 30 === 0) for (const a of [...state.armies]) if (a.ai && !fighting.has(a.owner)) applyCommand(ctx, { type: "disband_army", tag: a.owner, army: a.id });
  },
};
