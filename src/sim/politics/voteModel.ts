/**
 * The vote model. A party's national share is built from:
 *  1. ideology support: each sub-ideology's voters split across parties by policy affinity, exp(-k * distance);
 *  2. a per-party calibration factor fixed at game start, so the model reproduces each party's real
 *     2000 vote share (data `popularity_2000`) and only *changes* move it afterwards;
 *  3. leader appeal (person.electoral_appeal), incumbency (plus law modifiers such as managed
 *     elections) and fatigue, and the economy for governing parties.
 * Elections add logit-normal noise and break the national result down by province.
 */
import type { ContentDB } from "../../content/compile.ts";
import type { CountryState, GameState } from "../state.ts";
import { clamp, contestingParties, countryModifiers, hashNormal, logit, partySub, policyDistance, yearsBetween } from "./common.ts";
import type { Shares } from "./seats.ts";

export interface PartyFactors {
  /** Share from ideology support alone. */
  ideology: number;
  calibration: number;
  leader: number;
  incumbency: number;
  economy: number;
  /** Normalised model share (no noise). */
  share: number;
}

/** Voter affinity of sub-ideology `voter` for a party of sub-ideology `party`. */
export const affinity = (db: ContentDB, voter: string, party: string) =>
  Math.exp(-db.politicsRules.elections.affinity_sharpness * policyDistance(db, voter, party));

/** Each party's share of the vote from ideology support alone. */
export function ideologyShares(db: ContentDB, support: Record<string, number>, parties: string[]): Shares {
  const out: Shares = Object.fromEntries(parties.map((p) => [p, 0]));
  if (!parties.length) return out;
  const subs = parties.map((p) => partySub(db, p));
  for (const [s, w] of Object.entries(support)) {
    if (w <= 0) continue;
    const a = subs.map((ps) => affinity(db, s, ps));
    const t = a.reduce((x, y) => x + y, 0);
    if (t > 0) parties.forEach((p, i) => (out[p]! += (w * a[i]!) / t));
  }
  return out;
}

/** Leader appeal multiplier for a person (50 = neutral). */
export function appealFactor(db: ContentDB, person: string | null | undefined): number {
  const a = person ? (db.people.get(person)?.electoral_appeal ?? 50) : 50;
  return Math.exp(db.politicsRules.elections.leader_appeal_weight * ((a - 50) / 50));
}

/** Incumbency multiplier for a governing party: bonus (plus law modifiers) minus fatigue after years in power. */
export function incumbencyFactor(db: ContentDB, cs: CountryState, day: number, mods = countryModifiers(db, cs)): number {
  const r = db.politicsRules.elections;
  const years = yearsBetween(cs.govSinceDay, day);
  const fatigue = Math.max(0, years - r.fatigue_after_years) * r.incumbency_fatigue;
  return Math.exp(r.incumbency_bonus + (mods.incumbent_advantage ?? 0) - fatigue);
}

/** Model factors for every contesting party (no noise). */
export function partyFactors(db: ContentDB, cs: CountryState, day: number, calibrated = true): Record<string, PartyFactors> {
  const parties = contestingParties(cs);
  const ideo = ideologyShares(db, cs.ideologySupport, parties);
  const mods = countryModifiers(db, cs);
  const inc = incumbencyFactor(db, cs, day, mods);
  const econ = Math.exp(db.politicsRules.elections.economy_weight * cs.economicMood);
  const out: Record<string, PartyFactors> = {};
  let total = 0;
  for (const p of parties) {
    const ruling = cs.rulingParties.includes(p);
    const f: PartyFactors = {
      ideology: ideo[p]!,
      calibration: calibrated ? (cs.partyBias[p] ?? 1) : 1,
      leader: appealFactor(db, cs.partyLeader[p]),
      incumbency: ruling ? inc : 1,
      economy: ruling ? econ : 1,
      share: 0,
    };
    f.share = Math.max(1e-6, f.ideology) * f.calibration * f.leader * f.incumbency * f.economy;
    total += f.share;
    out[p] = f;
  }
  for (const p of parties) out[p]!.share = total > 0 ? out[p]!.share / total : 0;
  return out;
}

/** National model shares without noise (what polls show). */
export function modelShares(db: ContentDB, cs: CountryState, day: number): Shares {
  return Object.fromEntries(Object.entries(partyFactors(db, cs, day)).map(([p, f]) => [p, f.share]));
}

/**
 * Calibration factors so that the uncalibrated model times the factor reproduces each party's real
 * starting vote share. Parties with no recorded vote keep a small floor so they can still grow.
 */
export function calibrate(db: ContentDB, cs: CountryState, day: number): Record<string, number> {
  const raw = partyFactors(db, cs, day, false);
  const target: Record<string, number> = {};
  for (const p of Object.keys(raw)) target[p] = Math.max(cs.partyPopularity[p] ?? 0, 0.002);
  const tt = Object.values(target).reduce((a, b) => a + b, 0) || 1;
  const out: Record<string, number> = {};
  for (const [p, f] of Object.entries(raw)) out[p] = clamp(target[p]! / tt / Math.max(f.share, 1e-6), 0.02, 50);
  return out;
}

/** Apply logit-normal noise to shares (sigma in logit units) and renormalise. */
export function noisy(shares: Shares, sigma: number, normal: () => number): Shares {
  const out: Shares = {};
  let t = 0;
  for (const [k, v] of Object.entries(shares)) {
    if (v <= 0) continue;
    out[k] = v * Math.exp(sigma * normal());
    t += out[k]!;
  }
  for (const k of Object.keys(out)) out[k]! /= t;
  return out;
}

// ------------------------------------------------------------------ provinces

