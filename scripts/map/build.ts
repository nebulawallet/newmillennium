/**
 * npm run build-map
 *
 * Map pipeline: Natural Earth admin-1 (2026 borders) -> provinces of 1 January 2000.
 *  1. simplify with shared topology (mapshaper)
 *  2. apply data/map/border_overrides_2000.json (owners, breakaway clips, controllers)
 *  3. merge tiny / split huge admin-1 units by population-aware target size
 *  4. rasterise a province-id map (Miller projection), derive adjacency, coast, borders
 *  5. attributes: terrain (elevation + Natural Earth regions), population (World Bank 2000),
 *     infrastructure (road density), culture (owner's primary culture unless overridden)
 *  6. write public/map/* (geometry.bin, borders.bin, idmap.png, provinces.json, adjacency.json, meta.json)
 *
 * Requires `npm run fetch-map` first. Manual corrections go in data/map/province_overrides.json.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import polygonClipping from "polygon-clipping";
import { Delaunay } from "d3-delaunay";
import earcut from "earcut";
import { PNG } from "pngjs";
import {
  areaKm2, bbox, centroid, LAT_MIN, millerY, pointInMultiPolygon, roundMP, toMulti,
  type MultiPolygon, type Ring,
} from "./lib/geo.ts";
import { Grid } from "./lib/raster.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const RAW = join(ROOT, ".cache/raw");
const WORK = join(ROOT, ".cache/work");
const OUT = join(ROOT, "public/map");
const DATA = join(ROOT, "data");
const SIMPLIFY = process.env.MAP_SIMPLIFY ?? "10%";
const GRID_W = Number(process.env.MAP_GRID_W ?? 8192);

const t0 = Date.now();
const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) as T;

// ------------------------------------------------------------------ 1. source layers

function mapshaper(args: string[]): void {
  const bin = join(ROOT, "node_modules/mapshaper/bin/mapshaper");
  execFileSync(process.execPath, [bin, ...args], { stdio: ["ignore", "ignore", "inherit"] });
}

function prepareSources(): void {
  mkdirSync(WORK, { recursive: true });
  const shp = (n: string) => join(RAW, n, `${n}.shp`);
  log(`simplifying admin-1 (${SIMPLIFY}, shared topology)`);
  mapshaper([
    shp("ne_10m_admin_1_states_provinces"), "-filter-fields", "adm1_code,adm0_a3,name,region,type_en",
    "-simplify", "visvalingam", SIMPLIFY, "keep-shapes", "-o", join(WORK, "admin1.json"), "format=geojson", "precision=0.00001",
  ]);
  mapshaper([
    shp("ne_10m_admin_0_disputed_areas"), "-filter", "TYPE === 'Breakaway'", "-filter-fields", "BRK_NAME",
    "-simplify", "visvalingam", SIMPLIFY, "keep-shapes", "-o", join(WORK, "breakaway.json"), "format=geojson", "precision=0.00001",
  ]);
  mapshaper([shp("ne_10m_populated_places"), "-filter-fields", "NAME,POP_MAX,ADM0_A3", "-o", join(WORK, "places.json"), "format=geojson"]);
  mapshaper([shp("ne_10m_geography_regions_polys"), "-filter", "['Desert','Range/mtn','Tundra','Wetlands','Plateau'].includes(FEATURECLA)",
    "-filter-fields", "FEATURECLA,NAME", "-simplify", "visvalingam", "20%", "-o", join(WORK, "georegions.json"), "format=geojson"]);
  mapshaper([shp("ne_10m_glaciated_areas"), "-simplify", "visvalingam", "20%", "-o", join(WORK, "glaciers.json"), "format=geojson"]);
  mapshaper([shp("ne_10m_roads"), "-filter-fields", "type", "-simplify", "visvalingam", "20%", "-o", join(WORK, "roads.json"), "format=geojson"]);
  mapshaper([shp("ne_10m_lakes"), "-filter", "scalerank <= 6", "-filter-fields", "name", "-simplify", "visvalingam", SIMPLIFY, "-o", join(WORK, "lakes.json"), "format=geojson", "precision=0.00001"]);
}

interface Feature<P> { properties: P; geometry: { type: string; coordinates: unknown } | null }
interface FC<P> { features: Feature<P>[] }

// ------------------------------------------------------------------ units

interface Unit {
  owner: string;
  controller: string;
  adm0: string;
  adm1: string[];
  name: string;
  region: string;
  geom: MultiPolygon;
  area: number;
  popWeight: number;
  pool: string; // population pool key
  split?: boolean;
}

const clip = polygonClipping as unknown as {
  union: (...g: MultiPolygon[]) => MultiPolygon;
  intersection: (...g: MultiPolygon[]) => MultiPolygon;
  difference: (a: MultiPolygon, ...b: MultiPolygon[]) => MultiPolygon;
};

function bboxOverlap(a: number[], b: number[]): boolean {
  return a[0]! <= b[2]! && b[0]! <= a[2]! && a[1]! <= b[3]! && b[1]! <= a[3]!;
}

/** Drop parts south of the map crop and tiny slivers. */
function cleanGeom(mp: MultiPolygon): MultiPolygon {
  return mp.filter((poly) => {
    const ring = poly[0]!;
    if (ring.length < 4) return false;
    const maxLat = Math.max(...ring.map((p) => p[1]));
    return maxLat > LAT_MIN && Math.abs(areaKm2([poly])) > 0.5;
  });
}

