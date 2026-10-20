/**
 * Diplomacy (Phase 11).
 *  - Opinion of one country for another: ruling-ideology affinity, shared and rival blocs, war,
 *    guarantees, sanctions, trade deals, aggression, improved relations and scripted modifiers.
 *  - Guarantees and defensive blocs call countries into wars against the guaranteed or members.
 *  - Military access lets divisions cross a host's territory; trade deals and economic blocs add
 *    growth; sanctions cut it (relative to 1 January 2000, so the calibrated economy is unchanged).
 *  - Blocs start with their 2000 members; applicants need the members' opinion and the bloc's
 *    join trigger, then wait out an accession period. Historical enlargements are events.
 *  - UN Security Council: five permanent members with a veto and ten elected by regional group
 *    (sourced to 2001, simulated after). Resolutions condemn or sanction a country.
 *  - War needs a justification (days and political power); war without one costs stability,
 *    raises tension and makes the attacker an aggressor in the world's eyes.
 *  - Foreign influence: fund a party abroad or back a coup, at the risk of exposure.
 */
import type { ContentDB } from "../../content/compile.ts";
import { dayOf } from "../date.ts";
import type { SimContext, System } from "../simulation.ts";
import type { CountryState, GameState } from "../state.ts";
import { clamp, rulingSubIdeology } from "../politics/common.ts";
import { evalTrigger, runEffects, shiftPopularity } from "../scripting/engine.ts";
import { countryShortName } from "../politics/unrest.ts";

export type Pair = [string, string];

export interface OpinionMod {
  id: string;
  value: number;
  start: number;
  until: number;
}

export interface Resolution {
  id: number;
  kind: "condemn" | "sanctions";
  target: string;
  proposer: string;
  day: number;
  votes: Record<string, "yes" | "no" | "veto">;
  passed: boolean;
  /** Sanctions resolutions stay in force until this day. */
  until?: number;
}

export interface Campaign {
  id: number;
  owner: string;
  target: string;
  kind: "fund_party" | "back_coup";
  party?: string;
  group?: string;
  start: number;
}

export interface DiplomacyState {
  /** Key "A>B": A's opinion of B gained from B improving relations, and scripted modifiers. */
  relations: Record<string, { improved?: number; mods?: OpinionMod[] }>;
  /** [actor, target]: actor is improving relations with target. */
  improving: Pair[];
  /** [guarantor, guaranteed]. */
  guarantees: Pair[];
  /** [user, host]: user's divisions may cross host's territory. */
  access: Pair[];
  /** [sanctioner, target]. */
  sanctions: Pair[];
  tradeDeals: Pair[];
  blocs: Record<string, string[]>;
  applications: { tag: string; bloc: string; day: number }[];
  /** War justifications: complete on `done`, usable until `expires`. */
  justifications: { tag: string; target: string; start: number; done: number; expires: number }[];
  /** Countries that went to war without a justification (day). */
  aggressors: Record<string, number>;
  unsc: { elected: { tag: string; until: number }[]; resolutions: Resolution[]; nextId: number };
  campaigns: Campaign[];
  nextCampaignId: number;
}

const key = (a: string, b: string) => `${a}>${b}`;
const has = (list: Pair[], a: string, b: string) => list.some(([x, y]) => x === a && y === b);
const hasEither = (list: Pair[], a: string, b: string) => has(list, a, b) || has(list, b, a);

// ------------------------------------------------------------------ setup

export function initialDiplomacy(db: ContentDB, day: number): DiplomacyState {
  const blocs: Record<string, string[]> = {};
  for (const b of db.blocs.values()) blocs[b.id] = [...b.members_2000];
  return {
    relations: {},
    improving: [],
    guarantees: [],
    access: [],
    sanctions: [],
    tradeDeals: [],
    blocs,
    applications: [],
    justifications: [],
    aggressors: {},
    unsc: {
      elected: db.un.elected.filter((e) => dayOf(e.from) <= day && dayOf(e.until) >= day).flatMap((e) => e.tags.map((tag) => ({ tag, until: dayOf(e.until) }))),
      resolutions: [],
      nextId: 1,
    },
    campaigns: [],
    nextCampaignId: 1,
  };
}

export function dip(state: GameState): DiplomacyState {
  return state.diplomacy;
}

// ------------------------------------------------------------------ blocs

