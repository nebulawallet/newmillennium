/**
 * Script engine: evaluates triggers and runs effects written in the shared script format
 * (src/content/script/registry.ts) against the game state, and describes them in plain words for
 * tooltips. Effects for systems that arrive in later phases are accepted and described as such.
 */
import type { ContentDB } from "../../content/compile.ts";
import { COUNTRY_SCOPE, LOGIC_KEYS, SCOPES } from "../../content/script/registry.ts";
import { dayOf } from "../date.ts";
import type { SimContext } from "../simulation.ts";
import type { CountryState } from "../state.ts";
import { regimeChange, startCivilWar } from "../politics/unrest.ts";
import { clamp, effectiveLeader, isAvailable, normalise, rulingSubIdeology } from "../politics/common.ts";
import { mergeParty } from "../politics/parties.ts";
import { calibrate } from "../politics/voteModel.ts";
import { initialSchedule } from "../politics/schedule.ts";
import { applyShock } from "../economy/economy.ts";
import { grantTech } from "../research/research.ts";

export interface Scope {
  /** The country the script currently acts on. */
  tag: string;
  /** The country the script started from. */
  root: string;
  /** The country that caused it (e.g. sent the event), if any. */
  from: string | null;
}

type Node = Record<string, unknown>;
const entry = (n: unknown): [string, unknown] => {
  const k = Object.keys(n as Node)[0]!;
  return [k, (n as Node)[k]];
};

// ------------------------------------------------------------------ scopes

/** Countries sharing a land border (from province adjacency and current ownership). */
export function countryNeighbours(ctx: SimContext, tag: string): string[] {
  const nb = ctx.map?.neighbours;
  if (!nb) return [];
  const own = ctx.state.provinceOwner;
  const out = new Set<string>();
  own.forEach((o, i) => {
    if (o !== tag) return;
    for (const n of nb.get(i + 1) ?? []) {
      const other = own[n - 1];
      if (other && other !== tag) out.add(other);
    }
  });
  return [...out].filter((t) => ctx.state.countries[t]?.active);
}

function scopeTargets(ctx: SimContext, scope: Scope, key: string, block: Node): string[] {
  switch (key) {
    case "every_neighbor":
    case "any_neighbor":
    case "random_neighbor":
      return countryNeighbours(ctx, scope.tag);
    case "every_country":
    case "any_country":
      return Object.values(ctx.state.countries).filter((c) => c.active && c.tag !== scope.tag).map((c) => c.tag);
    case "root":
      return [scope.root];
    case "from":
      return scope.from ? [scope.from] : [];
    case COUNTRY_SCOPE:
      return typeof block.tag === "string" && ctx.state.countries[block.tag]?.active ? [block.tag] : [];
    default:
      // allies and overlords arrive with diplomacy (Phase 11); party scopes are not used yet
      return [];
  }
}

// ------------------------------------------------------------------ triggers

export function evalTrigger(ctx: SimContext, scope: Scope, node: unknown): boolean {
  if (node === undefined) return true;
  const [k, v] = entry(node);
  if (LOGIC_KEYS.has(k)) {
    if (k === "not") return !evalTrigger(ctx, scope, v);
    const list = v as unknown[];
    return k === "all" ? list.every((c) => evalTrigger(ctx, scope, c)) : list.some((c) => evalTrigger(ctx, scope, c));
  }
  if (SCOPES.has(k) || k === COUNTRY_SCOPE) {
    const b = v as Node;
    const targets = scopeTargets(ctx, scope, k, b).filter((t) => b.limit === undefined || evalTrigger(ctx, { ...scope, tag: t }, b.limit));
    const test = (t: string) => evalTrigger(ctx, { ...scope, tag: t }, b.trigger);
    return k.startsWith("every") ? targets.length > 0 && targets.every(test) : targets.some(test);
  }
  return trigger(ctx, scope, k, v);
}

