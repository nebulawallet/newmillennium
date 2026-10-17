/**
 * Fronts and battle plans on the map (HOI4 style), as one SVG layer re-projected every frame:
 *  - wartime fronts along every border with an enemy at war, traced on the real border segments
 *    (public/map/borders.bin) as two lines side by side: your colour on your side, the enemy's
 *    colour on theirs;
 *  - peacetime fronts (an army lined up on a border before a war) as a dashed bronze line;
 *  - the selected army's stretch, highlighted; an army marker (name, divisions) on each stretch;
 *  - offensive lines and spearhead arrows of the player's armies; the line or arrow being drawn.
 */
import { provinceAt, type MapData } from "../../render/mapData.ts";
import { millerY, type MapView } from "../../render/MapView.ts";
import { borderPairs, frontPairs } from "../../sim/military/fronts.ts";
import { hostile } from "../../sim/military/war.ts";
import type { SimMap } from "../../sim/simulation.ts";
import type { GameState } from "../../sim/state.ts";
import type { ContentDB } from "../../content/compile.ts";
import { draftTerms, peacePick, planDraft, planTool, selectedArmy, selectedDivisions } from "../store.ts";

type Seg = [number, number, number, number];
/** A border segment with the unit direction (world) from the enemy side toward ours. */
interface SideSeg { s: Seg; nx: number; ny: number }
const NS = "http://www.w3.org/2000/svg";

export class FrontOverlay {
  private svg: SVGSVGElement;
  private paths: Record<"base" | "own" | "peace" | "army" | "off" | "offSel" | "spear" | "spearSel" | "draft" | "move" | "attack" | "pick", SVGPathElement>;
  private enemyPaths = new Map<string, SVGPathElement>();
  private markerLayer: SVGGElement;
  private own: SideSeg[] = [];
  private enemy = new Map<string, SideSeg[]>();
  private peace: Seg[] = [];
  private army: Seg[] = [];
  private markers: { x: number; y: number; label: string; sel: boolean; war: boolean }[] = [];
  private lines: { pts: [number, number][]; sel: boolean; arrow: boolean }[] = [];
  private orders: { pts: [number, number][]; attack: boolean }[] = [];
  private ownColor = "#c9a56a";
  private lastDay = -1;
  private lastKey = "";
  private byPair: Map<number, Seg[]> | null = null;

  constructor(private view: MapView, private map: MapData, private db: ContentDB, private simMap: () => SimMap | undefined, private getState: () => GameState | null) {
    this.svg = document.createElementNS(NS, "svg");
    this.svg.setAttribute("class", "front-layer");
    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML = `<marker id="nm-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="fr-head"/></marker>`;
    this.svg.appendChild(defs);
    const mk = (cls: string, marker = false) => {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("class", cls);
      if (marker) p.setAttribute("marker-end", "url(#nm-arrow)");
      this.svg.appendChild(p);
      return p;
    };
    this.paths = { base: mk("fr-base"), own: mk("fr-own"), peace: mk("fr-peace"), army: mk("fr-army"), off: mk("fr-off"), offSel: mk("fr-off sel"), spear: mk("fr-spear", true), spearSel: mk("fr-spear sel", true), draft: mk("fr-draft"), move: mk("fr-move", true), attack: mk("fr-attack", true), pick: mk("fr-pick") };
    this.markerLayer = document.createElementNS(NS, "g");
    this.svg.appendChild(this.markerLayer);
    document.getElementById("ui")!.prepend(this.svg);
    view.onFrame.push(() => this.position());
    planDraft.subscribe(() => this.position());
    draftTerms.subscribe(() => this.position());
    peacePick.subscribe(() => this.position());
  }

  private c(id: number): [number, number] | null {
    const p = this.map.provinces[id - 1];
    return p ? [p.centroid[0], millerY(p.centroid[1])] : null;
  }

  private color(state: GameState, tag: string): string {
    return state.dynamicCountries[tag]?.color ?? this.db.countryColors.get(tag) ?? "#888";
  }

  /** Border segments by province pair (a·65536 + b, a < b), sampled on both sides of each segment once. */
  private pairs(): Map<number, Seg[]> {
    if (this.byPair) return this.byPair;
    const m = new Map<number, Seg[]>();
    const b = this.map.borders;
    const eps = (360 / this.map.grid.width) * 1.3;
    for (let i = 0; i < b.length; i += 5) {
      if (b[i + 4] === 2) continue; // coast
      const x0 = b[i]!, y0 = b[i + 1]!, x1 = b[i + 2]!, y1 = b[i + 3]!;
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const nx = (-(y1 - y0) / len) * eps, ny = ((x1 - x0) / len) * eps;
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const p = provinceAt(this.map, mx + nx, my + ny), q = provinceAt(this.map, mx - nx, my - ny);
      if (!p || !q || p === q) continue;
      const key = Math.min(p, q) * 65536 + Math.max(p, q);
      const list = m.get(key);
      if (list) list.push([x0, y0, x1, y1]);
      else m.set(key, [[x0, y0, x1, y1]]);
    }
    return (this.byPair = m);
  }

