/**
 * Elections. On each scheduled date the country votes:
 *  - legislative: party shares from the vote model, seats by the chamber's electoral system,
 *    then a government is formed where the government type needs a majority;
 *  - presidential: candidates per party, decided by plurality, two rounds, instant runoff or an
 *    electoral college of sub-national units with real past results;
 *  - indirect presidential: chosen by the governing majority.
 *
 * Historical vs dynamic weighting: in historical mode, while a country still follows history and
 * the real candidates and parties exist, an election follows the recorded result with probability
 * `historical_adherence` (shares get a little noise, and if the real winner would lose, the
 * smallest uniform swing that gives them the win is applied). Otherwise the result is a blend of
 * the record and the model. Dynamic mode uses the model alone.
 */
import { holdersOn, type ContentDB } from "../../content/compile.ts";
import type { Election } from "../../content/schemas/country.ts";
import { dayOf, formatDate, isoOf, ymdOf } from "../date.ts";
import type { SimContext, System } from "../simulation.ts";
import type { CandidateResult, CountryState, ElectionResult, ScheduledElection } from "../state.ts";
import { formGovernment } from "./coalition.ts";
import { clamp, hasDied, hashNormal, isAvailable, normalise, partySub, personParty, policyDistance } from "./common.ts";
import { nextElectionDay, recordFor } from "./schedule.ts";
import {
  allocatePR,
  apportion,
  instantRunoff,
  mixedMemberProportional,
  multiMemberDistricts,
  parallel,
  plurality,
  ranked,
  singleMemberDistricts,
  sumSeats,
  twoRound,
  type Seats,
  type Shares,
} from "./seats.ts";
import { affinity, appealFactor, calibrate, countryProvinces, incumbencyFactor, modelShares, noisy, provinceShares } from "./voteModel.ts";

export const ELECTION_HISTORY_LIMIT = 400;
const SPECIAL = new Set(["independents", "others", "appointed", "vacant", "speaker"]);

// ------------------------------------------------------------------ helpers

/** Recorded party shares; whatever the record does not attribute to a modelled party stays in OTHERS. */
const sharesOfRecord = (rec: Election, valid: (k: string) => boolean): Shares => {
  const out: Shares = {};
  let sum = 0;
  for (const r of rec.historical.party_results ?? []) {
    if (r.share === undefined || !valid(r.party)) continue;
    out[r.party] = (out[r.party] ?? 0) + r.share;
    sum += r.share;
  }
  if (sum > 0 && sum < 0.995) out[OTHERS] = 1 - sum;
  return sum > 0 ? normalise(out) : {};
};

/** Share key for votes the model does not attribute to a party or candidate (never wins). */
export const OTHERS = "others";
const withoutOthers = (s: Shares): Shares => {
  const out = { ...s };
  delete out[OTHERS];
  return out;
};

/** Has the person served the maximum number of terms in this office (real tenures plus the current one)? */
export function termLimited(db: ContentDB, cs: CountryState, officeId: string, person: string, day: number): boolean {
  const o = db.offices.get(officeId);
  if (!o?.term_limit || !o.term_years) return false;
  const years = (from: number, to: number) => (to - from) / 365.25;
  const sameStint = cs.offices[officeId]?.[0] === person;
  let terms = 0;
  if (sameStint) terms += Math.ceil(years(cs.officeSince[officeId] ?? day, day) / o.term_years - 0.05);
  if (!o.term_limit.consecutive_only) {
    for (const h of o.holders) {
      if (h.person !== person || h.acting) continue;
      const from = dayOf(h.from), to = h.to ? dayOf(h.to) : day;
      if (sameStint && from >= (cs.officeSince[officeId] ?? day) - 30) continue; // already counted
      if (from > day) continue;
      terms += Math.max(1, Math.round(years(from, Math.min(to, day)) / o.term_years));
    }
  }
  return terms >= o.term_limit.max_terms;
}

/** Affinity between two candidates' voters, from their sub-ideologies. */
const personAffinity = (db: ContentDB, sub: (k: string) => string) => (from: string, to: string) => Math.exp(-4 * policyDistance(db, sub(from), sub(to)));

/** Largest uniform swing toward `want` (0..0.4) needed for `decide` to pick it; returns adjusted shares. */
function swingTo(shares: Shares, want: string, decide: (s: Shares) => string | null): Shares {
  if (!(want in shares) || decide(shares) === want) return shares;
  const at = (d: number): Shares => {
    const out: Shares = {};
    for (const [k, v] of Object.entries(shares)) out[k] = v * (1 - d) + (k === want ? d : 0);
    return out;
  };
  let lo = 0, hi = 0.4;
  if (decide(at(hi)) !== want) return at(hi);
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (decide(at(mid)) === want) hi = mid;
    else lo = mid;
  }
  return at(hi + 1e-4);
}

// ------------------------------------------------------------------ legislative seat allocation

