/**
 * National focus tree (HOI4 position: a large view opened from the focus tile beside the flag).
 * Nodes sit on the tree's grid; lines join prerequisites (dashed where any one of several is enough).
 */
import { useState } from "preact/hooks";
import type { ContentDB } from "../../content/compile.ts";
import type { FocusDef } from "../../content/schemas/scripted.ts";
import { focusStatus, type FocusStatus } from "../../sim/scripting/systems.ts";
import { Icon } from "../icons.tsx";
import { panel, version, type Session } from "../session.ts";
import { tip } from "../tooltip.tsx";
import { ConditionList, EffectList } from "./fx.tsx";

const CW = 132, CH = 104, PAD = 24;
const STATUS_LABEL: Record<FocusStatus, string> = {
  completed: "Completed",
  current: "In progress",
  available: "Available",
  locked: "Needs earlier focuses",
  excluded: "Excluded by another choice",
  unavailable: "Conditions not met",
};

export function FocusTreeView({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const [msg, setMsg] = useState("");
  const state = session.state;
  const sim = session.sim;
  const tag = state?.player;
  const cs = tag ? state?.countries[tag] : undefined;
  const tree = cs ? db.focusTrees.get(cs.focus.tree) : undefined;
  if (!state || !sim || !tag || !cs || !tree) return null;
  const ctx = sim.context;
  const byId = new Map(tree.focuses.map((f) => [f.id, f]));
  const cols = Math.max(...tree.focuses.map((f) => f.x)) + 1;
  const rows = Math.max(...tree.focuses.map((f) => f.y)) + 1;
  const W = cols * CW + PAD * 2, H = rows * CH + PAD * 2;
  const cx = (f: FocusDef) => PAD + f.x * CW + CW / 2;
  const cy = (f: FocusDef) => PAD + f.y * CH;
  const current = cs.focus.current ? byId.get(cs.focus.current) : undefined;

  const lines: preact.JSX.Element[] = [];
  for (const f of tree.focuses)
    for (const g of f.prerequisites)
      for (const p of g) {
        const from = byId.get(p);
        if (!from) continue;
        const done = cs.focus.completed.includes(p);
        lines.push(
          <path
            key={`${p}-${f.id}`}
            d={`M${cx(from)},${cy(from) + 44} V${(cy(from) + 44 + cy(f)) / 2} H${cx(f)} V${cy(f)}`}
            class={`fl ${done ? "done" : ""} ${g.length > 1 ? "or" : ""}`}
          />,
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
              Working on <b>{current.name}</b>: {cs.focus.progress} of {current.days} days
              <button class="lnk" onClick={() => setMsg(session.dispatch({ type: "cancel_focus", tag }).text)}> Cancel</button>
            </>
          ) : (
            "No focus selected. Pick an available focus."
          )}
          {msg && <span class="faint"> · {msg}</span>}
        </span>
        <button class="x" onClick={() => (panel.value = null)} aria-label="Close">{Icon.close({ size: 14 })}</button>
      </header>
      <div class="fv-body">
        <div class="fv-canvas" style={{ width: `${W}px`, height: `${H}px` }}>
          <svg class="fv-lines" width={W} height={H} aria-hidden="true">{lines}</svg>
          {tree.focuses.map((f) => {
            const st = focusStatus(ctx, cs, f);
            const pct = st === "current" ? Math.min(100, (cs.focus.progress / f.days) * 100) : st === "completed" ? 100 : 0;
            return (
              <button
                key={f.id}
                class={`fnode s-${st}`}
                style={{ left: `${cx(f) - CW / 2 + 8}px`, top: `${cy(f)}px`, width: `${CW - 16}px` }}
                onClick={() => st === "available" && setMsg(session.dispatch({ type: "set_focus", tag, focus: f.id }).text)}
                {...tip(() => ({
                  title: f.name,
                  body: (
                    <>
                      <span class="dim">{f.description}</span>
                      <EffectList db={db} effects={f.effects} />
                      <ConditionList db={db} trigger={f.available} />
                      {f.mutually_exclusive.length > 0 && (
                        <div class="fx"><div class="fx-h">Excludes</div>{f.mutually_exclusive.map((m) => <div class="fx-l" key={m}>{byId.get(m)?.name ?? m}</div>)}</div>
                      )}
                    </>
                  ),
                  rows: [["Status", STATUS_LABEL[st]], ["Time", `${f.days} days`]],
                }))}
              >
                <span class="fn-ic">{Icon.focus({ size: 20 })}</span>
                <span class="fn-name">{f.name}</span>
                {(st === "current" || st === "completed") && <span class="fn-bar"><span style={{ width: `${pct}%` }} /></span>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
