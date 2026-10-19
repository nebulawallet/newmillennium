import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { canBuild, moneyCost, organicTotals, placement, provinceSlots, queueEstimates, slotUse } from "../src/sim/economy/construction.ts";
import { evalTrigger, runEffects } from "../src/sim/scripting/engine.ts";
import { constructionPerDay, factories } from "../src/sim/economy/economy.ts";
import { Simulation, simMapFrom } from "../src/sim/simulation.ts";
import { createInitialState } from "../src/sim/state.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

const { db, issues } = compileContent(new NodeFiles(), { only: new Set(["DEU", "POL"]) });

// Germany: eight provinces of falling population; Poland: four. One German province is coastal, one mountainous.
const provinces = [
  ...Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `D${i + 1}`, owner: "DEU", controller: "DEU", adm1: [`DE-${i}`], culture: "german", population: 18_000_000 - i * 2_000_000, area_km2: 40_000, terrain: i === 7 ? "mountains" : "plains", infrastructure: 8, coastal: i === 0, centroid: [8 + i * 0.5, 50] as [number, number] })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: i + 9, name: `P${i + 1}`, owner: "POL", controller: "POL", adm1: [`PL-${i}`], culture: "polish", population: 9_000_000, area_km2: 70_000, terrain: "plains", infrastructure: 6, coastal: false, centroid: [18 + i, 52] as [number, number] })),
];
const map = simMapFrom(provinces as never, [[8, 9, 1]]);
const fresh = (player: string | null = "DEU") => new Simulation(db, createInitialState(db, { provinces: provinces as never }, { contentHash: "t", player }), undefined, map);

describe("buildings data", () => {
  it("validates: slot rules, goods and every building's requirements", () => {
    expect(issues.filter((i) => i.file.startsWith("economy/") && i.severity === "error")).toEqual([]);
    for (const id of ["infrastructure", "civilian_factory", "military_factory", "refinery", "air_base", "port"]) expect(db.buildings.has(id), id).toBe(true);
    expect(db.goods.size).toBeGreaterThanOrEqual(3);
  });
});

describe("slots and starting industry", () => {
  it("slots grow with infrastructure and population and shrink in the mountains", () => {
    const s = fresh().state;
    const big = provinceSlots(db, s, provinces[0] as never), small = provinceSlots(db, s, provinces[6] as never), mountain = provinceSlots(db, s, provinces[7] as never);
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThan(mountain);
  });

  it("starting factories come from the 2000 figures and stand on real provinces, the most populous first", () => {
    const s = fresh().state;
    const e = s.countries.DEU!.economy!;
    const totals = organicTotals(db, e);
    expect(totals.civilian_factory).toBe(factories(db, e).civ);
    expect(totals.military_factory).toBe(factories(db, e).mil);
    const pl = placement(db, s, map, "DEU", totals);
    let civ = 0;
    for (const rec of pl.organic.values()) civ += rec.civilian_factory ?? 0;
    expect(civ).toBe(totals.civilian_factory);
    const civIn = (id: number) => pl.organic.get(id)?.civilian_factory ?? 0;
    expect(civIn(1)).toBeGreaterThanOrEqual(civIn(7));
    for (const p of provinces.slice(0, 8)) expect(slotUse(db, s, map, s.countries.DEU!, p as never).used).toBeLessThanOrEqual(provinceSlots(db, s, p as never));
  });
});

