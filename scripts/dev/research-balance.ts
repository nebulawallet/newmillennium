/**
 * Research pacing over 25 years: for chosen countries, how many of each year's technologies they
 * have by the end of that year, and how far ahead they run. Research system only (fast).
 *   npx tsx scripts/dev/research-balance.ts [TAG ...]
 */
import { compileContent } from "../../src/content/compile.ts";
import { researchSlots, researchSpeed, researchSystem } from "../../src/sim/research/research.ts";
import { Simulation } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { ymdOf } from "../../src/sim/date.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";

const tags = process.argv.slice(2).length ? process.argv.slice(2) : ["CZE", "USA", "DEU", "BRA", "IND", "NGA"];
const { db } = compileContent(new NodeFiles(), { only: new Set(tags) });
const sim = new Simulation(db, createInitialState(db, { provinces: [] }, { contentHash: "t", player: null }), [researchSystem]);
const s = sim.state;
for (const t of tags) {
  const cs = s.countries[t];
  if (!cs?.research || !cs.economy) { console.log(t, "no research"); continue; }
  console.log(`${t}: ${researchSlots(db, cs.economy.gdp)} slots, speed ×${researchSpeed(db, cs).total.toFixed(2)}, starts with ${cs.research.completed.length} techs`);
}
const techs = [...db.techs.values()];
const header = ["year", ...tags.map((t) => `${t} due/ahead`)].join("\t");
console.log(header);
for (let y = 2000; y <= 2025; y++) {
  while (ymdOf(s.day).year <= y) sim.step();
  const row = [String(y)];
  for (const t of tags) {
    const r = s.countries[t]?.research;
    if (!r) { row.push("-"); continue; }
    const done = new Set(r.completed);
    // technologies due by the end of this year, not counting the alternatives a choice closed
    const due = techs.filter((x) => x.year <= y && !x.mutually_exclusive.some((m) => done.has(m)));
    const have = due.filter((x) => done.has(x.id)).length;
    const ahead = techs.filter((x) => x.year > y + 1 && done.has(x.id)).length;
    row.push(`${Math.round((have / due.length) * 100)}% / ${ahead}`);
  }
  console.log(row.join("\t"));
}
