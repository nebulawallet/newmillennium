import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { bucketOf, planMilitary, planStrategic } from "../src/sim/ai/ai.ts";
import { Simulation, simMapFrom } from "../src/sim/simulation.ts";
import { createInitialState } from "../src/sim/state.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

const { db } = compileContent(new NodeFiles(), { only: new Set(["DEU", "POL"]) });

// Germany: a 4x4 grid; Poland: a 2x4 strip to the east
const provinces = Array.from({ length: 24 }, (_, i) => {
  const x = i % 6, y = Math.floor(i / 6);
  const owner = x < 4 ? "DEU" : "POL";
  return { id: i + 1, name: `P${i + 1}`, owner, controller: owner, adm1: [`X-${i}`], culture: owner === "DEU" ? "german" : "polish", population: 1_000_000, area_km2: 10_000, terrain: "plains", infrastructure: 6, centroid: [8 + x * 1.4, 50 + y * 0.9] as [number, number] };
});
const adjacency: [number, number, number][] = [];
for (let i = 0; i < 24; i++) {
  if (i % 6 < 5) adjacency.push([i + 1, i + 2, 1]);
  if (i + 6 < 24) adjacency.push([i + 1, i + 7, 1]);
}
const fresh = () => new Simulation(db, createInitialState(db, { provinces: provinces as never }, { contentHash: "t", player: null }), undefined, simMapFrom(provinces as never, adjacency));

describe("buckets", () => {
  it("are stable and in range", () => {
    for (const t of ["DEU", "POL", "USA", "RUS"]) {
      expect(bucketOf(t, 28)).toBe(bucketOf(t, 28));
      expect(bucketOf(t, 28)).toBeGreaterThanOrEqual(0);
      expect(bucketOf(t, 28)).toBeLessThan(28);
    }
  });
});

describe("military AI", () => {
  it("issues move orders against the enemy only in war", () => {
    const sim = fresh();
    expect(planMilitary(sim.context, "DEU")).toHaveLength(0);
    sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" });
    const orders = planMilitary(sim.context, "DEU");
    expect(orders.length).toBeGreaterThan(0);
    for (const o of orders) expect(o.type).toBe("move_division");
  });

  it("fights an AI war to a result without a player", () => {
    const sim = fresh();
    const s = sim.state;
    s.countries.DEU!.warSupport = 1;
    s.countries.POL!.warSupport = 1;
    sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" });
    let battles = 0, occupied = 0;
    for (let i = 0; i < 365 * 2 && s.wars.length; i++) {
      sim.step();
      battles = Math.max(battles, s.battles.length);
      occupied = Math.max(occupied, s.provinceController.filter((c, k) => c === "DEU" && s.provinceOwner[k] === "POL").length);
    }
    expect(occupied).toBeGreaterThan(0);
    expect(s.wars).toHaveLength(0);
    // the stronger German army wins and annexes what it holds
    expect(s.provinceOwner.filter((o) => o === "DEU").length).toBeGreaterThan(16);
  }, 120_000);
});

describe("civil war", () => {
  it("splits the army and is decided by fighting", () => {
    const sim = fresh();
    const s = sim.state;
    const before = s.divisions.filter((d) => d.owner === "POL").length;
    expect(sim.dispatch({ type: "force_civil_war", tag: "POL", group: "military" }).ok).toBe(true);
    const rebel = s.countries.POL!.civilWar!.rebel;
    const rebels = s.divisions.filter((d) => d.owner === rebel).length;
    if (before >= 2) expect(rebels).toBeGreaterThan(0);
    for (let i = 0; i < 365 * 3 && s.countries.POL!.civilWar; i++) sim.step();
    expect(s.countries.POL!.civilWar).toBeNull();
  }, 120_000);
});

describe("strategic AI", () => {
  it("plans diplomacy and upkeep with commands", () => {
    const sim = fresh();
    const cmds = planStrategic(sim.context, sim.state.countries.DEU!);
    for (const c of cmds) expect(typeof c.type).toBe("string");
    // a month of AI leaves Germany improving relations or trading with someone
    for (let i = 0; i < 92; i++) sim.step();
    const d = sim.state.diplomacy;
    expect(d.improving.some(([a]) => a === "DEU") || d.tradeDeals.some(([a, b]) => a === "DEU" || b === "DEU")).toBe(true);
  });
});
