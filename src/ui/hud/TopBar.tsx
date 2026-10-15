import { useEffect, useRef, useState } from "preact/hooks";
import type { ContentDB } from "../../content/compile.ts";
import { formatDate } from "../../sim/date.ts";
import { politicalPowerGain, stabilityTarget } from "../../sim/simulation.ts";
import { factories } from "../../sim/economy/economy.ts";
import { manpowerInService, manpowerPool } from "../../sim/military/military.ts";
import type { CountryState } from "../../sim/state.ts";
import { Icon, type IconName } from "../icons.tsx";
import { panel, paused, speed, version, type Session } from "../session.ts";
import { TABS } from "../tabs.ts";
import { tip, type TipContent } from "../tooltip.tsx";

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)));

const pct = (x: number) => `${Math.round(x * 100)}%`;
const signed = (x: number, d = 2) => `${x >= 0 ? "+" : ""}${x.toFixed(d)}`;

/** A top-bar readout: icon + value; flashes green/red when the value moves (the signature move). */
function Stat({ icon, value, numeric, tipContent, pending, onClick }: { icon: IconName; value: string; numeric?: number; tipContent: () => TipContent; pending?: boolean; onClick?: () => void }) {
  const last = useRef<number | undefined>(numeric);
  const [flash, setFlash] = useState<"" | "up" | "down">("");
  useEffect(() => {
    if (numeric === undefined || last.current === undefined) { last.current = numeric; return; }
    const d = numeric - last.current;
    last.current = numeric;
    if (Math.abs(d) < 1e-6) return;
    setFlash(d > 0 ? "up" : "down");
    const t = setTimeout(() => setFlash(""), 650);
    return () => clearTimeout(t);
  }, [numeric]);
  return (
    <div class={`stat ${pending ? "pending" : ""} ${flash} ${onClick ? "click" : ""}`} tabIndex={0} onClick={onClick} {...tip(tipContent)}>
      {Icon[icon]({ size: 20 })}
      <span class="v num">{value}</span>
    </div>
  );
}

function statTips(db: ContentDB, cs: CountryState) {
  const pp = politicalPowerGain(db, cs);
  const st = stabilityTarget(cs, db.politicsRules.unrest.stability_penalty);
  return {
    pp: (): TipContent => ({
      title: "Political power",
      rows: [
        ["Current", Math.round(cs.politicalPower)],
        ["Base gain (government type)", `${signed(pp.base)}/day`],
        ["Stability factor", `×${pp.stabilityFactor.toFixed(2)}`],
        ["Daily change", <span class="good">{signed(pp.total)}</span>],
      ],
      note: "Spent on laws, advisors and decisions (later phases).",
    }),
    stability: (): TipContent => ({
      title: "Stability",
      rows: [
        ["Current", pct(cs.stability)],
        ["Interest group approval (weighted)", Math.round(st.approval)],
        ["Unrest", `${Math.round(st.unrest * 100)}%`],
        ["Drifting toward", <span class={st.target >= cs.stability ? "good" : "bad"}>{pct(st.target)}</span>],
      ],
      note: "Moves 3% of the gap each week. Interest group approval sets the target; unrest lowers it.",
    }),
    war: (): TipContent => ({ title: "War support", rows: [["Current", pct(cs.warSupport)]], note: "Will be driven by wars, threats and events from Phases 6 and 10." }),
  };
}

