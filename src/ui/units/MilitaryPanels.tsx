/**
 * Production tab (Y): production lines and the equipment stockpile.
 * Recruitment tab (U): manpower, division templates (a simple designer) and training.
 */
import { useState } from "preact/hooks";
import type { ContentDB } from "../../content/compile.ts";
import { factories } from "../../sim/economy/economy.ts";
import { availableVariants, manpowerPool, templateNeeds, templateStats, variantOf, type Template } from "../../sim/military/military.ts";
import { version, type Session } from "../session.ts";
import { tip } from "../tooltip.tsx";

const fmt = (n: number) => Math.round(n).toLocaleString("en");

function familyStock(db: ContentDB, stock: Record<string, number>, family: string): number {
  return (db.equipment.get(family)?.variants ?? []).reduce((s, v) => s + Math.floor(stock[v.id] ?? 0), 0);
}

export function ProductionPanel({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const [msg, setMsg] = useState("");
  const [family, setFamily] = useState("infantry_equipment");
  const state = session.state;
  const tag = state?.player;
  const cs = tag ? state?.countries[tag] : undefined;
  const m = cs?.military;
  if (!state || !tag || !cs || !m || !cs.economy) return <p class="dim pad">No military for this country.</p>;
  const mil = factories(db, cs.economy).mil;
  const used = m.lines.reduce((s, l) => s + l.factories, 0);
  const needed: Record<string, number> = {};
  for (const d of state.divisions.filter((x) => x.owner === tag)) for (const [f, c] of Object.entries(templateNeeds(db, d.units))) needed[f] = (needed[f] ?? 0) + c;
  return (
    <div class="prod">
      <dl class="kv">
        <dt>Military factories</dt>
        <dd class={`num ${used > mil ? "warn" : ""}`} {...tip(() => ({ title: "Military factories", rows: [["Available", mil], ["Assigned to lines", used]], note: used > mil ? "More factories are assigned than exist: every line runs slower." : "Build more in the Construction tab." }))}>
          {used} of {mil} assigned
        </dd>
      </dl>
      <div class="hp-section">Production lines</div>
      {m.lines.length === 0 && <p class="faint small pad">No production lines.</p>}
      <ul class="dec-list">
        {m.lines.map((l) => {
          const v = variantOf(db, l.variant)?.variant;
          const perMonth = v ? (l.factories * l.efficiency * 30) / v.cost : 0;
          return (
            <li class="dec-item" key={l.id}>
              <div class="dec-main" {...tip(() => ({ title: v?.name ?? l.variant, rows: [["Factories", l.factories], ["Efficiency", `${Math.round(l.efficiency * 100)}%`], ["Cost", `${v?.cost} factory-days each`], ["Output", `${perMonth.toFixed(1)} a month`]], note: "Efficiency grows while a line keeps producing the same equipment." }))}>
                <span class="dec-name">{v?.name ?? l.variant}</span>
                <span class="faint small num">{perMonth.toFixed(1)} a month · efficiency {Math.round(l.efficiency * 100)}%</span>
              </div>
              <span class="row-act">
                <button class="tile mini" aria-label="Fewer factories" onClick={() => session.dispatch({ type: "set_line_factories", tag, line: l.id, factories: l.factories - 1 })}>−</button>
                <b class="num">{l.factories}</b>
                <button class="tile mini" aria-label="More factories" onClick={() => session.dispatch({ type: "set_line_factories", tag, line: l.id, factories: l.factories + 1 })}>+</button>
              </span>
              <button class="btn" onClick={() => session.dispatch({ type: "remove_production_line", tag, line: l.id })}>Close</button>
            </li>
          );
        })}
      </ul>
      <div class="prod-add">
        <select value={family} onChange={(e) => setFamily((e.target as HTMLSelectElement).value)} aria-label="Equipment">
          {[...db.equipment.values()].map((e) => {
            const vs = availableVariants(db, cs, e.id);
            return <option key={e.id} value={e.id} disabled={!vs.length}>{e.name}{vs.length ? ` (${vs[vs.length - 1]!.name})` : " (needs research)"}</option>;
          })}
        </select>
        <button class="btn" onClick={() => setMsg(session.dispatch({ type: "add_production_line", tag, equipment: family, factories: Math.max(1, Math.min(5, mil - used)) }).text)}>New line</button>
      </div>
      {msg && <p class="dim small pad">{msg}</p>}
      <div class="hp-section">Stockpile</div>
      <table class="tbl">
        <thead><tr><th></th><th>Equipment</th><th class="r">Stock</th><th class="r">In units</th></tr></thead>
        <tbody>
          {[...db.equipment.values()].map((e) => {
            const stock = familyStock(db, m.stockpile, e.id);
            return (
              <tr key={e.id} {...tip(() => ({ title: e.name, body: <span class="dim">{e.description}</span>, rows: e.variants.map((v) => [v.name, fmt(m.stockpile[v.id] ?? 0)] as [string, string]) }))}>
                <td></td>
                <td>{e.name}</td>
                <td class="r num">{fmt(stock)}</td>
                <td class="r num faint">{fmt(needed[e.id] ?? 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RecruitmentPanel({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const [msg, setMsg] = useState("");
  const [draft, setDraft] = useState<Template | null>(null);
  const state = session.state;
  const tag = state?.player;
  const cs = tag ? state?.countries[tag] : undefined;
  const m = cs?.military;
  if (!state || !tag || !cs || !m) return <p class="dim pad">No military for this country.</p>;
  const divisions = state.divisions.filter((d) => d.owner === tag);
  const edit = (t: Template) => setDraft({ ...t, units: { ...t.units } });
  const bump = (u: string, by: number) => draft && setDraft({ ...draft, units: { ...draft.units, [u]: Math.max(0, (draft.units[u] ?? 0) + by) } });
  return (
    <div class="recr">
      <dl class="kv">
        <dt>Manpower</dt>
        <dd class="num" {...tip(() => ({ title: "Manpower", rows: [["Available", fmt(m.manpower)], ["Pool (conscription law)", fmt(manpowerPool(db, cs))]], note: "The conscription law sets how much of the population can serve. Available manpower recovers each month." }))}>
          {fmt(m.manpower)}
        </dd>
        <dt>Divisions</dt>
        <dd class="num">{divisions.length}{m.training.length ? ` · ${m.training.length} in training` : ""}</dd>
      </dl>
      {m.training.length > 0 && (
        <ul class="dec-list">
          {m.training.map((t, i) => {
            const tpl = m.templates.find((x) => x.id === t.template);
            return (
              <li class="dec-item" key={i}>
                <div class="dec-main"><span class="dec-name">{tpl?.name}</span><span class="meter"><span style={{ width: `${(t.progress / t.days) * 100}%` }} /></span></div>
                <span class="num faint">{t.days - t.progress} days</span>
                <span />
              </li>
            );
          })}
        </ul>
      )}
      {msg && <p class="dim small pad">{msg}</p>}
      <div class="hp-section">Division templates</div>
      <ul class="dec-list">
        {m.templates.map((t) => {
          const st = templateStats(db, t.units);
          return (
            <li class="dec-item" key={t.id}>
              <div class="dec-main" {...tip(() => ({ title: t.name, rows: [["Manpower", fmt(st.manpower)], ["Combat width", st.width], ["Speed", `${st.speed} km/h`], ["Training", `${st.training} days`], ...Object.entries(templateNeeds(db, t.units)).map(([f, c]) => [db.equipment.get(f)?.name ?? f, c] as [string, number])], note: Object.entries(t.units).map(([u, n]) => `${n} × ${db.subUnits.get(u)?.name ?? u}`).join(", ") }))}>
                <span class="dec-name">{t.name}</span>
                <span class="faint small num">{fmt(st.manpower)} troops · width {st.width} · {st.speed} km/h</span>
              </div>
              <button class="btn" onClick={() => edit(t)}>Edit</button>
              <button class="btn primary" disabled={m.manpower < st.manpower} onClick={() => setMsg(session.dispatch({ type: "train_division", tag, template: t.id }).text)}>Train</button>
            </li>
          );
        })}
      </ul>
      <div class="pad"><button class="btn" onClick={() => edit({ id: `custom_${Date.now() % 100000}`, name: "New division", units: { infantry: 6 } })}>New template</button></div>
      {draft && (
        <div class="designer hp-well">
          <input class="tpl-name" value={draft.name} onInput={(e) => setDraft({ ...draft, name: (e.target as HTMLInputElement).value })} aria-label="Template name" />
          {[...db.subUnits.values()].map((s) => (
            <div class="budget-row" key={s.id} {...tip(() => ({ title: s.name, body: <span class="dim">{s.description}</span>, rows: [["Manpower", s.manpower], ["Width", s.width], ["Speed", `${s.speed} km/h`], ...Object.entries(s.equipment).map(([f, c]) => [db.equipment.get(f)?.name ?? f, c] as [string, number])] }))}>
              <span>{s.name}</span>
              <span class="row-act">
                <button class="tile mini" onClick={() => bump(s.id, -1)}>−</button>
                <b class="num">{draft.units[s.id] ?? 0}</b>
                <button class="tile mini" onClick={() => bump(s.id, 1)}>+</button>
              </span>
            </div>
          ))}
          <div class="dim small">Width {templateStats(db, draft.units).width} of {db.militaryRules.max_division_width} · {fmt(templateStats(db, draft.units).manpower)} troops</div>
          <div class="row2">
            <button class="btn primary" onClick={() => { const r = session.dispatch({ type: "set_template", tag, template: draft }); setMsg(r.text); if (r.ok) setDraft(null); }}>Save template</button>
            <button class="btn" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Logistics tab (I): equipment shortfalls in the field and supply where divisions stand. */
export function LogisticsPanel({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const state = session.state;
  const tag = state?.player;
  const m = tag ? state?.countries[tag]?.military : undefined;
  const map = session.simMap;
  if (!state || !tag || !m) return <p class="dim pad">No military for this country.</p>;
  const mine = state.divisions.filter((d) => d.owner === tag);
  // equipment: what the divisions' templates need against what they hold
  const need: Record<string, number> = {}, have: Record<string, number> = {};
  for (const d of mine) {
    for (const [f, c] of Object.entries(templateNeeds(db, d.units))) {
      need[f] = (need[f] ?? 0) + c;
      const ids = new Set(db.equipment.get(f)?.variants.map((v) => v.id));
      have[f] = (have[f] ?? 0) + Object.entries(d.equipment).filter(([v]) => ids.has(v)).reduce((s, [, n]) => s + n, 0);
    }
  }
  // supply: divisions per province against what the province can supply
  const r = db.warRules;
  const byProvince = new Map<number, number>();
  for (const d of mine) byProvince.set(d.province, (byProvince.get(d.province) ?? 0) + 1);
  const supply = [...byProvince.entries()].map(([p, n]) => {
    const prov = map?.provinces[p - 1] as { name?: string; infrastructure?: number } | undefined;
    const infra = (prov?.infrastructure ?? 3) + (state.provinceBuildings[String(p)]?.infrastructure ?? 0);
    const own = state.provinceController[p - 1] === tag;
    const cap = (r.supply_base + r.supply_per_infrastructure * infra) * (own ? 1 : 0.5);
    return { p, name: prov?.name ?? `Province ${p}`, n, cap, own };
  }).sort((a, b) => b.n / b.cap - a.n / a.cap);
  const over = supply.filter((s) => s.n > s.cap);
  return (
    <div class="prod">
      <div class="hp-section">Equipment in the field</div>
      <table class="tbl">
        <thead><tr><th>Equipment</th><th class="r">Needed</th><th class="r">Held</th><th class="r">Stockpile</th></tr></thead>
        <tbody>
          {Object.keys(need).map((f) => {
            const short = need[f]! - (have[f] ?? 0);
            return (
              <tr key={f} {...tip(() => ({ title: db.equipment.get(f)?.name ?? f, rows: [["Needed by your divisions", fmt(need[f]!)], ["Held by them", fmt(have[f] ?? 0)], ["Shortfall", fmt(Math.max(0, short))], ["In the stockpile", fmt(familyStock(db, m.stockpile, f))]], note: "Divisions refit from the stockpile each month; produce more in the Production tab." }))}>
                <td>{db.equipment.get(f)?.name ?? f}</td>
                <td class="r num">{fmt(need[f]!)}</td>
                <td class={`r num ${short > 0 ? "logi-over" : ""}`}>{fmt(have[f] ?? 0)}</td>
                <td class="r num">{fmt(familyStock(db, m.stockpile, f))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div class="hp-section">Supply</div>
      <p class="faint small pad">A province supplies {r.supply_base} divisions plus {r.supply_per_infrastructure} per infrastructure level, half that in enemy territory. Divisions beyond it lose {(r.out_of_supply_attrition * 100).toFixed(1)}% strength a day. {over.length ? `${over.length} province${over.length === 1 ? " is" : "s are"} over the limit.` : "All your divisions are in supply."}</p>
      <table class="tbl">
        <thead><tr><th>Province</th><th class="r">Divisions</th><th class="r">Supplies</th></tr></thead>
        <tbody>
          {supply.slice(0, 30).map((s) => (
            <tr key={s.p} {...tip(() => ({ title: s.name, rows: [["Divisions", s.n], ["Can supply", s.cap.toFixed(1)], ["Territory", s.own ? "own" : "enemy (half supply)"]] }))}>
              <td>{s.name}</td>
              <td class={`r num ${s.n > s.cap ? "logi-over" : ""}`}>{s.n}</td>
              <td class="r num">{s.cap.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
