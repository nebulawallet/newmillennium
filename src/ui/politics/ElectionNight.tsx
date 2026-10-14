/**
 * Election night: the result of an election in the player's country, shown as a centred event
 * window (HOI4 position for events). Opens automatically when the vote is counted and from the
 * results list in the politics panel.
 */
import type { ContentDB } from "../../content/compile.ts";
import { formatDate } from "../../sim/date.ts";
import { electionTitle, OTHERS } from "../../sim/politics/elections.ts";
import type { ElectionResult, GameState } from "../../sim/state.ts";
import { Hemicycle, type SeatGroup } from "../charts/Hemicycle.tsx";
import { Icon } from "../icons.tsx";
import { electionNight, type Session } from "../session.ts";
import { tip } from "../tooltip.tsx";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const signed = (x: number, d = 1) => `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x).toFixed(d)}`;
const SPECIAL: Record<string, { label: string; color: string }> = {
  independents: { label: "Independents", color: "#8a8f84" },
  others: { label: "Others", color: "#6b6f66" },
  appointed: { label: "Appointed", color: "#4f534c" },
  vacant: { label: "Vacant", color: "#2a2d29" },
  speaker: { label: "Speaker", color: "#a49d86" },
};

/** The previous result for the same election (same chamber or office) in this game. */
function previous(state: GameState, res: ElectionResult): ElectionResult | undefined {
  return [...state.elections].reverse().find((e) => e.tag === res.tag && e.day < res.day && e.kind === res.kind && e.chamber === res.chamber && e.office === res.office);
}

function partyLabel(db: ContentDB, key: string) {
  const p = db.parties.get(key);
  return { name: p?.name.en ?? SPECIAL[key]?.label ?? key, abbrev: p?.abbrev.en ?? SPECIAL[key]?.label ?? key, color: p?.color ?? SPECIAL[key]?.color ?? "#777" };
}

