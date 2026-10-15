/** Dev: growth target breakdown for a few countries after N years (npx tsx scripts/dev/growth-parts.ts 6). */
import { compileContent } from "../../src/content/compile.ts";
import { dayOf } from "../../src/sim/date.ts";
import { growthTarget } from "../../src/sim/economy/economy.ts";
import { Simulation } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";
const { db } = compileContent(new NodeFiles(), {});
const sim = new Simulation(db, createInitialState(db, { provinces: [] }, { contentHash: "d" }));
while (sim.state.day < dayOf(`${2000 + Number(process.argv[2] ?? 6)}-01-02`)) sim.step();
for (const t of ["DEU", "USA", "RUS", "CHN"]) {
  const cs = sim.state.countries[t]!;
  const g = growthTarget(db, sim.state, cs);
  console.log(t, "growth", cs.economy!.growth.toFixed(2), "target", g.target.toFixed(2), g.parts.map((p) => `${p.label} ${p.value.toFixed(2)}`).join(" | "), "rev", cs.economy!.revenue.toFixed(1), "spend", cs.economy!.spending.toFixed(1), "stab", cs.stability.toFixed(2));
}
