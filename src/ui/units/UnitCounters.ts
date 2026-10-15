/**
 * Unit counters on the map (HOI4 style): one counter per country per province, showing the number
 * of divisions and their average strength. Plain DOM positioned every frame (Preact would re-render
 * hundreds of nodes per frame). Click a counter to select your divisions there (shift adds);
 * right-click a province to move the selection.
 */
import type { ContentDB } from "../../content/compile.ts";
import type { MapData } from "../../render/mapData.ts";
import { millerY, type MapView } from "../../render/MapView.ts";
import type { Division } from "../../sim/military/military.ts";
import type { GameState } from "../../sim/state.ts";
import { selectedDivisions } from "../store.ts";
import { activeTip } from "../tooltip.tsx";

interface Group {
  key: string;
  owner: string;
  province: number;
  divisions: Division[];
}

export class UnitCounters {
  private root: HTMLDivElement;
  private nodes = new Map<string, HTMLDivElement>();
  private groups: Group[] = [];
  private lastVersion = -1;

  constructor(
    private view: MapView,
    private map: MapData,
    private db: ContentDB,
    private getState: () => GameState | null,
  ) {
    this.root = document.createElement("div");
    this.root.className = "unit-layer";
    document.getElementById("ui")!.appendChild(this.root);
    view.onFrame.push(() => this.position());
  }

  /** Rebuild the groups (call when the game state changes). */
  refresh(version: number): void {
    if (version === this.lastVersion) return;
    this.lastVersion = version;
    const state = this.getState();
    const byKey = new Map<string, Group>();
    for (const d of state?.divisions ?? []) {
      if (d.province < 1) continue;
      const key = `${d.owner}:${d.province}`;
      const g = byKey.get(key) ?? { key, owner: d.owner, province: d.province, divisions: [] };
      g.divisions.push(d);
      byKey.set(key, g);
    }
    this.groups = [...byKey.values()];
    const live = new Set(this.groups.map((g) => g.key));
    for (const [k, n] of this.nodes) if (!live.has(k)) { n.remove(); this.nodes.delete(k); }
    const sel = new Set(selectedDivisions.value);
    for (const g of this.groups) {
      let n = this.nodes.get(g.key);
      if (!n) {
        n = document.createElement("div");
        n.className = "unit";
        n.addEventListener("pointerdown", (e) => e.stopPropagation());
        n.addEventListener("click", (e) => this.select(g.key, e.shiftKey));
        n.addEventListener("mouseenter", () => this.tip(g.key));
        n.addEventListener("mouseleave", () => (activeTip.value = null));
        this.root.appendChild(n);
        this.nodes.set(g.key, n);
      }
      const color = state?.dynamicCountries[g.owner]?.color ?? this.db.countryColors.get(g.owner) ?? "#666";
      const strength = g.divisions.reduce((s, d) => s + d.strength, 0) / g.divisions.length;
      const moving = g.divisions.some((d) => d.path.length);
      const mine = g.owner === state?.player;
      n.style.setProperty("--c", color);
      n.classList.toggle("mine", mine);
      n.classList.toggle("sel", g.divisions.some((d) => sel.has(d.id)));
      n.classList.toggle("moving", moving);
      n.innerHTML = `<b>${g.divisions.length}</b><i style="width:${Math.round(strength * 100)}%"></i>`;
    }
    this.position();
  }

  private group(key: string): Group | undefined {
    return this.groups.find((g) => g.key === key);
  }

  private select(key: string, add: boolean): void {
    const state = this.getState();
    const g = this.group(key);
    if (!g || g.owner !== state?.player) return;
    const ids = g.divisions.map((d) => d.id);
    selectedDivisions.value = add ? [...new Set([...selectedDivisions.value, ...ids])] : ids;
    this.lastVersion = -1;
  }

  private tip(key: string): void {
    const g = this.group(key);
    if (!g) return;
    const state = this.getState();
    const owner = state?.dynamicCountries[g.owner]?.name ?? this.db.countries.get(g.owner)?.country?.name.en ?? g.owner;
    const prov = this.map.provinces[g.province - 1]?.name ?? "";
    activeTip.value = {
      title: `${owner}: ${g.divisions.length} division${g.divisions.length > 1 ? "s" : ""}`,
      rows: g.divisions.slice(0, 8).map((d) => [d.name, `${Math.round(d.strength * 100)}%${d.path.length ? " · moving" : ""}`] as [string, string]),
      note: `${prov}${g.owner === state?.player ? ". Click to select (shift adds), then right-click a province to move." : ""}`,
    };
  }

  private position(): void {
    const show = this.view.zoom >= 2.2;
    const state = this.getState();
    const r = this.view.canvas.getBoundingClientRect();
    for (const g of this.groups) {
      const n = this.nodes.get(g.key);
      if (!n) continue;
      const visible = show || g.owner === state?.player;
      const p = this.map.provinces[g.province - 1];
      if (!visible || !p) { n.style.display = "none"; continue; }
      const s = this.view.worldToScreen(p.centroid[0], millerY(p.centroid[1]));
      if (s.x < r.left - 40 || s.x > r.right + 40 || s.y < r.top - 20 || s.y > r.bottom + 20) { n.style.display = "none"; continue; }
      n.style.display = "";
      n.style.transform = `translate(${Math.round(s.x - 17)}px, ${Math.round(s.y - 10)}px)`;
    }
  }

  clear(): void {
    for (const n of this.nodes.values()) n.remove();
    this.nodes.clear();
    this.groups = [];
  }
}
