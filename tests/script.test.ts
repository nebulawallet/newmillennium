import { describe, expect, it } from "vitest";
import { validateEffects, validateTrigger, type ScriptIssue } from "../src/content/script/validate.ts";

const known = new Set(["usa.republican", "green", "usa.al_gore", "RUS"]);
const refs = (_kind: string, v: string) => known.has(v);

describe("script validation", () => {
  it("accepts a well-formed event script", () => {
    const out: ScriptIssue[] = [];
    validateTrigger(
      { all: [{ date_after: "2000-11-01" }, { not: { has_flag: "recount_done" } }, { ruling_sub_ideology: "green" }] },
      "trigger", out, refs,
    );
    validateEffects(
      [
        { add_stability: 0.03 },
        { add_ideology_support: { sub_ideology: "green", value: 0.02 } },
        { if: { limit: { party_exists: "usa.republican" }, then: [{ add_party_popularity: { party: "usa.republican", value: 0.05 } }] } },
        { every_neighbor: { limit: { at_war: false }, effects: [{ add_opinion: { target: "ROOT", value: 10 } }] } },
        { country: { tag: "RUS", effects: [{ add_political_power: 50 }] } },
        { random_list: [{ weight: 70, effects: [{ set_flag: "a" }] }, { weight: 30, effects: [] }] },
      ],
      "effects", out, refs,
    );
    expect(out).toEqual([]);
  });

  it("reports unknown effects, bad arguments and unknown references", () => {
    const out: ScriptIssue[] = [];
    validateEffects(
      [{ add_stabilty: 0.1 }, { add_stability: "lots" }, { set_party_leader: { party: "usa.republican", person: "usa.nobody" } }, { a: 1, b: 2 }],
      "effects", out, refs,
    );
    expect(out.map((o) => o.message)).toEqual([
      "unknown effect 'add_stabilty'",
      expect.stringContaining("expected number"),
      "unknown person 'usa.nobody'",
      expect.stringContaining("exactly one key"),
    ]);
  });
});
