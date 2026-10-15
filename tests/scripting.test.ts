import { focusTreeFor } from "../src/sim/state.ts";
import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { dayOf } from "../src/sim/date.ts";
import { evalTrigger, runEffects, describeEffects } from "../src/sim/scripting/engine.ts";
import { decisionStatus, focusOf, focusStatus } from "../src/sim/scripting/systems.ts";
import { Simulation, type SimContext } from "../src/sim/simulation.ts";
import { createInitialState, type GameState } from "../src/sim/state.ts";
import { Rng, seedRng } from "../src/sim/rng.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";
import { FixtureFiles, validCountry } from "./fixtures.ts";

const { db, issues } = compileContent(new NodeFiles(), { only: new Set(["USA", "RUS", "DEU"]) });
const ctxOf = (state: GameState): SimContext => ({ db, state, rng: new Rng(seedRng(1)), log() {}, emit() {} });
const scope = (tag: string) => ({ tag, root: tag, from: null });

describe("scripted content", () => {
  it("every event, decision and focus script validates", () => {
    const scriptIssues = issues.filter((i) => /^(events|decisions|focus_trees)/.test(i.file) && i.severity === "error");
    expect(scriptIssues).toEqual([]);
    expect(db.events.size).toBeGreaterThan(0);
    expect(db.decisions.size).toBeGreaterThan(0);
    // one generic tree for every country without its own, plus national trees for major countries
    expect([...db.focusTrees.keys()]).toEqual(expect.arrayContaining(["generic", "usa", "rus", "deu", "gbr", "fra", "chn", "jpn"]));
  });

  it("reports broken scripts in content files", () => {
    const files = new FixtureFiles({
      ...validCountry(),
      "events/test.json": { events: [{ id: "bad", title: "Bad", description: "x", triggered_only: true, options: [{ id: "a", name: "A", effects: [{ add_stabilty: 1 }, { country_event: { id: "missing" } }] }] }] },
    });
    const r = compileContent(files, {});
    const msgs = r.issues.filter((i) => i.file === "events/test.json").map((i) => i.message);
    expect(msgs.some((m) => m.includes("unknown effect 'add_stabilty'"))).toBe(true);
    expect(msgs.some((m) => m.includes("unknown event 'missing'"))).toBe(true);
  });
});

describe("engine", () => {
  it("evaluates triggers and runs effects", () => {
    const state = createInitialState(db, { provinces: [] }, { contentHash: "t", player: "DEU" });
    const ctx = ctxOf(state);
    const deu = state.countries.DEU!;
    expect(evalTrigger(ctx, scope("DEU"), { all: [{ ruling_party: "deu.spd" }, { party_in_government: "deu.greens" }, { not: { has_flag: "x" } }] })).toBe(true);
    expect(evalTrigger(ctx, scope("DEU"), { any: [{ ruling_party: "deu.cdu" }, { stability_above: 0.99 }] })).toBe(false);
    const s0 = deu.stability;
    runEffects(ctx, scope("DEU"), [{ add_stability: 0.05 }, { set_flag: "x" }, { if: { limit: { has_flag: "x" }, then: [{ add_political_power: 10 }] } }, { country: { tag: "USA", effects: [{ add_war_support: 0.1 }] } }], "test");
    expect(deu.stability).toBeCloseTo(Math.min(1, s0 + 0.05));
    expect(deu.politicalPower).toBe(60);
    expect(state.countries.USA!.warSupport).toBeCloseTo(createInitialState(db, { provinces: [] }, { contentHash: "t" }).countries.USA!.warSupport + 0.1);
    expect(describeEffects(db, [{ add_stability: 0.05 }, { add_interest_group_approval: { group: "military", value: 5 } }])).toEqual(["Stability +5%", "Armed forces approval +5"]);
  });

  it("timed modifiers expire", () => {
    const sim = new Simulation(db, createInitialState(db, { provinces: [] }, { contentHash: "t", player: "DEU" }));
    runEffects(ctxOf(sim.state), scope("DEU"), [{ add_timed_modifier: { modifier: "army_org", value: 0.1, days: 10 } }], "test");
    expect(sim.state.countries.DEU!.timedModifiers).toHaveLength(1);
    for (let i = 0; i < 11; i++) sim.step();
    expect(sim.state.countries.DEU!.timedModifiers).toHaveLength(0);
  });
});

