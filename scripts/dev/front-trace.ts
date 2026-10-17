/**
 * Dev: how an army spreads on a front on the real map. The player forms one army from all its
 * divisions, gives it a front against a neighbour (optionally at war, with an offensive line on
 * the neighbour's capital), and the script prints where every division stands.
 *   npx tsx scripts/dev/front-trace.ts DEU POL [days] [--war] [--attack]
 */
import { readFileSync } from "node:fs";
import { compileContent } from "../../src/content/compile.ts";
import { Simulation, simMapFrom } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { borderPairs, frontPairs } from "../../src/sim/military/fronts.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";

const args = process.argv.slice(2);
const [me, them] = [args[0] ?? "DEU", args[1] ?? "POL"];
const days = Number(args.find((a) => /^\d+$/.test(a)) ?? 60);
const { db } = compileContent(new NodeFiles(), {});
const provinces = JSON.parse(readFileSync("public/map/provinces.json", "utf8"));
const map = simMapFrom(provinces, JSON.parse(readFileSync("public/map/adjacency.json", "utf8")), JSON.parse(readFileSync("public/map/rivers.json", "utf8")).pairs);
const state = createInitialState(db, { provinces }, { contentHash: "f", player: me, rules: { electionMode: "dynamic" } });
const sim = new Simulation(db, state, undefined, map);
const name = (p: number) => provinces[p - 1]?.name ?? p;
if (args.includes("--war")) sim.dispatch({ type: "declare_war", tag: me, target: them });
const ids = state.divisions.filter((d) => d.owner === me).map((d) => d.id);
sim.dispatch({ type: "create_army", tag: me, divisions: ids });
const army = state.armies.find((a) => a.owner === me)!;
console.log(sim.dispatch({ type: "set_front", tag: me, army: army.id, enemy: them }).text);
if (args.includes("--attack")) {
  let cap = 0, pop = -1;
  for (const p of provinces) if (p.owner === them && p.population > pop) { pop = p.population; cap = p.id; }
  sim.dispatch({ type: "set_offensive", tag: me, army: army.id, provinces: [cap] });
  sim.dispatch({ type: "execute_plan", tag: me, army: army.id, on: true });
}
const pairs = args.includes("--war") ? frontPairs(state, map, me).filter((p) => p.enemyTag === them) : borderPairs(state, map, me, them);
const front = [...new Set(pairs.map((p) => p.own))];
console.log(`${ids.length} divisions, front provinces ${front.length}: ${front.map(name).join(", ")}`);
for (let d = 1; d <= days; d++) {
  sim.step();
  if (d % 15 === 0 || d === days) {
    const at = new Map<number, number>();
    for (const x of state.divisions) if (army.divisions.includes(x.id)) at.set(x.province, (at.get(x.province) ?? 0) + 1);
    const moving = state.divisions.filter((x) => army.divisions.includes(x.id) && x.path.length).length;
    const stretch = army.stretch ?? [];
    const onFront = [...at].filter(([p]) => stretch.includes(p)).reduce((s, [, n]) => s + n, 0);
    const empty = stretch.filter((p) => !at.get(p));
    const held = state.provinceController.filter((c, i) => c === me && state.provinceOwner[i] === them).length;
    console.log(`day ${d}: status ${army.status}, on front ${onFront}/${army.divisions.length}, moving ${moving}, empty front provinces ${empty.length}/${stretch.length}, held ${held}`);
    console.log("   " + [...at].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${name(p)}${stretch.includes(p) ? "*" : ""} ${n}`).join(", "));
  }
}
