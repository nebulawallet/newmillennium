import { useMemo, useState } from "preact/hooks";
import type { ContentDB, Issue } from "../content/compile.ts";
import { countrySummary } from "../content/query.ts";
import "./app.css";

interface Props {
  db: ContentDB;
  issues: Issue[];
}

/** Placeholder shell until Phase 4: lists playable countries with their real 2000 leadership. */
export function App({ db, issues }: Props) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const rows = useMemo(
    () =>
      db.countryList
        .map((e) => countrySummary(db, e.tag))
        .filter((s): s is NonNullable<typeof s> => s !== null),
    [db],
  );
  const shown = rows.filter((r) => (r.name + r.tag + r.headOfState + r.headOfGovernment).toLowerCase().includes(q.toLowerCase()));
  const errors = issues.filter((i) => i.severity === "error");
  const sel = selected ? rows.find((r) => r.tag === selected) : null;

  return (
    <>
      <header class="titlebar panel">
        <span class="brand">NEW MILLENNIUM</span>
        <span class="dim">1 January 2000</span>
        <span class="faint">
          {rows.length} / {db.countryList.length} countries with politics data
        </span>
        {errors.length > 0 && <span class="issues">{errors.length} content errors (see console)</span>}
      </header>

      <aside class="country-list panel">
        <h2>Choose a country</h2>
        <input type="search" placeholder="Search countries or leaders" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <ul>
          {shown.map((r) => (
            <li key={r.tag} class={r.tag === selected ? "active" : ""} onClick={() => setSelected(r.tag)}>
              <span class="swatch" style={{ background: r.rulingPartyColor }} />
              <span class="cname">{r.name}</span>
              <span class="faint mono">{r.tag}</span>
              <div class="sub dim">{r.headOfGovernment}</div>
            </li>
          ))}
        </ul>
      </aside>

      {sel && (
        <section class="country-card panel">
          <h2>{sel.name}</h2>
          <dl>
            <dt>Government</dt>
            <dd>{sel.govType}</dd>
            <dt>Head of state</dt>
            <dd>{sel.headOfState}</dd>
            <dt>Head of government</dt>
            <dd>{sel.headOfGovernment}</dd>
            <dt>Ruling party</dt>
            <dd>
              <span class="swatch" style={{ background: sel.rulingPartyColor }} /> {sel.rulingParty}
            </dd>
          </dl>
          <p class="faint">Starting the game arrives in Phase 4.</p>
        </section>
      )}
    </>
  );
}