export function blocsOf(state: GameState, tag: string): string[] {
  return Object.entries(state.diplomacy.blocs).filter(([, m]) => m.includes(tag)).map(([id]) => id);
}

export function inBloc(state: GameState, tag: string, bloc: string): boolean {
  return !!state.diplomacy.blocs[bloc]?.includes(tag);
}

/** The bloc's name on the current date (e.g. the OAU becomes the African Union). */
export function blocName(db: ContentDB, state: GameState, bloc: string): string {
  const b = db.blocs.get(bloc);
  if (!b) return bloc;
  let name = b.name;
  for (const r of b.renamed) if (dayOf(r.date) <= state.day) name = r.name;
  return name;
}

/** The bloc's name in running text: "the European Union", "NATO". */
export function blocRef(db: ContentDB, state: GameState, bloc: string): string {
  return `${db.blocs.get(bloc)?.article === false ? "" : "the "}${blocName(db, state, bloc)}`;
}

export function joinBloc(ctx: SimContext, tag: string, bloc: string): void {
  const m = (ctx.state.diplomacy.blocs[bloc] ??= []);
  if (m.includes(tag)) return;
  m.push(tag);
  ctx.state.diplomacy.applications = ctx.state.diplomacy.applications.filter((a) => !(a.tag === tag && a.bloc === bloc));
  ctx.log(tag, "diplomacy", `Joins ${blocRef(ctx.db, ctx.state, bloc)}`);
}

export function leaveBloc(ctx: SimContext, tag: string, bloc: string): void {
  const m = ctx.state.diplomacy.blocs[bloc];
  if (!m?.includes(tag)) return;
  ctx.state.diplomacy.blocs[bloc] = m.filter((t) => t !== tag);
  ctx.log(tag, "diplomacy", `Leaves ${blocRef(ctx.db, ctx.state, bloc)}`);
}

// ------------------------------------------------------------------ opinion

function rulingGroup(db: ContentDB, cs: CountryState | undefined): string | null {
  if (!cs || !db.countries.get(cs.tag)?.country) return null;
  const sub = rulingSubIdeology(db, cs);
  return sub ? (db.subIdeologies.get(sub)?.group ?? null) : null;
}

export function atWarWith(state: GameState, a: string, b: string): boolean {
  if (state.countries[a]?.civilWar?.rebel === b || state.countries[b]?.civilWar?.rebel === a) return true;
  return state.wars.some((w) => (w.attackers.includes(a) && w.defenders.includes(b)) || (w.defenders.includes(a) && w.attackers.includes(b)));
}

function modValue(m: OpinionMod, day: number): number {
  if (day >= m.until) return 0;
  return m.value * ((m.until - day) / Math.max(1, m.until - m.start));
}

/** A's opinion of B (-100..100) with its parts. */
export function opinionParts(db: ContentDB, state: GameState, a: string, b: string): { value: number; parts: [string, number][] } {
  const r = db.diplomacyRules;
  const d = state.diplomacy;
  const parts: [string, number][] = [];
  if (a === b) return { value: 100, parts };
  const ga = rulingGroup(db, state.countries[a]), gb = rulingGroup(db, state.countries[b]);
  if (ga && gb) {
    const aff = (db.ideologyGroups.get(ga)?.diplomacy_affinity[gb] ?? 0) * r.ideology_weight;
    if (Math.round(aff)) parts.push([`Governments (${db.ideologyGroups.get(gb)?.name ?? gb})`, aff]);
  }
  const ba = blocsOf(state, a), bb = new Set(blocsOf(state, b));
  for (const id of ba) {
    const def = db.blocs.get(id);
    if (bb.has(id)) parts.push([`Both in ${blocRef(db, state, id)}`, def?.opinion ?? 0]);
    else if (def?.rival && bb.has(def.rival)) parts.push([`Rival bloc (${blocName(db, state, def.rival)})`, r.rival_bloc_opinion]);
  }
  if (atWarWith(state, a, b)) parts.push(["At war", r.at_war_opinion]);
  if (has(d.guarantees, b, a)) parts.push(["Guarantees our independence", r.guarantee_opinion]);
  if (has(d.sanctions, b, a)) parts.push(["Sanctions us", r.sanction_opinion]);
  if (hasEither(d.tradeDeals, a, b)) parts.push(["Trade agreement", r.trade_deal_opinion]);
  const agg = d.aggressors[b];
  if (agg !== undefined && agg + 730 > state.day && !inAnyBlocWith(state, a, b)) parts.push(["Unjustified war", r.aggressor_opinion * (1 - (state.day - agg) / 730)]);
  const rel = d.relations[key(a, b)];
  if (rel?.improved) parts.push(["Improved relations", rel.improved]);
  for (const m of rel?.mods ?? []) {
    const v = modValue(m, state.day);
    if (Math.abs(v) >= 0.5) parts.push([MOD_NAMES[m.id] ?? "Events", v]);
  }
  return { value: clamp(parts.reduce((s, [, v]) => s + v, 0), -100, 100), parts };
}

