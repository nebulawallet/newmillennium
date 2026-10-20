/**
 * The Taliban, the Islamic State and the Islamic Emirate of Afghanistan (docs/ISG_TAL_TREES_PLAN.md):
 * country renames, focus-tree switches, the player following the Taliban, controls_region and the trees themselves.
 */
import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { endArmedGroup, spawnArmedGroup } from "../src/sim/conflicts/armedGroups.ts";
import { evalTrigger, runEffects } from "../src/sim/scripting/engine.ts";
import { focusStatus } from "../src/sim/scripting/systems.ts";
import { countryName, countryShortName } from "../src/sim/politics/unrest.ts";
import { defaultSystems, Simulation, simMapFrom, type SimEvent } from "../src/sim/simulation.ts";
import { createInitialState, focusTreeFor } from "../src/sim/state.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

const { db, issues } = compileContent(new NodeFiles(), { only: new Set(["AFG", "AFN", "TAL", "ISG", "IRQ", "SYR"]) });
const KABUL = "AFG-1762";

// Afghanistan: a 3x2 grid; province 1 is Kabul
const provinces = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1, name: i === 4 ? "Uruzgan" : i === 5 ? "Zabul" : `P${i + 1}`, owner: "AFG", controller: "AFG", adm1: [i === 0 ? KABUL : `AFG-X${i}`], culture: "pashtun", population: 1_000_000,
  area_km2: 10_000, terrain: "hills", infrastructure: 3, centroid: [66 + (i % 3), 34 + Math.floor(i / 3)] as [number, number],
}));
const adjacency: [number, number, number][] = [[1, 2, 1], [2, 3, 1], [4, 5, 1], [5, 6, 1], [1, 4, 1], [2, 5, 1], [3, 6, 1]];
const fresh = (player: string | null = null) => {
  const sim = new Simulation(db, createInitialState(db, { provinces: provinces as never }, { contentHash: "t", player }), defaultSystems().filter((s) => s.id !== "ai"), simMapFrom(provinces as never, adjacency));
  const events: SimEvent[] = [];
  sim.onEvent((e) => events.push(e));
  return { sim, events };
};
const scope = (tag: string) => ({ tag, root: tag, from: null });
const optionEffects = (id: string) => db.events.get(id)!.options[0]!.effects as unknown[];
const tree = (id: string) => db.focusTrees.get(id)!;

describe("Islamic State, Taliban and Islamic Emirate trees", () => {
  it("validate, and have the planned sizes", () => {
    expect(issues.filter((i) => /^(events|decisions|focus_trees|spirits)/.test(i.file) && i.severity === "error")).toEqual([]);
    expect(tree("isg").focuses.length).toBeGreaterThanOrEqual(70);
    expect(tree("isg").focuses.length).toBeLessThanOrEqual(90);
    expect(tree("tal").focuses.length).toBeGreaterThanOrEqual(40);
    expect(tree("tal").focuses.length).toBeLessThanOrEqual(50);
    expect(tree("iea").focuses.length).toBeGreaterThanOrEqual(60);
    expect(tree("iea").focuses.length).toBeLessThanOrEqual(80);
  });

  it("no focus names a real person, and none declares war or moves provinces", () => {
    const people = [...db.people.values()].filter((p) => ["afg", "tal", "isg", "afn"].includes(p.id.split(".")[0]!)).map((p) => p.name.en);
    for (const id of ["isg", "tal", "iea"]) {
      const text = JSON.stringify(tree(id).focuses);
      for (const n of people) expect(text.includes(n), `${id} names ${n}`).toBe(false);
      for (const fx of ["declare_war", "occupy_provinces", "transfer_provinces", "spawn_armed_group"]) expect(text.includes(`"${fx}"`), `${id} uses ${fx}`).toBe(false);
    }
  });

  it("counterfactual focuses are closed to the AI on the historical path", () => {
    const { sim } = fresh();
    spawnArmedGroup(sim.context, "ISG", [{ from: "AFG", provinces: ["Zabul"] }], 1);
    const isg = sim.state.countries.ISG!;
    const status = (id: string) => focusStatus(sim.context, isg, tree("isg").focuses.find((f) => f.id === id)!);
    isg.focus.completed.push("isg_strategy", "isg_proto_state", "isg_forces");
    sim.state.day = Math.max(sim.state.day, 6600); // past 2017
    expect(status("isg_expansion")).toBe("unavailable");
    isg.focus.completed.push("isg_consolidation");
    expect(status("isg_surviving_state")).toBe("unavailable");
    sim.state.player = "ISG";
    expect(status("isg_surviving_state")).toBe("available");
    expect(tree("isg").focuses.find((f) => f.id === "isg_expansion")!.ai_weight).toBe(0);
    expect(tree("tal").focuses.find((f) => f.id === "tal_proclaim_emirate")!.ai_weight).toBe(0);
  });
});

