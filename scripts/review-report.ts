/**
 * npm run review-report
 *
 * Regenerates the auto-generated section of POLITICS_REVIEW.md from every record marked
 * confidence "needs_review". Everything above the AUTO marker is hand-written and preserved.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileContent } from "../src/content/compile.ts";
import { NodeFiles } from "./lib/nodeFiles.ts";

const OUT = resolve(import.meta.dirname, "../POLITICS_REVIEW.md");
const MARKER = "<!-- AUTO-GENERATED BELOW: run `npm run review-report`; edits below this line are overwritten -->";
const DEFAULT_HEAD = [
  "# Politics data review list",
  "",
  "Everything in the game about real people, parties and institutions must be verifiable.",
  'Records that could not be confirmed against a fetched source are marked `confidence: "needs_review"`',
  "and listed below for a human to check. When you have checked an item, fix the data, add a source,",
  'set `confidence: "verified"`, and re-run `npm run review-report`.',
  "",
  "## Manual notes",
  "",
  "_Add notes for reviewers here. This section is preserved._",
  "",
  "",
].join("\n");

const { db } = compileContent(new NodeFiles());
const head = existsSync(OUT) ? readFileSync(OUT, "utf8").split(MARKER)[0]!.trimEnd() + "\n\n" : DEFAULT_HEAD;

interface Item {
  kind: string;
  id: string;
  label: string;
  note: string;
  file: string;
}
const byCountry = new Map<string, Item[]>();
const add = (tag: string, it: Item) => byCountry.set(tag, [...(byCountry.get(tag) ?? []), it]);

let total = 0;
let records = 0;
for (const [tag, cc] of db.countries) {
  if (!cc.country) continue;
  const dir = `data/countries/${tag}`;
  const check = (kind: string, r: { confidence: string; review_note?: string | undefined }, id: string, label: string, file: string) => {
    records++;
    if (r.confidence !== "needs_review") return;
    total++;
    add(tag, { kind, id, label, note: r.review_note ?? "(no note)", file });
  };
  check("country", cc.country, tag, cc.country.name.en, `${dir}/country.json`);
  for (const ch of cc.country.legislature?.chambers ?? []) check("chamber", ch, ch.id, ch.name.en, `${dir}/country.json`);
  for (const o of cc.country.offices) check("office", o, o.id, o.title.en, `${dir}/country.json`);
  for (const o of cc.cabinet) check("cabinet", o, o.id, o.title.en, `${dir}/cabinet.json`);
  for (const o of cc.military) check("military", o, o.id, o.title.en, `${dir}/military.json`);
  for (const p of cc.people) check("person", p, p.id, `${p.name.en} (b. ${p.birth_year})`, `${dir}/people.json`);
  for (const p of cc.parties) check("party", p, p.id, `${p.name.en} (${p.abbrev.en})`, `${dir}/parties.json`);
  if (cc.elections) {
    check("calendar", cc.elections, "elections", "election calendar", `${dir}/elections.json`);
    for (const e of cc.elections.elections) check("election", e.historical, e.id, `${e.kind} ${e.date}`, `${dir}/elections.json`);
  }
}

const lines: string[] = [MARKER, "", `## Needs review: ${total} of ${records} records`, ""];
const withData = [...db.countries.values()].filter((c) => c.country).length;
lines.push(`Countries with politics data: ${withData} / ${db.countryList.length}.`, "");
const missing = db.countryList.filter((e) => !db.countries.get(e.tag)?.country).map((e) => e.tag);
if (missing.length) lines.push(`Countries with no data yet (${missing.length}): ${missing.join(", ")}`, "");
for (const [tag, items] of [...byCountry].sort()) {
  const name = db.countries.get(tag)!.entry.name;
  lines.push(`### ${tag} — ${name} (${items.length})`, "", "| kind | record | what to check | file |", "|---|---|---|---|");
  for (const it of items) lines.push(`| ${it.kind} | \`${it.id}\` ${it.label} | ${it.note.replace(/\|/g, "\\|")} | ${it.file} |`);
  lines.push("");
}
writeFileSync(OUT, head + lines.join("\n"));
console.log(`POLITICS_REVIEW.md: ${total} needs_review records across ${byCountry.size} countries.`);