const MOD_NAMES: Record<string, string> = { exposed: "Interference exposed", event: "Events", resolution: "UN resolution" };

export function opinion(db: ContentDB, state: GameState, a: string, b: string): number {
  return opinionParts(db, state, a, b).value;
}

function inAnyBlocWith(state: GameState, a: string, b: string): boolean {
  return Object.values(state.diplomacy.blocs).some((m) => m.includes(a) && m.includes(b));
}

export function addOpinion(state: GameState, a: string, b: string, value: number, days = 365, id = "event"): void {
  const rel = (state.diplomacy.relations[key(a, b)] ??= {});
  rel.mods = [...(rel.mods ?? []).filter((m) => m.until > state.day), { id, value, start: state.day, until: state.day + days }];
}

// ------------------------------------------------------------------ queries used elsewhere

export function hasAccess(state: GameState, user: string, host: string): boolean {
  return !!state.diplomacy && has(state.diplomacy.access, user, host);
}

export function guarantors(state: GameState, tag: string): string[] {
  return state.diplomacy.guarantees.filter(([, g]) => g === tag).map(([a]) => a);
}

/** Defensive allies of a country: guarantors and members of its defensive blocs. */
export function defensiveAllies(db: ContentDB, state: GameState, tag: string): string[] {
  const out = new Set(guarantors(state, tag));
  for (const id of blocsOf(state, tag)) if (db.blocs.get(id)?.defensive) for (const m of state.diplomacy.blocs[id]!) out.add(m);
  out.delete(tag);
  return [...out];
}

const gdpOf = (state: GameState, tag: string) => state.countries[tag]?.economy?.gdp ?? 0;
const worldGdpCache = new WeakMap<GameState, { day: number; value: number }>();
/** World GDP, computed once per day. */
function worldGdp(state: GameState): number {
  const c = worldGdpCache.get(state);
  if (c && c.day === state.day) return c.value;
  let w = 0;
  for (const cs of Object.values(state.countries)) w += cs.economy?.gdp ?? 0;
  const value = Math.max(1, w);
  worldGdpCache.set(state, { day: state.day, value });
  return value;
}

/** Growth points from trade deals and economic blocs, minus sanctions (absolute; the economy subtracts its 2000 value). */
export function tradeIndex(db: ContentDB, state: GameState, tag: string): number {
  const d = state.diplomacy;
  if (!d) return 0;
  const r = db.diplomacyRules;
  const world = worldGdp(state);
  let trade = 0;
  for (const [x, y] of d.tradeDeals) if (x === tag || y === tag) trade += (r.trade_deal_growth * gdpOf(state, x === tag ? y : x)) / world;
  trade = Math.min(r.trade_growth_cap, trade);
  for (const id of blocsOf(state, tag)) trade += db.blocs.get(id)?.trade_growth ?? 0;
  let sanctioners = 0;
  const by = new Set(d.sanctions.filter(([, t]) => t === tag).map(([s]) => s));
  if (d.unsc.resolutions.some((res) => res.kind === "sanctions" && res.passed && res.target === tag && (res.until ?? 0) > state.day)) {
    for (const cs of Object.values(state.countries)) if (cs.tag !== tag && opinion(db, state, cs.tag, tag) < db.diplomacyRules.veto_opinion) by.add(cs.tag);
  }
  for (const s of by) sanctioners += gdpOf(state, s);
  return trade - r.sanctions_growth * Math.min(1, sanctioners / world);
}

// ------------------------------------------------------------------ actions

type Result = { ok: boolean; text: string };
const fail = (text: string): Result => ({ ok: false, text });

function active(state: GameState, tag: string): CountryState | null {
  const cs = state.countries[tag];
  return cs?.active ? cs : null;
}

function exists(state: GameState, tag: string): boolean {
  return !!state.countries[tag] && state.provinceOwner.includes(tag);
}

