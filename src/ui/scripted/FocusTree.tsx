/**
 * National focus tree (HOI4 position: a large view opened from the focus tile beside the flag).
 * Drag to pan, wheel to zoom toward the cursor; the view opens centred on the current focus, else
 * the next available one. Elbow lines join prerequisites (dashed where any one of several is
 * enough); red double arrows join mutually exclusive focuses.
 */
import { useState } from "preact/hooks";
import type { ContentDB } from "../../content/compile.ts";
import type { FocusDef } from "../../content/schemas/scripted.ts";
import { focusStatus, type FocusStatus } from "../../sim/scripting/systems.ts";
import { Icon, type IconName } from "../icons.tsx";
import { usePanZoom } from "../panzoom.ts";
import { panel, version, type Session } from "../session.ts";
import { tip } from "../tooltip.tsx";
import { decisionsUnlockedBy } from "../../sim/scripting/engine.ts";
import { ConditionList, EffectList } from "./fx.tsx";

/** Grid cell, and the node box inside it (icon 52 + name plate + bar). */
const CW = 156, CH = 128, PAD = 60, ICON = 52, NODE_H = 96;
const STATUS_LABEL: Record<FocusStatus, string> = {
  completed: "Completed",
  current: "In progress",
  available: "Available",
  locked: "Needs earlier focuses",
  excluded: "Excluded by another choice",
  unavailable: "Conditions not met",
};

/** An icon from the effects when the focus names none (presentation only). */
const ICON_RULES: [RegExp, IconName][] = [
  [/research|tech/, "research"],
  [/army|division|military|manpower|war_support|defence|attack|conscript/, "recruitment"],
  [/diplom|opinion|bloc|guarantee|relations/, "diplomacy"],
  [/factor|construction|industr|production/, "factories"],
  [/growth|econom|tax|budget|debt|trade|inflation/, "treasury"],
  [/stability|unrest/, "stability"],
  [/interest_group|ruling_party|popularity/, "party"],
  [/political_power/, "power"],
];
export function focusIcon(f: FocusDef): IconName {
  if (f.icon && f.icon in Icon) return f.icon as IconName;
  const s = JSON.stringify(f.effects);
  return ICON_RULES.find(([re]) => re.test(s))?.[1] ?? "focus";
}

