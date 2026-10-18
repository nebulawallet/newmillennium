/**
 * Country label anchors: one per owner, at the area-weighted centre of its most populous
 * connected block of provinces, with the block's principal axis as the text angle (clamped to
 * +-35 degrees) and its extent along that axis for the text size. Used by the map build
 * (labels.json for 1 January 2000) and in play whenever ownership changes.
 */
import { millerY } from "./MapView.ts";

export interface LabelProvince { id: number; centroid: [number, number]; area_km2: number; population: number }
export interface CountryLabelOut { tag: string; x: number; y: number; angle: number; extent: number; area: number }

export function countryLabels<P extends LabelProvince>(provinces: P[], neighbours: Map<number, number[]>, ownerOf: (p: P) => string | undefined): CountryLabelOut[] {
  const byId = new Map(provinces.map((p) => [p.id, p]));
  const owners = new Map<string, P[]>();
  for (const p of provinces) {
    const o = ownerOf(p);
    if (o) (owners.get(o) ?? owners.set(o, []).get(o)!).push(p);
  }
  const labels: CountryLabelOut[] = [];
  for (const [tag, list] of owners) {
    // connected components within the owner; the most populous block carries the label
    const seen = new Set<number>();
    let best: P[] = [];
    let bestScore = -1;
    for (const p of list) {
      if (seen.has(p.id)) continue;
      const comp: P[] = [];
      const stack = [p.id];
      seen.add(p.id);
      while (stack.length) {
        const id = stack.pop()!;
        comp.push(byId.get(id)!);
        for (const m of neighbours.get(id) ?? []) {
          const r = byId.get(m);
          if (r && ownerOf(r) === tag && !seen.has(m)) { seen.add(m); stack.push(m); }
        }
      }
      // most populous block (so Denmark is labelled on Denmark, not Greenland); area breaks ties
      const score = comp.reduce((s, q) => s + q.population, 0) + comp.reduce((s, q) => s + q.area_km2, 0) * 1e-3;
      if (score > bestScore) { bestScore = score; best = comp; }
    }
    // weighted centroid and PCA in projected space (x = lon, y = Miller y)
    let sw = 0, mx = 0, my = 0;
    const pts = best.map((q) => ({ x: q.centroid[0], y: millerY(q.centroid[1]), w: Math.max(1, q.area_km2) }));
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
