/** Dev: trace an AI-vs-AI war on the 6x4 test grid (Germany west, Poland east). */
import { compileContent } from "../../src/content/compile.ts";
import { Simulation, simMapFrom } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";
const { db } = compileContent(new NodeFiles(), { only: new Set(["DEU", "POL"]) });
const provinces = Array.from({ length: 24 }, (_, i) => {
  const x = i % 6, y = Math.floor(i / 6);
  const owner = x < 4 ? "DEU" : "POL";
  return { id: i + 1, name: `P${i + 1}`, owner, controller: owner, adm1: [`X-${i}`], culture: "x", population: 1_000_000, area_km2: 10_000, terrain: "plains", infrastructure: 6, centroid: [8 + x * 1.4, 50 + y * 0.9] as [number, number] };
});
const adjacency: [number, number, number][] = [];
for (let i = 0; i < 24; i++) { if (i % 6 < 5) adjacency.push([i + 1, i + 2, 1]); if (i + 6 < 24) adjacency.push([i + 1, i + 7, 1]); }
const sim = new Simulation(db, createInitialState(db, { provinces: provinces as never }, { contentHash: "t", player: null }), undefined, simMapFrom(provinces as never, adjacency));
const s = sim.state;
s.countries.DEU!.warSupport = 1; s.countries.POL!.warSupport = 1;
sim.dispatch({ type: "declare_war", tag: "DEU", target: "POL" });
const show = () => {
  const rows: string[] = [];
  for (let y = 0; y < 4; y++) {
    let r = "";
    for (let x = 0; x < 6; x++) {
      const id = y * 6 + x + 1;
      const c = s.provinceController[id - 1] === "DEU" ? "D" : "P";
      const de = s.divisions.filter((d) => d.province === id && d.owner === "DEU").length;
      const po = s.divisions.filter((d) => d.province === id && d.owner === "POL").length;
      r += `${c}${String(de).padStart(2)}/${String(po).padEnd(2)} `;
    }
    rows.push(r);
  }
  console.log(`day ${s.day} battles ${s.battles.length}\n  ${rows.join("\n  ")}`);
};
for (let i = 0; i < 120 && s.wars.length; i++) { if (i % 15 === 0) show(); sim.step(); }
show();
console.log(s.log.filter((l) => l.kind === "war").map((l) => `${l.day} ${l.tag} ${l.text}`).join("\n"));
