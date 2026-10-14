/**
 * npm run gen-schemas
 * Writes JSON Schemas for every data file type into data/_schema/ and a VS Code mapping,
 * so editors autocomplete and validate data files while you type.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import * as defs from "../src/content/schemas/definitions.ts";
import * as cty from "../src/content/schemas/country.ts";

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "data/_schema");
mkdirSync(out, { recursive: true });

const schemas: [string, z.ZodType, string[]][] = [
  ["modifiers", defs.ModifiersFile, ["data/modifiers.json"]],
  ["ideology_groups", defs.IdeologyGroupsFile, ["data/ideologies/groups.json"]],
  ["sub_ideologies", defs.SubIdeologiesFile, ["data/ideologies/sub_ideologies.json"]],
  ["government_types", defs.GovernmentTypesFile, ["data/government_types.json"]],
  ["interest_groups", defs.InterestGroupsFile, ["data/interest_groups.json"]],
  ["law_category", defs.LawCategory, ["data/laws/*.json"]],
  ["traits", defs.TraitsFile, ["data/traits/*.json"]],
  ["cultures", defs.CulturesFile, ["data/cultures/*.json"]],
  ["country_list", defs.CountryListFile, ["data/world/countries.json"]],
  ["country", cty.Country, ["data/countries/*/country.json"]],
  ["people", cty.PeopleFile, ["data/countries/*/people.json"]],
  ["parties", cty.PartiesFile, ["data/countries/*/parties.json"]],
  ["elections", cty.ElectionsFile, ["data/countries/*/elections.json"]],
  ["offices", cty.OfficesFile, ["data/countries/*/cabinet.json", "data/countries/*/military.json"]],
  ["country_interest_groups", cty.CountryInterestGroupsFile, ["data/countries/*/interest_groups.json"]],
  ["country_laws", cty.CountryLawsFile, ["data/countries/*/laws.json"]],
];

const mapping: { fileMatch: string[]; url: string }[] = [];
for (const [name, schema, match] of schemas) {
  const js = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
  writeFileSync(resolve(out, `${name}.schema.json`), JSON.stringify(js, null, 2) + "\n");
  mapping.push({ fileMatch: match.map((m) => "/" + m), url: `./data/_schema/${name}.schema.json` });
}

mkdirSync(resolve(root, ".vscode"), { recursive: true });
const settingsPath = resolve(root, ".vscode/settings.json");
const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, "utf8")) : {};
settings["json.schemas"] = mapping;
writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
console.log(`wrote ${schemas.length} schemas to data/_schema and .vscode/settings.json`);
