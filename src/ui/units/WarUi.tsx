/** War UI (Phase 10): declare war from a country's province view, the peace conference, and wars in the outliner. */
import type { ContentDB } from "../../content/compile.ts";
import { formatDate } from "../../sim/date.ts";
import { hostile, occupiedShare } from "../../sim/military/war.ts";
import { countryName } from "../../sim/politics/unrest.ts";
import { Icon } from "../icons.tsx";
import { version, type Session } from "../session.ts";
import { tip } from "../tooltip.tsx";

/** Declare-war control for the country owning a selected province. */
export function WarButton({ db, session, target }: { db: ContentDB; session: Session; target: string }) {
  version.value;
  const state = session.state;
  const me = state?.player;
  if (!state || !me || target === me || !state.countries[target]?.active) return null;
  const atWar = hostile(state, me, target);
  const nuclear = db.warRules.nuclear_states_2000.includes(target);
  if (atWar) return <p class="warn small pad">At war with {countryName(db, state, target)}.</p>;
  return (
    <div class="pad">
      <button
        class="btn"
        onClick={() => session.dispatch({ type: "declare_war", tag: me, target, goal: "conquest" })}
        {...tip(() => ({
          title: `Declare war on ${countryName(db, state, target)}`,
          rows: [["World tension", `+${Math.round(db.warRules.tension_per_war * (nuclear ? db.warRules.nuclear_tension_multiplier : 1) * 100)}%`], ["Goal", "Conquest of occupied provinces"]],
          note: `${nuclear ? "A nuclear power: tension rises far more. " : ""}Your divisions may then enter its territory. A side capitulates when its enemies hold ${Math.round(db.warRules.capitulation_share * 100)}% of its population; after ${db.warRules.white_peace_min_months} months, a side whose war support falls to ${Math.round(db.warRules.white_peace_war_support * 100)}% makes a white peace; holding enemy territory raises war support. Alliances and justification arrive with diplomacy in Phase 11.`,
        }))}
      >
        Declare war
      </button>
    </div>
  );
}

/** Peace conference for a war the player won. */
export function PeaceConference({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const state = session.state;
  const p = state?.pendingPeace;
  const war = p ? state?.wars.find((w) => w.id === p.war) : undefined;
  if (!state || !p || !war) return null;
  const losers = p.winner === "attackers" ? war.defenders : war.attackers;
  const held = state.provinceController.filter((c, i) => c === state.player && losers.includes(state.provinceOwner[i]!)).length;
  return (
    <div class="scrim">
      <section class="event hp" role="dialog" aria-label="Peace conference">
        <header class="hp-head">
          <span class="side-ic">{Icon.diplomacy({ size: 18 })}</span>
          <h2 class="hp-title">Peace conference</h2>
        </header>
        <div class="event-body">
          <h3 class="en-head">{losers.map((t) => countryName(db, state, t)).join(", ")} capitulated</h3>
          <p class="dim">{war.name}, since {formatDate(war.startDay)}. You hold {held} of their provinces.</p>
        </div>
        <footer class="event-foot ev-options">
          <button class="btn wide ev-opt" onClick={() => session.dispatch({ type: "choose_peace", annex: true })} {...tip(() => ({ title: "Annex", note: `The ${held} provinces you hold become yours.` }))}>Annex the occupied provinces</button>
          <button class="btn wide ev-opt" onClick={() => session.dispatch({ type: "choose_peace", annex: false })} {...tip(() => ({ title: "Return", note: "Peace without territorial change; your stability still rises with the victory." }))}>Return the occupied provinces</button>
        </footer>
      </section>
    </div>
  );
}

/** Wars section for the outliner. */
export function WarsOutliner({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const state = session.state;
  if (!state) return null;
  const mine = state.wars.filter((w) => w.attackers.includes(state.player ?? "") || w.defenders.includes(state.player ?? ""));
  const ctx = session.sim?.context;
  return (
    <details open={mine.length > 0}>
      <summary class="ol-h" {...tip(() => ({ title: "World tension", rows: [["Tension", `${Math.round(state.worldTension * 100)}%`], ["Wars under way", state.wars.length]], note: "Declarations of war raise it; it fades each month." }))}>
        Wars{state.wars.length ? ` (${state.wars.length})` : ""}
      </summary>
      {state.wars.length === 0 ? (
        <p class="faint small ol-empty">The world is at peace. Tension {Math.round(state.worldTension * 100)}%.</p>
      ) : (
        <ul class="ol-list">
          {state.wars.map((w) => (
            <li key={w.id} class={mine.includes(w) ? "mine" : ""} {...tip(() => ({
              title: w.name,
              rows: ctx ? [
                [`${countryName(db, state, w.attackers[0]!)} occupied`, `${Math.round(occupiedShare(ctx, w.attackers[0]!) * 100)}%`],
                [`${countryName(db, state, w.defenders[0]!)} occupied`, `${Math.round(occupiedShare(ctx, w.defenders[0]!) * 100)}%`],
                ["War support", `${Math.round((state.countries[w.attackers[0]!]?.warSupport ?? 0) * 100)}% / ${Math.round((state.countries[w.defenders[0]!]?.warSupport ?? 0) * 100)}%`],
              ] : [],
              note: `Since ${formatDate(w.startDay)}. ${state.battles.length} battle${state.battles.length === 1 ? "" : "s"} under way worldwide.`,
            }))}>
              <b>{w.name}</b>
              <span class="faint num small">since {formatDate(w.startDay)}</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
