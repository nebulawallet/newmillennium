import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { findPath, templateStats } from "../src/sim/military/military.ts";
import { Simulation, simMapFrom } from "../src/sim/simulation.ts";
import { createInitialState } from "../src/sim/state.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

const { db, issues } = compileContent(new NodeFiles(), { only: new Set(["DEU", "USA"]) });

// a 5x4 grid of German provinces about 100 km apart, with one Polish province on the edge
const provinces = Array.from({ length: 21 }, (_, i) => ({
  id: i + 1,
  name: `P${i + 1}`,
  owner: i === 20 ? "POL" : "DEU",
  controller: i === 20 ? "POL" : "DEU",
  adm1: [`X-${i}`],
  culture: "german",
  population: 1_000_000 + i * 10_000,
  area_km2: 10_000,
  centroid: [8 + (i % 5) * 1.4, 50 + Math.floor(i / 5) * 0.9] as [number, number],
}));
const adjacency: [number, number, number][] = [];
for (let i = 0; i < 20; i++) {
  if (i % 5 < 4) adjacency.push([i + 1, i + 2, 1]);
  if (i + 5 < 20) adjacency.push([i + 1, i + 6, 1]);
}
adjacency.push([20, 21, 1]);

const fresh = () => {
  const state = createInitialState(db, { provinces: provinces as never }, { contentHash: "t", player: "DEU" });
  return new Simulation(db, state, undefined, simMapFrom(provinces as never, adjacency));
};

describe("unit data", () => {
  it("validates", () => {
    expect(issues.filter((i) => i.file.startsWith("units/") && i.severity === "error")).toEqual([]);
    expect(db.equipment.size).toBeGreaterThan(5);
    expect(db.subUnits.size).toBeGreaterThan(5);
  });
});

describe("starting forces", () => {
  it("come from 2000 armed forces personnel, fully equipped and placed in the country", () => {
    const sim = fresh();
    const deu = sim.state.divisions.filter((d) => d.owner === "DEU");
    const personnel = db.worldBank.countries.DEU!.armed_forces_personnel as number;
    expect(deu.length).toBe(Math.round((personnel * db.militaryRules.land_share) / db.militaryRules.personnel_per_division));
    expect(deu.every((d) => d.strength === 1 && sim.state.provinceOwner[d.province - 1] === "DEU")).toBe(true);
    expect(sim.state.countries.DEU!.military!.manpower).toBeGreaterThan(0);
  });
});

describe("build a division and move it", () => {
  it("produces equipment, trains a division and marches it across the country", () => {
    const sim = fresh();
    const deu = sim.state.countries.DEU!;
    const m = deu.military!;
    // produce infantry equipment
    const before = Object.values(m.stockpile).reduce((a, b) => a + b, 0);
    expect(sim.dispatch({ type: "add_production_line", tag: "DEU", equipment: "infantry_equipment", factories: 3 }).ok).toBe(true);
    for (let i = 0; i < 30; i++) sim.step();
    expect(Object.values(m.stockpile).reduce((a, b) => a + b, 0)).toBeGreaterThan(before);

    // design a template and train it
    expect(sim.dispatch({ type: "set_template", tag: "DEU", template: { id: "test_inf", name: "Test infantry", units: { infantry: 4 } } }).ok).toBe(true);
    const count = sim.state.divisions.length;
    expect(sim.dispatch({ type: "train_division", tag: "DEU", template: "test_inf" }).ok).toBe(true);
    const days = templateStats(db, { infantry: 4 }).training;
    for (let i = 0; i <= days; i++) sim.step();
    expect(sim.state.divisions.length).toBe(count + 1);
    const div = sim.state.divisions[sim.state.divisions.length - 1]!;
    expect(div.owner).toBe("DEU");
    expect(div.strength).toBeGreaterThan(0.5);

    // march to the far corner
    const target = div.province === 1 ? 20 : 1;
    const r = sim.dispatch({ type: "move_division", tag: "DEU", division: div.id, province: target });
    expect(r.ok).toBe(true);
    expect(div.path.length).toBeGreaterThan(2);
    for (let i = 0; i < 200 && div.province !== target; i++) sim.step();
    expect(div.province).toBe(target);
    expect(div.path).toEqual([]);
  }, 60_000);

  it("cannot march into a foreign country in peacetime", () => {
    const sim = fresh();
    const d = sim.state.divisions.find((x) => x.owner === "DEU")!;
    expect(sim.dispatch({ type: "move_division", tag: "DEU", division: d.id, province: 21 }).ok).toBe(false);
    expect(findPath(simMapFrom(provinces as never, adjacency), sim.state, "DEU", 1, 20)).not.toBeNull();
  });

  it("templates respect the combat width limit", () => {
    const sim = fresh();
    expect(sim.dispatch({ type: "set_template", tag: "DEU", template: { id: "huge", name: "Huge", units: { infantry: 30 } } }).ok).toBe(false);
  });
});