// ------------------------------------------------------------------ main

async function main(): Promise<void> {
  if (!existsSync(join(RAW, "ne_10m_admin_1_states_provinces/.complete"))) {
    throw new Error("map sources missing: run `npm run fetch-map` first");
  }
  if (!process.env.MAP_SKIP_PREPARE || !existsSync(join(WORK, "admin1.json"))) prepareSources();

  const countryList = readJson<{ countries: { tag: string; name: string }[] }>(join(DATA, "world/countries.json")).countries;
  const tags = new Set(countryList.map((c) => c.tag));
  const overrides = readJson<any>(join(DATA, "map/border_overrides_2000.json"));
  const popOverrides = readJson<any>(join(DATA, "map/population_overrides.json"));
  const wb = readJson<any>(join(DATA, "economy/worldbank_2000.json")).countries as Record<string, { population?: number }>;
  const provOverridesPath = join(DATA, "map/province_overrides.json");
  const provOverrides = existsSync(provOverridesPath) ? readJson<any>(provOverridesPath) : { provinces: {} };

  // ---- 2. units with 2000 owners
  const admin1 = readJson<FC<{ adm1_code: string; adm0_a3: string; name: string; region: string }>>(join(WORK, "admin1.json"));
  const adm1Owner = new Map<string, string>();
  for (const r of overrides.adm1_owner) for (const c of r.adm1) adm1Owner.set(c, r.owner);
  const dropped = new Set<string>(overrides.adm0_drop);
  const unmapped = new Map<string, number>();
  let units: Unit[] = [];
  for (const f of admin1.features) {
    const p = f.properties;
    if (dropped.has(p.adm0_a3)) continue;
    const owner = adm1Owner.get(p.adm1_code) ?? overrides.adm0_owner[p.adm0_a3] ?? p.adm0_a3;
    if (!tags.has(owner)) {
      unmapped.set(p.adm0_a3, (unmapped.get(p.adm0_a3) ?? 0) + 1);
      continue;
    }
    const geom = cleanGeom(roundMP(toMulti(f.geometry)));
    if (!geom.length) continue;
    const pool = { KOS: "XKX", SDS: "SSD", PSX: "PSE", SOL: "SOM", SAH: "SAH", CYN: "NCY", CNM: "CYP" }[p.adm0_a3] ?? p.adm0_a3;
    units.push({ owner, controller: owner, adm0: p.adm0_a3, adm1: [p.adm1_code], name: p.name || p.adm1_code, region: p.region ?? "", geom, area: areaKm2(geom), popWeight: 0, pool });
  }
  if (unmapped.size) throw new Error(`admin-1 units with no owner tag (add to adm0_owner or adm0_drop): ${[...unmapped].map(([k, n]) => `${k}(${n})`).join(" ")}`);
  log(`${units.length} admin-1 units mapped to ${new Set(units.map((u) => u.owner)).size} owners`);

  // breakaway clips
  const brk = readJson<FC<{ BRK_NAME: string }>>(join(WORK, "breakaway.json"));
  for (const rule of overrides.breakaway_clip as { brk_name: string; owner: string }[]) {
    const f = brk.features.find((x) => x.properties.BRK_NAME === rule.brk_name);
    if (!f) throw new Error(`breakaway '${rule.brk_name}' not found in Natural Earth`);
    const shape = roundMP(toMulti(f.geometry));
    const bb = bbox(shape);
    const next: Unit[] = [];
    let carved = 0;
    for (const u of units) {
      if (!bboxOverlap(bbox(u.geom), bb)) { next.push(u); continue; }
      const inside = cleanGeom(roundMP(clip.intersection(u.geom, shape)));
      const insideArea = areaKm2(inside);
      if (insideArea < 1) { next.push(u); continue; }
      const outside = cleanGeom(roundMP(clip.difference(u.geom, shape)));
      if (areaKm2(outside) > 1) next.push({ ...u, geom: outside, area: areaKm2(outside) });
      next.push({ ...u, owner: rule.owner, controller: rule.owner, geom: inside, area: insideArea, pool: rule.owner, adm1: [...u.adm1] });
      carved += insideArea;
    }
    units = next;
    log(`  breakaway ${rule.brk_name} -> ${rule.owner}: ${Math.round(carved)} km2`);
  }

  // start-of-game controllers
  for (const rule of overrides.controllers as { adm1?: string[]; adm0?: string[]; controller: string }[]) {
    if (!tags.has(rule.controller)) throw new Error(`controller tag ${rule.controller} not in country list`);
    for (const u of units)
      if (u.adm1.some((c) => rule.adm1?.includes(c)) || rule.adm0?.includes(u.adm0)) u.controller = rule.controller;
  }

  // ---- population weights from populated places
  const places = readJson<FC<{ NAME: string; POP_MAX: number; ADM0_A3: string }>>(join(WORK, "places.json")).features
    .filter((f) => f.geometry?.type === "Point")
    .map((f) => ({ name: f.properties.NAME, pop: f.properties.POP_MAX ?? 0, adm0: f.properties.ADM0_A3, x: (f.geometry!.coordinates as number[])[0]!, y: (f.geometry!.coordinates as number[])[1]! }));
  const placeOf = (u: Unit) => {
    const bb = bbox(u.geom);
    // a simplified border can put a neighbouring country's town inside the unit (e.g. Melilla)
    const foreign = new Set(["ESP", "GBR", "USA", "FRA", "NLD"]);
    return places.filter((p) => p.x >= bb[0] && p.x <= bb[2] && p.y >= bb[1] && p.y <= bb[3] &&
      !(p.adm0 !== u.adm0 && foreign.has(p.adm0)) && pointInMultiPolygon(p.x, p.y, u.geom));
  };
  const unitPlaces = new Map<Unit, typeof places>();
  for (const u of units) {
    const ps = placeOf(u);
    unitPlaces.set(u, ps);
    u.popWeight = ps.reduce((s, p) => s + Math.pow(Math.max(p.pop, 1000), 0.85), 0) + u.area * 2;
  }
  // population pools -> absolute population per unit
  const poolTotal = new Map<string, number>();
  for (const e of popOverrides.entities) poolTotal.set(e.tag, e.population);
  const poolWeight = new Map<string, number>();
  for (const u of units) poolWeight.set(u.pool, (poolWeight.get(u.pool) ?? 0) + u.popWeight);
  const missingPop = new Set<string>();
  const unitPop = (u: Unit) => {
    const total = poolTotal.get(u.pool) ?? wb[u.pool]?.population;
    if (total === undefined) { missingPop.add(u.pool); return u.area * 5; }
    return (total * u.popWeight) / poolWeight.get(u.pool)!;
  };
  const popOf = new Map<Unit, number>();
  for (const u of units) popOf.set(u, unitPop(u));
  if (missingPop.size) log(`  no population figure for pools (using 5/km2): ${[...missingPop].join(" ")}`);

  // ---- 3. shaping: merge tiny and split huge units
  const A0 = Number(process.env.MAP_TARGET_AREA ?? 46_000);
  const AEXP = Number(process.env.MAP_TARGET_EXP ?? -0.4);
  /** Target province area (km2) for a population density: dense regions get smaller provinces. */
  const targetArea = (density: number) => Math.min(350_000, Math.max(2_500, A0 * Math.pow(Math.max(density, 0.05) / 10, AEXP)));
  const ratio = (u: Unit) => u.area / targetArea((popOf.get(u) ?? 0) / Math.max(u.area, 1));

  // adjacency by shared rounded vertices
  function vertexKeys(u: Unit): Set<string> {
    const s = new Set<string>();
    for (const poly of u.geom) for (const ring of poly) for (const [x, y] of ring) s.add(`${x},${y}`);
    return s;
  }
  const byOwner = new Map<string, Unit[]>();
  for (const u of units) byOwner.set(u.owner, [...(byOwner.get(u.owner) ?? []), u]);

  let merges = 0;
  for (const [, list] of byOwner) {
    const keys = new Map<Unit, Set<string>>(list.map((u) => [u, vertexKeys(u)]));
    const neighbours = (u: Unit) => {
      const ku = keys.get(u)!;
      return list.filter((v) => {
        if (v === u || v.controller !== u.controller || v.adm0 !== u.adm0) return false;
        let shared = 0;
        for (const k of keys.get(v)!) if (ku.has(k) && ++shared >= 2) return true;
        return false;
      });
    };
    for (;;) {
      const candidates = list.filter((u) => ratio(u) < 0.35).sort((a, b) => ratio(a) - ratio(b));
      let merged = false;
      for (const u of candidates) {
        const ns = neighbours(u);
        if (!ns.length) continue;
        ns.sort((a, b) => (a.region === u.region ? 0 : 1) - (b.region === u.region ? 0 : 1) || a.area - b.area);
        const v = ns[0]!;
        const geom = cleanGeom(roundMP(clip.union(u.geom, v.geom)));
        const big = u.area >= v.area ? u : v;
        const m: Unit = {
          ...big, geom, area: areaKm2(geom), adm1: [...u.adm1, ...v.adm1],
          name: big.name,
          popWeight: u.popWeight + v.popWeight,
        };
        popOf.set(m, (popOf.get(u) ?? 0) + (popOf.get(v) ?? 0));
        unitPlaces.set(m, [...(unitPlaces.get(u) ?? []), ...(unitPlaces.get(v) ?? [])]);
        list.splice(list.indexOf(u), 1);
        list.splice(list.indexOf(v), 1);
        list.push(m);
        keys.set(m, vertexKeys(m));
        merges++;
        merged = true;
        break;
      }
      if (!merged) break;
    }
  }
  units = [...byOwner.values()].flat();
  log(`merged ${merges} times -> ${units.length} units`);

  let splits = 0;
  const finalUnits: Unit[] = [];
  for (const u of units) {
    const r = ratio(u);
    if (r <= 1.8) { finalUnits.push(u); continue; }
    const k = Math.min(30, Math.round(r));
    const pieces = splitUnit(u, k, unitPlaces.get(u) ?? []);
    const totalPop = popOf.get(u) ?? 0;
    const wsum = pieces.reduce((s, p) => s + p.popWeight, 0) || 1;
    for (const p of pieces) { popOf.set(p, (totalPop * p.popWeight) / wsum); finalUnits.push(p); }
    splits++;
  }
  log(`split ${splits} large units -> ${finalUnits.length} provinces`);

  // ---- order & ids
  finalUnits.sort((a, b) => (a.owner < b.owner ? -1 : a.owner > b.owner ? 1 : centroid(a.geom)[1] > centroid(b.geom)[1] ? -1 : 1));
  if (finalUnits.length > 65_000) throw new Error("too many provinces for 16-bit ids");

  // ---- 4. raster id map
  const grid = new Grid(GRID_W);
  const ids = new Uint16Array(grid.width * grid.height);
  finalUnits.forEach((u, i) => grid.fill(u.geom, (px) => (ids[px] = i + 1)));
  log(`rasterised ${grid.width}x${grid.height} id map`);

  const lakes = readJson<FC<{ name: string }>>(join(WORK, "lakes.json"));
  const lakeMask = new Uint8Array(ids.length);
  for (const f of lakes.features) grid.fill(roundMP(toMulti(f.geometry)), (px) => (lakeMask[px] = 1));

  // province pixel stats, adjacency, coast
  const n = finalUnits.length;
  const pixCount = new Uint32Array(n + 1);
  const coastal = new Uint8Array(n + 1);
  const adj = new Map<number, number>();
  const W = grid.width;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const a = ids[i]!;
      if (!a) continue;
      pixCount[a]!++;
      const right = ids[y * W + ((x + 1) % W)]!;
      const down = y + 1 < grid.height ? ids[i + W]! : a;
      for (const b of [right, down]) {
        if (b === a) continue;
        if (b === 0) { coastal[a] = 1; continue; }
        const key = a < b ? a * 65536 + b : b * 65536 + a;
        adj.set(key, (adj.get(key) ?? 0) + 1);
      }
      if (x > 0 && ids[i - 1] === 0) coastal[a] = 1;
      if (y > 0 && ids[i - W] === 0) coastal[a] = 1;
    }
  }

  // ---- 5. attributes
  const elev = loadElevation();
  const elevSum = new Float64Array(n + 1), elevSq = new Float64Array(n + 1), elevMax = new Float32Array(n + 1).fill(-1e9);
  const regionMask = new Uint8Array(ids.length); // 1 desert, 2 range/mtn, 3 tundra, 4 wetlands, 5 glacier, 6 plateau
  const geoRegions = readJson<FC<{ FEATURECLA: string }>>(join(WORK, "georegions.json"));
  const code: Record<string, number> = { Desert: 1, "Range/mtn": 2, Tundra: 3, Wetlands: 4, Plateau: 6 };
  for (const f of geoRegions.features) grid.fill(toMulti(f.geometry), (px) => { if (!regionMask[px]) regionMask[px] = code[f.properties.FEATURECLA] ?? 0; });
  for (const f of readJson<FC<unknown>>(join(WORK, "glaciers.json")).features) grid.fill(toMulti(f.geometry), (px) => (regionMask[px] = 5));
  const roadMask = new Uint8Array(ids.length);
  for (const f of readJson<FC<unknown>>(join(WORK, "roads.json")).features) {
    const g = f.geometry;
    if (!g) continue;
    const lines = g.type === "LineString" ? [g.coordinates as [number, number][]] : g.type === "MultiLineString" ? (g.coordinates as [number, number][][]) : [];
    for (const l of lines) grid.line(l, (px) => (roadMask[px] = 1));
  }
  const regionCount = Array.from({ length: 7 }, () => new Uint32Array(n + 1));
  const roadCount = new Uint32Array(n + 1);
  const lakeCount = new Uint32Array(n + 1);
  const latSum = new Float64Array(n + 1);
  for (let y = 0; y < grid.height; y++) {
    const [, lat] = grid.toLonLat(0, y);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const a = ids[i]!;
      if (!a) continue;
      const [lon] = grid.toLonLat(x, y);
      const e = Math.max(0, elev(lon, lat));
      elevSum[a] = elevSum[a]! + e; elevSq[a] = elevSq[a]! + e * e;
      if (e > elevMax[a]!) elevMax[a] = e;
      regionCount[regionMask[i]!]![a]!++;
      if (roadMask[i]) roadCount[a]!++;
      if (lakeMask[i]) lakeCount[a]!++;
      latSum[a] = latSum[a]! + lat;
    }
  }
  log("sampled elevation, terrain regions and roads");

  // countries' primary cultures where politics data exists
  const cultureOf = new Map<string, string>();
  for (const t of tags) {
    const p = join(DATA, "countries", t, "country.json");
    if (existsSync(p)) cultureOf.set(t, readJson<{ culture_primary: string }>(p).culture_primary);
  }

  // per-country GDP per capita for infrastructure scaling
  const gdppc = (u: Unit) => (wb[u.pool] as any)?.gdp_per_capita_usd ?? 2000;

  interface Province {
    id: number; name: string; owner: string; controller: string; adm1: string[];
    centroid: [number, number]; area_km2: number; population: number; terrain: string;
    elevation_m: number; ruggedness_m: number; infrastructure: number; coastal: boolean; lake_share: number;
    culture: string | null; resources: Record<string, number>;
  }
  const provinces: Province[] = finalUnits.map((u, i) => {
    const id = i + 1;
    const pc = Math.max(1, pixCount[id]!);
    const mean = elevSum[id]! / pc;
    const sd = Math.sqrt(Math.max(0, elevSq[id]! / pc - mean * mean));
    const lat = latSum[id]! / pc;
    const share = (k: number) => regionCount[k]![id]! / pc;
    const pop = Math.round(popOf.get(u) ?? 0);
    const density = pop / Math.max(u.area, 1);
    let terrain = "plains";
    if (share(5) > 0.5 || Math.abs(lat) > 68) terrain = "arctic";
    else if (mean > 1800 || (share(2) > 0.35 && sd > 350) || sd > 600) terrain = "mountains";
    else if (share(1) > 0.4) terrain = "desert";
    else if (share(4) > 0.4) terrain = "marsh";
    else if (density > 1500 && u.area < 5000) terrain = "urban";
    else if (sd > 220 || mean > 900 || share(6) > 0.5) terrain = "hills";
    else if (Math.abs(lat) < 12 && mean < 900) terrain = "jungle";
    else if (share(3) > 0.4 || (lat > 55 && lat <= 68)) terrain = "forest";
    // infrastructure 1-10: road pixel density scaled by wealth
    const roadDensity = roadCount[id]! / pc;
    const wealth = Math.min(1, Math.log10(Math.max(gdppc(u), 200)) / 4.6);
    const infrastructure = Math.max(1, Math.min(10, Math.round(1 + 9 * Math.min(1, roadDensity * 6) * (0.4 + 0.6 * wealth))));
    const c = centroid(u.geom);
    const base: Province = {
      id, name: u.name, owner: u.owner, controller: u.controller, adm1: u.adm1,
      centroid: [Math.round(c[0] * 1000) / 1000, Math.round(c[1] * 1000) / 1000],
      area_km2: Math.round(u.area), population: pop, terrain,
      elevation_m: Math.round(mean), ruggedness_m: Math.round(sd), infrastructure,
      coastal: coastal[id] === 1, lake_share: Math.round((lakeCount[id]! / pc) * 100) / 100,
      culture: cultureOf.get(u.owner) ?? null, resources: {},
    };
    // manual overrides keyed by the first admin-1 code (stable across rebuilds)
    const o = provOverrides.provinces?.[u.adm1[0]!];
    return o ? { ...base, ...o } : base;
  });

  // ---- unique names within each owner
  const seenNames = new Map<string, number>();
  for (const p of provinces) seenNames.set(`${p.owner}|${p.name}`, (seenNames.get(`${p.owner}|${p.name}`) ?? 0) + 1);
  const used = new Map<string, number>();
  const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  for (const p of provinces) {
    const key = `${p.owner}|${p.name}`;
    if ((seenNames.get(key) ?? 0) < 2) continue;
    const k = (used.get(key) ?? 0) + 1;
    used.set(key, k);
    p.name = `${p.name} ${roman[k] ?? k}`;
  }

  // ---- borders: classify each ring segment by the province on the other side (sampled in the id map)
  const borderData: number[] = [];
  const typeCount = [0, 0, 0];
  provinces.forEach((p, i) => {
    const u = finalUnits[i]!;
    for (const poly of u.geom) for (const ring of poly) {
      for (let k = 0; k + 1 < ring.length; k++) {
        const [x0, y0] = ring[k]!, [x1, y1] = ring[k + 1]!;
        if (Math.abs(x1 - x0) > 180) continue;
        // outward normal sample: polygons are counter-clockwise (outer) in GeoJSON from mapshaper? test both sides
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        const [px, py] = grid.toPx(mx, my);
        const [ax, ay] = grid.toPx(x0, y0), [bx, by] = grid.toPx(x1, y1);
        const len = Math.hypot(bx - ax, by - ay) || 1;
        const nx = -(by - ay) / len, ny = (bx - ax) / len;
        const sample = (s: number) => {
          const sx = Math.floor(px + nx * s), sy = Math.floor(py + ny * s);
          if (sy < 0 || sy >= grid.height) return 0;
          return ids[sy * W + ((sx % W) + W) % W]!;
        };
        const s1 = sample(1.2), s2 = sample(-1.2);
        const other = s1 === p.id ? s2 : s2 === p.id ? s1 : s1 !== 0 ? s1 : s2;
        if (other !== 0 && other < p.id) continue; // draw each shared border once
        const op = other ? provinces[other - 1]! : null;
        const type = !op ? 2 : op.owner !== p.owner ? 1 : 0; // 0 province, 1 country, 2 coast
        typeCount[type]!++;
        borderData.push(x0, millerY(y0), x1, millerY(y1), type);
      }
    }
  });
  log(`borders: ${typeCount[0]} province, ${typeCount[1]} country, ${typeCount[2]} coast segments`);

  // ---- 6. outputs
  mkdirSync(OUT, { recursive: true });
  writeGeometry(finalUnits);
  writeFileSync(join(OUT, "borders.bin"), Buffer.from(new Float32Array(borderData).buffer));
  writeIdPng(grid, ids);
  const adjacency: [number, number, number][] = [];
  for (const [key, count] of adj) if (count >= 2) adjacency.push([Math.floor(key / 65536), key % 65536, count]);
  writeFileSync(join(OUT, "adjacency.json"), JSON.stringify(adjacency));
  writeFileSync(join(OUT, "provinces.json"), JSON.stringify(provinces));
  writeFileSync(join(OUT, "labels.json"), JSON.stringify(countryLabels(provinces, adjacency)));
  ensureCountryColors(provinces, adjacency, countryList);
  writeLakes(lakes);
  const meta = {
    built: new Date().toISOString(), provinces: provinces.length, grid: { width: grid.width, height: grid.height, yTop: grid.yTop, yBottom: grid.yBottom },
    simplify: SIMPLIFY, sources: ["Natural Earth 1:10m (public domain)", "AWS Terrain Tiles z4", "World Bank WDI 2000 (CC BY 4.0)"],
  };
  writeFileSync(join(OUT, "meta.json"), JSON.stringify(meta, null, 1));

  // summary
  const byTag = new Map<string, number>();
  for (const p of provinces) byTag.set(p.owner, (byTag.get(p.owner) ?? 0) + 1);
  const top = [...byTag].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t, c]) => `${t}:${c}`).join(" ");
  const missingTags = [...tags].filter((t) => !byTag.has(t));
  const terrainCount = new Map<string, number>();
  for (const p of provinces) terrainCount.set(p.terrain, (terrainCount.get(p.terrain) ?? 0) + 1);
  log(`${provinces.length} provinces; most: ${top}`);
  log(`terrain: ${[...terrainCount].map(([k, v]) => `${k}:${v}`).join(" ")}`);
  log(`tags with no provinces (releasable/insurgent expected): ${missingTags.join(" ")}`);
  log(`world population: ${(provinces.reduce((s, p) => s + p.population, 0) / 1e9).toFixed(3)} bn`);

  // --------------------------------------------------------------- helpers using closure state
  function splitUnit(u: Unit, k: number, ps: { name: string; pop: number; adm0: string; x: number; y: number }[]): Unit[] {
    const [x0, y0, x1, y1] = bbox(u.geom);
    const lat0 = (y0 + y1) / 2;
    const cx = Math.cos((lat0 * Math.PI) / 180);
    // sample interior points
    const sample: [number, number][] = [];
    for (let tries = 0; sample.length < 1500 && tries < 60000; tries++) {
      const x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0);
      if (pointInMultiPolygon(x, y, u.geom)) sample.push([x * cx, y]);
    }
    if (sample.length < k * 3) return [u];
    // seeds: largest places with spacing, then fill from samples (k-means++)
    const minDist = Math.sqrt(((x1 - x0) * cx * (y1 - y0)) / k) * 0.45;
    const seeds: { p: [number, number]; name?: string }[] = [];
    for (const pl of [...ps].sort((a, b) => b.pop - a.pop)) {
      const p: [number, number] = [pl.x * cx, pl.y];
      if (seeds.every((s) => Math.hypot(s.p[0] - p[0], s.p[1] - p[1]) > minDist)) seeds.push({ p, name: pl.name });
      if (seeds.length >= k) break;
    }
    while (seeds.length < k) {
      let best = sample[0]!, bestD = -1;
      for (const s of sample) {
        const d = Math.min(...seeds.map((q) => Math.hypot(q.p[0] - s[0], q.p[1] - s[1])), Infinity);
        if (d > bestD) { bestD = d; best = s; }
      }
      seeds.push({ p: best });
    }
    // Lloyd relaxation (keeps names; moves seeds toward cell centroids of the sample)
    for (let it = 0; it < 4; it++) {
      const acc = seeds.map(() => [0, 0, 0]);
      for (const s of sample) {
        let bi = 0, bd = Infinity;
        seeds.forEach((q, i) => { const d = (q.p[0] - s[0]) ** 2 + (q.p[1] - s[1]) ** 2; if (d < bd) { bd = d; bi = i; } });
        acc[bi]![0]! += s[0]; acc[bi]![1]! += s[1]; acc[bi]![2]!++;
      }
      seeds.forEach((q, i) => { const a = acc[i]!; if (a[2]) q.p = [(q.p[0] + a[0]! / a[2]!) / 2, (q.p[1] + a[1]! / a[2]!) / 2]; });
    }
    const pad = 1;
    const del = Delaunay.from(seeds.map((s) => s.p));
    const vor = del.voronoi([x0 * cx - pad, y0 - pad, x1 * cx + pad, y1 + pad]);
    const out: Unit[] = [];
    seeds.forEach((s, i) => {
      const cell = vor.cellPolygon(i);
      if (!cell) return;
      const ring: Ring = cell.map(([x, y]) => [x / cx, y] as [number, number]);
      const piece = cleanGeom(roundMP(clip.intersection(u.geom, [[ring]])));
      const area = areaKm2(piece);
      if (area < 1) return;
      const inPiece = ps.filter((p) => pointInMultiPolygon(p.x, p.y, piece));
      const named = s.name ?? [...inPiece].sort((a, b) => b.pop - a.pop)[0]?.name;
      out.push({
        ...u, geom: piece, area, split: true,
        name: named ? `${named} (${u.name})` : `${u.name} ${compass(centroid(piece), centroid(u.geom))}`,
        popWeight: inPiece.reduce((sum, p) => sum + Math.pow(Math.max(p.pop, 1000), 0.85), 0) + area * 2,
      });
    });
    return out.length ? out : [u];
  }

  function writeGeometry(list: Unit[]): void {
    const pos: number[] = [];
    const prov: number[] = [];
    const idx: number[] = [];
    list.forEach((u, i) => {
      for (const poly of u.geom) {
        const flat: number[] = [];
        const holes: number[] = [];
        poly.forEach((ring, r) => {
          if (r > 0) holes.push(flat.length / 2);
          for (let k = 0; k < ring.length - 1; k++) flat.push(ring[k]![0], millerY(ring[k]![1]));
        });
        const tris = earcut(flat, holes, 2);
        const base = pos.length / 2;
        for (let k = 0; k < flat.length; k++) pos.push(flat[k]!);
        for (let k = 0; k < flat.length / 2; k++) prov.push(i + 1);
        for (const t of tris) idx.push(base + t);
      }
    });
    const nv = pos.length / 2;
    const header = new Uint32Array([0x4e4d4731 /* 'NMG1' */, nv, idx.length]);
    const buf = Buffer.concat([
      Buffer.from(header.buffer),
      Buffer.from(new Float32Array(pos).buffer),
      Buffer.from(new Uint16Array(prov).buffer),
      Buffer.alloc((nv * 2) % 4), // align
      Buffer.from(new Uint32Array(idx).buffer),
    ]);
    writeFileSync(join(OUT, "geometry.bin"), buf);
    log(`geometry: ${nv} vertices, ${idx.length / 3} triangles, ${(buf.length / 1048576).toFixed(1)} MB`);
  }

  function writeIdPng(g: Grid, idmap: Uint16Array): void {
    const png = new PNG({ width: g.width, height: g.height });
    for (let i = 0; i < idmap.length; i++) {
      const v = idmap[i]!;
      png.data[i * 4] = v & 255;
      png.data[i * 4 + 1] = v >> 8;
      png.data[i * 4 + 2] = lakeMask[i] ? 255 : 0;
      png.data[i * 4 + 3] = 255;
    }
    writeFileSync(join(OUT, "idmap.png"), PNG.sync.write(png, { colorType: 6 }));
    log(`idmap.png ${g.width}x${g.height}`);
  }

  function writeLakes(fc: FC<{ name: string }>): void {
    const pos: number[] = [];
    const idx: number[] = [];
    for (const f of fc.features) {
      for (const poly of roundMP(toMulti(f.geometry))) {
        const flat: number[] = [];
        const holes: number[] = [];
        poly.forEach((ring, r) => {
          if (r > 0) holes.push(flat.length / 2);
          for (let k = 0; k < ring.length - 1; k++) flat.push(ring[k]![0], millerY(ring[k]![1]));
        });
        const base = pos.length / 2;
        for (const t of earcut(flat, holes, 2)) idx.push(base + t);
        pos.push(...flat);
      }
    }
    const header = new Uint32Array([0x4e4d4c31 /* 'NML1' */, pos.length / 2, idx.length]);
    writeFileSync(join(OUT, "lakes.bin"), Buffer.concat([Buffer.from(header.buffer), Buffer.from(new Float32Array(pos).buffer), Buffer.from(new Uint32Array(idx).buffer)]));
  }
}

