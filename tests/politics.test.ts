import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { parseSaveFile, toSaveFile } from "../src/sim/save.ts";
import { Simulation, simMapFrom } from "../src/sim/simulation.ts";
import { createInitialState, migrateState, STATE_VERSION } from "../src/sim/state.ts";
import { checkLawChange } from "../src/sim/politics/laws.ts";
import { igTarget } from "../src/sim/politics/interestGroups.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

const { db } = compileContent(new NodeFiles(), { only: new Set(["DEU", "GBR", "RUS"]) });

// a small synthetic map: a 6x5 grid of Russian provinces, the right half of another culture
const provinces = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  owner: "RUS",
  controller: "RUS",
  adm1: [`RUS-${i}`],
  culture: i % 6 >= 3 ? "chechen" : db.countries.get("RUS")!.country!.culture_primary,
  population: 1000 + (i % 7) * 500,
  area_km2: 1000,
  centroid: [40 + (i % 6), 50 + Math.floor(i / 6)] as [number, number],
}));
const adjacency: [number, number, number][] = [];
for (let i = 0; i < 30; i++) {
  if (i % 6 < 5) adjacency.push([i + 1, i + 2, 1]);
  if (i + 6 < 30) adjacency.push([i + 1, i + 7, 1]);
}

const fresh = (player = "DEU") => {
  const state = createInitialState(db, { provinces: provinces as never }, { contentHash: "t", player });
  return new Simulation(db, state, undefined, simMapFrom(provinces as never, adjacency));
};

describe("interest groups", () => {
  it("start in equilibrium: targets equal the researched approvals", () => {
    const sim = fresh();
    const deu = sim.state.countries.DEU!;
    for (const [ig, s] of Object.entries(deu.interestGroups)) expect(igTarget(db, deu, ig)).toBeCloseTo(Math.min(100, Math.max(0, s.approval)), 5);
  });
});

describe("laws", () => {
  it("cost political power, need a majority and move interest group targets", () => {
    const sim = fresh();
    const deu = sim.state.countries.DEU!;
    const chk = checkLawChange(db, deu, "conscription", "volunteer_force", sim.state.day);
    expect(chk.cost).toBeGreaterThan(60); // two steps along the list
    expect(chk.vote?.total).toBe(669);
    expect(chk.approvalDelta.military).toBeLessThan(0);
    deu.politicalPower = 500;
    const r = sim.dispatch({ type: "change_law", tag: "DEU", category: "conscription", law: "volunteer_force" });
    expect(r.ok).toBe(chk.vote!.yes * 2 > chk.vote!.total);
    if (r.ok) {
      expect(deu.laws.conscription).toBe("volunteer_force");
      expect(deu.politicalPower).toBe(500 - chk.cost);
      // a second change is blocked by the cooldown
      expect(checkLawChange(db, deu, "conscription", "selective_conscription", sim.state.day).reasons.join()).toMatch(/recently/);
    }
  });

  it("refuses laws the government type forbids", () => {
    const sim = fresh();
    const chk = checkLawChange(db, sim.state.countries.DEU!, "political_freedom", "no_elections", sim.state.day);
    expect(chk.ok).toBe(false);
  });
});

describe("unrest, coups and civil war", () => {
  it("a forced civil war splits the map into one contiguous rebel region", () => {
    const sim = fresh();
    const r = sim.dispatch({ type: "force_civil_war", tag: "RUS", group: "minorities" });
    expect(r.ok).toBe(true);
    const rebel = sim.state.countries.RUS!.civilWar!.rebel;
    const taken = sim.state.provinceOwner.map((o, i) => (o === rebel ? i + 1 : 0)).filter(Boolean);
    expect(taken.length).toBeGreaterThan(3);
    expect(taken.length).toBeLessThan(30);
    // minorities rise where their culture lives
    const minority = taken.filter((id) => provinces[id - 1]!.culture === "chechen").length;
    expect(minority / taken.length).toBeGreaterThan(0.6);
    // contiguous
    const set = new Set(taken);
    const seen = new Set([taken[0]!]);
    const queue = [taken[0]!];
    while (queue.length) {
      const id = queue.pop()!;
      for (const [a, b] of adjacency) {
        const n = a === id ? b : b === id ? a : 0;
        if (n && set.has(n) && !seen.has(n)) { seen.add(n); queue.push(n); }
      }
    }
    expect(seen.size).toBe(taken.length);
    expect(sim.state.dynamicCountries[rebel]?.parent).toBe("RUS");
    // the game state still round-trips through a save
    expect(parseSaveFile(JSON.stringify(toSaveFile(sim.state, "t"))).state).toEqual(sim.state);
  });

  it("a coup installs a military government and ends elections", () => {
    const sim = fresh();
    sim.dispatch({ type: "force_coup", tag: "GBR", group: "military" });
    const gbr = sim.state.countries.GBR!;
    expect(gbr.govType).toBe("military_junta");
    expect(gbr.schedule).toEqual([]);
    expect(gbr.rulingParties).toEqual([]);
    expect(gbr.followsHistory).toBe(false);
  });
});

describe("saves", () => {
  it("migrates a version 1 save", () => {
    const sim = fresh();
    const old = JSON.parse(JSON.stringify(sim.state));
    old.version = 1;
    delete old.elections;
    delete old.mapResults;
    for (const c of Object.values(old.countries) as Record<string, unknown>[]) delete c.schedule;
    const m = migrateState(db, old);
    expect(m.version).toBe(STATE_VERSION);
    expect(m.elections).toEqual([]);
    expect(m.countries.DEU!.schedule.length).toBeGreaterThan(0);
  });
});
