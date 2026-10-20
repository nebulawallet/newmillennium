import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { focusTreeFor } from "../src/sim/state.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

const GROUPS = ["HAM", "HEZ", "SYO", "SDF", "DPR", "LPR"];
const { db, issues } = compileContent(new NodeFiles(), { only: new Set(GROUPS) });

describe("playable armed groups", () => {
  it("each has a country record, a leader office and its own tree, with no errors", () => {
    expect(issues.filter((i) => i.severity === "error" && GROUPS.some((g) => i.file.includes(g) || i.file.includes(g.toLowerCase())))).toEqual([]);
    for (const g of GROUPS) {
      expect(db.armedGroups.get(g)?.country_record, g).toBe(true);
      expect(db.countries.get(g)?.country?.offices.length, g).toBeGreaterThan(0);
      expect(focusTreeFor(db, g)).toBe(g.toLowerCase());
      const text = JSON.stringify(db.focusTrees.get(g.toLowerCase())!.focuses);
      for (const fx of ["declare_war", "occupy_provinces", "transfer_provinces"]) expect(text.includes(`"${fx}"`), `${g} ${fx}`).toBe(false);
    }
  });
});
