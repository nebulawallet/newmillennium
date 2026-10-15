import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { divisionStats } from "../src/sim/military/war.ts";
import { defaultSystems, Simulation, simMapFrom } from "../src/sim/simulation.ts";
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
// combat mechanics are tested with scripted orders, so the AI (tests/ai.test.ts) stays out
const fresh = (player: string | null) => new Simulation(db, createInitialState(db, { provinces: provinces as never }, { contentHash: "t", player }), defaultSystems().filter((s) => s.id !== "ai"), simMapFrom(provinces as never, adjacency));

describe("division stats", () => {
  it("armour is hard and hits hard; infantry is soft", () => {
    const sim = fresh(null);
    const armoured = sim.state.divisions.find((d) => d.template === "armoured_division");
    const infantry = sim.state.divisions.find((d) => d.template === "infantry_division")!;
    const inf = divisionStats(db, infantry);
    expect(inf.hardness).toBeLessThan(0.1); // only self-propelled guns carry armour
    expect(inf.soft).toBeGreaterThan(0);
    if (armoured) {
      const arm = divisionStats(db, armoured);
      expect(arm.hardness).toBeGreaterThan(0.3);
      expect(arm.hard).toBeGreaterThan(inf.hard);
      expect(arm.armour).toBeGreaterThan(inf.armour);
    }
  });
});

describe("war", () => {
  it("an AI-free war resolves to a peace deal", () => {
    const sim = fresh(null);
    expect(sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" }).ok).toBe(true);
    expect(sim.state.wars).toHaveLength(1);
    expect(sim.state.worldTension).toBeGreaterThan(0);
    for (let i = 0; i < 365 * 3 && sim.state.wars.length; i++) sim.step();
    expect(sim.state.wars).toHaveLength(0);
    expect(sim.state.log.some((l) => l.kind === "war" && l.text.includes("ends"))).toBe(true);
    // a white peace restores every province to its owner
    expect(sim.state.provinceController).toEqual(sim.state.provinceOwner);
  }, 60_000);

  it("divisions fight, occupy and win a conquest", () => {
    const sim = fresh("DEU");
    const s = sim.state;
    // keep the war going long enough to fight it out
    s.countries.DEU!.warSupport = 1;
    s.countries.POL!.warSupport = 1;
    expect(sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" }).ok).toBe(true);
    const german = s.divisions.filter((d) => d.owner === "DEU");
    const polish = s.divisions.filter((d) => d.owner === "POL");
    expect(german.length).toBeGreaterThan(0);
    // attack the Polish divisions, then push to the eastern edge of Poland
    const front = polish[0]?.province ?? 24;
    for (const d of german) sim.dispatch({ type: "move_division", tag: "DEU", division: d.id, province: front });
    let battled = false, occupied = false;
    for (let i = 0; i < 400 && !s.pendingPeace && s.wars.length; i++) {
      sim.step();
      battled ||= s.battles.length > 0;
      occupied ||= s.provinceController.some((c, k) => c === "DEU" && s.provinceOwner[k] === "POL");
      if (i % 10 === 0) {
        // idle divisions head for Polish provinces not yet taken
        const targets = s.provinceOwner.map((o, k) => (o === "POL" && s.provinceController[k] !== "DEU" ? k + 1 : 0)).filter(Boolean);
        s.divisions.filter((x) => x.owner === "DEU" && !x.path.length && !x.attacking).forEach((d, k) => {
          if (targets.length) sim.dispatch({ type: "move_division", tag: "DEU", division: d.id, province: targets[k % targets.length]! });
        });
      }
    }
    if (polish.length) expect(battled).toBe(true);
    expect(occupied).toBe(true);
    expect(s.pendingPeace?.winner).toBe("attackers");
    expect(sim.dispatch({ type: "choose_peace", annex: true }).ok).toBe(true);
    expect(s.wars).toHaveLength(0);
    expect(s.provinceOwner.filter((o) => o === "DEU").length).toBeGreaterThan(16);
  }, 120_000);

  it("cannot declare war twice", () => {
    const sim = fresh(null);
    sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" });
    expect(sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" }).ok).toBe(false);
  });
});
