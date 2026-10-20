/**
 * Dev: the 2003 invasion of Iraq day by day on the real map (historical mode, all AI): which Iraqi provinces the
 * coalition controls, how many divisions each side has in or next to Iraq, and the battles. Stops after 9 April 2003.
 *   npx tsx scripts/dev/iraq-2003.ts [--seed N]
 */
import { readFileSync } from "node:fs";
import { compileContent } from "../../src/content/compile.ts";
import { dayOf, isoOf } from "../../src/sim/date.ts";
import { Simulation, simMapFrom } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";

const args = process.argv.slice(2);
const seedArg = args.indexOf("--seed");
const seed = seedArg >= 0 ? Number(args[seedArg + 1]) : 20000101;
const { db } = compileContent(new NodeFiles(), {});
const provinces = JSON.parse(readFileSync("public/map/provinces.json", "utf8"));
const adjacency = JSON.parse(readFileSync("public/map/adjacency.json", "utf8"));
const state = createInitialState(db, { provinces }, { contentHash: "iraq", seed, player: null, rules: { electionMode: "historical" } });
const sim = new Simulation(db, state, undefined, simMapFrom(provinces, adjacency, JSON.parse(readFileSync("public/map/rivers.json", "utf8")).pairs));

const start = dayOf("2003-03-18"), end = dayOf("2003-04-10");
while (state.day < start) sim.step();
const iraq = provinces.filter((p: { owner: string }) => p.owner === "IRQ").map((p: { id: number; name: string }) => p);
console.log(`Iraq: ${iraq.length} provinces: ${iraq.map((p: { name: string }) => p.name).join(", ")}`);
const coalition = new Set(["USA", "GBR", "POL", "AUS"]);
while (state.day < end) {
  sim.step();
  const held = iraq.filter((p: { id: number }) => coalition.has(state.provinceController[p.id - 1]!));
  const inIraq = (t: string) => state.divisions.filter((d) => d.owner === t && iraq.some((p: { id: number }) => p.id === d.province)).length;
  const usa = state.divisions.filter((d) => d.owner === "USA" && (state.provinceOwner[d.province - 1] === "KWT" || state.provinceOwner[d.province - 1] === "IRQ"));
  const battles = state.battles.filter((b) => b.attackerTag === "USA" || b.defenderTag === "USA" || b.attackerTag === "GBR").length;
  if (process.argv.includes("--units") && (state.day - start) % 4 === 0) {
    const nm = (id: number) => provinces[id - 1]?.name ?? id;
    for (const d of state.divisions.filter((d) => d.owner === "USA" && ["KWT", "IRQ"].includes(state.provinceOwner[d.province - 1]!)))
      console.log(`    USA ${d.name} at ${nm(d.province)} str ${d.strength.toFixed(2)} org ${d.organisation.toFixed(2)} path ${d.path.map(nm).join(">")} attacking ${d.attacking ? nm(d.attacking as number) : "-"}`);
    const byProv = new Map<number, number>();
    for (const d of state.divisions.filter((d) => d.owner === "IRQ")) byProv.set(d.province, (byProv.get(d.province) ?? 0) + 1);
    console.log(`    IRQ: ${[...byProv].map(([p, n]) => `${nm(p)} ${n}`).join(", ")}`);
    for (const a of state.armies.filter((a) => a.owner === "USA")) console.log(`    army ${a.id} front ${JSON.stringify(a.front)} offensive ${a.offensive.map(nm).join(",")} executing ${a.executing} divs ${a.divisions.length}`);
    for (const b of state.battles.filter((b) => b.attackerTag === "USA")) console.log(`    battle ${JSON.stringify(b).slice(0, 200)}`);
  }
  console.log(`${isoOf(state.day)}  coalition holds ${held.length}/${iraq.length} [${held.map((p: { name: string }) => p.name).join(", ")}]  USA divs KWT+IRQ ${usa.length} (moving ${usa.filter((d) => d.path.length).length}), IRQ divs ${state.divisions.filter((d) => d.owner === "IRQ").length}, in Iraq USA ${inIraq("USA")} GBR ${inIraq("GBR")}; battles ${battles}`);
}
