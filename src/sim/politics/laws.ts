/**
 * Law changes. A change costs political power (more for bigger jumps along the category's
 * spectrum), must be allowed by the government type and the ruling sub-ideology, and, where the
 * law requires a vote and the country has an elected legislature, must pass a vote in it.
 * Parties vote by their sub-ideology's preferred laws; governing parties back their government.
 * While a law is in force it drifts popular support (law data `ideology_support_drift`).
 */
import { RULING_IDEOLOGY, type ContentDB } from "../../content/compile.ts";
import type { SimContext, System } from "../simulation.ts";
import type { CountryState } from "../state.ts";
import { clamp, countryModifiers, normalise, partySub, rulingSubIdeology } from "./common.ts";
import { igTargets } from "./interestGroups.ts";

const SPECIAL = new Set(["independents", "others", "appointed", "vacant", "speaker"]);

export interface LawVote {
  chamber: string;
  yes: number;
  no: number;
  total: number;
  /** Party key -> how it votes. */
  parties: Record<string, "yes" | "no" | "split">;
}

export interface LawCheck {
  ok: boolean;
  cost: number;
  reasons: string[];
  vote: LawVote | null;
  /** Approval change per interest group once the law is in force (target, before drift). */
  approvalDelta: Record<string, number>;
}

/** Index of a law along its category's spectrum. */
const indexIn = (db: ContentDB, cat: string, law: string) => db.lawCategories.get(cat)?.laws.findIndex((l) => l.id === law) ?? -1;

/** How a party votes on moving `cat` from `from` to `to`. */
export function partyVote(db: ContentDB, cs: CountryState, party: string, cat: string, from: string, to: string): "yes" | "no" {
  const sub = db.subIdeologies.get(partySub(db, party));
  if (sub?.laws.forbidden.includes(to)) return "no";
  if (cs.rulingParties.includes(party)) return "yes";
  const pref = sub?.laws.preferred[cat] ?? [];
  if (pref.includes(to)) return "yes";
  if (!pref.length || pref.includes(from)) return "no";
  const target = pref.map((l) => indexIn(db, cat, l));
  const dist = (l: string) => Math.min(...target.map((t) => Math.abs(t - indexIn(db, cat, l))));
  return dist(to) < dist(from) ? "yes" : "no";
}

/** The chamber that votes on laws: the confidence chamber, else the first elected one. */
function votingChamber(db: ContentDB, cs: CountryState) {
  const chambers = db.countries.get(cs.tag)?.country?.legislature?.chambers ?? [];
  return chambers.find((c) => c.confidence_chamber) ?? chambers.find((c) => c.elected !== "appointed") ?? null;
}

export function lawVote(db: ContentDB, cs: CountryState, cat: string, to: string): LawVote | null {
  const ch = votingChamber(db, cs);
  if (!ch) return null;
  const from = cs.laws[cat] ?? "";
  const seats = cs.seats[ch.id] ?? {};
  const v: LawVote = { chamber: ch.id, yes: 0, no: 0, total: 0, parties: {} };
  for (const [k, n] of Object.entries(seats)) {
    if (k === "vacant") continue;
    if (!SPECIAL.has(k) && db.parties.get(k)?.abstentionist) continue;
    v.total += n;
    if (SPECIAL.has(k)) {
      v.parties[k] = "split";
      v.yes += n / 2;
      v.no += n / 2;
      continue;
    }
    const how = partyVote(db, cs, k, cat, from, to);
    v.parties[k] = how;
    if (how === "yes") v.yes += n;
    else v.no += n;
  }
  return v;
}

