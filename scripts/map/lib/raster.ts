/** Rasterisation onto the game's Miller-projected pixel grid. */
import { LAT_MAX, LAT_MIN, millerLat, millerY, type MultiPolygon } from "./geo.ts";

export class Grid {
  readonly width: number;
  readonly height: number;
  readonly yTop: number;
  readonly yBottom: number;
  /** pixels per degree of longitude (and per Miller y unit) */
  readonly scale: number;

  constructor(width: number) {
    this.width = width;
    this.scale = width / 360;
    this.yTop = millerY(LAT_MAX);
    this.yBottom = millerY(LAT_MIN);
    this.height = Math.round((this.yTop - this.yBottom) * this.scale);
  }

  /** lon/lat -> fractional pixel coordinates */
  toPx(lon: number, lat: number): [number, number] {
    return [(lon + 180) * this.scale, (this.yTop - millerY(Math.max(-89.9, Math.min(89.9, lat)))) * this.scale];
  }

  /** pixel centre -> lon/lat */
  toLonLat(px: number, py: number): [number, number] {
    const lon = (px + 0.5) / this.scale - 180;
    const lat = millerLat(this.yTop - (py + 0.5) / this.scale);
    return [lon, lat];
  }

  /**
   * Even-odd scanline fill of a multipolygon at pixel centres; calls set(index) per pixel.
   * Holes are handled by the even-odd rule across all rings of each polygon.
   */
  fill(mp: MultiPolygon, set: (i: number) => void): void {
    for (const poly of mp) {
      const edges: [number, number, number, number][] = [];
      let yMin = Infinity, yMax = -Infinity;
      for (const ring of poly) {
        for (let k = 0; k < ring.length; k++) {
          const a = this.toPx(ring[k]![0], ring[k]![1]);
          const b = this.toPx(ring[(k + 1) % ring.length]![0], ring[(k + 1) % ring.length]![1]);
          if (a[1] === b[1]) continue;
          edges.push([a[0], a[1], b[0], b[1]]);
          yMin = Math.min(yMin, a[1], b[1]);
          yMax = Math.max(yMax, a[1], b[1]);
        }
      }
      const r0 = Math.max(0, Math.ceil(yMin - 0.5));
      const r1 = Math.min(this.height - 1, Math.floor(yMax - 0.5));
      const xs: number[] = [];
      for (let row = r0; row <= r1; row++) {
        const y = row + 0.5;
        xs.length = 0;
        for (const [x0, y0, x1, y1] of edges) {
          if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const c0 = Math.max(0, Math.ceil(xs[k]! - 0.5));
          const c1 = Math.min(this.width - 1, Math.floor(xs[k + 1]! - 0.5));
          const base = row * this.width;
          for (let c = c0; c <= c1; c++) set(base + c);
        }
      }
    }
  }

  /** Mark pixels along a polyline (lon/lat points), DDA. */
  line(points: [number, number][], set: (i: number) => void): void {
    for (let k = 0; k + 1 < points.length; k++) {
      const [x0, y0] = this.toPx(points[k]![0], points[k]![1]);
      const [x1, y1] = this.toPx(points[k + 1]![0], points[k + 1]![1]);
      if (Math.abs(x1 - x0) > this.width / 2) continue; // antimeridian jump
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (let s = 0; s <= steps; s++) {
        const x = Math.floor(x0 + ((x1 - x0) * s) / steps);
        const y = Math.floor(y0 + ((y1 - y0) * s) / steps);
        if (x >= 0 && y >= 0 && x < this.width && y < this.height) set(y * this.width + x);
      }
    }
  }
}
