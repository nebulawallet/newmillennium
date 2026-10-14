/**
 * Renderer benchmark (open the app with ?bench). Builds the map with each approach in turn and
 * measures: init time, synchronous frame time at four zoom levels (render + 1-pixel readback so
 * the GPU work is included), map-mode switch time, and an estimate of GPU memory.
 */
import type { ContentDB } from "../content/compile.ts";
import type { MapData } from "./mapData.ts";
import { MapView } from "./MapView.ts";
import { WorldMap, type RenderApproach } from "./WorldMap.ts";

export interface BenchResult {
  approach: RenderApproach;
  initMs: number;
  frameMs: Record<string, number>;
  modeSwitchMs: number;
  gpuMB: number;
}

const VIEWS: [string, number, number, number][] = [
  // name, x, y (Miller), view height
  ["world", 10, 30, 190],
  ["continent (Europe)", 15, 58, 45],
  ["country (Germany)", 10.5, 60, 9],
  ["max zoom (Ruhr)", 7.2, 59, 2],
];

function syncRender(view: MapView, n: number): number {
  const gl = view.renderer.getContext();
  const px = new Uint8Array(4);
  view.renderer.render(view.scene, view.camera);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    view.renderer.render(view.scene, view.camera);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  }
  return (performance.now() - t0) / n;
}

export async function runBenchmark(canvas: HTMLCanvasElement, map: MapData, db: ContentDB): Promise<BenchResult[]> {
  const results: BenchResult[] = [];
  for (const approach of ["mesh", "texture"] as RenderApproach[]) {
    const t0 = performance.now();
    const view = new MapView(canvas);
    const world = new WorldMap(view, map, db, approach);
    view.renderer.compile(view.scene, view.camera);
    view.renderer.render(view.scene, view.camera);
    const initMs = performance.now() - t0;
    await new Promise((r) => setTimeout(r, 500)); // let label SDFs generate
    const frameMs: Record<string, number> = {};
    for (const [name, x, y, h] of VIEWS) {
      view.lookAt(x, y, h);
      // apply per-frame updates (labels, border widths) without depending on rAF (throttled in background tabs)
      view.renderOnce();
      frameMs[name] = Math.round(syncRender(view, 40) * 100) / 100;
    }
    const m0 = performance.now();
    world.setMode("terrain");
    syncRender(view, 1);
    world.setMode("political");
    syncRender(view, 1);
    const modeSwitchMs = Math.round(((performance.now() - m0) / 2) * 100) / 100;
    results.push({ approach, initMs: Math.round(initMs), frameMs, modeSwitchMs, gpuMB: Math.round((world.gpuBytes() / 1048576) * 10) / 10 });
    view.dispose();
  }
  return results;
}
