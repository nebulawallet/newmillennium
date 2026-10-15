/**
 * Research tab (HOI4 position: left panel, key W): research slots on top, then one category's
 * technologies laid out by year (rows) and line (columns). Click an available technology to put
 * it in a free slot; click a slot to clear it.
 */
import { useState } from "preact/hooks";
import type { ContentDB } from "../../content/compile.ts";
import { ymdOf } from "../../sim/date.ts";
import { researchSpeed, techCost, techStatus } from "../../sim/research/research.ts";
import { version, type Session } from "../session.ts";
import { tip } from "../tooltip.tsx";

const pct = (x: number) => `${x >= 0 ? "+" : "−"}${Math.round(Math.abs(x) * 100)}%`;

function effectRows(db: ContentDB, effects: Record<string, number>): [string, string][] {
  return Object.entries(effects).map(([m, v]) => {
    const def = db.modifiers.get(m);
    return [def?.name ?? m, def?.display === "percent" ? pct(v) : `${v > 0 ? "+" : ""}${v}`];
  });
}

export function ResearchPanel({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const cats = [...db.techCategories.values()];
  const [catId, setCat] = useState(cats[0]?.id ?? "");
  const [msg, setMsg] = useState("");
  const state = session.state;
  const tag = state?.player;
  const cs = tag ? state?.countries[tag] : undefined;
  const r = cs?.research;
  if (!state || !tag || !cs || !r) return <p class="dim pad">No research for this country.</p>;
  const speed = researchSpeed(db, cs);
  const year = ymdOf(state.day).year;
  const cat = db.techCategories.get(catId) ?? cats[0]!;
  const techs = cat.techs.map((id) => db.techs.get(id)!).filter(Boolean);
  const years = [...new Set(techs.map((t) => t.year))].sort((a, b) => a - b);
  const cols = Math.max(...techs.map((t) => t.x)) + 1;
  const assign = (id: string) => {
    const free = r.slots.indexOf(null);
    if (free < 0) return setMsg("All research slots are busy. Clear one first.");
    setMsg(session.dispatch({ type: "set_research", tag, slot: free, tech: id }).text);
  };
  const done = (c: string) => db.techCategories.get(c)!.techs.filter((id) => r.completed.includes(id)).length;

  return (
    <div class="res">
      <div class="res-slots">
        {r.slots.map((id, i) => {
          const t = id ? db.techs.get(id) : undefined;
          const cost = t ? techCost(db, t, state.day) : null;
          const p = t && cost ? Math.min(1, (r.progress[t.id] ?? 0) / cost.cost) : 0;
          const daysLeft = t && cost ? Math.ceil((cost.cost - (r.progress[t.id] ?? 0)) / speed.total) : 0;
          return (
            <button key={i} class={`res-slot ${t ? "busy" : ""}`} onClick={() => t && session.dispatch({ type: "set_research", tag, slot: i, tech: null })}
              {...tip(() => t
                ? { title: t.name, rows: [["Progress", `${Math.round(p * 100)}%`], ["Days left", daysLeft], ["Cost", `${Math.round(cost!.cost)} days`], ["Year", t.year]], note: "Click to stop (progress is kept)." }
                : { title: `Research slot ${i + 1}`, note: "Empty. Pick a technology below." })}>
              <span class="rs-name clip">{t?.name ?? "Empty slot"}</span>
              <span class="meter"><span style={{ width: `${p * 100}%` }} /></span>
            </button>
          );
        })}
      </div>
      <div class="res-speed dim small" {...tip(() => ({ title: "Research speed", rows: [["Speed", `×${speed.total.toFixed(2)}`], ...speed.parts.map(([k, v]) => [k, pct(v)] as [string, string])], note: "Technologies have a year: researching one early costs 25% more per year ahead; catching up on older ones is cheaper." }))}>
        Research speed ×{speed.total.toFixed(2)} · {r.completed.length} of {db.techs.size} technologies
      </div>
      {msg && <p class="dim small pad">{msg}</p>}
      <div class="seg res-cats" role="tablist">
        {cats.map((c) => (
          <button key={c.id} role="tab" aria-selected={c.id === cat.id} class={c.id === cat.id ? "on" : ""} onClick={() => setCat(c.id)}
            {...tip(() => ({ title: c.name, body: <span class="dim">{c.description}</span>, rows: [["Researched", `${done(c.id)} of ${c.techs.length}`]] }))}>
            {c.name}
          </button>
        ))}
      </div>
      <div class="res-grid" style={{ gridTemplateColumns: `44px repeat(${cols}, 1fr)` }}>
        {years.map((y) => (
          <>
            <div class={`res-year num ${y > year ? "future" : ""}`} key={`y${y}`}>{y}</div>
            {Array.from({ length: cols }, (_, x) => {
              const t = techs.find((tt) => tt.year === y && tt.x === x);
              if (!t) return <div key={`${y}-${x}`} />;
              const st = techStatus(cs, t);
              const cost = techCost(db, t, state.day);
              const prereq = t.prerequisites.map((g) => g.map((p) => db.techs.get(p)?.name ?? p).join(" or "));
              return (
                <button key={t.id} class={`res-tech s-${st}`} onClick={() => st === "available" && assign(t.id)}
                  {...tip(() => ({
                    title: t.name,
                    body: <span class="dim">{t.description}</span>,
                    rows: [
                      ["Year", t.year],
                      ["Cost now", `${Math.round(cost.cost)} days${cost.factor > 1 ? ` (+${Math.round((cost.factor - 1) * 100)}% ahead of time)` : cost.factor < 1 ? ` (−${Math.round((1 - cost.factor) * 100)}% catching up)` : ""}`],
                      ...effectRows(db, t.effects),
                      ...prereq.map((p) => ["Requires", p] as [string, string]),
                    ],
                    note: st === "available" ? "Click to research." : st === "locked" ? "Research the required technologies first." : undefined,
                  }))}>
                  <span class="rt-name">{t.name}</span>
                  {st === "researching" && <span class="meter"><span style={{ width: `${Math.min(100, ((r.progress[t.id] ?? 0) / cost.cost) * 100)}%` }} /></span>}
                </button>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
