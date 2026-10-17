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
  /** The world is drawn three times (x - W, x, x + W) for seamless wrap-around; copies off screen are hidden. */
  private readonly worldCopies = new THREE.Group();
  private readonly copyGroups = [-1, 0, 1].map((i) => {
    const g = new THREE.Group();
    g.position.x = i * WORLD_W;
    g.userData.offset = i * WORLD_W;
    return g;
  });
  private disposed = false;
  /** Called every frame before rendering. */
  readonly onFrame: ((v: { worldPerPx: number; zoom: number; centerX: number }) => void)[] = [];
  /** Pointer hover over the map (world coordinates, x wrapped to [-180,180)). */
  readonly onHover: ((x: number, y: number, e: PointerEvent) => void)[] = [];
  /** Click (pointer released without dragging). */
  readonly onClick: ((x: number, y: number, e: PointerEvent) => void)[] = [];
  /**
   * Drawing tools (battle plans): while set, a left drag goes to this handler instead of panning.
   * Coordinates are world x (wrapped) and y.
   */
  capture: ((phase: "down" | "move" | "up", x: number, y: number, e: PointerEvent) => void) | null = null;
  /** Right-click without dragging (orders). */
  readonly onRightClick: ((x: number, y: number, e: PointerEvent) => void)[] = [];
  /** Frame-time samples for the benchmark (ms). */
  readonly frameTimes: number[] = [];
  private lastFrame = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private showGraticule = false,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(new THREE.Color("#0f1a1d"));
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    this.scene.add(this.worldCopies);
    for (const g of this.copyGroups) this.worldCopies.add(g);
    this.buildBaseLayer();
    this.bindInput();
    this.resize();
    window.addEventListener("resize", this.resize);
    this.loop();
  }

  /** Add an object to every world copy (it is cloned for the wrapped copies). */
  addToWorld(obj: THREE.Object3D): void {
    this.copyGroups.forEach((g, i) => g.add(i === 1 ? obj : obj.clone()));
  }

  private buildBaseLayer(): void {
    const yMin = millerY(LAT_MIN);
    const yMax = millerY(LAT_MAX);
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_W, yMax - yMin),
      new THREE.MeshBasicMaterial({ color: new THREE.Color("#1a3038") }),
    );
    ocean.position.set(0, (yMin + yMax) / 2, -1);
    this.addToWorld(ocean);
    if (!this.showGraticule) return;

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

  /** Convert world coordinates to client (pixel) coordinates, using the world copy nearest the camera. */
  worldToScreen(x: number, y: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const aspect = r.width / r.height;
    const wx = x + WORLD_W * Math.round((this.center.x - x) / WORLD_W);
    return {
      x: r.left + ((wx - this.center.x) / ((this.viewHeight * aspect) / 2) + 1) * (r.width / 2),
      y: r.top + (1 - (y - this.center.y) / (this.viewHeight / 2)) * (r.height / 2),
    };
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
    let downAt = { x: 0, y: 0 };
    let moved = 0;
    let capturing = false;
    this.canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
      if (this.capture && e.button === 0) {
        capturing = true;
        const w = this.screenToWorld(e.clientX, e.clientY);
        this.capture("down", MapView.wrapX(w.x), w.y, e);
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }
      dragging = true;
      moved = 0;
      last = { x: e.clientX, y: e.clientY };
      downAt = { ...last };
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (capturing && this.capture) {
        const w = this.screenToWorld(e.clientX, e.clientY);
        this.capture("move", MapView.wrapX(w.x), w.y, e);
        return;
      }
      if (!dragging) {
        const w = this.screenToWorld(e.clientX, e.clientY);
        for (const f of this.onHover) f(MapView.wrapX(w.x), w.y, e);
        return;
      }
      moved = Math.max(moved, Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y));
      const r = this.canvas.getBoundingClientRect();
      const perPx = this.viewHeight / r.height;
      this.center.x -= (e.clientX - last.x) * perPx;
      this.center.y += (e.clientY - last.y) * perPx;
      last = { x: e.clientX, y: e.clientY };
      this.clampCenter();
    });
    const stop = (e: PointerEvent) => {
      if (capturing) {
        capturing = false;
        const w = this.screenToWorld(e.clientX, e.clientY);
        this.capture?.("up", MapView.wrapX(w.x), w.y, e);
        if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
        return;
      }
      if (dragging && moved < 4 && e.type === "pointerup" && e.button === 0) {
        const w = this.screenToWorld(e.clientX, e.clientY);
        for (const f of this.onClick) f(MapView.wrapX(w.x), w.y, e);
      }
      if (dragging && moved < 4 && e.type === "pointerup" && e.button === 2) {
        const w = this.screenToWorld(e.clientX, e.clientY);
        for (const f of this.onRightClick) f(MapView.wrapX(w.x), w.y, e);
      }
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
    for (const g of this.copyGroups) {
      const off = g.userData.offset as number;
      g.visible = this.camera.right > off - 180 && this.camera.left < off + 180;
    }
  }

  /** World units per CSS pixel at the current zoom. */
  get worldPerPx(): number {
    return this.viewHeight / Math.max(1, this.canvas.getBoundingClientRect().height);
  }

  get centerX(): number {
    return this.center.x;
  }

  /** Move the camera (used by the benchmark and by "go to" actions). */
  lookAt(x: number, y: number, viewHeight?: number): void {
    this.center.set(x, y);
    if (viewHeight !== undefined) this.viewHeight = THREE.MathUtils.clamp(viewHeight, this.minViewHeight, this.maxViewHeight);
    this.clampCenter();
  }

  /** Render one frame immediately (frame hooks included), e.g. when the page is in the background. */
  renderOnce(): void {
    this.updateCamera();
    const info = { worldPerPx: this.worldPerPx, zoom: this.zoom, centerX: this.center.x };
    for (const f of this.onFrame) f(info);
    this.renderer.render(this.scene, this.camera);
  }

  private loop = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    if (this.lastFrame) {
      this.frameTimes.push(now - this.lastFrame);
      if (this.frameTimes.length > 600) this.frameTimes.shift();
    }
    this.lastFrame = now;
    this.updateCamera();
    const info = { worldPerPx: this.worldPerPx, zoom: this.zoom, centerX: this.center.x };
    for (const f of this.onFrame) f(info);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  };

  dispose(): void {
    this.disposed = true;
    window.removeEventListener("resize", this.resize);
    this.renderer.dispose();
  }
}
