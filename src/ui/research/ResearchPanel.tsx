/**
 * Research (HOI4 flow): the W tab opens the slots in the left panel. Clicking a slot opens the
 * technology tree beside it: one tab per category, one row per year, connector lines from
 * prerequisites to what they unlock, red double arrows between mutually exclusive technologies.
 * Drag to pan, wheel to zoom. Clicking an available technology puts it in that slot and closes
 * the tree.
 */
import { signal } from "@preact/signals";
import { useState } from "preact/hooks";
import type { ContentDB } from "../../content/compile.ts";
import type { TechDef } from "../../content/schemas/research.ts";
import { formatDate, ymdOf } from "../../sim/date.ts";
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

/** Equipment variants and buildings a technology unlocks. */
function unlocks(db: ContentDB, id: string): string[] {
  const out: string[] = [];
  for (const f of db.equipment.values()) for (const v of f.variants) if (v.requires_tech === id) out.push(`${v.name} (${f.name.toLowerCase()})`);
  for (const b of db.buildings.values()) if (b.requires_tech === id) out.push(`${b.name} (building)`);
  return out;
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

/** The research slot being filled: the tree opens beside the slots panel while it is set (HOI4 flow). */
export const researchPick = signal<number | null>(null);

/** Research tab (left panel): the slots. Click one to open the tree and choose what it researches. */
export function ResearchSlotsPanel({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const state = session.state;
  const cs = state?.player ? state.countries[state.player] : undefined;
  const r = cs?.research;
  if (!state || !cs || !r) return <p class="dim pad">No research for this country.</p>;
  const speed = researchSpeed(db, cs);
  const pick = researchPick.value;
  const year = ymdOf(state.day).year;
  const due = [...db.techs.values()].filter((t) => t.year <= year);
  return (
    <div class="rs-panel">
      <div class="cons-hero rs-hero">
        <div {...tip(() => ({ title: "Research speed", rows: [["Speed", `×${speed.total.toFixed(2)}`], ...speed.parts.map(([k, v]) => [k, pct(v)] as [string, string])], note: "R&D spending (World Bank 2000), policies and technologies." }))}>
          <div class="econ-big num">×{speed.total.toFixed(2)}</div>
          <div class="faint small">research speed</div>
        </div>
        <div {...tip(() => ({ title: "Researched", rows: [["Technologies", `${r.completed.length} of ${db.techs.size}`], [`Dated ${year} or earlier`, `${due.filter((t) => r.completed.includes(t.id)).length} of ${due.length}`]] }))}>
          <div class="econ-big num">{r.completed.length}</div>
          <div class="faint small">of {db.techs.size} researched</div>
        </div>
        <div {...tip(() => ({ title: "Research slots", rows: [["Slots", r.slots.length], ["Busy", r.slots.filter(Boolean).length]], note: "Bigger economies get more slots (GDP thresholds in data/techs/rules.json)." }))}>
          <div class={`econ-big num ${r.slots.some((x) => !x) ? "warn" : ""}`}>{r.slots.filter(Boolean).length}/{r.slots.length}</div>
          <div class="faint small">slots busy</div>
        </div>
      </div>
      <div class="hp-section">Research slots</div>
      <div class="rs-list">
        {r.slots.map((id, i) => {
          const t = id ? db.techs.get(id) : undefined;
          const cost = t ? techCost(db, t, state.day) : null;
          const p = t && cost ? Math.min(1, (r.progress[t.id] ?? 0) / cost.cost) : 0;
          const daysLeft = t && cost ? Math.ceil((cost.cost - (r.progress[t.id] ?? 0)) / speed.total) : 0;
          return (
            <div key={i} class={`rs-slot ${t ? "busy" : "empty"} ${pick === i ? "on" : ""}`} role="button" tabIndex={0}
              onClick={() => (researchPick.value = pick === i ? null : i)}
              {...tip(() => t
                ? { title: t.name, body: <span class="dim">{t.description}</span>, rows: [["Progress", `${Math.round(p * 100)}%`], ["Days left", daysLeft], ["Finishes about", formatDate(state.day + daysLeft)], ["Cost now", `${Math.round(cost!.cost)} days`], ["Year", t.year]], note: "Click to choose a different technology for this slot (progress is kept)." }
                : { title: `Research slot ${i + 1}`, note: "Empty. Click to choose a technology." })}>
              <span class="rs-ic">{t ? Icon[iconOf(db, t)]({ size: 26 }) : Icon.plus({ size: 20 })}</span>
              <span class="rs-txt">
                <span class="rs-name">{t?.name ?? "Choose research"}</span>
                <span class="faint small num">{t ? `${db.techCategories.get(t.category)?.name} · ${t.year} · ${daysLeft} days left` : `Slot ${i + 1} is idle`}</span>
                <span class="meter"><span style={{ width: `${p * 100}%` }} /></span>
              </span>
              {t && (
                <button class="tile mini rs-stop" aria-label="Stop" onClick={(e) => { e.stopPropagation(); session.dispatch({ type: "set_research", tag: cs.tag, slot: i, tech: null }); }}
                  {...tip(() => ({ title: "Stop", note: "Empties the slot; progress is kept for later." }))}>{Icon.close({ size: 11 })}</button>
              )}
            </div>
          );
        })}
      </div>
      <p class="faint small pad">Click a slot to open the technology tree and choose what it researches.</p>
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
  const slot = researchPick.value ?? 0;
  const assign = (id: string) => {
    const res = session.dispatch({ type: "set_research", tag, slot, tech: id });
    if (res.ok) researchPick.value = null;
    else setMsg(res.text);
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
        <h2 class="hp-title">Research slot {slot + 1}: choose a technology</h2>
        <span class="rv-speed dim small num" {...tip(() => ({ title: "Research speed", rows: [["Speed", `×${speed.total.toFixed(2)}`], ...speed.parts.map(([k, v]) => [k, pct(v)] as [string, string]), ["Researched", `${r.completed.length} of ${db.techs.size}`]], note: `Each technology has a year. Researching one early costs more, and each year ahead adds more than the last (${[1, 2, 3].map((n) => `+${Math.round((n * db.researchRules.ahead_penalty_per_year + n * n * db.researchRules.ahead_penalty_growth) * 100)}%`).join(", ")} for 1, 2, 3 years). Older ones are up to ${Math.round(db.researchRules.max_behind_bonus * 100)}% cheaper to catch up on.` }))}>
          Speed ×{speed.total.toFixed(2)} · {r.completed.length}/{db.techs.size}
        </span>
        {msg && <span class="faint small rv-msg">{msg}</span>}
        <div class="pz-tools">
          <button class="tile mini" aria-label="Zoom out" onClick={() => pz.zoomBy(0.8)} {...tip(() => ({ title: "Zoom out", note: "Or use the mouse wheel." }))}>{Icon.minus({ size: 12 })}</button>
          <button class="tile mini" aria-label="Zoom in" onClick={() => pz.zoomBy(1.25)} {...tip(() => ({ title: "Zoom in", note: "Or use the mouse wheel." }))}>{Icon.plus({ size: 12 })}</button>
        </div>
        <button class="x" onClick={() => (researchPick.value = null)} aria-label="Close">{Icon.close({ size: 14 })}</button>
      </header>
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
            const ahead = cost.yearsAhead;
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
                    ...unlocks(db, t.id).map((u) => ["Unlocks", u] as [string, string]),
                  ],
                  note: st === "available" ? `Click to research in slot ${slot + 1}.` : st === "locked" ? "Research the required technologies first." : undefined,
                }))}>
                <span class="rv-ic">{Icon[iconOf(db, t)]({ size: 24 })}</span>
                <span class="rv-body">
                  <span class="rv-name">{t.name}</span>
                  <span class="rv-meta num">
                    <span>{t.year}</span>
                    <span>{Math.round(cost.cost)}d</span>
                    {unlocks(db, t.id).length > 0 && <span class="rv-unlock" aria-label="Unlocks equipment or a building">{Icon.production({ size: 11 })}</span>}
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
