/**
 * npm run fetch-worldbank
 *
 * Fetches year-2000 World Development Indicators for every economy from the World Bank API
 * (https://api.worldbank.org, CC BY 4.0) and writes data/economy/worldbank_2000.json.
 * Values are stored as published, keyed by ISO3 code, with the indicator metadata as source.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve(import.meta.dirname, "../../data/economy/worldbank_2000.json");
const YEAR = 2000;
const INDICATORS: Record<string, string> = {
  population: "SP.POP.TOTL",
  gdp_usd: "NY.GDP.MKTP.CD",
  gdp_per_capita_usd: "NY.GDP.PCAP.CD",
  gdp_growth_pct: "NY.GDP.MKTP.KD.ZG",
  inflation_pct: "FP.CPI.TOTL.ZG",
  unemployment_pct: "SL.UEM.TOTL.ZS",
  central_gov_debt_pct_gdp: "GC.DOD.TOTL.GD.ZS",
  military_spending_pct_gdp: "MS.MIL.XPND.GD.ZS",
  urban_population_pct: "SP.URB.TOTL.IN.ZS",
};

interface Row {
  countryiso3code: string;
  country: { value: string };
  value: number | null;
}

async function indicator(code: string): Promise<Row[]> {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${code}?date=${YEAR}&format=json&per_page=500`;
  const r = await fetch(url, { headers: { "User-Agent": "NewMillennium-data/0.1" } });
  if (!r.ok) throw new Error(`${code}: HTTP ${r.status}`);
  const j = (await r.json()) as [unknown, Row[]];
  return j[1] ?? [];
}

async function main() {
  const countries: Record<string, Record<string, number | string>> = {};
  for (const [key, code] of Object.entries(INDICATORS)) {
    const rows = await indicator(code);
    let n = 0;
    for (const row of rows) {
      const iso = row.countryiso3code;
      if (!iso || row.value === null) continue;
      countries[iso] ??= { name: row.country.value };
      countries[iso]![key] = row.value;
      n++;
    }
    console.log(`  ${key} (${code}): ${n} values`);
  }
  mkdirSync(resolve(OUT, ".."), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        year: YEAR,
        source: [
          { url: "https://api.worldbank.org/v2/", title: "World Bank, World Development Indicators API (CC BY 4.0)", accessed: new Date().toISOString().slice(0, 10) },
        ],
        indicators: INDICATORS,
        note: "Includes aggregates (regions, income groups) under their World Bank codes; game code only reads country ISO3 entries.",
        countries,
      },
      null,
      1,
    ) + "\n",
  );
  console.log(`wrote ${Object.keys(countries).length} entries to data/economy/worldbank_2000.json`);
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
