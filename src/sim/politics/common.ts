/**
 * Shared helpers for the political systems: policy distance, modifier totals, who is alive and
 * available, and which parties can contest elections. Pure functions over content and state.
 */
import { POLICY_AXES } from "../../content/schemas/definitions.ts";
import type { ContentDB } from "../../content/compile.ts";
import type { Person } from "../../content/schemas/country.ts";
import { dayOf, isoOf, ymdOf } from "../date.ts";
import type { CountryState, GameState } from "../state.ts";

const distanceCache = new WeakMap<ContentDB, Map<string, number>>();

/** Policy distance between two sub-ideologies, 0 (same) .. 1 (opposite on every axis). Memoised per content database. */
export function policyDistance(db: ContentDB, a: string, b: string): number {
  if (a === b) return 0;
  let cache = distanceCache.get(db);
  if (!cache) distanceCache.set(db, (cache = new Map()));
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const pa = db.subIdeologies.get(a)?.policy, pb = db.subIdeologies.get(b)?.policy;
  let d = 0.5;
  if (pa && pb) {
    let s = 0;
    for (const ax of POLICY_AXES) s += (pa[ax] - pb[ax]) ** 2;
    d = Math.sqrt(s / POLICY_AXES.length) / 2;
  }
  cache.set(key, d);
  return d;
}

export const partySub = (db: ContentDB, party: string) => db.parties.get(party)?.sub_ideology ?? "big_tent";

/** A party's current successor after mergers and renames (itself if still active). */
export function successorParty(db: ContentDB, cs: CountryState, party: string | undefined): string | undefined {
  let p = party;
  for (let i = 0; p && i < 6 && cs.partyStatus[p] === "dissolved"; i++) {
    const l = db.parties.get(p)?.lineage;
    p = l?.merged_into ?? l?.renamed_to;
  }
  return p;
}

/** A person's party today (their recorded party, followed through mergers and renames). */
export const personParty = (db: ContentDB, cs: CountryState, person: string | null | undefined) =>
  person ? successorParty(db, cs, db.people.get(person)?.party) : undefined;

/** Parties that can contest elections and hold seats right now. */
export function contestingParties(cs: CountryState): string[] {
  return Object.keys(cs.partyStatus).filter((p) => cs.partyStatus[p] === "active" || cs.partyStatus[p] === "extra_parliamentary");
}

/** Ruling sub-ideology: the leading governing party's, else the effective leader's. */
export function rulingSubIdeology(db: ContentDB, cs: CountryState): string | null {
  const lead = cs.rulingParties[0];
  if (lead) return partySub(db, lead);
  const exec = effectiveLeader(db, cs);
  return exec ? (db.people.get(exec)?.sub_ideology ?? null) : null;
}

/** Person id of the effective executive (follows ex officio links within the state). */
export function effectiveLeader(db: ContentDB, cs: CountryState, state?: GameState): string | null {
  const office = db.countries.get(cs.tag)?.country?.government.effective_executive;
  if (!office) return null;
  const o = db.offices.get(office);
  if (o?.ex_officio_of && state) {
    const target = db.offices.get(o.ex_officio_of);
    return target ? (state.countries[target.tag]?.offices[o.ex_officio_of]?.[0] ?? null) : null;
  }
  return cs.offices[office]?.[0] ?? null;
}

/** Sum of modifiers from the government type, laws in force, ruling sub-ideology and leader traits. */
export function countryModifiers(db: ContentDB, cs: CountryState): Readonly<Record<string, number>> {
  // cached per country while every input is unchanged (callers must not mutate the result)
  // signature: government, governing party, effective leader, laws (each change stamps lawChangedDay), timed modifiers, technologies
  const tm = cs.timedModifiers ?? [];
  let lawSig = 0;
  for (const d of Object.values(cs.lawChangedDay)) lawSig += d;
  let tmSig = tm.length;
  for (const t of tm) tmSig += t.value * 7919 + t.until;
  const leader = effectiveLeader(db, cs);
  let bSig = 0;
  for (const v of Object.values(cs.economy?.buildingMods ?? {})) bSig += v;
  const key = `${cs.govType}|${cs.rulingParties[0]}|${leader}|${lawSig}|${tmSig}|${cs.research?.completed.length ?? 0}|${bSig}|${cs.spirits?.join(",") ?? ""}`;
  const hit = modCache.get(cs);
  if (hit && hit.db === db && hit.key === key) return hit.mods;
  const sub = rulingSubIdeology(db, cs);
  const mods = computeModifiers(db, cs, sub, leader);
  modCache.set(cs, { db, key, mods });
  return mods;
}
const modCache = new WeakMap<CountryState, { db: ContentDB; key: string; mods: Record<string, number> }>();

