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
  pop_growth_pct: "SP.POP.GROW",
  revenue_pct_gdp: "GC.REV.XGRT.GD.ZS",
  expense_pct_gdp: "GC.XPN.TOTL.GD.ZS",
  tax_revenue_pct_gdp: "GC.TAX.TOTL.GD.ZS",
  lending_rate_pct: "FR.INR.LEND",
  industry_pct_gdp: "NV.IND.TOTL.ZS",
  manufacturing_pct_gdp: "NV.IND.MANF.ZS",
  services_pct_gdp: "NV.SRV.TOTL.ZS",
  agriculture_pct_gdp: "NV.AGR.TOTL.ZS",
  exports_pct_gdp: "NE.EXP.GNFS.ZS",
  imports_pct_gdp: "NE.IMP.GNFS.ZS",
  oil_rents_pct_gdp: "NY.GDP.PETR.RT.ZS",
  gas_rents_pct_gdp: "NY.GDP.NGAS.RT.ZS",
  coal_rents_pct_gdp: "NY.GDP.COAL.RT.ZS",
  mineral_rents_pct_gdp: "NY.GDP.MINR.RT.ZS",
  reserves_usd: "FI.RES.TOTL.CD",
  labor_force: "SL.TLF.TOTL.IN",
  rnd_pct_gdp: "GB.XPD.RSDV.GD.ZS",
  // gdp_growth_avg_1995_2000 is derived below from NY.GDP.MKTP.KD.ZG
};

/** Sparse fiscal series: where 2000 is missing, the earliest value up to this year is used (and its year recorded). */
const FILL_UNTIL = 2005;
const SPARSE = new Set(["central_gov_debt_pct_gdp", "revenue_pct_gdp", "expense_pct_gdp", "tax_revenue_pct_gdp", "lending_rate_pct", "rnd_pct_gdp"]);

interface Row {
  countryiso3code: string;
  country: { value: string };
  value: number | null;
  date: string;
}

async function indicator(code: string, until = YEAR): Promise<Row[]> {
  const out: Row[] = [];
  for (let page = 1; page < 20; page++) {
    const url = `https://api.worldbank.org/v2/country/all/indicator/${code}?date=${YEAR}:${until}&format=json&per_page=1000&page=${page}`;
    const r = await fetch(url, { headers: { "User-Agent": "NewMillennium-data/0.1" } });
    if (!r.ok) throw new Error(`${code}: HTTP ${r.status}`);
    const j = (await r.json()) as [{ pages: number }, Row[]];
    out.push(...(j[1] ?? []));
    if (page >= (j[0]?.pages ?? 1)) break;
  }
  return out;
}

async function main() {
  const countries: Record<string, Record<string, number | string>> = {};
  for (const [key, code] of Object.entries(INDICATORS)) {
    const sparse = SPARSE.has(key);
    const rows = (await indicator(code, sparse ? FILL_UNTIL : YEAR)).filter((r) => r.value !== null && r.countryiso3code);
    // earliest year first, so 2000 wins where it exists
    rows.sort((a, b) => Number(a.date) - Number(b.date));
    let n = 0;
    for (const row of rows) {
      const iso = row.countryiso3code;
      countries[iso] ??= { name: row.country.value };
      if (countries[iso]![key] !== undefined) continue;
      countries[iso]![key] = row.value!;
      if (Number(row.date) !== YEAR) countries[iso]![`${key}_year`] = Number(row.date);
      n++;
    }
    console.log(`  ${key} (${code}): ${n} values`);
  }
  // average real GDP growth 1995-2000 (potential growth anchor)
  {
    const url = `https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.KD.ZG?date=1995:2000&format=json&per_page=2000`;
    const r = await fetch(url, { headers: { "User-Agent": "NewMillennium-data/0.1" } });
    const rows = ((await r.json()) as [unknown, Row[]])[1] ?? [];
    const acc = new Map<string, number[]>();
    for (const row of rows) if (row.value !== null && row.countryiso3code) acc.set(row.countryiso3code, [...(acc.get(row.countryiso3code) ?? []), row.value]);
    let n = 0;
    for (const [iso, vals] of acc) {
      if (vals.length < 4 || !countries[iso]) continue;
      countries[iso]!.gdp_growth_avg_1995_2000 = vals.reduce((a, b) => a + b, 0) / vals.length;
      n++;
    }
    console.log(`  gdp_growth_avg_1995_2000 (NY.GDP.MKTP.KD.ZG, mean of 1995-2000 with at least 4 years): ${n} values`);
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
        note: `Includes aggregates (regions, income groups) under their World Bank codes; game code only reads country ISO3 entries. For sparse fiscal series (${[...SPARSE].join(", ")}) a missing 2000 value is filled with the earliest value up to ${FILL_UNTIL}; <key>_year records the year used.`,
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