  private byProvince: Map<number, Seg[]> | null = null;
  /** Every border segment around a province (for outlines). */
  private outline(id: number): Seg[] {
    if (!this.byProvince) {
      this.byProvince = new Map();
      for (const [key, segs] of this.pairs()) for (const p of [Math.floor(key / 65536), key % 65536]) (this.byProvince.get(p) ?? this.byProvince.set(p, []).get(p)!).push(...segs);
    }
    return this.byProvince.get(id) ?? [];
  }

  private segsOf(own: number, enemy: number): Seg[] {
    return this.pairs().get(Math.min(own, enemy) * 65536 + Math.max(own, enemy)) ?? [];
  }

  /** Rebuild the geometry (daily, or when the selection or plans change). */
  refresh(force = false): void {
    const state = this.getState();
    const key = `${state?.wars.map((w) => w.id).join(".")}:${state?.provinceOwner.length ?? 0}:${selectedDivisions.value.length}:${selectedArmy.value}:${state?.armies.map((a) => `${a.id}${a.front?.enemy ?? "-"}${a.offensive.length}${a.spearheads.length}${a.executing ? 1 : 0}${a.divisions.length}`).join(",")}`;
    if (!force && state?.day === this.lastDay && key === this.lastKey) return;
    this.lastDay = state?.day ?? -1;
    this.lastKey = key;
    const sm = this.simMap();
    this.own = [];
    this.enemy = new Map();
    this.peace = [];
    this.army = [];
    this.lines = [];
    this.markers = [];
    this.orders = [];
    if (!state?.player || !sm) return this.position();
    // the selected divisions' routes: green to move, red when they end in enemy land
    const chosen = new Set(selectedDivisions.value);
    for (const d of state.divisions) {
      if (!chosen.has(d.id) || (!d.path.length && !d.attacking)) continue;
      const route = d.path.length ? d.path : [d.attacking!];
      const pts = [d.province, ...route].map((id) => this.c(id)).filter((x): x is [number, number] => !!x);
      const end = state.provinceController[route[route.length - 1]! - 1];
      if (pts.length > 1) this.orders.push({ pts, attack: !!end && hostile(state, d.owner, end) });
    }
    const me = state.player;
    this.ownColor = this.color(state, me);
    const sel = state.armies.find((a) => a.id === selectedArmy.value && a.owner === me);
    const stretch = new Set(sel?.stretch ?? []);
    const side = (own: number, enemy: number): { nx: number; ny: number } => {
      const a = this.c(own), b = this.c(enemy);
      if (!a || !b) return { nx: 0, ny: 0 };
      const dx = a[0] - b[0], dy = a[1] - b[1], l = Math.hypot(dx, dy) || 1;
      return { nx: dx / l, ny: dy / l };
    };
    // wartime fronts: both sides' colours
    for (const p of frontPairs(state, sm, me)) {
      const segs = this.segsOf(p.own, p.enemy);
      const n = side(p.own, p.enemy);
      for (const s of segs) {
        this.own.push({ s, ...n });
        const list = this.enemy.get(p.enemyTag) ?? [];
        list.push({ s, ...n });
        this.enemy.set(p.enemyTag, list);
      }
      if (stretch.has(p.own)) this.army.push(...segs);
    }
    // peacetime fronts: armies lined up on a border with no war
    for (const a of state.armies) {
      if (a.owner !== me || !a.front?.enemy || hostile(state, me, a.front.enemy)) continue;
      for (const p of borderPairs(state, sm, me, a.front.enemy)) {
        const segs = this.segsOf(p.own, p.enemy);
        this.peace.push(...segs);
        if (a.id === sel?.id) this.army.push(...segs);
      }
    }
    // army markers at the middle of each stretch, battle plans
    for (const a of state.armies) {
      if (a.owner !== me) continue;
      const isSel = a.id === sel?.id;
      const st = a.stretch ?? [];
      if (st.length) {
        const mid = this.c(st[Math.floor(st.length / 2)]!);
        if (mid) this.markers.push({ x: mid[0], y: mid[1], label: `${a.name} · ${a.divisions.length}`, sel: isSel, war: !!a.front?.enemy ? hostile(state, me, a.front.enemy) : true });
      }
      if (a.offensive.length) {
        const pts = a.offensive.map((id) => this.c(id)).filter((x): x is [number, number] => !!x);
        if (pts.length) this.lines.push({ pts: pts.length === 1 ? [pts[0]!, [pts[0]![0] + 0.01, pts[0]![1]]] : pts, sel: isSel, arrow: false });
      }
      for (const s of a.spearheads) {
        const pts = s.map((id) => this.c(id)).filter((x): x is [number, number] => !!x);
        if (pts.length) this.lines.push({ pts, sel: isSel, arrow: true });
      }
    }
    // enemy colour paths, one per enemy
    for (const [tag, p] of this.enemyPaths) if (!this.enemy.has(tag)) { p.remove(); this.enemyPaths.delete(tag); }
    for (const tag of this.enemy.keys()) {
      let p = this.enemyPaths.get(tag);
      if (!p) {
        p = document.createElementNS(NS, "path");
        p.setAttribute("class", "fr-enemy");
        this.svg.insertBefore(p, this.paths.own); // above the dark band, below our colour
        this.enemyPaths.set(tag, p);
      }
      p.style.stroke = this.color(state, tag);
    }
    this.paths.own.style.stroke = this.ownColor;
    this.position();
  }