/** Allocate a chamber's seats (or the contested part of it) from national shares. */
export function allocateChamber(
  ctx: SimContext,
  cs: CountryState,
  chamberId: string,
  shares: Shares,
  contested: number,
): { seats: Seats; provinceWinners: Record<string, string> } {
  const { db, rng } = ctx;
  const r = db.politicsRules.elections;
  const ch = db.countries.get(cs.tag)?.country?.legislature?.chambers.find((c) => c.id === chamberId);
  const sys = ch?.system;
  const formula = (sys?.formula ?? (sys?.type === "stv" ? "droop" : "dhondt")) as "dhondt";
  const threshold = sys?.threshold ?? 0;
  const provinces = countryProvinces(ctx.state, ctx.map?.provinces, cs.tag);
  const prov = provinceShares(db, cs.tag, shares, provinces, (k) => k);
  const provinceWinners: Record<string, string> = {};
  for (const p of provinces) if (p.id > 0) provinceWinners[p.id] = plurality(prov.get(p.id) ?? {}) ?? "";
  const subOf = (k: string) => partySub(db, k);
  const aff = personAffinity(db, subOf);

  const districts = (n: number): Shares[] => {
    const counts = apportion(provinces.map((p) => p.population), n);
    const out: Shares[] = [];
    provinces.forEach((p, i) => {
      for (let d = 0; d < counts[i]!; d++) {
        const base = prov.get(p.id)!;
        const s: Shares = {};
        for (const [k, v] of Object.entries(base))
          s[k] = v * Math.exp(r.district_noise * (hashNormal(`${cs.tag}:${chamberId}:${p.id}:${d}:${k}`) + 0.4 * rng.normal()));
        out.push(normalise(s));
      }
    });
    return out;
  };

  const type = sys?.type ?? "list_pr";
  let seats: Seats;
  switch (type) {
    case "fptp":
      seats = singleMemberDistricts(districts(contested), "plurality", aff);
      break;
    case "two_round":
      seats = singleMemberDistricts(districts(contested), "two_round", aff);
      break;
    case "av":
      seats = singleMemberDistricts(districts(contested), "av", aff);
      break;
    case "block":
      seats = multiMemberDistricts(districts(contested), r.multi_member_magnitude, "block");
      break;
    case "stv":
    case "sntv":
      seats = multiMemberDistricts(districts(contested), r.multi_member_magnitude, "proportional");
      break;
    case "mmp": {
      const nd = Math.round(contested * (1 - (sys?.pr_share ?? 0.5)));
      const ds = singleMemberDistricts(districts(nd), "plurality", aff);
      seats = mixedMemberProportional(shares, ds, contested, formula, threshold);
      break;
    }
    case "parallel": {
      const npr = Math.round(contested * (sys?.pr_share ?? 0.5));
      const ds = singleMemberDistricts(districts(contested - npr), "plurality", aff);
      seats = parallel(shares, ds, npr, formula, threshold);
      break;
    }
    default:
      seats = allocatePR(shares, contested, formula, threshold);
  }
  return { seats, provinceWinners };
}

// ------------------------------------------------------------------ candidates

/** Candidates for a direct presidential election in dynamic play: one per significant party. */
export function pickCandidates(ctx: SimContext, cs: CountryState, officeId: string): { person: string; party: string }[] {
  const { db, state, rng } = ctx;
  const r = db.politicsRules.elections;
  const shares = modelShares(db, cs, state.day);
  const parties = ranked(shares).filter((p) => shares[p]! >= r.min_presidential_share).slice(0, r.max_presidential_candidates);
  const people = db.countries.get(cs.tag)?.people ?? [];
  const incumbent = cs.offices[officeId]?.[0] ?? null;
  // prominence: people who stood for this office in real elections near this date, and sitting deputies
  const prominence = new Map<string, number>();
  for (const e of db.countries.get(cs.tag)?.elections?.elections ?? []) {
    if (e.office !== officeId) continue;
    const gap = Math.abs(dayOf(e.date) - state.day) / 365.25;
    if (gap > 4.5) continue;
    for (const c of e.historical.candidates ?? []) prominence.set(c.person, Math.max(prominence.get(c.person) ?? 0, 18 - 3 * gap));
  }
  for (const [o, holders] of Object.entries(cs.offices)) {
    const role = db.offices.get(o)?.role;
    if (role === "deputy" || role === "head_of_government") for (const h of holders) if (h) prominence.set(h, (prominence.get(h) ?? 0) + 8);
  }
  const out: { person: string; party: string }[] = [];
  const used = new Set<string>();
  for (const party of parties) {
    const ok = (id: string) =>
      !used.has(id) && isAvailable(db, id, state.day, r.min_candidate_age, r.max_candidate_age) && !termLimited(db, cs, officeId, id, state.day);
    let pick: string | null = null;
    if (incumbent && personParty(db, cs, incumbent) === party && ok(incumbent)) pick = incumbent;
    if (!pick) {
      let best = -Infinity;
      for (const p of people) {
        if (personParty(db, cs, p.id) !== party || !ok(p.id)) continue;
        const roles = new Set(p.roles_possible);
        if (!roles.has("presidential_candidate") && !roles.has("head_of_state") && !roles.has("head_of_government")) continue;
        const score = p.electoral_appeal + (prominence.get(p.id) ?? 0) + (roles.has("presidential_candidate") ? 4 : 0) + rng.next() * 10;
        if (score > best) { best = score; pick = p.id; }
      }
    }
    if (pick) {
      used.add(pick);
      out.push({ person: pick, party });
    }
  }
  return out;
}

