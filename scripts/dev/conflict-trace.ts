/**
 * Dev: run the historical game on the real map and print the conflict timeline: wars, armed groups and who holds
 * the conflict countries' provinces, so the scripts in data/events/conflicts.json can be checked against their dates.
 *   npx tsx scripts/dev/conflict-trace.ts [until YYYY-MM-DD] [--dynamic] [--seed N]
 */
import { readFileSync } from "node:fs";
import { compileContent } from "../../src/content/compile.ts";
import { dayOf, formatDate, ymdOf } from "../../src/sim/date.ts";
import { Simulation, simMapFrom } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";

const args = process.argv.slice(2);
const until = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? "2026-10-14";
const seedArg = args.indexOf("--seed");
const { db } = compileContent(new NodeFiles(), {});
const provinces = JSON.parse(readFileSync("public/map/provinces.json", "utf8"));
const adjacency = JSON.parse(readFileSync("public/map/adjacency.json", "utf8"));
const state = createInitialState(db, { provinces }, {
  contentHash: "trace", player: null, seed: seedArg >= 0 ? Number(args[seedArg + 1]) : 20000101,
  rules: { electionMode: args.includes("--dynamic") ? "dynamic" : "historical" },
});
const sim = new Simulation(db, state, undefined, simMapFrom(provinces, adjacency, JSON.parse(readFileSync("public/map/rivers.json", "utf8")).pairs));
const WATCH = ["AFG", "IRQ", "SYR", "PSE", "UKR"];
const groups = [...db.armedGroups.keys()];
const holdings = () => {
  const out: string[] = [];
  for (const g of groups) {
    const held = state.provinceOwner.flatMap((o, i) => (o === g ? [provinces[i].name as string] : []));
    if (held.length || state.countries[g]) out.push(`${g}: ${held.join(", ") || "(no land)"} [${state.divisions.filter((d) => d.owner === g).length} div]`);
  }
  return out.join("; ") || "no groups";
};
sim.onLog((e) => {
  if (e.kind === "war" || e.kind === "civil_war" || (e.kind === "diplomacy" && e.text.includes("merges")))
    console.log(`${formatDate(e.day)}  ${e.tag ?? "-"}  ${e.text}`);
});
const end = dayOf(until);
let year = 1999;
while (state.day < end) {
  sim.step();
  const y = ymdOf(state.day).year;
  if (y !== year) {
    year = y;
    const owners = WATCH.map((t) => {
      const own = state.provinceOwner.flatMap((o, i) => (o === t ? [i] : []));
      const lost = own.filter((i) => state.provinceController[i] !== t).length;
      const foreign = [...new Set(state.divisions.filter((d) => state.provinceOwner[d.province - 1] === t && d.owner !== t).map((d) => d.owner))];
      return `${t} ${own.length}${lost ? ` (${lost} occupied)` : ""}${foreign.length ? ` [troops: ${foreign.join("/")}]` : ""}`;
    }).join(", ");
    console.log(`-- ${y}: ${holdings()} | provinces ${owners} | wars: ${state.wars.map((w) => w.name).join(", ") || "none"}`);
  }
}
console.log(`-- end ${formatDate(state.day)}: ${holdings()}`);
