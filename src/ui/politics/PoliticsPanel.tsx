import { useState } from "preact/hooks";
import type { ContentDB } from "../../content/compile.ts";
import type { Person } from "../../content/schemas/country.ts";
import { ageOn, formatDate } from "../../sim/date.ts";
import { governmentSupport } from "../../sim/politics/coalition.ts";
import { electionTitle } from "../../sim/politics/elections.ts";
import { igTarget, igTargetParts } from "../../sim/politics/interestGroups.ts";
import { partyFactors } from "../../sim/politics/voteModel.ts";
import type { CountryState, GameState } from "../../sim/state.ts";
import { Donut } from "../charts/Donut.tsx";
import { Hemicycle, type SeatGroup } from "../charts/Hemicycle.tsx";
import { Portrait } from "../hud/SidePanel.tsx";
import { Placard } from "../Placard.tsx";
import { electionNight, version, type Session } from "../session.ts";
import { tip } from "../tooltip.tsx";
import { describeModifiers } from "../../sim/scripting/engine.ts";
import { LawPicker } from "./LawPicker.tsx";
import { executiveOffice } from "../../sim/politics/common.ts";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const SPECIAL: Record<string, { label: string; color: string }> = {
  independents: { label: "Independents", color: "#8d9ab0" },
  others: { label: "Others", color: "#6c7a92" },
  appointed: { label: "Appointed", color: "#4f5d78" },
  vacant: { label: "Vacant", color: "#24324c" },
  speaker: { label: "Speaker", color: "#b3bed0" },
};

function holders(db: ContentDB, cs: CountryState, officeId: string): (Person | null)[] {
  if (db.offices.get(officeId)?.ex_officio_of) return [];
  return (cs.offices[officeId] ?? []).map((id) => (id ? (db.people.get(id) ?? null) : null));
}

const nameOf = (db: ContentDB, id: string | null | undefined) => (id ? (db.people.get(id)?.name.en ?? db.parties.get(id)?.name.en ?? id) : "—");

