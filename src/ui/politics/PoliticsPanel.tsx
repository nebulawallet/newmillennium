import { useState } from "preact/hooks";
import type { ContentDB } from "../../content/compile.ts";
import type { Person } from "../../content/schemas/country.ts";
import { ageOn, dayOf, formatDate, isoOf } from "../../sim/date.ts";
import type { CountryState, GameState } from "../../sim/state.ts";
import { Donut } from "../charts/Donut.tsx";
import { Hemicycle, type SeatGroup } from "../charts/Hemicycle.tsx";
import { Portrait } from "../hud/SidePanel.tsx";
import { version } from "../session.ts";
import { tip } from "../tooltip.tsx";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const SPECIAL: Record<string, { label: string; color: string }> = {
  independents: { label: "Independents", color: "#8a8f84" },
  others: { label: "Others", color: "#6b6f66" },
  appointed: { label: "Appointed", color: "#4f534c" },
  vacant: { label: "Vacant", color: "#2a2d29" },
  speaker: { label: "Speaker", color: "#a49d86" },
};

function holders(db: ContentDB, cs: CountryState, officeId: string): (Person | null)[] {
  if (db.offices.get(officeId)?.ex_officio_of) return [];
  return (cs.offices[officeId] ?? []).map((id) => (id ? (db.people.get(id) ?? null) : null));
}

function upcomingElections(db: ContentDB, tag: string, day: number) {
  const el = db.countries.get(tag)?.elections;
  if (!el) return [];
  const today = isoOf(day);
  const real = el.elections.filter((e) => e.date >= today).slice(0, 3).map((e) => ({ date: e.date, kind: e.kind, chamber: e.chamber, office: e.office }));
  const projected = el.rules.map((r) => {
    let d = dayOf(r.anchor);
    const step = Math.round(r.every_years * 365.25);
    while (d < day) d += step;
    return { date: isoOf(d), kind: r.kind, chamber: r.chamber, office: r.office };
  });
  return [...real, ...projected.filter((p) => !real.some((x) => x.kind === p.kind && x.chamber === p.chamber))].slice(0, 4);
}

export function PoliticsPanel({ db, state, tag }: { db: ContentDB; state: GameState; tag: string }) {
  version.value;
  const [chamberIx, setChamberIx] = useState(0);
  const cc = db.countries.get(tag);
  const c = cc?.country;
  const cs = state.countries[tag];
  if (!cc || !c || !cs) return <p class="dim pad">No politics data for this country yet.</p>;

  const gov = db.governmentTypes.get(c.government.type);
  const execOffice = db.offices.get(c.government.effective_executive);
  const hosOffice = db.offices.get(c.government.head_of_state_office);
  const exOfficio = (officeId: string | undefined) => {
    const o = officeId ? db.offices.get(officeId) : undefined;
    if (!o?.ex_officio_of) return null;
    const target = db.offices.get(o.ex_officio_of);
    const pid = target ? state.countries[target.tag]?.offices[o.ex_officio_of]?.[0] : null;
    return pid ? (db.people.get(pid) ?? null) : null;
  };
  const leader = execOffice?.ex_officio_of ? exOfficio(execOffice.id) : holders(db, cs, c.government.effective_executive)[0] ?? null;
  const hos = hosOffice?.ex_officio_of ? [exOfficio(hosOffice.id)] : holders(db, cs, c.government.head_of_state_office);
  const hog = holders(db, cs, c.government.head_of_government_office);
  const leaderParty = (leader?.party ? db.parties.get(leader.party) : undefined) ?? (cs.rulingParties[0] ? db.parties.get(cs.rulingParties[0]) : undefined);
  const leaderSub = leader ? db.subIdeologies.get(leader.sub_ideology) : undefined;
  const others = [
    ...(c.government.head_of_state_office !== c.government.effective_executive ? hos.map((p) => ({ p, title: hosOffice?.title.en ?? "Head of state" })) : []),
    ...(c.government.head_of_government_office !== c.government.effective_executive && c.government.head_of_government_office !== c.government.head_of_state_office
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
    .filter((p) => cs.partyStatus[p.id] !== "not_yet_founded")
    .sort((a, b) => (cs.partyPopularity[b.id] ?? 0) - (cs.partyPopularity[a.id] ?? 0));
  const seatsOf = (pid: string) => Object.values(cs.seats).reduce((s, ch) => s + (ch[pid] ?? 0), 0);
  const cabinet = [...cc.cabinet, ...cc.military];
  const elections = upcomingElections(db, tag, state.day);

  return (
    <div class="pol">
      {/* ---- leader block (HOI4 government header) */}
      <div class="pol-leader">
        <div class="pframe" style={{ "--tint": leaderParty?.color ?? "#555" }}>
          <Portrait size="lg" />
        </div>
        <div class="pinfo">
          <h3 class="pname">{leader?.name.en ?? "Vacant"}</h3>
          <div class="ptitle">{execOffice?.title.en ?? "Leader"}</div>
          {leader && <div class="dim">{ageOn(leader.birth_year, state.day)} years old, born {leader.birth_year}</div>}
          {leaderParty && (
            <div class="pparty" {...tip(() => ({ title: leaderParty.name.en, rows: [["Ideology", db.subIdeologies.get(leaderParty.sub_ideology)?.name ?? "—"], ["Support", pct(cs.partyPopularity[leaderParty.id] ?? 0)]] }))}>
              <i class="sw" style={{ background: leaderParty.color }} />
              {leaderParty.name.en}
            </div>
          )}
          <div class="ptags">
            <span class="ptag">{gov?.name}</span>
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
                <div class="faint small">{title}</div>
                <div class="sname">{p?.name.en ?? "Vacant"}</div>
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
                  <div class="faint small clip">{o.title.en.replace(/^(Federal )?Minister (of|for) (the )?/i, "")}</div>
                  <div class="sname clip">{h?.name.en ?? "Vacant"}</div>
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
            <Hemicycle groups={groups} total={chamber.seats} title={chamber.name.en} />
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
              <tr key={p.id} class={cs.rulingParties.includes(p.id) ? "gov" : ""} {...tip(() => ({ title: p.name.en, rows: [["Ideology", db.subIdeologies.get(p.sub_ideology)?.name ?? "—"], ["Founded", String(p.founded).slice(0, 4)], ["Status", cs.partyStatus[p.id] ?? "—"]] }))}>
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
              <div class="ig" key={ig.id} {...tip(() => ({ title: ig.name, body: <span class="dim">{ig.description}</span>, rows: [["Influence", `${Math.round(s.influence * 100)}%`], ["Approval", Math.round(s.approval)]] }))}>
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
            <div class="law" key={cat.id} {...tip(() => ({ title: law?.name ?? cat.name, body: <span class="dim">{law?.description}</span>, note: `${cat.name}. Changing laws arrives in Phase 5.` }))}>
              <span class="faint small">{cat.name}</span>
              <span class="lname">{law?.name ?? "—"}</span>
            </div>
          );
        })}
      </div>

      <div class="hp-section">Upcoming elections</div>
      {elections.length === 0 ? (
        <p class="faint small pad">{cc.elections?.no_elections_reason ?? "No national elections scheduled."}</p>
      ) : (
        <ul class="elist">
          {elections.map((e) => (
            <li key={e.date + e.kind}>
              <b class="num">{formatDate(dayOf(e.date))}</b>
              <span class="dim">
                {e.kind.replace(/_/g, " ")}
                {e.chamber ? ` · ${chambers.find((x) => x.id === e.chamber)?.name.en ?? e.chamber}` : ""}
                {e.office ? ` · ${db.offices.get(e.office)?.title.en ?? ""}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