/** Head of state chosen by the legislature or a convention in dynamic play: the governing majority's pick. */
export function pickIndirect(ctx: SimContext, cs: CountryState, officeId: string): string | null {
  const { db, state, rng } = ctx;
  const r = db.politicsRules.elections;
  const incumbent = cs.offices[officeId]?.[0] ?? null;
  if (incumbent && isAvailable(db, incumbent, state.day, r.min_candidate_age, r.max_candidate_age) && !termLimited(db, cs, officeId, incumbent, state.day)) {
    const ip = personParty(db, cs, incumbent);
    if (!ip || cs.rulingParties.includes(ip)) return incumbent;
  }
  const hog = db.countries.get(cs.tag)?.country?.government.head_of_government_office;
  const hogHolder = hog ? cs.offices[hog]?.[0] : null;
  let pick: string | null = null, best = -Infinity;
  for (const p of db.countries.get(cs.tag)?.people ?? []) {
    if (p.id === hogHolder || !p.roles_possible.includes("head_of_state")) continue;
    if (p.party && !cs.rulingParties.includes(p.party)) continue;
    if (!isAvailable(db, p.id, state.day, 40, r.max_candidate_age) || termLimited(db, cs, officeId, p.id, state.day)) continue;
    const score = p.electoral_appeal + rng.next() * 10;
    if (score > best) { best = score; pick = p.id; }
  }
  return pick ?? incumbent;
}

// ------------------------------------------------------------------ electoral college

/** Electoral votes per unit for a year (the latest apportionment in force). */
export function unitVotes(u: { votes: { from_year: number; votes: number }[] }, year: number): number {
  let v = u.votes[0]?.votes ?? 0;
  for (const e of u.votes) if (year >= e.from_year) v = e.votes;
  return v;
}

/** Decide an electoral college from candidate shares (keyed by person). */
export function electoralCollege(
  ctx: SimContext,
  cs: CountryState,
  shares: Shares,
  partyOf: (k: string) => string | undefined,
): { winner: string | null; votes: Record<string, number>; unitWinners: Record<string, string>; provinceWinners: Record<string, string> } {
  const { db, state } = ctx;
  const eu = db.countries.get(cs.tag)!.electoralUnits!;
  const provinces = countryProvinces(state, ctx.map?.provinces, cs.tag);
  const prov = provinceShares(db, cs.tag, shares, provinces, partyOf);
  const year = ymdOf(state.day).year;
  const votes: Record<string, number> = Object.fromEntries(Object.keys(shares).map((k) => [k, 0]));
  const unitWinners: Record<string, string> = {};
  const provinceWinners: Record<string, string> = {};
  for (const p of provinces) if (p.id > 0) provinceWinners[p.id] = partyOf(plurality(prov.get(p.id) ?? {}) ?? "") ?? "";
  for (const u of eu.units) {
    const inUnit = provinces.filter((p) => p.adm1.some((a) => u.adm1.includes(a)));
    // no provinces (tests without a map, or territory lost): use the unit's lean on national shares directly
    const agg: Shares = {};
    if (inUnit.length) {
      const pop = inUnit.reduce((s, p) => s + p.population, 0) || 1;
      for (const p of inUnit) for (const [k, v] of Object.entries(prov.get(p.id)!)) agg[k] = (agg[k] ?? 0) + (v * p.population) / pop;
    } else {
      const lean = unitLean(ctx.db, cs.tag, u.basis_shares);
      for (const [k, v] of Object.entries(shares)) agg[k] = v * Math.exp(lean[partyOf(k) ?? ""] ?? 0);
    }
    const n = unitVotes(u, year);
    if (u.method === "proportional") {
      for (const [k, v] of Object.entries(allocatePR(normalise(agg), n, "hare"))) votes[k] = (votes[k] ?? 0) + v;
    } else {
      const w = plurality(agg);
      if (w) {
        votes[w] = (votes[w] ?? 0) + n;
        unitWinners[u.id] = w;
      }
    }
  }
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  const top = ranked(votes)[0] ?? null;
  const winner = top && (eu.majority === "plurality" || votes[top]! * 2 > total) ? top : top; // contingent election not modelled: most votes
  return { winner, votes, unitWinners, provinceWinners };
}

