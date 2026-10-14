/**
 * Research helper for building the politics database from primary reference data.
 * Uses the public Wikipedia and Wikidata APIs and prints raw facts (not summaries),
 * so every claim written into data/ can be checked and cited.
 *
 *   npx tsx scripts/research/wiki.ts person "Gerhard Schröder" "Angela Merkel" Q567
 *       -> QID, enwiki URL, birth/death, gender, parties, positions held (with dates)
 *   npx tsx scripts/research/wiki.ts holders Q4970706 [--from 1999]
 *       -> everyone who held a position (by position QID), with start/end dates
 *   npx tsx scripts/research/wiki.ts wikitext "1998 German federal election" [--section 0] [--grep Bundestag]
 *   npx tsx scripts/research/wiki.ts extract "Federal Convention (Germany)"
 *   npx tsx scripts/research/wiki.ts chairs "Social Democratic Party of Germany" --from 1999  -> party leaders (P488)
 *   npx tsx scripts/research/wiki.ts search "chancellor of germany"     -> Wikidata entity search
 *   npx tsx scripts/research/wiki.ts sparql query.rq
 *
 * Be polite: requests are sequential and carry a descriptive User-Agent.
 */
import { readFileSync } from "node:fs";

process.stdout.on("error", () => process.exit(0));

const UA = "NewMillenniumResearch/0.1 (grand strategy game politics database; contact via repository)";

async function getJson(url: string): Promise<any> {
  for (let attempt = 0; attempt < 6; attempt++) {
    let r: Response;
    try {
      r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    } catch (e) {
      console.error(`  (network error: ${(e as Error).message}; retrying)`);
      await new Promise((res) => setTimeout(res, 3000 * (attempt + 1)));
      continue;
    }
    if (r.status === 429 || r.status >= 500) {
      const wait = Number(r.headers.get("retry-after") ?? 0) * 1000 || 3000 * (attempt + 1);
      console.error(`  (HTTP ${r.status}; retrying in ${wait / 1000}s)`);
      await new Promise((res) => setTimeout(res, wait));
      continue;
    }
    if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
    return r.json();
  }
  throw new Error(`gave up on ${url}`);
}

