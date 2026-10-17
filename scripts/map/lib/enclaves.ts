/**
 * Land enclaves smaller than a pixel of the id map (Macau, Gibraltar, Melilla, the Vatican) own no
 * pixel and touch no neighbour in the raster, so units could never enter or leave them. The
 * enclaves listed in data/map/adjacency_overrides.json are linked to the nearest land province
 * around their centroid (the first ring of pixels, up to `maxRadius`, that contains land).
 */
import { readFileSync } from "node:fs";

export interface EnclaveList { enclaves: { province: string; owner: string; why: string }[] }

export function readEnclaves(path = "data/map/adjacency_overrides.json"): EnclaveList {
  return JSON.parse(readFileSync(path, "utf8")) as EnclaveList;
}

export function linkEnclaves(
  adjacency: [number, number, number][],
  provinces: { id: number; name: string; owner: string }[],
  list: EnclaveList,
  centroidPx: (id: number) => [number, number],
  idAtPx: (x: number, y: number) => number,
  maxRadius = 4,
): { id: number; to: number }[] {
  const added: { id: number; to: number }[] = [];
  for (const e of list.enclaves) {
    const p = provinces.find((q) => q.name === e.province && q.owner === e.owner);
    if (!p) throw new Error(`adjacency_overrides: no province '${e.province}' of ${e.owner}`);
    if (adjacency.some(([a, b]) => a === p.id || b === p.id)) continue;
    const [fx, fy] = centroidPx(p.id);
    const cx = Math.floor(fx), cy = Math.floor(fy);
    for (let r = 0; r <= maxRadius; r++) {
      const count = new Map<number, number>();
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const q = idAtPx(cx + dx, cy + dy);
          if (q && q !== p.id) count.set(q, (count.get(q) ?? 0) + 1);
        }
      if (!count.size) continue;
      const to = [...count].sort((a, b) => b[1] - a[1])[0]![0];
      adjacency.push([Math.min(p.id, to), Math.max(p.id, to), 2]);
      added.push({ id: p.id, to });
      break;
    }
  }
  return added;
}