  private position(): void {
    const v = this.view;
    const show = !!this.getState()?.player;
    this.svg.style.display = show ? "" : "none";
    if (!show) return;
    const pt = (x: number, y: number) => v.worldToScreen(x, y);
    const fmt = (s: { x: number; y: number }) => `${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
    const segs = (list: Seg[]) => list.map(([x1, y1, x2, y2]) => `M${fmt(pt(x1, y1))}L${fmt(pt(x2, y2))}`).join("");
    // a side line: the segment shifted 2px toward one side, the direction measured on screen
    const sideSegs = (list: SideSeg[], sign: number) => list.map(({ s: [x1, y1, x2, y2], nx, ny }) => {
      const a = pt(x1, y1), b = pt(x2, y2);
      const m = pt((x1 + x2) / 2 + nx * 0.05, (y1 + y2) / 2 + ny * 0.05), c = pt((x1 + x2) / 2, (y1 + y2) / 2);
      const dx = m.x - c.x, dy = m.y - c.y, l = Math.hypot(dx, dy) || 1;
      const ox = (dx / l) * 2.5 * sign, oy = (dy / l) * 2.5 * sign;
      return `M${(a.x + ox).toFixed(1)} ${(a.y + oy).toFixed(1)}L${(b.x + ox).toFixed(1)} ${(b.y + oy).toFixed(1)}`;
    }).join("");
    const poly = (pts: [number, number][]) => (pts.length ? `M${pts.map(([x, y]) => fmt(pt(x, y))).join("L")}` : "");
    this.paths.base.setAttribute("d", segs(this.own.map((x) => x.s)));
    this.paths.own.setAttribute("d", sideSegs(this.own, 1));
    for (const [tag, p] of this.enemyPaths) p.setAttribute("d", sideSegs(this.enemy.get(tag) ?? [], -1));
    this.paths.peace.setAttribute("d", segs(this.peace));
    this.paths.army.setAttribute("d", segs(this.army));
    this.paths.off.setAttribute("d", this.lines.filter((l) => !l.arrow && !l.sel).map((l) => poly(l.pts)).join(""));
    this.paths.offSel.setAttribute("d", this.lines.filter((l) => !l.arrow && l.sel).map((l) => poly(l.pts)).join(""));
    this.paths.spear.setAttribute("d", this.lines.filter((l) => l.arrow && !l.sel).map((l) => poly(l.pts)).join(""));
    this.paths.spearSel.setAttribute("d", this.lines.filter((l) => l.arrow && l.sel).map((l) => poly(l.pts)).join(""));
    const draft = planDraft.value.map((id) => this.c(id)).filter((x): x is [number, number] => !!x);
    const picked = peacePick.value ? draftTerms.value[peacePick.value]?.provinces ?? [] : [];
    this.paths.pick.setAttribute("d", segs(picked.flatMap((id) => this.outline(id))));
    this.paths.move.setAttribute("d", this.orders.filter((o) => !o.attack).map((o) => poly(o.pts)).join(""));
    this.paths.attack.setAttribute("d", this.orders.filter((o) => o.attack).map((o) => poly(o.pts)).join(""));
    this.paths.draft.setAttribute("d", planTool.value && planTool.value.kind !== "front" ? poly(draft) : "");
    this.paths.draft.setAttribute("marker-end", planTool.value?.kind === "spearhead" ? "url(#nm-arrow)" : "");
    // army markers
    const html = this.markers.map((mk) => {
      const s = pt(mk.x, mk.y);
      const w = Math.max(40, mk.label.length * 6 + 12);
      return `<g class="fr-mark ${mk.sel ? "sel" : ""} ${mk.war ? "war" : "peace"}" transform="translate(${(s.x - w / 2).toFixed(1)} ${(s.y - 26).toFixed(1)})"><rect width="${w}" height="15"/><text x="${w / 2}" y="11">${mk.label.replace(/[<&]/g, "")}</text></g>`;
    }).join("");
    if (this.markerLayer.innerHTML !== html) this.markerLayer.innerHTML = html;
  }
}
