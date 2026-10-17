/**
 * Fronts and battle plans on the map (HOI4 style), as one SVG layer re-projected every frame:
 *  - the player's frontline along every border with an enemy at war, traced on the real border
 *    segments (public/map/borders.bin) shared by each pair of facing provinces;
 *  - the selected army's stretch of it, highlighted;
 *  - offensive lines (red, through the target provinces) and spearhead arrows of the player's armies;
 *  - the line or arrow being drawn.
 */
import { provinceAt, type MapData } from "../../render/mapData.ts";
import { millerY, type MapView } from "../../render/MapView.ts";
import { borderPairs, frontPairs } from "../../sim/military/fronts.ts";
import { hostile } from "../../sim/military/war.ts";
import type { SimMap } from "../../sim/simulation.ts";
import type { GameState } from "../../sim/state.ts";
import { planDraft, planTool, selectedArmy } from "../store.ts";

type Seg = [number, number, number, number];
const NS = "http://www.w3.org/2000/svg";

export class FrontOverlay {
  private svg: SVGSVGElement;
  private paths: Record<"all" | "army" | "off" | "offSel" | "spear" | "spearSel" | "draft", SVGPathElement>;
  private all: Seg[] = [];
  private army: Seg[] = [];
  private lines: { pts: [number, number][]; sel: boolean; arrow: boolean }[] = [];
  private lastDay = -1;
  private lastKey = "";
  private byPair: Map<number, Seg[]> | null = null;

  constructor(private view: MapView, private map: MapData, private simMap: () => SimMap | undefined, private getState: () => GameState | null) {
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
    this.paths = { all: mk("fr-all"), army: mk("fr-army"), off: mk("fr-off"), offSel: mk("fr-off sel"), spear: mk("fr-spear", true), spearSel: mk("fr-spear sel", true), draft: mk("fr-draft") };
    document.getElementById("ui")!.prepend(this.svg);
    view.onFrame.push(() => this.position());
    planDraft.subscribe(() => this.position());
  }

  private c(id: number): [number, number] | null {
    const p = this.map.provinces[id - 1];
    return p ? [p.centroid[0], millerY(p.centroid[1])] : null;
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

  /** Rebuild the geometry (daily, or when the selection changes). */
  refresh(force = false): void {
    const state = this.getState();
    const key = `${selectedArmy.value}:${state?.armies.find((a) => a.id === selectedArmy.value)?.front?.enemy ?? "-"}:${state?.armies.length ?? 0}:${state?.armies.map((a) => a.offensive.length + a.spearheads.length * 100 + (a.executing ? 7 : 0)).join(",")}`;
    if (!force && state?.day === this.lastDay && key === this.lastKey) return;
    this.lastDay = state?.day ?? -1;
    this.lastKey = key;
    const sm = this.simMap();
    this.all = [];
    this.army = [];
    this.lines = [];
    if (!state?.player || !sm) return this.position();
    const sel = state.armies.find((a) => a.id === selectedArmy.value && a.owner === state.player);
    const stretch = new Set(sel?.stretch ?? []);
    const byPair = this.pairs();
    for (const p of frontPairs(state, sm, state.player)) {
      const segs = byPair.get(Math.min(p.own, p.enemy) * 65536 + Math.max(p.own, p.enemy)) ?? [];
      this.all.push(...segs);
      if (stretch.has(p.own)) this.army.push(...segs);
    }
    // a front on a border we are not at war over (lined up before a declaration)
    const peace = sel?.front?.enemy && !hostile(state, state.player, sel.front.enemy) ? sel.front.enemy : null;
    if (peace) for (const p of borderPairs(state, sm, state.player, peace)) this.army.push(...(byPair.get(Math.min(p.own, p.enemy) * 65536 + Math.max(p.own, p.enemy)) ?? []));
    for (const a of state.armies) {
      if (a.owner !== state.player) continue;
      const isSel = a.id === sel?.id;
      if (a.offensive.length) {
        const pts = this.ordered(a.offensive);
        if (pts.length) this.lines.push({ pts: pts.length === 1 ? [pts[0]!, [pts[0]![0] + 0.01, pts[0]![1]]] : pts, sel: isSel, arrow: false });
      }
      for (const s of a.spearheads) {
        const pts = s.map((id) => this.c(id)).filter((x): x is [number, number] => !!x);
        const start = a.divisions.length ? state.divisions.find((d) => d.id === a.divisions[0]) : undefined;
        const from = start ? this.c(start.province) : null;
        if (pts.length) this.lines.push({ pts: from && pts.length < 2 ? [from, ...pts] : pts, sel: isSel, arrow: true });
      }
    }
    this.position();
  }

  /** Target provinces as a line: ordered along their main axis. */
  private ordered(ids: number[]): [number, number][] {
    const pts = ids.map((id) => this.c(id)).filter((x): x is [number, number] => !!x);
    if (pts.length < 3) return pts;
    const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    let sxx = 0, sxy = 0, syy = 0;
    for (const [x, y] of pts) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2; }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const ax = Math.cos(ang), ay = Math.sin(ang);
    return pts.sort((p, q) => (p[0] - mx) * ax + (p[1] - my) * ay - ((q[0] - mx) * ax + (q[1] - my) * ay));
  }

  private position(): void {
    const v = this.view;
    const proj = (x: number, y: number) => {
      const s = v.worldToScreen(x, y);
      return `${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
    };
    const segs = (list: Seg[]) => list.map(([x1, y1, x2, y2]) => `M${proj(x1, y1)}L${proj(x2, y2)}`).join("");
    const poly = (pts: [number, number][]) => (pts.length ? `M${pts.map(([x, y]) => proj(x, y)).join("L")}` : "");
    const show = !!this.getState()?.player;
    this.svg.style.display = show ? "" : "none";
    if (!show) return;
    this.paths.all.setAttribute("d", segs(this.all));
    this.paths.army.setAttribute("d", segs(this.army));
    this.paths.off.setAttribute("d", this.lines.filter((l) => !l.arrow && !l.sel).map((l) => poly(l.pts)).join(""));
    this.paths.offSel.setAttribute("d", this.lines.filter((l) => !l.arrow && l.sel).map((l) => poly(l.pts)).join(""));
    this.paths.spear.setAttribute("d", this.lines.filter((l) => l.arrow && !l.sel).map((l) => poly(l.pts)).join(""));
    this.paths.spearSel.setAttribute("d", this.lines.filter((l) => l.arrow && l.sel).map((l) => poly(l.pts)).join(""));
    const draft = planDraft.value.map((id) => this.c(id)).filter((x): x is [number, number] => !!x);
    this.paths.draft.setAttribute("d", planTool.value ? poly(draft) : "");
    this.paths.draft.setAttribute("marker-end", planTool.value?.kind === "spearhead" ? "url(#nm-arrow)" : "");
  }
}