/** Log share ratio of a unit to the national basis result, per party (proportional swing). */
function unitLean(db: ContentDB, tag: string, basis: Record<string, number>): Record<string, number> {
  const cc = db.countries.get(tag);
  const rec = cc?.elections?.elections.find((e) => e.id === cc?.electoralUnits?.basis_election)?.historical;
  const nat: Record<string, number> = {};
  for (const c of rec?.candidates ?? []) if (c.party && c.share !== undefined && c.round === 1) nat[c.party] = (nat[c.party] ?? 0) + c.share;
  const out: Record<string, number> = {};
  for (const [p, v] of Object.entries(basis)) if (nat[p]) out[p] = Math.log(Math.max(v, 1e-4) / nat[p]!);
  return out;
}

// ------------------------------------------------------------------ running an election

function pathMatches(ctx: SimContext, cs: CountryState, rec: Election): boolean {
  const { db, state } = ctx;
  const h = rec.historical;
  if (rec.kind === "presidential" || rec.kind === "indirect_presidential") {
    const r1 = (h.candidates ?? []).filter((c) => c.round === 1).sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
    const top = r1.slice(0, 2).map((c) => c.person);
    if (h.winner && !top.includes(h.winner) && db.people.has(h.winner)) top.push(h.winner);
    return top.length > 0 && top.every((p) => db.people.has(p) && !hasDied(db.people.get(p)!, state.day));
  }
  const parties = (h.party_results ?? []).filter((r) => !SPECIAL.has(r.party) && r.seats > 0).map((r) => r.party);
  return parties.every((p) => cs.partyStatus[p] === "active" || cs.partyStatus[p] === "extra_parliamentary");
}

function pushResult(ctx: SimContext, res: ElectionResult): void {
  const list = ctx.state.elections;
  list.push(res);
  if (list.length > ELECTION_HISTORY_LIMIT) list.splice(0, list.length - ELECTION_HISTORY_LIMIT);
}

const resultId = (tag: string, key: string, day: number) => `${tag}:${key}:${isoOf(day)}`;

/** Run one scheduled election and apply its result. */
export function runElection(ctx: SimContext, cs: CountryState, s: ScheduledElection): ElectionResult | null {
  const { db, state, rng } = ctx;
  const r = db.politicsRules.elections;
  const historical = state.rules.electionMode === "historical" && cs.followsHistory;
  const rec = historical ? recordFor(db, cs.tag, s.key, state.day) : undefined;
  // a party that stood in the real election existed and was legal by then: banned, exiled or insurgent in 2000, or
  // merged into an electoral alliance (formed_from) that it later left again
  if (rec) for (const pr of rec.historical.party_results ?? [])
    if (pr.seats > 0 && ["banned", "exiled", "insurgent", "dissolved"].includes(cs.partyStatus[pr.party] ?? "")) {
      cs.partyStatus[pr.party] = "active";
      cs.partyPopularity[pr.party] ??= 0;
      cs.partyBias[pr.party] ??= 1;
    }
  const matches = !!rec && pathMatches(ctx, cs, rec);
  const onTrack = matches && rng.chance(r.historical_adherence);
  const pull = matches && !onTrack ? r.historical_pull : 0;

  let res: ElectionResult | null;
  if (s.kind === "legislative" || s.kind === "legislative_upper") res = legislative(ctx, cs, s, rec, onTrack, pull);
  else if (s.kind === "presidential") res = presidential(ctx, cs, s, rec, onTrack, pull);
  else if (s.kind === "indirect_presidential") res = indirect(ctx, cs, s, rec, onTrack);
  else res = null;
  if (!res) return null;

  // a result that leaves the record ends the historical path for this country
  const recWinner = rec?.historical.winner;
  if (rec && recWinner && res.winner !== recWinner && res.winnerParty !== recWinner) {
    cs.followsHistory = false;
  }
  pushResult(ctx, res);
  ctx.emit({ type: "election", result: res });
  ctx.log(cs.tag, "election", electionHeadline(db, cs, res));
  return res;
}

export function electionTitle(db: ContentDB, tag: string, res: Pick<ElectionResult, "kind" | "chamber" | "office">): string {
  const c = db.countries.get(tag)?.country;
  if (res.chamber) return `${c?.legislature?.chambers.find((x) => x.id === res.chamber)?.name.en ?? res.chamber} election`;
  if (res.kind === "indirect_presidential") return `${db.offices.get(res.office ?? "")?.title.en ?? "Head of state"} election (indirect)`;
  return `${db.offices.get(res.office ?? "")?.title.en ?? "Presidential"} election`;
}

