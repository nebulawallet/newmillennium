import { describe, expect, it } from "vitest";
import { compileContent, refChecker } from "../src/content/compile.ts";
import { validateEffects, type ScriptIssue } from "../src/content/script/validate.ts";
import { armedGroupLoses, endArmedGroup, spawnArmedGroup } from "../src/sim/conflicts/armedGroups.ts";
import { declareWar, hostile } from "../src/sim/military/war.ts";
import { planMilitary } from "../src/sim/ai/ai.ts";
import { canEnter } from "../src/sim/military/military.ts";
import { runEffects } from "../src/sim/scripting/engine.ts";
import { defaultSystems, Simulation, simMapFrom } from "../src/sim/simulation.ts";
import { createInitialState } from "../src/sim/state.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

const { db } = compileContent(new NodeFiles(), { only: new Set(["DEU", "POL"]) });

// Germany: a 4x4 grid; Poland: a 2x4 strip to the east (same layout as tests/war.test.ts)
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
const fresh = () => new Simulation(db, createInitialState(db, { provinces: provinces as never }, { contentHash: "t", player: null }), defaultSystems().filter((s) => s.id !== "ai"), simMapFrom(provinces as never, adjacency));
const owner = (sim: Simulation, id: number) => sim.state.provinceOwner[id - 1];

describe("armed groups", () => {
  it("are defined in data with tags distinct from countries", () => {
    for (const t of ["ISG", "TAL", "HAM", "DPR", "LPR", "SYO"]) expect(db.armedGroups.has(t)).toBe(true);
    const tags = new Set(db.countryList.map((c) => c.tag));
    for (const t of db.armedGroups.keys()) expect(tags.has(t)).toBe(false);
  });

  it("scripts are checked: unknown groups and countries in regions are errors", () => {
    const out: ScriptIssue[] = [];
    validateEffects([
      { spawn_armed_group: { group: "ISG", regions: [{ from: "DEU", adm1: ["X-0"] }], divisions: 2 } },
      { spawn_armed_group: { group: "XXQ", regions: [{ from: "QQQ" }] } },
      { end_armed_group: { group: "TAL", into: "DEU" } },
    ], "t", out, refChecker(db));
    expect(out.map((i) => i.message)).toEqual(["unknown armed_group 'XXQ'", "unknown tag 'QQQ'"]);
  });

  it("spawn on real regions, field divisions and fight the host in a war that does not fade", () => {
    const sim = fresh();
    const s = sim.state;
    s.divisions.find((d) => d.owner === "DEU")!.province = 1;
    expect(spawnArmedGroup(sim.context, "ISG", [{ from: "DEU", adm1: ["X-0"], provinces: ["P2"] }], 3)).toBe(true);
    expect([owner(sim, 1), owner(sim, 2), owner(sim, 3)]).toEqual(["ISG", "ISG", "DEU"]);
    expect(s.armedGroups.home["1"]).toBe("DEU");
    expect(s.divisions.filter((d) => d.owner === "ISG")).toHaveLength(3);
    expect(s.divisions.some((d) => d.owner === "DEU" && [1, 2].includes(d.province))).toBe(false);
    const war = s.wars.find((w) => w.attackers.includes("ISG"))!;
    expect(war.defenders).toEqual(["DEU"]);
    expect(war.armedGroup).toBe(true);
    expect(hostile(s, "ISG", "DEU")).toBe(true);
    // exhaustion never ends it
    s.countries.ISG!.warSupport = 0;
    s.countries.DEU!.warSupport = 0;
    for (const d of s.divisions) d.path = [];
    for (let i = 0; i < 240; i++) sim.step();
    expect(s.wars.some((w) => w.attackers.includes("ISG"))).toBe(true);
  }, 60_000);

  it("land follows control: captures change hands, lost land goes home", () => {
    const sim = fresh();
    const s = sim.state;
    spawnArmedGroup(sim.context, "ISG", [{ from: "DEU", provinces: ["P1", "P2"] }], 1);
    s.provinceController[1] = "DEU"; // DEU retakes P2
    s.provinceController[2] = "ISG"; // ISG takes P3
    sim.step();
    expect(owner(sim, 2)).toBe("DEU");
    expect(s.armedGroups.home["2"]).toBeUndefined();
    expect(owner(sim, 3)).toBe("ISG");
    expect(s.armedGroups.home["3"]).toBe("DEU");
  });

  it("lose provinces by script and are defeated with no land left", () => {
    const sim = fresh();
    const s = sim.state;
    spawnArmedGroup(sim.context, "ISG", [{ from: "DEU", provinces: ["P1", "P2"] }], 2);
    armedGroupLoses(sim.context, "ISG", [{ from: "DEU", provinces: ["P1"] }]);
    expect(owner(sim, 1)).toBe("DEU");
    expect(s.countries.ISG).toBeDefined();
    armedGroupLoses(sim.context, "ISG", [{ from: "DEU" }]);
    expect(owner(sim, 2)).toBe("DEU");
    expect(s.countries.ISG).toBeUndefined();
    expect(s.dynamicCountries.ISG).toBeUndefined();
    expect(s.divisions.some((d) => d.owner === "ISG")).toBe(false);
    expect(s.wars.some((w) => w.attackers.includes("ISG"))).toBe(false);
  });

  it("can take over their host: land and divisions pass to it, the old army disbands", () => {
    const sim = fresh();
    const s = sim.state;
    spawnArmedGroup(sim.context, "TAL", [{ from: "DEU", provinces: ["P1", "P2", "P7"] }], 4);
    const talIds = s.divisions.filter((d) => d.owner === "TAL").map((d) => d.id);
    endArmedGroup(sim.context, "TAL", "DEU", "DEU");
    expect([1, 2, 7].map((id) => owner(sim, id))).toEqual(["DEU", "DEU", "DEU"]);
    expect(s.divisions.filter((d) => d.owner === "DEU").map((d) => d.id).sort()).toEqual(talIds.sort());
    expect(s.wars).toHaveLength(0);
    expect(Object.keys(s.armedGroups.home)).toHaveLength(0);
  });

  it("hold their land against the AI in historical mode until a script moves the front", () => {
    const sim = new Simulation(db, createInitialState(db, { provinces: provinces as never }, { contentHash: "t", player: null }), defaultSystems(), simMapFrom(provinces as never, adjacency));
    spawnArmedGroup(sim.context, "ISG", [{ from: "DEU", provinces: ["P1", "P2"] }], 1);
    for (let i = 0; i < 120; i++) sim.step();
    expect([owner(sim, 1), owner(sim, 2)]).toEqual(["ISG", "ISG"]);
  }, 60_000);

  it("a limited war with a group does not stop the AI fighting its other wars", () => {
    const sim = fresh();
    const s = sim.state;
    spawnArmedGroup(sim.context, "TAL", [{ from: "DEU", provinces: ["P13"] }], 1, []);
    declareWar(sim.context, "DEU", "TAL", "limited", false, true);
    declareWar(sim.context, "DEU", "POL", "status_quo", false, true);
    for (const d of s.divisions) if (d.owner === "POL") d.province = 24;
    const orders = planMilitary(sim.context, "DEU");
    // an army on the Polish front, with an offensive into Poland under way
    expect(orders.some((o) => o.type === "create_army" && o.front === "POL" && o.execute && (o.offensive ?? []).some((p) => s.provinceOwner[p - 1] === "POL"))).toBe(true);
  });

  it("can hold land without a war, and a group province can be annexed by a third country", () => {
    const sim = fresh();
    const s = sim.state;
    spawnArmedGroup(sim.context, "DPR", [{ from: "DEU", provinces: ["P4"] }], 1, []);
    expect(s.wars).toHaveLength(0);
    expect(owner(sim, 4)).toBe("DPR");
    endArmedGroup(sim.context, "DPR", "POL");
    expect(owner(sim, 4)).toBe("POL");
    expect(s.divisions.some((d) => d.owner === "POL" && d.province === 4)).toBe(true);
  });
});

