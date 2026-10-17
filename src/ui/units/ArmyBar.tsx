/**
 * Army cards along the bottom of the map (HOI4 position). Each card shows the commander slot
 * (empty: no commanders are modelled), the division count by type, strength and organisation, and
 * the battle plan's status, with execute/stop. The selected army gets a tool row: assign a front,
 * draw an offensive line or a spearhead arrow on the map, clear the plan, add the selected
 * divisions, disband. "New army" groups the selected divisions (or every unassigned one).
 */
import { useState } from "preact/hooks";
import type { ContentDB } from "../../content/compile.ts";
import { divisionSymbol, STATUS_TEXT, type Army, type MapSymbol } from "../../sim/military/fronts.ts";
import { hostile } from "../../sim/military/war.ts";
import { countryName } from "../../sim/politics/unrest.ts";
import { millerY } from "../../render/MapView.ts";
import { Icon } from "../icons.tsx";
import { version, type Session } from "../session.ts";
import { planDraft, planTool, selectedArmy, selectedDivisions } from "../store.ts";
import { tip } from "../tooltip.tsx";
import { SYMBOL_NAME, symbolSvg } from "./symbols.ts";

const pct = (x: number) => `${Math.round(x * 100)}%`;

function ArmyCard({ db, session, army }: { db: ContentDB; session: Session; army: Army }) {
  // children skip re-rendering when their props are unchanged: subscribe to the clock directly
  version.value;
  const state = session.state!;
  const ds = state.divisions.filter((d) => army.divisions.includes(d.id));
  const color = db.countryColors.get(army.owner) ?? "#666";
  const bySym = new Map<MapSymbol, number>();
  for (const d of ds) { const s = divisionSymbol(db, d.units); bySym.set(s, (bySym.get(s) ?? 0) + 1); }
  const str = ds.length ? ds.reduce((s, d) => s + d.strength, 0) / ds.length : 0;
  const org = ds.length ? ds.reduce((s, d) => s + d.organisation, 0) / ds.length : 0;
  const sel = selectedArmy.value === army.id;
  const pick = (e: MouseEvent) => {
    selectedArmy.value = army.id;
    selectedDivisions.value = army.divisions;
    if (e.detail >= 2 && ds[0]) {
      const p = session.map.provinces[ds[0].province - 1];
      if (p) session.world.view.lookAt(p.centroid[0], millerY(p.centroid[1]), 14);
    }
  };
  const canExecute = !!army.front && (army.offensive.length > 0 || army.spearheads.length > 0);
  return (
    <div class={`army-card ${sel ? "on" : ""} st-${army.status}`} role="button" tabIndex={0} onClick={pick}
      {...tip(() => ({
        title: army.name,
        rows: [
          ["Divisions", ds.length],
          ...[...bySym].map(([s, n]) => [SYMBOL_NAME[s], n] as [string, number]),
          ["Strength", pct(str)],
          ["Organisation", pct(org)],
          ["Front", army.front ? (army.front.enemy ? countryName(db, state, army.front.enemy) : "Every enemy") : "None"],
          ["Front provinces held", army.stretch?.length ?? 0],
          ["Offensive line", army.offensive.length ? `${army.offensive.length} provinces` : "None"],
          ["Spearheads", army.spearheads.length],
          ["Plan", army.executing ? "Executing" : "Holding"],
          ["Status", STATUS_TEXT[army.status]],
        ],
        note: "Click to select its divisions; double-click to find it on the map.",
      }))}>
      <div class="ac-top">
        <span class="ac-cmd" {...tip(() => ({ title: "Commander", note: "No commander assigned. Commanders are not modelled yet." }))}>{Icon.recruitment({ size: 18 })}</span>
        <div class="ac-main">
          <span class="ac-name clip">{army.name}</span>
          <span class="ac-syms">
            {[...bySym].map(([s, n]) => (
              <span key={s} class="ac-sym"><span dangerouslySetInnerHTML={{ __html: symbolSvg(s, color) }} /><b class="num">{n}</b></span>
            ))}
          </span>
        </div>
        <button class={`tile mini ac-exec ${army.executing ? "on" : ""}`} disabled={!canExecute && !army.executing}
          aria-label={army.executing ? "Stop" : "Execute"}
          onClick={(e) => { e.stopPropagation(); session.dispatch({ type: "execute_plan", tag: army.owner, army: army.id, on: !army.executing }); }}
          {...tip(() => ({ title: army.executing ? "Stop" : "Execute battle plan", note: canExecute || army.executing ? (army.executing ? "Divisions stop attacking and hold the front." : "Divisions attack toward the offensive line and along the spearheads.") : "Give the army a front and an offensive line or a spearhead first." }))}>
          {army.executing ? <span class="stop-sq" /> : Icon.play({ size: 12 })}
        </button>
      </div>
      <div class="ac-bars">
        <span class="ub"><i class="s" style={{ width: pct(str) }} /></span>
        <span class="ub"><i class="o" style={{ width: pct(org) }} /></span>
      </div>
      <div class="ac-status small">{STATUS_TEXT[army.status]}</div>
    </div>
  );
}

