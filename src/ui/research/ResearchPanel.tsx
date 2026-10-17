/**
 * Research screen (HOI4 position: a large view opened from the W tab). Research slots run along
 * the top, one tab per category below them, and the category's tree fills the rest: one row per
 * year, connector lines from prerequisites to what they unlock, red double arrows between
 * mutually exclusive technologies. Drag to pan, wheel to zoom. Click an available technology to
 * put it in a free slot; click a busy slot to stop it (progress is kept).
 */
import { useState } from "preact/hooks";
import type { ContentDB } from "../../content/compile.ts";
import type { TechDef } from "../../content/schemas/research.ts";
import { ymdOf } from "../../sim/date.ts";
import { researchSpeed, techCost, techStatus, type TechStatus } from "../../sim/research/research.ts";
import type { CountryState } from "../../sim/state.ts";
import { Icon, type IconName } from "../icons.tsx";
import { usePanZoom } from "../panzoom.ts";
import { panel, version, type Session } from "../session.ts";
import { tip } from "../tooltip.tsx";

const pct = (x: number) => `${x >= 0 ? "+" : "−"}${Math.round(Math.abs(x) * 100)}%`;
/** Card size, column pitch, year row pitch, the year gutter and outer padding. */
const CARD_W = 184, CARD_H = 58, COL = 214, ROW = 84, GUTTER = 70, PAD = 28;
const STATUS: Record<TechStatus, string> = {
  completed: "Researched",
  researching: "Being researched",
  available: "Available",
  locked: "Needs earlier technologies",
  excluded: "Closed by a mutually exclusive choice",
};

function effectRows(db: ContentDB, effects: Record<string, number>): [string, string][] {
  return Object.entries(effects).map(([m, v]) => {
    const def = db.modifiers.get(m);
    return [def?.name ?? m, def?.display === "percent" ? pct(v) : `${v > 0 ? "+" : ""}${v}`];
  });
}

const iconOf = (db: ContentDB, t: TechDef & { category: string }): IconName => {
  const name = t.icon ?? db.techCategories.get(t.category)?.icon;
  return name && name in Icon ? (name as IconName) : "research";
};

/** Year rows and card positions for one category (distinct years top to bottom, columns from `x`). */
function layout(techs: (TechDef & { category: string })[]) {
  const years = [...new Set(techs.map((t) => t.year))].sort((a, b) => a - b);
  const row = new Map(years.map((y, i) => [y, i]));
  const used = new Set<string>();
  const pos = new Map<string, { x: number; y: number }>();
  for (const t of [...techs].sort((a, b) => a.year - b.year || a.x - b.x)) {
    const r = row.get(t.year)!;
    let c = t.x;
    while (used.has(`${r}:${c}`)) c++; // two technologies in one cell: the later one moves right
    used.add(`${r}:${c}`);
    pos.set(t.id, { x: GUTTER + PAD + c * COL, y: PAD + r * ROW });
  }
  const cols = Math.max(1, ...[...used].map((k) => Number(k.split(":")[1]) + 1));
  return { years, pos, width: GUTTER + PAD * 2 + cols * COL - (COL - CARD_W), height: PAD * 2 + years.length * ROW - (ROW - CARD_H) };
}

function Slots({ db, session, cs, speed }: { db: ContentDB; session: Session; cs: CountryState; speed: number }) {
  version.value; // unchanged props skip re-rendering: follow the clock directly
  const r = cs.research!;
  const state = session.state!;
  return (
    <div class="rv-slots">
      {r.slots.map((id, i) => {
        const t = id ? db.techs.get(id) : undefined;
        const cost = t ? techCost(db, t, state.day) : null;
        const p = t && cost ? Math.min(1, (r.progress[t.id] ?? 0) / cost.cost) : 0;
        const daysLeft = t && cost ? Math.ceil((cost.cost - (r.progress[t.id] ?? 0)) / speed) : 0;
        return (
          <button key={i} class={`rv-slot ${t ? "busy" : ""}`} onClick={() => t && session.dispatch({ type: "set_research", tag: cs.tag, slot: i, tech: null })}
            {...tip(() => t
              ? { title: t.name, rows: [["Progress", `${Math.round(p * 100)}%`], ["Days left", daysLeft], ["Cost", `${Math.round(cost!.cost)} days`], ["Year", t.year]], note: "Click to stop (progress is kept)." }
              : { title: `Research slot ${i + 1}`, note: "Empty. Click an available technology to start it." })}>
            <span class="rv-slot-ic">{t ? Icon[iconOf(db, t)]({ size: 20 }) : <span class="num">{i + 1}</span>}</span>
            <span class="rv-slot-txt">
              <span class="clip">{t?.name ?? "Empty slot"}</span>
              <span class="faint small num">{t ? `${daysLeft} days` : "Idle"}</span>
            </span>
            <span class="meter"><span style={{ width: `${p * 100}%` }} /></span>
          </button>
        );
      })}
    </div>
  );
}

