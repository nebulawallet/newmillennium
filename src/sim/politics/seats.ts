/**
 * Seat allocation: pure functions from vote shares to seats for every electoral system in the
 * data (list PR with D'Hondt, Sainte-Laguë, Imperiali, Hare or Droop quotas; single-member
 * districts by plurality, two rounds or alternative vote; mixed-member proportional; parallel;
 * multi-member approximations of STV, SNTV and block voting). No game state, no randomness.
 */

export type Shares = Record<string, number>;
export type Seats = Record<string, number>;
export type PrFormula = "dhondt" | "sainte_lague" | "imperiali" | "hare" | "droop";

const keysOf = (s: Shares) => Object.keys(s).filter((k) => (s[k] ?? 0) > 0);

/** Drop parties below a national threshold (unless exempt) and renormalise the rest. */
export function applyThreshold(shares: Shares, threshold = 0, exempt: Set<string> = new Set()): Shares {
  const kept = keysOf(shares).filter((k) => shares[k]! >= threshold || exempt.has(k));
  const total = kept.reduce((s, k) => s + shares[k]!, 0);
  const out: Shares = {};
  if (total <= 0) return out;
  for (const k of kept) out[k] = shares[k]! / total;
  return out;
}

/** Highest-averages methods. Ties go to the larger vote total, then the key order (stable). */
export function highestAverages(shares: Shares, seats: number, formula: "dhondt" | "sainte_lague" | "imperiali"): Seats {
  const ks = keysOf(shares).sort((a, b) => shares[b]! - shares[a]! || (a < b ? -1 : 1));
  const out: Seats = Object.fromEntries(ks.map((k) => [k, 0]));
  if (!ks.length) return out;
  const div = formula === "dhondt" ? (n: number) => n + 1 : formula === "sainte_lague" ? (n: number) => 2 * n + 1 : (n: number) => n + 2;
  for (let s = 0; s < seats; s++) {
    let best = ks[0]!, bestQ = -1;
    for (const k of ks) {
      const q = shares[k]! / div(out[k]!);
      if (q > bestQ + 1e-12) { best = k; bestQ = q; }
    }
    out[best]! += 1;
  }
  return out;
}

/** Largest-remainder methods with a Hare (votes/seats) or Droop (votes/(seats+1) + 1) quota. */
export function largestRemainder(shares: Shares, seats: number, quota: "hare" | "droop"): Seats {
  const ks = keysOf(shares);
  const total = ks.reduce((s, k) => s + shares[k]!, 0);
  const out: Seats = {};
  if (!ks.length || total <= 0 || seats <= 0) return Object.fromEntries(ks.map((k) => [k, 0]));
  // shares are fractions; scale to a notional 1,000,000 voters so the Droop "+1" is meaningful
  const V = 1_000_000;
  const q = quota === "hare" ? V / seats : Math.floor(V / (seats + 1)) + 1;
  const rem: [string, number][] = [];
  let given = 0;
  for (const k of ks) {
    const v = (shares[k]! / total) * V;
    out[k] = Math.floor(v / q);
    given += out[k]!;
    rem.push([k, v - out[k]! * q]);
  }
  rem.sort((a, b) => b[1] - a[1] || (shares[b[0]]! - shares[a[0]]!));
  for (let i = 0; given < seats; i = (i + 1) % rem.length, given++) out[rem[i]![0]]! += 1;
  // Droop can over-allocate on tiny inputs; trim from the smallest remainders
  while (given > seats) {
    const k = rem[rem.length - 1]![0];
    if (out[k]! > 0) { out[k]! -= 1; given--; }
    rem.pop();
  }
  return out;
}

/** Proportional allocation by formula, after the threshold. */
export function allocatePR(shares: Shares, seats: number, formula: PrFormula = "dhondt", threshold = 0, exempt?: Set<string>): Seats {
  const s = applyThreshold(shares, threshold, exempt);
  if (formula === "hare" || formula === "droop") return largestRemainder(s, seats, formula);
  return highestAverages(s, seats, formula);
}

export const plurality = (shares: Shares): string | null => {
  let best: string | null = null;
  for (const k of keysOf(shares)) if (best === null || shares[k]! > shares[best]!) best = k;
  return best;
};

/** Ranks keys by share, descending. */
export const ranked = (shares: Shares): string[] => keysOf(shares).sort((a, b) => shares[b]! - shares[a]!);

/**
 * Transfer the votes of eliminated options to the remaining ones. `affinity(from, to)` gives the
 * relative preference (>= 0) of a voter of `from` for `to`; `abstain` is the share of transferred
 * votes that do not transfer at all.
 */
