import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { dayOf, formatDate, isoOf, ymdOf } from "../src/sim/date.ts";
import { Rng, seedRng } from "../src/sim/rng.ts";
import { parseSaveFile, toSaveFile } from "../src/sim/save.ts";
import { Simulation } from "../src/sim/simulation.ts";
import { createInitialState } from "../src/sim/state.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

const { db } = compileContent(new NodeFiles(), { only: new Set(["DEU"]) });
const newState = (mode: "historical" | "dynamic" = "historical") =>
  createInitialState(db, { provinces: [] }, { contentHash: "test", player: "DEU", rules: { electionMode: mode } });

describe("dates", () => {
  it("round-trips ISO dates and day numbers", () => {
    expect(dayOf("2000-01-01")).toBe(0);
    expect(isoOf(366)).toBe("2001-01-01"); // 2000 is a leap year
    for (const d of ["2004-02-29", "2026-10-14", "2035-12-31"]) expect(isoOf(dayOf(d))).toBe(d);
    expect(ymdOf(0)).toMatchObject({ year: 2000, month: 1, day: 1, weekday: 6 });
    expect(formatDate(dayOf("2001-09-11"))).toBe("11 September 2001");
  });
});

describe("rng", () => {
  it("is deterministic per seed", () => {
    const a = new Rng(seedRng(42)), b = new Rng(seedRng(42)), c = new Rng(seedRng(43));
    const xa = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(xa);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(xa);
    expect(xa.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe("initial state", () => {
  it("starts Germany with Rau, Schröder and an SPD-Green coalition", () => {
    const s = newState();
    const deu = s.countries.DEU!;
    expect(s.day).toBe(0);
    expect(deu.active).toBe(true);
    expect(deu.offices["deu.federal_president"]).toEqual(["deu.johannes_rau"]);
    expect(deu.offices["deu.chancellor"]).toEqual(["deu.gerhard_schroeder"]);
    expect(deu.rulingParties).toEqual(["deu.spd", "deu.greens"]);
    expect(deu.seats.bundestag!["deu.spd"]).toBe(298);
    expect(deu.partyLeader["deu.cdu"]).toBe("deu.wolfgang_schaeuble");
    expect(deu.laws.conscription).toBe("universal_conscription");
    expect(Object.keys(deu.interestGroups)).toHaveLength(10);
  });
});

describe("simulation", () => {
  it("follows the historical timeline in historical mode", () => {
    const sim = new Simulation(db, newState("historical"));
    const target = dayOf("2006-01-01");
    while (sim.state.day < target) sim.step();
    const deu = sim.state.countries.DEU!;
    expect(deu.offices["deu.chancellor"]).toEqual(["deu.angela_merkel"]);
    expect(deu.offices["deu.federal_president"]).toEqual(["deu.horst_koehler"]);
    expect(deu.partyLeader["deu.cdu"]).toBe("deu.angela_merkel");
    expect(sim.state.log.some((e) => e.text.includes("Angela Merkel"))).toBe(true);
    expect(deu.politicalPower).toBeGreaterThan(50);
  }, 30_000);

  it("does not apply history in dynamic mode", () => {
    const sim = new Simulation(db, newState("dynamic"));
    while (sim.state.day < dayOf("2006-01-01")) sim.step();
    expect(sim.state.countries.DEU!.offices["deu.chancellor"]).toEqual(["deu.gerhard_schroeder"]);
  }, 30_000);

  it("is deterministic and save files round-trip", () => {
    const run = () => {
      const sim = new Simulation(db, newState());
      for (let i = 0; i < 400; i++) sim.step();
      return sim.state;
    };
    const a = run(), b = run();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const restored = parseSaveFile(JSON.stringify(toSaveFile(a, "test"))).state;
    expect(restored).toEqual(a);
    // continuing from a restored save matches continuing the original
    const s1 = new Simulation(db, structuredClone(a)), s2 = new Simulation(db, restored);
    for (let i = 0; i < 30; i++) { s1.step(); s2.step(); }
    expect(JSON.stringify(s2.state)).toBe(JSON.stringify(s1.state));
  });
});
