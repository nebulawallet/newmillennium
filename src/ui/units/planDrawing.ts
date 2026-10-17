/**
 * Drawing battle plans on the map (HOI4 style).
 *  - Front line: click a country; the army holds that border.
 *  - Offensive line and spearhead: press and drag across provinces (the stroke snaps to province
 *    centres; gaps between provinces are filled along the shortest land path), release to finish.
 *    Or click province by province: double-click or Enter finishes, Backspace removes the last
 *    point. Esc or a right-click cancels.
 */
import type { MapView } from "../../render/MapView.ts";
import type { WorldMap } from "../../render/WorldMap.ts";
import type { SimMap } from "../../sim/simulation.ts";
import type { Session } from "../session.ts";
import { planDraft, planTool, toast } from "../store.ts";

/** Shortest path over land adjacency between two provinces (inclusive of both ends), or null. */
export function landPath(map: SimMap, from: number, to: number, limit = 400): number[] | null {
  if (from === to) return [from];
  const prev = new Map<number, number>([[from, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length && prev.size < limit * 20; i++) {
    const p = queue[i]!;
    for (const n of map.neighbours.get(p) ?? []) {
      if (prev.has(n)) continue;
      prev.set(n, p);
      if (n === to) {
        const out = [to];
        for (let q = p; q; q = prev.get(q)!) out.unshift(q);
        return out;
      }
      queue.push(n);
    }
  }
  return null;
}

export function createPlanDrawer(view: MapView, world: WorldMap, session: Session, onDone: () => void) {
  let last: [number, number] | null = null;
  let downAt: { x: number; y: number } | null = null;
  let dragged = false;
  let lastClick = 0;

  /** Add a province to the draft, filling the gap from the previous one. */
  const add = (id: number) => {
    if (!id) return;
    const draft = planDraft.value;
    const prev = draft.at(-1);
    if (prev === id) return;
    const sm = session.sim?.context.map;
    const fill = prev && sm ? landPath(sm, prev, id) : null;
    const extra = fill && fill.length <= 12 ? fill.slice(1) : [id];
    planDraft.value = [...draft.filter((p) => !extra.includes(p)), ...extra];
  };
  /** Every province under the stroke since the last pointer event. */
  const sweep = (x: number, y: number) => {
    const [x0, y0] = last ?? [x, y];
    const steps = Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0) / 0.15));
    for (let i = 1; i <= steps; i++) add(world.pickAt(x0 + ((x - x0) * i) / steps, y0 + ((y - y0) * i) / steps));
    last = [x, y];
  };

  const cancel = () => {
    planDraft.value = [];
    planTool.value = null;
    last = null;
    onDone();
  };

  const finish = () => {
    const tool = planTool.value;
    const st = session.state;
    const drawn = planDraft.value;
    if (tool && st?.player && drawn.length && tool.kind !== "front") {
      // the line is what lies outside our control; the arrow keeps its whole route
      const outside = drawn.filter((p) => st.provinceController[p - 1] !== st.player);
      const r = tool.kind === "offensive"
        ? session.dispatch({ type: "set_offensive", tag: st.player, army: tool.army, provinces: outside.length ? outside : drawn })
        : session.dispatch({ type: "add_spearhead", tag: st.player, army: tool.army, path: drawn });
      toast.value = { text: r.text, bad: !r.ok, at: Date.now() };
    }
    planDraft.value = [];
    planTool.value = null;
    last = null;
    onDone();
  };

  const capture = (phase: "down" | "move" | "up", x: number, y: number, e: PointerEvent) => {
    const tool = planTool.value;
    if (!tool) return;
    if (tool.kind === "front") {
      // a click on the country whose border the army holds
      if (phase !== "up") return;
      const st = session.state, id = world.pickAt(x, y);
      const owner = id ? st?.provinceController[id - 1] : undefined;
      if (st?.player && owner && owner !== st.player) {
        const r = session.dispatch({ type: "set_front", tag: st.player, army: tool.army, enemy: owner });
        toast.value = { text: r.text, bad: !r.ok, at: Date.now() };
        planTool.value = null;
        onDone();
      } else toast.value = { text: "Click a neighbouring country's territory.", bad: true, at: Date.now() };
      return;
    }
    if (phase === "down") {
      downAt = { x: e.clientX, y: e.clientY };
      dragged = false;
      last = null;
      add(world.pickAt(x, y));
      last = [x, y];
      return;
    }
    if (phase === "move") {
      if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) dragged = true;
      if (dragged) sweep(x, y);
      return;
    }
    // up: a drag finishes the line; a click adds a point (double-click finishes)
    downAt = null;
    if (dragged) return finish();
    const now = Date.now();
    if (now - lastClick < 350 && planDraft.value.length > 0) return finish();
    lastClick = now;
  };

  const key = (e: KeyboardEvent): boolean => {
    if (!planTool.value) return false;
    if (e.key === "Escape") { cancel(); return true; }
    if (e.key === "Enter") { finish(); return true; }
    if (e.key === "Backspace") { planDraft.value = planDraft.value.slice(0, -1); return true; }
    return false;
  };

  return { capture, cancel, finish, key };
}
