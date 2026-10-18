import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { capitulated, partiesOfGroup, peaceBudget, termCost } from "../src/sim/military/peace.ts";
import { Simulation, simMapFrom, type SimEvent } from "../src/sim/simulation.ts";
import { createInitialState } from "../src/sim/state.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

const { db } = compileContent(new NodeFiles(), { only: new Set(["DEU", "POL"]) });

// Germany: a 4x4 grid; Poland: a 2x4 strip to the east (the same map as tests/war.test.ts)
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
const POL = [5, 6, 11, 12, 17, 18, 23, 24];
const fresh = (player: string | null) => {
  const sim = new Simulation(db, createInitialState(db, { provinces: provinces as never }, { contentHash: "t", player }), undefined, simMapFrom(provinces as never, adjacency));
  sim.state.countries.DEU!.warSupport = 1;
  sim.state.countries.POL!.warSupport = 1;
  return sim;
};
/** Germany holds most of Poland and the war ends at the next monthly check. */
const occupy = (sim: Simulation, n = 7) => {
  for (const p of POL.slice(0, n)) sim.state.provinceController[p - 1] = "DEU";
  sim.state.divisions = sim.state.divisions.filter((d) => d.owner !== "POL" || d.province === POL[POL.length - 1]);
};
const toMonthEnd = (sim: Simulation) => { for (let i = 0; i < 32 && sim.state.wars.length && !sim.state.pendingPeace; i++) sim.step(); };

describe("capitulation and the peace conference", () => {
  it("the winner's player gets a conference; terms cost war score within the budget", () => {
    const sim = fresh("DEU");
    const s = sim.state;
    sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" });
    occupy(sim);
    const war = s.wars[0]!;
    expect(capitulated(sim.context, war, "defenders")).toBe(true);
    toMonthEnd(sim);
    expect(s.pendingPeace?.winner).toBe("attackers");
    const budget = peaceBudget(sim.context, war, "attackers");
    expect(budget).toBeGreaterThanOrEqual(100);
    const annex = termCost(sim.context, war, "attackers", { kind: "annex", target: "POL" });
    const puppet = termCost(sim.context, war, "attackers", { kind: "puppet", target: "POL" });
    expect(puppet).toBeLessThan(annex);
    // too much is refused
    const big = sim.dispatch({ type: "sign_peace", terms: [{ kind: "annex", target: "POL" }, { kind: "ideology", target: "POL", group: "liberal_democratic" }, { kind: "puppet", target: "POL" }] });
    if (annex + puppet + 25 > budget) expect(big.ok).toBe(false);
    // take two provinces and puppet the rest
    const r = sim.dispatch({ type: "sign_peace", terms: [{ kind: "provinces", target: "POL", provinces: [5, 11] }, { kind: "puppet", target: "POL" }] });
    expect(r.ok, r.text).toBe(true);
    expect(s.provinceOwner[4]).toBe("DEU");
    expect(s.provinceOwner[10]).toBe("DEU");
    expect(s.subjects.POL).toBe("DEU");
    // what was not taken goes back; the war is over
    expect(s.provinceController[11]).toBe("POL");
    expect(s.wars).toHaveLength(0);
    expect(s.pendingPeace).toBeNull();
    // a puppet cannot be attacked by its overlord, and follows it into wars
    expect(sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" }).ok).toBe(false);
  }, 60_000);

  it("annexation removes the country; fronts against it go", () => {
    const sim = fresh("DEU");
    const s = sim.state;
    const ids = s.divisions.filter((d) => d.owner === "DEU").map((d) => d.id);
    sim.dispatch({ type: "create_army", tag: "DEU", divisions: ids });
    sim.dispatch({ type: "set_front", tag: "DEU", army: s.armies[0]!.id, enemy: "POL" });
    sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" });
    occupy(sim);
    toMonthEnd(sim);
    const r = sim.dispatch({ type: "sign_peace", terms: [{ kind: "annex", target: "POL" }] });
    expect(r.ok, r.text).toBe(true);
    expect(s.countries.POL!.active).toBe(false);
    for (const p of POL) expect(s.provinceOwner[p - 1]).toBe("DEU");
    expect(s.divisions.some((d) => d.owner === "POL")).toBe(false);
    expect(s.armies[0]!.front).toBeUndefined();
    // nothing of the war is left on the map: no stretch, plan or battle
    expect(s.armies[0]!.stretch ?? []).toEqual([]);
    expect(s.armies[0]!.offensive).toEqual([]);
    expect(s.battles.some((b) => b.attackerTag === "POL" || b.defenderTag === "POL")).toBe(false);
  }, 60_000);

  it("change of ideology installs a party of that ideology", () => {
    const sim = fresh("DEU");
    const s = sim.state;
    sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" });
    occupy(sim);
    toMonthEnd(sim);
    const group = [...db.ideologyGroups.keys()].find((g) => partiesOfGroup(db, s, "POL", g).length && !s.countries.POL!.rulingParties.some((p) => db.subIdeologies.get(db.parties.get(p)!.sub_ideology)?.group === g))!;
    expect(group).toBeDefined();
    const r = sim.dispatch({ type: "sign_peace", terms: [{ kind: "ideology", target: "POL", group }] });
    expect(r.ok, r.text).toBe(true);
    const ruling = s.countries.POL!.rulingParties[0]!;
    expect(db.subIdeologies.get(db.parties.get(ruling)!.sub_ideology)?.group).toBe(group);
  }, 60_000);

  it("when the AI wins against the player it imposes terms and tells the player", () => {
    const sim = fresh("POL");
    const s = sim.state;
    const events: SimEvent[] = [];
    sim.onEvent((e) => events.push(e));
    sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" });
    occupy(sim);
    toMonthEnd(sim);
    expect(s.wars).toHaveLength(0);
    const notice = events.find((e) => e.type === "peace");
    expect(notice).toBeDefined();
    // the AI takes land it held but never all of the player's country
    expect(s.provinceOwner.filter((o) => o === "DEU").length).toBeGreaterThan(16);
    expect(s.provinceOwner.includes("POL")).toBe(true);
  }, 60_000);

  it("a white peace offer is refused by a side that is winning and accepted by one that is losing", () => {
    const sim = fresh("POL");
    const s = sim.state;
    sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" });
    for (const p of POL.slice(0, 4)) s.provinceController[p - 1] = "DEU";
    const refused = sim.dispatch({ type: "offer_peace", tag: "POL", war: s.wars[0]!.id });
    expect(refused.ok).toBe(false);
    expect(refused.text).toMatch(/refuses/);
    // now Poland holds German land and Germany is worn out
    for (const p of POL) s.provinceController[p - 1] = "POL";
    for (const p of [4, 10]) s.provinceController[p - 1] = "POL";
    s.countries.DEU!.warSupport = 0.2;
    const ok = sim.dispatch({ type: "offer_peace", tag: "POL", war: s.wars[0]!.id });
    expect(ok.ok, ok.text).toBe(true);
    expect(s.wars).toHaveLength(0);
    expect(s.provinceController[3]).toBe("DEU");
  });
});
