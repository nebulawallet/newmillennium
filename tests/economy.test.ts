import { describe, expect, it } from "vitest";
import { compileContent, type ContentDB } from "../src/content/compile.ts";
import { dayOf } from "../src/sim/date.ts";
import { factories } from "../src/sim/economy/economy.ts";
import { modelShares } from "../src/sim/politics/voteModel.ts";
import { Simulation } from "../src/sim/simulation.ts";
import { createInitialState } from "../src/sim/state.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

const { db } = compileContent(new NodeFiles(), { only: new Set(["USA", "DEU"]) });
const sim = (d: ContentDB, mode: "historical" | "dynamic" = "historical", seed = 7) =>
  new Simulation(d, createInitialState(d, { provinces: [] }, { contentHash: "t", seed, rules: { electionMode: mode } }));

describe("2000 starting figures", () => {
  it("come from the World Bank and say which are estimates", () => {
    const usa = sim(db).state.countries.USA!.economy!;
    const wb = db.worldBank.countries.USA!;
    expect(usa.gdp).toBeCloseTo((wb.gdp_usd as number) / 1e9, 3);
    expect(usa.growth).toBeCloseTo(wb.gdp_growth_pct as number, 3);
    expect(usa.inflation).toBeCloseTo(wb.inflation_pct as number, 3);
    expect(usa.unemployment).toBeCloseTo(wb.unemployment_pct as number, 3);
    expect(usa.estimated).not.toContain("gdp");
    // Germany has no central government debt figure for 2000-2005 in the World Bank series
    expect(sim(db).state.countries.DEU!.economy!.estimated).toContain("debt");
    expect(db.worldBank.source[0]?.url).toContain("worldbank.org");
  });

  it("stays within plausible bounds for ten years", () => {
    const s = sim(db);
    while (s.state.day < dayOf("2010-01-01")) s.step();
    for (const t of ["USA", "DEU"]) {
      const e = s.state.countries[t]!.economy!;
      expect(e.growth).toBeGreaterThan(-6);
      expect(e.growth).toBeLessThan(8);
      expect(e.debt).toBeGreaterThan(5);
      expect(e.debt).toBeLessThan(150);
      expect(e.inflation).toBeLessThan(15);
    }
  }, 60_000);
});

describe("construction and budget", () => {
  it("builds a civilian factory from the queue", () => {
    const s = sim(db);
    const usa = s.state.countries.USA!;
    const before = factories(db, usa.economy!).civ;
    expect(s.dispatch({ type: "queue_building", tag: "USA", building: "civilian_factory" }).ok).toBe(true);
    for (let i = 0; i < 200 && usa.economy!.construction.length; i++) s.step();
    expect(usa.economy!.builtCiv).toBeGreaterThanOrEqual(1);
    expect(factories(db, usa.economy!).civ).toBeGreaterThanOrEqual(before + 1);
  });

  it("budget targets move the budget", () => {
    const s = sim(db);
    s.state.player = "USA";
    const e = s.state.countries.USA!.economy!;
    const spend0 = e.spending;
    s.dispatch({ type: "set_budget", tag: "USA", spending: spend0 + 5 });
    for (let i = 0; i < 400; i++) s.step();
    expect(e.spending).toBeGreaterThan(spend0 + 3);
  });
});

describe("historical shocks", () => {
  it("the 2008 crisis propagates into an election swing against the governing party", () => {
    // the same game with and without the crisis event
    const without: ContentDB = { ...db, events: new Map([...db.events].filter(([id]) => id !== "financial_crisis_2008")) };
    const a = sim(db, "dynamic"), b = sim(without, "dynamic");
    const until = dayOf("2008-11-01");
    while (a.state.day < until) a.step();
    while (b.state.day < until) b.step();
    const ua = a.state.countries.USA!, ub = b.state.countries.USA!;
    expect(ua.economy!.shocks.length).toBeGreaterThan(0);
    expect(ua.economicMood).toBeLessThan(ub.economicMood);
    // compare the governing party's poll share under each economy, all else equal
    const party = ub.rulingParties[0]!;
    const shareWith = modelShares(db, { ...ub, economicMood: ua.economicMood }, until)[party]!;
    const shareWithout = modelShares(db, ub, until)[party]!;
    expect(shareWith).toBeLessThan(shareWithout - 0.005);
  }, 120_000);
});
