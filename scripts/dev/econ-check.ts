/** Dev: debt, growth and inflation of the major countries after N years (npx tsx scripts/dev/econ-check.ts 10). */
import { readFileSync } from "node:fs";
import { compileContent } from "../../src/content/compile.ts";
import { Simulation, simMapFrom } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";
const { db } = compileContent(new NodeFiles(), {});
if (process.env.NO_TREES) for (const k of [...db.focusTrees.keys()]) if (!["generic", "usa", "rus"].includes(k)) db.focusTrees.delete(k);
const provinces = JSON.parse(readFileSync("public/map/provinces.json", "utf8"));
const adjacency = JSON.parse(readFileSync("public/map/adjacency.json", "utf8"));
const sim = new Simulation(db, createInitialState(db, { provinces }, { contentHash: "e", player: null }), undefined, simMapFrom(provinces, adjacency));
const tags = "USA RUS DEU GBR FRA CHN JPN ITA ESP TUR IRN POL ISR".split(" ");
const start = Object.fromEntries(tags.map((t) => [t, { ...sim.state.countries[t]!.economy! }]));
for (let i = 0; i < 365.25 * Number(process.argv[2] ?? 10); i++) sim.step();
for (const t of tags) {
  const e = sim.state.countries[t]!.economy!, s = start[t]!;
  const done = sim.state.countries[t]!.focus.completed.length;
  console.log(`${t} debt ${s.debt.toFixed(0)}->${e.debt.toFixed(0)}  growth ${e.growth.toFixed(1)}  infl ${e.inflation.toFixed(1)}  gdp x${(e.gdp / s.gdp).toFixed(2)}  focuses ${done} (${sim.state.countries[t]!.focus.tree})`);
}
