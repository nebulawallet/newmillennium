import * as THREE from "three";
import type { ContentDB } from "../content/compile.ts";
import { Borders } from "./layers/Borders.ts";
import { createLakes } from "./layers/Lakes.ts";
import { Labels } from "./layers/Labels.ts";
import { ProvinceColors } from "./layers/ProvinceColors.ts";
import { ProvinceMesh } from "./layers/ProvinceMesh.ts";
import { ProvinceTexture } from "./layers/ProvinceTexture.ts";
import { MAP_MODES, type MapModeContext } from "./mapModes.ts";
import { countryLabels } from "./countryLabels.ts";
import { provinceAt, type MapData } from "./mapData.ts";
import { millerY, type MapView } from "./MapView.ts";
import type { GameState } from "../sim/state.ts";
import { countryShortName } from "../sim/politics/unrest.ts";

export type RenderApproach = "mesh" | "texture";

/**
 * The world map: province fill (mesh or id-texture approach), borders, lakes and labels,
 * plus map modes, hover and selection. UI talks to it through the callbacks below.
 */
export class WorldMap {
  readonly colors = new ProvinceColors();
  private fill: ProvinceMesh | ProvinceTexture;
  private borders: Borders | null = null;
  private labels: Labels;
  private hovered = 0;
  private selected = 0;
  mode = "political";
  /** Live game state for map modes (ownership, governments, results); null on the start screen. */
  state: GameState | null = null;
  onHoverChange: (id: number) => void = () => {};
  /** Province id at a world point (0 = sea). */
  pickAt: (x: number, y: number) => number = () => 0;
  onSelectChange: (id: number) => void = () => {};
  /** Right-click on a province (orders). */
  onOrder: (id: number) => void = () => {};

  constructor(
    readonly view: MapView,
    readonly map: MapData,
    readonly db: ContentDB,
    readonly approach: RenderApproach = "mesh",
  ) {
    // owner indices for the texture approach's country-border detection
    const ownerIndex = new Map<string, number>();
    for (const p of map.provinces) {
      if (!ownerIndex.has(p.owner)) ownerIndex.set(p.owner, ownerIndex.size + 1);
      this.colors.setOwnerIndex(p.id, ownerIndex.get(p.owner)!);
    }

    this.fill = approach === "mesh" ? new ProvinceMesh(map, this.colors) : new ProvinceTexture(map, this.colors);
    view.addToWorld(this.fill.mesh);
    view.addToWorld(createLakes(map));
    if (approach === "mesh") {
      this.borders = new Borders(map);
      view.addToWorld(this.borders.mesh);
      view.addToWorld(this.borders.provinceMesh);
    }
    const nameOf = (this.nameOf = (tag: string) => {
      // no game yet (the 1 January 2000 start screen): the name a country starts with
      if (!this.state) { const start = db.countryList.find((c) => c.tag === tag)?.start_name; if (start) return start; }
      return countryShortName(db, this.state, tag);
    });
    this.labels = new Labels(map.labels, nameOf);
    view.scene.add(this.labels.group);

    this.setMode(this.mode);

    view.onFrame.push(({ worldPerPx, zoom, centerX }) => {
      if (this.borders) {
        this.borders.update(worldPerPx, zoom);
        const pv = this.borders.provinceVisible;
        view.scene.traverse((o) => { if ((o as THREE.Mesh).geometry === this.borders!.provinceMesh.geometry) o.visible = pv; });
      }
      if (this.fill instanceof ProvinceTexture) this.fill.material.uniforms.uBorderAlpha!.value = Math.min(0.4, Math.max(0, (zoom - 1.5) / 4) * 0.4);
      // keep labels on the world copy nearest the camera
      for (const child of this.labels.group.children) {
        const baseX = (child.userData.baseX as number | undefined) ?? (child.userData.baseX = child.position.x);
        child.position.x = baseX + 360 * Math.round((centerX - baseX) / 360);
      }
      this.labels.update(worldPerPx);
    });
    // microstates are smaller than one id-map pixel: snap to them when the cursor is close
    const tiny = map.provinces.filter((p) => p.area_km2 < 60).map((p) => ({ id: p.id, x: p.centroid[0], y: millerY(p.centroid[1]) }));
    const pick = (this.pickAt = (x: number, y: number) => {
      const r = 8 * view.worldPerPx;
      for (const t of tiny) if (Math.abs(t.x - x) < r && Math.abs(t.y - y) < r) return t.id;
      return provinceAt(map, x, y);
    });
    view.onHover.push((x, y) => {
      const id = pick(x, y);
      if (id !== this.hovered) {
        this.hovered = id;
        this.fill.setHover(id);
        this.onHoverChange(id);
      }
    });
    view.onClick.push((x, y) => this.select(pick(x, y)));
    view.onRightClick.push((x, y) => this.onOrder(pick(x, y)));
    this.followOwnership();
  }