export function transfer(shares: Shares, remaining: string[], affinity: (from: string, to: string) => number, abstain = 0.2): Shares {
  const out: Shares = Object.fromEntries(remaining.map((k) => [k, shares[k] ?? 0]));
  for (const k of keysOf(shares)) {
    if (remaining.includes(k)) continue;
    const w = remaining.map((r) => Math.max(0, affinity(k, r)));
    const tw = w.reduce((a, b) => a + b, 0);
    if (tw <= 0) continue;
    remaining.forEach((r, i) => (out[r]! += (shares[k]! * (1 - abstain) * w[i]!) / tw));
  }
  return out;
}

/** Two-round system: first-round majority wins, else a runoff between the top two. */
export function twoRound(shares: Shares, affinity: (from: string, to: string) => number, majority = 0.5): { winner: string | null; runoff: Shares | null } {
  const order = ranked(shares);
  const total = order.reduce((s, k) => s + shares[k]!, 0);
  if (!order.length) return { winner: null, runoff: null };
  if (order.length === 1 || shares[order[0]!]! / total > majority) return { winner: order[0]!, runoff: null };
  const second = transfer(shares, order.slice(0, 2), affinity);
  const t2 = second[order[0]!]! + second[order[1]!]!;
  const runoff: Shares = { [order[0]!]: second[order[0]!]! / t2, [order[1]!]: second[order[1]!]! / t2 };
  return { winner: plurality(runoff), runoff };
}

/** Alternative vote (instant runoff): eliminate the last option until one has a majority. */
export function instantRunoff(shares: Shares, affinity: (from: string, to: string) => number): string | null {
  let cur = { ...shares };
  for (let i = 0; i < 20; i++) {
    const order = ranked(cur);
    const total = order.reduce((s, k) => s + cur[k]!, 0);
    if (order.length <= 1 || cur[order[0]!]! / total > 0.5) return order[0] ?? null;
    cur = transfer(cur, order.slice(0, -1), affinity, 0.1);
  }
  return plurality(cur);
}

/** Single-member districts: the plurality (or two-round / AV) winner of each district takes its seat. */
export function singleMemberDistricts(
  districts: Shares[],
  rule: "plurality" | "two_round" | "av",
  affinity: (from: string, to: string) => number,
): Seats {
  const out: Seats = {};
  for (const d of districts) {
    const w = rule === "plurality" ? plurality(d) : rule === "two_round" ? twoRound(d, affinity).winner : instantRunoff(d, affinity);
    if (w) out[w] = (out[w] ?? 0) + 1;
  }
  return out;
}

/** Multi-member districts of magnitude m allocated proportionally (STV/SNTV approximation) or all to the plurality winner (block vote). */
export function multiMemberDistricts(districts: Shares[], magnitude: number, mode: "proportional" | "block"): Seats {
  const out: Seats = {};
  for (let i = 0; i < districts.length; i += magnitude) {
    const group = districts.slice(i, i + magnitude);
    const merged: Shares = {};
    for (const d of group) for (const [k, v] of Object.entries(d)) merged[k] = (merged[k] ?? 0) + v / group.length;
    const got = mode === "block" ? { [plurality(merged) ?? ""]: group.length } : largestRemainder(merged, group.length, "droop");
    for (const [k, v] of Object.entries(got)) if (k) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

/**
 * Mixed-member proportional: each party's total is its PR entitlement over the whole chamber,
 * or its district seats if more (overhang seats enlarge the chamber, as in Germany before 2023).
 */
export function mixedMemberProportional(
  shares: Shares,
  districtSeats: Seats,
  totalSeats: number,
  formula: PrFormula,
  threshold: number,
  exemptDistricts = 3,
): Seats {
  const exempt = new Set(Object.keys(districtSeats).filter((k) => districtSeats[k]! >= exemptDistricts));
  const entitled = allocatePR(shares, totalSeats, formula, threshold, exempt);
  const out: Seats = {};
  for (const k of new Set([...Object.keys(entitled), ...Object.keys(districtSeats)])) {
    const v = Math.max(entitled[k] ?? 0, districtSeats[k] ?? 0);
    if (v > 0) out[k] = v;
  }
  return out;
}

/** Parallel (mixed-member majoritarian): district seats plus separately allocated PR seats. */
export function parallel(shares: Shares, districtSeats: Seats, prSeats: number, formula: PrFormula, threshold: number): Seats {
  const pr = allocatePR(shares, prSeats, formula, threshold);
  const out: Seats = { ...districtSeats };
  for (const [k, v] of Object.entries(pr)) out[k] = (out[k] ?? 0) + v;
  return out;
}

/** Hamilton apportionment of n items across weights (used to give provinces their districts). */
export function apportion(weights: number[], n: number): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || n <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (w / total) * n);
  const out = exact.map(Math.floor);
  let left = n - out.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => [e - Math.floor(e), i] as const).sort((a, b) => b[0] - a[0]);
  for (let j = 0; left > 0; j = (j + 1) % order.length, left--) out[order[j]![1]]! += 1;
  return out;
}

export const sumSeats = (s: Seats) => Object.values(s).reduce((a, b) => a + b, 0);
