/** Geometry helpers for the map pipeline. Coordinates are [lon, lat] degrees unless stated. */
export type Ring = [number, number][];
export type Polygon = Ring[]; // outer ring first, then holes
export type MultiPolygon = Polygon[];

const R_KM = 6371.0088;
const D2R = Math.PI / 180;

/** Signed spherical area of a ring in km² (positive for counter-clockwise). */
export function ringAreaKm2(ring: Ring): number {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % n]!;
    a += (x2 - x1) * D2R * (2 + Math.sin(y1 * D2R) + Math.sin(y2 * D2R));
  }
  return (a * R_KM * R_KM) / 2;
}

export function areaKm2(mp: MultiPolygon): number {
  let a = 0;
  for (const poly of mp) {
    poly.forEach((ring, i) => {
      const r = Math.abs(ringAreaKm2(ring));
      a += i === 0 ? r : -r;
    });
  }
  return Math.max(0, a);
}

/** Area-weighted centroid in lon/lat (planar approximation, fine for provinces). */
export function centroid(mp: MultiPolygon): [number, number] {
  let ax = 0, ay = 0, aw = 0;
  for (const poly of mp) {
    const ring = poly[0]!;
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, n = ring.length; i < n; i++) {
      const [x1, y1] = ring[i]!;
      const [x2, y2] = ring[(i + 1) % n]!;
      const f = x1 * y2 - x2 * y1;
      a += f;
      cx += (x1 + x2) * f;
      cy += (y1 + y2) * f;
    }
    if (Math.abs(a) < 1e-12) continue;
    const w = Math.abs(a);
    ax += (cx / (3 * a)) * w;
    ay += (cy / (3 * a)) * w;
    aw += w;
  }
  if (aw === 0) {
    const [x, y] = mp[0]![0]![0]!;
    return [x, y];
  }
  return [ax / aw, ay / aw];
}

export function bbox(mp: MultiPolygon): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const poly of mp)
    for (const [x, y] of poly[0]!) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  return [x0, y0, x1, y1];
}

function pointInRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInMultiPolygon(x: number, y: number, mp: MultiPolygon): boolean {
  for (const poly of mp) {
    if (!pointInRing(x, y, poly[0]!)) continue;
    let inHole = false;
    for (let h = 1; h < poly.length; h++) if (pointInRing(x, y, poly[h]!)) inHole = true;
    if (!inHole) return true;
  }
  return false;
}

/** Normalise GeoJSON Polygon/MultiPolygon geometry to MultiPolygon. */
export function toMulti(g: { type: string; coordinates: unknown } | null): MultiPolygon {
  if (!g) return [];
  if (g.type === "Polygon") return [g.coordinates as Polygon];
  if (g.type === "MultiPolygon") return g.coordinates as MultiPolygon;
  return [];
}

/** Round coordinates so identical shared vertices hash identically. */
export function roundMP(mp: MultiPolygon, digits = 5): MultiPolygon {
  const f = 10 ** digits;
  return mp.map((poly) =>
    poly.map((ring) => {
      const out: Ring = [];
      for (const [x, y] of ring) {
        const p: [number, number] = [Math.round(x * f) / f, Math.round(y * f) / f];
        const last = out[out.length - 1];
        if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
      }
      return out;
    }),
  );
}

// ------------------------------------------------------------------ projection

/** Miller cylindrical y in "degree units" (same scale as longitude). */
export function millerY(lat: number): number {
  const phi = lat * D2R;
  return (1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * phi))) / D2R;
}
export function millerLat(y: number): number {
  return (2.5 * Math.atan(Math.exp((0.8 * y) * D2R)) - 0.625 * Math.PI) / D2R;
}
export const LAT_MIN = -58;
export const LAT_MAX = 84;
