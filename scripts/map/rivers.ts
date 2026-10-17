/**
 * Rivers on province borders, for river-crossing penalties in combat.
 *
 * Reads Natural Earth 1:10m rivers (public domain; .cache/raw/ne_10m_rivers_lake_centerlines,
 * downloaded by npm run fetch-map) and the built map (public/map: borders.bin, idmap.png,
 * provinces.json). A pair of neighbouring provinces has a river border when at least
 * `MIN_SHARE` of their shared border length lies within `TOLERANCE` degrees of a river line.
 * Writes public/map/rivers.json. Runs on the built map, so it never renumbers provinces.
 *
 *   npx tsx scripts/map/rivers.ts [path to .cache/raw]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";

const RAW = process.argv[2] ?? ".cache/raw";
const MAX_SCALERANK = 7;
const TOLERANCE = 0.14; // degrees (about 15 km at mid latitudes)
const MIN_SHARE = 0.35;
const MIN_LENGTH = 0.3; // degrees of shared border (slivers and corner touches do not count)

const millerY = (lat: number) => (1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * ((lat * Math.PI) / 180))) * 180) / Math.PI;

// ---- rivers as segments in map coordinates (x = lon, y = Miller y)
const geo = join(tmpdir(), "nm-rivers.json");
execFileSync("npx", ["mapshaper", join(RAW, "ne_10m_rivers_lake_centerlines", "ne_10m_rivers_lake_centerlines.shp"), "-filter-fields", "scalerank,name,featurecla", "-o", geo, "format=geojson"], { stdio: "inherit", shell: true });
const fc = JSON.parse(readFileSync(geo, "utf8")) as { features: { properties: { scalerank: number; name: string | null; featurecla: string }; geometry: { type: string; coordinates: number[][] | number[][][] } }[] };
type Seg = { x0: number; y0: number; x1: number; y1: number; name: string };
const segs: Seg[] = [];
for (const f of fc.features) {
  const p = f.properties;
  if (!p.featurecla.startsWith("River") || p.scalerank > MAX_SCALERANK) continue;
  const lines = (f.geometry.type === "MultiLineString" ? f.geometry.coordinates : [f.geometry.coordinates]) as number[][][];
  for (const line of lines)
    for (let i = 0; i + 1 < line.length; i++) {
      const [a, b] = [line[i]!, line[i + 1]!];
      segs.push({ x0: a[0]!, y0: millerY(a[1]!), x1: b[0]!, y1: millerY(b[1]!), name: p.name ?? "" });
    }
}
// spatial hash: 0.5-degree cells
const CELL = 0.5;
const grid = new Map<string, number[]>();
segs.forEach((s, i) => {
  const minx = Math.floor((Math.min(s.x0, s.x1) - TOLERANCE) / CELL), maxx = Math.floor((Math.max(s.x0, s.x1) + TOLERANCE) / CELL);
  const miny = Math.floor((Math.min(s.y0, s.y1) - TOLERANCE) / CELL), maxy = Math.floor((Math.max(s.y0, s.y1) + TOLERANCE) / CELL);
  for (let x = minx; x <= maxx; x++) for (let y = miny; y <= maxy; y++) (grid.get(`${x},${y}`) ?? grid.set(`${x},${y}`, []).get(`${x},${y}`)!).push(i);
});
const distToSeg = (px: number, py: number, s: Seg) => {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0, l2 = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, ((px - s.x0) * dx + (py - s.y0) * dy) / l2));
  return Math.hypot(px - (s.x0 + t * dx), py - (s.y0 + t * dy));
};
/** The nearest river within the tolerance (its name), or null. */
const nearRiver = (x: number, y: number): string | null => {
  let best: Seg | null = null, bd = TOLERANCE;
  for (const i of grid.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`) ?? []) {
    const d = distToSeg(x, y, segs[i]!);
    if (d <= bd) { bd = d; best = segs[i]!; }
  }
  return best ? best.name || "a river" : null;
};

// ---- border segments by province pair (sampled on both sides in the id map)
const meta = JSON.parse(readFileSync("public/map/meta.json", "utf8")) as { grid: { width: number; yTop: number } };
const png = PNG.sync.read(readFileSync("public/map/idmap.png"));
const W = png.width, H = png.height, scale = W / 360;
const at = (x: number, y: number) => {
  const px = Math.floor((x + 180) * scale), py = Math.floor((meta.grid.yTop - y) * scale);
  if (py < 0 || py >= H) return 0;
  const i = py * W + (((px % W) + W) % W);
  return png.data[i * 4]! | (png.data[i * 4 + 1]! << 8);
};
const borders = new Float32Array(readFileSync("public/map/borders.bin").buffer.slice(0));
const eps = (360 / W) * 1.3;
const total = new Map<number, number>(), wet = new Map<number, number>(), names = new Map<number, Map<string, number>>();
for (let i = 0; i < borders.length; i += 5) {
  if (borders[i + 4] === 2) continue;
  const x0 = borders[i]!, y0 = borders[i + 1]!, x1 = borders[i + 2]!, y1 = borders[i + 3]!;
  const len = Math.hypot(x1 - x0, y1 - y0) || 1e-9;
  const nx = (-(y1 - y0) / len) * eps, ny = ((x1 - x0) / len) * eps;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const a = at(mx + nx, my + ny), b = at(mx - nx, my - ny);
  if (!a || !b || a === b) continue;
  const key = Math.min(a, b) * 65536 + Math.max(a, b);
  total.set(key, (total.get(key) ?? 0) + len);
  const r = nearRiver(mx, my);
  if (r) {
    wet.set(key, (wet.get(key) ?? 0) + len);
    const m = names.get(key) ?? names.set(key, new Map()).get(key)!;
    m.set(r, (m.get(r) ?? 0) + len);
  }
}

const provinces = JSON.parse(readFileSync("public/map/provinces.json", "utf8")) as { id: number; name: string; owner: string }[];
const adjacent = new Set((JSON.parse(readFileSync("public/map/adjacency.json", "utf8")) as [number, number, number][]).map(([a, b]) => Math.min(a, b) * 65536 + Math.max(a, b)));
const pairs: [number, number, string][] = [];
for (const [key, t] of total) {
  const w = wet.get(key) ?? 0;
  if (!adjacent.has(key) || t < MIN_LENGTH || w / t < MIN_SHARE) continue;
  const river = [...names.get(key)!].sort((p, q) => q[1] - p[1])[0]![0];
  pairs.push([Math.floor(key / 65536), key % 65536, river]);
}
pairs.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
writeFileSync("public/map/rivers.json", JSON.stringify({
  source: "Natural Earth 1:10m rivers and lake centerlines (public domain), https://www.naturalearthdata.com; rivers of scalerank <= 7 along at least 35% of a shared border of at least 0.3 degrees between neighbouring provinces",
  pairs,
}));
console.log(`${segs.length} river segments; ${pairs.length} province pairs with a river border`);
const show = (n: string) => pairs.filter((p) => p[2] === n).slice(0, 6).map((p) => `${provinces[p[0] - 1]?.name} (${provinces[p[0] - 1]?.owner}) | ${provinces[p[1] - 1]?.name} (${provinces[p[1] - 1]?.owner})`).join("; ");
for (const n of ["Dnipro", "Dnieper", "Euphrates", "Tigris", "Rhine", "Danube", "Oder", "Odra", "Amu Darya", "Jordan"]) { const s = show(n); if (s) console.log(`  ${n}: ${s}`); }
