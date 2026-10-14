/**
 * Rich, cursor-following tooltips (the HOI4 way of explaining every number).
 * Any element spreads `{...tip(() => ({ title, rows, note }))}`; one TooltipLayer renders it.
 */
import { signal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { pointer } from "./store.ts";

export interface TipContent {
  title: string;
  rows?: [ComponentChildren, ComponentChildren][];
  body?: ComponentChildren;
  note?: string;
}

export const activeTip = signal<TipContent | null>(null);

/** Props that attach a tooltip to an element. Content is computed on hover so it is always current. */
export function tip(content: () => TipContent) {
  return {
    onMouseEnter: () => (activeTip.value = content()),
    onMouseLeave: () => (activeTip.value = null),
    onFocus: () => (activeTip.value = content()),
    onBlur: () => (activeTip.value = null),
  };
}

export function TipBox({ t, x, y }: { t: TipContent; x: number; y: number }) {
  // keep inside the viewport
  const left = Math.min(x + 18, window.innerWidth - 350);
  const top = y + 20 > window.innerHeight - 160 ? y - 140 : y + 20;
  return (
    <div class="tt" style={{ left: `${left}px`, top: `${top}px` }} role="tooltip">
      <div class="tt-h">{t.title}</div>
      {(t.rows?.length || t.body || t.note) && (
        <div class="tt-b">
          {t.body}
          {t.rows?.map(([k, v], i) => (
            <div class="tt-row" key={i}>
              <span class="dim">{k}</span>
              <b>{v}</b>
            </div>
          ))}
          {t.note && <div class="tt-note">{t.note}</div>}
        </div>
      )}
    </div>
  );
}

export function TooltipLayer() {
  const t = activeTip.value;
  if (!t) return null;
  const { x, y } = pointer.value;
  return <TipBox t={t} x={x} y={y} />;
}
