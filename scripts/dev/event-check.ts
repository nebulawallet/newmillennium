/** Dev: run N years and report whether chosen events fired, and the war log (npx tsx scripts/dev/event-check.ts 23 rus_crimea rus_invasion_of_ukraine). */
import { readFileSync } from "node:fs";
import { compileContent } from "../../src/content/compile.ts";
import { isoOf } from "../../src/sim/date.ts";
import { Simulation, simMapFrom } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";
const [years, ...ids] = process.argv.slice(2);
const { db } = compileContent(new NodeFiles(), {});
const provinces = JSON.parse(readFileSync("public/map/provinces.json", "utf8"));
const adjacency = JSON.parse(readFileSync("public/map/adjacency.json", "utf8"));
const state = createInitialState(db, { provinces }, { contentHash: "e", player: null });
const sim = new Simulation(db, state, undefined, simMapFrom(provinces, adjacency));
for (let i = 0; i < 365.25 * Number(years); i++) sim.step();
for (const id of ids) {
  const fired = Object.values(state.countries).filter((c) => id in c.eventsFired).map((c) => `${c.tag}@${isoOf(c.eventsFired[id]!)}`);
  console.log(id, fired.length ? fired.join(" ") : "NOT FIRED");
}
for (const t of ["RUS", "UKR", "GEO", "USA"]) console.log(t, "active", state.countries[t]?.active, "followsHistory", state.countries[t]?.followsHistory);
console.log("wars", JSON.stringify(state.wars));
console.log(state.log.filter((l) => l.kind === "war").map((l) => `${isoOf(l.day)} ${l.tag} ${l.text}`).join("\n"));