export function setImproveRelations(ctx: SimContext, tag: string, target: string, on: boolean): Result {
  const { db, state } = ctx;
  const d = state.diplomacy;
  if (!active(state, tag) || !exists(state, target) || tag === target) return fail("Unknown country.");
  if (!on) {
    d.improving = d.improving.filter(([a, b]) => !(a === tag && b === target));
    return { ok: true, text: "Stopped improving relations." };
  }
  if (has(d.improving, tag, target)) return fail("Already improving relations.");
  if (d.improving.filter(([a]) => a === tag).length >= db.diplomacyRules.improve_slots) return fail(`At most ${db.diplomacyRules.improve_slots} at once.`);
  if (atWarWith(state, tag, target)) return fail("Not while at war.");
  d.improving.push([tag, target]);
  return { ok: true, text: "Improving relations." };
}

export function guarantee(ctx: SimContext, tag: string, target: string, on: boolean): Result {
  const { db, state } = ctx;
  const d = state.diplomacy;
  const cs = active(state, tag);
  if (!cs || !exists(state, target) || tag === target) return fail("Unknown country.");
  if (!on) {
    d.guarantees = d.guarantees.filter(([a, b]) => !(a === tag && b === target));
    ctx.log(tag, "diplomacy", `Ends its guarantee of ${nameOf(ctx, target)}`);
    return { ok: true, text: "Guarantee withdrawn." };
  }
  if (has(d.guarantees, tag, target)) return fail("Already guaranteed.");
  if (atWarWith(state, tag, target)) return fail("Not while at war.");
  if (cs.politicalPower < db.diplomacyRules.guarantee_pp) return fail(`Needs ${db.diplomacyRules.guarantee_pp} political power.`);
  cs.politicalPower -= db.diplomacyRules.guarantee_pp;
  d.guarantees.push([tag, target]);
  ctx.log(tag, "diplomacy", `Guarantees the independence of ${nameOf(ctx, target)}`);
  return { ok: true, text: "Independence guaranteed." };
}

/** Ask for military access; the host decides by its opinion of the requester. */
export function requestAccess(ctx: SimContext, tag: string, host: string, on: boolean): Result {
  const { db, state } = ctx;
  const d = state.diplomacy;
  if (!active(state, tag) || !exists(state, host) || tag === host) return fail("Unknown country.");
  if (!on) {
    d.access = d.access.filter(([a, b]) => !(a === tag && b === host));
    return { ok: true, text: "Military access given up." };
  }
  if (has(d.access, tag, host)) return fail("Access already granted.");
  const op = opinion(db, state, host, tag);
  if (host !== state.player && op < db.diplomacyRules.access_opinion) return fail(`${nameOf(ctx, host)} refuses: its opinion of us is ${Math.round(op)}, it needs ${db.diplomacyRules.access_opinion}.`);
  d.access.push([tag, host]);
  ctx.log(tag, "diplomacy", `Gains military access to ${nameOf(ctx, host)}`);
  return { ok: true, text: "Military access granted." };
}

export function tradeDeal(ctx: SimContext, tag: string, partner: string, on: boolean): Result {
  const { db, state } = ctx;
  const d = state.diplomacy;
  if (!active(state, tag) || !exists(state, partner) || tag === partner) return fail("Unknown country.");
  if (!on) {
    d.tradeDeals = d.tradeDeals.filter(([a, b]) => !((a === tag && b === partner) || (a === partner && b === tag)));
    ctx.log(tag, "diplomacy", `Ends its trade agreement with ${nameOf(ctx, partner)}`);
    return { ok: true, text: "Trade agreement ended." };
  }
  if (hasEither(d.tradeDeals, tag, partner)) return fail("A trade agreement exists.");
  if (hasEither(d.sanctions, tag, partner)) return fail("Not while sanctions are in force.");
  const op = opinion(db, state, partner, tag);
  if (op < db.diplomacyRules.trade_opinion) return fail(`${nameOf(ctx, partner)} refuses: its opinion of us is ${Math.round(op)}.`);
  d.tradeDeals.push([tag, partner]);
  ctx.log(tag, "diplomacy", `Signs a trade agreement with ${nameOf(ctx, partner)}`);
  return { ok: true, text: "Trade agreement signed." };
}