function computeModifiers(db: ContentDB, cs: CountryState, sub: string | null, leader: string | null): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (m: Record<string, number> | undefined) => {
    for (const [k, v] of Object.entries(m ?? {})) out[k] = (out[k] ?? 0) + v;
  };
  add(db.governmentTypes.get(cs.govType)?.modifiers);
  for (const [cat, law] of Object.entries(cs.laws)) add(db.lawCategories.get(cat)?.laws.find((l) => l.id === law)?.modifiers);
  if (sub) add(db.subIdeologies.get(sub)?.modifiers);
  for (const t of (leader ? db.people.get(leader)?.traits : undefined) ?? []) add(db.traits.get(t)?.modifiers);
  for (const tm of cs.timedModifiers ?? []) out[tm.modifier] = (out[tm.modifier] ?? 0) + tm.value;
  for (const s of cs.spirits ?? []) add(db.spirits.get(s)?.modifiers);
  add(techModifiers(db, cs));
  // buildings: air bases, ports, power plants, data centres (refreshed monthly by the economy)
  add(cs.economy?.buildingMods);
  return out;
}

/** Summed technology effects, cached per country while its list of completed technologies is unchanged (it only grows). */
const techCache = new WeakMap<object, { db: ContentDB; n: number; first: string | undefined; mods: Record<string, number> }>();
function techModifiers(db: ContentDB, cs: CountryState): Record<string, number> | undefined {
  const done = cs.research?.completed;
  if (!done?.length) return undefined;
  const c = techCache.get(done);
  if (c && c.db === db && c.n === done.length && c.first === done[0]) return c.mods;
  const mods: Record<string, number> = {};
  for (const t of done) for (const [k, v] of Object.entries(db.techs.get(t)?.effects ?? {})) mods[k] = (mods[k] ?? 0) + v;
  techCache.set(done, { db, n: done.length, first: done[0], mods });
  return mods;
}

/** Has this person died by this day? (Only real, recorded deaths: the game scripts none.) */
export function hasDied(p: Person, day: number): boolean {
  if (!p.died) return false;
  const d = p.died.length === 4 ? `${p.died}-12-31` : p.died.length === 7 ? `${p.died}-28` : p.died;
  return dayOf(d) <= day;
}

/** Can this person take part in politics on this day (alive, of age, inside their availability window)? */
export function isAvailable(db: ContentDB, personId: string, day: number, minAge = 18, maxAge = 200): boolean {
  const p = db.people.get(personId);
  if (!p || hasDied(p, day)) return false;
  const iso = isoOf(day);
  if (p.available.from && iso < p.available.from) return false;
  if (p.available.to && iso >= p.available.to) return false;
  if (p.generated && iso < "2027-01-01") return false;
  const age = ymdOf(day).year - p.birth_year;
  return age >= minAge && age < maxAge;
}

export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
export const logit = (p: number) => Math.log(clamp(p, 1e-6, 1 - 1e-6) / (1 - clamp(p, 1e-6, 1 - 1e-6)));

/** Normalise positive weights to shares summing to 1. */
export function normalise<T extends string>(w: Record<T, number>): Record<T, number> {
  const total = Object.values<number>(w).reduce((a, b) => a + Math.max(0, b), 0);
  const out = {} as Record<T, number>;
  for (const k of Object.keys(w) as T[]) out[k] = total > 0 ? Math.max(0, w[k]) / total : 0;
  return out;
}

/** Stable small hash of a string to [0, 1): persistent per-province variation without RNG state. */
export function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Deterministic standard-normal value from a string key (Box–Muller over two hashes). */
export function hashNormal(key: string): number {
  const u = Math.max(hash01(key + "#a"), 1e-9), v = hash01(key + "#b");
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const yearsBetween = (fromDay: number, toDay: number) => (toDay - fromDay) / 365.25;
