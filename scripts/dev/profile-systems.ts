/**
 * Dev: time spent per system over N simulated days.
 *   npx tsx scripts/dev/profile-systems.ts 730 [--map] [--from YYYY-MM-DD]
 * --map uses the real map (wars, AI movement, armed groups); --from fast-forwards first (not timed).
 */
import { readFileSync } from "node:fs";
import { compileContent } from "../../src/content/compile.ts";
import { dayOf, ymdOf } from "../../src/sim/date.ts";
import { defaultSystems, Simulation, simMapFrom, type System } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";
const { db } = compileContent(new NodeFiles(), {});
const times = new Map<string, number>();
const wrap = (s: System): System => {
  const t = (k: "daily" | "weekly" | "monthly" | "yearly") =>
    s[k] && ((ctx: Parameters<NonNullable<System["daily"]>>[0]) => { const a = performance.now(); s[k]!(ctx); times.set(`${s.id}.${k}`, (times.get(`${s.id}.${k}`) ?? 0) + performance.now() - a); });
  return { ...s, daily: t("daily"), weekly: t("weekly"), monthly: t("monthly"), yearly: t("yearly"), init: s.init };
};
const args = process.argv.slice(2);
const useMap = args.includes("--map");
const provinces = useMap ? JSON.parse(readFileSync("public/map/provinces.json", "utf8")) : [];
const map = useMap ? simMapFrom(provinces, JSON.parse(readFileSync("public/map/adjacency.json", "utf8")), JSON.parse(readFileSync("public/map/rivers.json", "utf8")).pairs) : undefined;
const sim = new Simulation(db, createInitialState(db, { provinces }, { contentHash: "p" }), defaultSystems().map(wrap), map);
const from = args[args.indexOf("--from") + 1];
if (args.includes("--from") && from) { while (sim.state.day < dayOf(from)) sim.step(); times.clear(); }
const n = Number(args.find((a) => /^\d+$/.test(a)) ?? 730);
const t0 = performance.now();
for (let i = 0; i < n; i++) sim.step();
const total = performance.now() - t0;
console.log(`${n} days in ${total.toFixed(0)} ms (${(total / n).toFixed(3)} ms/day), ${Object.values(sim.state.countries).filter((c) => c.active && c.economy).length} countries; ${ymdOf(sim.state.day).year}`);
for (const [k, v] of [...times].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(20)} ${v.toFixed(0)} ms`);