function electionHeadline(db: ContentDB, cs: CountryState, res: ElectionResult): string {
  const title = electionTitle(db, cs.tag, res);
  if (res.seats) {
    const p = res.winner ? db.parties.get(res.winner) : undefined;
    return `${title}: ${p?.name.en ?? res.winner ?? "no winner"} largest with ${res.seats[res.winner ?? ""] ?? 0} of ${res.totalSeats ?? sumSeats(res.seats)} seats`;
  }
  const person = res.winner ? db.people.get(res.winner) : undefined;
  const share = res.winner ? (res.candidates?.filter((c) => c.person === res.winner).sort((a, b) => b.round - a.round)[0]?.share ?? 0) : 0;
  return `${title}: ${person?.name.en ?? "no winner"} elected${share ? ` (${(share * 100).toFixed(1)}%)` : ""}`;
}

function legislative(ctx: SimContext, cs: CountryState, s: ScheduledElection, rec: Election | undefined, onTrack: boolean, pull: number): ElectionResult | null {
  const { db, state, rng } = ctx;
  const r = db.politicsRules.elections;
  const ch = db.countries.get(cs.tag)?.country?.legislature?.chambers.find((c) => c.id === s.chamber);
  if (!ch || ch.elected === "appointed") return null;
  const valid = (k: string) => cs.partyStatus[k] === "active" || cs.partyStatus[k] === "extra_parliamentary";
  const before = { ...(cs.seats[ch.id] ?? {}) };
  if (!Object.values(cs.partyStatus).some((st) => st === "active" || st === "extra_parliamentary")) return null; // no party data
  const model = noisy(modelShares(db, cs, state.day), r.dynamic_noise, () => rng.normal());
  const recShares = rec ? sharesOfRecord(rec, valid) : {};
  let shares: Shares;
  if (onTrack && Object.keys(recShares).length) shares = noisy(recShares, r.historical_noise, () => rng.normal());
  else if (pull > 0 && Object.keys(recShares).length) {
    const keys = new Set([...Object.keys(model), ...Object.keys(recShares)]);
    shares = noisy(normalise(Object.fromEntries([...keys].map((k) => [k, pull * (recShares[k] ?? 0) + (1 - pull) * (model[k] ?? 0)]))), r.dynamic_noise * 0.5, () => rng.normal());
  } else shares = model;

  // staggered chambers: only part of the seats is contested
  const fraction = ch.term_years && s.everyYears < ch.term_years ? s.everyYears / ch.term_years : 1;
  let seats: Seats;
  let provinceWinners: Record<string, string> = {};
  const recSeats = rec?.historical.party_results?.filter((x) => x.seats >= 0);
  if (ch.elected === "indirect") {
    // indirectly elected chambers follow the composition of the first chamber
    const first = db.countries.get(cs.tag)?.country?.legislature?.chambers.find((c) => c.elected !== "indirect" && c.elected !== "appointed");
    const base = first ? cs.seats[first.id] ?? {} : {};
    const parties = Object.fromEntries(Object.entries(base).filter(([k]) => !SPECIAL.has(k)));
    seats = allocatePR(normalise(parties), ch.seats, "dhondt");
  } else if (onTrack && recSeats?.length) {
    seats = Object.fromEntries(recSeats.map((x) => [x.party, x.seats]));
    provinceWinners = allocateChamber(ctx, cs, ch.id, withoutOthers(shares), 1).provinceWinners;
  } else if (fraction < 1) {
    const contested = Math.round(ch.seats * fraction);
    const kept = Object.fromEntries(Object.entries(before).filter(([k]) => k !== "vacant"));
    const keptCounts = apportion(Object.values(kept), ch.seats - contested);
    const out = allocateChamber(ctx, cs, ch.id, withoutOthers(shares), contested);
    seats = { ...out.seats };
    Object.keys(kept).forEach((k, i) => (seats[k] = (seats[k] ?? 0) + keptCounts[i]!));
    provinceWinners = out.provinceWinners;
  } else {
    const out = allocateChamber(ctx, cs, ch.id, withoutOthers(shares), ch.seats);
    seats = out.seats;
    provinceWinners = out.provinceWinners;
  }
  for (const k of Object.keys(seats)) if (!seats[k]) delete seats[k];
  let winner = ranked(Object.fromEntries(Object.entries(seats).filter(([k]) => !SPECIAL.has(k)))).sort((a, b) => seats[b]! - seats[a]! || (shares[b] ?? 0) - (shares[a] ?? 0))[0] ?? null;
  // on the historical track the record decides ties and blocs (e.g. a 50-50 Senate, CDU/CSU)
  if (onTrack && rec?.historical.winner && db.parties.has(rec.historical.winner)) winner = rec.historical.winner;

  cs.seats[ch.id] = seats;
  const firstChamber = db.countries.get(cs.tag)?.country?.legislature?.chambers[0]?.id === ch.id;
  if (firstChamber) {
    for (const k of Object.keys(cs.partyPopularity))
      if (!(k in shares) && (cs.partyStatus[k] === "active" || cs.partyStatus[k] === "extra_parliamentary")) cs.partyPopularity[k] = 0;
    for (const [k, v] of Object.entries(shares)) if (k !== OTHERS) cs.partyPopularity[k] = v;
    // on the historical track the model is re-anchored to the real result
    if (onTrack) cs.partyBias = { ...cs.partyBias, ...calibrate(db, cs, state.day) };
  }
  if (Object.keys(provinceWinners).length && firstChamber) ctx.state.mapResults[cs.tag] = provinceWinners;

  const res: ElectionResult = {
    id: resultId(cs.tag, s.key, state.day),
    tag: cs.tag,
    day: state.day,
    kind: s.kind,
    chamber: ch.id,
    historicalId: rec?.id,
    followedHistory: onTrack,
    snap: s.snap,
    turnout: onTrack && rec?.historical.turnout ? rec.historical.turnout : clamp(0.62 + 0.05 * rng.normal(), 0.3, 0.95),
    shares,
    seats: { ...seats },
    seatsBefore: before,
    totalSeats: sumSeats(seats),
    winner,
    winnerParty: winner,
  };
  const gov = db.governmentTypes.get(cs.govType);
  if (ch.confidence_chamber && gov?.needs_majority) formGovernment(ctx, cs, ch.id, res, rec, onTrack);
  else if (!cs.followsHistory || state.rules.electionMode === "dynamic") leadershipChallenges(ctx, cs, before, seats);
  return res;
}

