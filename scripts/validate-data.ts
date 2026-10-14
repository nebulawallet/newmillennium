/**
 * npm run validate-data -- [--tier core|full] [--region <region>] [--only TAG,TAG] [--existing] [--report] [--warnings]
 *
 *   --existing  only check countries that already have data (used by `npm run check` while Phase 2 is in progress)
 *
 * Exits 1 if any error is found. Coverage rules apply to every country in
 * data/world/countries.json unless narrowed with --only / --region.
 */
import { compileContent, type Issue } from "../src/content/compile.ts";
import { NodeFiles, parseArgs } from "./lib/nodeFiles.ts";
import { coverageTable } from "./lib/coverage.ts";

const args = parseArgs(process.argv.slice(2));
const tier = args.tier === "full" ? "full" : "core";
const files = new NodeFiles();

let only: Set<string> | undefined;
if (typeof args.only === "string") only = new Set(args.only.split(",").map((s) => s.trim().toUpperCase()));
if (typeof args.region === "string") {
  const list = JSON.parse(files.read("world/countries.json") ?? '{"countries":[]}') as { countries: { tag: string; region: string }[] };
  const tags = list.countries.filter((c) => c.region === args.region).map((c) => c.tag);
  if (tags.length === 0) {
    console.error(`no countries in region '${args.region}'`);
    process.exit(2);
  }
  only = new Set([...(only ?? []), ...tags]);
}

if (args.existing) {
  // Only countries that already have a folder (useful while the world database is being built).
  const list = JSON.parse(files.read("world/countries.json") ?? '{"countries":[]}') as { countries: { tag: string }[] };
  const have = list.countries.map((c) => c.tag).filter((t) => files.read(`countries/${t}/country.json`) !== undefined);
  only = new Set([...(only ?? have)].filter((t) => have.includes(t)));
}

const { db, issues } = compileContent(files, { tier, only });
const errors = issues.filter((i) => i.severity === "error");
const warnings = issues.filter((i) => i.severity === "warning");

function print(list: Issue[], label: string, limit: number) {
  const byFile = new Map<string, Issue[]>();
  for (const i of list) byFile.set(i.file, [...(byFile.get(i.file) ?? []), i]);
  let n = 0;
  for (const [file, is] of [...byFile].sort()) {
    for (const i of is) {
      if (n++ >= limit) return console.log(`  ... ${list.length - limit} more ${label}s (narrow with --only/--region)`);
      console.log(`  ${label === "error" ? "✗" : "!"} [${i.code}] ${file}${i.path ? ` @ ${i.path}` : ""}: ${i.message}`);
    }
  }
}

if (args.report) console.log(coverageTable(db, only) + "\n");

const scope = only ? `${only.size} countr${only.size === 1 ? "y" : "ies"}` : `all ${db.countryList.length} countries`;
console.log(`validate-data: tier=${tier}, scope=${scope}`);
console.log(`  loaded ${db.people.size} people, ${db.parties.size} parties, ${db.offices.size} offices, ` +
  `${db.subIdeologies.size} sub-ideologies, ${db.lawCategories.size} law categories, ${db.traits.size} traits`);

if (warnings.length && (args.warnings || errors.length === 0)) {
  console.log(`\nWarnings (${warnings.length}):`);
  print(warnings, "warning", args.warnings ? 10_000 : 40);
}
if (errors.length) {
  console.log(`\nErrors (${errors.length}):`);
  const missing = errors.filter((e) => e.code === "MISSING_COUNTRY");
  const rest = errors.filter((e) => e.code !== "MISSING_COUNTRY");
  print(rest, "error", 200);
  if (missing.length) console.log(`  ✗ [MISSING_COUNTRY] ${missing.length} countries have no politics data yet: ${missing.map((m) => m.tag).join(" ")}`);
  console.log(`\nFAILED with ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`\nOK — no errors${warnings.length ? `, ${warnings.length} warning(s)` : ""}.`);