describe("historical war tools", () => {
  it("a limited war with a named zone keeps the attacker inside it", () => {
    const sim = fresh();
    declareWar(sim.context, "DEU", "POL", "limited", false, true, [5]);
    expect(canEnter(sim.state, "DEU", 5)).toBe(true);
    expect(canEnter(sim.state, "DEU", 6)).toBe(false);
    expect(canEnter(sim.state, "POL", 4)).toBe(true); // the defender is not limited
  });

  it("deploy, occupy and recall divisions by script", () => {
    const sim = fresh();
    const s = sim.state;
    runEffects(sim.context, { tag: "DEU", root: "DEU", from: null }, [{ deploy_divisions: { count: 2, in: "POL" } }], "test");
    expect(s.divisions.filter((d) => d.owner === "DEU" && s.provinceOwner[d.province - 1] === "POL")).toHaveLength(2);
    expect(canEnter(s, "DEU", 5)).toBe(true); // the host grants access
    runEffects(sim.context, { tag: "DEU", root: "DEU", from: null }, [{ recall_divisions: { from: "POL" } }], "test");
    expect(s.divisions.some((d) => d.owner === "DEU" && s.provinceOwner[d.province - 1] === "POL")).toBe(false);
    declareWar(sim.context, "DEU", "POL", "status_quo", false, true);
    runEffects(sim.context, { tag: "DEU", root: "DEU", from: null }, [{ occupy_provinces: { regions: [{ from: "POL", provinces: ["P5", "P6"] }] } }], "test");
    expect([s.provinceController[4], s.provinceController[5]]).toEqual(["DEU", "DEU"]);
    expect(s.divisions.some((d) => d.owner === "POL" && [5, 6].includes(d.province))).toBe(false);
  });
});