function trigger(ctx: SimContext, scope: Scope, k: string, v: unknown): boolean {
  const { db, state } = ctx;
  const cs = state.countries[scope.tag];
  const a = v as Node;
  if (!cs) return false;
  switch (k) {
    case "always": return v === true;
    case "date_after": return state.day >= dayOf(v as string);
    case "date_before": return state.day < dayOf(v as string);
    case "tag": return scope.tag === v;
    case "has_flag": return v as string in cs.flags;
    case "has_global_flag": return v as string in state.globalFlags;
    case "is_ai": return (state.player !== scope.tag) === v;
    case "is_player": return (state.player === scope.tag) === v;
    case "has_tech": return !!cs.research?.completed.includes(v as string);
    case "election_mode": return state.rules.electionMode === v;
    case "ruling_party": return cs.rulingParties[0] === v;
    case "party_in_government": return cs.rulingParties.includes(v as string);
    case "ruling_sub_ideology": return rulingSubIdeology(db, cs) === v;
    case "ruling_ideology_group": {
      const sub = rulingSubIdeology(db, cs);
      return !!sub && db.subIdeologies.get(sub)?.group === v;
    }
    case "government_type": return cs.govType === v;
    case "has_law": return Object.values(cs.laws).includes(v as string);
    case "holds_office": {
      const p = a.person as string;
      if (typeof a.office === "string") return (cs.offices[a.office] ?? state.countries[db.offices.get(a.office)?.tag ?? ""]?.offices[a.office] ?? []).includes(p);
      return Object.values(cs.offices).some((h) => h.includes(p));
    }
    case "person_available": return isAvailable(db, v as string, state.day);
    case "party_exists": return cs.partyStatus[v as string] === "active" || cs.partyStatus[v as string] === "extra_parliamentary";
    case "party_popularity_above": return (cs.partyPopularity[a.party as string] ?? 0) > (a.value as number);
    case "ideology_support_above": return (cs.ideologySupport[a.sub_ideology as string] ?? 0) > (a.value as number);
    case "stability_above": return cs.stability > (v as number);
    case "stability_below": return cs.stability < (v as number);
    case "war_support_above": return cs.warSupport > (v as number);
    case "ig_approval_below": return (cs.interestGroups[a.group as string]?.approval ?? 50) < (a.value as number);
    case "ig_approval_above": return (cs.interestGroups[a.group as string]?.approval ?? 50) > (a.value as number);
    case "ig_influence_above": return (cs.interestGroups[a.group as string]?.influence ?? 0) > (a.value as number);
    case "at_war": return (!!cs.civilWar) === v; // interstate war arrives in Phase 10
    case "at_war_with": return cs.civilWar?.rebel === v;
    case "has_completed_focus": return cs.focus.completed.includes(v as string);
    case "exists": return !!state.countries[v as string]?.active && state.provinceOwner.includes(v as string);
    case "unrest_above": return cs.unrest > (v as number);
    case "political_power_above": return cs.politicalPower > (v as number);
    case "has_civil_war": return (!!cs.civilWar) === v;
    case "follows_history": return (state.rules.electionMode === "historical" && cs.followsHistory) === v;
    case "has_emergency_powers": return (!!db.countries.get(scope.tag)?.country?.government.constitution.emergency_powers) === v;
    case "election_within_days": return cs.schedule.some((e) => e.day - state.day >= 0 && e.day - state.day <= (v as number));
    case "latest_winner": {
      const r = [...state.elections].reverse().find((e) => e.tag === scope.tag && (a.office ? e.office === a.office : true) && (a.chamber ? e.chamber === a.chamber : true));
      return !!r && (r.winner === a.winner || r.winnerParty === a.winner);
    }
    case "ruling_party_popularity_above": return (cs.partyPopularity[cs.rulingParties[0] ?? ""] ?? 0) > (v as number);
    case "gdp_growth_below": return !!cs.economy && cs.economy.growth < (v as number);
    case "gdp_growth_above": return !!cs.economy && cs.economy.growth > (v as number);
    default:
      return false;
  }
}

// ------------------------------------------------------------------ effects

