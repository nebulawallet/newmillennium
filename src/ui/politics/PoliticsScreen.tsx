import type { ContentDB } from "../../content/compile.ts";
import type { Person } from "../../content/schemas/country.ts";
import { ageOn, dayOf, formatDate, isoOf } from "../../sim/date.ts";
import type { CountryState, GameState } from "../../sim/state.ts";
import { Donut } from "../charts/Donut.tsx";
import { Hemicycle, type SeatGroup } from "../charts/Hemicycle.tsx";
import { panel, version } from "../session.ts";

interface Props {
  db: ContentDB;
  state: GameState;
  tag: string;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const SPECIAL: Record<string, { label: string; color: string }> = {
  independents: { label: "Independents", color: "#8a919c" },
  others: { label: "Others", color: "#6b7280" },
  appointed: { label: "Appointed", color: "#4b5563" },
  vacant: { label: "Vacant", color: "#2b313b" },
};

/** Silhouette placeholder; real portraits can replace it later (data/portraits/<person>.jpg). */
function Portrait({ person, role }: { person: Person | null; role: string }) {
  return (
    <div class="portrait">
      <svg viewBox="0 0 60 72" aria-hidden="true">
        <rect width="60" height="72" rx="4" fill="var(--panel-raised)" />
        <circle cx="30" cy="27" r="12" fill="var(--border-strong)" />
        <path d="M8 72 C10 52 20 45 30 45 C40 45 50 52 52 72 Z" fill="var(--border-strong)" />
      </svg>
      <div>
        <div class="faint small">{role}</div>
        <div class="pname">{person?.name.en ?? "Vacant"}</div>
      </div>
    </div>
  );
}

function officeHolders(db: ContentDB, cs: CountryState, officeId: string): (Person | null)[] {
  // ex officio offices are resolved by the caller (their holder lives in another country's state)
  if (db.offices.get(officeId)?.ex_officio_of) return [];
  return (cs.offices[officeId] ?? []).map((id) => (id ? (db.people.get(id) ?? null) : null));
}

function upcomingElections(db: ContentDB, tag: string, day: number) {
  const el = db.countries.get(tag)?.elections;
  if (!el) return [];
  const today = isoOf(day);
  const real = el.elections.filter((e) => e.date >= today).slice(0, 3).map((e) => ({ date: e.date, kind: e.kind, chamber: e.chamber, office: e.office }));
  if (real.length >= 3) return real;
  // continue the calendar from the recurrence rules
  const projected = el.rules.map((r) => {
    let d = dayOf(r.anchor);
    const step = Math.round(r.every_years * 365.25);
    while (d < day) d += step;
    return { date: isoOf(d), kind: r.kind, chamber: r.chamber, office: r.office };
  });
  return [...real, ...projected.filter((p) => !real.some((x) => x.kind === p.kind && x.chamber === p.chamber))].slice(0, 4);
}

export function PoliticsScreen({ db, state, tag }: Props) {
  version.value; // re-render as the game advances
  const cc = db.countries.get(tag);
  const c = cc?.country;
  const cs = state.countries[tag];
  if (!cc || !c || !cs) {
    return (
      <section class="politics panel">
        <header><h2>Politics</h2><button class="close" onClick={() => (panel.value = null)}>×</button></header>
        <p class="dim">No politics data for this country yet.</p>
      </section>
    );
  }
  const gov = db.governmentTypes.get(c.government.type);
  const hosOffice = db.offices.get(c.government.head_of_state_office);
  const hogOffice = db.offices.get(c.government.head_of_government_office);
  const exOfficioHolder = (officeId: string | undefined) => {
    const o = officeId ? db.offices.get(officeId) : undefined;
    if (!o?.ex_officio_of) return null;
    const target = db.offices.get(o.ex_officio_of);
    const owner = target ? state.countries[target.tag] : undefined;
    const pid = owner?.offices[o.ex_officio_of]?.[0];
    return pid ? (db.people.get(pid) ?? null) : null;
  };
  const hos = hosOffice?.ex_officio_of ? [exOfficioHolder(hosOffice.id)] : officeHolders(db, cs, c.government.head_of_state_office);
  const hog = hogOffice?.ex_officio_of ? [exOfficioHolder(hogOffice.id)] : officeHolders(db, cs, c.government.head_of_government_office);
  const sameExec = c.government.head_of_state_office === c.government.head_of_government_office;

  const partyOrder = (pid: string) => {
    const p = db.parties.get(pid);
    const sub = p ? db.subIdeologies.get(p.sub_ideology) : undefined;
    return sub ? sub.policy.economy + 0.6 * sub.policy.social + 0.4 * sub.policy.authority : 0;
  };
  const chamberGroups = (seats: Record<string, number>): SeatGroup[] => {
    const parties = Object.keys(seats).filter((k) => !SPECIAL[k]).sort((a, b) => partyOrder(a) - partyOrder(b));
    const special = Object.keys(seats).filter((k) => SPECIAL[k]);
    return [
      ...parties.map((k) => {
        const p = db.parties.get(k);
        return { key: k, label: p?.abbrev.en ?? k, color: p?.color ?? "#777", seats: seats[k]!, governing: cs.rulingParties.includes(k) };
      }),
      ...special.map((k) => ({ key: k, label: SPECIAL[k]!.label, color: SPECIAL[k]!.color, seats: seats[k]! })),
    ];
  };

  const parties = cc.parties
    .filter((p) => cs.partyStatus[p.id] !== "not_yet_founded")
    .sort((a, b) => (cs.partyPopularity[b.id] ?? 0) - (cs.partyPopularity[a.id] ?? 0));
  const seatsOf = (pid: string) => Object.values(cs.seats).reduce((s, ch) => s + (ch[pid] ?? 0), 0);
  const cabinet = [...cc.cabinet, ...cc.military];
  const elections = upcomingElections(db, tag, state.day);

  return (
    <section class="politics panel" aria-label={`Politics of ${c.name.en}`}>
      <header>
        <div>
          <h2 class="title">{c.name.en}</h2>
          <div class="dim">{gov?.name} · {formatDate(state.day)}</div>
        </div>
        <button class="close" onClick={() => (panel.value = null)} aria-label="Close">×</button>
      </header>

      <div class="pol-grid">
        <div class="card leaders">
          <h3>Leadership</h3>
          {hos.map((p) => (
            <Portrait person={p} role={`${hosOffice?.title.en ?? "Head of state"}${p ? ` · ${ageOn(p.birth_year, state.day)}` : ""}`} />
          ))}
          {!sameExec && hog.map((p) => (
            <Portrait person={p} role={`${hogOffice?.title.en ?? "Head of government"}${p ? ` · ${ageOn(p.birth_year, state.day)}` : ""}`} />
          ))}
          <div class="ruling">
            Government:{" "}
            {cs.rulingParties.map((id) => {
              const p = db.parties.get(id);
              return p ? <span class="chip"><i class="swatch" style={{ background: p.color }} />{p.abbrev.en}</span> : null;
            })}
            {cs.rulingParties.length === 0 && <span class="faint">no party government</span>}
          </div>
        </div>

        <div class="card">
          <h3>Cabinet and high command</h3>
          {cabinet.length === 0 && <p class="faint small">No cabinet data yet (Phase 2, Pass B).</p>}
          <dl class="cabinet">
            {cabinet.map((o) => {
              const holders = officeHolders(db, cs, o.id);
              return (
                <>
                  <dt>{o.title.en}</dt>
                  <dd>{holders.map((h) => h?.name.en ?? "Vacant").join(", ") || "Vacant"}</dd>
                </>
              );
            })}
          </dl>
        </div>

        {c.legislature?.chambers.map((ch) => (
          <div class="card" key={ch.id}>
            <h3>{ch.name.en} <span class="faint">({ch.seats} seats)</span></h3>
            <Hemicycle groups={chamberGroups(cs.seats[ch.id] ?? {})} total={ch.seats} title={ch.name.en} />
          </div>
        ))}

        <div class="card">
          <h3>Popular support</h3>
          <Donut
            slices={Object.entries(cs.ideologySupport).map(([k, v]) => {
              const s = db.subIdeologies.get(k);
              return { key: k, label: s?.name ?? k, color: s?.color ?? "#777", value: v };
            })}
          />
        </div>

        <div class="card wide">
          <h3>Parties</h3>
          <table class="parties">
            <thead>
              <tr><th></th><th>Party</th><th>Leader</th><th>Ideology</th><th class="num">Support</th><th class="num">Seats</th></tr>
            </thead>
            <tbody>
              {parties.map((p) => {
                const leader = cs.partyLeader[p.id];
                const popularity = cs.partyPopularity[p.id] ?? 0;
                return (
                  <tr key={p.id} class={cs.rulingParties.includes(p.id) ? "gov" : ""}>
                    <td><i class="swatch" style={{ background: p.color }} /></td>
                    <td>{p.name.en} <span class="faint">{p.abbrev.en}</span>{cs.partyStatus[p.id] === "banned" && <span class="warn"> banned</span>}</td>
                    <td>{leader ? (db.people.get(leader)?.name.en ?? leader) : "—"}</td>
                    <td class="dim">{db.subIdeologies.get(p.sub_ideology)?.name}</td>
                    <td class="num">
                      <span class="bar"><span style={{ width: `${Math.min(100, popularity * 100 * 2)}%`, background: p.color }} /></span>
                      {pct(popularity)}
                    </td>
                    <td class="num mono">{seatsOf(p.id) || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div class="card">
          <h3>Interest groups</h3>
          <table class="igs">
            <thead><tr><th>Group</th><th class="num">Influence</th><th class="num">Approval</th></tr></thead>
            <tbody>
              {[...db.interestGroupTypes.values()]
                .sort((a, b) => (cs.interestGroups[b.id]?.influence ?? 0) - (cs.interestGroups[a.id]?.influence ?? 0))
                .map((ig) => {
                  const s = cs.interestGroups[ig.id]!;
                  const tone = s.approval >= 55 ? "good" : s.approval < 40 ? "bad" : "";
                  return (
                    <tr key={ig.id}>
                      <td>{ig.name}</td>
                      <td class="num"><span class="bar"><span style={{ width: `${s.influence * 100}%` }} /></span>{Math.round(s.influence * 100)}</td>
                      <td class={`num ${tone}`}>{Math.round(s.approval)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div class="card">
          <h3>Laws</h3>
          <dl class="laws">
            {[...db.lawCategories.values()].map((cat) => {
              const law = cat.laws.find((l) => l.id === cs.laws[cat.id]);
              return (
                <>
                  <dt>{cat.name}</dt>
                  <dd title={law?.description}>{law?.name ?? "—"}</dd>
                </>
              );
            })}
          </dl>
        </div>

        <div class="card">
          <h3>Upcoming elections</h3>
          {elections.length === 0 && <p class="faint small">{cc.elections?.no_elections_reason ?? "No national elections scheduled."}</p>}
          <ul class="elections">
            {elections.map((e) => (
              <li key={e.date + e.kind}>
                <b>{formatDate(dayOf(e.date))}</b>
                <span class="dim">
                  {" "}{e.kind.replace(/_/g, " ")}
                  {e.chamber ? ` · ${c.legislature?.chambers.find((x) => x.id === e.chamber)?.name.en ?? e.chamber}` : ""}
                  {e.office ? ` · ${db.offices.get(e.office)?.title.en ?? ""}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p class="faint small">Election results are simulated from Phase 5.</p>
        </div>
      </div>
    </section>
  );
}
