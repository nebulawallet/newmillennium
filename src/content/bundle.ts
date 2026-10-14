/**
 * Plain-JSON form of the compiled ContentDB, used to ship content to the browser.
 * The compiler (Node) produces it with toBundle(); the game rebuilds the maps with fromBundle().
 */
import type { CompileResult, ContentDB, CountryContent, Issue } from "./compile.ts";
import { PoliticsRulesFile, type PoliticsRules } from "./schemas/rules.ts";

export const BUNDLE_VERSION = 1;

export interface ContentBundle {
  version: number;
  asOf: string;
  /** Hash of the bundle contents; saves record it so mismatched content can be detected. */
  hash: string;
  issues: Issue[];
  modifiers: unknown[];
  ideologyGroups: unknown[];
  subIdeologies: unknown[];
  governmentTypes: unknown[];
  interestGroupTypes: unknown[];
  lawCategories: unknown[];
  traits: unknown[];
  cultures: unknown[];
  countryList: unknown[];
  countryColors: Record<string, string>;
  politicsRules: PoliticsRules;
  events: unknown[];
  decisions: unknown[];
  decisionCategories: unknown[];
  focusTrees: unknown[];
  countries: CountryContent[];
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function toBundle({ db, issues }: CompileResult): ContentBundle {
  const body = {
    version: BUNDLE_VERSION,
    asOf: db.asOf,
    issues,
    modifiers: [...db.modifiers.values()],
    ideologyGroups: [...db.ideologyGroups.values()],
    subIdeologies: [...db.subIdeologies.values()],
    governmentTypes: [...db.governmentTypes.values()],
    interestGroupTypes: [...db.interestGroupTypes.values()],
    lawCategories: [...db.lawCategories.values()],
    traits: [...db.traits.values()],
    cultures: [...db.cultures.values()],
    countryList: db.countryList,
    countryColors: Object.fromEntries(db.countryColors),
    politicsRules: db.politicsRules,
    events: [...db.events.values()],
    decisions: [...db.decisions.values()],
    decisionCategories: [...db.decisionCategories.values()],
    focusTrees: [...db.focusTrees.values()],
    countries: [...db.countries.values()].filter((c) => c.country),
  };
  return { ...body, hash: fnv1a(JSON.stringify(body)) };
}

export function fromBundle(b: ContentBundle): ContentDB {
  const byId = <T extends { id: string }>(xs: unknown[]) => new Map((xs as T[]).map((x) => [x.id, x]));
  const db: ContentDB = {
    asOf: b.asOf,
    modifiers: byId(b.modifiers),
    ideologyGroups: byId(b.ideologyGroups),
    subIdeologies: byId(b.subIdeologies),
    governmentTypes: byId(b.governmentTypes),
    interestGroupTypes: byId(b.interestGroupTypes),
    lawCategories: byId(b.lawCategories),
    lawCategoryOf: new Map(),
    traits: byId(b.traits),
    cultures: byId(b.cultures),
    countryList: b.countryList as ContentDB["countryList"],
    countryColors: new Map(Object.entries(b.countryColors ?? {})),
    countries: new Map(),
    politicsRules: b.politicsRules ?? PoliticsRulesFile.parse({}),
    events: byId(b.events ?? []),
    decisions: byId(b.decisions ?? []),
    decisionCategories: byId(b.decisionCategories ?? []),
    focusTrees: byId(b.focusTrees ?? []),
    people: new Map(),
    parties: new Map(),
    offices: new Map(),
  };
  for (const cat of db.lawCategories.values()) for (const law of cat.laws) db.lawCategoryOf.set(law.id, cat.id);
  for (const cc of b.countries) {
    db.countries.set(cc.entry.tag, cc);
    const dir = `countries/${cc.entry.tag}`;
    for (const p of cc.people) db.people.set(p.id, { ...p, file: `${dir}/people.json` });
    for (const p of cc.parties) db.parties.set(p.id, { ...p, file: `${dir}/parties.json` });
    for (const [list, file] of [
      [cc.country?.offices ?? [], "country.json"],
      [cc.cabinet, "cabinet.json"],
      [cc.military, "military.json"],
    ] as const)
      for (const o of list) db.offices.set(o.id, { ...o, tag: cc.entry.tag, file: `${dir}/${file}` });
  }
  return db;
}
