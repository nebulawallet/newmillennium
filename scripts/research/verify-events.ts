/**
 * Verify dated event candidates against Wikipedia before they become game events.
 *
 *   npx tsx scripts/research/verify-events.ts <candidates.json> <out.json> [--cache DIR]
 *
 * Each candidate is { id, date: "YYYY-MM-DD", page, also?: string[] }. The tool fetches the plain-text
 * extract of `page` (cached), looks for the event date written as "11 March 2004" or "March 11, 2004"
 * (plus any `also` phrases), and writes the result with the sentence that matched as evidence.
 * Candidates whose date is not found are marked unverified; nothing is guessed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const UA = "NewMillenniumResearch/0.1 (grand strategy game event database; contact via repository)";
const WP = "https://en.wikipedia.org/w/api.php";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

async function getJson(url: string): Promise<any> {
  // Wikimedia throttles busy clients (HTTP 429): back off up to a minute per try, for up to ~15 minutes
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (r.status === 429 || r.status >= 500) {
        await new Promise((res) => setTimeout(res, Math.max(Number(r.headers.get("retry-after") ?? 0) * 1000, Math.min(60000, 5000 * (attempt + 1)))));
        continue;
      }
      if (!r.ok) throw new Error(`${r.status} for ${url}`);
      return await r.json();
    } catch (e) {
      if (attempt === 19) throw e;
      await new Promise((res) => setTimeout(res, 5000 * (attempt + 1)));
    }
  }
  throw new Error(`gave up on ${url}`);
}

async function extract(title: string, cache: string): Promise<{ title: string; text: string }> {
  const file = join(cache, title.replace(/[^\w-]+/g, "_") + ".json");
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const p = new URLSearchParams({ action: "query", prop: "extracts", explaintext: "1", titles: title, format: "json", redirects: "1" });
  const j = await getJson(`${WP}?${p}`);
  const page = Object.values(j.query.pages)[0] as any;
  const out = { title: page.title ?? title, text: page.extract ?? "" };
  writeFileSync(file, JSON.stringify(out));
  await new Promise((res) => setTimeout(res, 250));
  return out;
}

function datePatterns(iso: string): RegExp[] {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const month = MONTHS[m - 1]!;
  return [new RegExp(`\\b${d}\\s+${month}\\s+${y}\\b`), new RegExp(`\\b${month}\\s+${d},?\\s+${y}\\b`), new RegExp(`\\b${d}\\s*[–-]\\s*\\d+\\s+${month}\\s+${y}\\b`), new RegExp(`\\b${month}\\s+${d}\\s*[–-]\\s*\\d+,?\\s+${y}\\b`)];
}

const sentenceAround = (text: string, idx: number) => {
  const start = Math.max(text.lastIndexOf(".", idx) + 1, idx - 300);
  const endDot = text.indexOf(".", idx);
  return text.slice(start, endDot < 0 ? idx + 200 : Math.min(endDot + 1, idx + 300)).replace(/\s+/g, " ").trim();
};

async function main() {
  const [inFile, outFile] = process.argv.slice(2);
  const ci = process.argv.indexOf("--cache");
  const cache = ci > 0 ? process.argv[ci + 1]! : ".cache/wiki-events";
  mkdirSync(cache, { recursive: true });
  const cands = JSON.parse(readFileSync(inFile!, "utf8")) as { id: string; date: string; page: string; also?: string[] }[];
  const results: unknown[] = [];
  let ok = 0;
  for (const c of cands) {
    let title = c.page, text = "";
    try {
      ({ title, text } = await extract(c.page, cache));
    } catch (e) {
      results.push({ id: c.id, page: c.page, date: c.date, verified: false, unfetched: true, error: String(e) });
      console.log(`SKIP ${c.id} ${c.page} (not fetched: ${String(e).slice(0, 80)})`);
      writeFileSync(outFile!, JSON.stringify(results, null, 1));
      continue;
    }
    let evidence: string | null = null;
    let precision: "day" | "month" = "day";
    for (const re of datePatterns(c.date)) {
      const m = re.exec(text);
      if (m) { evidence = sentenceAround(text, m.index); break; }
    }
    if (!evidence) {
      // fall back to the month: the game then schedules the event on the 1st and the text must not name a day
      const [y, mo] = c.date.split("-").map(Number) as [number, number];
      const m = new RegExp(`\\b${MONTHS[mo - 1]}\\s+(?:of\\s+)?${y}\\b`).exec(text);
      if (m) { evidence = sentenceAround(text, m.index); precision = "month"; }
    }
    const missing = (c.also ?? []).filter((p) => !text.toLowerCase().includes(p.toLowerCase()));
    const verified = !!text && !!evidence && !missing.length;
    if (verified) ok++;
    results.push({ id: c.id, page: title, date: c.date, precision, verified, evidence, missing, empty: !text });
    writeFileSync(outFile!, JSON.stringify(results, null, 1));
    console.log(`${verified ? (precision === "month" ? "ok~ " : "ok  ") : "MISS"} ${c.id} ${c.date} ${title}${!text ? " (no page)" : !evidence ? " (date not found)" : missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);
  }
  writeFileSync(outFile!, JSON.stringify(results, null, 1));
  console.log(`\n${ok} of ${cands.length} verified`);
}
main().catch((e) => { console.error(e); process.exit(1); });
