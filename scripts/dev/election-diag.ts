/** Dev diagnostic: print election outcomes for a few seeds (npx tsx scripts/dev/election-diag.ts). */
import { compileContent } from "../../src/content/compile.ts";
import { dayOf, isoOf } from "../../src/sim/date.ts";
import { Simulation } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";
import { readFileSync } from "node:fs";
import { simMapFrom } from "../../src/sim/simulation.ts";

const { db } = compileContent(new NodeFiles(), { only: new Set(["USA", "RUS", "DEU"]) });
const mode = (process.argv[2] ?? "dynamic") as "historical" | "dynamic";
const until = process.argv[3] ?? "2003-01-01";
const n = Number(process.argv[4] ?? 5);
const useMap = process.argv.includes("--map");
const provinces = useMap ? JSON.parse(readFileSync("public/map/provinces.json", "utf8")) : [];
const adjacency = useMap ? JSON.parse(readFileSync("public/map/adjacency.json", "utf8")) : [];
const simMap = useMap ? simMapFrom(provinces, Array.isArray(adjacency) ? adjacency : adjacency.land ?? []) : undefined;
const t0 = Date.now();
for (let i = 0; i < n; i++) {
  const s = createInitialState(db, { provinces },  { contentHash: "d", seed: 1000 + i * 7919, rules: { electionMode: mode } });
  const sim = new Simulation(db, s, undefined, simMap);
  while (sim.state.day < dayOf(until)) sim.step();
  console.log(`--- seed ${i}`);
  for (const r of sim.state.elections) {
    const top = Object.entries(r.shares).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k.split(".")[1]} ${(v * 100).toFixed(1)}`).join(", ");
    const seats = r.seats ? Object.entries(r.seats).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k.split(".").pop()}:${v}`).join(" ") : "";
    const ev = r.unitVotes ? Object.entries(r.unitVotes).map(([k, v]) => `${k.split(".")[1]}:${v}`).join(" ") : "";
    const r2 = r.candidates?.filter((c) => c.round === 2).map((c) => `${c.person.split(".")[1]} ${(c.share * 100).toFixed(1)}`).join(", ");
    console.log(`${isoOf(r.day)} ${r.tag} ${r.chamber ?? r.office} hist=${r.followedHistory} win=${r.winner} | ${top} | ${seats}${ev} ${r2 ? "| R2 " + r2 : ""} ${r.government ? "| gov " + r.government.parties.join("+") + (r.government.minority ? " (min)" : "") + " " + r.government.leader : ""}`);
  }
  for (const t of ["USA", "RUS", "DEU"]) {
    const c = sim.state.countries[t]!;
    const execs = Object.entries(c.offices).filter(([k]) => /president|chancellor|prime/.test(k)).map(([k, v]) => `${k}=${v.join("/")}`).join(" ");
    console.log(`  ${t} ruling=${c.rulingParties.join("+")} follows=${c.followsHistory} stab=${c.stability.toFixed(2)} unrest=${c.unrest.toFixed(2)} ${execs}`);
  }
}
console.log(`${Date.now() - t0} ms`);
