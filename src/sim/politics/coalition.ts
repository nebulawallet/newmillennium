/**
 * Government formation and survival.
 *
 * Formation: the formateur is the largest party (or the head of state's party where the head of
 * state appoints the government and can command a majority; on the historical track, the party of
 * the real head of government after the election). Coalitions containing the formateur are scored
 * by policy distance, number of parties, surplus seats, partners' acceptance and red lines; if no
 * majority is possible a minority government seeks confidence-and-supply partners. AI countries
 * take the best option; the player's country gets a coalition choice and the game waits.
 *
 * Survival: each month a government without a majority may lose a confidence vote (more likely at
 * low stability). It is then re-formed from the current chamber, or an early election is called.
 */
import { holdersOn, type ContentDB } from "../../content/compile.ts";
import type { Election } from "../../content/schemas/country.ts";
import { dayOf, isoOf } from "../date.ts";
import type { SimContext, System } from "../simulation.ts";
import type { CoalitionOption, CountryState, ElectionResult } from "../state.ts";
import { clamp, isAvailable, partySub, personParty, policyDistance } from "./common.ts";
import { leadershipChallenges, scheduleSnapElection } from "./elections.ts";

const SPECIAL = new Set(["independents", "others", "appointed", "vacant", "speaker"]);

export const majorityOf = (total: number) => Math.floor(total / 2) + 1;

/** Seats that count for confidence (abstentionist parties do not sit). */
function sittingSeats(db: ContentDB, seats: Record<string, number>): { parties: Record<string, number>; total: number } {
  const parties: Record<string, number> = {};
  let total = 0;
  for (const [k, v] of Object.entries(seats)) {
    if (k === "vacant") continue;
    if (!SPECIAL.has(k) && db.parties.get(k)?.abstentionist) continue;
    total += v;
    if (!SPECIAL.has(k)) parties[k] = v;
  }
  return { parties, total };
}

/** Probability that `partner` joins a government led by `formateur`. */
export function acceptance(db: ContentDB, formateur: string, partner: string, members: string[]): number {
  if (partner === formateur) return 1;
  const pf = db.parties.get(formateur), pp = db.parties.get(partner);
  if (pf?.coalition_red_lines.includes(partner) || pp?.coalition_red_lines.includes(formateur)) return 0;
  for (const m of members) if (m !== partner && (db.parties.get(m)?.coalition_red_lines.includes(partner) || pp?.coalition_red_lines.includes(m))) return 0;
  const max = db.politicsRules.coalitions.max_partner_distance;
  const d = Math.max(...members.filter((m) => m !== partner).map((m) => policyDistance(db, partySub(db, m), partySub(db, partner))), 0);
  return clamp(1 - d / max, 0, 1) ** 0.7;
}

function meanDistance(db: ContentDB, members: string[]): number {
  if (members.length < 2) return 0;
  let s = 0, n = 0;
  for (let i = 0; i < members.length; i++)
    for (let j = i + 1; j < members.length; j++) {
      s += policyDistance(db, partySub(db, members[i]!), partySub(db, members[j]!));
      n++;
    }
  return s / n;
}