export function FocusTreeView({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const [msg, setMsg] = useState("");
  const state = session.state;
  const sim = session.sim;
  const tag = state?.player;
  const cs = tag ? state?.countries[tag] : undefined;
  const tree = cs ? db.focusTrees.get(cs.focus.tree) : undefined;
  const ctx = sim?.context;
  const focuses = tree?.focuses ?? [];
  const minX = Math.min(0, ...focuses.map((f) => f.x));
  const cols = Math.max(1, ...focuses.map((f) => f.x - minX + 1));
  const rows = Math.max(1, ...focuses.map((f) => f.y + 1));
  const W = cols * CW + PAD * 2, H = rows * CH + PAD * 2;
  const cx = (f: FocusDef) => PAD + (f.x - minX) * CW + CW / 2;
  const cy = (f: FocusDef) => PAD + f.y * CH;
  const statuses = new Map(cs && ctx ? focuses.map((f) => [f.id, focusStatus(ctx, cs, f)]) : []);
  const current = cs?.focus.current ? focuses.find((f) => f.id === cs.focus.current) : undefined;
  const next = current ?? focuses.filter((f) => statuses.get(f.id) === "available").sort((a, b) => a.y - b.y || a.x - b.x)[0];
  const pz = usePanZoom(W, H, next ? [cx(next), cy(next) + NODE_H / 2] : null, `${tree?.id}`);
  if (!state || !sim || !tag || !cs || !tree || !ctx) return null;
  const byId = new Map(focuses.map((f) => [f.id, f]));

  const lines: preact.JSX.Element[] = [];
  for (const f of focuses)
    f.prerequisites.forEach((g, gi) => {
      for (const p of g) {
        const from = byId.get(p);
        if (!from) continue;
        const done = cs.focus.completed.includes(p);
        const y0 = cy(from) + NODE_H, y1 = cy(f) - 4, mid = y0 + Math.min(18, (y1 - y0) / 2);
        lines.push(
          <path
            key={`${p}-${f.id}-${gi}`}
            d={`M${cx(from)},${y0} V${mid} H${cx(f)} V${y1}`}
            class={`fl ${done ? "done" : ""} ${g.length > 1 ? "or" : ""}`}
          />,
        );
      }
    });
  // mutually exclusive pairs: a red double arrow between the two icons (or a dotted link across rows)
  const seen = new Set<string>();
  const excl: preact.JSX.Element[] = [];
  for (const f of focuses)
    for (const m of f.mutually_exclusive) {
      const o = byId.get(m);
      const key = [f.id, m].sort().join("|");
      if (!o || seen.has(key)) continue;
      seen.add(key);
      const [a, b] = cx(f) <= cx(o) ? [f, o] : [o, f];
      const ya = cy(a) + ICON / 2, yb = cy(b) + ICON / 2;
      const xa = cx(a) + ICON / 2 + 6, xb = cx(b) - ICON / 2 - 6;
      const mx = (xa + xb) / 2, my = (ya + yb) / 2;
      excl.push(
        <g key={key} class="fx-excl">
          <path d={`M${xa},${ya} L${xb},${yb}`} />
          <g transform={`translate(${mx - 11},${my - 11})`}>
            <rect width="22" height="22" />
            <path d="M5 11h12M8 8l-3 3 3 3M14 8l3 3-3 3" />
          </g>
        </g>,
      );
    }

  return (
    <section class="focus-view hp" aria-label="National focus">
      <header class="hp-head">
        <span class="side-ic">{Icon.focus({ size: 18 })}</span>
        <h2 class="hp-title">{tree.name}</h2>
        <span class="fv-status dim">
          {current ? (
            <>
              <b>{current.name}</b> <span class="num">{cs.focus.progress} / {current.days}</span> days
              <button class="lnk" onClick={() => setMsg(session.dispatch({ type: "cancel_focus", tag }).text)}> Cancel</button>
            </>
          ) : (
            <span class="warn">No focus selected</span>
          )}
          {msg && <span class="faint"> · {msg}</span>}
        </span>
        <span class="fv-count faint small num" {...tip(() => ({ title: "Focuses", rows: [["Completed", cs.focus.completed.length], ["Available now", [...statuses.values()].filter((s) => s === "available").length], ["In the tree", focuses.length]] }))}>
          {cs.focus.completed.length}/{focuses.length}
        </span>
        <div class="pz-tools">
          <button class="tile mini" aria-label="Zoom out" onClick={() => pz.zoomBy(0.8)} {...tip(() => ({ title: "Zoom out", note: "Or use the mouse wheel." }))}>{Icon.minus({ size: 12 })}</button>
          <button class="tile mini" aria-label="Zoom in" onClick={() => pz.zoomBy(1.25)} {...tip(() => ({ title: "Zoom in", note: "Or use the mouse wheel." }))}>{Icon.plus({ size: 12 })}</button>
        </div>
        <button class="x" onClick={() => (panel.value = null)} aria-label="Close">{Icon.close({ size: 14 })}</button>
      </header>
      <div ref={pz.ref} {...pz.viewportProps}>
        <div class="pz-canvas" style={pz.canvasStyle}>
          <svg class="fv-lines" width={W} height={H} aria-hidden="true">{lines}{excl}</svg>
          {focuses.map((f) => {
            const st = statuses.get(f.id) ?? "locked";
            const pct = st === "current" ? Math.min(100, (cs.focus.progress / f.days) * 100) : st === "completed" ? 100 : 0;
            return (
              <button
                key={f.id}
                class={`fnode s-${st}`}
                style={{ left: `${cx(f) - CW / 2 + 6}px`, top: `${cy(f)}px`, width: `${CW - 12}px` }}
                onClick={() => st === "available" && setMsg(session.dispatch({ type: "set_focus", tag, focus: f.id }).text)}
                {...tip(() => ({
                  title: f.name,
                  body: (
                    <>
                      <span class="dim">{f.description}</span>
                      <EffectList db={db} effects={f.effects} live={{ state, tag }} />
                      {decisionsUnlockedBy(db, f.id).length > 0 && (
                        <div class="fx"><div class="fx-h">Unlocks decisions</div>{decisionsUnlockedBy(db, f.id).map((d) => <div class="fx-l" key={d}>{d}</div>)}</div>
                      )}
                      {f.prerequisites.length > 0 && (
                        <div class="fx"><div class="fx-h">Requires</div>{f.prerequisites.map((g, i) => <div class="fx-l" key={i}>{g.map((p) => byId.get(p)?.name ?? p).join(" or ")}</div>)}</div>
                      )}
                      <ConditionList db={db} trigger={f.available} title="Conditions" />
                      {f.mutually_exclusive.length > 0 && (
                        <div class="fx"><div class="fx-h">Excludes</div>{f.mutually_exclusive.map((m) => <div class="fx-l" key={m}>{byId.get(m)?.name ?? m}</div>)}</div>
                      )}
                    </>
                  ),
                  rows: [["Status", STATUS_LABEL[st]], ["Time", `${f.days} days`]],
                  note: st === "available" ? "Click to start." : undefined,
                }))}
              >
                <span class="fn-ic">
                  {Icon[focusIcon(f)]({ size: 28 })}
                  {(st === "locked" || st === "unavailable") && <span class="fn-badge lock">{Icon.lock({ size: 11 })}</span>}
                  {st === "excluded" && <span class="fn-badge excl">{Icon.close({ size: 11 })}</span>}
                  {st === "completed" && <span class="fn-badge done">{Icon.check({ size: 11 })}</span>}
                </span>
                <span class="fn-name">{f.name}</span>
                <span class="fn-bar"><span style={{ width: `${pct}%` }} /></span>
              </button>
            );
          })}
        </div>
        <div class="pz-hint faint small">Drag to pan · wheel to zoom</div>
      </div>
    </section>
  );
}
