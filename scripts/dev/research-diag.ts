/** Dev: starting technologies and research progress (npx tsx scripts/dev/research-diag.ts [years]). */
import { compileContent } from "../../src/content/compile.ts";
import { dayOf } from "../../src/sim/date.ts";
import { researchSpeed, startLag } from "../../src/sim/research/research.ts";
import { Simulation } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";
const { db } = compileContent(new NodeFiles(), {});
const sim = new Simulation(db, createInitialState(db, { provinces: [] }, { contentHash: "d" }));
const show = () => {
  for (const t of ["USA", "DEU", "RUS", "CHN", "IRN", "SOM", "JPN", "TUR"]) {
    const cs = sim.state.countries[t]!;
    const e = cs.economy!;
    const lag = startLag(db, t, db.worldBank.countries[t]?.gdp_usd as number / 1e9 || e.gdp, e.population);
    console.log(t, "techs", cs.research!.completed.length, "slots", cs.research!.slots.length, "speed", researchSpeed(db, cs).total.toFixed(2), "lag", lag.civil.toFixed(1), lag.military.toFixed(1), "now", cs.research!.slots.join(","));
  }
};
show();
while (sim.state.day < dayOf(`${2000 + Number(process.argv[2] ?? 5)}-01-01`)) sim.step();
console.log("---");
show();
