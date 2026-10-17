import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { dayOf } from "../src/sim/date.ts";
import { researchSlots, researchSpeed, researchSystem, techCost, techStatus } from "../src/sim/research/research.ts";
import { Simulation } from "../src/sim/simulation.ts";
import { ymdOf } from "../src/sim/date.ts";
import { createInitialState } from "../src/sim/state.ts";
import { countryModifiers } from "../src/sim/politics/common.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

const { db, issues } = compileContent(new NodeFiles(), { only: new Set(["USA", "CHN", "SOM", "CZE"]) });
const fresh = (player: string | null = null) => new Simulation(db, createInitialState(db, { provinces: [] }, { contentHash: "t", player }));

describe("technology data", () => {
  it("validates: unique ids, known prerequisites and modifiers", () => {
    expect(issues.filter((i) => i.file.startsWith("techs/") && i.severity === "error")).toEqual([]);
    expect(db.techCategories.size).toBe(9);
    expect(db.techs.size).toBeGreaterThanOrEqual(250);
    expect(db.techs.size).toBeLessThanOrEqual(350);
  });

  it("every category has technologies in every year from 2000 to 2030", () => {
    for (const c of db.techCategories.values()) {
      const years = new Set(c.techs.map((id) => db.techs.get(id)!.year));
      for (let y = 2000; y <= 2030; y++) expect(years.has(y), `${c.id} ${y}`).toBe(true);
    }
  });

  it("is a real tree: prerequisites come earlier, mutual exclusion is symmetric, equipment unlocks exist", () => {
    let withPre = 0, exclusive = 0;
    for (const t of db.techs.values()) {
      if (t.prerequisites.length) withPre++;
      for (const g of t.prerequisites) for (const p of g) expect(db.techs.get(p)!.year).toBeLessThanOrEqual(t.year);
      for (const m of t.mutually_exclusive) { exclusive++; expect(db.techs.get(m)!.mutually_exclusive).toContain(t.id); }
    }
    expect(withPre).toBeGreaterThan(db.techs.size * 0.9);
    expect(exclusive).toBeGreaterThanOrEqual(20);
    for (const e of db.equipment.values()) for (const v of e.variants) if (v.requires_tech) expect(db.techs.has(v.requires_tech), v.requires_tech).toBe(true);
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
  it("researching ahead of time costs more, more for each year ahead; catching up costs less", () => {
    const t = db.techs.get("air_sixth_generation")!;
    expect(techCost(db, t, dayOf("2000-01-01")).cost).toBeGreaterThan(t.cost * 5);
    const old = db.techs.get("ind_nuclear_power")!;
    expect(techCost(db, old, dayOf("2000-01-01")).cost).toBeLessThan(old.cost);
    // the penalty for each extra year ahead is larger than for the year before
    const t2010 = db.techs.get("air_stealth_fighters")!;
    const f = [2010, 2009, 2008, 2007, 2006].map((y) => techCost(db, t2010, dayOf(`${y}-01-01`)).factor);
    expect(f[0]).toBeCloseTo(1, 5);
    for (let i = 2; i < f.length; i++) expect(f[i]! - f[i - 1]!).toBeGreaterThan(f[i - 1]! - f[i - 2]!);
    // the cost follows the game date: the same technology is cheaper five years after its year
    expect(techCost(db, t2010, dayOf("2015-01-01")).cost).toBeLessThan(t2010.cost);
  });

  it("mutually exclusive technologies close each other", () => {
    const sim = fresh("USA");
    const usa = sim.state.countries.USA!;
    const a = db.techs.get("doc_professional_army")!, b = db.techs.get("doc_mass_conscription")!;
    for (const p of [...a.prerequisites, ...b.prerequisites].flat()) if (!usa.research!.completed.includes(p)) usa.research!.completed.push(p);
    expect(techStatus(usa, b)).toBe("available");
    expect(sim.dispatch({ type: "set_research", tag: "USA", slot: 0, tech: a.id }).ok).toBe(true);
    expect(techStatus(usa, b)).toBe("excluded");
    expect(sim.dispatch({ type: "set_research", tag: "USA", slot: 1, tech: b.id }).ok).toBe(false);
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

describe("pacing", () => {
  it("an average country with average R&D finishes about each year's technologies every year (2000-2025)", () => {
    // the Czech Republic with R&D at the baseline (1% of GDP): three slots, speed 1.0
    const wb = db.worldBank.countries.CZE!;
    const saved = wb.rnd_pct_gdp;
    wb.rnd_pct_gdp = db.researchRules.rnd_baseline;
    try {
      const sim = new Simulation(db, createInitialState(db, { provinces: [] }, { contentHash: "t", player: null }), [researchSystem]);
      const s = sim.state;
      const cs = s.countries.CZE!;
      expect(researchSlots(db, cs.economy!.gdp)).toBe(3);
      // about 1.0: starting technologies and policies add a few per cent
      expect(researchSpeed(db, cs).total).toBeGreaterThan(0.95);
      expect(researchSpeed(db, cs).total).toBeLessThan(1.15);
      const techs = [...db.techs.values()];
      for (let y = 2000; y <= 2025; y++) {
        while (ymdOf(s.day).year <= y) sim.step();
        const done = new Set(cs.research!.completed);
        const due = techs.filter((t) => t.year <= y && !t.mutually_exclusive.some((m) => done.has(m)));
        const share = due.filter((t) => done.has(t.id)).length / due.length;
        const farAhead = techs.filter((t) => t.year > y + 1 && done.has(t.id)).length;
        // after a few years catching up on the start lag: keeps up, without racing far ahead
        if (y >= 2004) expect(share, `share ${y}`).toBeGreaterThan(0.8);
        expect(share, `share ${y}`).toBeLessThanOrEqual(1);
        expect(farAhead, `ahead ${y}`).toBeLessThanOrEqual(4);
      }
    } finally {
      if (saved === undefined) delete wb.rnd_pct_gdp;
      else wb.rnd_pct_gdp = saved;
    }
  }, 120_000);
});