interface ProvLite { id: number; owner: string; centroid: [number, number]; area_km2: number; population: number }

/**
 * One label anchor per owner: the area-weighted centre of its most populous connected block of
 * provinces, with the block's principal axis as the text angle (clamped to +-35 degrees).
 */
function countryLabels(provinces: ProvLite[], adjacency: [number, number, number][]) {
  const nb = new Map<number, number[]>();
  for (const [a, b] of adjacency) {
    nb.set(a, [...(nb.get(a) ?? []), b]);
    nb.set(b, [...(nb.get(b) ?? []), a]);
  }
  const byId = new Map(provinces.map((p) => [p.id, p]));
  const owners = new Map<string, ProvLite[]>();
  for (const p of provinces) owners.set(p.owner, [...(owners.get(p.owner) ?? []), p]);
  const labels: { tag: string; x: number; y: number; angle: number; extent: number; area: number }[] = [];
  for (const [tag, list] of owners) {
    // connected components within the owner
    const seen = new Set<number>();
    let best: ProvLite[] = [];
    let bestArea = -1;
    for (const p of list) {
      if (seen.has(p.id)) continue;
      const comp: ProvLite[] = [];
      const stack = [p.id];
      seen.add(p.id);
      while (stack.length) {
        const id = stack.pop()!;
        const q = byId.get(id)!;
        comp.push(q);
        for (const m of nb.get(id) ?? []) {
          const r = byId.get(m);
          if (r && r.owner === tag && !seen.has(m)) { seen.add(m); stack.push(m); }
        }
      }
      // most populous block (so Denmark is labelled on Denmark, not Greenland); area breaks ties
      const score = comp.reduce((s, q) => s + q.population, 0) + comp.reduce((s, q) => s + q.area_km2, 0) * 1e-3;
      if (score > bestArea) { bestArea = score; best = comp; }
    }
    // weighted centroid and PCA in projected space (x = lon, y = Miller y)
    let sw = 0, mx = 0, my = 0;
    const pts = best.map((q) => ({ x: q.centroid[0], y: millerY(q.centroid[1]), w: q.area_km2 }));
    for (const p of pts) { sw += p.w; mx += p.x * p.w; my += p.y * p.w; }
    mx /= sw; my /= sw;
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of pts) { sxx += p.w * (p.x - mx) ** 2; syy += p.w * (p.y - my) ** 2; sxy += p.w * (p.x - mx) * (p.y - my); }
    let angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    angle = Math.max(-0.6, Math.min(0.6, angle));
    // extent along the axis: used to size the text
    const ux = Math.cos(angle), uy = Math.sin(angle);
    let lo = 0, hi = 0;
    for (const p of pts) { const t = (p.x - mx) * ux + (p.y - my) * uy; lo = Math.min(lo, t); hi = Math.max(hi, t); }
    const blockArea = best.reduce((s, q) => s + q.area_km2, 0);
    const extent = Math.max(hi - lo, Math.sqrt(blockArea) / 111);
    labels.push({ tag, x: Math.round(mx * 1000) / 1000, y: Math.round(my * 1000) / 1000, angle: Math.round(angle * 1000) / 1000, extent: Math.round(extent * 100) / 100, area: Math.round(blockArea) });
  }
  return labels;
}