export function ArmyBar({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const [msg, setMsg] = useState("");
  const state = session.state;
  const me = state?.player;
  if (!state || !me) return null;
  const armies = state.armies.filter((a) => a.owner === me);
  const inArmy = new Set(armies.flatMap((a) => a.divisions));
  const unassigned = state.divisions.filter((d) => d.owner === me && !inArmy.has(d.id));
  const sel = armies.find((a) => a.id === selectedArmy.value);
  const enemies = [...new Set(state.wars.flatMap((w) => [...w.attackers, ...w.defenders]).filter((t) => hostile(state, me, t)))];
  const run = (c: Parameters<Session["dispatch"]>[0]) => setMsg(session.dispatch(c).text);
  const tool = planTool.value;
  const draw = (kind: "offensive" | "spearhead") => {
    if (!sel) return;
    planDraft.value = [];
    planTool.value = tool?.kind === kind ? null : { army: sel.id, kind };
    setMsg(planTool.value ? (kind === "offensive" ? "Drag across enemy provinces to draw the offensive line." : "Drag from the front into enemy land to draw the arrow.") : "");
  };
  const newArmy = () => {
    const picked = selectedDivisions.value.filter((id) => state.divisions.some((d) => d.id === id && d.owner === me));
    const ids = picked.length ? picked : unassigned.map((d) => d.id);
    const r = session.dispatch({ type: "create_army", tag: me, divisions: ids });
    setMsg(r.text);
    const a = session.state?.armies.filter((x) => x.owner === me).at(-1);
    if (r.ok && a) selectedArmy.value = a.id;
  };
  if (!armies.length && !state.divisions.some((d) => d.owner === me)) return null;

  return (
    <div class="army-dock">
      {sel && (
        <div class="army-tools hp">
          <span class="at-name">{sel.name}</span>
          <label class="at-front" {...tip(() => ({ title: "Front", note: "The army spreads along the border with this enemy and holds it. Every enemy: the whole front." }))}>
            {Icon.political({ size: 14 })}
            <select value={sel.front ? sel.front.enemy ?? "*" : ""} onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              run({ type: "set_front", tag: me, army: sel.id, enemy: v === "" ? false : v === "*" ? null : v });
            }} aria-label="Front">
              <option value="">No front</option>
              <option value="*">Every enemy</option>
              {enemies.map((t) => <option value={t} key={t}>{countryName(db, state, t)}</option>)}
            </select>
          </label>
          <button class={`btn ${tool?.kind === "offensive" ? "primary" : ""}`} onClick={() => draw("offensive")} {...tip(() => ({ title: "Offensive line", note: "Drag across the enemy provinces to push to. When executed, the army attacks the provinces between its front and the line." }))}>Offensive line</button>
          <button class={`btn ${tool?.kind === "spearhead" ? "primary" : ""}`} onClick={() => draw("spearhead")} {...tip(() => ({ title: "Spearhead", note: `Drag a path into enemy land. Its fastest divisions (about a third of the army) push along it province by province.` }))}>Spearhead</button>
          <button class="btn" onClick={() => run({ type: "clear_plan", tag: me, army: sel.id })} {...tip(() => ({ title: "Clear plan", note: "Removes the offensive line and spearheads; the army keeps holding its front." }))}>Clear</button>
          <button class="btn" disabled={!selectedDivisions.value.some((id) => !sel.divisions.includes(id))} onClick={() => run({ type: "assign_divisions", tag: me, army: sel.id, divisions: selectedDivisions.value })} {...tip(() => ({ title: "Add selected divisions", note: "Moves the selected divisions into this army." }))}>Add selected</button>
          <button class="btn danger" onClick={() => { run({ type: "disband_army", tag: me, army: sel.id }); selectedArmy.value = 0; }} {...tip(() => ({ title: "Disband", note: "The divisions stay where they are, without orders." }))}>Disband</button>
          {msg && <span class="faint small at-msg">{msg}</span>}
        </div>
      )}
      <div class="army-bar">
        {armies.map((a) => <ArmyCard key={a.id} db={db} session={session} army={a} />)}
        <button class="army-new" onClick={newArmy}
          {...tip(() => ({ title: "New army", rows: [["Selected divisions", selectedDivisions.value.length], ["Unassigned divisions", unassigned.length]], note: "Groups the selected divisions into a new army, or every unassigned division when none are selected." }))}>
          {Icon.plus({ size: 16 })}
          <span class="small">New army</span>
          <span class="faint small num">{unassigned.length} free</span>
        </button>
      </div>
      {!sel && msg && <p class="faint small at-msg-solo">{msg}</p>}
    </div>
  );
}
