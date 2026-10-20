/**
 * Changes of regime by a real party: alternative focus paths (`install_government`) and the peace
 * conference's "change ideology" term. Only parties in the content take power; a country without a
 * party of the wanted ideology has no such path (docs/FOCUS_TREES_PLAN.md, 1a).
 */
import type { ContentDB } from "../../content/compile.ts";
import type { SimContext } from "../simulation.ts";
import type { CountryState, GameState } from "../state.ts";
import { leaveBloc } from "../diplomacy/diplomacy.ts";
import { initialSchedule } from "./schedule.ts";
import { clamp, isAvailable } from "./common.ts";
import { executiveOffice } from "./common.ts";

/** Party statuses from which a party can take power (a banned or exiled party can, a dissolved one cannot). */
const LIVE = new Set(["active", "extra_parliamentary", "banned", "exiled"]);

/** A country's live parties of an ideology group, most popular first. */
export function partiesOfGroup(db: ContentDB, state: GameState, tag: string, group: string): string[] {
  const cs = state.countries[tag];
  const parties = db.countries.get(tag)?.parties ?? [];
  return parties
    .filter((p) => db.subIdeologies.get(p.sub_ideology)?.group === group && LIVE.has(cs?.partyStatus[p.id] ?? p.status_2000))
    .sort((a, b) => (cs?.partyPopularity[b.id] ?? 0) - (cs?.partyPopularity[a.id] ?? 0))
    .map((p) => p.id);
}

export interface InstallSpec {
  /** A named party of the country; otherwise the most popular live party of `group`. */
  party?: string;
  group?: string;
  /** Omitted: the current type if it holds elections, otherwise a transitional administration. */
  government_type?: string;
  /** A named person; otherwise the party's leader of the day, or an unnamed council. */
  leader?: string;
}

/** The party an install would bring to power (null when the country has none that fits). */
export function installParty(db: ContentDB, state: GameState, tag: string, spec: Pick<InstallSpec, "party" | "group">): string | null {
  const cs = state.countries[tag];
  if (spec.party) return cs && LIVE.has(cs.partyStatus[spec.party] ?? "") ? spec.party : null;
  return spec.group ? (partiesOfGroup(db, state, tag, spec.group)[0] ?? null) : null;
}

/**
 * A real party takes power: it becomes the sole ruling party, its leader of the day takes the
 * executive office, the government type changes, and the laws follow the new ideology and the new
 * government type. The country leaves the historical path. Returns the party id, or null.
 */
export function installGovernment(ctx: SimContext, cs: CountryState, spec: InstallSpec): string | null {
  const { db, state } = ctx;
  const party = installParty(db, state, cs.tag, spec);
  const current = db.governmentTypes.get(cs.govType);
  const gov = db.governmentTypes.get(spec.government_type ?? (current?.holds_elections ? cs.govType : "transitional_administration"));
  if (!party || !gov) return null;
  const c = db.countries.get(cs.tag)?.country;
  const sub = db.subIdeologies.get(db.parties.get(party)?.sub_ideology ?? "");

  cs.partyStatus[party] = "active";
  cs.rulingParties = [party];
  cs.confidenceAndSupply = [];
  cs.govSinceDay = state.day;
  cs.govType = gov.id;

  const named = spec.leader && isAvailable(db, spec.leader, state.day) ? spec.leader : null;
  const own = cs.partyLeader[party];
  const leader = named ?? (own && isAvailable(db, own, state.day) ? own : null);
  if (c) {
    const exec = executiveOffice(db, cs) ?? c.government.effective_executive;
    if (!db.offices.get(exec)?.ex_officio_of) { cs.offices[exec] = [leader]; cs.officeSince[exec] = state.day; }
  }
  for (const k of Object.keys(cs.historicalOffices)) cs.historicalOffices[k] = false;
  cs.followsHistory = false;

  // laws: the new ideology's preferred laws, then whatever the government type forbids
  for (const [cat, prefs] of Object.entries(sub?.laws.preferred ?? {})) {
    const law = prefs.find((l) => db.lawCategoryOf.get(l) === cat && !gov.forbidden_laws.includes(l));
    if (law && cat in cs.laws && !prefs.includes(cs.laws[cat]!)) { cs.laws[cat] = law; cs.lawChangedDay[cat] = state.day; }
  }
  for (const [cat, law] of Object.entries(cs.laws)) {
    if (!gov.forbidden_laws.includes(law) && !sub?.laws.forbidden.includes(law)) continue;
    const to = gov.default_laws[cat] ?? sub?.laws.preferred[cat]?.find((l) => db.lawCategoryOf.get(l) === cat);
    if (to) { cs.laws[cat] = to; cs.lawChangedDay[cat] = state.day; }
  }
  if (!gov.holds_elections) cs.schedule = [];
  else if (!cs.schedule.length) cs.schedule = initialSchedule(db, cs.tag, state.day);

  // blocs that do not admit governments of this ideology
  const group = sub?.group;
  for (const b of db.blocs.values()) if (group && b.incompatible_groups.includes(group)) leaveBloc(ctx, cs.tag, b.id);

  cs.stability = clamp(cs.stability - 0.1, 0, 1);
  const who = leader ? db.people.get(leader)?.name.en : "a party council";
  ctx.log(cs.tag, "coup", `${db.parties.get(party)?.name.en ?? party} takes power: ${who} leads the government`);
  ctx.emit({ type: "coup", tag: cs.tag });
  return party;
}
