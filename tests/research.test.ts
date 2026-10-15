import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { dayOf } from "../src/sim/date.ts";
import { techCost, techStatus } from "../src/sim/research/research.ts";
import { Simulation } from "../src/sim/simulation.ts";
import { createInitialState } from "../src/sim/state.ts";
import { countryModifiers } from "../src/sim/politics/common.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

const { db, issues } = compileContent(new NodeFiles(), { only: new Set(["USA", "CHN", "SOM"]) });
const fresh = (player: string | null = null) => new Simulation(db, createInitialState(db, { provinces: [] }, { contentHash: "t", player }));

describe("technology data", () => {
  it("validates: unique ids, known prerequisites and modifiers", () => {
    expect(issues.filter((i) => i.file.startsWith("techs/") && i.severity === "error")).toEqual([]);
    expect(db.techCategories.size).toBe(9);
    expect(db.techs.size).toBeGreaterThan(60);
  });
});

describe("starting technologies", () => {
  it("follow real 2000 income and R&D: richer economies start further ahead", () => {
    const s = fresh().state;
    const n = (t: string) => s.countries[t]!.research!.completed.length;
    expect(n("USA")).toBeGreaterThan(n("CHN"));
    expect(n("CHN")).toBeGreaterThanOrEqual(n("SOM"));
    // nobody starts with technologies from after 2000
    for (const t of ["USA", "CHN", "SOM"]) for (const id of s.countries[t]!.research!.completed) expect(db.techs.get(id)!.year).toBeLessThanOrEqual(2000);
    // prerequisites of every starting technology are also known
    for (const id of s.countries.USA!.research!.completed)
      for (const g of db.techs.get(id)!.prerequisites) expect(g.some((p) => s.countries.USA!.research!.completed.includes(p))).toBe(true);
  });
});

describe("researching", () => {
  it("researching ahead of time costs more; catching up costs less", () => {
    const t = db.techs.get("air_sixth_generation")!;
    expect(techCost(db, t, dayOf("2000-01-01")).cost).toBeGreaterThan(t.cost * 5);
    const old = db.techs.get("ind_nuclear_power")!;
    expect(techCost(db, old, dayOf("2000-01-01")).cost).toBeLessThan(old.cost);
  });

  it("completes a technology and applies its effects", () => {
    const sim = fresh("USA");
    const usa = sim.state.countries.USA!;
    const t = [...db.techs.values()].find((x) => techStatus(usa, x) === "available" && x.year <= 2004 && Object.keys(x.effects).length)!;
    const [mod, val] = Object.entries(t.effects)[0]!;
    const before = countryModifiers(db, usa)[mod] ?? 0;
    expect(sim.dispatch({ type: "set_research", tag: "USA", slot: 0, tech: t.id }).ok).toBe(true);
    expect(sim.dispatch({ type: "set_research", tag: "USA", slot: 1, tech: "air_sixth_generation" }).ok).toBe(false); // locked
    for (let i = 0; i < 2000 && !usa.research!.completed.includes(t.id); i++) sim.step();
    expect(usa.research!.completed).toContain(t.id);
    expect(countryModifiers(db, usa)[mod]).toBeCloseTo(before + val, 5);
  }, 60_000);

  it("AI countries keep their slots busy", () => {
    const sim = fresh();
    for (let i = 0; i < 30; i++) sim.step();
    expect(sim.state.countries.CHN!.research!.slots.some(Boolean)).toBe(true);
  });
});
