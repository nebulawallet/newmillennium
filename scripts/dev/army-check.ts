/**
 * Dev: on each later start date, list countries in play (holding land) whose armed forces or economy are missing
 * or empty, so a scenario never hands the player a country that cannot recruit or produce.
 *   npx tsx scripts/dev/army-check.ts
 */
import { readFileSync } from "node:fs";
import { compileContent } from "../../src/content/compile.ts";
import { dayOf } from "../../src/sim/date.ts";
import { Simulation, simMapFrom } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";
const { db } = compileContent(new NodeFiles(), {});
const provinces = JSON.parse(readFileSync("public/map/provinces.json", "utf8"));
const adjacency = JSON.parse(readFileSync("public/map/adjacency.json", "utf8"));
const state = createInitialState(db, { provinces }, { contentHash: "t", player: null, rules: { electionMode: "historical", strictHistory: true } });
const sim = new Simulation(db, state, undefined, simMapFrom(provinces, adjacency, JSON.parse(readFileSync("public/map/rivers.json", "utf8")).pairs));
const div0 = new Map<string, number>();
for (const d of state.divisions) div0.set(d.owner, (div0.get(d.owner) ?? 0) + 1);
for (const b of db.bookmarks) {
  while (state.day < dayOf(b.date)) sim.step();
  const divs = new Map<string, number>();
  for (const d of state.divisions) divs.set(d.owner, (divs.get(d.owner) ?? 0) + 1);
  const land = new Map<string, number>();
  for (const o of state.provinceOwner) land.set(o, (land.get(o) ?? 0) + 1);
  const issues: string[] = [];
  for (const [t, n] of land) {
    const cs = state.countries[t];
    if (!cs?.active) continue;
    const d = divs.get(t) ?? 0;
    const miss = [!cs.military && "no military", !cs.economy && "no economy", d === 0 && "0 divisions"].filter(Boolean);
    const shrunk = d < (div0.get(t) ?? 0) / 3;
    if (miss.length || (shrunk && n >= 5)) issues.push(`${t} (${n} prov, ${d} div, 2000: ${div0.get(t) ?? 0}, manpower ${Math.round(cs.military?.manpower ?? 0)}): ${miss.join(", ") || "army shrank"}`);
  }
  console.log(`== ${b.date}: ${issues.length} countries`);
  for (const i of issues) console.log("  ", i);
}
