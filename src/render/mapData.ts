/** Loads the map assets produced by scripts/map/build.ts from /map/. */

export interface Province {
  id: number;
  name: string;
  owner: string;
  controller: string;
  adm1: string[];
  centroid: [number, number];
  area_km2: number;
  population: number;
  terrain: string;
  elevation_m: number;
  ruggedness_m: number;
  infrastructure: number;
  coastal: boolean;
  lake_share: number;
  culture: string | null;
  resources: Record<string, number>;
}

export interface CountryLabel {
  tag: string;
  x: number;
  y: number;
  angle: number;
  extent: number;
  area: number;
}

export interface MapData {
  provinces: Province[]; // index = id - 1
  /** Province geometry in projected units (x = lon, y = Miller y). */
  positions: Float32Array;
  provinceOfVertex: Uint16Array;
  indices: Uint32Array;
  /** [x1, y1, x2, y2, type] per segment; type 0 province, 1 country, 2 coast. */
  borders: Float32Array;
  lakePositions: Float32Array;
  lakeIndices: Uint32Array;
  adjacency: [number, number, number][];
  /** Province pairs with a river along their border, and the river's name (public/map/rivers.json). */
  rivers: [number, number, string][];
  labels: CountryLabel[];
  grid: { width: number; height: number; yTop: number; yBottom: number };
  /** Province id per pixel of the id map (0 = sea). */
  idmap: Uint16Array;
  /** The id map as an image, for the GPU texture approach. */
  idImage: ImageBitmap;
  loadMs: number;
}

async function bin(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.arrayBuffer();
}
async function json<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

export async function loadMapData(base = "/map"): Promise<MapData> {
  const t0 = performance.now();
  const [geo, borders, lakes, provinces, adjacency, labels, meta, idBlob] = await Promise.all([
    bin(`${base}/geometry.bin`),
    bin(`${base}/borders.bin`),
    bin(`${base}/lakes.bin`),
    json<Province[]>(`${base}/provinces.json`),
    json<[number, number, number][]>(`${base}/adjacency.json`),
    json<CountryLabel[]>(`${base}/labels.json`),
    json<{ grid: MapData["grid"] }>(`${base}/meta.json`),
    fetch(`${base}/idmap.png`).then((r) => r.blob()),
  ]);
  const rivers = await fetch(`${base}/rivers.json`).then((r) => (r.ok ? r.json() as Promise<{ pairs: [number, number, string][] }> : { pairs: [] })).catch(() => ({ pairs: [] as [number, number, string][] }));

  const h = new Uint32Array(geo, 0, 3);
  if (h[0] !== 0x4e4d4731) throw new Error("geometry.bin: bad magic");
  const nv = h[1]!, ni = h[2]!;
  let off = 12;
  const positions = new Float32Array(geo, off, nv * 2);
  off += nv * 8;
  const provinceOfVertex = new Uint16Array(geo, off, nv);
  off += nv * 2 + ((nv * 2) % 4);
  const indices = new Uint32Array(geo, off, ni);

  const lh = new Uint32Array(lakes, 0, 3);
  const lakePositions = new Float32Array(lakes, 12, lh[1]! * 2);
  const lakeIndices = new Uint32Array(lakes, 12 + lh[1]! * 8, lh[2]!);

  // decode the id map: R = low byte, G = high byte (B marks lakes)
  const idImage = await createImageBitmap(idBlob, { premultiplyAlpha: "none", colorSpaceConversion: "none" });
  const canvas = new OffscreenCanvas(idImage.width, idImage.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(idImage, 0, 0);
  const px = ctx.getImageData(0, 0, idImage.width, idImage.height).data;
  const idmap = new Uint16Array(idImage.width * idImage.height);
  for (let i = 0; i < idmap.length; i++) idmap[i] = px[i * 4]! | (px[i * 4 + 1]! << 8);

  return {
    provinces, positions, provinceOfVertex, indices,
    borders: new Float32Array(borders), lakePositions, lakeIndices,
    adjacency, rivers: rivers.pairs, labels, grid: meta.grid, idmap, idImage,
    loadMs: performance.now() - t0,
  };
}

/** Province id under a projected world point (x = lon in [-180,180), y = Miller y), or 0 for sea. */
export function provinceAt(m: MapData, x: number, y: number): number {
  const scale = m.grid.width / 360;
  const px = Math.floor((x + 180) * scale);
  const py = Math.floor((m.grid.yTop - y) * scale);
  if (py < 0 || py >= m.grid.height || px < 0 || px >= m.grid.width) return 0;
  return m.idmap[py * m.grid.width + px]!;
}
