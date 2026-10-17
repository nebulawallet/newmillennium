/**
 * Battle markers on the map: crossed swords over each province being fought for, with a progress
 * bar in the two sides' colours (left: the attacker's share). Plain DOM re-positioned every frame,
 * like the unit counters. Battles involving the player always show; others when zoomed in.
 * Clicking a marker opens the war panel and looks at the battle.
 */
import type { ContentDB } from "../../content/compile.ts";
import type { MapData } from "../../render/mapData.ts";
import { millerY, type MapView } from "../../render/MapView.ts";
import type { GameState } from "../../sim/state.ts";
import { openWar } from "../store.ts";
import { activeTip } from "../tooltip.tsx";

const SWORDS = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 4l9 9M20 4l-9 9M3 18l3 3M18 21l3-3M7 15l2 2M15 17l2-2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;

export class BattleMarkers {
  private root: HTMLDivElement;
  private nodes = new Map<number, HTMLDivElement>();

  constructor(private view: MapView, private map: MapData, private db: ContentDB, private getState: () => GameState | null) {
    this.root = document.createElement("div");
    this.root.className = "battle-layer";
    document.getElementById("ui")!.appendChild(this.root);
    view.onFrame.push(() => this.position());
  }

  refresh(): void {
    const state = this.getState();
    const live = new Set((state?.battles ?? []).map((b) => b.province));
    for (const [p, n] of this.nodes) if (!live.has(p)) { n.remove(); this.nodes.delete(p); }
    for (const b of state?.battles ?? []) {
      let n = this.nodes.get(b.province);
      if (!n) {
        n = document.createElement("div");
        n.className = "battle";
        n.addEventListener("pointerdown", (e) => e.stopPropagation());
        n.addEventListener("click", () => this.open(b.province));
        n.addEventListener("mouseenter", () => this.tip(b.province));
        n.addEventListener("mouseleave", () => (activeTip.value = null));
        this.root.appendChild(n);
        this.nodes.set(b.province, n);
      }
      const color = (t: string) => state!.dynamicCountries[t]?.color ?? this.db.countryColors.get(t) ?? "#888";
      const p = Math.round((b.progress ?? 0.5) * 100);
      const mine = b.attackerTag === state?.player || b.defenderTag === state?.player;
      n.classList.toggle("mine", mine);
      n.dataset.mine = mine ? "1" : "";
      const html = `${SWORDS}<span class="bb"><i style="width:${p}%;background:${color(b.attackerTag)}"></i><i style="width:${100 - p}%;background:${color(b.defenderTag)}"></i></span>`;
      if (n.dataset.h !== html) { n.innerHTML = html; n.dataset.h = html; }
    }
    this.position();
  }

  private open(province: number): void {
    const state = this.getState();
    const b = state?.battles.find((x) => x.province === province);
    if (!state || !b) return;
    const w = state.wars.find((x) => (x.attackers.includes(b.attackerTag) && x.defenders.includes(b.defenderTag)) || (x.defenders.includes(b.attackerTag) && x.attackers.includes(b.defenderTag)));
    if (w) openWar.value = w.id;
  }

  private tip(province: number): void {
    const state = this.getState();
    const b = state?.battles.find((x) => x.province === province);
    if (!state || !b) return;
    const name = (t: string) => state.dynamicCountries[t]?.name ?? this.db.countryList.find((c) => c.tag === t)?.name ?? t;
    activeTip.value = {
      title: `Battle of ${this.map.provinces[province - 1]?.name ?? ""}`,
      rows: [
        ["Attacker", `${name(b.attackerTag)} (${b.attackers.length} div)`],
        ["Defender", `${name(b.defenderTag)} (${b.defenders.length} div)`],
        ["Progress", `${Math.round((b.progress ?? 0.5) * 100)}% toward the attacker`],
        ...(b.river ? [["River crossing", b.river.name] as [string, string]] : []),
        ["Days", state.day - b.startDay],
      ],
      note: "Click for the war overview.",
    };
  }

  private position(): void {
    const r = this.view.canvas.getBoundingClientRect();
    const close = this.view.zoom >= 2.2;
    for (const [p, n] of this.nodes) {
      const pr = this.map.provinces[p - 1];
      if (!pr || (!close && !n.dataset.mine)) { n.style.display = "none"; continue; }
      const s = this.view.worldToScreen(pr.centroid[0], millerY(pr.centroid[1]));
      if (s.x < r.left - 30 || s.x > r.right + 30 || s.y < r.top - 30 || s.y > r.bottom + 30) { n.style.display = "none"; continue; }
      n.style.display = "";
      n.style.transform = `translate(${Math.round(s.x - 14)}px, ${Math.round(s.y - 32)}px)`;
    }
  }

  clear(): void {
    for (const n of this.nodes.values()) n.remove();
    this.nodes.clear();
  }
}
