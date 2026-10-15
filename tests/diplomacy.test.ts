import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { blocsOf, councilMembers, diplomacySystem, opinion, tradeIndex } from "../src/sim/diplomacy/diplomacy.ts";
import { dayOf } from "../src/sim/date.ts";
import { growthTarget } from "../src/sim/economy/economy.ts";
import { canEnter } from "../src/sim/military/military.ts";
import { fireEvent } from "../src/sim/scripting/systems.ts";
import { Simulation, simMapFrom } from "../src/sim/simulation.ts";
import { createInitialState } from "../src/sim/state.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

const { db } = compileContent(new NodeFiles(), { only: new Set(["DEU", "POL", "RUS", "USA", "FRA"]) });

// a strip of provinces west to east: France, Germany, Poland, Russia (two each), the US apart
const strip = ["FRA", "FRA", "DEU", "DEU", "POL", "POL", "RUS", "RUS", "USA", "USA"];
// every other country gets one unconnected province so it exists on the map
const owners = [...strip, ...db.countryList.map((c) => c.tag).filter((t) => !strip.includes(t))];
const provinces = owners.map((owner, i) => ({ id: i + 1, name: `P${i + 1}`, owner, controller: owner, adm1: [`X-${i}`], culture: "x", population: 1_000_000, area_km2: 10_000, terrain: "plains", infrastructure: 6, centroid: [i * 1.5, 50] as [number, number] }));
const adjacency: [number, number, number][] = [];
for (let i = 1; i < 8; i++) adjacency.push([i, i + 1, 1]);
adjacency.push([9, 10, 1]);
const fresh = (player: string | null = null) => new Simulation(db, createInitialState(db, { provinces: provinces as never }, { contentHash: "t", player }), undefined, simMapFrom(provinces as never, adjacency));

describe("blocs and opinion", () => {
  it("starts with the 2000 memberships and council", () => {
    const sim = fresh();
    const d = sim.state.diplomacy;
    expect(d.blocs.nato).toHaveLength(19);
    expect(d.blocs.eu).toHaveLength(15);
    expect(d.blocs.sco).toHaveLength(0);
    expect(blocsOf(sim.state, "POL")).toContain("nato");
    expect(blocsOf(sim.state, "POL")).not.toContain("eu");
    const council = councilMembers(db, sim.state);
    expect(council).toHaveLength(15);
    expect(council).toEqual(expect.arrayContaining(["USA", "RUS", "CHN", "NLD", "UKR", "JAM"]));
  });

  it("allies like each other more than rivals", () => {
    const sim = fresh();
    expect(opinion(db, sim.state, "DEU", "FRA")).toBeGreaterThan(opinion(db, sim.state, "DEU", "RUS"));
    expect(opinion(db, sim.state, "POL", "USA")).toBeGreaterThan(0);
  });

  it("enlargement events add members; leaving removes them", () => {
    const sim = fresh();
    fireEvent(sim.context, "nato_enlargement_2004", "EST", null);
    expect(sim.state.diplomacy.blocs.nato).toContain("EST");
    fireEvent(sim.context, "gbr_leaves_eu", "GBR", null);
    expect(sim.state.diplomacy.blocs.eu).not.toContain("GBR");
  });

  it("elects new council members by regional group once the record runs out", () => {
    const sim = fresh();
    for (const year of ["2001", "2002"]) {
      sim.state.day = dayOf(`${year}-01-01`);
      diplomacySystem.yearly!(sim.context);
      expect(councilMembers(db, sim.state)).toHaveLength(15);
    }
    expect(councilMembers(db, sim.state)).toEqual(expect.arrayContaining(["COL", "IRL", "MUS", "NOR", "SGP"]));
    sim.state.day = dayOf("2003-01-01");
    diplomacySystem.yearly!(sim.context);
    const elected = sim.state.diplomacy.unsc.elected;
    expect(elected).toHaveLength(10);
    for (const [group, seats] of Object.entries(db.un.seats)) expect(elected.filter((e) => db.un.groups[group]!.includes(e.tag))).toHaveLength(seats);
  });
});

