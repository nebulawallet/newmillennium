import { describe, expect, it } from "vitest";
import { compileContent, type CompileOptions } from "../src/content/compile.ts";
import { FixtureFiles, validCountry } from "./fixtures.ts";

function run(mutate?: (d: Record<string, any>) => void, opts?: CompileOptions) {
  const d = validCountry();
  mutate?.(d);
  return compileContent(new FixtureFiles(d), opts).issues.filter((i) => i.severity === "error");
}
const codes = (errs: { code: string }[]) => errs.map((e) => e.code);

describe("validate-data rules", () => {
  it("accepts a complete, sourced country", () => {
    expect(run()).toEqual([]);
  });

  it("fails when a listed country has no data", () => {
    const errs = run((d) => {
      d["world/countries.json"].countries.push({
        tag: "XXB", name: "Nowhere", region: "europe", start_status: "independent", un_member_2000: true, un_member_today: true, detail_tier: 3, research: "full",
      });
    });
    expect(codes(errs)).toContain("MISSING_COUNTRY");
  });

  it("needs no data for a default-tier country and ignores its folder", () => {
    const errs = run((d) => {
      d["world/countries.json"].countries.push({
        tag: "XXB", name: "Nowhere", region: "europe", start_status: "independent", un_member_2000: true, un_member_today: true, detail_tier: 3, research: "default",
      });
    });
    expect(errs).toEqual([]);
  });

  it("light tier needs a current head of state", () => {
    const errs = run((d) => {
      d["world/countries.json"].countries[0].research = "light";
      d["countries/XXA/country.json"].offices[0].holders[0].to = "2010-01-01";
    });
    expect(codes(errs)).toContain("LIGHT_CURRENT");
    expect(codes(errs)).not.toContain("NO_HOS_2000");
  });

  it("fails without a head of state on 2000-01-01", () => {
    const errs = run((d) => {
      d["countries/XXA/country.json"].offices[0].holders[0].from = "2001-01-01";
    });
    expect(codes(errs)).toContain("NO_HOS_2000");
  });

  it("fails without a head of government on 2000-01-01", () => {
    const errs = run((d) => {
      d["countries/XXA/country.json"].offices[1].holders[0].to = "1999-12-01";
    });
    expect(codes(errs)).toContain("NO_HOG_2000");
  });

  it("accepts a documented vacancy as the 2000 head of state", () => {
    const errs = run((d) => {
      d["countries/XXA/country.json"].offices[0].holders = [{ person: null, from: "1999-01-01", to: "2000-08-27", vacant_reason: "No government" }];
    });
    expect(codes(errs)).not.toContain("NO_HOS_2000");
    expect(errs).toEqual([]);
  });

  it("fails on a vacancy without a reason", () => {
    const errs = run((d) => {
      d["countries/XXA/country.json"].offices[0].holders = [{ person: null, from: "1999-01-01" }];
    });
    expect(codes(errs)).toContain("VACANCY");
  });

  it("fails with an empty party list unless the country has no parties", () => {
    expect(codes(run((d) => void (d["countries/XXA/parties.json"].parties = [])))).toContain("NO_PARTIES");
  });

  it("fails on an unknown government type", () => {
    expect(codes(run((d) => void (d["countries/XXA/country.json"].government.type = "space_empire")))).toContain("NO_GOV_TYPE");
  });

  it("fails when an elections-holding country has no calendar", () => {
    expect(codes(run((d) => void delete d["countries/XXA/elections.json"]))).toContain("MISSING_FILE");
    const errs = run((d) => {
      d["countries/XXA/elections.json"].rules = [];
      d["countries/XXA/elections.json"].elections = [];
    });
    expect(codes(errs)).toContain("NO_ELECTION_CALENDAR");
  });

  it("fails when a person lacks source or confidence", () => {
    expect(codes(run((d) => void delete d["countries/XXA/people.json"].people[0].source))).toContain("SCHEMA");
    expect(codes(run((d) => void delete d["countries/XXA/people.json"].people[1].confidence))).toContain("SCHEMA");
    expect(codes(run((d) => void (d["countries/XXA/people.json"].people[1].source = []))).length).toBeGreaterThan(0);
  });

  it("fails when a party lacks source or confidence", () => {
    expect(codes(run((d) => void delete d["countries/XXA/parties.json"].parties[0].source))).toContain("SCHEMA");
    expect(codes(run((d) => void delete d["countries/XXA/parties.json"].parties[1].confidence))).toContain("SCHEMA");
  });

  it("rejects unknown fields (typo protection)", () => {
    expect(codes(run((d) => void (d["countries/XXA/people.json"].people[0].birthyear = 1940)))).toContain("SCHEMA");
  });

  it("fails on dangling references", () => {
    const errs = run((d) => void (d["countries/XXA/parties.json"].parties[0].leader_history[0].person = "xxa.nobody"));
    expect(codes(errs)).toContain("REF");
  });

  it("fails when seats do not add up", () => {
    expect(codes(run((d) => void (d["countries/XXA/country.json"].legislature.chambers[0].seats = 101)))).toContain("SEATS_SUM");
  });

  it("fails when ideology support does not sum to 1", () => {
    expect(codes(run((d) => void (d["countries/XXA/country.json"].start_2000.ideology_support.green = 0.2)))).toContain("SUPPORT_SUM");
  });

  it("fails when a generated person appears before 2027", () => {
    const errs = run((d) => {
      d["countries/XXA/people.json"].people.push({
        id: "xxa.gen_one", name: { en: "Generated One" }, gender: "male", birth_year: 1990, country: "XXA", sub_ideology: "green",
        roles_possible: ["party_leader"], generated: true, available: { from: "2020-01-01" },
        source: [{ url: "https://example.org/generated", title: "Name generator", accessed: "2026-01-01" }], confidence: "verified",
      });
    });
    expect(codes(errs)).toContain("GENERATED_EARLY");
  });

  it("fails on underage office holders and overlapping tenures", () => {
    expect(codes(run((d) => void (d["countries/XXA/people.json"].people[1].birth_year = 1990)))).toContain("UNDERAGE");
    const errs = run((d) => d["countries/XXA/country.json"].offices[1].holders.push({ person: "xxa.carol_test", from: "1999-06-01" }));
    expect(codes(errs)).toContain("OVERLAP");
  });

  it("fails when someone holds office before they are available", () => {
    const errs = run((d) => void (d["countries/XXA/people.json"].people[1].available = { from: "2005-01-01" }));
    expect(codes(errs)).toContain("AVAILABILITY");
  });

  it("fails on ids outside the country prefix", () => {
    expect(codes(run((d) => void (d["countries/XXA/people.json"].people[2].id = "zzz.carol_test")))).toContain("ID_PREFIX");
  });

  it("enforces depth rules only at --tier full", () => {
    expect(run(undefined, { tier: "core" })).toEqual([]);
    const full = codes(run(undefined, { tier: "full" }));
    expect(full).toContain("MILITARY");
    // continuity: holders open-ended -> no gap; opposition: carol counts for tier 3
    expect(full).not.toContain("OPPOSITION_COUNT");
    expect(full).not.toContain("HOLDER_GAP");
  });

  it("detects holder gaps at --tier full", () => {
    const errs = run((d) => {
      d["countries/XXA/country.json"].offices[1].holders = [
        { person: "xxa.bob_test", from: "1999-05-01", to: "2003-01-01" },
        { person: "xxa.carol_test", from: "2004-01-01" },
      ];
    }, { tier: "full" });
    expect(codes(errs)).toContain("HOLDER_GAP");
  });
});