describe("focus trees", () => {
  it("the Gore and Bush branches diverge on who is President", () => {
    const state = createInitialState(db, { provinces: [] }, { contentHash: "t", player: "USA" });
    const ctx = ctxOf(state);
    const usa = state.countries.USA!;
    expect(usa.focus.tree).toBe("usa");
    usa.focus.completed.push("usa_new_administration");
    const status = (id: string) => focusStatus(ctx, usa, focusOf(db, usa, id)!);
    usa.offices["usa.president"] = ["usa.george_w_bush"];
    expect(status("usa_bush_tax_cuts")).toBe("available");
    expect(status("usa_gore_surplus")).toBe("unavailable");
    usa.offices["usa.president"] = ["usa.al_gore"];
    expect(status("usa_bush_tax_cuts")).toBe("unavailable");
    expect(status("usa_gore_surplus")).toBe("available");
    // Germany has its own tree; countries without one use the generic tree
    expect(state.countries.DEU!.focus.tree).toBe("deu");
    expect(focusTreeFor(db, "BEL")).toBe("generic");
  });

  it("an AI United States follows the branch of the President it elected", () => {
    let gore = 0, bush = 0;
    for (let seed = 1; seed <= 40 && !(gore && bush); seed++) {
      const sim = new Simulation(db, createInitialState(db, { provinces: [] }, { contentHash: "t", seed, rules: { electionMode: "dynamic" } }));
      while (sim.state.day < dayOf("2002-06-01")) sim.step();
      const usa = sim.state.countries.USA!;
      const pres = usa.offices["usa.president"]![0];
      const done = usa.focus.completed.concat(usa.focus.current ?? []);
      if (pres === "usa.al_gore") {
        expect(done.some((f) => f.startsWith("usa_bush"))).toBe(false);
        if (done.some((f) => f.startsWith("usa_gore"))) gore++;
      } else if (pres === "usa.george_w_bush") {
        expect(done.some((f) => f.startsWith("usa_gore"))).toBe(false);
        if (done.some((f) => f.startsWith("usa_bush"))) bush++;
      }
    }
    expect(gore).toBeGreaterThan(0);
    expect(bush).toBeGreaterThan(0);
  }, 120_000);
});

describe("events and decisions", () => {
  it("historical events fire on their dates in historical mode", () => {
    const sim = new Simulation(db, createInitialState(db, { provinces: [] }, { contentHash: "t" }));
    while (sim.state.day < dayOf("2001-09-12")) sim.step();
    const usa = sim.state.countries.USA!;
    if (usa.followsHistory) expect("usa_bush_v_gore" in usa.eventsFired).toBe(true);
    expect("usa_september_11" in usa.eventsFired).toBe(true);
    expect("september_11" in sim.state.globalFlags).toBe(true);
  });

  it("the player answers events; decisions cost political power and cool down", () => {
    const sim = new Simulation(db, createInitialState(db, { provinces: [] }, { contentHash: "t", player: "USA" }));
    while (sim.state.day < dayOf("2001-09-12")) sim.step();
    const pe = sim.state.pendingEvents.find((p) => p.event === "usa_september_11");
    expect(pe).toBeDefined();
    const ws = sim.state.countries.USA!.warSupport;
    expect(sim.dispatch({ type: "answer_event", key: pe!.key, option: "national_response" }).ok).toBe(true);
    expect(sim.state.countries.USA!.warSupport).toBeGreaterThan(ws);

    const usa = sim.state.countries.USA!;
    usa.unrest = 0.2;
    usa.politicalPower = 200;
    const d = db.decisions.get("deploy_riot_police")!;
    expect(decisionStatus(ctxOf(sim.state), usa, d).available).toBe(true);
    expect(sim.dispatch({ type: "take_decision", tag: "USA", decision: d.id }).ok).toBe(true);
    expect(usa.politicalPower).toBe(200 - d.cost.political_power);
    expect(usa.unrest).toBeCloseTo(0.1);
    expect(sim.dispatch({ type: "take_decision", tag: "USA", decision: d.id }).ok).toBe(false);
  });
});
