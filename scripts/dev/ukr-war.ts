/** Dev: trace the 2022 Russia–Ukraine war in historical mode (divisions, occupation, war support). */
import { readFileSync } from "node:fs";
import { compileContent } from "../../src/content/compile.ts";
import { dayOf, isoOf } from "../../src/sim/date.ts";
import { Simulation, simMapFrom } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { occupiedShare } from "../../src/sim/military/war.ts";
import { armyPower } from "../../src/sim/ai/ai.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";
const { db } = compileContent(new NodeFiles(), {});
const provinces = JSON.parse(readFileSync("public/map/provinces.json", "utf8"));
const adjacency = JSON.parse(readFileSync("public/map/adjacency.json", "utf8"));
const state = createInitialState(db, { provinces }, { contentHash: "e", player: null });
const sim = new Simulation(db, state, undefined, simMapFrom(provinces, adjacency));
while (state.day < dayOf("2022-02-20")) sim.step();
const show = () => {
  const n = (t: string) => state.divisions.filter((d) => d.owner === t).length;
  console.log(isoOf(state.day), "RUS", n("RUS"), Math.round(armyPower(db, state, "RUS")), "UKR", n("UKR"), Math.round(armyPower(db, state, "UKR")), "UKR occupied", (occupiedShare(sim.context, "UKR") * 100).toFixed(0) + "%", "ws", state.countries.RUS!.warSupport.toFixed(2), state.countries.UKR!.warSupport.toFixed(2), "battles", state.battles.length);
};
for (let i = 0; i < 400 && (state.wars.length || state.day < dayOf("2022-03-01")); i++) { if (i % 20 === 0) show(); sim.step(); }
show();
console.log(Object.values(state.countries).filter((c) => "ukr_general_mobilisation" in c.eventsFired || "ukr_defense_contact_group" in c.eventsFired).map((c) => c.tag + Object.keys(c.eventsFired).filter((k) => k.startsWith("ukr_")).join(",")));
