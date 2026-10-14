/** Decisions tab (HOI4 position: left panel, key P): decisions by category with cost and conditions. */
import { useState } from "preact/hooks";
import type { ContentDB } from "../../content/compile.ts";
import { decisionStatus } from "../../sim/scripting/systems.ts";
import { version, type Session } from "../session.ts";
import { tip } from "../tooltip.tsx";
import { ConditionList, EffectList } from "./fx.tsx";

export function DecisionsPanel({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const [msg, setMsg] = useState("");
  const state = session.state;
  const sim = session.sim;
  const tag = state?.player;
  const cs = tag ? state?.countries[tag] : undefined;
  if (!state || !sim || !tag || !cs) return null;
  const ctx = sim.context;
  const active = cs.activeDecisions.map((a) => ({ a, d: db.decisions.get(a.id) })).filter((x) => x.d);
  const cats = [...db.decisionCategories.values()];
  return (
    <div class="dec">
      {msg && <p class="dim small pad">{msg}</p>}
      {active.length > 0 && (
        <>
          <div class="hp-section">In effect</div>
          <ul class="dec-list">
            {active.map(({ a, d }) => (
              <li class="dec-item on" key={a.id} {...tip(() => ({ title: d!.name, body: <EffectList db={db} effects={d!.complete_effects} title="When it ends" /> }))}>
                <span class="dec-name">{d!.name}</span>
                <span class="num faint">{a.until - state.day} days left</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {cats.map((cat) => {
        const items = [...db.decisions.values()].filter((d) => d.category === cat.id).map((d) => ({ d, st: decisionStatus(ctx, cs, d) })).filter((x) => x.st.visible);
        if (!items.length) return null;
        return (
          <div key={cat.id}>
            <div class="hp-section" {...tip(() => ({ title: cat.name, body: <span class="dim">{cat.description}</span> }))}>{cat.name}</div>
            <ul class="dec-list">
              {items.map(({ d, st }) => (
                <li class={`dec-item ${st.available ? "" : "off"}`} key={d.id}>
                  <div class="dec-main" {...tip(() => ({
                    title: d.name,
                    body: (
                      <>
                        <span class="dim">{d.description}</span>
                        <EffectList db={db} effects={d.effects} />
                        {d.days && <EffectList db={db} effects={d.complete_effects} title={`After ${d.days} days`} />}
                        <ConditionList db={db} trigger={d.available} />
                      </>
                    ),
                    note: st.reasons.join(" ") || undefined,
                  }))}>
                    <span class="dec-name">{d.name}</span>
                    <span class="faint small">{d.description}</span>
                  </div>
                  <span class={`num dec-cost ${cs.politicalPower >= d.cost.political_power ? "" : "bad"}`} {...tip(() => ({ title: "Cost", rows: [["Political power", d.cost.political_power], ["Available", Math.floor(cs.politicalPower)]] }))}>
                    {d.cost.political_power} PP
                  </span>
                  <button class="btn" disabled={!st.available} onClick={() => setMsg(session.dispatch({ type: "take_decision", tag, decision: d.id }).text)}>
                    Take
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
