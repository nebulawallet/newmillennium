/**
 * Builds data/world/flags.json (game tag -> ISO 3166-1 alpha-2 code) and copies the matching
 * flag SVGs from the MIT-licensed `flag-icons` package into public/flags/.
 *
 * The tag -> code table comes from Natural Earth admin-0 (ADM0_A3 -> ISO_A2_EH), the same source
 * the map is built from. Tags with no ISO flag (insurgent governments, de facto states, armed
 * groups, the 2000 Federal Republic of Yugoslavia) get no entry and keep the coloured placeholder.
 *
 *   npx tsx scripts/dev/gen-flags.ts <path to ne_10m_admin_0_countries.shp>
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const shp = process.argv[2] ?? "../../../.cache/raw/ne_10m_admin_0_countries/ne_10m_admin_0_countries.shp";
const tmp = join(tmpdir(), "nm-flags-a0.json");
execFileSync("npx", ["mapshaper", shp, "-filter-fields", "ADM0_A3,ISO_A2,ISO_A2_EH", "-o", tmp, "format=json"], { stdio: "inherit", shell: true });
const rows = JSON.parse(readFileSync(tmp, "utf8")) as { ADM0_A3: string; ISO_A2: string; ISO_A2_EH: string }[];
const iso2 = new Map<string, string>();
for (const r of rows) {
  const c = r.ISO_A2_EH !== "-99" ? r.ISO_A2_EH : r.ISO_A2;
  if (c && c !== "-99") iso2.set(r.ADM0_A3, c.toLowerCase());
}
// Natural Earth has no admin-0 entry for these tags; the ISO 3166-1 codes are standard.
const EXTRA: Record<string, string> = { PSE: "ps", ESH: "eh" };

const SRC = "node_modules/flag-icons/flags/4x3";
const list = JSON.parse(readFileSync("data/world/countries.json", "utf8")).countries as { tag: string }[];
const flags: Record<string, string> = {};
const missing: string[] = [];
mkdirSync("public/flags", { recursive: true });
for (const { tag } of list) {
  const code = EXTRA[tag] ?? iso2.get(tag);
  if (!code || !existsSync(join(SRC, `${code}.svg`))) { missing.push(tag); continue; }
  flags[tag] = code;
  copyFileSync(join(SRC, `${code}.svg`), join("public/flags", `${code}.svg`));
}
copyFileSync("node_modules/flag-icons/LICENSE", "public/flags/LICENSE");
const pkg = JSON.parse(readFileSync("node_modules/flag-icons/package.json", "utf8")) as { version: string };

const out = {
  source: {
    url: "https://github.com/lipis/flag-icons",
    title: `flag-icons ${pkg.version} (4x3 SVGs), copied to public/flags/`,
    licence: "MIT (public/flags/LICENSE)",
    codes: "Natural Earth 10m admin-0 countries (ADM0_A3 -> ISO_A2_EH), public domain",
  },
  confidence: "needs_review",
  review_note: "flag-icons draws today's flags. Countries whose flag changed after 2000 (for example Afghanistan, Iraq and Libya) show the modern flag; dated flags are not modelled.",
  no_flag: missing,
  flags,
};
writeFileSync("data/world/flags.json", `${JSON.stringify(out, null, 2)}\n`);
console.log(`${Object.keys(flags).length} flags, ${missing.length} placeholders: ${missing.join(" ")}`);