function Legislative({ db, state, res }: { db: ContentDB; state: GameState; res: ElectionResult }) {
  const prev = previous(state, res);
  const before = prev?.seats ?? res.seatsBefore ?? {};
  const seats = res.seats ?? {};
  const keys = [...new Set([...Object.keys(seats), ...Object.keys(res.shares).filter((k) => k !== OTHERS && (res.shares[k] ?? 0) >= 0.005)])].sort(
    (a, b) => (seats[b] ?? 0) - (seats[a] ?? 0) || (res.shares[b] ?? 0) - (res.shares[a] ?? 0),
  );
  const gov = new Set(res.government?.parties ?? []);
  const groups: SeatGroup[] = keys
    .filter((k) => (seats[k] ?? 0) > 0)
    .map((k) => ({ key: k, label: partyLabel(db, k).abbrev, color: partyLabel(db, k).color, seats: seats[k]!, governing: gov.has(k) }));
  const total = res.totalSeats ?? Object.values(seats).reduce((a, b) => a + b, 0);
  return (
    <>
      <div class="hp-well pad-sm">
        <Hemicycle groups={groups} total={total} title={electionTitle(db, res.tag, res)} />
      </div>
      <table class="tbl en-tbl">
        <thead>
          <tr><th></th><th>Party</th><th class="r">Vote</th><th class="r">Change</th><th class="r">Seats</th><th class="r">Change</th></tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const l = partyLabel(db, k);
            const share = res.shares[k];
            const prevShare = prev?.shares[k];
            const ds = (seats[k] ?? 0) - (before[k] ?? 0);
            return (
              <tr key={k} class={gov.has(k) ? "gov" : ""}>
                <td><i class="sw" style={{ background: l.color }} /></td>
                <td class="clip" {...tip(() => ({ title: l.name, rows: [["Vote share", share !== undefined ? pct(share) : "—"], ["Seats", seats[k] ?? 0]], note: gov.has(k) ? "In the new government." : undefined }))}>{l.name}</td>
                <td class="r num" {...tip(() => ({ title: `${l.abbrev}: vote share`, rows: [["This election", share !== undefined ? pct(share) : "—"], ["Previous", prevShare !== undefined ? pct(prevShare) : "—"]] }))}>{share !== undefined ? pct(share) : "—"}</td>
                <td class={`r num ${prevShare === undefined || share === undefined ? "faint" : share >= prevShare ? "good" : "bad"}`}>{prevShare !== undefined && share !== undefined ? signed((share - prevShare) * 100) : "—"}</td>
                <td class="r num" {...tip(() => ({ title: `${l.abbrev}: seats`, rows: [["Now", seats[k] ?? 0], ["Before", before[k] ?? 0]] }))}>{seats[k] ?? 0}</td>
                <td class={`r num ${ds > 0 ? "good" : ds < 0 ? "bad" : "faint"}`}>{signed(ds, 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function Presidential({ db, res }: { db: ContentDB; res: ElectionResult }) {
  const rounds = [...new Set((res.candidates ?? []).map((c) => c.round))].sort();
  const ev = res.unitVotes;
  const evTotal = ev ? Object.values(ev).reduce((a, b) => a + b, 0) : 0;
  const unitsLabel = db.countries.get(res.tag)?.electoralUnits?.units_label ?? "Unit";
  return (
    <div class="en-rounds">
      {rounds.map((r) => {
        const cs = (res.candidates ?? []).filter((c) => c.round === r).sort((a, b) => b.share - a.share);
        return (
          <div key={r}>
            {rounds.length > 1 && <div class="hp-section">{r === 1 ? "First round" : "Runoff"}</div>}
            {cs.map((c) => {
              const p = db.people.get(c.person);
              const party = c.party ? db.parties.get(c.party) : undefined;
              const won = c.person === res.winner && r === rounds[rounds.length - 1];
              const units = ev && r === 1 ? Object.values(res.unitWinners ?? {}).filter((w) => w === c.person).length : 0;
              return (
                <div class={`cand ${won ? "won" : ""}`} key={c.person}
                  {...tip(() => ({ title: p?.name.en ?? c.person, rows: [["Party", party?.name.en ?? "Independent"], ["Vote share", c.share ? pct(c.share) : "—"], ...(ev && r === 1 ? [["Electoral votes", ev[c.person] ?? 0] as [string, number], [`${unitsLabel}s carried`, units] as [string, number]] : [])] }))}>
                  <span class="cand-name"><i class="sw" style={{ background: party?.color ?? "#777" }} />{p?.name.en ?? c.person}{won && <span class="cand-mark">Elected</span>}</span>
                  <span class="meter cand-bar"><span style={{ width: `${Math.min(100, c.share * 100)}%`, background: party?.color }} /></span>
                  <span class="num cand-v">{c.share ? pct(c.share) : "—"}</span>
                  {ev && r === 1 && <span class="num cand-ev">{ev[c.person] ?? 0}</span>}
                </div>
              );
            })}
          </div>
        );
      })}
      {ev && <p class="faint small pad">Electoral votes: {Math.floor(evTotal / 2) + 1} of {evTotal} needed to win.</p>}
    </div>
  );
}

export function ElectionNight({ db, session }: { db: ContentDB; session: Session }) {
  const res = electionNight.value;
  const state = session.state;
  if (!res || !state) return null;
  const country = db.countries.get(res.tag)?.country;
  const pending = state.pendingCoalition?.resultId === res.id;
  const rec = res.historicalId ? db.countries.get(res.tag)?.elections?.elections.find((e) => e.id === res.historicalId) : undefined;
  const recWinner = rec?.historical.winner;
  const nameOf = (id: string | null | undefined) => (id ? (db.people.get(id)?.name.en ?? db.parties.get(id)?.name.en ?? id) : "—");
  const headline = res.seats
    ? `${nameOf(res.winner)} the largest party`
    : `${nameOf(res.winner)} elected`;
  const historyNote = !rec
    ? null
    : res.followedHistory || res.winner === recWinner || res.winnerParty === recWinner
      ? "As in history."
      : `History diverges: in reality ${nameOf(recWinner)} won.`;
  const govNames = res.government?.parties.map((p) => db.parties.get(p)?.abbrev.en ?? p).join("–");
  const close = () => (electionNight.value = null);
  return (
    <div class="scrim" onClick={(e) => e.target === e.currentTarget && !pending && close()}>
      <section class="event hp" role="dialog" aria-label={electionTitle(db, res.tag, res)}>
        <header class="hp-head">
          <span class="side-ic">{Icon.election({ size: 18 })}</span>
          <h2 class="hp-title">{electionTitle(db, res.tag, res)}</h2>
          {!pending && <button class="x" onClick={close} aria-label="Close">{Icon.close({ size: 14 })}</button>}
        </header>
        <div class="event-body">
          <h3 class="en-head">{headline}</h3>
          <div class="dim">
            {country?.name.en}, {formatDate(res.day)}
            {res.snap ? " · early election" : ""}
            {" · "}
            <span {...tip(() => ({ title: "Turnout", rows: [["Voters who took part", pct(res.turnout)]], note: res.followedHistory ? "The recorded turnout." : "Estimated by the simulation." }))}>turnout {pct(res.turnout)}</span>
          </div>
          {res.seats ? <Legislative db={db} state={state} res={res} /> : <Presidential db={db} res={res} />}
          {res.government && (
            <p class="en-gov" {...tip(() => ({ title: "New government", rows: [["Parties", govNames ?? "—"], ["Head of government", nameOf(res.government!.leader)], ...(res.government!.support.length ? [["Supported by", res.government!.support.map((p) => db.parties.get(p)?.abbrev.en ?? p).join(", ")] as [string, string]] : [])] }))}>
              {res.government.minority ? "Minority government" : res.government.parties.length > 1 ? "Coalition" : "Government"}: <b>{govNames}</b>
              {res.government.leader && <> led by <b>{nameOf(res.government.leader)}</b></>}
            </p>
          )}
          {pending && <p class="en-gov warn">No party commands a government yet. You choose who governs.</p>}
          {historyNote && <p class="faint small">{historyNote}</p>}
        </div>
        <footer class="event-foot">
          {pending ? (
            <button class="btn primary wide" onClick={close}>Form a government</button>
          ) : (
            <button class="btn primary wide" onClick={close}>Continue</button>
          )}
        </footer>
      </section>
    </div>
  );
}