export function runEffects(ctx: SimContext, scope: Scope, effects: unknown[], source: string): void {
  for (const node of effects) {
    const [k, v] = entry(node);
    if (k === "if") {
      const b = v as { limit: unknown; then: unknown[]; else?: unknown[] };
      if (evalTrigger(ctx, scope, b.limit)) runEffects(ctx, scope, b.then, source);
      else if (b.else) runEffects(ctx, scope, b.else, source);
      continue;
    }
    if (k === "random_list") {
      const list = v as { weight: number; effects: unknown[] }[];
      const pick = ctx.rng.weighted(list.map((x) => x.weight));
      runEffects(ctx, scope, list[pick]!.effects, source);
      continue;
    }
    if (SCOPES.has(k) || k === COUNTRY_SCOPE) {
      const b = v as Node;
      let targets = scopeTargets(ctx, scope, k, b).filter((t) => b.limit === undefined || evalTrigger(ctx, { ...scope, tag: t }, b.limit));
      if (k.startsWith("random") && targets.length) targets = [targets[ctx.rng.int(targets.length)]!];
      for (const t of targets) runEffects(ctx, { ...scope, tag: t }, b.effects as unknown[], source);
      continue;
    }
    effect(ctx, scope, k, v, source);
  }
}

/** Popularity change that persists: polls drift toward the model, so the calibration moves too. */
function shiftPopularity(cs: CountryState, party: string, value: number): void {
  const before = cs.partyPopularity[party] ?? 0;
  const after = clamp(before + value, 0.001, 0.95);
  cs.partyPopularity[party] = after;
  cs.partyBias[party] = clamp((cs.partyBias[party] ?? 1) * (after / Math.max(before, 0.001)), 0.02, 50);
}

