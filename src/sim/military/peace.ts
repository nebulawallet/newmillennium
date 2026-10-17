/**
 * Ending wars (HOI4 style).
 *  - Capitulation: a side's leader capitulates when the enemy holds `capitulation_share` of its
 *    population, or its capital and `capitulation_with_capital` of it.
 *  - Peace conference: the winning side spends a budget (its war score, 100 on a capitulation) on
 *    terms for each defeated country: annex it, take chosen provinces, make it a puppet, or change
 *    its ideology. Terms cost more the larger the country is next to the winners.
 *  - The player chooses when their side wins; when the AI wins against the player it picks terms
 *    itself and the player is told. AI wars among themselves end as before (the winner keeps the
 *    land it holds on a conquest goal).
 *  - Peace offers: a white peace the other side accepts when the war is not going its way.
 *  - After peace: occupied land not taken goes back, divisions in foreign land go home, fronts on a
 *    border that no longer exists are removed, and plans stop executing.
 */
import type { ContentDB } from "../../content/compile.ts";
import type { SimContext } from "../simulation.ts";
import type { GameState, War } from "../state.ts";
import { clamp } from "../politics/common.ts";
import { capitalProvince } from "./military.ts";
import { hostile, makePeace, occupiedShare, warStatus } from "./war.ts";

export type PeaceTerm =
  | { kind: "annex"; target: string }
  | { kind: "provinces"; target: string; provinces: number[] }
  | { kind: "puppet"; target: string }
  | { kind: "ideology"; target: string; group: string };

const pop = (ctx: SimContext, id: number) => ctx.map?.provinces[id - 1]?.population ?? 1;
const landPop = (ctx: SimContext, tags: string[]) => {
  let p = 0;
  ctx.state.provinceOwner.forEach((o, i) => { if (tags.includes(o)) p += pop(ctx, i + 1); });
  return Math.max(1, p);
};

/** Does `tag` hold `target`'s capital (its most populous province)? */
export function capitalHeld(ctx: SimContext, target: string): boolean {
  const cap = capitalProvince(ctx.state, ctx.map, target);
  if (cap < 1) return false;
  const c = ctx.state.provinceController[cap - 1];
  return !!c && c !== target && hostile(ctx.state, target, c);
}

/** Has this side's leader capitulated? */
export function capitulated(ctx: SimContext, war: War, side: "attackers" | "defenders"): boolean {
  if (war.goal === "limited") return false;
  const lead = war[side][0]!;
  const occ = occupiedShare(ctx, lead);
  const r = ctx.db.warRules;
  return occ >= r.capitulation_share || (capitalHeld(ctx, lead) && occ >= r.peace.capitulation_with_capital);
}

/** The conference budget for the winning side. */
export function peaceBudget(ctx: SimContext, war: War, winner: "attackers" | "defenders"): number {
  const st = warStatus(ctx, war)[winner];
  return capitulated(ctx, war, winner === "attackers" ? "defenders" : "attackers") ? Math.max(100, st.score) : st.score;
}

/** War-score cost of a term: bigger countries next to the winners cost more. */
export function termCost(ctx: SimContext, war: War, winner: "attackers" | "defenders", t: PeaceTerm): number {
  const r = ctx.db.warRules.peace;
  const winners = war[winner];
  const size = (ids: number[]) => ids.reduce((s, id) => s + pop(ctx, id), 0) / (landPop(ctx, winners) + landPop(ctx, [t.target]));
  const all = provincesOf(ctx.state, t.target);
  switch (t.kind) {
    case "annex": return Math.round(clamp(r.annex_base + r.annex_per_size * size(all), r.annex_base, 100));
    case "provinces": return Math.round(t.provinces.length * r.province_base + r.annex_per_size * size(t.provinces));
    case "puppet": return Math.round(clamp(r.puppet_share * (r.annex_base + r.annex_per_size * size(all)), 10, 100));
    case "ideology": return r.ideology_cost;
  }
}

export const provincesOf = (state: GameState, tag: string): number[] => {
  const out: number[] = [];
  state.provinceOwner.forEach((o, i) => { if (o === tag) out.push(i + 1); });
  return out;
};

/** The defeated side's parties of an ideology group, most popular first (for "change ideology"). */
export function partiesOfGroup(db: ContentDB, state: GameState, tag: string, group: string): string[] {
  const cs = state.countries[tag];
  const parties = db.countries.get(tag)?.parties ?? [];
  return parties
    .filter((p) => db.subIdeologies.get(p.sub_ideology)?.group === group && (!p.dissolved || String(p.dissolved) > "2000"))
    .sort((a, b) => (cs?.partyPopularity[b.id] ?? 0) - (cs?.partyPopularity[a.id] ?? 0))
    .map((p) => p.id);
}

