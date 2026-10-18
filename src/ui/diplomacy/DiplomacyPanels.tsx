/**
 * Diplomacy tab (E): relations with a chosen country (opinion, guarantees, access, trade,
 * sanctions, war justification and declaration), blocs and the UN Security Council.
 * Intelligence tab (O): foreign influence campaigns (party funding, coup backing).
 * The target is the owner of the selected province, else the country picked from the list.
 */
import { signal } from "@preact/signals";
import { useState } from "preact/hooks";
import type { ContentDB } from "../../content/compile.ts";
import { formatDate } from "../../sim/date.ts";
import {
  atWarWith,
  blocName,
  blocsOf,
  blocVote,
  councilMembers,
  inBloc,
  justification,
  justifyDays,
  opinionParts,
} from "../../sim/diplomacy/diplomacy.ts";
import { countryName } from "../../sim/politics/unrest.ts";
import type { GameState } from "../../sim/state.ts";
import { version, type Session } from "../session.ts";
import { selectedProvince } from "../store.ts";
import { Flag } from "../Flag.tsx";
import { Placard } from "../Placard.tsx";
import { Icon } from "../icons.tsx";
import { tip } from "../tooltip.tsx";

/** Country picked in the diplomacy list (used when no province is selected). */
export const diplomacyTarget = signal<string | null>(null);

