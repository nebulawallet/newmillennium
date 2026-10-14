/**
 * Law change list for one category (opened from the laws grid in the politics panel): each law
 * with its political power cost, the expected vote in the legislature and how interest groups
 * would react. Enacting sends a change_law command.
 */
import { useState } from "preact/hooks";
import type { ContentDB } from "../../content/compile.ts";
import { checkLawChange } from "../../sim/politics/laws.ts";
import type { CountryState, GameState } from "../../sim/state.ts";
import { version, type Session } from "../session.ts";
import { tip } from "../tooltip.tsx";

const signed = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(Math.round(x))}`;

export function LawPicker({ db, session, state, cs, category, onClose }: { db: ContentDB; session: Session; state: GameState; cs: CountryState; category: string; onClose: () => void }) {
  version.value;
  const [msg, setMsg] = useState("");
  const cat = db.lawCategories.get(category);
  if (!cat) return null;
  const current = cs.laws[category];
  const chamberName = (id: string) => db.countries.get(cs.tag)?.country?.legislature?.chambers.find((c) => c.id === id)?.name.en ?? id;
  return (
    <div class="lawpick">
      <div class="lp-head">
        <h3 class="lp-title">{cat.name}</h3>
        <button class="lnk" onClick={onClose}>Back to politics</button>
      </div>
      <p class="dim small pad">{cat.description}</p>
      {msg && <p class="warn small pad">{msg}</p>}
      <ul class="lp-list">
        {cat.laws.map((law) => {
          const active = law.id === current;
          const chk = active ? null : checkLawChange(db, cs, category, law.id, state.day);
          const deltas = chk ? Object.entries(chk.approvalDelta).filter(([, d]) => Math.abs(d) >= 0.5).sort((a, b) => b[1] - a[1]) : [];
          return (
            <li key={law.id} class={`lp-law ${active ? "on" : ""}`}>
              <div class="lp-main">
                <span class="lp-name" {...tip(() => ({ title: law.name, body: <span class="dim">{law.description}</span>, rows: Object.entries(law.modifiers).map(([m, v]) => [db.modifiers.get(m)?.name ?? m, `${v > 0 ? "+" : ""}${db.modifiers.get(m)?.display === "percent" ? `${Math.round(v * 100)}%` : v}`] as [string, string]) }))}>
                  {law.name}
                </span>
                {active ? (
                  <span class="faint small">In force</span>
                ) : (
                  <span class="lp-meta">
                    <span class={`num ${cs.politicalPower >= chk!.cost ? "" : "bad"}`} {...tip(() => ({ title: "Political power cost", rows: [["Cost", chk!.cost], ["Available", Math.floor(cs.politicalPower)]], note: "Jumps of more than one step along the list cost more." }))}>{chk!.cost} PP</span>
                    {chk!.vote && (
                      <span class={`num ${chk!.vote.yes * 2 > chk!.vote.total ? "good" : "bad"}`}
                        {...tip(() => ({
                          title: `Expected vote: ${chamberName(chk!.vote!.chamber)}`,
                          rows: [
                            ["In favour", Math.round(chk!.vote!.yes)],
                            ["Against", Math.round(chk!.vote!.no)],
                            ...Object.entries(chk!.vote!.parties).map(([p, how]) => [db.parties.get(p)?.abbrev.en ?? p, how] as [string, string]),
                          ],
                          note: "Governing parties back their government unless their ideology forbids the law; others vote by their preferred laws.",
                        }))}>
                        {Math.round(chk!.vote.yes)} / {chk!.vote.total} for
                      </span>
                    )}
                  </span>
                )}
              </div>
              {deltas.length > 0 && (
                <div class="lp-igs">
                  {deltas.map(([ig, d]) => (
                    <span key={ig} class={`lp-ig ${d > 0 ? "good" : "bad"}`} {...tip(() => ({ title: db.interestGroupTypes.get(ig)?.name ?? ig, rows: [["Approval change", signed(d)], ["Influence", `${Math.round((cs.interestGroups[ig]?.influence ?? 0) * 100)}%`]] }))}>
                      {db.interestGroupTypes.get(ig)?.name} {signed(d)}
                    </span>
                  ))}
                </div>
              )}
              {!active && (
                <button
                  class="btn"
                  disabled={chk!.reasons.some((r) => !r.startsWith("Lacks a majority"))}
                  onClick={() => setMsg(session.dispatch({ type: "change_law", tag: cs.tag, category, law: law.id }).text)}
                  {...tip(() => ({ title: `Enact ${law.name}`, rows: chk!.reasons.map((r) => ["", r] as [string, string]), note: chk!.reasons.length ? undefined : "Passes if the vote holds." }))}
                >
                  Enact
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