export function sanction(ctx: SimContext, tag: string, target: string, on: boolean): Result {
  const { db, state } = ctx;
  const d = state.diplomacy;
  const cs = active(state, tag);
  if (!cs || !exists(state, target) || tag === target) return fail("Unknown country.");
  if (!on) {
    d.sanctions = d.sanctions.filter(([a, b]) => !(a === tag && b === target));
    ctx.log(tag, "diplomacy", `Lifts its sanctions on ${nameOf(ctx, target)}`);
    return { ok: true, text: "Sanctions lifted." };
  }
  if (has(d.sanctions, tag, target)) return fail("Already sanctioned.");
  if (cs.politicalPower < db.diplomacyRules.sanction_pp) return fail(`Needs ${db.diplomacyRules.sanction_pp} political power.`);
  cs.politicalPower -= db.diplomacyRules.sanction_pp;
  d.sanctions.push([tag, target]);
  d.tradeDeals = d.tradeDeals.filter(([a, b]) => !((a === tag && b === target) || (a === target && b === tag)));
  ctx.log(tag, "diplomacy", `Imposes sanctions on ${nameOf(ctx, target)}`);
  return { ok: true, text: "Sanctions imposed." };
}

export function justifyDays(db: ContentDB, state: GameState): number {
  return Math.round(db.diplomacyRules.justify_days * (1 - 0.5 * state.worldTension));
}

export function justifyWar(ctx: SimContext, tag: string, target: string): Result {
  const { db, state } = ctx;
  const d = state.diplomacy;
  const cs = active(state, tag);
  if (!cs || !exists(state, target) || tag === target) return fail("Unknown country.");
  if (atWarWith(state, tag, target)) return fail("Already at war.");
  if (d.justifications.some((j) => j.tag === tag && j.target === target && j.expires > state.day)) return fail("A justification exists or is under way.");
  if (cs.politicalPower < db.diplomacyRules.justify_pp) return fail(`Needs ${db.diplomacyRules.justify_pp} political power.`);
  cs.politicalPower -= db.diplomacyRules.justify_pp;
  const done = state.day + justifyDays(db, state);
  d.justifications.push({ tag, target, start: state.day, done, expires: done + db.diplomacyRules.justification_valid_days });
  state.worldTension = clamp(state.worldTension + 0.02, 0, 1);
  return { ok: true, text: "Justifying a war goal." };
}

export function justification(state: GameState, tag: string, target: string) {
  return state.diplomacy.justifications.find((j) => j.tag === tag && j.target === target && j.expires > state.day);
}

/** Apply to a bloc: members vote by their opinion of the applicant; accession follows after the bloc's period. */
export function applyToBloc(ctx: SimContext, tag: string, bloc: string): Result {
  const { db, state } = ctx;
  const def = db.blocs.get(bloc);
  if (!active(state, tag) || !def) return fail("Unknown bloc.");
  if (inBloc(state, tag, bloc)) return fail("Already a member.");
  if (state.diplomacy.applications.some((a) => a.tag === tag && a.bloc === bloc)) return fail("An application is under way.");
  if (def.join_trigger !== undefined && !evalTrigger(ctx, { tag, root: tag, from: null }, def.join_trigger)) return fail("Does not meet the conditions.");
  const v = blocVote(db, state, tag, bloc);
  if (!v.ok) return fail(`Rejected: ${v.text}`);
  state.diplomacy.applications.push({ tag, bloc, day: state.day + def.accession_days });
  ctx.log(tag, "diplomacy", `Application to ${blocRef(db, state, bloc)} accepted; accession in ${Math.round(def.accession_days / 365)} years`);
  return { ok: true, text: "Application accepted." };
}

export function blocVote(db: ContentDB, state: GameState, tag: string, bloc: string): Result {
  const members = state.diplomacy.blocs[bloc] ?? [];
  if (!members.length) return { ok: true, text: "No members to object." };
  if (members.some((m) => atWarWith(state, m, tag))) return fail("a member is at war with the applicant");
  const avg = members.reduce((s, m) => s + opinion(db, state, m, tag), 0) / members.length;
  if (avg < db.diplomacyRules.join_opinion) return fail(`members' average opinion ${Math.round(avg)}, needs ${db.diplomacyRules.join_opinion}`);
  return { ok: true, text: `members' average opinion ${Math.round(avg)}` };
}

