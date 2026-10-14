/**
 * Government formation for the player's country: each possible government with its seats,
 * cohesion and the odds that each partner accepts. The game stays paused until one is formed.
 */
import { useState } from "preact/hooks";
import type { ContentDB } from "../../content/compile.ts";
import type { CoalitionOption } from "../../sim/state.ts";
import { Icon } from "../icons.tsx";
import { electionNight, version, type Session } from "../session.ts";
import { tip } from "../tooltip.tsx";

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Option({ db, opt, onPick }: { db: ContentDB; opt: CoalitionOption; onPick: () => void }) {
  const partners = opt.parties.slice(1);
  const odds = partners.reduce((a, p) => a * (opt.acceptance[p] ?? 1), 1);
  const cohesion = 1 - opt.distance;
  return (
    <li class="co-opt">
      <div class="co-parties">
        {opt.parties.map((p) => {
          const party = db.parties.get(p);
          return (
            <span class="chip" key={p} {...tip(() => ({ title: party?.name.en ?? p, rows: [["Ideology", db.subIdeologies.get(party?.sub_ideology ?? "")?.name ?? "—"], ["Accepts", p === opt.parties[0] ? "Leads the government" : pct(opt.acceptance[p] ?? 1)]] }))}>
              <i class="sw" style={{ background: party?.color ?? "#777" }} />
              {party?.abbrev.en ?? p}
            </span>
          );
        })}
        {opt.support.length > 0 && (
          <span class="faint small" {...tip(() => ({ title: "Confidence and supply", body: <span class="dim">These parties stay outside the government but are expected to back it in confidence votes.</span>, rows: opt.support.map((p) => [db.parties.get(p)?.name.en ?? p, "outside support"] as [string, string]) }))}>
            + support from {opt.support.map((p) => db.parties.get(p)?.abbrev.en ?? p).join(", ")}
          </span>
        )}
      </div>
      <div class="co-stats">
        <span class={`num ${opt.seats >= opt.majority ? "good" : "warn"}`} {...tip(() => ({ title: "Seats", rows: [["Government", opt.seats], ["Needed for a majority", opt.majority]], note: opt.minority ? "A minority government can fall in a confidence vote, more easily when stability is low." : undefined }))}>
          {opt.seats} / {opt.majority}
        </span>
        <span class="num" {...tip(() => ({ title: "Cohesion", rows: [["Policy closeness", pct(cohesion)]], note: "How close the partners' ideologies are. Wide coalitions are harder to hold together." }))}>{pct(cohesion)} cohesion</span>
        <span class={`num ${odds >= 0.7 ? "good" : odds >= 0.4 ? "warn" : "bad"}`} {...tip(() => ({ title: "Chance all partners agree", rows: partners.map((p) => [db.parties.get(p)?.abbrev.en ?? p, pct(opt.acceptance[p] ?? 1)] as [string, string]), note: partners.length ? "If a partner declines, this option is withdrawn and you choose again." : "Governing alone needs no partner." }))}>
          {partners.length ? `${pct(odds)} agree` : "no partner needed"}
        </span>
      </div>
      <button class="btn" onClick={onPick}>{opt.parties.length > 1 ? "Propose" : opt.minority ? "Govern as minority" : "Govern alone"}</button>
    </li>
  );
}

export function CoalitionPanel({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const [msg, setMsg] = useState("");
  const state = session.state;
  const pc = state?.pendingCoalition;
  if (!state || !pc || pc.tag !== state.player || electionNight.value) return null;
  const formateur = pc.options[0]?.parties[0];
  const fParty = formateur ? db.parties.get(formateur) : undefined;
  const chamber = db.countries.get(pc.tag)?.country?.legislature?.chambers.find((c) => c.id === pc.chamber);
  const pick = (i: number) => {
    const r = session.dispatch({ type: "choose_coalition", option: i });
    setMsg(r.ok ? "" : r.text);
  };
  return (
    <div class="scrim">
      <section class="event hp co" role="dialog" aria-label="Form a government">
        <header class="hp-head">
          <span class="side-ic">{Icon.party({ size: 18 })}</span>
          <h2 class="hp-title">Form a government</h2>
        </header>
        <div class="event-body">
          <h3 class="en-head">{fParty?.name.en ?? "The largest party"} leads the talks</h3>
          <p class="dim">
            {chamber?.name.en}: a government needs {pc.options[0]?.majority ?? "a majority of"} seats. Choose a coalition, or govern as a minority with outside support.
          </p>
          {msg && <p class="warn">{msg}</p>}
          <ol class="co-list">
            {pc.options.map((o, i) => (
              <Option key={o.parties.join("+") + i} db={db} opt={o} onPick={() => pick(i)} />
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
