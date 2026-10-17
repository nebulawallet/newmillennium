/**
 * Peace conference (the player's side won): for each defeated country choose terms (annex, take
 * provinces picked on the map or in the list, puppet, change ideology) within the war-score
 * budget. The game stays paused; the map stays usable for picking provinces.
 * Also the notice shown when the AI imposes terms on the player.
 */
import { useState } from "preact/hooks";
import type { ContentDB } from "../../content/compile.ts";
import { formatDate } from "../../sim/date.ts";
import { partiesOfGroup, peaceBudget, provincesOf, termBlock, termCost, type PeaceTerm } from "../../sim/military/peace.ts";
import { countryName } from "../../sim/politics/unrest.ts";
import { Flag } from "../Flag.tsx";
import { Icon } from "../icons.tsx";
import { version, type Session } from "../session.ts";
import { draftTerms, peaceNotice, peacePick, toast } from "../store.ts";
import { tip } from "../tooltip.tsx";



export function PeaceScreen({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const [msg, setMsg] = useState("");
  const state = session.state;
  const ctx = session.sim?.context;
  const p = state?.pendingPeace;
  const war = p ? state?.wars.find((w) => w.id === p.war) : undefined;
  if (!state || !ctx || !p || !war || !state.player) return null;
  const losers = (p.winner === "attackers" ? war.defenders : war.attackers).filter((t) => state.countries[t]?.active);
  const winners = war[p.winner];
  const budget = peaceBudget(ctx, war, p.winner);
  const drafts = draftTerms.value;
  const draftOf = (t: string) => drafts[t] ?? { kind: "none" as const, provinces: [], ideology: null };
  const set = (t: string, patch: Partial<ReturnType<typeof draftOf>>) => (draftTerms.value = { ...drafts, [t]: { ...draftOf(t), ...patch } });
  const termsOf = (t: string): PeaceTerm[] => {
    const d = draftOf(t);
    const out: PeaceTerm[] = [];
    if (d.kind === "annex") out.push({ kind: "annex", target: t });
    if (d.kind === "provinces" && d.provinces.length) out.push({ kind: "provinces", target: t, provinces: d.provinces });
    if (d.kind === "puppet") out.push({ kind: "puppet", target: t });
    if (d.ideology && d.kind !== "annex") out.push({ kind: "ideology", target: t, group: d.ideology });
    return out;
  };
  const all = losers.flatMap(termsOf);
  const spent = all.reduce((s, t) => s + termCost(ctx, war, p.winner, t), 0);
  const sign = () => {
    const r = session.dispatch({ type: "sign_peace", terms: all });
    setMsg(r.text);
    if (r.ok) { draftTerms.value = {}; peacePick.value = null; toast.value = { text: r.text, at: Date.now() }; }
  };
  const groups = [...db.ideologyGroups.values()];
  return (
    <section class="peace hp" role="dialog" aria-label="Peace conference">
      <header class="hp-head">
        <span class="side-ic">{Icon.diplomacy({ size: 18 })}</span>
        <h2 class="hp-title">Peace conference: {war.name}</h2>
      </header>
      <div class="pc-top">
        <span class="faint small">Since {formatDate(war.startDay)}. {losers.map((t) => countryName(db, state, t)).join(", ")} capitulated.</span>
        <span class={`pc-budget num ${spent > budget ? "bad" : ""}`} {...tip(() => ({ title: "War score to spend", rows: [["Budget", budget], ["Spent", spent], ["Left", budget - spent]], note: "Your side's war score (100 on a capitulation). Terms cost more for larger countries." }))}>{budget - spent} / {budget} war score left</span>
      </div>
      <div class="pc-list">
        {losers.map((t) => {
          const d = draftOf(t);
          const own = provincesOf(state, t);
          const held = own.filter((id) => winners.includes(state.provinceController[id - 1]!));
          const cost = (term: PeaceTerm) => termCost(ctx, war, p.winner, term);
          const opt = (kind: "none" | "annex" | "provinces" | "puppet", label: string, term: PeaceTerm | null, note: string) => (
            <button class={`btn ${d.kind === kind ? "primary" : ""}`} onClick={() => { set(t, { kind, provinces: kind === "provinces" && !d.provinces.length ? held : d.provinces }); if (kind === "provinces") peacePick.value = t; }}
              {...tip(() => ({ title: label, rows: term ? [["Cost", cost(term)]] : [], note }))}>{label}{term ? ` (${cost(term)})` : ""}</button>
          );
          return (
            <div class="pc-country" key={t}>
              <div class="pc-head">
                <Flag db={db} tag={t} size="md" />
                <div>
                  <div class="wp-name">{countryName(db, state, t)}</div>
                  <div class="faint small">{own.length} provinces; you hold {held.length}</div>
                </div>
              </div>
              <div class="pc-opts">
                {opt("none", "Leave", null, "No land or government change for this country.")}
                {opt("annex", "Annex", { kind: "annex", target: t }, "All its land becomes yours; its army disbands and the country is gone.")}
                {opt("provinces", "Take provinces", { kind: "provinces", target: t, provinces: d.provinces.length ? d.provinces : held }, "Pick provinces on the map (click them) or in the list; the rest stays independent.")}
                {opt("puppet", "Puppet", { kind: "puppet", target: t }, "It keeps its borders as your subject: it follows you into wars and wears your colour.")}
              </div>
              {d.kind === "provinces" && (
                <div class="pc-prov">
                  <div class="faint small">{peacePick.value === t ? "Click its provinces on the map to add or remove them." : <button class="lnk" onClick={() => (peacePick.value = t)}>Pick on the map</button>} · {d.provinces.length} chosen</div>
                  <div class="pc-chips">
                    {own.map((id) => (
                      <label key={id} class={`chip ${d.provinces.includes(id) ? "on" : ""}`}>
                        <input type="checkbox" checked={d.provinces.includes(id)} onChange={() => set(t, { provinces: d.provinces.includes(id) ? d.provinces.filter((x) => x !== id) : [...d.provinces, id] })} />
                        {session.map.provinces[id - 1]?.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {d.kind !== "annex" && (
                <label class="pc-ideo" {...tip(() => ({ title: "Change ideology", rows: [["Cost", db.warRules.peace.ideology_cost]], note: "Installs the most popular party of that ideology, led by its leader of the day. Only ideologies with a party in that country." }))}>
                  Change ideology
                  <select value={d.ideology ?? ""} onChange={(e) => set(t, { ideology: (e.target as HTMLSelectElement).value || null })}>
                    <option value="">Keep the government</option>
                    {groups.map((g) => {
                      const ok = partiesOfGroup(db, state, t, g.id).length > 0;
                      return <option key={g.id} value={g.id} disabled={!ok}>{g.name}{ok ? "" : " (no such party)"}</option>;
                    })}
                  </select>
                </label>
              )}
              {termsOf(t).map((term) => termBlock(ctx, term)).filter(Boolean).map((b) => <p class="bad small">{b}</p>)}
            </div>
          );
        })}
      </div>
      {msg && <p class="dim small pad">{msg}</p>}
      <footer class="event-foot pc-foot">
        <button class="btn" onClick={() => { draftTerms.value = {}; }}>Reset</button>
        <button class="btn primary" disabled={spent > budget} onClick={sign} {...tip(() => ({ title: "Sign the peace", rows: all.map((term) => [`${term.kind} ${countryName(db, state, term.target)}`, termCost(ctx, war, p.winner, term)] as [string, number]), note: "Occupied land you do not take goes back; divisions in foreign land go home." }))}>Sign the peace</button>
      </footer>
    </section>
  );
}

export function PeaceNotice() {
  const n = peaceNotice.value;
  if (!n) return null;
  return (
    <div class="scrim">
      <section class="event hp" role="dialog" aria-label={n.title}>
        <header class="hp-head">
          <span class="side-ic">{Icon.diplomacy({ size: 18 })}</span>
          <h2 class="hp-title">{n.title}</h2>
        </header>
        <div class="event-body">
          <ul class="elist">{n.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          <p class="faint small">Occupied land not taken was returned; divisions in foreign land went home.</p>
        </div>
        <footer class="event-foot"><button class="btn primary wide" onClick={() => (peaceNotice.value = null)}>Accept</button></footer>
      </section>
    </div>
  );
}
