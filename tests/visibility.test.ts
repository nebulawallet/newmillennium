import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { distanceKm, divisionVisibility } from "../src/sim/military/visibility.ts";
import type { Division } from "../src/sim/military/military.ts";
import { createInitialState } from "../src/sim/state.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

const { db } = compileContent(new NodeFiles(), { only: new Set(["DEU", "POL"]) });

// Germany: provinces 1-4 around 8-10°E; Poland: 5 at 16°E (about 500 km away) and 6 at 24°E (over 1,000 km away)
const provinces = [
  ...[0, 1, 2, 3].map((i) => ({ id: i + 1, name: `D${i + 1}`, owner: "DEU", controller: "DEU", adm1: [`DE-${i}`], culture: "german", population: 5e6, area_km2: 30_000, terrain: "plains", infrastructure: 8, centroid: [8 + i * 0.6, 51] as [number, number] })),
  { id: 5, name: "P1", owner: "POL", controller: "POL", adm1: ["PL-0"], culture: "polish", population: 5e6, area_km2: 30_000, terrain: "plains", infrastructure: 6, centroid: [16, 52] as [number, number] },
  { id: 6, name: "P2", owner: "POL", controller: "POL", adm1: ["PL-1"], culture: "polish", population: 5e6, area_km2: 30_000, terrain: "plains", infrastructure: 6, centroid: [24, 52] as [number, number] },
];
const map = { provinces };
const div = (owner: string, province: number) => ({ id: province * 10, owner, province }) as unknown as Division;

describe("fog of war", () => {
  it("measures great-circle distances", () => {
    expect(distanceKm([0, 0], [0, 1])).toBeCloseTo(111.2, 0);
  });

  it("shows own, enemy and in-territory divisions, hides neutral ones, and radar reveals them in range", () => {
    const state = createInitialState(db, { provinces: provinces as never }, { contentHash: "t", player: "DEU" });
    // both are NATO members in 2000; make Poland a neutral neighbour for this test
    for (const b of Object.keys(state.diplomacy.blocs)) state.diplomacy.blocs[b] = state.diplomacy.blocs[b]!.filter((t) => t !== "POL");
    const see = () => divisionVisibility(db, state, map, "DEU", { showAllies: true });
    expect(see()(div("DEU", 1))).toBe(true);
    expect(see()(div("POL", 5))).toBe(false);
    // a Polish division inside Germany is visible
    expect(see()(div("POL", 2))).toBe(true);
    // a radar station in the easternmost German province covers P1 (about 500 km) but not P2
    state.provinceBuildings["4"] = { radar: 1 };
    expect(see()(div("POL", 5))).toBe(true);
    expect(see()(div("POL", 6))).toBe(false);
    // at war, every enemy division is visible
    state.wars.push({ id: 1, name: "t", attackers: ["DEU"], defenders: ["POL"], startDay: 0, goal: "conquest" });
    expect(see()(div("POL", 6))).toBe(true);
  });

  it("allied divisions follow the toggle; spectators see everything", () => {
    const state = createInitialState(db, { provinces: provinces as never }, { contentHash: "t", player: "DEU" });
    for (const b of Object.keys(state.diplomacy.blocs)) state.diplomacy.blocs[b] = state.diplomacy.blocs[b]!.filter((t) => t !== "POL");
    state.subjects["POL"] = "DEU";
    expect(divisionVisibility(db, state, map, "DEU", { showAllies: true })(div("POL", 6))).toBe(true);
    expect(divisionVisibility(db, state, map, "DEU", { showAllies: false })(div("POL", 6))).toBe(false);
    expect(divisionVisibility(db, state, map, null, { showAllies: false })(div("POL", 6))).toBe(true);
  });
});
