import { describe, expect, it } from "vitest";
import {
  allocatePR,
  apportion,
  applyThreshold,
  highestAverages,
  instantRunoff,
  largestRemainder,
  mixedMemberProportional,
  multiMemberDistricts,
  parallel,
  singleMemberDistricts,
  sumSeats,
  twoRound,
} from "../src/sim/politics/seats.ts";

// Textbook example (votes A 100,000, B 80,000, C 30,000, D 20,000; 8 seats)
const votes = { A: 100_000, B: 80_000, C: 30_000, D: 20_000 };
const total = Object.values(votes).reduce((a, b) => a + b, 0);
const shares = Object.fromEntries(Object.entries(votes).map(([k, v]) => [k, v / total]));
const even = () => 1;

describe("proportional formulas", () => {
  it("D'Hondt favours larger parties", () => {
    expect(highestAverages(shares, 8, "dhondt")).toEqual({ A: 4, B: 3, C: 1, D: 0 });
  });
  it("Sainte-Laguë is more proportional", () => {
    expect(highestAverages(shares, 8, "sainte_lague")).toEqual({ A: 3, B: 3, C: 1, D: 1 });
  });
  it("Hare largest remainder", () => {
    expect(largestRemainder(shares, 8, "hare")).toEqual({ A: 3, B: 3, C: 1, D: 1 });
  });
  it("Droop largest remainder allocates exactly the seats", () => {
    const s = largestRemainder(shares, 8, "droop");
    expect(sumSeats(s)).toBe(8);
    expect(s.A).toBeGreaterThanOrEqual(s.B!);
  });
  it("thresholds drop small parties before allocation", () => {
    expect(Object.keys(applyThreshold(shares, 0.1))).toEqual(["A", "B", "C"]);
    expect(allocatePR(shares, 8, "dhondt", 0.1).D).toBeUndefined();
    expect(sumSeats(allocatePR(shares, 8, "dhondt", 0.1))).toBe(8);
  });
  it("reproduces the 2002 Bundestag list allocation proportions (Hare, 5% threshold)", () => {
    // second-vote shares 2002 (SPD, CDU, CSU, Greens, FDP, PDS, others)
    const s = { spd: 0.385, cdu: 0.295, csu: 0.09, greens: 0.086, fdp: 0.074, pds: 0.04, oth: 0.03 };
    const seats = allocatePR(s, 598, "hare", 0.05);
    expect(seats.pds).toBeUndefined();
    expect(sumSeats(seats)).toBe(598);
    expect(seats.spd).toBeGreaterThan(seats.cdu!);
  });
});

describe("majoritarian systems", () => {
  it("first past the post: plurality per district", () => {
    const d = [{ A: 0.4, B: 0.35, C: 0.25 }, { A: 0.3, B: 0.5, C: 0.2 }, { A: 0.45, B: 0.1, C: 0.45 + 1e-9 }];
    expect(singleMemberDistricts(d, "plurality", even)).toEqual({ A: 1, B: 1, C: 1 });
  });
  it("two rounds: runoff between the top two with transfers by affinity", () => {
    const aff = (from: string, to: string) => (from === "C" && to === "B" ? 1 : from === "C" ? 0.1 : 1);
    const r = twoRound({ A: 0.42, B: 0.38, C: 0.2 }, aff);
    expect(r.runoff).not.toBeNull();
    expect(r.winner).toBe("B");
    expect(twoRound({ A: 0.55, B: 0.45 }, aff)).toEqual({ winner: "A", runoff: null });
  });
  it("instant runoff eliminates the last candidate until a majority", () => {
    const aff = (from: string, to: string) => (from === "C" && to === "B" ? 1 : 0.05);
    expect(instantRunoff({ A: 0.4, B: 0.35, C: 0.25 }, aff)).toBe("B");
  });
  it("block vote gives every seat of a district to its plurality winner", () => {
    const d = Array.from({ length: 5 }, () => ({ A: 0.4, B: 0.35, C: 0.25 }));
    expect(multiMemberDistricts(d, 5, "block")).toEqual({ A: 5 });
    expect(sumSeats(multiMemberDistricts(d, 5, "proportional"))).toBe(5);
  });
});

describe("mixed systems", () => {
  it("MMP tops up to proportionality and keeps overhang seats", () => {
    const s = { A: 0.45, B: 0.35, C: 0.2 };
    const seats = mixedMemberProportional(s, { A: 60, B: 40 }, 200, "sainte_lague", 0.05);
    expect(seats).toEqual({ A: 90, B: 70, C: 40 });
    const over = mixedMemberProportional(s, { A: 100 }, 200, "sainte_lague", 0.05);
    expect(over.A).toBe(100); // overhang
    expect(sumSeats(over)).toBe(210);
  });
  it("MMP exempts parties with enough district wins from the threshold", () => {
    const seats = mixedMemberProportional({ A: 0.6, B: 0.37, C: 0.03 }, { C: 3 }, 100, "hare", 0.05);
    expect(seats.C).toBe(3);
  });
  it("parallel adds PR seats to district seats", () => {
    expect(parallel({ A: 0.5, B: 0.5 }, { A: 10 }, 10, "dhondt", 0)).toEqual({ A: 15, B: 5 });
  });
  it("apportions districts by population", () => {
    expect(apportion([10, 20, 70], 10)).toEqual([1, 2, 7]);
    expect(apportion([1, 1, 1], 4).reduce((a, b) => a + b, 0)).toBe(4);
  });
});