/** Everything the UI and the command need to know about a proposed law change. */
export function checkLawChange(db: ContentDB, cs: CountryState, cat: string, to: string, day: number): LawCheck {
  const reasons: string[] = [];
  const category = db.lawCategories.get(cat);
  const law = category?.laws.find((l) => l.id === to);
  const from = cs.laws[cat];
  if (!category || !law) return { ok: false, cost: 0, reasons: ["Unknown law."], vote: null, approvalDelta: {} };
  if (from === to) reasons.push("Already in force.");
  const gov = db.governmentTypes.get(cs.govType);
  if (gov?.forbidden_laws.includes(to)) reasons.push(`Not possible under a ${gov.name.toLowerCase()}.`);
  if (law.allowed_gov_types && !law.allowed_gov_types.includes(cs.govType)) reasons.push("Not possible under this government type.");
  const sub = rulingSubIdeology(db, cs);
  if (sub && db.subIdeologies.get(sub)?.laws.forbidden.includes(to)) reasons.push(`The ruling ${db.subIdeologies.get(sub)?.name} government will not enact it.`);
  const last = cs.lawChangedDay[cat];
  const cooldown = db.politicsRules.laws.cooldown_days;
  if (last !== undefined && day - last < cooldown) reasons.push(`Changed recently: possible again in ${cooldown - (day - last)} days.`);

  const steps = Math.max(1, Math.abs(indexIn(db, cat, to) - indexIn(db, cat, from ?? to)));
  const mods = countryModifiers(db, cs);
  const cost = Math.round(law.pp_cost * (1 + db.politicsRules.laws.extra_step_cost * (steps - 1)) * Math.max(0.2, 1 + (mods.law_change_cost ?? 0)));
  if (cs.politicalPower < cost) reasons.push(`Needs ${cost} political power (${Math.floor(cs.politicalPower)} available).`);

  const vote = law.requires_vote ? lawVote(db, cs, cat, to) : null;
  if (vote && vote.yes * 2 <= vote.total) reasons.push(`Lacks a majority: ${Math.round(vote.yes)} of ${vote.total} seats in favour.`);

  const before = igTargets(db, cs);
  const after = igTargets(db, { ...cs, laws: { ...cs.laws, [cat]: to } });
  const approvalDelta = Object.fromEntries(Object.keys(before).map((k) => [k, after[k]! - before[k]!]));
  return { ok: reasons.length === 0, cost, reasons, vote, approvalDelta };
}

/** Enact a law change (the command handler). */
export function changeLaw(ctx: SimContext, tag: string, cat: string, to: string): LawCheck & { passed: boolean } {
  const { db, state } = ctx;
  const cs = state.countries[tag];
  if (!cs) return { ok: false, cost: 0, reasons: ["Unknown country."], vote: null, approvalDelta: {}, passed: false };
  const chk = checkLawChange(db, cs, cat, to, state.day);
  const voteFailed = chk.vote && chk.vote.yes * 2 <= chk.vote.total;
  const otherReasons = chk.reasons.filter((r) => !r.startsWith("Lacks a majority"));
  if (otherReasons.length) return { ...chk, passed: false };
  const name = db.lawCategories.get(cat)?.laws.find((l) => l.id === to)?.name ?? to;
  if (voteFailed) {
    // a failed vote still spends some political capital
    cs.politicalPower -= Math.round(chk.cost * 0.25);
    ctx.log(tag, "law", `${name}: the bill was defeated in the legislature`);
    return { ...chk, passed: false };
  }
  cs.politicalPower -= chk.cost;
  cs.laws[cat] = to;
  cs.lawChangedDay[cat] = state.day;
  // influential groups that lose out cost stability
  let loss = 0;
  for (const [ig, d] of Object.entries(chk.approvalDelta)) if (d < 0) loss += (-d / 10) * (cs.interestGroups[ig]?.influence ?? 0);
  cs.stability = clamp(cs.stability - loss * db.politicsRules.laws.stability_hit * 10, 0, 1);
  if (tag === state.player) ctx.log(tag, "law", `${name} enacted`);
  return { ...chk, passed: true };
}

/** Weekly: laws in force drift popular support between sub-ideologies. */
export const lawDriftSystem: System = {
  id: "law_drift",
  weekly({ db, state }) {
    for (const cs of Object.values(state.countries)) {
      if (!cs.active) continue;
      const ruling = rulingSubIdeology(db, cs);
      let changed = false;
      for (const [cat, lawId] of Object.entries(cs.laws)) {
        const drift = db.lawCategories.get(cat)?.laws.find((l) => l.id === lawId)?.ideology_support_drift ?? {};
        for (const [sub, v] of Object.entries(drift)) {
          const key = sub === RULING_IDEOLOGY ? ruling : sub;
          if (!key) continue;
          cs.ideologySupport[key] = Math.max(0, (cs.ideologySupport[key] ?? 0) + v);
          changed = true;
        }
      }
      if (changed) cs.ideologySupport = normalise(cs.ideologySupport);
    }
  },
};