/** The static per-province facts the simulation needs (from the map). */
export interface SimProvince {
  id: number;
  adm1: string[];
  culture: string | null;
  population: number;
  area_km2: number;
  /** [longitude, latitude]; optional (synthetic provinces have none). */
  centroid?: [number, number];
  name?: string;
  /** Starting infrastructure level (1-10) from the map. */
  infrastructure?: number;
  /** Terrain type and whether it touches the sea (building slots, ports). */
  terrain?: string;
  coastal?: boolean;
}

/** A country's provinces at the moment (owned), or synthetic equal units when no map is loaded. */
export function countryProvinces(state: GameState, provinces: SimProvince[] | undefined, tag: string): SimProvince[] {
  if (provinces?.length) {
    const own = provinces.filter((p) => state.provinceOwner[p.id - 1] === tag && p.population > 0);
    if (own.length) return own;
  }
  return Array.from({ length: 40 }, (_, i) => ({ id: -(i + 1), adm1: [], culture: null, population: 1, area_km2: 1 }));
}

/**
 * Break national shares (keyed by party or candidate) down by province. `partyOf(key)` gives the
 * party behind each key. Regional leans come from electoral units with real results where the data
 * has them; otherwise from regional parties' bases, culture, population density and a persistent
 * per-province variation. The result is raked so the population-weighted total matches the nation.
 */
export function provinceShares(
  db: ContentDB,
  tag: string,
  national: Shares,
  provinces: SimProvince[],
  partyOf: (key: string) => string | undefined,
): Map<number, Shares> {
  const r = db.politicsRules.elections;
  const cc = db.countries.get(tag);
  const primary = cc?.country?.culture_primary;
  const keys = Object.keys(national).filter((k) => national[k]! > 0);
  const out = new Map<number, Shares>();
  if (!keys.length) {
    for (const p of provinces) out.set(p.id, {});
    return out;
  }

  // electoral units with real results: logit lean of each unit relative to the basis election
  const eu = cc?.electoralUnits;
  const unitOf = new Map<string, (typeof eu extends undefined ? never : NonNullable<typeof eu>)["units"][number]>();
  let basisNational: Record<string, number> = {};
  if (eu) {
    for (const u of eu.units) for (const a of u.adm1) unitOf.set(a, u);
    const basis = cc?.elections?.elections.find((e) => e.id === eu.basis_election)?.historical;
    for (const c of basis?.candidates ?? []) if (c.party && c.share !== undefined && c.round === 1) basisNational[c.party] = (basisNational[c.party] ?? 0) + c.share;
    for (const pr of basis?.party_results ?? []) if (pr.share !== undefined) basisNational[pr.party] = pr.share;
  }

  const pops: number[] = [];
  // density relative to the country's own population-weighted mean (urban/rural lean redistributes within a country)
  const logD = (p: SimProvince) => Math.log10(Math.max(1, p.population / Math.max(1, p.area_km2)));
  const popSum = provinces.reduce((a, p) => a + p.population, 0) || 1;
  const meanLogD = provinces.reduce((a, p) => a + logD(p) * p.population, 0) / popSum;
  for (const prov of provinces) {
    const unit = prov.adm1.map((a) => unitOf.get(a)).find(Boolean);
    const dz = unit ? 0 : clamp((logD(prov) - meanLogD) / 1.2, -2, 2);
    const raw: Shares = {};
    keys.forEach((k) => {
      const party = partyOf(k);
      const pd = party ? db.parties.get(party) : undefined;
      let adj = 0;
      if (unit && party && unit.basis_shares[party] !== undefined && basisNational[party]) {
        // proportional swing from the real result: the basis election reproduces exactly
        adj += Math.log(Math.max(unit.basis_shares[party]!, 1e-4) / basisNational[party]!);
      } else if (!unit) {
        adj += r.province_noise * hashNormal(`${prov.id}:${pd?.sub_ideology ?? k}`);
      }
      if (pd?.regional_base?.length) {
        const inBase = pd.regional_base.some((b) => b === prov.culture || prov.adm1.includes(b));
        adj += inBase ? r.regional_boost : -r.regional_boost;
      } else if (pd && prov.culture && primary && prov.culture !== primary && pd.sub_ideology === "regionalist") {
        adj += r.regional_boost * 0.5;
      }
      const aff = pd ? db.subIdeologies.get(pd.sub_ideology)?.ig_affinity : undefined;
      if (aff) adj += r.density_weight * dz * (((aff.urban_middle_class ?? 0) - (aff.rural ?? 0)) / 10);
      raw[k] = national[k]! * Math.exp(adj);
    });
    out.set(prov.id, raw);
    pops.push(prov.population);
  }

  // rake: scale each key so the population-weighted mean equals the national share. Countries
  // with real regional results skip this: their leans already come from a real national result,
  // and the map's estimated populations would distort them.
  const totalPop = pops.reduce((a, b) => a + b, 0) || 1;
  for (let iter = 0; iter < (eu ? 0 : 4); iter++) {
    for (const s of out.values()) {
      const t = Object.values(s).reduce((a, b) => a + b, 0);
      for (const k of keys) s[k]! /= t;
    }
    const mean: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
    provinces.forEach((p, i) => {
      const s = out.get(p.id)!;
      for (const k of keys) mean[k]! += (s[k]! * pops[i]!) / totalPop;
    });
    for (const s of out.values()) for (const k of keys) s[k]! *= national[k]! / Math.max(mean[k]!, 1e-9);
  }
  for (const s of out.values()) {
    const t = Object.values(s).reduce((a, b) => a + b, 0);
    for (const k of keys) s[k]! /= t;
  }
  return out;
}