function effect(ctx: SimContext, scope: Scope, k: string, v: unknown, source: string): void {
  const { db, state } = ctx;
  const cs = state.countries[scope.tag];
  if (!cs) return;
  const a = v as Node;
  switch (k) {
    case "add_stability": cs.stability = clamp(cs.stability + (v as number), 0, 1); break;
    case "add_war_support": cs.warSupport = clamp(cs.warSupport + (v as number), 0, 1); break;
    case "add_political_power": cs.politicalPower = Math.max(0, cs.politicalPower + (v as number)); break;
    case "add_unrest": cs.unrest = clamp(cs.unrest + (v as number), 0, 1); break;
    case "add_economic_mood":
      if (cs.economy) applyShock(ctx, cs, { growth: (v as number) * 4, months: 12 }, source);
      else cs.economicMood = clamp(cs.economicMood + (v as number), -1, 1);
      break;
    case "economic_shock": applyShock(ctx, cs, a as { growth: number; months: number; unemployment?: number; inflation?: number }, source); break;
    case "set_budget":
      if (cs.economy) {
        cs.economy.revenueTarget = clamp(cs.economy.revenueTarget + ((a.revenue as number | undefined) ?? 0), 3, 70);
        cs.economy.spendingTarget = clamp(cs.economy.spendingTarget + ((a.spending as number | undefined) ?? 0), 5, 75);
      }
      break;
    case "set_flag": cs.flags[v as string] = state.day; break;
    case "clear_flag": delete cs.flags[v as string]; break;
    case "set_global_flag": state.globalFlags[v as string] = state.day; break;
    case "add_timed_modifier":
      cs.timedModifiers.push({ modifier: a.modifier as string, value: a.value as number, until: state.day + (a.days as number), source });
      break;
    case "set_leader": {
      const office = a.office as string;
      cs.offices[office] = [a.person as string];
      cs.officeSince[office] = state.day;
      cs.historicalOffices[office] = false;
      break;
    }
    case "set_party_popularity": shiftPopularity(cs, a.party as string, (a.value as number) - (cs.partyPopularity[a.party as string] ?? 0)); break;
    case "add_party_popularity": shiftPopularity(cs, a.party as string, a.value as number); break;
    case "add_ruling_party_popularity": if (cs.rulingParties[0]) shiftPopularity(cs, cs.rulingParties[0], v as number); break;
    case "set_party_leader": cs.partyLeader[a.party as string] = a.person as string; break;
    case "add_ideology_support":
      cs.ideologySupport[a.sub_ideology as string] = Math.max(0, (cs.ideologySupport[a.sub_ideology as string] ?? 0) + (a.value as number));
      cs.ideologySupport = normalise(cs.ideologySupport);
      break;
    case "hold_election": {
      const s = cs.schedule.find((e) => (a.chamber ? e.chamber === a.chamber : e.kind === a.kind));
      if (s) { s.day = state.day + 1; s.snap = true; cs.schedule.sort((x, y) => x.day - y.day); }
      break;
    }
    case "change_law": cs.laws[a.category as string] = a.law as string; cs.lawChangedDay[a.category as string] = state.day; break;
    case "add_interest_group_approval": {
      const g = cs.interestGroups[a.group as string];
      if (!g) break;
      g.approval = clamp(g.approval + (a.value as number), 0, 100);
      cs.igBase[a.group as string] = (cs.igBase[a.group as string] ?? 0) + (a.value as number);
      break;
    }
    case "add_interest_group_influence": {
      const g = cs.interestGroups[a.group as string];
      if (g) g.influence = clamp(g.influence + (a.value as number), 0, 1);
      break;
    }
    case "trigger_coup":
      if (ctx.rng.chance((a.success_chance as number | undefined) ?? 0.5)) regimeChange(ctx, cs, a.by as string, "coup");
      else { cs.unrest = clamp(cs.unrest + 0.1, 0, 1); ctx.log(cs.tag, "coup", `A coup attempt by ${db.interestGroupTypes.get(a.by as string)?.name ?? a.by} fails`); }
      break;
    case "start_civil_war": startCivilWar(ctx, cs, (a.by as string | undefined) ?? "military"); break;
    case "found_party":
      if (cs.partyStatus[v as string] === "not_yet_founded" || cs.partyStatus[v as string] === "banned") {
        cs.partyStatus[v as string] = "active";
        cs.partyPopularity[v as string] ||= 0.01;
        cs.partyBias[v as string] ??= 1;
      }
      break;
    case "ban_party": cs.partyStatus[v as string] = "banned"; cs.rulingParties = cs.rulingParties.filter((p) => p !== v); break;
    case "legalise_party": if (cs.partyStatus[v as string] === "banned") cs.partyStatus[v as string] = "active"; break;
    case "dissolve_party": mergeParty(db, cs, v as string, null); break;
    case "split_party": {
      const from = a.party as string, into = a.into as string;
      const share = (cs.partyPopularity[from] ?? 0) * (a.share as number);
      cs.partyStatus[into] = "active";
      cs.partyBias[into] = cs.partyBias[from] ?? 1;
      shiftPopularity(cs, from, -share);
      cs.partyPopularity[into] = (cs.partyPopularity[into] ?? 0) + share;
      break;
    }
    case "merge_parties": {
      const into = a.into as string;
      if (cs.partyStatus[into] !== "active") { cs.partyStatus[into] = "active"; cs.partyBias[into] ??= 1; }
      for (const p of a.parties as string[]) if (p !== into) mergeParty(db, cs, p, into);
      break;
    }
    case "rename_party": cs.partyStatus[a.to as string] = "active"; mergeParty(db, cs, a.party as string, a.to as string); break;
    case "set_government_type": {
      const gov = db.governmentTypes.get(v as string);
      if (!gov) break;
      cs.govType = gov.id;
      for (const [cat, law] of Object.entries(cs.laws)) if (gov.forbidden_laws.includes(law)) cs.laws[cat] = gov.default_laws[cat] ?? law;
      if (!gov.holds_elections) cs.schedule = [];
      else if (!cs.schedule.length) cs.schedule = initialSchedule(db, cs.tag, state.day);
      cs.followsHistory = false;
      break;
    }
    case "release_country": {
      const r = state.countries[v as string];
      if (r && !r.active) { r.active = true; r.partyBias = calibrate(db, r, state.day); ctx.log(r.tag, "diplomacy", `${db.countryList.find((c) => c.tag === r.tag)?.name ?? r.tag} is released`); }
      break;
    }
    case "country_event": {
      const days = (a.days as number | undefined) ?? 0;
      state.scheduledEvents.push({ event: a.id as string, tag: scope.tag, from: scope.root === scope.tag ? scope.from : scope.root, day: state.day + days });
      break;
    }
    case "person_leaves_office": {
      const p = a.person as string;
      for (const [o, hs] of Object.entries(cs.offices)) {
        if (!hs.includes(p)) continue;
        const office = db.offices.get(o);
        const acting = office?.succession?.acting_office ? (cs.offices[office.succession.acting_office]?.[0] ?? null) : null;
        cs.offices[o] = hs.map((h) => (h === p ? acting : h));
        cs.officeSince[o] = state.day;
        cs.historicalOffices[o] = false;
      }
      break;
    }
    // stored for later systems: traits on people, opinions and war goals (Phase 11/10), techs (Phase 8), money (Phase 7)
    case "add_treasury": if (cs.economy) cs.economy.treasury = Math.max(0, cs.economy.treasury + (v as number)); break;
    case "unlock_tech": grantTech(db, cs, v as string); break;
    case "add_trait":
    case "add_opinion":
    case "add_wargoal":
      break;
  }
}