export function leaveBlocCmd(ctx: SimContext, tag: string, bloc: string): Result {
  const cs = active(ctx.state, tag);
  if (!cs || !inBloc(ctx.state, tag, bloc)) return fail("Not a member.");
  leaveBloc(ctx, tag, bloc);
  cs.stability = clamp(cs.stability - 0.05, 0, 1);
  for (const m of ctx.state.diplomacy.blocs[bloc] ?? []) addOpinion(ctx.state, m, tag, -20, 730);
  return { ok: true, text: "Left the bloc." };
}

// ------------------------------------------------------------------ UN Security Council

export function councilMembers(db: ContentDB, state: GameState): string[] {
  return [...db.un.permanent, ...state.diplomacy.unsc.elected.map((e) => e.tag)];
}

/** How a council member votes: against its friends and itself, for sanctions on those it dislikes or aggressors. */
export function councilVote(db: ContentDB, state: GameState, member: string, target: string): "yes" | "no" | "veto" {
  const permanent = db.un.permanent.includes(member);
  const op = member === target ? 100 : opinion(db, state, member, target);
  const sameMilitaryBloc = blocsOf(state, member).some((b) => db.blocs.get(b)?.kind === "military" && inBloc(state, target, b));
  if (permanent && (member === target || op >= db.diplomacyRules.veto_opinion || sameMilitaryBloc)) return "veto";
  const aggressor = state.diplomacy.aggressors[target] !== undefined && state.diplomacy.aggressors[target]! + 730 > state.day;
  return op < 0 || (aggressor && op < db.diplomacyRules.veto_opinion) ? "yes" : "no";
}

export function proposeResolution(ctx: SimContext, proposer: string, kind: "condemn" | "sanctions", target: string): Result {
  const { db, state } = ctx;
  const council = councilMembers(db, state);
  if (!council.includes(proposer)) return fail("Only Security Council members can propose resolutions.");
  if (!exists(state, target)) return fail("Unknown country.");
  const d = state.diplomacy;
  if (d.unsc.resolutions.some((r) => r.target === target && r.kind === kind && state.day - r.day < 180)) return fail("The council voted on this within six months.");
  const votes: Resolution["votes"] = {};
  for (const m of council) votes[m] = m === proposer ? "yes" : councilVote(db, state, m, target);
  const yes = Object.values(votes).filter((v) => v === "yes").length;
  const vetoed = Object.values(votes).includes("veto");
  const passed = !vetoed && yes >= db.diplomacyRules.unsc_votes_needed;
  const res: Resolution = { id: d.unsc.nextId++, kind, target, proposer, day: state.day, votes, passed };
  if (passed && kind === "sanctions") res.until = state.day + db.diplomacyRules.sanctions_resolution_days;
  d.unsc.resolutions = [...d.unsc.resolutions, res].slice(-20);
  if (passed) {
    const t = state.countries[target];
    if (t) t.stability = clamp(t.stability - 0.03, 0, 1);
    for (const m of council) if (votes[m] === "yes") addOpinion(state, target, m, -15, 730, "resolution");
  }
  const what = kind === "sanctions" ? `sanctions on ${nameOf(ctx, target)}` : `condemning ${nameOf(ctx, target)}`;
  ctx.log(null, "diplomacy", `UN Security Council resolution ${what}: ${passed ? "adopted" : vetoed ? "vetoed" : "rejected"} (${yes} of ${council.length} in favour)`);
  return { ok: passed, text: passed ? "Resolution adopted." : vetoed ? "Resolution vetoed." : "Resolution rejected." };
}

/** Yearly council election: real members while the record lasts, then a seeded pick in each regional group. */
function councilElection(ctx: SimContext): void {
  const { db, state, rng } = ctx;
  const u = state.diplomacy.unsc;
  u.elected = u.elected.filter((e) => e.until >= state.day);
  const recorded = db.un.elected.filter((e) => dayOf(e.from) === state.day);
  if (recorded.length) {
    for (const e of recorded) for (const tag of e.tags) u.elected.push({ tag, until: dayOf(e.until) });
    return;
  }
  const lastDay = db.un.elected.reduce((m, e) => Math.max(m, dayOf(e.until)), 0);
  if (state.day <= lastDay - 365) return; // the record still covers this year
  const until = state.day + 2 * 365;
  const seated = new Set([...db.un.permanent, ...u.elected.map((e) => e.tag)]);
  for (const [group, seats] of Object.entries(db.un.seats)) {
    const need = seats - u.elected.filter((e) => db.un.groups[group]?.includes(e.tag)).length;
    const pool = (db.un.groups[group] ?? []).filter((t) => !seated.has(t) && exists(state, t));
    for (let i = 0; i < need && pool.length; i++) {
      const k = rng.weighted(pool.map((t) => Math.sqrt(gdpOf(state, t) + 1)));
      const tag = pool.splice(k, 1)[0]!;
      u.elected.push({ tag, until });
      seated.add(tag);
    }
  }
}

