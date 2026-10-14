/**
 * Election calendar. Each recurrence rule in elections.json becomes a scheduled election. In
 * historical mode, while a country follows history, the next date is the next real election of
 * that kind (including real snap elections); otherwise it is the regular term after the last one.
 */
import { GAME_START, type ContentDB } from "../../content/compile.ts";
import type { Election } from "../../content/schemas/country.ts";
import { dayOf, isoOf } from "../date.ts";
import type { ScheduledElection } from "../state.ts";

export const electionKey = (kind: string, chamber?: string, office?: string) => `${kind}:${chamber ?? office ?? ""}`;

/** Same calendar date N years later (29 February falls back to the 28th). */
export function addYears(day: number, years: number): number {
  const iso = isoOf(day);
  const whole = Math.floor(years);
  let y = Number(iso.slice(0, 4)) + whole;
  let md = iso.slice(5);
  if (md === "02-29") md = "02-28";
  let d = dayOf(`${y}-${md}`);
  const frac = years - whole;
  if (frac > 0) d += Math.round(frac * 365.25);
  return d;
}

/** Recorded elections for a schedule key, in date order. */
export function recordedElections(db: ContentDB, tag: string, key: string): Election[] {
  const el = db.countries.get(tag)?.elections?.elections ?? [];
  return el.filter((e) => electionKey(e.kind, e.chamber, e.office) === key).sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** The recorded election for a key held on (or within a few days of) a day. */
export function recordFor(db: ContentDB, tag: string, key: string, day: number): Election | undefined {
  return recordedElections(db, tag, key).find((e) => Math.abs(dayOf(e.date) - day) <= 3);
}

export function initialSchedule(db: ContentDB, tag: string, day: number): ScheduledElection[] {
  const el = db.countries.get(tag)?.elections;
  if (!el) return [];
  const out: ScheduledElection[] = [];
  for (const r of el.rules) {
    if (r.kind === "referendum" || r.kind === "local_regional" || r.kind === "party_congress" || r.kind === "party_leadership") continue;
    const key = electionKey(r.kind, r.chamber, r.office);
    if (out.some((s) => s.key === key)) continue;
    const first = recordedElections(db, tag, key).find((e) => e.date >= GAME_START);
    let d: number;
    if (first) d = dayOf(first.date);
    else {
      // walk the anchor back or forward to the first date after the start
      d = dayOf(r.anchor);
      while (d > day) d = addYears(d, -r.every_years);
      while (d <= day) d = addYears(d, r.every_years);
    }
    out.push({ key, kind: r.kind, chamber: r.chamber, office: r.office, day: d, everyYears: r.every_years, snapPossible: r.snap_possible, snap: false });
  }
  return out.sort((a, b) => a.day - b.day);
}

/** Date of the next election after one held on `heldDay`. */
export function nextElectionDay(db: ContentDB, tag: string, s: ScheduledElection, heldDay: number, followHistory: boolean): number {
  if (followHistory) {
    const next = recordedElections(db, tag, s.key).find((e) => dayOf(e.date) > heldDay + 3);
    if (next) return dayOf(next.date);
  }
  return addYears(heldDay, s.everyYears);
}