/**
 * Give every country a default map colour (data/world/colors.json). Existing entries are kept,
 * so colours can be hand-edited; new tags get a hue that differs from their neighbours'.
 */
function ensureCountryColors(provinces: ProvLite[], adjacency: [number, number, number][], list: { tag: string }[]) {
  const path = join(DATA, "world/colors.json");
  const doc = existsSync(path) ? readJson<{ note?: string; colors: Record<string, string> }>(path) : { colors: {} as Record<string, string> };
  const owner = new Map(provinces.map((p) => [p.id, p.owner]));
  const neighbours = new Map<string, Set<string>>();
  for (const [a, b] of adjacency) {
    const oa = owner.get(a)!, ob = owner.get(b)!;
    if (oa === ob) continue;
    neighbours.set(oa, (neighbours.get(oa) ?? new Set()).add(ob));
    neighbours.set(ob, (neighbours.get(ob) ?? new Set()).add(oa));
  }
  const hueOf = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max === min) return 0;
    const d = max - min;
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return h * 60;
  };
  const hsl = (h: number, s: number, l: number) => {
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(c * 255).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };
  let added = 0;
  for (const { tag } of list) {
    if (doc.colors[tag]) continue;
    const used = [...(neighbours.get(tag) ?? [])].map((t) => doc.colors[t]).filter(Boolean).map((c) => hueOf(c!));
    let bestHue = 0, bestScore = -1;
    let seed = 0;
    for (const ch of tag) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    for (let k = 0; k < 36; k++) {
      const h = (seed % 360 + k * 47) % 360;
      const score = used.length ? Math.min(...used.map((u) => Math.min(Math.abs(u - h), 360 - Math.abs(u - h)))) : 180;
      if (score > bestScore) { bestScore = score; bestHue = h; }
    }
    const s = 0.35 + ((seed >> 8) % 20) / 100;
    const l = 0.42 + ((seed >> 4) % 14) / 100;
    doc.colors[tag] = hsl(bestHue, s, l);
    added++;
  }
  doc.note = "Default political-map colour per country tag. Edit freely; the map build only fills in missing tags.";
  writeFileSync(path, JSON.stringify({ note: doc.note, colors: doc.colors }, null, 1) + "\n");
  if (added) console.log(`  assigned ${added} new country colours (data/world/colors.json)`);
}