// ------------------------------------------------------------------ foreign influence

export function startCampaign(ctx: SimContext, owner: string, target: string, kind: Campaign["kind"], arg: string): Result {
  const { db, state } = ctx;
  const cs = active(state, owner);
  const t = active(state, target);
  if (!cs || !t || owner === target) return fail("Influence needs a target with politics data.");
  const d = state.diplomacy;
  if (d.campaigns.some((c) => c.owner === owner && c.target === target)) return fail("A campaign is already under way there.");
  if (kind === "fund_party") {
    if (t.partyStatus[arg] !== "active" && t.partyStatus[arg] !== "extra_parliamentary") return fail("That party is not active.");
    d.campaigns.push({ id: d.nextCampaignId++, owner, target, kind, party: arg, start: state.day });
  } else {
    if (!t.interestGroups[arg]) return fail("Unknown interest group.");
    if (cs.politicalPower < db.diplomacyRules.coup_pp) return fail(`Needs ${db.diplomacyRules.coup_pp} political power.`);
    cs.politicalPower -= db.diplomacyRules.coup_pp;
    d.campaigns.push({ id: d.nextCampaignId++, owner, target, kind, group: arg, start: state.day });
  }
  return { ok: true, text: "Campaign started." };
}

export function stopCampaign(ctx: SimContext, owner: string, id: number): Result {
  const d = ctx.state.diplomacy;
  if (!d.campaigns.some((c) => c.id === id && c.owner === owner)) return fail("No such campaign.");
  d.campaigns = d.campaigns.filter((c) => c.id !== id);
  return { ok: true, text: "Campaign ended." };
}

function exposeCampaign(ctx: SimContext, c: Campaign): void {
  const { db, state } = ctx;
  state.diplomacy.campaigns = state.diplomacy.campaigns.filter((x) => x.id !== c.id);
  addOpinion(state, c.target, c.owner, db.diplomacyRules.influence_exposed_opinion, 1095, "exposed");
  ctx.log(c.target, "diplomacy", `Uncovers ${c.kind === "back_coup" ? "foreign backing for a coup" : "foreign funding of a party"} from ${nameOf(ctx, c.owner)}`);
}

// ------------------------------------------------------------------ war hooks

/** Called by declareWar: allies of the defender join; unjustified wars brand the attacker. */
export function onWarDeclared(ctx: SimContext, warId: number, attacker: string, target: string, justified: boolean, scripted = false, callAllies = true): void {
  const { db, state } = ctx;
  const war = state.wars.find((w) => w.id === warId);
  if (!war) return;
  if (!justified) {
    state.diplomacy.aggressors[attacker] = state.day;
    const a = state.countries[attacker];
    if (a) a.stability = clamp(a.stability + db.diplomacyRules.unjustified_stability, 0, 1);
  }
  state.diplomacy.justifications = state.diplomacy.justifications.filter((j) => !(j.tag === attacker && j.target === target));
  state.diplomacy.access = state.diplomacy.access.filter(([u, h]) => !(u === target && h === attacker) && !(u === attacker && h === target));
  state.diplomacy.tradeDeals = state.diplomacy.tradeDeals.filter(([x, y]) => !((x === attacker && y === target) || (x === target && y === attacker)));
  if (!callAllies) return;
  // allies of the attacker do not defend the target against it
  const attackerAllies = new Set(defensiveAllies(db, state, attacker));
  for (const ally of defensiveAllies(db, state, target)) {
    if (ally === attacker || attackerAllies.has(ally) || war.defenders.includes(ally) || war.attackers.includes(ally)) continue;
    if (!state.countries[ally]?.active) continue;
    war.defenders.push(ally);
    const cs = state.countries[ally]!;
    cs.warSupport = clamp(cs.warSupport + 0.1, 0, 1);
    if (!scripted) cs.followsHistory = false;
    ctx.log(ally, "war", `Joins the ${war.name} in defence of ${nameOf(ctx, target)}`);
  }
}

// ------------------------------------------------------------------ system

