/**
 * Dev: put an armed group on the real map at the start and let the AI fight it out, printing who holds what.
 *   npx tsx scripts/dev/group-trial.ts GROUP HOST "Province name,Province name" [divisions] [days]
 * e.g. npx tsx scripts/dev/group-trial.ts ISG IRQ "Ninawa,Ar Ramadi (Al-Anbar),Sala ad-Din" 6 365
 */
import { readFileSync } from "node:fs";
import { compileContent } from "../../src/content/compile.ts";
import { spawnArmedGroup } from "../../src/sim/conflicts/armedGroups.ts";
import { formatDate } from "../../src/sim/date.ts";
import { Simulation, simMapFrom } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";

const [group = "ISG", host = "IRQ", names = "", divs = "6", days = "365"] = process.argv.slice(2);
const { db } = compileContent(new NodeFiles(), {});
const provinces = JSON.parse(readFileSync("public/map/provinces.json", "utf8"));
const adjacency = JSON.parse(readFileSync("public/map/adjacency.json", "utf8"));
const state = createInitialState(db, { provinces }, { contentHash: "trial", player: null });
const sim = new Simulation(db, state, undefined, simMapFrom(provinces, adjacency));
spawnArmedGroup(sim.context, group, [{ from: host, provinces: names ? names.split(",") : undefined }], Number(divs));

const nameOf = (id: number) => provinces[id - 1].name as string;
const report = () => {
  const held = state.provinceOwner.flatMap((o, i) => (o === group ? [nameOf(i + 1)] : []));
  const d = (t: string) => state.divisions.filter((x) => x.owner === t).length;
  console.log(`${formatDate(state.day)}: ${group} holds ${held.length} [${held.join(", ")}]; divisions ${group} ${d(group)}, ${host} ${d(host)}; wars ${state.wars.filter((w) => w.armedGroup).length}`);
};
report();
for (let i = 1; i <= Number(days); i++) {
  sim.step();
  if (i % 30 === 0) report();
}
console.log(state.log.filter((l) => l.kind === "civil_war" || l.kind === "war").slice(-10).map((l) => `${formatDate(l.day)} ${l.text}`).join("\n"));
