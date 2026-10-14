/** Dev diagnostic: yearly economic figures for a few countries (npx tsx scripts/dev/economy-diag.ts [years] [mode]). */
import { compileContent } from "../../src/content/compile.ts";
import { dayOf, isoOf } from "../../src/sim/date.ts";
import { factories } from "../../src/sim/economy/economy.ts";
import { Simulation } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";

const { db } = compileContent(new NodeFiles(), {});
const years = Number(process.argv[2] ?? 10);
const mode = (process.argv[3] ?? "historical") as "historical" | "dynamic";
const sim = new Simulation(db, createInitialState(db, { provinces: [] }, { contentHash: "d", rules: { electionMode: mode } }));
const tags = ["USA", "DEU", "RUS", "CHN", "IRN", "GBR", "SOM"];
const t0 = Date.now();
for (let y = 0; y <= years; y++) {
  while (sim.state.day < dayOf(`${2000 + y}-01-02`)) sim.step();
  const line = tags.map((t) => {
    const e = sim.state.countries[t]?.economy;
    if (!e) return `${t} -`;
    const f = factories(db, e);
    return `${t} gdp ${Math.round(e.gdp)} g ${e.growth.toFixed(1)} u ${e.unemployment.toFixed(1)} i ${e.inflation.toFixed(1)} r ${e.interestRate.toFixed(1)} debt ${Math.round(e.debt)} fac ${f.civ}/${f.mil} mood ${sim.state.countries[t]!.economicMood.toFixed(2)}`;
  });
  console.log(isoOf(sim.state.day), `oil ${sim.state.market.prices.oil?.toFixed(2)}`);
  for (const l of line) console.log("   " + l);
}
console.log(`${Date.now() - t0} ms`);