export function ResearchView({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const cats = [...db.techCategories.values()];
  const [catId, setCat] = useState(cats[0]?.id ?? "");
  const [msg, setMsg] = useState("");
  const state = session.state;
  const tag = state?.player;
  const cs = tag ? state?.countries[tag] : undefined;
  const r = cs?.research;
  const cat = db.techCategories.get(catId) ?? cats[0];
  const techs = (cat?.techs ?? []).map((id) => db.techs.get(id)!).filter(Boolean);
  const L = layout(techs);
  const year = state ? ymdOf(state.day).year : 2000;
  // open on the first unresearched technology of this category (the frontier)
  const frontier = r ? techs.filter((t) => !r.completed.includes(t.id)).sort((a, b) => a.year - b.year)[0] : undefined;
  const fp = frontier ? L.pos.get(frontier.id) : undefined;
  const pz = usePanZoom(L.width, L.height, fp ? [fp.x + CARD_W / 2, fp.y + CARD_H / 2] : null, catId);
  if (!state || !tag || !cs || !r || !cat) return null;
  const speed = researchSpeed(db, cs);
  const assign = (id: string) => {
    const free = r.slots.indexOf(null);
    if (free < 0) return setMsg("All research slots are busy. Stop one first.");
    setMsg(session.dispatch({ type: "set_research", tag, slot: free, tech: id }).text);
  };
  const done = (c: string) => db.techCategories.get(c)!.techs.filter((id) => r.completed.includes(id)).length;

  const lines: preact.JSX.Element[] = [];
  for (const t of techs) {
    const b = L.pos.get(t.id)!;
    t.prerequisites.forEach((g, gi) => {
      for (const p of g) {
        const a = L.pos.get(p);
        if (!a) continue; // a prerequisite in another category: named in the tooltip
        const x0 = a.x + CARD_W / 2, y0 = a.y + CARD_H, x1 = b.x + CARD_W / 2, y1 = b.y;
        const mid = y1 - 12;
        const d = a.y === b.y
          ? `M${a.x + (a.x < b.x ? CARD_W : 0)},${a.y + CARD_H / 2} H${b.x + (a.x < b.x ? 0 : CARD_W)}`
          : `M${x0},${y0} V${mid} H${x1} V${y1}`;
        lines.push(<path key={`${p}-${t.id}-${gi}`} d={d} class={`fl ${r.completed.includes(p) ? "done" : ""} ${g.length > 1 ? "or" : ""}`} />);
      }
    });
  }
  const seen = new Set<string>();
  const excl: preact.JSX.Element[] = [];
  for (const t of techs)
    for (const m of t.mutually_exclusive) {
      const key = [t.id, m].sort().join("|");
      const a0 = L.pos.get(t.id), b0 = L.pos.get(m);
      if (!b0 || !a0 || seen.has(key)) continue;
      seen.add(key);
      const [a, b] = a0.x <= b0.x ? [a0, b0] : [b0, a0];
      const xa = a.x + CARD_W, ya = a.y + CARD_H / 2, xb = b.x, yb = b.y + CARD_H / 2;
      const mx = (xa + xb) / 2, my = (ya + yb) / 2;
      excl.push(
        <g key={key} class="fx-excl">
          <path d={`M${xa},${ya} L${xb},${yb}`} />
          <g transform={`translate(${mx - 11},${my - 11})`}><rect width="22" height="22" /><path d="M5 11h12M8 8l-3 3 3 3M14 8l3 3-3 3" /></g>
        </g>,
      );
    }

  return (
    <section class="research-view hp" aria-label="Research">
      <header class="hp-head">
        <span class="side-ic">{Icon.research({ size: 18 })}</span>
        <h2 class="hp-title">Research</h2>
        <span class="rv-speed dim small num" {...tip(() => ({ title: "Research speed", rows: [["Speed", `×${speed.total.toFixed(2)}`], ...speed.parts.map(([k, v]) => [k, pct(v)] as [string, string]), ["Researched", `${r.completed.length} of ${db.techs.size}`]], note: `Each technology has a year. Researching one early costs ${Math.round(db.researchRules.ahead_penalty_per_year * 100)}% more per year ahead; older ones are cheaper to catch up on.` }))}>
          Speed ×{speed.total.toFixed(2)} · {r.completed.length}/{db.techs.size}
        </span>
        {msg && <span class="faint small rv-msg">{msg}</span>}
        <div class="pz-tools">
          <button class="tile mini" aria-label="Zoom out" onClick={() => pz.zoomBy(0.8)} {...tip(() => ({ title: "Zoom out", note: "Or use the mouse wheel." }))}>{Icon.minus({ size: 12 })}</button>
          <button class="tile mini" aria-label="Zoom in" onClick={() => pz.zoomBy(1.25)} {...tip(() => ({ title: "Zoom in", note: "Or use the mouse wheel." }))}>{Icon.plus({ size: 12 })}</button>
        </div>
        <button class="x" onClick={() => (panel.value = null)} aria-label="Close">{Icon.close({ size: 14 })}</button>
      </header>
      <Slots db={db} session={session} cs={cs} speed={speed.total} />
      <nav class="rv-tabs" role="tablist">
        {cats.map((c) => {
          const ic = c.icon && c.icon in Icon ? (c.icon as IconName) : "research";
          return (
            <button key={c.id} role="tab" aria-selected={c.id === cat.id} class={`rv-tab ${c.id === cat.id ? "on" : ""}`} onClick={() => setCat(c.id)}
              {...tip(() => ({ title: c.name, body: <span class="dim">{c.description}</span>, rows: [["Researched", `${done(c.id)} of ${c.techs.length}`]] }))}>
              {Icon[ic]({ size: 18 })}
              <span class="rv-tab-name">{c.name}</span>
              <span class="rv-tab-n num">{done(c.id)}/{c.techs.length}</span>
            </button>
          );
        })}
      </nav>
      <div ref={pz.ref} {...pz.viewportProps}>
        <div class="pz-canvas" style={pz.canvasStyle}>
          {L.years.map((y, i) => (
            <div key={y} class={`rv-year ${y === year ? "now" : y > year ? "future" : ""}`} style={{ top: `${PAD + i * ROW - (ROW - CARD_H) / 2}px`, height: `${ROW}px`, width: `${L.width}px` }}>
              <span class="num">{y}</span>
            </div>
          ))}
          <svg class="fv-lines" width={L.width} height={L.height} aria-hidden="true">{lines}{excl}</svg>
          {techs.map((t) => {
            const p = L.pos.get(t.id)!;
            const st = techStatus(cs, t);
            const cost = techCost(db, t, state.day);
            const ahead = Math.max(0, t.year - year);
            const prog = st === "researching" ? Math.min(100, ((r.progress[t.id] ?? 0) / cost.cost) * 100) : st === "completed" ? 100 : 0;
            const prereq = t.prerequisites.map((g) => g.map((q) => db.techs.get(q)?.name ?? q).join(" or "));
            return (
              <button key={t.id} class={`rv-card s-${st}`} style={{ left: `${p.x}px`, top: `${p.y}px`, width: `${CARD_W}px`, height: `${CARD_H}px` }}
                onClick={() => st === "available" && assign(t.id)}
                {...tip(() => ({
                  title: t.name,
                  body: <span class="dim">{t.description}</span>,
                  rows: [
                    ["Status", STATUS[st]],
                    ["Year", t.year],
                    ["Cost now", `${Math.round(cost.cost)} days${cost.factor > 1 ? ` (+${Math.round((cost.factor - 1) * 100)}% ahead of time)` : cost.factor < 1 ? ` (−${Math.round((1 - cost.factor) * 100)}% catching up)` : ""}`],
                    ["Base cost", `${t.cost} days`],
                    ...effectRows(db, t.effects),
                    ...prereq.map((q) => ["Requires", q] as [string, string]),
                    ...t.mutually_exclusive.map((m) => ["Excludes", db.techs.get(m)?.name ?? m] as [string, string]),
                  ],
                  note: st === "available" ? "Click to research." : st === "locked" ? "Research the required technologies first." : undefined,
                }))}>
                <span class="rv-ic">{Icon[iconOf(db, t)]({ size: 24 })}</span>
                <span class="rv-body">
                  <span class="rv-name">{t.name}</span>
                  <span class="rv-meta num">
                    <span>{t.year}</span>
                    <span>{Math.round(cost.cost)}d</span>
                    {ahead > 0 && st !== "completed" && <span class="rv-ahead">+{ahead}y</span>}
                  </span>
                </span>
                {(st === "locked" || st === "excluded") && <span class="fn-badge lock">{st === "locked" ? Icon.lock({ size: 10 }) : Icon.close({ size: 10 })}</span>}
                <span class="rv-bar"><span style={{ width: `${prog}%` }} /></span>
              </button>
            );
          })}
        </div>
        <div class="pz-hint faint small">Drag to pan · wheel to zoom</div>
      </div>
    </section>
  );
}
