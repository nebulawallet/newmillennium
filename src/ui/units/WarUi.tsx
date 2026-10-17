/** War UI (Phase 10): the province view's diplomacy entry point, the peace conference, and wars in the outliner. */
import type { ContentDB } from "../../content/compile.ts";
import { formatDate } from "../../sim/date.ts";
import { hostile, occupiedShare } from "../../sim/military/war.ts";
import { countryName } from "../../sim/politics/unrest.ts";
import { Icon } from "../icons.tsx";
import { panel, version, type Session } from "../session.ts";
import { diplomacyTarget } from "../diplomacy/DiplomacyPanels.tsx";
import { Flag } from "../Flag.tsx";
import { openWar } from "../store.ts";
import { tip } from "../tooltip.tsx";

/** Diplomacy entry point for the country owning a selected province (war is declared from the Diplomacy tab). */
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
        onClick={() => {
          diplomacyTarget.value = target;
          panel.value = "diplomacy";
        }}
        {...tip(() => ({ title: `Diplomacy with ${countryName(db, state, target)}`, note: `Relations, guarantees, access, trade, sanctions and war. ${nuclear ? "A nuclear power: war against it raises world tension far more." : ""}` }))}
      >
        Diplomacy
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
            <li key={w.id} class={`war-row ${mine.includes(w) ? "mine" : ""}`} onClick={() => (openWar.value = openWar.value === w.id ? null : w.id)} {...tip(() => ({
              title: w.name,
              rows: ctx ? [
                [`${countryName(db, state, w.attackers[0]!)} occupied`, `${Math.round(occupiedShare(ctx, w.attackers[0]!) * 100)}%`],
                [`${countryName(db, state, w.defenders[0]!)} occupied`, `${Math.round(occupiedShare(ctx, w.defenders[0]!) * 100)}%`],
                ["War support", `${Math.round((state.countries[w.attackers[0]!]?.warSupport ?? 0) * 100)}% / ${Math.round((state.countries[w.defenders[0]!]?.warSupport ?? 0) * 100)}%`],
              ] : [],
              note: `Since ${formatDate(w.startDay)}. Click for the war overview.`,
            }))}>
              <span class="row-flag war-sides"><Flag db={db} tag={w.attackers[0]!} size="xs" /><span class="faint">vs</span><Flag db={db} tag={w.defenders[0]!} size="xs" /><b>{w.name}</b></span>
              <span class="faint num small">since {formatDate(w.startDay)}</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
