/** Dev: starting armies (npx tsx scripts/dev/military-diag.ts). */
import { readFileSync } from "node:fs";
import { compileContent } from "../../src/content/compile.ts";
import { manpowerPool } from "../../src/sim/military/military.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";
const { db } = compileContent(new NodeFiles(), {});
const provinces = JSON.parse(readFileSync("public/map/provinces.json", "utf8"));
const s = createInitialState(db, { provinces }, { contentHash: "d" });
for (const t of ["USA", "RUS", "CHN", "DEU", "GBR", "FRA", "IRN", "TUR", "JPN", "SOM", "SWE"]) {
  const cs = s.countries[t]!;
  const ds = s.divisions.filter((d) => d.owner === t);
  const by: Record<string, number> = {};
  for (const d of ds) by[d.template] = (by[d.template] ?? 0) + 1;
  console.log(t, "divisions", ds.length, JSON.stringify(by), "manpower", Math.round(cs.military?.manpower ?? 0), "pool", Math.round(manpowerPool(db, cs)), "strength", (ds.reduce((a, d) => a + d.strength, 0) / Math.max(1, ds.length)).toFixed(2), "unplaced", ds.filter((d) => d.province < 0).length);
}
console.log("total divisions", s.divisions.length);
