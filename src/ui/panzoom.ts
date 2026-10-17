/**
 * HOI4-style canvas navigation for the focus tree and the research tree: drag with the left mouse
 * button to pan (no scrollbars), the wheel zooms toward the cursor. A drag that moves more than a
 * few pixels swallows the click that ends it, so nodes are not picked by accident.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

export interface View { x: number; y: number; s: number }

const MIN_S = 0.35, MAX_S = 1.6, MARGIN = 140, DRAG_PX = 4;

function clamp(v: View, vw: number, vh: number, w: number, h: number): View {
  const lim = (pos: number, view: number, size: number) => {
    const lo = Math.min(MARGIN, view - size - MARGIN), hi = Math.max(MARGIN, view - size - MARGIN);
    return Math.min(hi, Math.max(lo, pos));
  };
  return { s: v.s, x: lim(v.x, vw, w * v.s), y: lim(v.y, vh, h * v.s) };
}

/**
 * `width`/`height` are the content size in canvas pixels. `focus` is a canvas point to centre on
 * when the view opens or `focusKey` changes (the current or next focus, the newest research).
 */
export function usePanZoom(width: number, height: number, focus: [number, number] | null, focusKey: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, s: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<{ px: number; py: number; vx: number; vy: number; moved: boolean; id: number } | null>(null);
  const swallowClick = useRef(false);

  const set = useCallback((v: View) => {
    const el = ref.current;
    if (!el) return setView(v);
    setView(clamp(v, el.clientWidth, el.clientHeight, width, height));
  }, [width, height]);

  // centre on the focus point whenever the key changes (opening the view, switching tab)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const s = viewRef.current.s;
    const [fx, fy] = focus ?? [width / 2, 0];
    set({ s, x: el.clientWidth / 2 - fx * s, y: focus ? el.clientHeight / 2.6 - fy * s : MARGIN / 2 });
  }, [focusKey]);

  // the wheel listener must be non-passive to stop the page from scrolling
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const v = viewRef.current;
      const s = Math.min(MAX_S, Math.max(MIN_S, v.s * Math.exp(-e.deltaY * 0.0015)));
      // keep the canvas point under the cursor fixed
      const cx = (mx - v.x) / v.s, cy = (my - v.y) / v.s;
      setView(clamp({ s, x: mx - cx * s, y: my - cy * s }, el.clientWidth, el.clientHeight, width, height));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [width, height]);

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const v = viewRef.current;
    drag.current = { px: e.clientX, py: e.clientY, vx: v.x, vy: v.y, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.px, dy = e.clientY - d.py;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_PX) return;
    if (!d.moved) {
      d.moved = true;
      ref.current?.setPointerCapture(e.pointerId);
    }
    set({ s: viewRef.current.s, x: d.vx + dx, y: d.vy + dy });
  };
  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    swallowClick.current = d.moved;
    drag.current = null;
    if (ref.current?.hasPointerCapture(e.pointerId)) ref.current.releasePointerCapture(e.pointerId);
  };
  // capture phase: a click that ends a drag never reaches the node under the cursor
  const onClickCapture = (e: MouseEvent) => {
    if (swallowClick.current) {
      e.stopPropagation();
      e.preventDefault();
      swallowClick.current = false;
    }
  };

  const zoomBy = (f: number) => {
    const el = ref.current;
    if (!el) return;
    const v = viewRef.current, mx = el.clientWidth / 2, my = el.clientHeight / 2;
    const s = Math.min(MAX_S, Math.max(MIN_S, v.s * f));
    const cx = (mx - v.x) / v.s, cy = (my - v.y) / v.s;
    set({ s, x: mx - cx * s, y: my - cy * s });
  };

  return {
    ref,
    view,
    zoomBy,
    viewportProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture, class: `pz-viewport ${drag.current?.moved ? "dragging" : ""}` },
    canvasStyle: { width: `${width}px`, height: `${height}px`, transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` },
  };
}
