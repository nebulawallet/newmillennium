/**
 * The map scene: orthographic camera with pan/zoom over a flat world (Miller projection,
 * world width = 360 units, longitude wraps horizontally). Province rendering is added in
 * Phase 3 once the map pipeline produces province assets; until then this draws the ocean
 * and a graticule so camera controls can be exercised.
 */
import * as THREE from "three";

export const WORLD_W = 360;
/** Miller projection y for a latitude in degrees, scaled to match WORLD_W = 360 units. */
export function millerY(latDeg: number): number {
  const phi = (latDeg * Math.PI) / 180;
  return (1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * phi)) * 180) / Math.PI;
}
export const LAT_MIN = -58;
export const LAT_MAX = 84;

export class MapView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  /** World units visible vertically. Smaller = more zoomed in. */
  private viewHeight = 160;
  private center = new THREE.Vector2(10, millerY(25));
  private readonly minViewHeight = 2;
  private readonly maxViewHeight = millerY(LAT_MAX) - millerY(LAT_MIN);
  /** The world is drawn three times (x - W, x, x + W) for seamless wrap-around. */
  private readonly worldCopies = new THREE.Group();
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(new THREE.Color("#0b0e13"));
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    this.scene.add(this.worldCopies);
    this.buildBaseLayer();
    this.bindInput();
    this.resize();
    window.addEventListener("resize", this.resize);
    this.loop();
  }

  /** Add an object to every world copy (it is cloned for the wrapped copies). */
  addToWorld(obj: THREE.Object3D): void {
    for (let i = -1; i <= 1; i++) {
      const o = i === 0 ? obj : obj.clone();
      o.position.x += i * WORLD_W;
      this.worldCopies.add(o);
    }
  }

  private buildBaseLayer(): void {
    const yMin = millerY(LAT_MIN);
    const yMax = millerY(LAT_MAX);
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_W, yMax - yMin),
      new THREE.MeshBasicMaterial({ color: new THREE.Color("#0e1a26") }),
    );
    ocean.position.set(0, (yMin + yMax) / 2, -1);
    this.addToWorld(ocean);

    const pts: number[] = [];
    for (let lon = -180; lon <= 180; lon += 15) pts.push(lon, yMin, 0, lon, yMax, 0);
    for (let lat = -45; lat <= 75; lat += 15) {
      const y = millerY(lat);
      pts.push(-180, y, 0, 180, y, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const grid = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: "#1d2c3c" }));
    grid.position.z = -0.5;
    this.addToWorld(grid);
  }

  /** Convert a client (pixel) position to world coordinates. */
  screenToWorld(clientX: number, clientY: number): THREE.Vector2 {
    const r = this.canvas.getBoundingClientRect();
    const nx = ((clientX - r.left) / r.width) * 2 - 1;
    const ny = -(((clientY - r.top) / r.height) * 2 - 1);
    const aspect = r.width / r.height;
    return new THREE.Vector2(this.center.x + (nx * this.viewHeight * aspect) / 2, this.center.y + (ny * this.viewHeight) / 2);
  }

  /** World x wrapped into [-180, 180). */
  static wrapX(x: number): number {
    return ((((x + 180) % WORLD_W) + WORLD_W) % WORLD_W) - 180;
  }

  get zoom(): number {
    return this.maxViewHeight / this.viewHeight;
  }

  private bindInput(): void {
    let dragging = false;
    let last = { x: 0, y: 0 };
    this.canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
      dragging = true;
      last = { x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const r = this.canvas.getBoundingClientRect();
      const perPx = this.viewHeight / r.height;
      this.center.x -= (e.clientX - last.x) * perPx;
      this.center.y += (e.clientY - last.y) * perPx;
      last = { x: e.clientX, y: e.clientY };
      this.clampCenter();
    });
    const stop = (e: PointerEvent) => {
      dragging = false;
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    };
    this.canvas.addEventListener("pointerup", stop);
    this.canvas.addEventListener("pointercancel", stop);
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const before = this.screenToWorld(e.clientX, e.clientY);
        const factor = Math.exp(e.deltaY * 0.0015);
        this.viewHeight = THREE.MathUtils.clamp(this.viewHeight * factor, this.minViewHeight, this.maxViewHeight);
        const after = this.screenToWorld(e.clientX, e.clientY);
        // keep the point under the cursor fixed while zooming
        this.center.x += before.x - after.x;
        this.center.y += before.y - after.y;
        this.clampCenter();
      },
      { passive: false },
    );
  }

  private clampCenter(): void {
    this.center.x = MapView.wrapX(this.center.x);
    const half = this.viewHeight / 2;
    const yMin = millerY(LAT_MIN) + half;
    const yMax = millerY(LAT_MAX) - half;
    this.center.y = yMin > yMax ? (yMin + yMax) / 2 : THREE.MathUtils.clamp(this.center.y, yMin, yMax);
  }

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
  };

  private updateCamera(): void {
    const r = this.canvas.getBoundingClientRect();
    const aspect = r.width / Math.max(1, r.height);
    const halfH = this.viewHeight / 2;
    const halfW = halfH * aspect;
    this.camera.left = this.center.x - halfW;
    this.camera.right = this.center.x + halfW;
    this.camera.top = this.center.y + halfH;
    this.camera.bottom = this.center.y - halfH;
    this.camera.updateProjectionMatrix();
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  };

  dispose(): void {
    this.disposed = true;
    window.removeEventListener("resize", this.resize);
    this.renderer.dispose();
  }
}