  select(id: number): void {
    this.selected = id;
    this.fill.setSelected(id);
    this.onSelectChange(id);
  }

  /** Recolour every province for a map mode. Returns the time taken (ms). */
  setMode(id: string): number {
    const t0 = performance.now();
    const mode = MAP_MODES.find((m) => m.id === id && m.available);
    if (!mode?.color) return 0;
    this.mode = id;
    const ctx: MapModeContext = { db: this.db, map: this.map, state: this.state };
    for (const p of this.map.provinces) {
      const [r, g, b] = mode.color(p, ctx);
      this.colors.set(p.id, r, g, b);
    }
    this.colors.commit();
    return performance.now() - t0;
  }

  /** Follow a game state (or none) and recolour the current mode. */
  setOwners(state: GameState | null): void {
    this.state = state;
    this.refresh();
  }

  /** Recolour the current map mode (after ownership, government or election changes). */
  refresh(): void {
    this.setMode(this.mode);
    this.followOwnership();
  }

  private nameOf: (tag: string) => string = (t) => t;
  private ownerSig = "";
  private neighbours: Map<number, number[]> | null = null;
  /**
   * Labels and country borders follow ownership (annexations, takeovers, new countries): rebuilt
   * only when the owners actually changed since the last time.
   */
  private followOwnership(): void {
    const owners = this.state?.provinceOwner;
    // a cheap signature of who owns what
    let h = 0;
    const codes = new Map<string, number>();
    for (let i = 0; owners && i < owners.length; i++) {
      const t = owners[i]!;
      let c = codes.get(t);
      if (c === undefined) codes.set(t, (c = codes.size + 1));
      h = (Math.imul(h, 31) + c * (i + 1)) | 0;
    }
    // renamed countries (set_country_name) need their labels redone too
    const names = Object.values(this.state?.countries ?? {}).filter((c) => c.name).map((c) => `${c.tag}=${c.name}`).join(",");
    const sig = owners ? `${owners.length}:${h}:${codes.size}:${names}` : "start-map";
    if (sig === this.ownerSig) return;
    this.ownerSig = sig;
    const ownerOf = (id: number) => owners?.[id - 1] ?? this.map.provinces[id - 1]?.owner;
    this.borders?.setOwners(ownerOf);
    if (!this.neighbours) {
      this.neighbours = new Map();
      for (const [a, b] of this.map.adjacency) {
        (this.neighbours.get(a) ?? this.neighbours.set(a, []).get(a)!).push(b);
        (this.neighbours.get(b) ?? this.neighbours.set(b, []).get(b)!).push(a);
      }
    }
    // labels are fitted to each country's real shape (point test on the province id map)
    const fit = {
      ownerAt: (x: number, y: number) => {
        const id = provinceAt(this.map, x, y);
        return id ? ownerOf(id) : undefined;
      },
      nameLength: (tag: string) => this.nameOf(tag).length,
    };
    this.labels.rebuild(countryLabels(this.map.provinces, this.neighbours, (p) => ownerOf(p.id), fit));
  }

  /** Rough GPU memory estimate for the benchmark (bytes). */
  gpuBytes(): number {
    let bytes = ProvinceColors.SIZE * ProvinceColors.SIZE * 4;
    const geomBytes = (g: THREE.BufferGeometry) => {
      let b = g.index ? g.index.array.byteLength : 0;
      for (const a of Object.values(g.attributes)) b += (a as THREE.BufferAttribute).array.byteLength;
      return b;
    };
    bytes += geomBytes(this.fill.mesh.geometry);
    if (this.borders) bytes += geomBytes(this.borders.mesh.geometry) + geomBytes(this.borders.provinceMesh.geometry);
    if (this.fill instanceof ProvinceTexture) bytes += this.map.grid.width * this.map.grid.height * 4;
    return bytes;
  }
}