/** Why a term cannot be taken (or null). */
export function termBlock(ctx: SimContext, t: PeaceTerm): string | null {
  const { state, db } = ctx;
  if (!state.countries[t.target]?.active) return "That country no longer exists.";
  if (t.kind === "provinces" && !t.provinces.every((p) => state.provinceOwner[p - 1] === t.target)) return "Only the defeated country's own provinces can be taken.";
  if (t.kind === "provinces" && !t.provinces.length) return "Pick provinces first.";
  if (t.kind === "ideology" && !partiesOfGroup(db, state, t.target, t.group).length) return "That country has no party of this ideology.";
  return null;
}

// ------------------------------------------------------------------ applying terms

function transfer(ctx: SimContext, ids: number[], to: string): void {
  for (const id of ids) {
    ctx.state.provinceOwner[id - 1] = to;
    ctx.state.provinceController[id - 1] = to;
  }
}

/** Annexation: all land to the winner, the defeated army disbands, the country is gone. */
function annex(ctx: SimContext, target: string, to: string): void {
  const { state } = ctx;
  transfer(ctx, provincesOf(state, target), to);
  for (let i = 0; i < state.provinceController.length; i++) if (state.provinceController[i] === target) state.provinceController[i] = state.provinceOwner[i]!;
  state.divisions = state.divisions.filter((d) => d.owner !== target);
  state.armies = state.armies.filter((a) => a.owner !== target);
  for (const w of state.wars) { w.attackers = w.attackers.filter((t) => t !== target); w.defenders = w.defenders.filter((t) => t !== target); }
  state.wars = state.wars.filter((w) => w.attackers.length && w.defenders.length);
  for (const [sub, over] of Object.entries(state.subjects)) if (sub === target || over === target) delete state.subjects[sub];
  const cs = state.countries[target];
  if (cs) cs.active = false;
}

/** A forced change of government: the most popular party of the chosen ideology, led by its leader of the day. */
function changeIdeology(ctx: SimContext, target: string, group: string): string | null {
  const { db, state } = ctx;
  const cs = state.countries[target];
  const party = partiesOfGroup(db, state, target, group)[0];
  if (!cs || !party) return null;
  const p = db.parties.get(party)!;
  const c = db.countries.get(target)?.country;
  const day = state.day;
  const year = (v: string | number) => String(v).slice(0, 10);
  const today = new Date(Date.UTC(2000, 0, 1) + day * 86400000).toISOString().slice(0, 10);
  const lead = p.leader_history.find((l) => year(l.from) <= today && (l.to === undefined || year(l.to) > today))?.person ?? null;
  // non-democratic groups get a fitting government type; democratic ones a transition to elections
  const gov: Record<string, string> = { socialist_communist: "one_party_state", autocratic: "hybrid_authoritarian", religious: "theocracy", nationalist_populist: "hybrid_authoritarian" };
  const holds = db.governmentTypes.get(cs.govType)?.holds_elections;
  cs.govType = gov[group] ?? (holds ? cs.govType : "transitional_administration");
  cs.rulingParties = [party];
  cs.confidenceAndSupply = [];
  cs.govSinceDay = day;
  if (c && lead) {
    const exec = c.government.effective_executive;
    if (!db.offices.get(exec)?.ex_officio_of) { cs.offices[exec] = [lead]; cs.officeSince[exec] = day; }
  }
  for (const k of Object.keys(cs.historicalOffices)) cs.historicalOffices[k] = false;
  cs.followsHistory = false;
  cs.stability = clamp(cs.stability - 0.15, 0, 1);
  return p.name.en;
}

/** Describe a term for the news and the notice. */
function termText(ctx: SimContext, t: PeaceTerm, to: string): string {
  const name = (tag: string) => ctx.state.dynamicCountries[tag]?.name ?? ctx.db.countryList.find((c) => c.tag === tag)?.name ?? tag;
  switch (t.kind) {
    case "annex": return `${name(to)} annexes ${name(t.target)}`;
    case "provinces": return `${name(t.target)} cedes ${t.provinces.length} province${t.provinces.length > 1 ? "s" : ""} to ${name(to)}`;
    case "puppet": return `${name(t.target)} becomes a puppet of ${name(to)}`;
    case "ideology": return `${name(t.target)} gets a ${ctx.db.ideologyGroups.get(t.group)?.name ?? t.group} government`;
  }
}

/**
 * Conclude a war with terms chosen by the winning side (`to` receives land and subjects). The rest
 * of the occupied land is returned and divisions go home (makePeace).
 */