const nameOf = (ctx: SimContext, tag: string) => countryShortName(ctx.db, ctx.state, tag);

export const diplomacySystem: System = {
  id: "diplomacy",
  daily(ctx) {
    const { state } = ctx;
    const d = state.diplomacy;
    for (const j of d.justifications)
      if (j.done === state.day && j.tag === state.player) ctx.log(j.tag, "diplomacy", `War goal against ${nameOf(ctx, j.target)} justified`);
  },
  monthly(ctx) {
    const { db, state, rng } = ctx;
    const d = state.diplomacy;
    const r = db.diplomacyRules;
    // improving relations: raises the target's opinion of the actor
    const improving = new Set(d.improving.map(([a, b]) => key(b, a)));
    for (const [a, b] of [...d.improving]) {
      const cs = state.countries[a];
      if (!cs || cs.politicalPower < r.improve_pp_monthly || atWarWith(state, a, b)) {
        d.improving = d.improving.filter(([x, y]) => !(x === a && y === b));
        continue;
      }
      cs.politicalPower -= r.improve_pp_monthly;
      const rel = (d.relations[key(b, a)] ??= {});
      rel.improved = Math.min(r.improve_cap, (rel.improved ?? 0) + r.improve_per_month);
    }
    for (const [k, rel] of Object.entries(d.relations)) {
      if (rel.improved && !improving.has(k)) rel.improved = Math.max(0, rel.improved - 1);
      if (rel.mods) rel.mods = rel.mods.filter((m) => m.until > state.day);
      if (!rel.improved && !rel.mods?.length) delete d.relations[k];
    }
    // accessions
    for (const app of [...d.applications]) {
      if (app.day > state.day) continue;
      d.applications = d.applications.filter((x) => x !== app);
      if (blocVote(db, state, app.tag, app.bloc).ok) joinBloc(ctx, app.tag, app.bloc);
      else ctx.log(app.tag, "diplomacy", `Accession to ${blocRef(db, state, app.bloc)} is blocked by its members`);
    }
    d.justifications = d.justifications.filter((j) => j.expires > state.day);
    for (const [tag, day] of Object.entries(d.aggressors)) if (day + 730 <= state.day) delete d.aggressors[tag];
    // foreign influence
    for (const c of [...d.campaigns]) {
      const owner = state.countries[c.owner], target = state.countries[c.target];
      if (!owner?.active || !target?.active || atWarWith(state, c.owner, c.target)) {
        d.campaigns = d.campaigns.filter((x) => x.id !== c.id);
        continue;
      }
      if (rng.chance(r.influence_detection)) {
        exposeCampaign(ctx, c);
        continue;
      }
      if (c.kind === "fund_party" && c.party) {
        if (owner.politicalPower < r.influence_pp_monthly) {
          d.campaigns = d.campaigns.filter((x) => x.id !== c.id);
          continue;
        }
        owner.politicalPower -= r.influence_pp_monthly;
        shiftPopularity(target, c.party, r.influence_popularity);
      } else if (c.kind === "back_coup" && c.group && state.day - c.start >= r.coup_days) {
        d.campaigns = d.campaigns.filter((x) => x.id !== c.id);
        const influence = target.interestGroups[c.group]?.influence ?? 0;
        const chance = clamp(0.2 + influence + r.coup_success_bonus - target.stability * 0.4, 0.05, 0.9);
        ctx.log(c.owner, "diplomacy", `The coup it backed in ${nameOf(ctx, c.target)} is launched`);
        runEffects(ctx, { tag: c.target, root: c.target, from: c.owner }, [{ trigger_coup: { by: c.group, success_chance: chance } }], "coup_backing");
      }
    }
    // the council answers unjustified wars with a sanctions resolution
    const council = councilMembers(db, state);
    for (const [aggressor, day] of Object.entries(d.aggressors)) {
      if (state.day - day > 31 || !state.wars.some((w) => w.attackers.includes(aggressor))) continue;
      if (d.unsc.resolutions.some((res) => res.target === aggressor && state.day - res.day < 180)) continue;
      const proposer = council.filter((m) => m !== aggressor && m !== state.player).sort((x, y) => opinion(db, state, x, aggressor) - opinion(db, state, y, aggressor))[0];
      if (proposer) proposeResolution(ctx, proposer, "sanctions", aggressor);
    }
  },
  yearly(ctx) {
    councilElection(ctx);
  },
};