function presidential(ctx: SimContext, cs: CountryState, s: ScheduledElection, rec: Election | undefined, onTrack: boolean, pull: number): ElectionResult | null {
  const { db, state, rng } = ctx;
  const r = db.politicsRules.elections;
  const officeId = s.office;
  if (!officeId || !db.offices.has(officeId)) return null;
  const cc = db.countries.get(cs.tag)!;
  const rule = cc.elections?.rules.find((x) => x.kind === s.kind && x.office === officeId);
  const system = rule?.system ?? (cc.electoralUnits?.office === officeId ? "electoral_college" : "two_round");

  // candidates: the real ones when following (or pulled toward) the record, else one per party
  let cands: { person: string; party?: string }[];
  const recR1 = (rec?.historical.candidates ?? []).filter((c) => c.round === 1 && db.people.has(c.person));
  if ((onTrack || pull > 0) && recR1.length) cands = recR1.map((c) => ({ person: c.person, party: c.party ?? personParty(db, cs, c.person) }));
  else cands = pickCandidates(ctx, cs, officeId);
  if (!cands.length) return null;
  const partyOf = (k: string) => cands.find((c) => c.person === k)?.party ?? personParty(db, cs, k);
  const subOf = (k: string) => db.people.get(k)?.sub_ideology ?? partySub(db, partyOf(k) ?? "");

  // model: party vote flows to that party's candidate; parties without one split by affinity
  const party = modelShares(db, cs, state.day);
  const model: Shares = Object.fromEntries(cands.map((c) => [c.person, 0]));
  for (const [p, v] of Object.entries(party)) {
    const own = cands.find((c) => c.party === p);
    if (own) model[own.person]! += v;
    else {
      const w = cands.map((c) => affinity(db, partySub(db, p), subOf(c.person)));
      const t = w.reduce((a, b) => a + b, 0) || 1;
      cands.forEach((c, i) => (model[c.person]! += (v * w[i]!) / t));
    }
  }
  const incumbent = cs.offices[officeId]?.[0];
  const inc = incumbencyFactor(db, cs, state.day);
  for (const c of cands) {
    model[c.person] = Math.max(1e-6, model[c.person]!) * appealFactor(db, c.person) * (c.person === incumbent ? inc : 1);
  }
  const modelN = noisy(normalise(model), r.dynamic_noise, () => rng.normal());
  const recShares: Shares = {};
  let recSum = 0;
  for (const c of recR1) if (c.share !== undefined) { recShares[c.person] = c.share; recSum += c.share; }
  if (recSum > 0 && recSum < 0.995) recShares[OTHERS] = 1 - recSum;
  let shares: Shares;
  if (onTrack && recSum > 0) shares = noisy(normalise(recShares), r.historical_noise, () => rng.normal());
  else if (pull > 0 && recSum > 0) {
    const keys = [...cands.map((c) => c.person), ...(recShares[OTHERS] ? [OTHERS] : [])];
    shares = noisy(normalise(Object.fromEntries(keys.map((k) => [k, pull * (recShares[k] ?? 0) + (1 - pull) * (modelN[k] ?? 0)]))), r.dynamic_noise * 0.5, () => rng.normal());
  } else shares = modelN;

  // decisions ignore the OTHERS bucket; a first-round majority is still measured against all votes
  const main = withoutOthers;
  const round = (sh: Shares) => twoRound(main(sh), aff, 0.5 / Math.max(0.05, 1 - (sh[OTHERS] ?? 0)));
  const aff = personAffinity(db, subOf);
  const want = onTrack ? rec?.historical.winner : undefined;
  const candidates: CandidateResult[] = [];
  let winner: string | null = null;
  let unitVotesOut: Record<string, number> | undefined;
  let unitWinners: Record<string, string> | undefined;
  let provinceWinners: Record<string, string> = {};

  if (system === "electoral_college" && cc.electoralUnits) {
    const decide = (sh: Shares) => electoralCollege(ctx, cs, main(sh), partyOf).winner;
    if (want) shares = swingTo(shares, want, decide);
    const ec = electoralCollege(ctx, cs, main(shares), partyOf);
    winner = ec.winner;
    unitVotesOut = ec.votes;
    unitWinners = ec.unitWinners;
    provinceWinners = ec.provinceWinners;
    for (const c of cands) candidates.push({ person: c.person, party: c.party, share: shares[c.person] ?? 0, round: 1 });
  } else if (system === "two_round") {
    const recR2 = (rec?.historical.candidates ?? []).filter((c) => c.round === 2 && c.share !== undefined);
    if (want) shares = swingTo(shares, want, (sh) => { const tr = round(sh); return tr.runoff ? (ranked(main(sh)).slice(0, 2).includes(want) ? want : null) : tr.winner; });
    for (const c of cands) candidates.push({ person: c.person, party: c.party, share: shares[c.person] ?? 0, round: 1 });
    const tr = round(shares);
    if (tr.runoff) {
      let runoff = tr.runoff;
      if (onTrack && recR2.length) runoff = noisy(normalise(Object.fromEntries(recR2.map((c) => [c.person, c.share!]))), r.historical_noise, () => rng.normal());
      if (want && want in runoff) runoff = swingTo(runoff, want, plurality);
      for (const [p, v] of Object.entries(runoff)) candidates.push({ person: p, party: partyOf(p), share: v, round: 2 });
      winner = plurality(runoff);
    } else winner = tr.winner;
  } else {
    const decide = system === "irv" ? (sh: Shares) => instantRunoff(main(sh), aff) : (sh: Shares) => plurality(main(sh));
    if (want) shares = swingTo(shares, want, decide);
    for (const c of cands) candidates.push({ person: c.person, party: c.party, share: shares[c.person] ?? 0, round: 1 });
    winner = decide(shares);
  }
  if (!Object.keys(provinceWinners).length) {
    const provinces = countryProvinces(state, ctx.map?.provinces, cs.tag);
    const prov = provinceShares(db, cs.tag, main(shares), provinces, partyOf);
    for (const p of provinces) if (p.id > 0) provinceWinners[p.id] = partyOf(plurality(prov.get(p.id) ?? {}) ?? "") ?? "";
  }
  state.mapResults[cs.tag] = provinceWinners;

  const res: ElectionResult = {
    id: resultId(cs.tag, s.key, state.day),
    tag: cs.tag,
    day: state.day,
    kind: s.kind,
    office: officeId,
    historicalId: rec?.id,
    followedHistory: onTrack,
    snap: s.snap,
    turnout: onTrack && rec?.historical.turnout ? rec.historical.turnout : clamp(0.6 + 0.06 * rng.normal(), 0.3, 0.95),
    shares,
    candidates,
    unitVotes: unitVotesOut,
    unitWinners,
    winner,
    winnerParty: winner ? (partyOf(winner) ?? null) : null,
  };
  applyHeadOfState(ctx, cs, officeId, winner, onTrack);
  return res;
}