const WP = "https://en.wikipedia.org/w/api.php";
const wpUrl = (title: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

export async function sparql(query: string): Promise<any[]> {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  const j = await getJson(url);
  return j.results.bindings;
}

async function wikitext(title: string, section?: string): Promise<string> {
  const p = new URLSearchParams({ action: "parse", page: title, prop: "wikitext", format: "json", redirects: "1" });
  if (section !== undefined) p.set("section", section);
  const j = await getJson(`${WP}?${p}`);
  if (j.error) throw new Error(j.error.info);
  return j.parse.wikitext["*"];
}

async function extract(title: string): Promise<string> {
  const p = new URLSearchParams({ action: "query", prop: "extracts", explaintext: "1", titles: title, format: "json", redirects: "1" });
  const j = await getJson(`${WP}?${p}`);
  const page = Object.values(j.query.pages)[0] as any;
  return page.extract ?? "(no page)";
}

/** Resolve an enwiki title (or QID) to a QID. */
async function toQid(s: string): Promise<{ qid: string; title?: string } | null> {
  if (/^Q\d+$/.test(s)) return { qid: s };
  const p = new URLSearchParams({ action: "query", prop: "pageprops", ppprop: "wikibase_item", titles: s, format: "json", redirects: "1" });
  const j = await getJson(`${WP}?${p}`);
  const page = Object.values(j.query.pages)[0] as any;
  if (!page?.pageprops?.wikibase_item) return null;
  return { qid: page.pageprops.wikibase_item, title: page.title };
}

const v = (b: any, k: string) => b[k]?.value as string | undefined;
const day = (s?: string) => (s ? s.slice(0, 10).replace(/^\+/, "") : "");

/**
 * Wikidata stores many dates with year or month precision but returns them as YYYY-01-01.
 * Print them at their real precision (YYYY, YYYY-MM, YYYY-MM-DD) so nobody copies an
 * invented day into the data.
 */
function fmt(b: any, k: string): string {
  const raw = day(v(b, k));
  if (!raw) return "";
  const prec = Number(v(b, k + "P") ?? 11);
  if (prec >= 11) return raw;
  if (prec === 10) return raw.slice(0, 7);
  if (prec === 9) return raw.slice(0, 4);
  return "~" + raw.slice(0, 4);
}
/** SPARQL fragment binding ?<name> and ?<name>P (precision) for a qualifier on statement ?st. */
const qdate = (prop: string, name: string) =>
  `OPTIONAL { ?st pqv:${prop} ?${name}V. ?${name}V wikibase:timeValue ?${name}; wikibase:timePrecision ?${name}P }`;
/** SPARQL fragment for a direct date property of ?subj. */
const ddate = (subj: string, prop: string, name: string) =>
  `OPTIONAL { ${subj} p:${prop}/psv:${prop} ?${name}V. ?${name}V wikibase:timeValue ?${name}; wikibase:timePrecision ?${name}P }`;

async function person(args: string[]): Promise<void> {
  for (const a of args) {
    const r = await toQid(a);
    if (!r) {
      console.log(`\n## ${a}: no Wikipedia page / Wikidata item found`);
      continue;
    }
    const q = r.qid;
    const base = await sparql(`
      SELECT ?label ?native ?dob ?dobP ?dod ?dodP ?genderLabel ?article WHERE {
        BIND(wd:${q} AS ?p)
        OPTIONAL { ?p rdfs:label ?label FILTER(LANG(?label)="en" || LANG(?label)="mul") }
        OPTIONAL { ?p wdt:P1559 ?native }
        ${ddate("?p", "P569", "dob")} ${ddate("?p", "P570", "dod")}
        OPTIONAL { ?p wdt:P21 ?gender }
        OPTIONAL { ?article schema:about ?p; schema:isPartOf <https://en.wikipedia.org/> }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul" }
      } LIMIT 5`);
    const b = base[0] ?? {};
    console.log(`\n## ${v(b, "label") ?? a}  (${q})`);
    console.log(`  wikipedia: ${v(b, "article") ?? (r.title ? wpUrl(r.title) : "-")}`);
    console.log(`  wikidata:  https://www.wikidata.org/wiki/${q}`);
    if (v(b, "native")) console.log(`  native:    ${v(b, "native")}`);
    console.log(`  born: ${fmt(b, "dob") || "?"}   died: ${fmt(b, "dod") || "-"}   gender: ${v(b, "genderLabel") ?? "?"}`);
    const parties = await sparql(`
      SELECT ?partyLabel ?start ?startP ?end ?endP WHERE {
        wd:${q} p:P102 ?st. ?st ps:P102 ?party.
        ${qdate("P580", "start")} ${qdate("P582", "end")}
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul" }
      }`);
    for (const p of parties) console.log(`  party: ${v(p, "partyLabel")} ${fmt(p, "start")}..${fmt(p, "end")}`);
    const pos = await sparql(`
      SELECT ?posLabel ?pos ?start ?startP ?end ?endP ?ofLabel WHERE {
        wd:${q} p:P39 ?st. ?st ps:P39 ?pos.
        ${qdate("P580", "start")} ${qdate("P582", "end")} OPTIONAL { ?st pq:P642 ?of }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul" }
      } ORDER BY ?start`);
    for (const p of pos)
      console.log(`  held: ${v(p, "posLabel")} [${v(p, "pos")?.split("/").pop()}] ${fmt(p, "start")}..${fmt(p, "end")}${v(p, "ofLabel") ? " of " + v(p, "ofLabel") : ""}`);
  }
}

async function holders(qid: string, from?: string): Promise<void> {
  const rows = await sparql(`
    SELECT ?p ?pLabel ?start ?startP ?end ?endP ?dob WHERE {
      ?p p:P39 ?st. ?st ps:P39 wd:${qid}.
      ${qdate("P580", "start")} ${qdate("P582", "end")} OPTIONAL { ?p wdt:P569 ?dob }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul" }
    } ORDER BY ?start`);
  const pos = await sparql(`SELECT ?l WHERE { wd:${qid} rdfs:label ?l FILTER(LANG(?l)="en" || LANG(?l)="mul") }`);
  console.log(`# holders of ${pos[0] ? v(pos[0], "l") : qid} (${qid})`);
  for (const r of rows) {
    const end = fmt(r, "end");
    if (from && end && end < from) continue;
    console.log(`  ${fmt(r, "start") || "?"} .. ${end || "(open)"}  ${v(r, "pLabel")} [${v(r, "p")?.split("/").pop()}] b.${day(v(r, "dob")).slice(0, 4)}`);
  }
}

/** Party (or organisation) leaders via P488 chairperson, with dates. Accepts enwiki title or QID. */
async function chairs(s: string, from?: string): Promise<void> {
  const r = await toQid(s);
  if (!r) return void console.log(`no item for ${s}`);
  const rows = await sparql(`
    SELECT ?p ?pLabel ?start ?startP ?end ?endP ?dob WHERE {
      wd:${r.qid} p:P488 ?st. ?st ps:P488 ?p.
      ${qdate("P580", "start")} ${qdate("P582", "end")} OPTIONAL { ?p wdt:P569 ?dob }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul" }
    } ORDER BY ?start`);
  const meta = await sparql(`
    SELECT ?l ?inc ?incP ?dis ?disP WHERE { BIND(wd:${r.qid} AS ?x) OPTIONAL { ?x rdfs:label ?l FILTER(LANG(?l)="en" || LANG(?l)="mul") }
      ${ddate("?x", "P571", "inc")} ${ddate("?x", "P576", "dis")} } LIMIT 1`);
  const m = meta[0] ?? {};
  console.log(`# chairs of ${v(m, "l") ?? s} (${r.qid}) founded ${fmt(m, "inc")} dissolved ${fmt(m, "dis") || "-"}`);
  for (const row of rows) {
    const end = fmt(row, "end");
    if (from && end && end < from) continue;
    console.log(`  ${fmt(row, "start") || "?"} .. ${end || "(open)"}  ${v(row, "pLabel")} [${v(row, "p")?.split("/").pop()}] b.${day(v(row, "dob")).slice(0, 4)}`);
  }
}

async function search(text: string): Promise<void> {
  const p = new URLSearchParams({ action: "wbsearchentities", search: text, language: "en", format: "json", limit: "10" });
  const j = await getJson(`https://www.wikidata.org/w/api.php?${p}`);
  for (const r of j.search) console.log(`  ${r.id}  ${r.label} — ${r.description ?? ""}`);
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const val = args[i + 1];
  args.splice(i, 2);
  return val;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "person":
      return person(rest);
    case "holders": {
      const from = flag(rest, "from");
      return holders(rest[0]!, from);
    }
    case "wikitext": {
      const section = flag(rest, "section");
      const grep = flag(rest, "grep");
      const text = await wikitext(rest[0]!, section);
      if (!grep) return void console.log(text);
      const re = new RegExp(grep, "i");
      text.split("\n").forEach((l, i) => re.test(l) && console.log(`${i}: ${l}`));
      return;
    }
    case "chairs": {
      const from = flag(rest, "from");
      for (const s of rest) await chairs(s, from);
      return;
    }
    case "extract":
      return void console.log(await extract(rest[0]!));
    case "search":
      return search(rest.join(" "));
    case "sparql": {
      const rows = await sparql(readFileSync(rest[0]!, "utf8"));
      for (const r of rows) console.log(Object.fromEntries(Object.entries(r).map(([k, x]: any) => [k, x.value])));
      return;
    }
    default:
      console.log("usage: wiki.ts person|holders|wikitext|extract|search|sparql ... (see file header)");
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
