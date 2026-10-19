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

describe("political paths", () => {
  const fresh = () => createInitialState(db, { provinces: [] }, { contentHash: "t", player: "DEU" });

  it("has_party_of_group sees only real live parties of the group", () => {
    const ctx = ctxOf(fresh());
    expect(evalTrigger(ctx, scope("RUS"), { has_party_of_group: "socialist_communist" })).toBe(true);
    expect(evalTrigger(ctx, scope("RUS"), { has_party_of_group: "fascist" })).toBe(true);
    expect(evalTrigger(ctx, scope("DEU"), { has_party_of_group: "fascist" })).toBe(false);
  });

  it("install_government brings a real party to power with its leader, government type and laws", () => {
    const state = fresh();
    const ctx = ctxOf(state);
    const rus = state.countries.RUS!;
    runEffects(ctx, scope("RUS"), [{ install_government: { ideology: "socialist_communist", government_type: "one_party_state" } }], "test");
    expect(rus.rulingParties).toEqual(["rus.cprf"]);
    expect(rus.govType).toBe("one_party_state");
    expect(rus.offices["rus.president"]).toEqual(["rus.gennady_zyuganov"]);
    expect(rus.followsHistory).toBe(false);
    expect(Object.values(rus.laws)).not.toContain("free_elections");
    expect(evalTrigger(ctx, scope("RUS"), { ruling_ideology_group: "socialist_communist" })).toBe(true);
    // the tooltip names the party and leader it would bring in today
    const before = fresh();
    expect(describeEffects(db, [{ install_government: { ideology: "socialist_communist", government_type: "one_party_state" } }], 0, { state: before, tag: "RUS" })[0]).toContain("Communist Party of the Russian Federation takes power, led by Gennady Zyuganov");
  });

  it("install_government does nothing without a fitting party", () => {
    const state = fresh();
    const deu = state.countries.DEU!;
    const ruling = [...deu.rulingParties];
    runEffects(ctxOf(state), scope("DEU"), [{ install_government: { ideology: "fascist", government_type: "one_party_state" } }], "test");
    expect(deu.rulingParties).toEqual(ruling);
    expect(describeEffects(db, [{ install_government: { ideology: "fascist", government_type: "one_party_state" } }], 0, { state, tag: "DEU" })[0]).toContain("nothing changes");
  });

  it("a government of an incompatible ideology leaves the bloc", () => {
    const state = fresh();
    const nato = db.blocs.get("nato")!;
    const saved = nato.incompatible_groups;
    nato.incompatible_groups = ["nationalist_populist"];
    try {
      runEffects(ctxOf(state), scope("DEU"), [{ install_government: { party: "deu.npd", government_type: "hybrid_authoritarian" } }], "test");
    } finally { nato.incompatible_groups = saved; }
    expect(state.countries.DEU!.rulingParties).toEqual(["deu.npd"]);
    expect(evalTrigger(ctxOf(state), scope("DEU"), { in_bloc: "nato" })).toBe(false);
  });

  it("add_ideology_support spreads a group change over its sub-ideologies", () => {
    const state = fresh();
    const ctx = ctxOf(state);
    const share = (s: GameState) => Object.entries(s.countries.RUS!.ideologySupport).filter(([k]) => db.subIdeologies.get(k)?.group === "socialist_communist").reduce((t, [, v]) => t + v, 0);
    const s0 = share(state);
    runEffects(ctx, scope("RUS"), [{ add_ideology_support: { group: "socialist_communist", value: 0.1 } }], "test");
    expect(share(state)).toBeGreaterThan(s0 + 0.05);
    expect(evalTrigger(ctx, scope("RUS"), { ideology_group_support_above: { group: "socialist_communist", value: s0 + 0.05 } })).toBe(true);
  });

  it("leave_history takes the country off the historical path", () => {
    const state = fresh();
    runEffects(ctxOf(state), scope("RUS"), [{ leave_history: true }], "test");
    expect(state.countries.RUS!.followsHistory).toBe(false);
  });

  it("the validator rejects an install with neither party nor ideology", () => {
    const files = new FixtureFiles({
      ...validCountry(),
      "events/test.json": { events: [{ id: "bad", title: "Bad", description: "x", triggered_only: true, options: [{ id: "a", name: "A", effects: [{ install_government: { government_type: "one_party_state" } }, { add_ideology_support: { group: "nope", value: 0.1 } }] }] }] },
    });
    const msgs = compileContent(files, {}).issues.filter((i) => i.file === "events/test.json").map((i) => i.message);
    expect(msgs.some((m) => m.includes("party or ideology"))).toBe(true);
    expect(msgs.some((m) => m.includes("unknown ideology_group 'nope'"))).toBe(true);
  });
});

describe("Russian political branch", () => {
  it("history takes the power vertical; the player can take a real party's path; a path needs a party that exists", () => {
    const state = createInitialState(db, { provinces: [] }, { contentHash: "t", player: "RUS" });
    const ctx = ctxOf(state);
    const rus = state.countries.RUS!;
    const st = (id: string) => focusStatus(ctx, rus, focusOf(db, rus, id)!);
    rus.focus.completed.push("rus_federal_centre");
    expect(st("rus_power_vertical")).toBe("available");
    rus.stability = 0.3;
    rus.warSupport = 0.6;
    // the LDPR (ultranationalist) exists in 2000; Rodina (national-populist) is founded only in 2003
    expect(st("rus_ultranationalist_turn")).toBe("available");
    expect(st("rus_national_revival")).toBe("unavailable");
    // an AI Russia on the historical path never leaves it
    state.player = "DEU";
    expect(st("rus_ultranationalist_turn")).toBe("unavailable");
  });
});