function indirect(ctx: SimContext, cs: CountryState, s: ScheduledElection, rec: Election | undefined, onTrack: boolean): ElectionResult | null {
  const { db, state } = ctx;
  const officeId = s.office;
  if (!officeId || !db.offices.has(officeId)) return null;
  const recWinner = rec?.historical.winner;
  const winner = onTrack && recWinner && db.people.has(recWinner) ? recWinner : pickIndirect(ctx, cs, officeId);
  const candidates: CandidateResult[] = (rec?.historical.candidates ?? [])
    .filter(() => onTrack)
    .map((c) => ({ person: c.person, party: c.party, share: c.share ?? 0, round: c.round }));
  if (!candidates.length && winner) candidates.push({ person: winner, party: personParty(db, cs, winner), share: 0, round: 1 });
  const res: ElectionResult = {
    id: resultId(cs.tag, s.key, state.day),
    tag: cs.tag,
    day: state.day,
    kind: s.kind,
    office: officeId,
    historicalId: rec?.id,
    followedHistory: onTrack,
    snap: s.snap,
    turnout: 1,
    shares: {},
    candidates,
    winner,
    winnerParty: winner ? (personParty(db, cs, winner) ?? null) : null,
  };
  applyHeadOfState(ctx, cs, officeId, winner, onTrack);
  return res;
}

