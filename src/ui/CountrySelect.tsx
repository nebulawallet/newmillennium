import { useMemo, useState } from "preact/hooks";
import type { ContentDB, Issue } from "../content/compile.ts";
import { countrySummary } from "../content/query.ts";
import { REGIONS } from "../content/schemas/definitions.ts";
import { SaveList } from "./hud/GameMenu.tsx";
import { Portrait } from "./hud/SidePanel.tsx";
import { Flag } from "./Flag.tsx";
import { Icon } from "./icons.tsx";
import type { Session } from "./session.ts";
import { pickedCountry } from "./store.ts";
import { tip } from "./tooltip.tsx";

const REGION_NAMES: Record<string, string> = {
  europe: "Europe", former_ussr: "Former USSR", north_america: "North America", latam_caribbean: "Latin America",
  mena: "Middle East & North Africa", subsaharan_africa: "Sub-Saharan Africa", south_asia: "South Asia",
  east_se_asia: "East & Southeast Asia", oceania: "Oceania",
};


/** HOI4-style country selection: bookmark plaque, featured nations, map picking, nation card. */
export function CountrySelect({ db, session, issues }: { db: ContentDB; session: Session; issues: Issue[] }) {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const [mode, setMode] = useState<"historical" | "dynamic">("historical");
  const [showLoad, setShowLoad] = useState(false);
  const selected = pickedCountry.value;

  const rows = useMemo(() => db.countryList.map((e) => ({ entry: e, summary: countrySummary(db, e.tag) })), [db]);
  const featured = rows.filter((r) => r.summary && r.entry.detail_tier === 1 && r.entry.start_status === "independent");
  const list = rows.filter(
    (r) =>
      (region === "all" || r.entry.region === region) &&
      `${r.entry.name} ${r.entry.short_name ?? ""} ${r.entry.tag} ${r.summary?.headOfGovernment ?? ""} ${r.summary?.headOfState ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );
  const withData = rows.filter((r) => r.summary).length;
  const errors = issues.filter((i) => i.severity === "error").length;
  const sel = selected ? rows.find((r) => r.entry.tag === selected) : null;
  const playable = !!sel?.summary && sel.entry.start_status !== "releasable";

  const pick = (tag: string) => {
    pickedCountry.value = tag;
    const l = session.map.labels.find((x) => x.tag === tag);
    if (l) session.world.view.lookAt(l.x, l.y - Math.max(4, l.extent * 0.35), Math.max(14, Math.min(80, l.extent * 2.6)));
  };

  // leader of the selected country, for the portrait card
  const cc = sel ? db.countries.get(sel.entry.tag) : undefined;
  const execId = cc?.country ? cc.country.offices.find((o) => o.id === cc.country!.government.effective_executive)?.holders.find((h) => h.from <= "2000-01-01" && (!h.to || h.to > "2000-01-01"))?.person : undefined;
  const exec = execId ? db.people.get(execId) : undefined;
  const execTitle = cc?.country ? db.offices.get(cc.country.government.effective_executive)?.title.en : undefined;

  return (
    <>
      <div class="bookmark hp">
        <h1 class="bm-name">New Millennium</h1>
        <div class="bm-date">1 January 2000</div>
        <div class="bm-sub faint small">
          <span {...tip(() => ({ title: "Research tiers", rows: [["Full history", String(db.countryList.filter((e) => e.research === "full").length)], ["Light", String(db.countryList.filter((e) => e.research === "light").length)], ["Default profile", String(db.countryList.filter((e) => e.research === "default").length)]], note: "Default-profile countries have an economy, an army and diplomacy but no named politics; they are not playable." }))}>
            {withData} of {db.countryList.length} nations researched
          </span>
          {errors > 0 && <span class="warn"> · {errors} data errors (see console)</span>}
        </div>
      </div>

      <aside class="nations hp" aria-label="Choose a nation">
        <header class="hp-head"><h2 class="hp-title">Featured nations</h2></header>
        <div class="featured">
          {featured.map(({ entry }) => (
            <button key={entry.tag} class={`feat ${entry.tag === selected ? "on" : ""}`} onClick={() => pick(entry.tag)} {...tip(() => ({ title: entry.name, note: "Click to select, or click any country on the map." }))}>
              <Flag db={db} tag={entry.tag} size="sm" />
              <span>{entry.short_name ?? entry.name}</span>
            </button>
          ))}
        </div>
        <div class="hp-section">All nations</div>
        <div class="filters">
          <label class="searchbox">
            {Icon.search({ size: 14 })}
            <input type="search" placeholder="Nation or leader" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          </label>
          <select value={region} onChange={(e) => setRegion((e.target as HTMLSelectElement).value)} aria-label="Region">
            <option value="all">All regions</option>
            {REGIONS.map((r) => <option value={r}>{REGION_NAMES[r]}</option>)}
          </select>
        </div>
        <ul class="nlist">
          {list.map(({ entry, summary }) => (
            <li key={entry.tag}>
              <button class={`nrow ${entry.tag === selected ? "on" : ""} ${summary ? "" : "nodata"}`} onClick={() => pick(entry.tag)}>
                <Flag db={db} tag={entry.tag} size="sm" />
                <span class="nname">{entry.short_name ?? entry.name}</span>
                <span class="nlead">{summary ? summary.headOfGovernment : "being researched"}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <button class="btn load-btn" onClick={() => setShowLoad(!showLoad)}>Load game</button>
      {showLoad && (
        <section class="load-panel hp" aria-label="Load game">
          <header class="hp-head">
            <h2 class="hp-title">Load game</h2>
            <button class="x" onClick={() => setShowLoad(false)} aria-label="Close">{Icon.close({ size: 14 })}</button>
          </header>
          <div class="gm-body"><SaveList session={session} allowSave={false} /></div>
        </section>
      )}

      {sel && (
        <section class="nation-card hp" aria-label={sel.entry.name}>
          <div class="nc-flag"><Flag db={db} tag={sel.entry.tag} size="lg" /></div>
          <div class="nc-main">
            <h2 class="nc-name">{sel.entry.name}</h2>
            {sel.summary ? (
              <dl class="kv nc-kv">
                <dt>Government</dt><dd>{sel.summary.govType}</dd>
                <dt>Head of state</dt><dd>{sel.summary.headOfState}</dd>
                <dt>Head of government</dt><dd>{sel.summary.headOfGovernment}</dd>
                <dt>Ruling party</dt><dd><i class="sw" style={{ background: sel.summary.rulingPartyColor }} /> {sel.summary.rulingParty}</dd>
              </dl>
            ) : (
              <p class="dim">This nation's political data is still being researched.</p>
            )}
            {sel.entry.note && <p class="faint small nc-note">{sel.entry.note}</p>}
          </div>
          <div class="nc-leader">
            <div class="pframe" style={{ "--tint": sel.summary?.rulingPartyColor ?? "#555" }}><Portrait size="lg" /></div>
            <div class="small faint">{execTitle ?? ""}</div>
            <div class="nc-lname">{exec?.name.en ?? "—"}</div>
          </div>
          <div class="nc-actions">
            <div class="seg" role="radiogroup" aria-label="Elections">
              <button role="radio" aria-checked={mode === "historical"} class={mode === "historical" ? "on" : ""} onClick={() => setMode("historical")}
                {...tip(() => ({ title: "Historical elections", body: <span class="dim">Real leaders take office on their real dates, and real election winners are heavily weighted.</span> }))}>Historical</button>
              <button role="radio" aria-checked={mode === "dynamic"} class={mode === "dynamic" ? "on" : ""} onClick={() => setMode("dynamic")}
                {...tip(() => ({ title: "Dynamic elections", body: <span class="dim">Outcomes come purely from the simulation.</span> }))}>Dynamic</button>
            </div>
            <button class="btn primary wide" disabled={!playable} onClick={() => session.newGame(sel.entry.tag, { electionMode: mode })}>
              {playable ? "Play" : sel.entry.start_status === "releasable" ? "Releasable later" : "Not yet playable"}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
