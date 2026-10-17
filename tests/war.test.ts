import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { divisionStats } from "../src/sim/military/war.ts";
import { allocate } from "../src/sim/military/fronts.ts";
import { runEffects } from "../src/sim/scripting/engine.ts";
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

  it("battle plans: an army holds its front, then executes an offensive line and a spearhead", () => {
    const sim = fresh("DEU");
    const s = sim.state;
    s.countries.DEU!.warSupport = 1;
    s.countries.POL!.warSupport = 1;
    sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" });
    const ids = s.divisions.filter((d) => d.owner === "DEU").map((d) => d.id);
    expect(sim.dispatch({ type: "create_army", tag: "DEU", divisions: ids }).ok).toBe(true);
    const army = s.armies.find((a) => a.owner === "DEU")!;
    expect(army.commander).toBeNull();
    sim.dispatch({ type: "set_front", tag: "DEU", army: army.id, enemy: "POL" });
    for (let i = 0; i < 40; i++) sim.step();
    // the front is the German column next to Poland; the army spreads over all of it and holds
    const front = [4, 10, 16, 22];
    expect(army.stretch?.sort((a, b) => a - b)).toEqual(front);
    const at = new Set(s.divisions.filter((d) => army.divisions.includes(d.id)).map((d) => d.province));
    for (const p of front) expect(at.has(p)).toBe(true);
    expect(army.status).toBe("holding");
    expect(s.provinceController.some((c, k) => c === "DEU" && s.provinceOwner[k] === "POL")).toBe(false);
    // the offensive line is the far edge of Poland; a spearhead runs along the top row
    sim.dispatch({ type: "set_offensive", tag: "DEU", army: army.id, provinces: [6, 12, 18, 24] });
    sim.dispatch({ type: "add_spearhead", tag: "DEU", army: army.id, path: [5, 6] });
    sim.dispatch({ type: "execute_plan", tag: "DEU", army: army.id, on: true });
    let advanced = false;
    for (let i = 0; i < 400 && !s.pendingPeace && s.wars.length; i++) {
      sim.step();
      advanced ||= army.status === "advancing";
    }
    expect(advanced).toBe(true);
    expect(s.provinceController.filter((c, k) => c === "DEU" && s.provinceOwner[k] === "POL").length).toBeGreaterThan(4);
    // stopping holds the line
    sim.dispatch({ type: "execute_plan", tag: "DEU", army: army.id, on: false });
    expect(army.executing).toBe(false);
  }, 120_000);

  it("a front can be set before a war: the army lines up on the border, then attacks once at war", () => {
    const sim = fresh("DEU");
    const s = sim.state;
    const ids = s.divisions.filter((d) => d.owner === "DEU").map((d) => d.id);
    sim.dispatch({ type: "create_army", tag: "DEU", divisions: ids });
    const army = s.armies.find((a) => a.owner === "DEU")!;
    expect(sim.dispatch({ type: "set_front", tag: "DEU", army: army.id, enemy: "POL" }).ok).toBe(true);
    for (let i = 0; i < 40; i++) sim.step();
    expect(army.stretch?.sort((a, b) => a - b)).toEqual([4, 10, 16, 22]);
    expect(army.status).toBe("holding");
    // an offensive line and execution do nothing in peace
    sim.dispatch({ type: "set_offensive", tag: "DEU", army: army.id, provinces: [6, 12, 18, 24] });
    sim.dispatch({ type: "execute_plan", tag: "DEU", army: army.id, on: true });
    for (let i = 0; i < 20; i++) sim.step();
    expect(s.provinceController.some((c, k) => c === "DEU" && s.provinceOwner[k] === "POL")).toBe(false);
    s.countries.DEU!.warSupport = 1;
    s.countries.POL!.warSupport = 1;
    sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" });
    for (let i = 0; i < 200 && !s.pendingPeace && s.wars.length; i++) sim.step();
    expect(s.provinceController.some((c, k) => c === "DEU" && s.provinceOwner[k] === "POL")).toBe(true);
  }, 120_000);

  it("front distribution: weighted when short, one each then by weight up to supply, overflow to reserves", () => {
    const w = (p: number) => ({ 1: 1, 2: 5, 3: 2, 4: 1 })[p] ?? 1;
    // fewer divisions than provinces: the heaviest first
    expect(allocate(2, [1, 2, 3, 4], w, () => 9, []).slots.sort()).toEqual([2, 3]);
    // more: one each, the rest by weight
    const many = allocate(8, [1, 2, 3, 4], w, () => 9, []).slots;
    for (const p of [1, 2, 3, 4]) expect(many).toContain(p);
    const n = (p: number) => many.filter((x) => x === p).length;
    expect(n(2)).toBeGreaterThan(n(1));
    // supply caps: what does not fit stands in reserve
    const capped = allocate(12, [1, 2], w, () => 3, [7, 8]);
    expect(capped.slots.filter((x) => x === 1 || x === 2)).toHaveLength(6);
    expect(capped.reserve).toBe(6);
    expect(capped.slots.filter((x) => x === 7).length).toBe(3);
  });

  it("cannot declare war twice", () => {
    const sim = fresh(null);
    sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" });
    expect(sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" }).ok).toBe(false);
  });
});

describe("scripted wars", () => {
  it("events can start and end wars and move provinces", () => {
    const sim = fresh(null);
    const ctx = sim.context;
    runEffects(ctx, { tag: "DEU", root: "DEU", from: null }, [{ declare_war: { target: "POL" } }], "test");
    expect(sim.state.wars).toHaveLength(1);
    // historical wars carry no aggression penalty
    expect(sim.state.diplomacy.aggressors.DEU).toBeUndefined();
    runEffects(ctx, { tag: "DEU", root: "DEU", from: null }, [{ white_peace: { with: "POL" } }], "test");
    expect(sim.state.wars).toHaveLength(0);
    runEffects(ctx, { tag: "DEU", root: "DEU", from: null }, [{ transfer_provinces: { from: "POL", adm1: ["X-5", "X-11"] } }], "test");
    expect(sim.state.provinceOwner[5]).toBe("DEU");
    expect(sim.state.provinceOwner[11]).toBe("DEU");
    expect(sim.state.provinceOwner[4]).toBe("POL");
  });
});