/** National focus tile (HOI4: beside the flag): current focus and its progress. */
function FocusTile({ db, session }: { db: ContentDB; session: Session }) {
  const state = session.state!;
  const cs = state.countries[state.player!]!;
  const f = cs.focus.current ? db.focusTrees.get(cs.focus.tree)?.focuses.find((x) => x.id === cs.focus.current) : undefined;
  const open = panel.value === "focus";
  return (
    <button
      class={`tile focus-tile ${open ? "on" : ""} ${f ? "" : "idle"}`}
      aria-label="National focus"
      onClick={() => (panel.value = open ? null : "focus")}
      {...tip(() => ({
        title: "National focus",
        rows: f ? [["Current", f.name], ["Progress", `${cs.focus.progress} / ${f.days} days`]] : [["Current", "None selected"]],
        note: `${cs.focus.completed.length} completed. Click to open the focus tree.`,
      }))}
    >
      {Icon.focus({ size: 22 })}
      {f && <span class="ft-bar"><span style={{ width: `${Math.min(100, (cs.focus.progress / f.days) * 100)}%` }} /></span>}
    </button>
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
  const leader = exec ? db.people.get(exec) : undefined;
  const party = cs.rulingParties[0] ? db.parties.get(cs.rulingParties[0]) : undefined;
  const color = db.countryColors.get(tag) ?? "#555";
  const tips = statTips(db, cs);
  const open = panel.value;

  return (
    <header class="topbar" aria-label="Country overview">
      <button
        class="flag-tile"
        onClick={() => (panel.value = open === "politics" ? null : "politics")}
        {...tip(() => ({
          title: c?.name.en ?? tag,
          rows: [
            ["Leader", leader?.name.en ?? "—"],
            ["Ruling party", party ? `${party.name.en} (${party.abbrev.en})` : "—"],
            ["Government", db.governmentTypes.get(c?.government.type ?? "")?.name ?? "—"],
          ],
          note: "Flags are placeholders. Click to open Politics.",
        }))}
      >
        <span class="flag" style={{ "--flag": color }}>
          <span class="flag-tag">{tag}</span>
        </span>
      </button>

      <FocusTile db={db} session={session} />

      <nav class="tabs" aria-label="Panels">
        {TABS.map((t) => (
          <button
            key={t.id}
            class={`tile ${open === t.id ? "on" : ""} ${t.phase ? "stub" : ""}`}
            aria-label={t.label}
            aria-pressed={open === t.id}
            onClick={() => (panel.value = open === t.id ? null : t.id)}
            {...tip(() => ({ title: `${t.label} (${t.key})`, body: <span class="dim">{t.summary}</span>, note: t.phase ? `Arrives in ${t.phase}.` : undefined }))}
          >
            {Icon[t.icon]({ size: 22 })}
            <span class="key">{t.key}</span>
          </button>
        ))}
      </nav>

      <div class="stats">
        <Stat icon="power" value={String(Math.round(cs.politicalPower))} numeric={Math.round(cs.politicalPower)} tipContent={tips.pp} />
        <Stat icon="stability" value={pct(cs.stability)} numeric={Math.round(cs.stability * 1000)} tipContent={tips.stability} />
        <Stat icon="warSupport" value={pct(cs.warSupport)} numeric={Math.round(cs.warSupport * 1000)} tipContent={tips.war} />
        {cs.military ? (
          <Stat
            icon="manpower"
            value={compact(cs.military.manpower)}
            numeric={Math.round(cs.military.manpower)}
            onClick={() => (panel.value = panel.value === "recruitment" ? null : "recruitment")}
            tipContent={() => ({
              title: "Manpower",
              rows: [
                ["Available", Math.round(cs.military!.manpower).toLocaleString("en")],
                ["Recruitable pool", Math.round(manpowerPool(db, cs)).toLocaleString("en")],
                ["In service", Math.round(manpowerInService(db, session.state!, cs.tag)).toLocaleString("en")],
              ],
              note: "The pool is a share of the population set by the conscription law. Click to open Recruitment.",
            })}
          />
        ) : (
          <Stat icon="manpower" value="—" pending tipContent={() => ({ title: "Manpower", note: "This country has no armed forces data." })} />
        )}
        {cs.economy ? (
          <>
            <Stat
              icon="factories"
              value={`${factories(db, cs.economy).civ}/${factories(db, cs.economy).mil}`}
              numeric={factories(db, cs.economy).civ}
              onClick={() => (panel.value = panel.value === "construction" ? null : "construction")}
              tipContent={() => ({ title: "Factories", rows: [["Civilian", factories(db, cs.economy!).civ], ["Military", factories(db, cs.economy!).mil], ["Under construction", cs.economy!.construction.length]], note: "Click to open Construction." })}
            />
            <Stat
              icon="treasury"
              value={`${cs.economy.growth >= 0 ? "+" : ""}${cs.economy.growth.toFixed(1)}%`}
              numeric={Math.round(cs.economy.growth * 10)}
              onClick={() => (panel.value = panel.value === "economy" ? null : "economy")}
              tipContent={() => ({ title: "Economy", rows: [["GDP growth", `${cs.economy!.growth.toFixed(1)}%`], ["Unemployment", `${cs.economy!.unemployment.toFixed(1)}%`], ["Inflation", `${cs.economy!.inflation.toFixed(1)}%`], ["Debt", `${Math.round(cs.economy!.debt)}% of GDP`]], note: "Click to open the economy." })}
            />
          </>
        ) : (
          <>
            <Stat icon="factories" value="—" pending tipContent={() => ({ title: "Factories", note: "No economy data for this country." })} />
            <Stat icon="treasury" value="—" pending tipContent={() => ({ title: "Economy", note: "No economy data for this country." })} />
          </>
        )}
      </div>

      <div class="leader-line">
        <span class="lname">{leader?.name.en ?? "—"}</span>
        {party && (
          <span class="lparty">
            <i class="sw" style={{ background: party.color }} />
            {party.abbrev.en}
          </span>
        )}
      </div>

      <div class="clock hp-well">
        <button class="tile clk-play" aria-label={paused.value ? "Resume (Space)" : "Pause (Space)"} onClick={() => session.setPaused(!paused.value)} {...tip(() => ({ title: paused.value ? "Resume" : "Pause", note: "Space" }))}>
          {paused.value ? Icon.play({ size: 16 }) : Icon.pause({ size: 16 })}
        </button>
        <div class="date">
          <span class={`dtext num ${paused.value ? "paused" : ""}`}>{formatDate(state.day)}</span>
          <span class="pips" aria-label={`Speed ${speed.value}`}>
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} class={`pip ${speed.value >= s ? "lit" : ""}`} aria-label={`Speed ${s}`} onClick={() => session.setSpeed(s)} />
            ))}
          </span>
        </div>
        <div class="clk-pm">
          <button class="tile mini" aria-label="Slower (-)" onClick={() => session.setSpeed(speed.value - 1)}>{Icon.minus({ size: 12 })}</button>
          <button class="tile mini" aria-label="Faster (+)" onClick={() => session.setSpeed(speed.value + 1)}>{Icon.plus({ size: 12 })}</button>
        </div>
      </div>

      <button class={`tile menu-btn ${open === "menu" ? "on" : ""}`} aria-label="Menu (Esc)" onClick={() => (panel.value = open === "menu" ? null : "menu")} {...tip(() => ({ title: "Menu", note: "Esc" }))}>
        {Icon.menu({ size: 20 })}
      </button>
    </header>
  );
}