/** Possible governments led by `formateur`, best first. `historicalParties` marks the real government on the historical track. */
export function coalitionOptions(db: ContentDB, seats: Record<string, number>, formateur: string, historicalParties: string[] = []): CoalitionOption[] {
  const rules = db.politicsRules.coalitions;
  const { parties, total } = sittingSeats(db, seats);
  const majority = majorityOf(total);
  const bySize = Object.keys(parties).filter((p) => parties[p]! > 0).sort((a, b) => parties[b]! - parties[a]!);
  const grand = new Set(bySize.slice(0, 2));
  const others = bySize.filter((p) => p !== formateur).slice(0, rules.max_parties_considered - 1);
  const econ = (p: string) => db.subIdeologies.get(partySub(db, p))?.policy.economy ?? 0;
  const hist = new Set(historicalParties);
  const histScore = (members: string[]) =>
    hist.size && members.every((m) => hist.has(m)) && [...hist].every((h) => members.includes(h) || !parties[h]) ? rules.historical_bonus : 0;
  const score = (members: string[], s: number, acc: Record<string, number>, minority: boolean) => {
    const e = members.map(econ);
    const gap = Math.max(...e) - Math.min(...e);
    const logAcc = members.reduce((a, m) => a + Math.log(Math.max(acc[m] ?? 1, 1e-4)), 0);
    return (
      -2 * meanDistance(db, members) -
      rules.party_count_penalty * (members.length - 1) -
      rules.surplus_penalty * Math.max(0, (s - majority) / total) -
      rules.cross_bloc_penalty * Math.max(0, gap - 0.6) -
      (grand.size === 2 && [...grand].every((g) => members.includes(g)) ? rules.grand_coalition_penalty : 0) -
      (minority ? rules.minority_penalty : 0) +
      0.25 * logAcc +
      histScore(members)
    );
  };
  const scored: (CoalitionOption & { score: number })[] = [];
  for (let mask = 0; mask < 1 << others.length; mask++) {
    const members = [formateur, ...others.filter((_, i) => mask & (1 << i))];
    const s = members.reduce((a, p) => a + (parties[p] ?? 0), 0);
    if (s < majority) continue;
    // minimal: dropping any partner must lose the majority
    if (members.slice(1).some((m) => s - parties[m]! >= majority)) continue;
    const acc: Record<string, number> = {};
    for (const m of members) acc[m] = acceptance(db, formateur, m, members);
    if (Object.values(acc).some((a) => a <= 0)) continue;
    scored.push({ parties: members, seats: s, majority, acceptance: acc, distance: meanDistance(db, members), minority: false, support: [], score: score(members, s, acc, false) });
  }

  // minority government: the formateur alone, supported from outside where possible
  const willing = others
    .map((p) => ({ p, a: acceptance(db, formateur, p, [formateur, p]) }))
    .filter((x) => x.a >= 0.5)
    .sort((x, y) => y.a - x.a);
  let support: string[] = [];
  let got = parties[formateur] ?? 0;
  for (const { p } of willing) {
    if (got >= majority) break;
    support.push(p);
    got += parties[p]!;
  }
  if (got < majority) support = support.slice(0, 2);
  const alone = parties[formateur] ?? 0;
  const minority = alone < majority;
  const soloSupport = minority ? support : [];
  // a supported minority government is judged like a loose coalition of itself and its supporters
  const soloScore = minority
    ? score([formateur], alone, { [formateur]: 1 }, true) - 0.5 * meanDistance(db, [formateur, ...soloSupport]) + (got >= majority ? 0.2 : -0.4) +
      (hist.size === 1 && hist.has(formateur) ? rules.historical_bonus : 0)
    : score([formateur], alone, { [formateur]: 1 }, false);
  scored.push({ parties: [formateur], seats: alone, majority, acceptance: { [formateur]: 1 }, distance: 0, minority, support: soloSupport, score: soloScore });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 7).map(({ score: _s, ...o }) => o);
}

/** Parties of the real government a few months after a recorded election (head of government and ministers). */
export function historicalGovernment(db: ContentDB, cs: CountryState, electionDate: string): string[] {
  const c = db.countries.get(cs.tag);
  if (!c?.country) return [];
  const later = isoOf(dayOf(electionDate) + 100);
  const out = new Set<string>();
  const hog = db.offices.get(c.country.government.head_of_government_office);
  const head = hog ? holdersOn(hog, later)[0]?.person : null;
  const hp = personParty(db, cs, head);
  if (hp) out.add(hp);
  // partners are only known where the data has the real cabinet; otherwise say nothing
  let ministers = 0;
  for (const o of c.cabinet) {
    if (o.role !== "minister") continue;
    const h = holdersOn(o, later)[0]?.person;
    if (!h) continue;
    ministers++;
    const p = personParty(db, cs, h);
    if (p) out.add(p);
  }
  return ministers ? [...out] : [];
}

/** Who forms the government after an election. */
function chooseFormateur(ctx: SimContext, cs: CountryState, seats: Record<string, number>, rec: Election | undefined, onTrack: boolean): string | null {
  const { db, state } = ctx;
  const c = db.countries.get(cs.tag)?.country;
  const { parties } = sittingSeats(db, seats);
  const largest = Object.keys(parties).sort((a, b) => parties[b]! - parties[a]!)[0] ?? null;
  if (!c) return largest;
  // historical track: the party of the real head of government a couple of months later
  if (onTrack && rec) {
    const hog = db.offices.get(c.government.head_of_government_office);
    const later = isoOf(dayOf(rec.date) + 75);
    const pid = hog ? holdersOn(hog, later)[0]?.person : null;
    const party = pid ? personParty(db, cs, pid) : undefined;
    if (party && parties[party]) return party;
  }
  // a head of state who appoints the government picks from their own camp when it can govern
  const hogOffice = db.offices.get(c.government.head_of_government_office);
  const presidentLed = c.government.effective_executive === c.government.head_of_state_office;
  if (presidentLed && hogOffice?.appointed_by && hogOffice.appointed_by === c.government.head_of_state_office) {
    const hos = cs.offices[c.government.head_of_state_office]?.[0];
    const hp = hos ? personParty(db, cs, hos) : undefined;
    if (hp && parties[hp] && coalitionOptions(db, seats, hp).some((o) => !o.minority)) return hp;
  }
  return largest;
}

