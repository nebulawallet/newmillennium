/**
 * Test fixtures: the real global definition files from data/ plus a small synthetic
 * country ("XXA") that is valid at both tiers. Tests clone and break it.
 */
import type { FileProvider } from "../src/content/files.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

/** Real definitions from disk, with country list and country folders taken from memory. */
export class FixtureFiles implements FileProvider {
  private disk = new NodeFiles();
  constructor(private mem: Record<string, unknown>) {}
  read(path: string): string | undefined {
    if (path in this.mem) {
      const v = this.mem[path];
      return v === undefined ? undefined : JSON.stringify(v);
    }
    if (path.startsWith("countries/") || path === "world/countries.json") return undefined;
    return this.disk.read(path);
  }
  listFiles(dir: string): string[] {
    return this.disk.listFiles(dir);
  }
}

const src = [{ url: "https://example.org/source", title: "Test source", accessed: "2026-01-01" }];
const ok = { source: src, confidence: "verified" as const };

export function validCountry(): Record<string, any> {
  return {
    "world/countries.json": {
      as_of: "2026-10-14",
      countries: [
        { tag: "XXA", name: "Testland", region: "europe", start_status: "independent", un_member_2000: true, un_member_today: true, detail_tier: 3 },
      ],
    },
    "countries/XXA/country.json": {
      tag: "XXA",
      name: { en: "Testland" },
      adjective: "Testish",
      culture_primary: "german",
      government: {
        type: "parliamentary",
        effective_executive: "xxa.prime_minister",
        head_of_state_office: "xxa.president",
        head_of_government_office: "xxa.prime_minister",
        constitution: { term_limit_amendable: true, emergency_powers: false, referendum_required_for: [] },
      },
      offices: [
        {
          id: "xxa.president", title: { en: "President" }, role: "head_of_state", power_weight: 0.1, selection: "legislature",
          term_years: 5, holders: [{ person: "xxa.alice_test", from: "1998-01-01" }], ...ok,
        },
        {
          id: "xxa.prime_minister", title: { en: "Prime Minister" }, role: "head_of_government", power_weight: 0.9, selection: "legislature",
          holders: [{ person: "xxa.bob_test", from: "1999-05-01" }], ...ok,
        },
      ],
      legislature: {
        name: { en: "Parliament" },
        chambers: [
          {
            id: "parliament", name: { en: "Parliament" }, seats: 100, term_years: 4, elected: "direct",
            system: { type: "list_pr", formula: "dhondt", threshold: 0.05 },
            seats_2000: { "xxa.reds": 55, "xxa.blues": 45 }, confidence_chamber: true, ...ok,
          },
        ],
      },
      party_system: "multi_party",
      start_2000: {
        ruling_parties: ["xxa.reds"],
        ideology_support: { social_democrat: 0.55, christian_democrat: 0.45 },
        ideology_support_note: "From the 1998 election.",
        stability: 0.7, war_support: 0.2,
      },
      ...ok,
    },
    "countries/XXA/people.json": {
      people: [
        { id: "xxa.alice_test", name: { en: "Alice Test" }, gender: "female", birth_year: 1940, country: "XXA", sub_ideology: "social_democrat", roles_possible: ["head_of_state"], ...ok },
        { id: "xxa.bob_test", name: { en: "Bob Test" }, gender: "male", birth_year: 1950, country: "XXA", party: "xxa.reds", sub_ideology: "social_democrat", roles_possible: ["head_of_government", "party_leader"], ...ok },
        { id: "xxa.carol_test", name: { en: "Carol Test" }, gender: "female", birth_year: 1955, country: "XXA", party: "xxa.blues", sub_ideology: "christian_democrat", roles_possible: ["opposition_leader", "party_leader"], ...ok },
      ],
    },
    "countries/XXA/parties.json": {
      parties: [
        { id: "xxa.reds", name: { en: "Red Party" }, abbrev: { en: "RP" }, color: "#cc0000", sub_ideology: "social_democrat", founded: 1900, status_2000: "active",
          leader_history: [{ person: "xxa.bob_test", from: 1995 }], popularity_2000: 0.55, ...ok },
        { id: "xxa.blues", name: { en: "Blue Party" }, abbrev: { en: "BP" }, color: "#0000cc", sub_ideology: "christian_democrat", founded: 1950, status_2000: "active",
          leader_history: [{ person: "xxa.carol_test", from: 1997 }], popularity_2000: 0.45, ...ok },
      ],
    },
    "countries/XXA/elections.json": {
      rules: [{ kind: "legislative", chamber: "parliament", every_years: 4, anchor: "2002-06-01", snap_possible: true }],
      elections: [
        { id: "parliament_2002", date: "2002-06-01", kind: "legislative", chamber: "parliament",
          historical: { party_results: [{ party: "xxa.reds", share: 0.5, seats: 50 }, { party: "xxa.blues", share: 0.5, seats: 50 }], winner: "xxa.reds", ...ok } },
      ],
      ...ok,
    },
  };
}
