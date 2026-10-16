/** Dev: find state values that do not survive a JSON save round trip (NaN, Infinity, undefined in arrays). */
import { compileContent } from "../../src/content/compile.ts";
import { Simulation } from "../../src/sim/simulation.ts";
import { createInitialState } from "../../src/sim/state.ts";
import { NodeFiles } from "../lib/nodeFiles.ts";
const { db } = compileContent(new NodeFiles(), { only: new Set(["DEU", "USA", "RUS"]) });
const sim = new Simulation(db, createInitialState(db, { provinces: [] }, { contentHash: "d", player: null }));
for (let i = 0; i < 400; i++) sim.step();
const walk = (v: unknown, path: string): void => {
  if (typeof v === "number" && !Number.isFinite(v)) console.log(path, v);
  else if (Array.isArray(v)) v.forEach((x, i) => (x === undefined ? console.log(path + `[${i}]`, "undefined") : walk(x, `${path}[${i}]`)));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
};
walk(sim.state, "state");
