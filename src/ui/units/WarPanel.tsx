/**
 * War overview (opened from the outliner's Wars list or a battle marker): both sides with their
 * allies, the war goal, the start date, the war score, casualties, battles won, territory held,
 * and the battles under way (click one to look at it).
 */
import type { ContentDB } from "../../content/compile.ts";
import { formatDate } from "../../sim/date.ts";
import { warStatus, type SideStatus } from "../../sim/military/war.ts";
import { countryName } from "../../sim/politics/unrest.ts";
import { millerY } from "../../render/MapView.ts";
import type { War } from "../../sim/state.ts";
import { Flag } from "../Flag.tsx";
import { Icon } from "../icons.tsx";
import { Placard } from "../Placard.tsx";
import { version, type Session } from "../session.ts";
import { openWar, toast } from "../store.ts";
import { tip } from "../tooltip.tsx";

const fmt = new Intl.NumberFormat("en");
const GOAL: Record<War["goal"], [string, string]> = {
  conquest: ["Conquest", "The winner keeps the land it holds (or settles it at a peace conference)."],
  status_quo: ["Status quo", "Peace returns occupied land to its owners."],
  limited: ["Limited war", "The attacker aims only at land near its border; nobody capitulates."],
};

function Side({ db, session, war, side, st, mine }: { db: ContentDB; session: Session; war: War; side: "attackers" | "defenders"; st: SideStatus; mine: boolean }) {
  const state = session.state!;
  const tags = war[side];
  return (
    <div class={`wp-side ${mine ? "mine" : ""}`}>
      <div class="wp-lead">
        <Placard db={db} state={state} tag={tags[0]!} up={mine} size="md" />
        <span class="wp-role">{side === "attackers" ? "Attacker" : "Defender"}{tags.length > 1 ? `, with ${tags.length - 1} all${tags.length > 2 ? "ies" : "y"}` : ""}</span>
      </div>
      {tags.length > 1 && (
        <div class="wp-allies">
          {tags.slice(1).map((t) => <span key={t} {...tip(() => ({ title: countryName(db, state, t), note: "Fights on this side." }))}><Placard db={db} state={state} tag={t} up={mine && t === state.player} /></span>)}
        </div>
      )}
      <dl class="kv wp-kv">
        <dt>War score</dt><dd class="num" {...tip(() => ({ title: "War score", rows: [["Score", st.score], ["Enemy land held", `${fmt.format(st.provinces)} provinces`], ["Battles won", st.victories]], note: "Occupation of the enemy's population (up to 60), its share of the casualties (20) and battles won (20). The winner spends it at the peace conference." }))}>{st.score}</dd>
        <dt>Casualties</dt><dd class="num" {...tip(() => ({ title: "Casualties", rows: [["Manpower lost", fmt.format(Math.round(st.casualties))]], note: "Soldiers lost in battle (strength lost times the division's manpower)." }))}>{fmt.format(Math.round(st.casualties))}</dd>
        <dt>Battles won</dt><dd class="num">{st.victories}</dd>
        <dt>Enemy land held</dt><dd class="num" {...tip(() => ({ title: "Territory", rows: [["Provinces", st.provinces], ["People", fmt.format(Math.round(st.population))]] }))}>{st.provinces} provinces · {fmt.format(Math.round(st.population / 1e6 * 10) / 10)}M people</dd>
        <dt>Own land lost</dt><dd class={`num ${st.occupied > 0.3 ? "bad" : ""}`} {...tip(() => ({ title: "Occupied", rows: [["Share of the population", `${Math.round(st.occupied * 100)}%`]], note: `At ${Math.round(db.warRules.capitulation_share * 100)}% the side's leader capitulates.` }))}>{Math.round(st.occupied * 100)}%</dd>
        <dt>War support</dt><dd class="num">{Math.round((state.countries[tags[0]!]?.warSupport ?? 0) * 100)}%</dd>
      </dl>
    </div>
  );
}

