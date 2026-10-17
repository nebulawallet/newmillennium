/**
 * Dev: audits public/map/adjacency.json against the province id map and the border segments.
 *  - pixel adjacency recomputed from idmap.png (4-neighbour, with the wrap at 180°);
 *  - border segments (borders.bin) whose two sides are not listed as neighbours;
 *  - provinces with no land neighbour (islands are expected), and weak links (corner touches).
 *   npx tsx scripts/dev/adjacency-audit.ts [--write]
 * --write writes a corrected adjacency.json (pixel adjacency, at least `MIN_SHARED` shared edges).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { linkEnclaves, readEnclaves } from "../map/lib/enclaves.ts";

const MIN_SHARED = 2;
const provinces = JSON.parse(readFileSync("public/map/provinces.json", "utf8")) as { id: number; name: string; owner: string; population: number; centroid: [number, number] }[];
const adjacency = JSON.parse(readFileSync("public/map/adjacency.json", "utf8")) as [number, number, number][];
const meta = JSON.parse(readFileSync("public/map/meta.json", "utf8")) as { grid: { width: number; height: number; yTop: number } };
const png = PNG.sync.read(readFileSync("public/map/idmap.png"));
const W = png.width, H = png.height;
const id = new Uint16Array(W * H);
for (let i = 0; i < id.length; i++) id[i] = png.data[i * 4]! | (png.data[i * 4 + 1]! << 8);

const key = (a: number, b: number) => Math.min(a, b) * 65536 + Math.max(a, b);
const listed = new Map(adjacency.map(([a, b, n]) => [key(a, b), n]));
const pixel = new Map<number, number>();
const bump = (a: number, b: number) => { if (a && b && a !== b) pixel.set(key(a, b), (pixel.get(key(a, b)) ?? 0) + 1); };
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const a = id[y * W + x]!;
    if (!a) continue;
    bump(a, id[y * W + ((x + 1) % W)]!);
    if (y + 1 < H) bump(a, id[(y + 1) * W + x]!);
  }

const name = (p: number) => `${provinces[p - 1]?.name ?? p} (${provinces[p - 1]?.owner ?? "?"})`;
const missing = [...pixel].filter(([k, n]) => n >= MIN_SHARED && !listed.has(k));
const extra = [...listed.keys()].filter((k) => !pixel.has(k));
console.log(`provinces ${provinces.length}, listed pairs ${listed.size}, pixel pairs ${pixel.size} (${[...pixel.values()].filter((n) => n >= MIN_SHARED).length} with >= ${MIN_SHARED} shared edges)`);
console.log(`pixel neighbours missing from adjacency.json: ${missing.length}`);
for (const [k, n] of missing.slice(0, 15)) console.log(`  ${name(Math.floor(k / 65536))} - ${name(k % 65536)}: ${n} edges`);
console.log(`listed pairs with no shared pixel edge: ${extra.length}`);
for (const k of extra.slice(0, 15)) console.log(`  ${name(Math.floor(k / 65536))} - ${name(k % 65536)}`);

// border segments: both sides should be neighbours
const borders = new Float32Array(readFileSync("public/map/borders.bin").buffer.slice(0));
const scale = W / 360;
const at = (x: number, y: number) => {
  const px = Math.floor((x + 180) * scale), py = Math.floor((meta.grid.yTop - y) * scale);
  return py < 0 || py >= H ? 0 : id[py * W + ((px % W) + W) % W]!;
};
let segs = 0, segMissing = 0;
const segMissingPairs = new Map<number, number>();
const eps = (360 / W) * 1.3;
for (let i = 0; i < borders.length; i += 5) {
  if (borders[i + 4] === 2) continue;
  const x0 = borders[i]!, y0 = borders[i + 1]!, x1 = borders[i + 2]!, y1 = borders[i + 3]!;
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = (-(y1 - y0) / len) * eps, ny = ((x1 - x0) / len) * eps;
  const a = at((x0 + x1) / 2 + nx, (y0 + y1) / 2 + ny), b = at((x0 + x1) / 2 - nx, (y0 + y1) / 2 - ny);
  if (!a || !b || a === b) continue;
  segs++;
  if (!listed.has(key(a, b))) { segMissing++; segMissingPairs.set(key(a, b), (segMissingPairs.get(key(a, b)) ?? 0) + 1); }
}
console.log(`border segments sampled ${segs}; their pairs missing from adjacency.json: ${segMissingPairs.size} pairs (${segMissing} segments)`);
for (const [k, n] of [...segMissingPairs].sort((p, q) => q[1] - p[1]).slice(0, 15)) console.log(`  ${name(Math.floor(k / 65536))} - ${name(k % 65536)}: ${n} segments, ${pixel.get(k) ?? 0} pixel edges`);

const deg = new Map<number, number>();
for (const k of listed.keys()) { deg.set(Math.floor(k / 65536), (deg.get(Math.floor(k / 65536)) ?? 0) + 1); deg.set(k % 65536, (deg.get(k % 65536) ?? 0) + 1); }
const lonely = provinces.filter((p) => !deg.get(p.id));
console.log(`provinces with no land neighbour: ${lonely.length} (populated: ${lonely.filter((p) => p.population > 0).length})`);
const weak = [...listed].filter(([, n]) => n <= 3);
console.log(`weak links (<= 3 shared edges): ${weak.length}`);

if (process.argv.includes("--write")) {
  const out: [number, number, number][] = [];
  for (const [k, n] of pixel) if (n >= MIN_SHARED) out.push([Math.floor(k / 65536), k % 65536, n]);
  const miller = (lat: number) => (1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * (lat * Math.PI) / 180)) * 180) / Math.PI;
  const linked = linkEnclaves(out, provinces, readEnclaves(), (pid) => {
    const c = provinces[pid - 1]!.centroid;
    return [(c[0] + 180) * scale, (meta.grid.yTop - miller(c[1])) * scale];
  }, (x, y) => (y < 0 || y >= H ? 0 : id[y * W + ((x % W) + W) % W]!));
  console.log(`enclaves linked: ${linked.map((l) => `${name(l.id)} -> ${name(l.to)}`).join(", ")}`);
  out.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  writeFileSync("public/map/adjacency.json", JSON.stringify(out));
  console.log(`wrote ${out.length} pairs`);
}