describe("construction", () => {
  it("places buildings in provinces under the rules", () => {
    const sim = fresh();
    const s = sim.state;
    const de = s.countries.DEU!;
    expect(canBuild(db, s, map, de, "civilian_factory")).toMatch(/province/i);
    expect(canBuild(db, s, map, de, "civilian_factory", 9)).toMatch(/own/);
    expect(canBuild(db, s, map, de, "port", 2)).toMatch(/coastal/);
    expect(canBuild(db, s, map, de, "port", 1)).toBeNull();
    expect(canBuild(db, s, map, de, "data_centre", 1)).toMatch(/technology/);
    s.provinceController[0] = "POL";
    expect(canBuild(db, s, map, de, "civilian_factory", 1)).toMatch(/occupied/);
    s.provinceController[0] = "DEU";
    // fill a province's free slots, then it is full
    const free = slotUse(db, s, map, de, provinces[6] as never).free;
    for (let i = 0; i < free; i++) expect(sim.dispatch({ type: "queue_building", tag: "DEU", building: "military_factory", province: 7 }).ok).toBe(true);
    expect(sim.dispatch({ type: "queue_building", tag: "DEU", building: "military_factory", province: 7 }).text).toMatch(/slots/);
    // infrastructure has its own levels up to ten
    expect(canBuild(db, s, map, de, "infrastructure", 2)).toBeNull();
    sim.dispatch({ type: "queue_building", tag: "DEU", building: "infrastructure", province: 2 });
    sim.dispatch({ type: "queue_building", tag: "DEU", building: "infrastructure", province: 2 });
    expect(canBuild(db, s, map, de, "infrastructure", 2)).toMatch(/maximum/);
  });

  it("factories work the queue in order, capped per project; the queue reorders and cancels", () => {
    const sim = fresh();
    const s = sim.state;
    const e = s.countries.DEU!.economy!;
    // three projects wherever there is room (the biggest provinces are full of starting industry)
    for (let n = 0; n < 3; ) {
      const p = provinces.slice(0, 8).find((q) => !canBuild(db, s, map, s.countries.DEU!, "civilian_factory", q.id));
      expect(p).toBeDefined();
      expect(sim.dispatch({ type: "queue_building", tag: "DEU", building: "civilian_factory", province: p!.id }).ok).toBe(true);
      n++;
    }
    expect(e.construction).toHaveLength(3);
    sim.step();
    const cap = db.economyRules.max_factories_per_project;
    const free = constructionPerDay(db, s.countries.DEU!).factories;
    expect(e.construction[0]!.factories).toBeCloseTo(Math.min(cap, free), 5);
    if (free > cap) expect(e.construction[1]!.factories).toBeGreaterThan(0);
    // the estimate puts the first project before the last
    const eta = queueEstimates(db, e, free, constructionPerDay(db, s.countries.DEU!).perFactory);
    expect(eta[0]!).toBeLessThanOrEqual(eta[2]!);
    // move the last to the front, then cancel it
    const last = e.construction[2]!;
    expect(sim.dispatch({ type: "move_building", tag: "DEU", index: 2, to: 0 }).ok).toBe(true);
    expect(e.construction[0]).toBe(last);
    expect(sim.dispatch({ type: "cancel_building", tag: "DEU", index: 0 }).ok).toBe(true);
    expect(e.construction).not.toContain(last);
    expect(e.construction).toHaveLength(2);
  });

  it("a finished building stands in its province, adds a factory and was paid for as it was built", () => {
    const sim = fresh();
    const s = sim.state;
    const de = s.countries.DEU!;
    const e = de.economy!;
    const before = factories(db, e).civ;
    const where = provinces.slice(0, 8).find((q) => !canBuild(db, s, map, de, "civilian_factory", q.id))!.id;
    expect(sim.dispatch({ type: "queue_building", tag: "DEU", building: "civilian_factory", province: where }).ok).toBe(true);
    const item = e.construction[0]!;
    let spentEarly = 0;
    for (let i = 0; i < 2000 && e.construction.length; i++) {
      sim.step();
      if (i === 5) spentEarly = item.spent ?? 0;
    }
    expect(e.construction).toHaveLength(0);
    expect(s.provinceBuildings[String(where)]?.civilian_factory).toBe(1);
    // one built, plus any the growing economy added on its own
    expect(e.builtCiv).toBe(1);
    expect(factories(db, e).civ).toBeGreaterThanOrEqual(before + 1);
    // paid over time: a little in the first days, the full cost by the end
    const full = moneyCost(db, db.buildings.get("civilian_factory")!, e);
    expect(spentEarly).toBeGreaterThan(0);
    expect(spentEarly).toBeLessThan(full);
    expect(item.spent!).toBeCloseTo(full, 1);
  }, 60_000);

  it("the AI builds with the same rules, always in a province", () => {
    const sim = fresh(null);
    for (let i = 0; i < 70; i++) sim.step();
    const q = sim.state.countries.DEU!.economy!.construction;
    expect(q.length).toBeGreaterThan(0);
    for (const c of q) expect(c.province).toBeGreaterThan(0);
  });
});

