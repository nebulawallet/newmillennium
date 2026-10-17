/**
 * Selected divisions (HOI4 position: bottom left over the map). One division: strength,
 * organisation, entrenchment, its current order and where it stands. Several: a compact list with
 * bars, and totals. Divisions under manual orders can be returned to their army's plan here.
 */
import type { ContentDB } from "../../content/compile.ts";
import { divisionSymbol } from "../../sim/military/fronts.ts";
import { hostile } from "../../sim/military/war.ts";
import type { Division } from "../../sim/military/military.ts";
import { countryName } from "../../sim/politics/unrest.ts";
import { Icon } from "../icons.tsx";
import { version, type Session } from "../session.ts";
import { selectedDivisions, toast } from "../store.ts";
import { tip } from "../tooltip.tsx";
import { SYMBOL_NAME, symbolSvg } from "./symbols.ts";

const pct = (x: number) => `${Math.round(x * 100)}%`;

function orderOf(session: Session, d: Division): { text: string; cls: string } {
  const st = session.state!;
  const name = (p: number) => session.map.provinces[p - 1]?.name ?? "?";
  if (d.attacking) return { text: `Attacking ${name(d.attacking)}`, cls: "bad" };
  if (d.path.length) {
    const to = d.path[d.path.length - 1]!;
    const c = st.provinceController[to - 1];
    return c && hostile(st, d.owner, c) ? { text: `Advancing on ${name(to)}`, cls: "warn" } : { text: `Moving to ${name(to)} (${d.path.length} to go)`, cls: "" };
  }
  return { text: d.entrenchment > 0.05 ? "Holding, dug in" : "Holding", cls: "dim" };
}

export function DivisionPanel({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const st = session.state;
  const ids = new Set(selectedDivisions.value);
  if (!st?.player || !ids.size) return null;
  const ds = st.divisions.filter((d) => ids.has(d.id) && d.owner === st.player);
  if (!ds.length) return null;
  const color = db.countryColors.get(st.player) ?? "#888";
  const armyOf = (d: Division) => st.armies.find((a) => a.divisions.includes(d.id));
  const manual = ds.filter((d) => d.manual);
  const back = () => {
    for (const a of new Set(manual.map(armyOf).filter(Boolean))) toast.value = { text: session.dispatch({ type: "return_to_plan", tag: st.player!, army: a!.id }).text, at: Date.now() };
  };
  const stop = () => {
    for (const d of ds) session.dispatch({ type: "move_division", tag: st.player!, division: d.id, province: d.province });
    toast.value = { text: `${ds.length} division${ds.length > 1 ? "s" : ""} halted.`, at: Date.now() };
  };
  const one = ds.length === 1 ? ds[0]! : null;
  return (
    <section class="div-panel hp" aria-label="Selected divisions">
      <header class="hp-head">
        <span class="side-ic">{Icon.recruitment({ size: 16 })}</span>
        <h2 class="hp-title">{one ? one.name : `${ds.length} divisions`}</h2>
        <button class="x" onClick={() => (selectedDivisions.value = [])} aria-label="Deselect">{Icon.close({ size: 12 })}</button>
      </header>
      {one ? (
        <div class="dp-one">
          <div class="dp-sym" dangerouslySetInnerHTML={{ __html: symbolSvg(divisionSymbol(db, one.units), color) }} />
          <dl class="kv dp-kv">
            <dt>Type</dt><dd>{SYMBOL_NAME[divisionSymbol(db, one.units)]}</dd>
            <dt>Strength</dt><dd class="num" {...tip(() => ({ title: "Strength", rows: [["Equipment and manpower", pct(one.strength)]], note: "Lost in combat and out of supply; refits monthly from the stockpile." }))}><span class="dp-bar s"><i style={{ width: pct(one.strength) }} /></span>{pct(one.strength)}</dd>
            <dt>Organisation</dt><dd class="num" {...tip(() => ({ title: "Organisation", rows: [["Now", pct(one.organisation)]], note: "Falls in battle and on the march; recovers when resting. Divisions attack only above 60%." }))}><span class="dp-bar o"><i style={{ width: pct(one.organisation) }} /></span>{pct(one.organisation)}</dd>
            <dt>Entrenchment</dt><dd class="num" {...tip(() => ({ title: "Entrenchment", rows: [["Defence bonus", `+${pct(one.entrenchment)}`]], note: "Built up while standing still; lost on moving." }))}>+{pct(one.entrenchment)}</dd>
            <dt>Order</dt><dd class={orderOf(session, one).cls}>{orderOf(session, one).text}</dd>
            <dt>Location</dt><dd>{session.map.provinces[one.province - 1]?.name} <span class="faint">({countryName(db, st, st.provinceController[one.province - 1] ?? "")})</span></dd>
            <dt>Army</dt><dd>{armyOf(one)?.name ?? <span class="faint">None</span>}{one.manual ? <span class="warn"> · manual orders</span> : null}</dd>
          </dl>
        </div>
      ) : (
        <ul class="dp-list">
          {ds.slice(0, 14).map((d) => (
            <li key={d.id} {...tip(() => ({ title: d.name, rows: [["Strength", pct(d.strength)], ["Organisation", pct(d.organisation)], ["Order", orderOf(session, d).text], ["Army", armyOf(d)?.name ?? "None"]] }))}>
              <span dangerouslySetInnerHTML={{ __html: symbolSvg(divisionSymbol(db, d.units), color) }} />
              <span class="clip">{d.name}{d.manual ? " ·" : ""}</span>
              <span class="dp-bar s"><i style={{ width: pct(d.strength) }} /></span>
              <span class="dp-bar o"><i style={{ width: pct(d.organisation) }} /></span>
              <span class={`small clip ${orderOf(session, d).cls}`}>{orderOf(session, d).text}</span>
            </li>
          ))}
          {ds.length > 14 && <li class="faint small">and {ds.length - 14} more</li>}
        </ul>
      )}
      <footer class="dp-foot">
        <span class="faint small">Right-click a province: move, or attack an enemy.</span>
        <button class="btn" onClick={stop} {...tip(() => ({ title: "Halt", note: "Stops where they stand (a manual order)." }))}>Halt</button>
        {manual.length > 0 && <button class="btn primary" onClick={back} {...tip(() => ({ title: "Return to plan", note: `${manual.length} under manual orders go back to their army's battle plan.` }))}>Return to plan</button>}
      </footer>
    </section>
  );
}

/** Short messages (orders refused, plans set), fading after a few seconds. */
export function Toast() {
  const t = toast.value;
  if (!t || Date.now() - t.at > 4000) return null;
  setTimeout(() => { if (toast.value === t) toast.value = null; }, 4000 - (Date.now() - t.at));
  return <div class={`toast hp ${t.bad ? "bad" : ""}`} role="status">{t.text}</div>;
}