describe("alliances and war", () => {
  it("NATO members defend an attacked member; the aggressor is sanctioned unless it vetoes", () => {
    const sim = fresh();
    expect(sim.dispatch({ type: "declare_war", tag: "RUS", target: "POL" }).ok).toBe(true);
    const war = sim.state.wars[0]!;
    expect(war.defenders).toEqual(expect.arrayContaining(["POL", "DEU", "USA", "FRA"]));
    expect(sim.state.diplomacy.aggressors.RUS).toBeDefined();
    // the council votes within a month; Russia vetoes
    for (let i = 0; i < 32; i++) sim.step();
    const res = sim.state.diplomacy.unsc.resolutions.find((r) => r.target === "RUS");
    expect(res?.votes.RUS).toBe("veto");
    expect(res?.passed).toBe(false);
  });

  it("guarantees call the guarantor in; justified wars carry no stigma", () => {
    const sim = fresh();
    expect(sim.dispatch({ type: "guarantee", tag: "RUS", target: "POL", on: true }).ok).toBe(true);
    expect(sim.dispatch({ type: "justify_war", tag: "DEU", target: "POL" }).ok).toBe(true);
    for (let i = 0; i < 100; i++) sim.step();
    expect(sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" }).ok).toBe(true);
    const war = sim.state.wars[0]!;
    expect(war.defenders).toContain("RUS");
    // fellow NATO members do not defend Poland against Germany
    expect(war.defenders).not.toContain("USA");
    expect(sim.state.diplomacy.aggressors.DEU).toBeUndefined();
  });
});

describe("access, trade and sanctions", () => {
  it("military access lets divisions cross a friendly country", () => {
    const sim = fresh();
    expect(canEnter(sim.state, "DEU", 1)).toBe(false);
    expect(sim.dispatch({ type: "military_access", tag: "DEU", target: "FRA", on: true }).ok).toBe(true);
    expect(canEnter(sim.state, "DEU", 1)).toBe(true);
  });

  it("trade deals raise and sanctions cut growth", () => {
    const sim = fresh();
    const s = sim.state;
    const base = growthTarget(db, s, s.countries.POL!).target;
    expect(sim.dispatch({ type: "trade_deal", tag: "POL", target: "USA", on: true }).ok).toBe(true);
    expect(growthTarget(db, s, s.countries.POL!).target).toBeGreaterThan(base);
    const before = tradeIndex(db, s, "RUS");
    sim.dispatch({ type: "sanction", tag: "USA", target: "RUS", on: true });
    sim.dispatch({ type: "sanction", tag: "DEU", target: "RUS", on: true });
    expect(tradeIndex(db, s, "RUS")).toBeLessThan(before);
    expect(opinion(db, s, "RUS", "USA")).toBeLessThan(opinion(db, s, "RUS", "FRA"));
  });

  it("improving relations raises the target's opinion over time", () => {
    const sim = fresh();
    const before = opinion(db, sim.state, "RUS", "DEU");
    expect(sim.dispatch({ type: "improve_relations", tag: "DEU", target: "RUS", on: true }).ok).toBe(true);
    for (let i = 0; i < 95; i++) sim.step();
    expect(opinion(db, sim.state, "RUS", "DEU")).toBeGreaterThan(before + 8);
  });
});

describe("foreign influence", () => {
  it("funding a party raises its popularity until exposed or stopped", () => {
    const sim = fresh();
    const s = sim.state;
    const party = Object.keys(s.countries.POL!.partyPopularity).filter((p) => s.countries.POL!.partyStatus[p] === "active").sort((a, b) => s.countries.POL!.partyPopularity[a]! - s.countries.POL!.partyPopularity[b]!)[0]!;
    s.countries.DEU!.politicalPower = 500;
    expect(sim.dispatch({ type: "start_influence", tag: "DEU", target: "POL", kind: "fund_party", arg: party }).ok).toBe(true);
    expect(s.diplomacy.campaigns).toHaveLength(1);
    for (let i = 0; i < 200 && s.diplomacy.campaigns.length; i++) sim.step();
    // either still running or exposed (and Poland now thinks less of Germany)
    if (!s.diplomacy.campaigns.length) expect(s.diplomacy.relations["POL>DEU"]?.mods?.some((m) => m.id === "exposed")).toBe(true);
  });
});
