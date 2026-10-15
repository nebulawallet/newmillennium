/** Dev: a small synthetic war between DEU and POL, printed day by day. */
import { compileContent } from "../../src/content/compile.ts";
import { Simulation, simMapFrom } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";
const { db } = compileContent(new NodeFiles(), { only: new Set(["DEU", "POL"]) });
const provinces = Array.from({ length: 24 }, (_, i) => { const x = i % 6, y = Math.floor(i / 6); const owner = x < 4 ? "DEU" : "POL";
  return { id: i + 1, name: `P${i + 1}`, owner, controller: owner, adm1: [`X-${i}`], culture: "german", population: 1_000_000, area_km2: 10_000, terrain: "plains", infrastructure: 6, centroid: [8 + x * 1.4, 50 + y * 0.9] as [number, number] }; });
const adjacency: [number, number, number][] = [];
for (let i = 0; i < 24; i++) { if (i % 6 < 5) adjacency.push([i + 1, i + 2, 1]); if (i + 6 < 24) adjacency.push([i + 1, i + 7, 1]); }
const sim = new Simulation(db, createInitialState(db, { provinces: provinces as never }, { contentHash: "t", player: "DEU" }), undefined, simMapFrom(provinces as never, adjacency));
const s = sim.state;
s.countries.DEU!.warSupport = 1; s.countries.POL!.warSupport = 1;
console.log(sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" }));
const front = s.divisions.find((x) => x.owner === "POL")?.province ?? 24;
for (const d of s.divisions.filter((x) => x.owner === "DEU")) sim.dispatch({ type: "move_division", tag: "DEU", division: d.id, province: front });
for (let i = 0; i < 400 && !s.pendingPeace && s.wars.length; i++) {
  sim.step();
  if (i % 10 === 0) {
    const targets = s.provinceOwner.map((o, k) => (o === "POL" && s.provinceController[k] !== "DEU" ? k + 1 : 0)).filter(Boolean);
    s.divisions.filter((x) => x.owner === "DEU" && !x.path.length && !x.attacking).forEach((d, k) => { if (targets.length) sim.dispatch({ type: "move_division", tag: "DEU", division: d.id, province: targets[k % targets.length]! }); });
  }
  if (i % 25 === 0) console.log(i, "battles", s.battles.length, "POL divs", s.divisions.filter((d) => d.owner === "POL").length, "DEU divs", s.divisions.filter((d) => d.owner === "DEU").length, "held", s.provinceController.filter((c, k) => c === "DEU" && s.provinceOwner[k] === "POL").length, "wars", s.wars.length, "ws", s.countries.DEU!.warSupport.toFixed(2), s.countries.POL!.warSupport.toFixed(2), "peace", JSON.stringify(s.pendingPeace));
}
console.log(s.log.slice(-5).map((l) => l.text));