/** Install an elected head of state. On the historical track the real inauguration date applies (timeline system). */
function applyHeadOfState(ctx: SimContext, cs: CountryState, officeId: string, winner: string | null, onTrack: boolean): void {
  const { db, state } = ctx;
  if (!winner) return;
  if (onTrack && cs.historicalOffices[officeId]) return;
  cs.historicalOffices[officeId] = false;
  const current = cs.offices[officeId]?.[0];
  if (current !== winner) {
    cs.offices[officeId] = [winner];
    cs.officeSince[officeId] = state.day;
    ctx.log(cs.tag, "office", `${db.people.get(winner)?.name.en ?? winner} — ${db.offices.get(officeId)?.title.en ?? officeId}`);
  }
  // deputies elected on the same ticket (e.g. a vice president) follow the new president
  for (const o of db.countries.get(cs.tag)?.country?.offices ?? []) {
    if (o.role !== "deputy" || o.selection !== db.offices.get(officeId)?.selection || current === winner) continue;
    cs.historicalOffices[o.id] = false;
    const party = personParty(db, cs, winner);
    let mate: string | null = null, best = -Infinity;
    for (const p of db.countries.get(cs.tag)?.people ?? []) {
      if (p.id === winner || personParty(db, cs, p.id) !== party || !p.roles_possible.includes("head_of_state")) continue;
      if (!isAvailable(db, p.id, state.day, 35, 80) || termLimited(db, cs, officeId, p.id, state.day)) continue;
      if (p.electoral_appeal > best) { best = p.electoral_appeal; mate = p.id; }
    }
    cs.offices[o.id] = [mate];
    cs.officeSince[o.id] = state.day;
  }
  // presidential systems: the president's party governs
  const exec = db.countries.get(cs.tag)?.country?.government.effective_executive;
  const wp = personParty(db, cs, winner);
  if (exec === officeId && wp && !db.governmentTypes.get(cs.govType)?.needs_majority && cs.rulingParties[0] !== wp) {
    cs.rulingParties = [wp];
    cs.govSinceDay = state.day;
  }
}

/** After a lost election in dynamic play, a party whose support fell sharply may replace its leader. */
export function leadershipChallenges(ctx: SimContext, cs: CountryState, before: Seats, after: Seats): void {
  const { db, state, rng } = ctx;
  for (const party of Object.keys(cs.partyLeader)) {
    const b = before[party] ?? 0, a = after[party] ?? 0;
    if (b < 5 || a >= b * 0.8 || cs.rulingParties.includes(party) || !rng.chance(0.6)) continue;
    const current = cs.partyLeader[party];
    let pick: string | null = null, best = -Infinity;
    for (const p of db.countries.get(cs.tag)?.people ?? []) {
      if (p.party !== party || p.id === current || !isAvailable(db, p.id, state.day, 30, 75)) continue;
      if (!p.roles_possible.some((x) => x === "party_leader" || x === "head_of_government" || x === "opposition_leader")) continue;
      const score = p.electoral_appeal + rng.next() * 15;
      if (score > best) { best = score; pick = p.id; }
    }
    if (pick) {
      cs.partyLeader[party] = pick;
      ctx.log(cs.tag, "party", `${db.people.get(pick)?.name.en} becomes leader of ${db.parties.get(party)?.abbrev.en ?? party}`);
    }
  }
}

// ------------------------------------------------------------------ system

export const electionSystem: System = {
  id: "elections",
  daily(ctx) {
    const { db, state } = ctx;
    for (const cs of Object.values(state.countries)) {
      if (!cs.active || !cs.schedule.length || cs.schedule[0]!.day > state.day) continue;
      const gov = db.governmentTypes.get(cs.govType);
      const due = cs.schedule.filter((e) => e.day <= state.day);
      cs.schedule = cs.schedule.filter((e) => e.day > state.day);
      for (const s of due) {
        if (gov && !gov.holds_elections) continue; // e.g. after a coup: the calendar lapses
        const followed = state.rules.electionMode === "historical" && cs.followsHistory;
        runElection(ctx, cs, s);
        const next = nextElectionDay(db, cs.tag, s, state.day, followed && cs.followsHistory);
        cs.schedule.push({ ...s, day: next, snap: false });
      }
      cs.schedule.sort((a, b) => a.day - b.day);
    }
  },
};

/** Call an early election for a chamber: replaces its next scheduled date. */
export function scheduleSnapElection(ctx: SimContext, cs: CountryState, chamber: string, delayDays: number): boolean {
  const s = cs.schedule.find((e) => e.chamber === chamber && (e.kind === "legislative" || e.kind === "legislative_upper"));
  if (!s || !s.snapPossible) return false;
  if (s.day <= ctx.state.day + delayDays) return false; // an election is already close
  s.day = ctx.state.day + delayDays;
  s.snap = true;
  cs.schedule.sort((a, b) => a.day - b.day);
  ctx.log(cs.tag, "election", `Early election called for ${formatDate(s.day)}`);
  return true;
}

export { holdersOn };
