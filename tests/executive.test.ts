import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { effectiveLeader, executiveOffice } from "../src/sim/politics/common.ts";
import { runEffects } from "../src/sim/scripting/engine.ts";
import { Simulation } from "../src/sim/simulation.ts";
import { createInitialState } from "../src/sim/state.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

const { db } = compileContent(new NodeFiles(), { only: new Set(["IRQ"]) });

describe("dated effective executive", () => {
  it("Iraq's executive moves from the President to the Prime Minister, and the leader follows", () => {
    const sim = new Simulation(db, createInitialState(db, { provinces: [] }, { contentHash: "t", player: null }));
    const irq = sim.state.countries.IRQ!;
    expect(executiveOffice(db, irq)).toBe("irq.president");
    irq.offices["irq.prime_minister"] = ["irq.nouri_al_maliki"];
    const ev = db.events.get("irq_prime_minister_executive")!;
    runEffects(sim.context, { tag: "IRQ", root: "IRQ", from: null }, ev.options[0]!.effects as unknown[], "t");
    expect(executiveOffice(db, irq)).toBe("irq.prime_minister");
    expect(effectiveLeader(db, irq, sim.state)).toBe("irq.nouri_al_maliki");
  });
});
