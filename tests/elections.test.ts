import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { dayOf } from "../src/sim/date.ts";
import { Simulation } from "../src/sim/simulation.ts";
import { createInitialState, type ElectionResult, type GameState } from "../src/sim/state.ts";
import { modelShares } from "../src/sim/politics/voteModel.ts";
import { coalitionOptions } from "../src/sim/politics/coalition.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

const { db } = compileContent(new NodeFiles(), { only: new Set(["USA", "RUS", "DEU"]) });

function runTo(tag: string, iso: string, seed: number, mode: "historical" | "dynamic", until?: (s: GameState) => boolean) {
  const state = createInitialState(db, { provinces: [] }, { contentHash: "t", seed, player: null, rules: { electionMode: mode } });
  const sim = new Simulation(db, state);
  const end = dayOf(iso);
  while (sim.state.day < end && !until?.(sim.state)) sim.step();
  return sim;
}

const resultOf = (s: GameState, tag: string, key: (r: ElectionResult) => boolean) => s.elections.find((r) => r.tag === tag && key(r));
const SEEDS = Array.from({ length: 100 }, (_, i) => 1000 + i * 7919);

describe("calibration", () => {
  it("the vote model starts at the real vote shares", () => {
    const s = createInitialState(db, { provinces: [] }, { contentHash: "t" });
    const deu = s.countries.DEU!;
    const m = modelShares(db, deu, s.day);
    for (const p of ["deu.spd", "deu.cdu", "deu.greens", "deu.fdp"]) expect(m[p]).toBeCloseTo(deu.partyPopularity[p]! / Object.values(deu.partyPopularity).reduce((a, b) => a + b, 0), 2);
  });

  it("schedules the first real elections", () => {
    const s = createInitialState(db, { provinces: [] }, { contentHash: "t" });
    expect(s.countries.USA!.schedule.find((e) => e.office === "usa.president")?.day).toBe(dayOf("2000-11-07"));
    expect(s.countries.RUS!.schedule.find((e) => e.office === "rus.president")?.day).toBe(dayOf("2000-03-26"));
    expect(s.countries.DEU!.schedule.find((e) => e.chamber === "bundestag")?.day).toBe(dayOf("2002-09-22"));
  });
});

describe("historical mode reproduces real winners in at least 90% of seeded runs", () => {
  it("US 2000: George W. Bush wins the Electoral College", () => {
    let wins = 0;
    for (const seed of SEEDS) {
      const sim = runTo("USA", "2000-11-08", seed, "historical");
      const r = resultOf(sim.state, "USA", (x) => x.office === "usa.president");
      expect(r).toBeDefined();
      expect(Object.values(r!.unitVotes ?? {}).reduce((a, b) => a + b, 0)).toBe(538);
      if (r!.winner === "usa.george_w_bush") wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(90);
  }, 300_000);

  it("Russia 2000: Vladimir Putin wins", () => {
    let wins = 0;
    for (const seed of SEEDS) {
      const sim = runTo("RUS", "2000-03-27", seed, "historical");
      const r = resultOf(sim.state, "RUS", (x) => x.office === "rus.president");
      if (r?.winner === "rus.vladimir_putin") wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(90);
  }, 300_000);

  it("Germany 2002: SPD largest party and Schröder's SPD-led government continues", () => {
    let wins = 0;
    for (const seed of SEEDS) {
      const sim = runTo("DEU", "2002-12-31", seed, "historical", (st) => st.elections.some((x) => x.tag === "DEU" && x.chamber === "bundestag"));
      const r = resultOf(sim.state, "DEU", (x) => x.chamber === "bundestag");
      const deu = sim.state.countries.DEU!;
      if (r?.winner === "deu.spd" && deu.rulingParties[0] === "deu.spd" && deu.offices["deu.chancellor"]?.[0] === "deu.gerhard_schroeder") wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(90);
  }, 300_000);
});

describe("dynamic mode", () => {
  it("varies the US 2000 result across seeds", () => {
    const winners = new Set<string>();
    const shares: number[] = [];
    for (const seed of SEEDS.slice(0, 40)) {
      const sim = runTo("USA", "2000-11-08", seed, "dynamic");
      const r = resultOf(sim.state, "USA", (x) => x.office === "usa.president")!;
      winners.add(r.winner!);
      shares.push(r.shares[r.candidates![0]!.person]!);
    }
    expect(winners.size).toBeGreaterThan(1);
    expect(Math.max(...shares) - Math.min(...shares)).toBeGreaterThan(0.02);
  }, 300_000);

  it("Germany forms a majority government after the 2002 Bundestag election", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const sim = runTo("DEU", "2002-12-31", seed, "dynamic", (st) => st.elections.some((x) => x.tag === "DEU" && x.chamber === "bundestag"));
      const r = resultOf(sim.state, "DEU", (x) => x.chamber === "bundestag")!;
      expect(r.government).toBeDefined();
      expect(r.government!.parties.length).toBeGreaterThan(0);
      const seats = sim.state.countries.DEU!.seats.bundestag!;
      const total = Object.values(seats).reduce((a, b) => a + b, 0);
      const gov = r.government!.parties.reduce((s, p) => s + (seats[p] ?? 0), 0) + r.government!.support.reduce((s, p) => s + (seats[p] ?? 0), 0);
      if (!r.government!.minority) expect(gov * 2).toBeGreaterThan(total);
    }
  }, 300_000);
});

describe("coalitions", () => {
  it("finds SPD-Greens as the best SPD-led majority on the 2002 Bundestag seats", () => {
    const seats = { "deu.spd": 251, "deu.cdu": 190, "deu.csu": 58, "deu.greens": 55, "deu.fdp": 47, "deu.pds": 2 };
    const opts = coalitionOptions(db, seats, "deu.spd");
    expect(opts[0]!.parties.sort()).toEqual(["deu.greens", "deu.spd"]);
    expect(opts[0]!.seats).toBe(306);
    expect(opts[0]!.minority).toBe(false);
  });
});
