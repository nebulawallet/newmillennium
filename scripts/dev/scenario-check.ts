/**
 * Dev: run the historical game with history followed exactly (as the start dates are generated, src/sim/scenario.ts)
 * and check every country's leader on each later bookmark against the real office holders in the data.
 *   npx tsx scripts/dev/scenario-check.ts
 */
import { readFileSync } from "node:fs";
import { compileContent } from "../../src/content/compile.ts";
import { dayOf, isoOf } from "../../src/sim/date.ts";
import { Simulation, simMapFrom } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";
const { db } = compileContent(new NodeFiles(), {});
const provinces = JSON.parse(readFileSync("public/map/provinces.json", "utf8"));
const adjacency = JSON.parse(readFileSync("public/map/adjacency.json", "utf8"));
const state = createInitialState(db, { provinces }, { contentHash: "t", player: null, rules: { electionMode: "historical", strictHistory: true } });
const sim = new Simulation(db, state, undefined, simMapFrom(provinces, adjacency, JSON.parse(readFileSync("public/map/rivers.json", "utf8")).pairs));
for (const d of db.bookmarks.filter((b) => b.date > "2000-01-01").map((b) => b.date)) {
  while (state.day < dayOf(d)) sim.step();
  const iso = isoOf(state.day);
  const bad: string[] = []; let n = 0;
  for (const [tag, cc] of db.countries) {
    const c = cc.country; if (!c) continue; const cs = state.countries[tag]; if (!cs?.active) continue;
    const off = c.offices.find((o) => o.id === c.government.effective_executive); if (!off || off.ex_officio_of) continue;
    const real = off.holders.filter((h) => h.from <= iso && (!h.to || h.to > iso)).map((h) => h.person);
    if (!real.length) continue; n++;
    const got = cs.offices[off.id] ?? [];
    if (!real.some((p) => got.includes(p))) bad.push(`${tag}: ${got.join("/") || "-"} (real ${real.join("/")})${cs.followsHistory ? "" : " [off path]"}`);
  }
  console.log(d, `${n - bad.length}/${n} leaders right`, "TAL", state.provinceOwner.filter(o => o === "TAL").length, "ISG", state.provinceOwner.filter(o => o === "ISG").length);
  for (const b of bad) console.log("   ", b);
}