// ------------------------------------------------------------------ descriptions

const signed = (x: number, pct = false) => `${x >= 0 ? "+" : "−"}${pct ? Math.round(Math.abs(x) * 100) + "%" : Math.abs(x)}`;
const later = (what: string, phase: string) => `${what} (arrives in ${phase})`;

export function describeEffects(db: ContentDB, effects: unknown[], depth = 0): string[] {
  const out: string[] = [];
  const pad = "  ".repeat(depth);
  const name = {
    party: (id: string) => db.parties.get(id)?.name.en ?? id,
    person: (id: string) => db.people.get(id)?.name.en ?? id,
    ig: (id: string) => db.interestGroupTypes.get(id)?.name ?? id,
    sub: (id: string) => db.subIdeologies.get(id)?.name ?? id,
    law: (id: string) => db.lawCategories.get(db.lawCategoryOf.get(id) ?? "")?.laws.find((l) => l.id === id)?.name ?? id,
    tag: (t: string) => db.countries.get(t)?.country?.name.en ?? db.countryList.find((c) => c.tag === t)?.name ?? t,
  };
  for (const node of effects) {
    const [k, v] = entry(node);
    const a = v as Node;
    let line: string | null = null;
    switch (k) {
      case "if": {
        const b = v as { limit: unknown; then: unknown[]; else?: unknown[] };
        out.push(`${pad}If ${describeTrigger(db, b.limit).join("; ")}:`);
        out.push(...describeEffects(db, b.then, depth + 1));
        if (b.else) { out.push(`${pad}Otherwise:`); out.push(...describeEffects(db, b.else, depth + 1)); }
        continue;
      }
      case "random_list": {
        const list = v as { weight: number; effects: unknown[] }[];
        const total = list.reduce((s, x) => s + x.weight, 0) || 1;
        out.push(`${pad}One of:`);
        for (const x of list) {
          out.push(`${pad}  ${Math.round((x.weight / total) * 100)}% chance:`);
          out.push(...describeEffects(db, x.effects, depth + 2));
        }
        continue;
      }
      case "add_stability": line = `Stability ${signed(v as number, true)}`; break;
      case "add_war_support": line = `War support ${signed(v as number, true)}`; break;
      case "add_political_power": line = `Political power ${signed(v as number)}`; break;
      case "add_unrest": line = `Unrest ${signed(v as number, true)}`; break;
      case "add_economic_mood": line = `GDP growth ${signed(Math.round((v as number) * 40) / 10)} points, fading over a year`; break;
      case "set_flag": case "clear_flag": case "set_global_flag": line = null; break;
      case "add_timed_modifier": {
        const m = db.modifiers.get(a.modifier as string);
        const val = m?.display === "percent" ? signed(a.value as number, true) : signed(a.value as number);
        line = `${m?.name ?? a.modifier} ${val} for ${a.days} days`;
        break;
      }
      case "set_leader": line = `${name.person(a.person as string)} takes office as ${db.offices.get(a.office as string)?.title.en ?? a.office}`; break;
      case "set_party_popularity": line = `${name.party(a.party as string)} support set to ${Math.round((a.value as number) * 100)}%`; break;
      case "add_party_popularity": line = `${name.party(a.party as string)} support ${signed(a.value as number, true)}`; break;
      case "add_ruling_party_popularity": line = `Governing party support ${signed(v as number, true)}`; break;
      case "set_party_leader": line = `${name.person(a.person as string)} leads ${name.party(a.party as string)}`; break;
      case "add_ideology_support": line = `${name.sub(a.sub_ideology as string)} support ${signed(a.value as number, true)}`; break;
      case "hold_election": line = "An early election is held"; break;
      case "change_law": line = `Enact ${name.law(a.law as string)}`; break;
      case "add_interest_group_approval": line = `${name.ig(a.group as string)} approval ${signed(a.value as number)}`; break;
      case "add_interest_group_influence": line = `${name.ig(a.group as string)} influence ${signed(a.value as number, true)}`; break;
      case "trigger_coup": line = `${name.ig(a.by as string)} attempt a coup`; break;
      case "start_civil_war": line = "Civil war breaks out"; break;
      case "found_party": line = `${name.party(v as string)} is founded`; break;
      case "ban_party": line = `${name.party(v as string)} is banned`; break;
      case "legalise_party": line = `${name.party(v as string)} is legalised`; break;
      case "dissolve_party": line = `${name.party(v as string)} is dissolved`; break;
      case "split_party": line = `${name.party(a.into as string)} splits from ${name.party(a.party as string)}`; break;
      case "merge_parties": line = `Parties merge into ${name.party(a.into as string)}`; break;
      case "rename_party": line = `${name.party(a.party as string)} becomes ${name.party(a.to as string)}`; break;
      case "set_government_type": line = `Government becomes: ${db.governmentTypes.get(v as string)?.name ?? v}`; break;
      case "release_country": line = `${name.tag(v as string)} is released`; break;
      case "country_event": line = `Leads to: ${(db.events.get(a.id as string)?.title) ?? a.id}`; break;
      case "person_leaves_office": line = `${name.person(a.person as string)} leaves office`; break;
      case "add_treasury": line = `Reserves ${signed(v as number)} billion USD`; break;
      case "economic_shock": {
        const parts = [`GDP growth ${signed(a.growth as number)} points`];
        if (a.unemployment) parts.push(`unemployment ${signed(a.unemployment as number)} points`);
        if (a.inflation) parts.push(`inflation ${signed(a.inflation as number)} points`);
        line = `${parts.join(", ")}, fading over ${a.months} months`;
        break;
      }
      case "set_budget": {
        const parts = [];
        if (a.revenue) parts.push(`taxes ${signed(a.revenue as number)}`);
        if (a.spending) parts.push(`spending ${signed(a.spending as number)}`);
        line = `Budget: ${parts.join(", ")} points of GDP`;
        break;
      }
      case "unlock_tech": line = `Technology: ${db.techs.get(v as string)?.name ?? v}`; break;
      case "add_wargoal": line = later(`War goal against ${name.tag(a.target as string)}`, "Phase 10"); break;
      case "add_opinion": line = later(`Opinion ${signed(a.value as number)}`, "Phase 11"); break;
      case "add_trait": line = `${name.person(a.person as string)} gains a trait`; break;
      default:
        if (SCOPES.has(k) || k === COUNTRY_SCOPE) {
          const b = v as Node;
          const who = k === COUNTRY_SCOPE ? name.tag(b.tag as string) : k.replace(/_/g, " ");
          out.push(`${pad}${who[0]!.toUpperCase()}${who.slice(1)}:`);
          out.push(...describeEffects(db, (b.effects as unknown[]) ?? [], depth + 1));
          continue;
        }
        line = k.replace(/_/g, " ");
    }
    if (line) out.push(pad + line);
  }
  return out;
}

