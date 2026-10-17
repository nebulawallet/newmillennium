/**
 * Dev: the economy on the real map over N years with every country under AI: growth, debt,
 * construction spending against the investment allowance, factories, trade income and goods prices.
 *   npx tsx scripts/dev/economy-check.ts [years] [TAG ...]
 */
import { readFileSync } from "node:fs";
import { compileContent } from "../../src/content/compile.ts";
import { ymdOf } from "../../src/sim/date.ts";
import { factories } from "../../src/sim/economy/economy.ts";
import { Simulation, simMapFrom } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";

const args = process.argv.slice(2);
const years = Number(args.find((a) => /^\d+$/.test(a)) ?? 10);
const tags = args.filter((a) => /^[A-Z]{3}$/.test(a));
const watch = tags.length ? tags : ["USA", "DEU", "CHN", "BRA", "IND", "RUS", "SAU", "NGA", "ALB", "JPN"];

const { db } = compileContent(new NodeFiles(), {});
const provinces = JSON.parse(readFileSync("public/map/provinces.json", "utf8"));
const adjacency = JSON.parse(readFileSync("public/map/adjacency.json", "utf8"));
const state = createInitialState(db, { provinces }, { contentHash: "econ", player: null });
const sim = new Simulation(db, state, undefined, simMapFrom(provinces, adjacency));

const row = (t: string) => {
  const e = state.countries[t]?.economy;
  if (!e) return `${t}: -`;
  const f = factories(db, e);
  return `${t}: growth ${e.growth.toFixed(1)} debt ${e.debt.toFixed(0)} build ${(e.investmentPct ?? 0).toFixed(2)}%GDP factories ${f.civ}/${f.mil} built ${e.builtCiv}/${e.builtMil} queue ${e.construction.length} trade ${e.trade ? e.trade.income.toFixed(1) : "-"}bn (0: ${e.trade?.income0?.toFixed(1) ?? "-"}) access ${e.trade ? e.trade.access.toFixed(2) : "-"}`;
};
console.log(`start ${ymdOf(state.day).year}`);
for (const t of watch) console.log("  " + row(t));
for (let y = 1; y <= years; y++) {
  const until = state.day + 365;
  while (state.day < until) sim.step();
  const over = Object.values(state.countries).filter((c) => (c.economy?.investmentPct ?? 0) > db.buildingRules.investment_allowance_pct_gdp).map((c) => c.tag);
  const prices = Object.entries(state.market.goods ?? {}).map(([g, m]) => `${g} ${m.price.toFixed(2)}`).join(", ");
  console.log(`${ymdOf(state.day).year}: over the allowance: ${over.length} (${over.slice(0, 12).join(" ")}) | prices ${prices}`);
  if (y % 5 === 0 || y === years) for (const t of watch) console.log("  " + row(t));
}