export function concludePeace(ctx: SimContext, war: War, winner: "attackers" | "defenders", terms: PeaceTerm[], to: string): { ok: boolean; text: string; lines: string[] } {
  const budget = peaceBudget(ctx, war, winner);
  const losers = winner === "attackers" ? war.defenders : war.attackers;
  let spent = 0;
  for (const t of terms) {
    if (!losers.includes(t.target)) return { ok: false, text: "Terms can only be set for the defeated side.", lines: [] };
    const block = termBlock(ctx, t);
    if (block) return { ok: false, text: block, lines: [] };
    spent += termCost(ctx, war, winner, t);
  }
  if (spent > budget) return { ok: false, text: `Those terms cost ${spent} war score; you have ${budget}.`, lines: [] };
  const lines: string[] = [];
  // land first (annexation removes the country, so do it last of all for that target)
  for (const t of terms) if (t.kind === "provinces") { transfer(ctx, t.provinces, to); lines.push(termText(ctx, t, to)); }
  for (const t of terms) if (t.kind === "ideology") { const party = changeIdeology(ctx, t.target, t.group); if (party) lines.push(`${termText(ctx, t, to)} (${party})`); }
  for (const t of terms) if (t.kind === "puppet") { ctx.state.subjects[t.target] = to; lines.push(termText(ctx, t, to)); }
  const annexed = terms.filter((t) => t.kind === "annex");
  // the rest of the war ends normally: what is not taken goes back, divisions go home
  makePeace(ctx, war, winner, false);
  for (const t of annexed) { annex(ctx, t.target, to); lines.push(termText(ctx, t, to)); }
  afterPeace(ctx);
  for (const l of lines) ctx.log(null, "war", l);
  ctx.emit({ type: "map_changed" });
  return { ok: true, text: lines.length ? lines.join("; ") + "." : "Peace signed without terms.", lines };
}

/** After any peace: fronts on a border that no longer exists go, and no plan executes in peace. */
export function afterPeace(ctx: SimContext): void {
  const { state } = ctx;
  for (const a of state.armies) {
    const enemy = a.front?.enemy;
    if (enemy && (!state.countries[enemy]?.active || !state.provinceOwner.includes(enemy))) delete a.front;
    const atWar = enemy ? hostile(state, a.owner, enemy) : state.wars.some((w) => w.attackers.includes(a.owner) || w.defenders.includes(a.owner));
    if (!atWar) a.executing = false;
  }
}

/** Terms the AI imposes when it wins against the player: the land it holds (within budget), and a government of its own ideology if it can afford it. */
export function aiTerms(ctx: SimContext, war: War, winner: "attackers" | "defenders"): PeaceTerm[] {
  const { state, db } = ctx;
  const losers = winner === "attackers" ? war.defenders : war.attackers;
  const winners = war[winner];
  let left = peaceBudget(ctx, war, winner);
  const terms: PeaceTerm[] = [];
  for (const target of losers) {
    if (!state.countries[target]?.active) continue;
    // the land the winners hold, most populous first, as far as the budget goes (never all of it)
    const held = provincesOf(state, target).filter((p) => winners.includes(state.provinceController[p - 1]!)).sort((a, b) => pop(ctx, b) - pop(ctx, a));
    const own = provincesOf(state, target).length;
    const take: number[] = [];
    for (const p of held) {
      if (take.length + 1 >= own) break;
      const cost = termCost(ctx, war, winner, { kind: "provinces", target, provinces: [...take, p] });
      if (cost > left) break;
      take.push(p);
    }
    if (take.length) { terms.push({ kind: "provinces", target, provinces: take }); left -= termCost(ctx, war, winner, terms[terms.length - 1]!); }
    // an ideological regime imposes its own kind of government if it can
    const lead = winners[0]!;
    const sub = state.countries[lead]?.rulingParties[0] ? db.subIdeologies.get(db.parties.get(state.countries[lead]!.rulingParties[0]!)?.sub_ideology ?? "") : undefined;
    const group = sub?.group;
    const cost = db.warRules.peace.ideology_cost;
    if (group && left >= cost && (sub?.ai_weights?.aggression ?? 1) > 1.2 && partiesOfGroup(db, state, target, group).length) { terms.push({ kind: "ideology", target, group }); left -= cost; }
  }
  return terms;
}

/** A white peace offered by `tag`: the other side accepts when it is not winning or is worn out. */
export function offerPeace(ctx: SimContext, tag: string, warId: number): { ok: boolean; text: string } {
  const { state } = ctx;
  const war = state.wars.find((w) => w.id === warId);
  if (!war) return { ok: false, text: "No such war." };
  const mine = war.attackers.includes(tag) ? "attackers" : war.defenders.includes(tag) ? "defenders" : null;
  if (!mine) return { ok: false, text: "You are not in that war." };
  if (war.scripted && state.rules.electionMode === "historical") return { ok: false, text: "This historical war ends on its real date." };
  const theirs = mine === "attackers" ? "defenders" : "attackers";
  const st = warStatus(ctx, war);
  const lead = war[theirs][0]!;
  const support = state.countries[lead]?.warSupport ?? 0;
  const months = (state.day - war.startDay) / 30;
  const accept = st[theirs].score <= st[mine].score + 5 || support < 0.35 || (months > 12 && Math.abs(st[theirs].score - st[mine].score) < 15);
  const name = state.dynamicCountries[lead]?.name ?? ctx.db.countryList.find((c) => c.tag === lead)?.name ?? lead;
  if (!accept) return { ok: false, text: `${name} refuses: its war score is ${st[theirs].score} against your ${st[mine].score}, and its war support ${Math.round(support * 100)}%.` };
  makePeace(ctx, war, null, false);
  afterPeace(ctx);
  return { ok: true, text: `${name} accepts a white peace.` };
}