export function describeTrigger(db: ContentDB, node: unknown): string[] {
  if (node === undefined) return [];
  const [k, v] = entry(node);
  const a = v as Node;
  const yes = (b: unknown, t: string, f: string) => (b === false ? f : t);
  switch (k) {
    case "all": return (v as unknown[]).flatMap((c) => describeTrigger(db, c));
    case "any": return [`one of: ${(v as unknown[]).map((c) => describeTrigger(db, c).join(" and ")).join(" / ")}`];
    case "not": return [`not (${describeTrigger(db, v).join(" and ")})`];
    case "date_after": return [`on or after ${v}`];
    case "date_before": return [`before ${v}`];
    case "tag": return [`country is ${db.countries.get(v as string)?.country?.name.en ?? v}`];
    case "ruling_party": return [`${db.parties.get(v as string)?.name.en ?? v} leads the government`];
    case "party_in_government": return [`${db.parties.get(v as string)?.name.en ?? v} is in government`];
    case "ruling_sub_ideology": return [`ruling ideology is ${db.subIdeologies.get(v as string)?.name ?? v}`];
    case "ruling_ideology_group": return [`ruling ideology group is ${db.ideologyGroups.get(v as string)?.name ?? v}`];
    case "government_type": return [`government is ${db.governmentTypes.get(v as string)?.name ?? v}`];
    case "has_law": return [`${db.lawCategories.get(db.lawCategoryOf.get(v as string) ?? "")?.laws.find((l) => l.id === v)?.name ?? v} in force`];
    case "holds_office": return [`${db.people.get(a.person as string)?.name.en ?? a.person} holds ${a.office ? db.offices.get(a.office as string)?.title.en : "office"}`];
    case "stability_above": return [`stability above ${Math.round((v as number) * 100)}%`];
    case "stability_below": return [`stability below ${Math.round((v as number) * 100)}%`];
    case "unrest_above": return [`unrest above ${Math.round((v as number) * 100)}%`];
    case "political_power_above": return [`political power above ${v}`];
    case "ig_approval_below": return [`${db.interestGroupTypes.get(a.group as string)?.name} approval below ${a.value}`];
    case "ig_approval_above": return [`${db.interestGroupTypes.get(a.group as string)?.name} approval above ${a.value}`];
    case "has_completed_focus": return [`focus completed: ${findFocusName(db, v as string)}`];
    case "has_civil_war": return [yes(v, "in a civil war", "not in a civil war")];
    case "follows_history": return [yes(v, "still following history", "history has diverged")];
    case "has_emergency_powers": return [yes(v, "the constitution allows emergency powers", "no emergency powers")];
    case "election_within_days": return [`an election within ${v} days`];
    case "latest_winner": return [`${db.people.get(a.winner as string)?.name.en ?? db.parties.get(a.winner as string)?.name.en ?? a.winner} won the last election`];
    case "is_player": return [yes(v, "your country", "an AI country")];
    case "is_ai": return [yes(v, "an AI country", "your country")];
    case "has_tech": return [`researched ${db.techs.get(v as string)?.name ?? v}`];
    case "gdp_growth_below": return [`GDP growth below ${v}%`];
    case "gdp_growth_above": return [`GDP growth above ${v}%`];
    case "has_flag": case "has_global_flag": return [];
    case "always": return v ? [] : ["never"];
    default: return [k.replace(/_/g, " ")];
  }
}

function findFocusName(db: ContentDB, id: string): string {
  for (const t of db.focusTrees.values()) {
    const f = t.focuses.find((x) => x.id === id);
    if (f) return f.name;
  }
  return id;
}

export { effectiveLeader };
