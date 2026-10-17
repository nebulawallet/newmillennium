/**
 * Dev: the Phase 12 acceptance run. Simulates N game-years (default 10) on the real map with every
 * country under AI, and reports tick times, wars, civil wars and anything that threw.
 *   npx tsx scripts/dev/soak.ts [years] [--dynamic] [--seed N]
 */
import { readFileSync } from "node:fs";
import { compileContent } from "../../src/content/compile.ts";
import { ymdOf } from "../../src/sim/date.ts";
import { Simulation, simMapFrom } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";

const args = process.argv.slice(2);
const years = Number(args.find((a) => /^\d+$/.test(a)) ?? 10);
const dynamic = args.includes("--dynamic");
const seedArg = args.indexOf("--seed");
const seed = seedArg >= 0 ? Number(args[seedArg + 1]) : 20000101;

const { db } = compileContent(new NodeFiles(), {});
const provinces = JSON.parse(readFileSync("public/map/provinces.json", "utf8"));
const adjacency = JSON.parse(readFileSync("public/map/adjacency.json", "utf8"));
const state = createInitialState(db, { provinces }, { contentHash: "soak", seed, player: null, rules: { electionMode: dynamic ? "dynamic" : "historical" } });
const sim = new Simulation(db, state, undefined, simMapFrom(provinces, adjacency, JSON.parse(readFileSync("public/map/rivers.json", "utf8")).pairs));

const days = Math.round(years * 365.25);
const times: number[] = [];
let wars = 0, civilWars = 0;
sim.onEvent((e) => {
  if (e.type === "civil_war") civilWars++;
});
const seenWars = new Set<number>();
const t0 = performance.now();
for (let i = 0; i < days; i++) {
  const a = performance.now();
  sim.step();
  times.push(performance.now() - a);
  for (const w of state.wars) if (!seenWars.has(w.id)) { seenWars.add(w.id); wars++; }
  if (i % 365 === 364) {
    const y = ymdOf(state.day).year;
    const yr = times.slice(-365);
    console.log(`${y}: ${(yr.reduce((s, x) => s + x, 0) / yr.length).toFixed(2)} ms/day, worst ${Math.max(...yr).toFixed(1)} ms; wars so far ${wars}, under way ${state.wars.length}, divisions ${state.divisions.length}, tension ${(state.worldTension * 100).toFixed(0)}%`);
  }
}
const total = performance.now() - t0;
times.sort((a, b) => a - b);
const pct = (p: number) => times[Math.min(times.length - 1, Math.floor(times.length * p))]!.toFixed(2);
console.log(`\n${days} days in ${(total / 1000).toFixed(1)} s: mean ${(total / days).toFixed(2)} ms/day, median ${pct(0.5)}, p99 ${pct(0.99)}, worst ${times[times.length - 1]!.toFixed(1)} ms`);
console.log(`countries acting: ${Object.values(state.countries).filter((c) => c.active).length}; wars started ${wars}; civil wars ${civilWars}; resolutions ${state.diplomacy.unsc.resolutions.length}`);
const blocs = Object.entries(state.diplomacy.blocs).map(([b, m]) => `${b} ${m.length}`).join(", ");
console.log(`blocs: ${blocs}`);
console.log(`war log:\n  ${state.log.filter((l) => l.kind === "war" || l.kind === "civil_war").slice(-15).map((l) => `${ymdOf(l.day).year} ${l.tag ?? ""} ${l.text}`).join("\n  ")}`);