describe("Afghanistan under the Taliban", () => {
  it("starts as the Taliban on the Taliban tree; the Emirate tree is only reached by a switch", () => {
    const { sim } = fresh("AFG");
    expect(countryName(db, sim.state, "AFG")).toBe("Taliban");
    expect(countryShortName(db, sim.state, "AFG")).toBe("Taliban");
    expect(sim.state.countries.AFG!.focus.tree).toBe("tal");
    expect(focusTreeFor(db, "TAL")).toBe("tal");
    expect([...db.countryList].map((c) => focusTreeFor(db, c.tag))).not.toContain("iea");
  });

  it("set_country_name renames and resets; set_focus_tree starts the new tree fresh", () => {
    const { sim } = fresh();
    const ctx = sim.context;
    const afg = sim.state.countries.AFG!;
    runEffects(ctx, scope("AFG"), [{ set_country_name: { name: "Islamic Emirate of Afghanistan", flag: "x-taliban" } }], "t");
    expect(countryName(db, sim.state, "AFG")).toBe("Islamic Emirate of Afghanistan");
    expect(afg.flag).toBe("x-taliban");
    runEffects(ctx, scope("AFG"), [{ set_country_name: {} }], "t");
    expect(countryName(db, sim.state, "AFG")).toBe("Afghanistan");
    expect(afg.flag).toBeUndefined();
    afg.focus = { tree: "tal", current: "tal_fighters", progress: 30, completed: ["tal_movement", "iea_the_emirate"] };
    runEffects(ctx, scope("AFG"), [{ set_focus_tree: { tree: "iea" } }], "t");
    expect(afg.focus).toEqual({ tree: "iea", current: null, progress: 0, completed: ["tal_movement"] });
  });

  it("controls_region holds only when every province of the regions is controlled", () => {
    const { sim } = fresh();
    const ctx = sim.context;
    const kabul = { controls_region: { adm1: [KABUL] } };
    expect(evalTrigger(ctx, scope("AFG"), kabul)).toBe(true);
    spawnArmedGroup(ctx, "TAL", [{ from: "AFG", provinces: ["P2"] }], 1);
    expect(evalTrigger(ctx, scope("TAL"), kabul)).toBe(false);
    sim.state.provinceController[0] = "TAL";
    expect(evalTrigger(ctx, scope("TAL"), kabul)).toBe(true);
    expect(evalTrigger(ctx, scope("AFG"), kabul)).toBe(false);
  });

  it("a player leading a group follows it into the country it merges into", () => {
    const { sim, events } = fresh("TAL");
    spawnArmedGroup(sim.context, "TAL", [{ from: "AFG", provinces: ["P2", "P3"] }], 1);
    sim.state.player = "TAL";
    endArmedGroup(sim.context, "TAL", "AFG", "AFG");
    expect(sim.state.player).toBe("AFG");
    expect(events).toContainEqual({ type: "player_changed", from: "TAL", to: "AFG" });
  });

  it("December 2001: the Taliban and their tree carry on as the insurgency, and Afghanistan takes back its name", () => {
    const { sim } = fresh("AFG");
    const s = sim.state;
    s.countries.AFG!.focus.completed.push("tal_movement");
    s.countries.AFG!.spirits.push("tal_leadership_council");
    runEffects(sim.context, scope("USA"), optionEffects("afg_taliban_rule_ends"), "t");
    expect(s.player).toBe("TAL");
    expect(s.countries.TAL!.focus.tree).toBe("tal");
    expect(s.countries.TAL!.focus.completed).toContain("tal_movement");
    expect(s.countries.TAL!.spirits).toContain("tal_leadership_council");
    expect(s.countries.AFG!.spirits).not.toContain("tal_leadership_council");
    expect(countryName(db, s, "AFG")).toBe("Afghanistan");
    expect(countryName(db, s, "TAL")).toBe("Taliban");
    expect(s.countries.AFG!.focus.tree).toBe("afg");
  });

  it("15 August 2021: Afghanistan becomes the Islamic Emirate on its own tree, the Taliban player with it, once only", () => {
    const { sim } = fresh("TAL");
    const s = sim.state;
    spawnArmedGroup(sim.context, "TAL", [{ from: "AFG", provinces: ["P2", "P3"] }], 1);
    s.player = "TAL";
    runEffects(sim.context, scope("AFG"), optionEffects("afg_fall_of_kabul_2021"), "t");
    expect(s.player).toBe("AFG");
    expect(countryName(db, s, "AFG")).toBe("Islamic Emirate of Afghanistan");
    expect(s.countries.AFG!.focus.tree).toBe("iea");
    expect(s.provinceOwner.every((o) => o === "AFG")).toBe(true);
    expect("iea_formed" in s.globalFlags).toBe(true);
    expect(evalTrigger(sim.context, scope("AFG"), db.events.get("afg_fall_of_kabul_2021")!.trigger)).toBe(false);
  });

  it("a player's Taliban who hold Kabul can proclaim the Emirate early; the AI on the historical path cannot", () => {
    const { sim } = fresh("TAL");
    const s = sim.state;
    spawnArmedGroup(sim.context, "TAL", [{ from: "AFG", provinces: ["P2", "P3"] }], 2);
    s.provinceController[0] = "TAL";
    const proclaim = tree("tal").focuses.find((f) => f.id === "tal_proclaim_emirate")!;
    const tal = s.countries.TAL!;
    tal.focus.completed.push("tal_kabul");
    s.player = null;
    expect(focusStatus(sim.context, tal, proclaim)).toBe("unavailable");
    s.player = "TAL";
    expect(focusStatus(sim.context, tal, proclaim)).toBe("available");
    runEffects(sim.context, scope("TAL"), proclaim.effects as unknown[], "t");
    expect(s.player).toBe("AFG");
    expect(countryName(db, s, "AFG")).toBe("Islamic Emirate of Afghanistan");
    expect(s.countries.AFG!.focus.tree).toBe("iea");
    expect(s.countries.AFG!.rulingParties[0]).toBe("afg.taliban");
    expect(s.countries.TAL!.active).toBe(false);
    expect("iea_formed" in s.globalFlags).toBe(true);
  });

  it("scripted Islamic State losses skip a player-led Islamic State", () => {
    const { sim } = fresh();
    spawnArmedGroup(sim.context, "ISG", [{ from: "AFG", provinces: ["Zabul"] }], 1);
    const t = db.events.get("irq_victory_over_isg")!.trigger;
    expect(evalTrigger(sim.context, scope("IRQ"), t)).toBe(true);
    sim.state.player = "ISG";
    expect(evalTrigger(sim.context, scope("IRQ"), t)).toBe(false);
  });
});
