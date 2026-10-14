import { useMemo, useState } from "preact/hooks";
import type { ContentDB, Issue } from "../content/compile.ts";
import { countrySummary } from "../content/query.ts";
import { REGIONS } from "../content/schemas/definitions.ts";
import { SaveList } from "./hud/GameMenu.tsx";
import type { Session } from "./session.ts";

const REGION_NAMES: Record<string, string> = {
  europe: "Europe",
  former_ussr: "Former USSR",
  north_america: "North America",
  latam_caribbean: "Latin America",
  mena: "Middle East & N. Africa",
  subsaharan_africa: "Sub-Saharan Africa",
  south_asia: "South Asia",
  east_se_asia: "East & SE Asia",
  oceania: "Oceania",
};

/** Start screen: pick a country (real 2000 leadership shown for every country with data). */
export function CountrySelect({ db, session, issues }: { db: ContentDB; session: Session; issues: Issue[] }) {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"historical" | "dynamic">("historical");
  const [showLoad, setShowLoad] = useState(false);

  const rows = useMemo(
    () =>
      db.countryList.map((e) => ({ entry: e, summary: countrySummary(db, e.tag) })),
    [db],
  );
  const shown = rows.filter(
    (r) =>
      (region === "all" || r.entry.region === region) &&
      (r.entry.name + r.entry.tag + (r.summary?.headOfGovernment ?? "") + (r.summary?.headOfState ?? "")).toLowerCase().includes(q.toLowerCase()),
  );
  const withData = rows.filter((r) => r.summary).length;
  const errors = issues.filter((i) => i.severity === "error").length;
  const sel = selected ? rows.find((r) => r.entry.tag === selected) : null;
  const playable = !!sel?.summary && sel.entry.start_status !== "releasable";

  return (
    <>
      <header class="titlebar panel">
        <span class="brand">NEW MILLENNIUM</span>
        <span class="dim">1 January 2000</span>
        <span class="faint">{withData} / {db.countryList.length} countries with politics data</span>
        {errors > 0 && <span class="issues">{errors} content errors (see console)</span>}
        <button class="tb-btn push" onClick={() => setShowLoad(!showLoad)}>Load game</button>
      </header>

      <aside class="country-list panel">
        <h2>Choose a country</h2>
        <input type="search" placeholder="Search countries or leaders" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <select value={region} onChange={(e) => setRegion((e.target as HTMLSelectElement).value)} aria-label="Region">
          <option value="all">All regions</option>
          {REGIONS.map((r) => <option value={r}>{REGION_NAMES[r]}</option>)}
        </select>
        <ul>
          {shown.map(({ entry, summary }) => (
            <li
              key={entry.tag}
              class={`${entry.tag === selected ? "active" : ""} ${summary ? "" : "nodata"}`}
              onClick={() => {
                setSelected(entry.tag);
                const l = session.map.labels.find((x) => x.tag === entry.tag);
                if (l) session.world.view.lookAt(l.x, l.y, Math.max(12, Math.min(70, l.extent * 2.4)));
              }}
            >
              <span class="swatch" style={{ background: db.countryColors.get(entry.tag) ?? "#555" }} />
              <span class="cname">{entry.short_name ?? entry.name}</span>
              <span class="faint mono">{entry.tag}</span>
              <div class="sub dim">{summary ? summary.headOfGovernment : "politics data being researched"}</div>
            </li>
          ))}
        </ul>
      </aside>

      {sel && (
        <section class="country-card panel">
          <h2>{sel.entry.name}</h2>
          {sel.summary ? (
            <dl>
              <dt>Government</dt>
              <dd>{sel.summary.govType}</dd>
              <dt>Head of state</dt>
              <dd>{sel.summary.headOfState}</dd>
              <dt>Head of government</dt>
              <dd>{sel.summary.headOfGovernment}</dd>
              <dt>Ruling party</dt>
              <dd><span class="swatch" style={{ background: sel.summary.rulingPartyColor }} /> {sel.summary.rulingParty}</dd>
            </dl>
          ) : (
            <p class="dim">Politics data for this country is still being researched.</p>
          )}
          {sel.entry.note && <p class="faint small">{sel.entry.note}</p>}
          <fieldset class="mode">
            <legend>Elections</legend>
            <label><input type="radio" name="mode" checked={mode === "historical"} onChange={() => setMode("historical")} /> Historical — real leaders and winners are followed and heavily weighted</label>
            <label><input type="radio" name="mode" checked={mode === "dynamic"} onChange={() => setMode("dynamic")} /> Dynamic — outcomes come purely from the simulation</label>
          </fieldset>
          <button class="primary" disabled={!playable} onClick={() => session.newGame(sel.entry.tag, { electionMode: mode })}>
            {playable ? `Play as ${sel.entry.short_name ?? sel.entry.name}` : sel.entry.start_status === "releasable" ? "Not playable at start (releasable)" : "Not yet playable"}
          </button>
        </section>
      )}

      {showLoad && (
        <section class="load-panel panel">
          <header><h2>Load game</h2><button class="close" onClick={() => setShowLoad(false)}>×</button></header>
          <SaveList session={session} allowSave={false} />
        </section>
      )}
    </>
  );
}
