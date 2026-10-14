import type { ContentDB } from "../../content/compile.ts";
import { formatDate } from "../../sim/date.ts";
import { panel, paused, speed, version, type Session } from "../session.ts";

const fmt1 = (x: number) => Math.round(x).toLocaleString("en");

/** Not simulated yet: shown as a dash with the phase that adds it. */
function Pending({ label, phase }: { label: string; phase: string }) {
  return (
    <div class="stat pending" title={`${label} arrives in ${phase}`}>
      <span class="k">{label}</span>
      <span class="v">—</span>
    </div>
  );
}

export function TopBar({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const state = session.state;
  if (!state?.player) return null;
  const tag = state.player;
  const cs = state.countries[tag]!;
  const c = db.countries.get(tag)?.country;
  const exec = c ? cs.offices[c.government.effective_executive]?.[0] : null;
  const leader = exec ? db.people.get(exec)?.name.en : undefined;
  const party = cs.rulingParties[0] ? db.parties.get(cs.rulingParties[0]) : undefined;
  const color = db.countryColors.get(tag) ?? "#555";

  return (
    <header class="topbar panel">
      <div class="flag" style={{ background: color }} title="Flags are placeholders">{tag}</div>
      <div class="who">
        <div class="cname">{c?.name.en ?? tag}</div>
        <div class="dim small">
          {leader ?? "—"}
          {party && (
            <>
              {" · "}
              <i class="swatch" style={{ background: party.color }} /> {party.abbrev.en}
            </>
          )}
        </div>
      </div>
      <div class="stat" title="Political power">
        <span class="k">Political power</span>
        <span class="v">{fmt1(cs.politicalPower)}</span>
      </div>
      <div class="stat" title="Stability">
        <span class="k">Stability</span>
        <span class="v">{Math.round(cs.stability * 100)}%</span>
      </div>
      <div class="stat" title="War support">
        <span class="k">War support</span>
        <span class="v">{Math.round(cs.warSupport * 100)}%</span>
      </div>
      <Pending label="Manpower" phase="Phase 9" />
      <Pending label="Factories" phase="Phase 7" />
      <Pending label="Treasury" phase="Phase 7" />
      <button class={`tb-btn ${panel.value === "politics" ? "on" : ""}`} onClick={() => (panel.value = panel.value === "politics" ? null : "politics")} title="Politics (P)">
        Politics
      </button>
      <div class="clock">
        <div class="date">{formatDate(state.day)}</div>
        <div class="speeds" role="group" aria-label="Game speed">
          <button class={paused.value ? "on" : ""} onClick={() => session.setPaused(!paused.value)} title="Pause (Space)" aria-label={paused.value ? "Resume" : "Pause"}>
            {paused.value ? "▶" : "❚❚"}
          </button>
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} class={!paused.value && speed.value >= s ? "lit" : speed.value >= s ? "dimlit" : ""} onClick={() => session.setSpeed(s)} aria-label={`Speed ${s}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <button class="tb-btn" onClick={() => (panel.value = panel.value === "menu" ? null : "menu")} title="Menu (Esc)">
        Menu
      </button>
    </header>
  );
}
