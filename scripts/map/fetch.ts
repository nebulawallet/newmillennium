/**
 * npm run fetch-map
 *
 * Downloads the public map source data into .cache/raw/<dataset>/ (gitignored).
 * Each dataset gets its own directory; archives are extracted next to the download.
 * Already-downloaded datasets are skipped, so the script is safe to re-run.
 *
 * Sources:
 *  - Natural Earth 1:10m vectors (public domain), https://www.naturalearthdata.com
 *  - AWS Terrain Tiles, Terrarium encoding, zoom 4 (open data; Mapzen/AWS),
 *    https://registry.opendata.aws/terrain-tiles/
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { unzipSync } from "fflate";

const RAW = resolve(import.meta.dirname, "../../.cache/raw");
const NE = "https://naciscdn.org/naturalearth/10m";

const NATURAL_EARTH = [
  "cultural/ne_10m_admin_0_countries",
  "cultural/ne_10m_admin_0_disputed_areas",
  "cultural/ne_10m_admin_1_states_provinces",
  "cultural/ne_10m_populated_places",
  "cultural/ne_10m_roads",
  "physical/ne_10m_land",
  "physical/ne_10m_minor_islands",
  "physical/ne_10m_lakes",
  "physical/ne_10m_rivers_lake_centerlines",
  "physical/ne_10m_geography_regions_polys",
  "physical/ne_10m_geography_marine_polys",
  "physical/ne_10m_glaciated_areas",
];

const TERRAIN_ZOOM = 4;

async function download(url: string): Promise<Uint8Array> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "NewMillennium-map-pipeline/0.1" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    } catch (e) {
      if (attempt === 4) throw new Error(`${url}: ${(e as Error).message}`);
      await new Promise((res) => setTimeout(res, 2000 * attempt));
    }
  }
  throw new Error("unreachable");
}

async function fetchNaturalEarth(): Promise<number> {
  let bytes = 0;
  for (const path of NATURAL_EARTH) {
    const name = path.split("/")[1]!;
    const dir = join(RAW, name);
    if (existsSync(join(dir, ".complete"))) {
      console.log(`  skip ${name} (already downloaded)`);
      continue;
    }
    mkdirSync(dir, { recursive: true });
    const zip = await download(`${NE}/${path}.zip`);
    bytes += zip.length;
    writeFileSync(join(dir, `${name}.zip`), zip);
    const files = unzipSync(zip);
    for (const [fname, data] of Object.entries(files)) {
      if (fname.endsWith("/")) continue;
      const out = join(dir, fname.split("/").pop()!);
      writeFileSync(out, data);
    }
    writeFileSync(join(dir, ".complete"), new Date().toISOString());
    console.log(`  ${name}: ${(zip.length / 1048576).toFixed(1)} MB, ${Object.keys(files).length} files`);
  }
  return bytes;
}

async function fetchTerrain(): Promise<number> {
  const dir = join(RAW, `terrarium_z${TERRAIN_ZOOM}`);
  if (existsSync(join(dir, ".complete"))) {
    console.log(`  skip terrarium z${TERRAIN_ZOOM} (already downloaded)`);
    return 0;
  }
  const n = 2 ** TERRAIN_ZOOM;
  let bytes = 0;
  const jobs: Promise<void>[] = [];
  const queue: [number, number][] = [];
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) queue.push([x, y]);
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const [x, y] = job;
      const out = join(dir, `${x}`, `${y}.png`);
      if (existsSync(out)) continue;
      const png = await download(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${TERRAIN_ZOOM}/${x}/${y}.png`);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, png);
      bytes += png.length;
    }
  };
  for (let i = 0; i < 6; i++) jobs.push(worker());
  await Promise.all(jobs);
  writeFileSync(join(dir, ".complete"), new Date().toISOString());
  console.log(`  terrarium z${TERRAIN_ZOOM}: ${n * n} tiles, ${(bytes / 1048576).toFixed(1)} MB`);
  return bytes;
}

async function main() {
  mkdirSync(RAW, { recursive: true });
  console.log("Natural Earth 1:10m");
  const a = await fetchNaturalEarth();
  console.log("AWS terrain tiles");
  const b = await fetchTerrain();
  console.log(`done: ${((a + b) / 1048576).toFixed(1)} MB downloaded into ${RAW}`);
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
