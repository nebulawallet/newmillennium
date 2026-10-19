/**
 * Unit counters on the map (HOI4 style): one small counter per country per province, with the
 * NATO-style symbol of the stack's main division type in the country colour, the division count,
 * and strength and organisation bars. Plain DOM positioned every frame (Preact would re-render
 * hundreds of nodes per frame). Click a counter to select your divisions there (shift adds);
 * right-click a province to move the selection.
 */
import type { ContentDB } from "../../content/compile.ts";
import type { MapData } from "../../render/mapData.ts";
import { millerY, type MapView } from "../../render/MapView.ts";
import type { Division } from "../../sim/military/military.ts";
import type { GameState } from "../../sim/state.ts";
import { divisionSymbol, STATUS_TEXT, type MapSymbol } from "../../sim/military/fronts.ts";
import { selectedArmy, selectedDivisions, showAlliedDivisions } from "../store.ts";
import { divisionVisibility } from "../../sim/military/visibility.ts";
import { SYMBOL_NAME, symbolSvg } from "./symbols.ts";
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
  private lastAllies = showAlliedDivisions.value;

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
    if (version === this.lastVersion && this.lastAllies === showAlliedDivisions.value) return;
    this.lastVersion = version;
    this.lastAllies = showAlliedDivisions.value;
    const state = this.getState();
    const byKey = new Map<string, Group>();
    // fog of war: foreign divisions show only when allied (toggle), at war with you, in your land or under your radar
    const seen = state ? divisionVisibility(this.db, state, this.map, state.player, { showAllies: showAlliedDivisions.value }) : () => true;
    for (const d of state?.divisions ?? []) {
      if (d.province < 1 || !seen(d)) continue;
      const key = `${d.owner}:${d.province}`;
      const g = byKey.get(key) ?? { key, owner: d.owner, province: d.province, divisions: [] };
      g.divisions.push(d);
      byKey.set(key, g);
    }
    this.groups = [...byKey.values()];
    const live = new Set(this.groups.map((g) => g.key));
    for (const [k, n] of this.nodes) if (!live.has(k)) { n.remove(); this.nodes.delete(k); }
    const sel = new Set(selectedDivisions.value);
    const fighting = new Set((state?.battles ?? []).flatMap((b) => [...b.attackers, ...b.defenders]));
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
      const org = g.divisions.reduce((s, d) => s + d.organisation, 0) / g.divisions.length;
      const moving = g.divisions.some((d) => d.path.length && !d.attacking);
      const mine = g.owner === state?.player;
      const army = selectedArmy.value ? state?.armies.find((a) => a.id === selectedArmy.value) : undefined;
      n.style.setProperty("--c", color);
      n.classList.toggle("mine", mine);
      n.classList.toggle("sel", g.divisions.some((d) => sel.has(d.id)));
      n.classList.toggle("in-army", !!army && g.divisions.some((d) => army.divisions.includes(d.id)));
      n.classList.toggle("moving", moving);
      n.classList.toggle("fight", g.divisions.some((d) => fighting.has(d.id)));
      const sym = this.mainSymbol(g.divisions);
      const html = `${symbolSvg(sym, color)}<b>${g.divisions.length}</b><span class="ub"><i class="s" style="width:${Math.round(strength * 100)}%"></i></span><span class="ub"><i class="o" style="width:${Math.round(org * 100)}%"></i></span>`;
      if (n.dataset.h !== html) { n.innerHTML = html; n.dataset.h = html; }
    }
    this.position();
  }

  /** The symbol most divisions in the stack carry (armour first on ties). */
  private mainSymbol(ds: Division[]): MapSymbol {
    const n = new Map<MapSymbol, number>();
    for (const d of ds) {
      const s = divisionSymbol(this.db, d.units);
      n.set(s, (n.get(s) ?? 0) + 1);
    }
    let best: MapSymbol = "infantry", bn = 0;
    for (const s of ["armour", "mechanised", "motorised", "infantry"] as MapSymbol[]) if ((n.get(s) ?? 0) > bn) { best = s; bn = n.get(s)!; }
    return best;
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
    const armies = (state?.armies ?? []).filter((a) => a.owner === g.owner && g.divisions.some((d) => a.divisions.includes(d.id)));
    activeTip.value = {
      title: `${owner}: ${g.divisions.length} division${g.divisions.length > 1 ? "s" : ""}`,
      rows: [
        ...g.divisions.slice(0, 8).map((d) => [d.name, `${SYMBOL_NAME[divisionSymbol(this.db, d.units)]} · str ${Math.round(d.strength * 100)}% · org ${Math.round(d.organisation * 100)}%${d.attacking ? " · attacking" : d.path.length ? " · moving" : ""}`] as [string, string]),
        ...(g.divisions.length > 8 ? [["…", `${g.divisions.length - 8} more`] as [string, string]] : []),
        ...armies.map((a) => [a.name, STATUS_TEXT[a.status]] as [string, string]),
      ],
      note: `${prov}. Bars: strength (top) and organisation.${g.owner === state?.player ? " Click to select (shift adds), then right-click a province to move." : ""}`,
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
      n.style.transform = `translate(${Math.round(s.x - 15)}px, ${Math.round(s.y - 9)}px)`;
    }
  }

  clear(): void {
    for (const n of this.nodes.values()) n.remove();
    this.nodes.clear();
    this.groups = [];
  }
}
