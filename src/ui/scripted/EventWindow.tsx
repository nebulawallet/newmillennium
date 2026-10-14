/** Event window (HOI4 position: centred): the player's oldest pending event with its options. */
import type { ContentDB } from "../../content/compile.ts";
import { formatDate } from "../../sim/date.ts";
import { describeEffects, describeTrigger, evalTrigger } from "../../sim/scripting/engine.ts";
import { Icon } from "../icons.tsx";
import { electionNight, version, type Session } from "../session.ts";
import { tip } from "../tooltip.tsx";

export function EventWindow({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const state = session.state;
  const sim = session.sim;
  const pe = state?.pendingEvents.find((p) => p.tag === state.player);
  if (!state || !sim || !pe || electionNight.value || state.pendingCoalition) return null;
  const ev = db.events.get(pe.event);
  if (!ev) return null;
  const scope = { tag: pe.tag, root: pe.tag, from: pe.from };
  const country = db.countries.get(pe.tag)?.country;
  return (
    <div class="scrim">
      <section class="event hp" role="dialog" aria-label={ev.title}>
        <header class="hp-head">
          <span class="side-ic">{Icon.decisions({ size: 18 })}</span>
          <h2 class="hp-title">{ev.title}</h2>
        </header>
        <div class="event-body">
          <div class="dim small">{country?.name.en}, {formatDate(pe.day)}</div>
          <p class="ev-text">{ev.description}</p>
          {ev.historical && (
            <p class="faint small" {...tip(() => ({ title: "Sources", rows: ev.historical!.source.map((s) => ["", s.title] as [string, string]) }))}>
              A historical event.
            </p>
          )}
        </div>
        <footer class="event-foot ev-options">
          {ev.options.map((o) => {
            const ok = o.trigger === undefined || evalTrigger(sim.context, scope, o.trigger);
            const lines = describeEffects(db, o.effects);
            const cond = o.trigger !== undefined ? describeTrigger(db, o.trigger) : [];
            return (
              <button
                key={o.id}
                class="btn wide ev-opt"
                disabled={!ok}
                onClick={() => session.dispatch({ type: "answer_event", key: pe.key, option: o.id })}
                {...tip(() => ({ title: o.name, rows: lines.map((l) => ["", l] as [string, string]), note: cond.length ? `Requires: ${cond.join("; ")}` : lines.length ? undefined : "No direct effect." }))}
              >
                {o.name}
              </button>
            );
          })}
        </footer>
      </section>
    </div>
  );
}