export function PoliticsPanel({ db, state, tag, session }: { db: ContentDB; state: GameState; tag: string; session: Session }) {
  version.value;
  const [chamberIx, setChamberIx] = useState(0);
  const [lawCat, setLawCat] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const cc = db.countries.get(tag);
  const c = cc?.country;
  const cs = state.countries[tag];
  if (!cc || !c || !cs) {
    const g = cs ? db.governmentTypes.get(cs.govType) : undefined;
    return (
      <div class="pad">
        <h3 class="hp-title">{g?.name ?? "No politics data"}</h3>
        <p class="dim small">{g?.description ?? "No politics data for this country yet."}</p>
        {cs?.active && (
          <p class="faint small">
            <span {...tip(() => ({ title: "Stability", note: "Default profile starting value (data/rules/politics.json); events and wars change it." }))}>Stability {Math.round(cs.stability * 100)}%</span>
            {" · "}
            <span {...tip(() => ({ title: "War support", note: "Default profile starting value; wars and events change it." }))}>war support {Math.round(cs.warSupport * 100)}%</span>
          </p>
        )}
      </div>
    );
  }
  if (lawCat) return <LawPicker db={db} session={session} state={state} cs={cs} category={lawCat} onClose={() => setLawCat(null)} />;

  const gov = db.governmentTypes.get(cs.govType);
  const execId = executiveOffice(db, cs) ?? c.government.effective_executive;
  const execOffice = db.offices.get(execId);
  const hosOffice = db.offices.get(c.government.head_of_state_office);
  const exOfficio = (officeId: string | undefined) => {
    const o = officeId ? db.offices.get(officeId) : undefined;
    if (!o?.ex_officio_of) return null;
    const target = db.offices.get(o.ex_officio_of);
    const pid = target ? state.countries[target.tag]?.offices[o.ex_officio_of]?.[0] : null;
    return pid ? (db.people.get(pid) ?? null) : null;
  };
  const leader = execOffice?.ex_officio_of ? exOfficio(execOffice.id) : holders(db, cs, execId)[0] ?? null;
  const hos = hosOffice?.ex_officio_of ? [exOfficio(hosOffice.id)] : holders(db, cs, c.government.head_of_state_office);
  const hog = holders(db, cs, c.government.head_of_government_office);
  const leaderParty = (cs.rulingParties[0] ? db.parties.get(cs.rulingParties[0]) : undefined) ?? (leader?.party ? db.parties.get(leader.party) : undefined);
  const leaderSub = leader ? db.subIdeologies.get(leader.sub_ideology) : undefined;
  const others = [
    ...(c.government.head_of_state_office !== execId ? hos.map((p) => ({ p, title: hosOffice?.title.en ?? "Head of state" })) : []),
    ...(c.government.head_of_government_office !== execId && c.government.head_of_government_office !== c.government.head_of_state_office
      ? hog.map((p) => ({ p, title: db.offices.get(c.government.head_of_government_office)?.title.en ?? "Head of government" }))
      : []),
  ];

  const partyOrder = (pid: string) => {
    const sub = db.subIdeologies.get(db.parties.get(pid)?.sub_ideology ?? "");
    return sub ? sub.policy.economy + 0.6 * sub.policy.social + 0.4 * sub.policy.authority : 0;
  };
  const chambers = c.legislature?.chambers ?? [];
  const chamber = chambers[Math.min(chamberIx, chambers.length - 1)];
  const groups: SeatGroup[] = chamber
    ? (() => {
        const seats = cs.seats[chamber.id] ?? {};
        const ps = Object.keys(seats).filter((k) => !SPECIAL[k]).sort((a, b) => partyOrder(a) - partyOrder(b));
        return [
          ...ps.map((k) => {
            const p = db.parties.get(k);
            return { key: k, label: p?.abbrev.en ?? k, color: p?.color ?? "#777", seats: seats[k]!, governing: cs.rulingParties.includes(k) };
          }),
          ...Object.keys(seats).filter((k) => SPECIAL[k]).map((k) => ({ key: k, label: SPECIAL[k]!.label, color: SPECIAL[k]!.color, seats: seats[k]! })),
        ];
      })()
    : [];

  const parties = cc.parties
    .filter((p) => cs.partyStatus[p.id] !== "not_yet_founded" && cs.partyStatus[p.id] !== "dissolved")
    .sort((a, b) => (cs.partyPopularity[b.id] ?? 0) - (cs.partyPopularity[a.id] ?? 0));
  const seatsOf = (pid: string) => Object.values(cs.seats).reduce((s, ch) => s + (ch[pid] ?? 0), 0);
  const cabinet = [...cc.cabinet, ...cc.military];
  const elections = cs.schedule.slice(0, 4);
  const support = governmentSupport(db, cs);
  const factors = partyFactors(db, cs, state.day);
  const results = state.elections.filter((e) => e.tag === tag).slice(-5).reverse();
  const snapChamber = chambers.find((ch) => ch.confidence_chamber && cs.schedule.some((e) => e.chamber === ch.id && e.snapPossible));

  return (
    <div class="pol">
      <div class="pol-nation"><Placard db={db} state={state} tag={tag} up size="md" /></div>
      {/* ---- leader block (HOI4 government header) */}
      <div class="pol-leader">
        <div class="pframe" style={{ "--tint": leaderParty?.color ?? "#555" }}>
          <Portrait size="lg" />
        </div>
        <div class="pinfo">
          <h3 class="pname">{leader?.name.en ?? (cs.govType === "military_junta" ? "Military council" : "Vacant")}</h3>
          <div class="ptitle">{execOffice?.title.en ?? "Leader"}</div>
          {leader && <div class="dim">{ageOn(leader.birth_year, state.day)} years old, born {leader.birth_year}</div>}
          {leaderParty && (
            <div class="pparty" {...tip(() => ({ title: leaderParty.name.en, rows: [["Ideology", db.subIdeologies.get(leaderParty.sub_ideology)?.name ?? "—"], ["Support", pct(cs.partyPopularity[leaderParty.id] ?? 0)]] }))}>
              <i class="sw" style={{ background: leaderParty.color }} />
              {leaderParty.name.en}
            </div>
          )}
          <div class="ptags">
            <span class="ptag" {...tip(() => ({ title: gov?.name ?? "Government", body: <span class="dim">{gov?.description}</span> }))}>{gov?.name}</span>
            {leaderSub && <span class="ptag" style={{ "--c": leaderSub.color }}>{leaderSub.name}</span>}
          </div>
        </div>
      </div>

      {others.length > 0 && (
        <div class="pol-others">
          {others.map(({ p, title }) => (
            <div class="slot" key={title}>
              <Portrait size="sm" />
              <div>
                <div class="sname">{p?.name.en ?? "Vacant"}</div>
                <div class="faint small">{title}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div class="hp-section">Government</div>
      <div class="chips">
        {cs.rulingParties.map((id) => {
          const p = db.parties.get(id);
          return p ? <span class="chip" key={id}><i class="sw" style={{ background: p.color }} />{p.name.en}</span> : null;
        })}
        {cs.rulingParties.length === 0 && <span class="faint">No party government</span>}
        {cs.confidenceAndSupply.map((id) => {
          const p = db.parties.get(id);
          return p ? (
            <span class="chip faint" key={id} {...tip(() => ({ title: `${p.name.en}: outside support`, note: "Backs the government in confidence votes without holding office." }))}>
              <i class="sw" style={{ background: p.color }} />{p.abbrev.en} (support)
            </span>
          ) : null;
        })}
      </div>
      <dl class="kv gov-kv">
        {support && (
          <>
            <dt>Support in parliament</dt>
            <dd
              class={`num ${support.support >= support.majority ? "good" : "warn"}`}
              {...tip(() => ({
                title: "Government support",
                rows: [["Seats backing the government", support.support], ["Majority", support.majority], ["Seats", support.total]],
                note: support.support >= support.majority ? "The government has a working majority." : "A minority government: it may lose a confidence vote, more easily when stability is low.",
              }))}
            >
              {support.support} of {support.total} (majority {support.majority})
            </dd>
          </>
        )}
        <dt>Unrest</dt>
        <dd
          class={`num ${cs.unrest >= 0.4 ? "bad" : cs.unrest >= 0.15 ? "warn" : ""}`}
          {...tip(() => ({
            title: "Unrest",
            rows: [["Level", `${Math.round(cs.unrest * 100)}%`], ["Stability target", `−${Math.round(cs.unrest * db.politicsRules.unrest.stability_penalty * 100)}%`]],
            note: "Protests, strikes, mass movements and uprisings by unhappy interest groups raise it, and it fades by itself. High unrest makes coups and civil war possible.",
          }))}
        >
          {Math.round(cs.unrest * 100)}%{cs.civilWar ? " · civil war" : ""}
        </dd>
        <dt>Economic mood</dt>
        <dd
          class={`num ${cs.economicMood > 0.15 ? "good" : cs.economicMood < -0.15 ? "bad" : ""}`}
          {...tip(() => ({
            title: "Economic mood",
            rows: [["Mood (−100 to +100)", Math.round(cs.economicMood * 100)]],
            note: "Helps or hurts governing parties at elections and moves interest group approval. Driven by growth against trend, unemployment and inflation (see the Economy panel).",
          }))}
        >
          {cs.economicMood >= 0 ? "+" : ""}
          {Math.round(cs.economicMood * 100)}
        </dd>
      </dl>
      {snapChamber && gov?.needs_majority && (
        <div class="pad row-act">
          <button
            class="btn"
            disabled={cs.politicalPower < 50}
            onClick={() => setMsg(session.dispatch({ type: "call_snap_election", tag, chamber: snapChamber.id }).text)}
            {...tip(() => ({
              title: "Call an early election",
              rows: [["Cost", "50 PP"], ["Held in", `${db.politicsRules.coalitions.snap_election_delay_days} days`]],
              note: `Dissolves the ${snapChamber.name.en}. The new chamber forms the next government.`,
            }))}
          >
            Call early election
          </button>
          {msg && <span class="dim small">{msg}</span>}
        </div>
      )}

      <div class="hp-section">National spirits</div>
      <div class="chips">
        {cs.spirits.map((id) => {
          const sp = db.spirits.get(id);
          if (!sp) return null;
          return (
            <span
              class={`chip spirit ${sp.kind}`}
              key={id}
              {...tip(() => ({
                title: sp.name,
                body: <span class="dim">{sp.description}</span>,
                rows: describeModifiers(db, sp.modifiers).map((l) => [l, ""] as [string, string]),
                note: sp.kind === "problem" ? "A national problem: focuses, decisions and events can remove it." : undefined,
              }))}
            >
              {sp.name}
            </span>
          );
        })}
        {cs.spirits.length === 0 && <span class="faint">None</span>}
      </div>

      <div class="hp-section">Cabinet and high command</div>
      {cabinet.length === 0 ? (
        <p class="faint small pad">Cabinet data arrives with the database's second research pass.</p>
      ) : (
        <div class="slots">
          {cabinet.map((o) => {
            const h = holders(db, cs, o.id)[0];
            return (
              <div class="slot" key={o.id} {...tip(() => ({ title: o.title.en, rows: [["Holder", h?.name.en ?? "Vacant"], ...(h ? [["Born", String(h.birth_year)] as [string, string]] : [])] }))}>
                <Portrait size="sm" />
                <div class="slot-txt">
                  <div class="sname clip">{h?.name.en ?? "Vacant"}</div>
                  <div class="faint small clip">{o.title.en.replace(/^(Federal )?Minister (of|for) (the )?/i, "")}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {chamber && (
        <>
          <div class="hp-section">Parliament</div>
          {chambers.length > 1 && (
            <div class="seg" role="tablist">
              {chambers.map((ch, i) => (
                <button key={ch.id} role="tab" aria-selected={i === chamberIx} class={i === chamberIx ? "on" : ""} onClick={() => setChamberIx(i)}>
                  {ch.name.en}
                </button>
              ))}
            </div>
          )}
          <div class="hp-well pad-sm">
            <Hemicycle groups={groups} total={groups.reduce((n, g) => n + g.seats, 0) || chamber.seats} title={chamber.name.en} />
          </div>
        </>
      )}

      <div class="hp-section">Popular support</div>
      <div class="hp-well pad-sm">
        <Donut
          size={128}
          slices={Object.entries(cs.ideologySupport).map(([k, v]) => {
            const s = db.subIdeologies.get(k);
            return { key: k, label: s?.name ?? k, color: s?.color ?? "#777", value: v };
          })}
        />
      </div>

      <div class="hp-section">Parties</div>
      <table class="tbl">
        <thead><tr><th></th><th>Party</th><th>Leader</th><th class="r">Support</th><th class="r">Seats</th></tr></thead>
        <tbody>
          {parties.map((p) => {
            const lead = cs.partyLeader[p.id];
            const pop = cs.partyPopularity[p.id] ?? 0;
            return (
              <tr
                key={p.id}
                class={cs.rulingParties.includes(p.id) ? "gov" : ""}
                {...tip(() => {
                  const f = factors[p.id];
                  return {
                    title: p.name.en,
                    rows: [
                      ["Ideology", db.subIdeologies.get(p.sub_ideology)?.name ?? "—"],
                      ["Founded", String(p.founded).slice(0, 4)],
                      ["Status", cs.partyStatus[p.id] ?? "—"],
                      ...(f
                        ? ([
                            ["From ideology support", `${(f.ideology * 100).toFixed(1)}%`],
                            ["Leader appeal", `×${f.leader.toFixed(2)}`],
                            ["Incumbency", `×${f.incumbency.toFixed(2)}`],
                            ["Economy", `×${f.economy.toFixed(2)}`],
                            ["Model share now", `${(f.share * 100).toFixed(1)}%`],
                          ] as [string, string][])
                        : []),
                    ],
                    note: "Support drifts toward the model share between elections, like polls.",
                  };
                })}
              >
                <td><i class="sw" style={{ background: p.color }} /></td>
                <td class="clip">{p.abbrev.en}</td>
                <td class="clip dim">{lead ? (db.people.get(lead)?.name.en ?? lead) : "—"}</td>
                <td class="r num">{pct(pop)}</td>
                <td class="r num">{seatsOf(p.id) || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div class="hp-section">Interest groups</div>
      <div class="igs">
        {[...db.interestGroupTypes.values()]
          .sort((a, b) => (cs.interestGroups[b.id]?.influence ?? 0) - (cs.interestGroups[a.id]?.influence ?? 0))
          .map((ig) => {
            const s = cs.interestGroups[ig.id]!;
            const tone = s.approval >= 55 ? "good" : s.approval < 40 ? "bad" : "";
            return (
              <div
                class="ig"
                key={ig.id}
                {...tip(() => ({
                  title: ig.name,
                  body: <span class="dim">{ig.description}</span>,
                  rows: [
                    ["Influence", `${Math.round(s.influence * 100)}%`],
                    ["Approval", Math.round(s.approval)],
                    ["Drifting toward", Math.round(igTarget(db, cs, ig.id))],
                    ...igTargetParts(db, cs, ig.id).map((pt) => [pt.label, `${pt.value > 0 ? "+" : ""}${Math.round(pt.value)}`] as [string, string]),
                  ],
                  note: "Approval moves 5% of the way to its target each week. Low approval leads to protests, strikes and worse.",
                }))}
              >
                <span class="ig-name">{ig.name}</span>
                <span class="meter"><span style={{ width: `${s.influence * 100}%` }} /></span>
                <span class={`ig-ap num ${tone}`}>{Math.round(s.approval)}</span>
              </div>
            );
          })}
      </div>

      <div class="hp-section">Laws</div>
      <div class="laws">
        {[...db.lawCategories.values()].map((cat) => {
          const law = cat.laws.find((l) => l.id === cs.laws[cat.id]);
          return (
            <button class="law" key={cat.id} onClick={() => setLawCat(cat.id)} {...tip(() => ({ title: law?.name ?? cat.name, body: <span class="dim">{law?.description}</span>, note: `${cat.name}. Click to change.` }))}>
              <span class="lname">{law?.name ?? "—"}</span>
              <span class="faint small">{cat.name}</span>
            </button>
          );
        })}
      </div>

      <div class="hp-section">Upcoming elections</div>
      {elections.length === 0 ? (
        <p class="faint small pad">{cc.elections?.no_elections_reason ?? (gov && !gov.holds_elections ? `No elections under a ${gov.name.toLowerCase()}.` : "No national elections scheduled.")}</p>
      ) : (
        <ul class="elist">
          {elections.map((e) => (
            <li key={e.key + e.day}>
              <b class="num">{formatDate(e.day)}</b>
              <span class="dim">
                {electionTitle(db, tag, { kind: e.kind, chamber: e.chamber, office: e.office })}
                {e.snap ? " (early)" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {results.length > 0 && (
        <>
          <div class="hp-section">Recent results</div>
          <ul class="elist">
            {results.map((r) => (
              <li key={r.id}>
                <b class="num">{formatDate(r.day)}</b>
                <button class="lnk" onClick={() => (electionNight.value = r)} {...tip(() => ({ title: electionTitle(db, tag, r), rows: [["Winner", nameOf(db, r.winner)]], note: "Open the full result." }))}>
                  {electionTitle(db, tag, r)}: {nameOf(db, r.winner)}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