/** Form a government after an election in the confidence chamber. */
export function formGovernment(ctx: SimContext, cs: CountryState, chamber: string, res: ElectionResult, rec: Election | undefined, onTrack: boolean): void {
  const { db, state } = ctx;
  const seats = cs.seats[chamber] ?? {};
  const formateur = chooseFormateur(ctx, cs, seats, rec, onTrack);
  if (!formateur) return;
  const hist = onTrack && rec ? historicalGovernment(db, cs, rec.date) : [];
  const options = coalitionOptions(db, seats, formateur, hist);
  if (cs.tag === state.player) {
    state.pendingCoalition = { tag: cs.tag, chamber, resultId: res.id, options };
    ctx.emit({ type: "coalition_needed", tag: cs.tag });
    return;
  }
  const before = { ...(res.seatsBefore ?? {}) };
  applyGovernment(ctx, cs, options[0]!, res, onTrack);
  if (!onTrack) leadershipChallenges(ctx, cs, before, seats);
}

/** Install a government. Off the historical track the formateur's leader becomes head of government. */
export function applyGovernment(ctx: SimContext, cs: CountryState, opt: CoalitionOption, res: ElectionResult | null, onTrack: boolean): void {
  const { db, state } = ctx;
  const c = db.countries.get(cs.tag)?.country;
  const lead = opt.parties[0]!;
  const changedLead = cs.rulingParties[0] !== lead;
  cs.rulingParties = [...opt.parties];
  cs.confidenceAndSupply = [...opt.support];
  if (changedLead) cs.govSinceDay = state.day;

  let leader: string | null = null;
  if (c) {
    const hogId = c.government.head_of_government_office;
    const hog = db.offices.get(hogId);
    const current = cs.offices[hogId]?.[0] ?? null;
    const currentParty = current ? personParty(db, cs, current) : undefined;
    const hosAppoints = hog?.appointed_by === c.government.head_of_state_office && c.government.effective_executive === c.government.head_of_state_office;
    const hosParty = (() => {
      const h = cs.offices[c.government.head_of_state_office]?.[0];
      return h ? personParty(db, cs, h) : undefined;
    })();
    if (onTrack && cs.historicalOffices[hogId]) leader = current;
    else if (current && (currentParty === lead || (hosAppoints && hosParty && opt.parties.includes(hosParty) && !currentParty))) leader = current;
    else {
      leader = cs.partyLeader[lead] ?? null;
      if (!leader || !isAvailable(db, leader, state.day, 25, 85)) {
        leader = null;
        let best = -Infinity;
        for (const p of db.countries.get(cs.tag)?.people ?? []) {
          if (p.party !== lead || !p.roles_possible.includes("head_of_government") || !isAvailable(db, p.id, state.day, 30, 80)) continue;
          if (p.electoral_appeal > best) { best = p.electoral_appeal; leader = p.id; }
        }
      }
      if (leader && leader !== current) {
        cs.offices[hogId] = [leader];
        cs.officeSince[hogId] = state.day;
        cs.historicalOffices[hogId] = false;
        ctx.log(cs.tag, "office", `${db.people.get(leader)?.name.en ?? leader} — ${hog?.title.en ?? "Head of government"}`);
      }
      if (changedLead || (leader && leader !== current)) appointCabinet(ctx, cs, leader);
    }
  }
  if (res) res.government = { parties: [...opt.parties], support: [...opt.support], leader, minority: opt.minority };
  const names = opt.parties.map((p) => db.parties.get(p)?.abbrev.en ?? p).join("–");
  ctx.log(cs.tag, "government", `${opt.minority ? "Minority government" : opt.parties.length > 1 ? "Coalition government" : "Government"} formed: ${names}`);
}

const PORTFOLIO_ROLE: Record<string, string> = {
  foreign: "foreign_minister", defence: "defence_minister", finance: "finance_minister", interior: "interior_minister",
  economy: "economy_minister", justice: "justice_minister", energy: "energy_minister", intelligence: "intelligence_chief",
};

/**
 * A new government (off the historical record) appoints its own ministers: for each cabinet office,
 * the best available member of a governing party with that role, else the post stays vacant.
 */
export function appointCabinet(ctx: SimContext, cs: CountryState, leader: string | null): void {
  const { db, state } = ctx;
  const people = db.countries.get(cs.tag)?.people ?? [];
  const used = new Set<string>(leader ? [leader] : []);
  for (const o of db.countries.get(cs.tag)?.cabinet ?? []) {
    cs.historicalOffices[o.id] = false;
    const role = o.role === "intelligence_chief" ? "intelligence_chief" : PORTFOLIO_ROLE[o.portfolio ?? ""];
    let pick: string | null = null, best = -Infinity;
    for (const p of people) {
      if (used.has(p.id) || !role || !p.roles_possible.includes(role as never)) continue;
      if (o.role === "minister" && (!p.party || !cs.rulingParties.includes(p.party))) continue;
      if (!isAvailable(db, p.id, state.day, 25, 85)) continue;
      const score = p.electoral_appeal + (p.party === cs.rulingParties[0] ? 5 : 0);
      if (score > best) { best = score; pick = p.id; }
    }
    if (pick) used.add(pick);
    cs.offices[o.id] = [pick];
    cs.officeSince[o.id] = state.day;
  }
}