export function WarPanel({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const state = session.state;
  const ctx = session.sim?.context;
  const war = state?.wars.find((w) => w.id === openWar.value);
  if (!state || !ctx || !war) return null;
  const st = warStatus(ctx, war);
  const me = state.player ?? "";
  const total = Math.max(1, st.attackers.score + st.defenders.score);
  const sides = new Set([...war.attackers, ...war.defenders]);
  const battles = state.battles.filter((b) => sides.has(b.attackerTag) && sides.has(b.defenderTag));
  const days = state.day - war.startDay;
  const look = (p: number) => {
    const pr = session.map.provinces[p - 1];
    if (pr) session.world.view.lookAt(pr.centroid[0], millerY(pr.centroid[1]), 9);
  };
  const color = (t: string) => state.dynamicCountries[t]?.color ?? db.countryColors.get(t) ?? "#888";
  return (
    <section class="war-panel hp" aria-label={war.name}>
      <header class="hp-head">
        <span class="side-ic">{Icon.warSupport({ size: 16 })}</span>
        <h2 class="hp-title">{war.name}</h2>
        <button class="x" onClick={() => (openWar.value = null)} aria-label="Close">{Icon.close({ size: 12 })}</button>
      </header>
      <div class="wp-meta">
        <span {...tip(() => ({ title: GOAL[war.goal][0], note: GOAL[war.goal][1] }))}><b>{GOAL[war.goal][0]}</b></span>
        <span class="faint">since {formatDate(war.startDay)} · {days >= 365 ? `${(days / 365).toFixed(1)} years` : `${days} days`}</span>
        {war.armedGroup && <span class="faint">· against an armed group</span>}
        {(war.attackers.includes(me) || war.defenders.includes(me)) && (
          <button class="btn wp-peace" onClick={() => { const r = session.dispatch({ type: "offer_peace", tag: me, war: war.id }); toast.value = { text: r.text, bad: !r.ok, at: Date.now() }; if (r.ok) openWar.value = null; }}
            {...tip(() => ({ title: "Offer white peace", note: "Both sides keep their own land. The enemy accepts when it is not winning, is worn out, or after a long, even war." }))}>Offer white peace</button>
        )}
      </div>
      <div class="wp-score" {...tip(() => ({ title: "War score", rows: [["Attackers", st.attackers.score], ["Defenders", st.defenders.score]], note: "The bar shows who is winning." }))}>
        <span class="num">{st.attackers.score}</span>
        <span class="wp-bar"><i style={{ width: `${(st.attackers.score / total) * 100}%`, background: color(war.attackers[0]!) }} /><i style={{ width: `${(st.defenders.score / total) * 100}%`, background: color(war.defenders[0]!) }} /></span>
        <span class="num">{st.defenders.score}</span>
      </div>
      <div class="wp-sides">
        <Side db={db} session={session} war={war} side="attackers" st={st.attackers} mine={war.attackers.includes(me)} />
        <Side db={db} session={session} war={war} side="defenders" st={st.defenders} mine={war.defenders.includes(me)} />
      </div>
      <div class="hp-section">Battles ({battles.length})</div>
      {battles.length === 0 ? <p class="faint small pad">No battles under way.</p> : (
        <ul class="wp-battles">
          {battles.map((b) => (
            <li key={b.province} onClick={() => look(b.province)} {...tip(() => ({
              title: `Battle of ${session.map.provinces[b.province - 1]?.name}`,
              rows: [
                ["Attacker", `${countryName(db, state, b.attackerTag)}: ${b.attackers.length} divisions from ${b.directions ?? 1} direction${(b.directions ?? 1) > 1 ? "s" : ""}`],
                ["Defender", `${countryName(db, state, b.defenderTag)}: ${b.defenders.length} divisions`],
                ["Progress", `${Math.round((b.progress ?? 0.5) * 100)}% toward the attacker`],
                ["Terrain", `${b.terrain ?? "?"} (+${Math.round((b.terrainBonus ?? 0) * 100)}% defence)`],
                ["Entrenchment", `+${Math.round((b.entrenchment ?? 0) * 100)}%`],
                ["Flanking", `+${Math.round((b.flanking ?? 0) * 100)}%`],
                ["River", b.river ? `${b.river.name}: ${b.river.crossing} attacking across (−${Math.round(db.warRules.river_crossing_penalty * 100)}% attack)` : "none"],
                ["Air", `${(b.air ?? 0) >= 0 ? "+" : ""}${Math.round((b.air ?? 0) * 100)}% to the attacker`],
                ["Supply", `${Math.round((b.supply?.attacker ?? 1) * 100)}% / ${Math.round((b.supply?.defender ?? 1) * 100)}%`],
                ["Casualties", `${fmt.format(Math.round(b.casualties?.attacker ?? 0))} / ${fmt.format(Math.round(b.casualties?.defender ?? 0))}`],
              ],
              note: `Since ${formatDate(b.startDay)}. Click to look at it.`,
            }))}>
              <span class="row-flag"><Flag db={db} tag={b.attackerTag} size="xs" /><span class="faint">vs</span><Flag db={db} tag={b.defenderTag} size="xs" /></span>
              <span class="clip">{session.map.provinces[b.province - 1]?.name}</span>
              <span class="wp-bar small"><i style={{ width: `${(b.progress ?? 0.5) * 100}%`, background: color(b.attackerTag) }} /><i style={{ width: `${(1 - (b.progress ?? 0.5)) * 100}%`, background: color(b.defenderTag) }} /></span>
              <span class="faint small num">{state.day - b.startDay}d</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
