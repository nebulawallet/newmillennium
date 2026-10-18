/**
 * Country label anchors: one per owner, on its most populous connected block of provinces. The text
 * runs along the block's principal axis through its area-weighted centre, and its extent along that axis
 * sizes the text. With a point test (`fit`), the placement is checked against the real shape: a few angles
 * and centres are tried, the run of land through each is measured, and the largest text box that stays
 * on the country's own land wins, so long or bent countries (Norway, Chile, Myanmar) are not labelled
 * across their neighbours. Used by the map build (labels.json for 1 January 2000) and in play whenever
 * ownership changes.
 */
import { millerY } from "./MapView.ts";

export interface LabelProvince { id: number; centroid: [number, number]; area_km2: number; population: number }
export interface CountryLabelOut { tag: string; x: number; y: number; angle: number; extent: number; area: number }

/** Shape tests for fitting labels: who owns a world point (x = lon, y = Miller y), and each label's text length. */
export interface LabelFit {
  ownerAt: (x: number, y: number) => string | undefined;
  nameLength: (tag: string) => number;
}

/** Text proportions shared with Labels.ts: the text spans 70% of the extent; its height is the font size. */
const TEXT_SHARE = 0.7;
const fontSize = (extent: number, len: number) => (extent * TEXT_SHARE) / Math.max(4, len * 0.62);
const MAX_ANGLE = 1.05;

export function countryLabels<P extends LabelProvince>(provinces: P[], neighbours: Map<number, number[]>, ownerOf: (p: P) => string | undefined, fit?: LabelFit): CountryLabelOut[] {
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
    const pca = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const blockArea = best.reduce((s, q) => s + q.area_km2, 0);
    const span = (angle: number) => {
      const ux = Math.cos(angle), uy = Math.sin(angle);
      let lo = 0, hi = 0;
      for (const p of pts) { const t = (p.x - mx) * ux + (p.y - my) * uy; lo = Math.min(lo, t); hi = Math.max(hi, t); }
      return Math.max(hi - lo, Math.sqrt(blockArea) / 111);
    };
    let out = { x: mx, y: my, angle: clampAngle(pca), extent: span(clampAngle(pca)) };
    if (fit) out = fitted(tag, out, pts, pca, fit) ?? out;
    labels.push({ tag, x: round(out.x, 1000), y: round(out.y, 1000), angle: round(out.angle, 1000), extent: round(out.extent, 100), area: Math.round(blockArea) });
  }
  return labels;
}

const round = (v: number, k: number) => Math.round(v * k) / k;
const clampAngle = (a: number) => Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, a));

/** The best label line that stays on the country's land, or null when no candidate fits at all. */
function fitted(
  tag: string,
  start: { x: number; y: number; angle: number; extent: number },
  pts: { x: number; y: number; w: number }[],
  pca: number,
  fit: LabelFit,
): { x: number; y: number; angle: number; extent: number } | null {
  const len = fit.nameLength(tag);
  const mine = (x: number, y: number) => fit.ownerAt(x, y) === tag;
  const reach = start.extent * 1.2 + 1;
  const step = Math.max(0.02, reach / 120);
  // candidate centres: the weighted centre and the largest provinces of the block
  const centres = [{ x: start.x, y: start.y }, ...[...pts].sort((a, b) => b.w - a.w).slice(0, 4)];
  const angles = [...new Set([pca, pca + 0.3, pca - 0.3, 0, pca / 2].map((a) => round(clampAngle(a), 1000)))];
  let best: { x: number; y: number; angle: number; extent: number } | null = null, bestScore = 0;
  for (const c of centres) {
    if (!mine(c.x, c.y)) continue;
    for (const angle of angles) {
      const ux = Math.cos(angle), uy = Math.sin(angle);
      // the run of land through the centre along the angle (a short gap, such as a lake or a fjord, is crossed)
      const run = (dir: number) => {
        let t = 0, last = 0, misses = 0;
        while (t < reach) {
          t += step;
          if (mine(c.x + ux * t * dir, c.y + uy * t * dir)) { last = t; misses = 0; } else if (++misses > 2) break;
        }
        return last;
      };
      const a = run(-1), b = run(1);
      const extent = a + b;
      if (extent <= 0) continue;
      const cx = c.x + (ux * (b - a)) / 2, cy = c.y + (uy * (b - a)) / 2;
      // shrink until the text box (length 70% of the extent, height the font size) sits on the country's land
      for (let s = 1; s >= 0.35; s -= 0.13) {
        const e = extent * s, h = fontSize(e, len), half = (e * TEXT_SHARE) / 2;
        let inside = 0, total = 0;
        for (let i = -3; i <= 3; i++)
          for (const j of [-0.5, 0, 0.5]) {
            total++;
            const along = (half * i) / 3, across = h * j;
            if (mine(cx + ux * along - uy * across, cy + uy * along + ux * across)) inside++;
          }
        if (inside / total < 0.9) continue;
        // a bigger label wins; a level one is easier to read
        const score = h * (1 - 0.25 * Math.abs(angle));
        if (score > bestScore) { bestScore = score; best = { x: cx, y: cy, angle, extent: e }; }
        break;
      }
    }
  }
  return best;
}