describe("goods market and trade routes", () => {
  it("prices start balanced and trade follows production, demand and access", () => {
    const sim = fresh();
    for (let i = 0; i < 40; i++) sim.step();
    const goods = sim.state.market.goods!;
    for (const g of db.goods.keys()) {
      expect(goods[g]!.price).toBeGreaterThan(0.5);
      expect(goods[g]!.price).toBeLessThan(1.6);
    }
    const t = sim.state.countries.DEU!.economy!.trade!;
    expect(t.production.consumer_goods).toBeGreaterThan(0);
    expect(t.access).toBeGreaterThan(0);
  });

  it("sanctions close a trade route", () => {
    // Poland is the player, so the AI cannot lift its sanction during the test
    const sim = fresh("POL");
    for (let i = 0; i < 40; i++) sim.step();
    const before = sim.state.countries.DEU!.economy!.trade!;
    expect(before.routes.some((r) => r.partner === "POL")).toBe(true);
    sim.state.diplomacy.sanctions.push(["POL", "DEU"]);
    for (let i = 0; i < 31; i++) sim.step();
    const after = sim.state.countries.DEU!.economy!.trade!;
    expect(after.routes.some((r) => r.partner === "POL")).toBe(false);
    expect(after.access).toBeLessThan(before.access);
  });
});

describe("focus effects: buildings and claims", () => {
  it("add_buildings builds at once in the provinces with room, with no cost and no technology", () => {
    const sim = fresh();
    const deu = sim.state.countries.DEU!;
    const civ = deu.economy!.builtCiv;
    runEffects(sim.context, { tag: "DEU", root: "DEU", from: null }, [{ add_buildings: { building: "civilian_factory", count: 2 } }], "test");
    expect(deu.economy!.builtCiv).toBe(civ + 2 * (db.buildings.get("civilian_factory")!.adds.civilian_factories ?? 0));
    expect(Object.values(sim.state.provinceBuildings).reduce((s, b) => s + (b.civilian_factory ?? 0), 0)).toBe(2);
    expect(deu.economy!.construction).toHaveLength(0);
    // a named region
    runEffects(sim.context, { tag: "DEU", root: "DEU", from: null }, [{ add_buildings: { building: "infrastructure", count: 1, regions: [{ from: "DEU", adm1: ["DE-5"] }] } }], "test");
    expect(sim.state.provinceBuildings["6"]?.infrastructure).toBe(1);
  });

  it("add_claim claims another country's provinces", () => {
    const sim = fresh();
    const ctx = sim.context;
    runEffects(ctx, { tag: "DEU", root: "DEU", from: null }, [{ add_claim: { regions: [{ from: "POL", adm1: ["PL-0", "PL-1"] }] } }], "test");
    expect([...sim.state.countries.DEU!.claims].sort((a, b) => a - b)).toEqual([9, 10]);
    expect(evalTrigger(ctx, { tag: "DEU", root: "DEU", from: null }, { has_claim_on: "POL" })).toBe(true);
  });
});

describe("generic war tools", () => {
  it("claim_rival_border claims border provinces of the least liked neighbour, wargoal_on_rival targets it", () => {
    const sim = fresh();
    const ctx = sim.context;
    runEffects(ctx, { tag: "DEU", root: "DEU", from: null }, [{ claim_rival_border: { count: 3 } }, { wargoal_on_rival: true }], "test");
    // only province 9 of Poland borders Germany on this map
    expect(sim.state.countries.DEU!.claims).toEqual([9]);
    expect(sim.state.diplomacy.justifications.some((j) => j.tag === "DEU" && j.target === "POL")).toBe(true);
  });
});