const signed = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n)}`;

function currentTarget(state: GameState): string | null {
  const id = selectedProvince.value;
  const owner = id ? state.provinceOwner[id - 1] : null;
  const t = owner ?? diplomacyTarget.value;
  return t && t !== state.player ? t : null;
}

function OpinionValue({ db, state, a, b, label }: { db: ContentDB; state: GameState; a: string; b: string; label: string }) {
  version.value; // follow the clock (unchanged props skip re-rendering)
  const o = opinionParts(db, state, a, b);
  return (
    <>
      <dt>{label}</dt>
      <dd
        class={`num ${o.value < 0 ? "warn" : ""}`}
        {...tip(() => ({
          title: label,
          rows: o.parts.length ? o.parts.map(([k, v]) => [k, signed(v)] as [string, string]) : [["No factors", "0"]],
          note: "Opinion runs from -100 to +100. It decides whether a country grants access, trades, admits you to a bloc or votes for you at the UN.",
        }))}
      >
        {signed(o.value)}
      </dd>
    </>
  );
}

/** Country list sorted by opinion of the player, filtered by name. */
function CountryPicker({ db, state, me }: { db: ContentDB; state: GameState; me: string }) {
  version.value; // follow the clock (unchanged props skip re-rendering)
  const [q, setQ] = useState("");
  const rows = db.countryList
    .filter((c) => c.tag !== me && state.provinceOwner.includes(c.tag) && (!q || c.name.toLowerCase().includes(q.toLowerCase())))
    .map((c) => ({ tag: c.tag, name: countryName(db, state, c.tag), op: opinionParts(db, state, c.tag, me).value }))
    .sort((x, y) => y.op - x.op)
    .slice(0, q ? 40 : 12);
  return (
    <div class="pad">
      <input class="search" placeholder="Find a country" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Find a country" />
      <ul class="dec-list">
        {rows.map((r) => (
          <li class="dec-item" key={r.tag}>
            <button class="dec-main lnk" onClick={() => { selectedProvince.value = 0; diplomacyTarget.value = r.tag; }} {...tip(() => ({ title: r.name, rows: [["Opinion of you", signed(r.op)]] }))}>
              <span class="dec-name row-flag"><Flag db={db} tag={r.tag} size="xs" />{r.name}</span>
            </button>
            <b class={`num ${r.op < 0 ? "warn" : ""}`}>{signed(r.op)}</b>
          </li>
        ))}
      </ul>
      {!q && <p class="faint small">The twelve friendliest countries; search for any other, or click one on the map.</p>}
    </div>
  );
}

export function DiplomacyPanel({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const [msg, setMsg] = useState("");
  const state = session.state;
  const me = state?.player;
  const cs = me ? state?.countries[me] : undefined;
  if (!state || !me || !cs || !state.diplomacy) return <p class="dim pad">No country to conduct diplomacy for.</p>;
  const d = state.diplomacy;
  const r = db.diplomacyRules;
  const t = currentTarget(state);
  const run = (cmd: Parameters<Session["dispatch"]>[0]) => setMsg(session.dispatch(cmd).text);
  const pairHas = (list: [string, string][], a: string, b: string) => list.some(([x, y]) => x === a && y === b);

  return (
    <div class="diplo">
      {!t ? (
        <CountryPicker db={db} state={state} me={me} />
      ) : (
        <TargetView db={db} state={state} me={me} t={t} run={run} pairHas={pairHas} />
      )}
      {msg && <p class="dim small pad">{msg}</p>}

      <div class="hp-section">Blocs</div>
      <ul class="dec-list">
        {[...db.blocs.values()].map((b) => {
          const member = inBloc(state, me, b.id);
          const app = d.applications.find((a) => a.tag === me && a.bloc === b.id);
          const vote = member ? null : blocVote(db, state, me, b.id);
          return (
            <li class={`dec-item ${member ? "mine" : ""}`} key={b.id}>
              <div class="dec-main" {...tip(() => ({
                title: blocName(db, state, b.id),
                body: <span class="dim">{b.description}</span>,
                rows: [
                  ["Members", d.blocs[b.id]?.length ?? 0],
                  ["Opinion between members", signed(b.opinion)],
                  ...(b.trade_growth ? [["Growth for members", `+${b.trade_growth.toFixed(2)} points`] as [string, string]] : []),
                  ...(b.defensive ? [["Mutual defence", "members join wars against any member"] as [string, string]] : []),
                  ["Accession", `${Math.round(b.accession_days / 30)} months after acceptance`],
                ],
                note: member ? "Leaving costs stability and the members' goodwill." : vote?.ok ? `Members would accept: ${vote.text}.` : `Members would refuse: ${vote?.text}.`,
              }))}>
                <span class="dec-name"><i class="sw" style={{ background: b.color }} /> {blocName(db, state, b.id)}</span>
                <span class="faint small num">{d.blocs[b.id]?.length ?? 0} members{app ? ` · joins ${formatDate(app.day)}` : ""}</span>
              </div>
              {member ? (
                <button class="btn" onClick={() => run({ type: "leave_bloc", tag: me, bloc: b.id })}>Leave</button>
              ) : app ? null : (
                <button class="btn" disabled={!vote?.ok} onClick={() => run({ type: "apply_to_bloc", tag: me, bloc: b.id })}>Apply</button>
              )}
            </li>
          );
        })}
      </ul>

      <UnSection db={db} state={state} me={me} t={t} run={run} />
    </div>
  );
}

function TargetView({ db, state, me, t, run, pairHas }: { db: ContentDB; state: GameState; me: string; t: string; run: (c: Parameters<Session["dispatch"]>[0]) => void; pairHas: (l: [string, string][], a: string, b: string) => boolean }) {
  version.value; // follow the clock (unchanged props skip re-rendering)
  const d = state.diplomacy;
  const r = db.diplomacyRules;
  const cs = state.countries[me]!;
  const name = countryName(db, state, t);
  const war = atWarWith(state, me, t);
  const theirOp = opinionParts(db, state, t, me).value;
  const improving = pairHas(d.improving, me, t);
  const guaranteed = pairHas(d.guarantees, me, t);
  const access = pairHas(d.access, me, t);
  const trade = pairHas(d.tradeDeals, me, t) || pairHas(d.tradeDeals, t, me);
  const sanctioned = pairHas(d.sanctions, me, t);
  const j = justification(state, me, t);
  const justified = !!j && j.done <= state.day;
  const slots = d.improving.filter(([a]) => a === me).length;
  const theirBlocs = blocsOf(state, t);
  return (
    <>
      <div class="dp-target">
        <h3 class="dp-name"><Placard db={db} state={state} tag={t} size="md" name={name} /></h3>
        <button class="tile mini right" aria-label="Choose another country" onClick={() => { selectedProvince.value = 0; diplomacyTarget.value = null; }}>{Icon.close({ size: 12 })}</button>
      </div>
      <dl class="kv">
        <OpinionValue db={db} state={state} a={t} b={me} label="Their opinion of us" />
        <OpinionValue db={db} state={state} a={me} b={t} label="Our opinion of them" />
        <dt>Blocs</dt>
        <dd>{theirBlocs.length ? theirBlocs.map((b) => blocName(db, state, b)).join(", ") : "None"}</dd>
        {!db.countries.get(t)?.country && (<><dt>Politics</dt><dd class="faint">Default profile (politics not researched); it answers by opinion only.</dd></>)}
      </dl>
      {war ? (
        <p class="warn small pad">At war with {name}.</p>
      ) : (
        <div class="diplo-actions">
          <button class="btn wide" disabled={!improving && slots >= r.improve_slots} onClick={() => run({ type: "improve_relations", tag: me, target: t, on: !improving })}
            {...tip(() => ({ title: improving ? "Stop improving relations" : "Improve relations", rows: [["Their opinion", `+${r.improve_per_month} a month, up to +${r.improve_cap}`], ["Cost", `${r.improve_pp_monthly} political power a month`], ["In use", `${slots} of ${r.improve_slots}`]] }))}>
            {improving ? "Stop improving relations" : "Improve relations"}
          </button>
          <button class="btn wide" disabled={!guaranteed && cs.politicalPower < r.guarantee_pp} onClick={() => run({ type: "guarantee", tag: me, target: t, on: !guaranteed })}
            {...tip(() => ({ title: guaranteed ? "Withdraw the guarantee" : "Guarantee independence", rows: guaranteed ? [] : [["Cost", `${r.guarantee_pp} political power`], ["Their opinion", `+${r.guarantee_opinion}`]], note: "If anyone declares war on them, you join the war on their side." }))}>
            {guaranteed ? "Withdraw guarantee" : "Guarantee independence"}
          </button>
          <button class="btn wide" onClick={() => run({ type: "military_access", tag: me, target: t, on: !access })}
            {...tip(() => ({ title: access ? "Give up military access" : "Request military access", rows: access ? [] : [["Their opinion of us", signed(theirOp)], ["Needed", signed(r.access_opinion)]], note: "Lets your divisions cross their territory." }))}>
            {access ? "Give up military access" : "Request military access"}
          </button>
          <button class="btn wide" disabled={!trade && sanctioned} onClick={() => run({ type: "trade_deal", tag: me, target: t, on: !trade })}
            {...tip(() => ({ title: trade ? "End the trade agreement" : "Propose a trade agreement", rows: trade ? [] : [["Their opinion of us", signed(theirOp)], ["Needed", signed(r.trade_opinion)], ["Opinion both ways", `+${r.trade_deal_opinion}`]], note: "Both economies grow a little faster, in proportion to the partner's share of world output." }))}>
            {trade ? "End trade agreement" : "Propose trade agreement"}
          </button>
          <button class="btn wide" disabled={!sanctioned && cs.politicalPower < r.sanction_pp} onClick={() => run({ type: "sanction", tag: me, target: t, on: !sanctioned })}
            {...tip(() => ({ title: sanctioned ? "Lift sanctions" : "Impose sanctions", rows: sanctioned ? [] : [["Cost", `${r.sanction_pp} political power`], ["Their opinion of us", signed(r.sanction_opinion)]], note: "Cuts their growth in proportion to the sanctioning countries' share of world output; ends any trade agreement." }))}>
            {sanctioned ? "Lift sanctions" : "Impose sanctions"}
          </button>
          {!j ? (
            <button class="btn wide" disabled={cs.politicalPower < r.justify_pp} onClick={() => run({ type: "justify_war", tag: me, target: t })}
              {...tip(() => ({ title: "Justify a war goal", rows: [["Time", `${justifyDays(db, state)} days (shorter when world tension is high)`], ["Cost", `${r.justify_pp} political power`], ["Valid for", `${Math.round(r.justification_valid_days / 30)} months once ready`]], note: "A justified war carries no penalty with the rest of the world." }))}>
              Justify a war goal
            </button>
          ) : !justified ? (
            <p class="dim small pad" {...tip(() => ({ title: "Justifying a war goal", rows: [["Ready on", formatDate(j.done)]] }))}>War goal ready on {formatDate(j.done)}.</p>
          ) : null}
          <button class={`btn wide ${justified ? "" : "danger"}`} onClick={() => run({ type: "declare_war", tag: me, target: t, goal: "conquest" })}
            {...tip(() => ({
              title: justified ? `Declare war on ${name}` : `Declare war on ${name} without a justification`,
              rows: [
                ["World tension", `+${Math.round(db.warRules.tension_per_war * (db.warRules.nuclear_states_2000.includes(t) ? db.warRules.nuclear_tension_multiplier : 1) * (justified ? 1 : r.unjustified_tension_multiplier) * 100)}%`],
                ...(justified ? [] : [["Stability", `${Math.round(r.unjustified_stability * 100)}%`] as [string, string], ["World opinion of you", signed(r.aggressor_opinion)] as [string, string]]),
              ],
              note: "Their guarantors and fellow members of defensive blocs join the war on their side. A side capitulates when enemies hold " + Math.round(db.warRules.capitulation_share * 100) + "% of its population.",
            }))}>
            {justified ? "Declare war" : "Declare war without justification"}
          </button>
        </div>
      )}
    </>
  );
}

function UnSection({ db, state, me, t, run }: { db: ContentDB; state: GameState; me: string; t: string | null; run: (c: Parameters<Session["dispatch"]>[0]) => void }) {
  version.value; // follow the clock (unchanged props skip re-rendering)
  const council = councilMembers(db, state);
  const onCouncil = council.includes(me);
  const elected = new Map(state.diplomacy.unsc.elected.map((e) => [e.tag, e.until]));
  const recent = [...state.diplomacy.unsc.resolutions].reverse().slice(0, 5);
  return (
    <>
      <div class="hp-section">UN Security Council</div>
      <p class="small pad">
        {council.map((c, i) => (
          <span key={c} {...tip(() => ({ title: countryName(db, state, c), rows: [[db.un.permanent.includes(c) ? "Permanent member" : "Elected until", db.un.permanent.includes(c) ? "veto power" : formatDate(elected.get(c) ?? 0)]] }))}>
            {db.un.permanent.includes(c) ? <b>{countryName(db, state, c)}</b> : countryName(db, state, c)}{i < council.length - 1 ? ", " : ""}
          </span>
        ))}
      </p>
      <p class="faint small pad">Resolutions need {db.diplomacyRules.unsc_votes_needed} votes of 15 and no veto from a permanent member (bold). Members vote by their opinion of the target; the council answers unjustified wars with sanctions.</p>
      {onCouncil && t && (
        <div class="diplo-actions">
          <button class="btn wide" onClick={() => run({ type: "propose_resolution", tag: me, kind: "condemn", target: t })} {...tip(() => ({ title: `Condemn ${countryName(db, state, t)}`, note: "If adopted: their stability falls and they think less of those who voted for it." }))}>Propose condemnation</button>
          <button class="btn wide" onClick={() => run({ type: "propose_resolution", tag: me, kind: "sanctions", target: t })} {...tip(() => ({ title: `Sanctions on ${countryName(db, state, t)}`, note: `If adopted: every country that does not favour them sanctions them for ${Math.round(db.diplomacyRules.sanctions_resolution_days / 365)} years.` }))}>Propose sanctions</button>
        </div>
      )}
      {recent.length > 0 && (
        <ul class="dec-list">
          {recent.map((res) => {
            const yes = Object.values(res.votes).filter((v) => v === "yes").length;
            const vetoes = Object.entries(res.votes).filter(([, v]) => v === "veto").map(([k]) => countryName(db, state, k));
            return (
              <li class="dec-item" key={res.id}>
                <div class="dec-main" {...tip(() => ({ title: `Resolution ${res.id}`, rows: Object.entries(res.votes).map(([k, v]) => [countryName(db, state, k), v] as [string, string]) }))}>
                  <span class="dec-name">{res.kind === "sanctions" ? "Sanctions on" : "Condemning"} {countryName(db, state, res.target)}</span>
                  <span class={`small num ${res.passed ? "" : "faint"}`}>{formatDate(res.day)} · {res.passed ? "adopted" : vetoes.length ? `vetoed by ${vetoes.join(", ")}` : "rejected"} · {yes} in favour</span>
                </div>
                <span class="vote-board" aria-label={`${yes} of ${Object.keys(res.votes).length} in favour`}>
                  {Object.entries(res.votes).map(([k, v]) => (
                    <i key={k} class={`vb-${v}`} {...tip(() => ({ title: countryName(db, state, k), rows: [["Vote", v === "yes" ? "In favour" : v === "veto" ? "Veto" : "Against"]], note: db.un.permanent.includes(k) ? "Permanent member." : undefined }))} />
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ------------------------------------------------------------------ intelligence

export function IntelligencePanel({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const [msg, setMsg] = useState("");
  const [party, setParty] = useState("");
  const [group, setGroup] = useState("military");
  const state = session.state;
  const me = state?.player;
  if (!state || !me || !state.diplomacy) return <p class="dim pad">No country selected.</p>;
  const r = db.diplomacyRules;
  const mine = state.diplomacy.campaigns.filter((c) => c.owner === me);
  const t = currentTarget(state);
  const tcs = t ? state.countries[t] : undefined;
  const parties = tcs ? Object.keys(tcs.partyPopularity).filter((p) => tcs.partyStatus[p] === "active" || tcs.partyStatus[p] === "extra_parliamentary") : [];
  const run = (cmd: Parameters<Session["dispatch"]>[0]) => setMsg(session.dispatch(cmd).text);
  return (
    <div class="diplo">
      <div class="hp-section">Operations</div>
      {mine.length === 0 && <p class="faint small pad">No operations under way.</p>}
      <ul class="dec-list">
        {mine.map((c) => {
          const what = c.kind === "fund_party" ? `Funding ${db.parties.get(c.party ?? "")?.abbrev.en ?? c.party}` : `Backing a coup by ${db.interestGroupTypes.get(c.group ?? "")?.name ?? c.group}`;
          return (
            <li class="dec-item" key={c.id}>
              <div class="dec-main" {...tip(() => ({
                title: what,
                rows: [["Target", countryName(db, state, c.target)], ["Since", formatDate(c.start)], ...(c.kind === "back_coup" ? [["Coup launched", formatDate(c.start + r.coup_days)] as [string, string]] : [["Cost", `${r.influence_pp_monthly} political power a month`] as [string, string]]), ["Exposure risk", `${Math.round(r.influence_detection * 100)}% a month`]],
                note: `If exposed, ${countryName(db, state, c.target)}'s opinion of you falls by ${-r.influence_exposed_opinion}.`,
              }))}>
                <span class="dec-name">{what}</span>
                <span class="faint small">{countryName(db, state, c.target)}</span>
              </div>
              <button class="btn" onClick={() => run({ type: "stop_influence", tag: me, id: c.id })}>Stop</button>
            </li>
          );
        })}
      </ul>
      <div class="hp-section">New operation</div>
      {!t ? (
        <p class="faint small pad">Select a country on the map, or pick one in the Diplomacy tab.</p>
      ) : !tcs?.active || !db.countries.get(t)?.country ? (
        <p class="faint small pad">{countryName(db, state, t)} uses the default profile (politics not researched), so it has no parties or interest groups to influence.</p>
      ) : (
        <div class="pad">
          <p class="small">Target: <b>{countryName(db, state, t)}</b></p>
          <div class="prod-add">
            <select value={party || parties[0]} onChange={(e) => setParty((e.target as HTMLSelectElement).value)} aria-label="Party">
              {parties.map((p) => <option key={p} value={p}>{db.parties.get(p)?.name.en ?? p} ({Math.round((tcs.partyPopularity[p] ?? 0) * 100)}%)</option>)}
            </select>
            <button class="btn" disabled={!parties.length} onClick={() => run({ type: "start_influence", tag: me, target: t, kind: "fund_party", arg: party || parties[0]! })}
              {...tip(() => ({ title: "Fund a party", rows: [["Popularity", `+${(r.influence_popularity * 100).toFixed(1)} points a month`], ["Cost", `${r.influence_pp_monthly} political power a month`], ["Exposure risk", `${Math.round(r.influence_detection * 100)}% a month`]] }))}>
              Fund party
            </button>
          </div>
          <div class="prod-add">
            <select value={group} onChange={(e) => setGroup((e.target as HTMLSelectElement).value)} aria-label="Interest group">
              {Object.keys(tcs.interestGroups).map((g) => <option key={g} value={g}>{db.interestGroupTypes.get(g)?.name ?? g}</option>)}
            </select>
            <button class="btn danger" onClick={() => run({ type: "start_influence", tag: me, target: t, kind: "back_coup", arg: group })}
              {...tip(() => ({ title: "Back a coup", rows: [["Cost", `${r.coup_pp} political power`], ["Preparation", `${r.coup_days} days`], ["Exposure risk", `${Math.round(r.influence_detection * 100)}% a month`]], note: "Success depends on the group's influence and the target's stability." }))}>
              Back a coup
            </button>
          </div>
        </div>
      )}
      {msg && <p class="dim small pad">{msg}</p>}
    </div>
  );
}