function compass(p: [number, number], c: [number, number]): string {
  const dx = p[0] - c[0], dy = p[1] - c[1];
  const a = (Math.atan2(dy, dx) * 180) / Math.PI;
  const dirs = ["East", "North-East", "North", "North-West", "West", "South-West", "South", "South-East"];
  return `(${dirs[Math.round(((a + 360) % 360) / 45) % 8]})`;
}

/** Elevation sampler over the Terrarium z4 mosaic (metres). */
function loadElevation(): (lon: number, lat: number) => number {
  const dir = join(RAW, "terrarium_z4");
  const Z = 16, T = 256, S = Z * T;
  const data = new Float32Array(S * S);
  for (const xs of readdirSync(dir)) {
    if (xs.startsWith(".")) continue;
    for (const f of readdirSync(join(dir, xs))) {
      const tx = Number(xs), ty = Number(f.replace(".png", ""));
      const png = PNG.sync.read(readFileSync(join(dir, xs, f)));
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const i = (y * T + x) * 4;
        data[(ty * T + y) * S + tx * T + x] = png.data[i]! * 256 + png.data[i + 1]! + png.data[i + 2]! / 256 - 32768;
      }
    }
  }
  return (lon, lat) => {
    const la = Math.max(-85.05, Math.min(85.05, lat)) * (Math.PI / 180);
    const x = Math.floor(((lon + 180) / 360) * S) % S;
    const y = Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * S);
    return data[Math.max(0, Math.min(S - 1, y)) * S + x]!;
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
