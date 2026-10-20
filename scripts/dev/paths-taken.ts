/**
 * Dev: run the historical game with every country under AI and list any focus that leaves history (`leave_history`,
 * or the early proclamation of the Islamic Emirate) that an AI country completed while it still followed history. The
 * list should be empty; such focuses taken by countries already off history (an election that went differently) are
 * counted separately. Also prints each country's name and focus tree when they changed, and where the Taliban and the Islamic
 * State stand on the way.
 *   npx tsx scripts/dev/paths-taken.ts [YYYY-MM-DD]   (default 2026-10-01)
 */
import { readFileSync } from "node:fs";
import { compileContent } from "../../src/content/compile.ts";
import { dayOf, isoOf } from "../../src/sim/date.ts";
import { countryName } from "../../src/sim/politics/unrest.ts";
import { Simulation, simMapFrom } from "../../src/sim/simulation.ts";
import { createInitialState, focusTreeFor } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";

const end = dayOf(process.argv[2] ?? "2026-10-01");
const { db } = compileContent(new NodeFiles(), {});
const provinces = JSON.parse(readFileSync("public/map/provinces.json", "utf8"));
const adjacency = JSON.parse(readFileSync("public/map/adjacency.json", "utf8"));
const state = createInitialState(db, { provinces }, { contentHash: "paths", seed: 20000101, player: null, rules: { electionMode: "historical" } });
const sim = new Simulation(db, state, undefined, simMapFrom(provinces, adjacency, JSON.parse(readFileSync("public/map/rivers.json", "utf8")).pairs));

// focuses whose effects take a country off history
const offPath = new Map<string, string>();
for (const t of db.focusTrees.values())
  for (const f of t.focuses) {
    const text = JSON.stringify(f.effects);
    if (text.includes('"leave_history"') || text.includes('"iea_formed"')) offPath.set(f.id, `${t.id}: ${f.name}`);
  }

const seen = new Set<string>();
const hits: string[] = [];
let offHistory = 0;
let lastYear = -1;
while (state.day < end) {
  const followed = new Map(Object.values(state.countries).map((c) => [c.tag, c.followsHistory]));
  sim.step();
  for (const cs of Object.values(state.countries))
    for (const id of cs.focus.completed) {
      const key = `${cs.tag}:${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!offPath.has(id)) continue;
      if (followed.get(cs.tag) === false) offHistory++;
      else hits.push(`${isoOf(state.day)} ${cs.tag} ${offPath.get(id)}`);
    }
  const y = Math.floor(state.day / 365.25);
  if (y !== lastYear) {
    lastYear = y;
    const n = (t: string) => state.provinceOwner.filter((o) => o === t).length;
    console.log(`${isoOf(state.day)}  AFG "${countryName(db, state, "AFG")}" tree ${state.countries.AFG!.focus.tree}; TAL ${n("TAL")} provinces; ISG ${n("ISG")}`);
  }
}

console.log(`\nAI focuses that left the historical path: ${hits.length} (and ${offHistory} taken by countries already off it)`);
for (const h of hits) console.log("  ", h);
const changed = Object.values(state.countries).filter((c) => c.name || (c.focus.tree && c.focus.tree !== focusTreeFor(db, c.tag)));
console.log(`\nRenamed or switched trees: ${changed.map((c) => `${c.tag} "${countryName(db, state, c.tag)}" (${c.focus.tree})`).join(", ") || "none"}`);
process.exitCode = hits.length ? 1 : 0;