/** The player picks a pending coalition option; partners may refuse. Returns the outcome text. */
export function choosePendingCoalition(ctx: SimContext, index: number): { ok: boolean; text: string } {
  const { db, state, rng } = ctx;
  const pc = state.pendingCoalition;
  if (!pc) return { ok: false, text: "No government is being formed." };
  const cs = state.countries[pc.tag];
  const opt = pc.options[index];
  if (!cs || !opt) return { ok: false, text: "Unknown option." };
  const refused = opt.parties.filter((p) => !rng.chance(opt.acceptance[p] ?? 1));
  const res = state.elections.find((e) => e.id === pc.resultId) ?? null;
  if (refused.length && opt.parties.length > 1) {
    pc.options = pc.options.filter((_, i) => i !== index);
    const names = refused.map((p) => db.parties.get(p)?.name.en ?? p).join(", ");
    ctx.log(cs.tag, "government", `${names} declined to join the government`);
    if (!pc.options.length) pc.options.push({ ...opt, parties: [opt.parties[0]!], minority: true, support: [], acceptance: { [opt.parties[0]!]: 1 } });
    return { ok: false, text: `${names} declined.` };
  }
  state.pendingCoalition = null;
  const onTrack = !!res?.followedHistory;
  applyGovernment(ctx, cs, opt, res, onTrack);
  if (onTrack && cs.rulingParties.join() !== opt.parties.join() && !state.rules.strictHistory) cs.followsHistory = false;
  return { ok: true, text: "Government formed." };
}

// ------------------------------------------------------------------ confidence votes

/** Seats backing the government (governing parties plus confidence-and-supply) in the confidence chamber. */
export function governmentSupport(db: ContentDB, cs: CountryState): { chamber: string; support: number; total: number; majority: number } | null {
  const ch = db.countries.get(cs.tag)?.country?.legislature?.chambers.find((c) => c.confidence_chamber);
  if (!ch) return null;
  const { parties, total } = sittingSeats(db, cs.seats[ch.id] ?? {});
  const support = [...cs.rulingParties, ...cs.confidenceAndSupply].reduce((s, p) => s + (parties[p] ?? 0), 0);
  return { chamber: ch.id, support, total, majority: majorityOf(total) };
}

export const confidenceSystem: System = {
  id: "confidence",
  monthly(ctx) {
    const { db, state, rng } = ctx;
    const rules = db.politicsRules.coalitions;
    for (const cs of Object.values(state.countries)) {
      if (!cs.active || !db.governmentTypes.get(cs.govType)?.needs_majority) continue;
      const gv = db.countries.get(cs.tag)?.country?.government;
      if (!gv || gv.effective_executive !== gv.head_of_government_office) continue; // president-led systems
      if (state.rules.electionMode === "historical" && cs.followsHistory) continue; // real collapses come from the record
      if (state.pendingCoalition?.tag === cs.tag) continue;
      const g = governmentSupport(db, cs);
      if (!g || g.support >= g.majority || !cs.rulingParties.length) continue;
      const deficit = (g.majority - g.support) / g.total;
      const p = rules.confidence_loss_base * (1 - cs.stability) * (1 + deficit * 5);
      if (!rng.chance(p)) continue;
      ctx.log(cs.tag, "government", "The government lost a confidence vote");
      cs.stability = clamp(cs.stability - 0.03, 0, 1);
      cs.followsHistory = false;
      // try a new majority from the sitting chamber, else go to the voters
      const seats = cs.seats[g.chamber] ?? {};
      const { parties } = sittingSeats(db, seats);
      const formateurs = Object.keys(parties).sort((a, b) => parties[b]! - parties[a]!).slice(0, 3);
      const alt = formateurs.map((f) => coalitionOptions(db, seats, f)[0]).find((o) => o && !o.minority && o.parties.join() !== cs.rulingParties.join());
      if (alt && rng.chance(0.5)) applyGovernment(ctx, cs, alt, null, false);
      else if (!scheduleSnapElection(ctx, cs, g.chamber, rules.snap_election_delay_days)) {
        const fallback = alt ?? coalitionOptions(db, seats, formateurs[0]!).at(-1);
        if (fallback) applyGovernment(ctx, cs, fallback, null, false);
      }
    }
  },
};
