/**
 * Economy UI (Phase 7): the economy overview (opened from the top-bar treasury and factory
 * readouts), the Construction tab (queue) and the Trade tab (resource market).
 */
import { useState } from "preact/hooks";
import type { ContentDB } from "../../content/compile.ts";
import { constructionPerDay, factories, growthTarget, neutralRate, shockNow, type EconomyState } from "../../sim/economy/economy.ts";
import { formatDate } from "../../sim/date.ts";
import { selectedProvince } from "../store.ts";
import { version, type Session } from "../session.ts";
import { tip } from "../tooltip.tsx";
import { countryName } from "../../sim/politics/unrest.ts";

const fmtBn = (bn: number) => (bn >= 1000 ? `$${(bn / 1000).toFixed(2)} tn` : bn >= 1 ? `$${bn.toFixed(1)} bn` : `$${Math.round(bn * 1000)} m`);
const pct = (x: number, d = 1) => `${x.toFixed(d)}%`;
const signed = (x: number, d = 2) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d)}`;
const LABEL: Record<string, string> = {
  population: "Population", gdp: "GDP", growth: "Growth", inflation: "Inflation", unemployment: "Unemployment", interest: "Interest rate",
  revenue: "Tax revenue", spending: "Spending", debt: "Public debt", industry: "Industry share",
};

/** Source note for a figure: World Bank 2000, or a labelled estimate. */
function sourceNote(db: ContentDB, tag: string, e: EconomyState, field: string, key: string): string {
  if (e.estimated.includes(field)) return "Starting value is a gameplay estimate: the World Bank has no figure for this country.";
  const y = db.worldBank.countries[tag]?.[`${key}_year`];
  return `Started at the World Bank figure for ${typeof y === "number" ? y : 2000}.`;
}

export function EconomyPanel({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const state = session.state;
  const tag = state?.player;
  const cs = tag ? state?.countries[tag] : undefined;
  const e = cs?.economy;
  if (!state || !tag || !cs || !e) return <p class="dim pad">No economy data for this country yet.</p>;
  const g = growthTarget(db, state, cs);
  const f = factories(db, e);
  const shock = shockNow(e, state.day);
  const interest = (e.debt * Math.max(0.5, neutralRate(e) * 0.6)) / 100;
  const balance = e.revenue - e.spending - interest;
  const budget = (field: "revenue" | "spending", delta: number) =>
    session.dispatch({ type: "set_budget", tag, [field]: (field === "revenue" ? e.revenueTarget : e.spendingTarget) + delta });
  const row = (label: string, value: string, tipRows: [string, string][], note: string, cls = "") => (
    <>
      <dt>{label}</dt>
      <dd class={`num ${cls}`} {...tip(() => ({ title: label, rows: tipRows, note }))}>{value}</dd>
    </>
  );
  return (
    <div class="econ">
      <div class="econ-hero">
        <div {...tip(() => ({ title: "Gross domestic product", rows: [["GDP", fmtBn(e.gdp)], ["Per person", `$${Math.round((e.gdp * 1e9) / e.population).toLocaleString("en")}`], ["Population", Math.round(e.population).toLocaleString("en")]], note: `${sourceNote(db, tag, e, "gdp", "gdp_usd")} In 2000 US dollars.` }))}>
          <div class="econ-big num">{fmtBn(e.gdp)}</div>
          <div class="faint small">GDP, 2000 dollars</div>
        </div>
        <div {...tip(() => ({ title: "Growth", rows: [["Now", pct(e.growth)], ["Moving toward", pct(g.target)], ...g.parts.map((p) => [p.label, signed(p.value)] as [string, string])], note: "Growth closes a quarter of the gap to its target each month." }))}>
          <div class={`econ-big num ${e.growth >= e.trend ? "good" : e.growth < 0 ? "bad" : ""}`}>{pct(e.growth)}</div>
          <div class="faint small">annual growth</div>
        </div>
        <div {...tip(() => ({ title: "Economic mood", rows: [["Mood (−100 to +100)", Math.round(cs.economicMood * 100)]], note: "Growth against potential, unemployment and inflation. It moves elections and interest groups." }))}>
          <div class={`econ-big num ${cs.economicMood > 0.15 ? "good" : cs.economicMood < -0.15 ? "bad" : ""}`}>{cs.economicMood >= 0 ? "+" : ""}{Math.round(cs.economicMood * 100)}</div>
          <div class="faint small">economic mood</div>
        </div>
      </div>

      <div class="hp-section">Economy</div>
      <dl class="kv">
        {row("Potential growth", pct(e.trend), [["Potential", pct(e.trend)]], "Based on real growth in 1995-2000 and on income: poorer economies can grow faster. It converges slowly on the income path.")}
        {row("Unemployment", pct(e.unemployment), [["Now", pct(e.unemployment)], ["Starting (natural) rate", pct(e.naturalUnemployment)]], `${sourceNote(db, tag, e, "unemployment", "unemployment_pct")} Falls when growth is above potential (Okun's law).`, e.unemployment > e.naturalUnemployment + 1 ? "bad" : "")}
        {row("Inflation", pct(e.inflation), [["Now", pct(e.inflation)], ["Anchor", pct(e.inflationAnchor)], ["Long-run target", pct(e.inflationTarget)]], `${sourceNote(db, tag, e, "inflation", "inflation_pct")} The anchor converges on the target over years.`, e.inflation > e.inflationAnchor + 3 ? "bad" : "")}
        {row("Interest rate", pct(e.interestRate), [["Lending rate", pct(e.interestRate)], ["Neutral rate", pct(neutralRate(e))]], `${sourceNote(db, tag, e, "interest", "lending_rate_pct")} Set by the central bank against inflation and the growth gap.`)}
        {row("Factories", `${f.civ} civilian · ${f.mil} military`, [["Civilian", String(f.civ)], ["Military", String(f.mil)], ["Built during the game", `${e.builtCiv} / ${e.builtMil}`]], "Industry value added divided by the value of one factory, plus factories built.")}
        {shock.growth !== 0 && row("Shocks", signed(shock.growth, 1) + " growth", e.shocks.map((s) => [s.source.replace(/^event:/, ""), `${signed(s.growth, 1)} until ${formatDate(s.until)}`] as [string, string]), "Economic shocks fade out over their duration.", "bad")}
      </dl>

      <div class="hp-section">Budget</div>
      <dl class="kv">
        {row("Debt", pct(e.debt, 0) + " of GDP", [["Debt", pct(e.debt, 1)], ["Interest cost", pct(interest, 2) + " of GDP"]], `${sourceNote(db, tag, e, "debt", "central_gov_debt_pct_gdp")} Debt above 90% of GDP slows growth.`, e.debt > 90 ? "bad" : "")}
        {row("Balance", `${signed(balance, 1)}% of GDP`, [["Revenue", pct(e.revenue)], ["Spending", pct(e.spending)], ["Interest", pct(interest, 2)]], "Deficits add to debt; growth and inflation shrink it as a share of GDP.", balance < -3 ? "bad" : balance >= 0 ? "good" : "")}
        {row("Reserves", fmtBn(e.treasury), [["Foreign reserves", fmtBn(e.treasury)]], "Total reserves (World Bank). Resource income adds to them.")}
      </dl>
      <div class="budget">
        {(["revenue", "spending"] as const).map((field) => {
          const now = field === "revenue" ? e.revenue : e.spending;
          const target = field === "revenue" ? e.revenueTarget : e.spendingTarget;
          return (
            <div class="budget-row" key={field}>
              <span {...tip(() => ({ title: field === "revenue" ? "Taxes" : "Spending", rows: [["Now", pct(now)], ["Target", pct(target)]], note: `${sourceNote(db, tag, e, field, field === "revenue" ? "revenue_pct_gdp" : "expense_pct_gdp")} Moves a tenth of the way to the target each month. ${field === "revenue" ? "Higher taxes slow growth and anger business." : "More spending lifts growth now and adds to debt."}` }))}>
                {field === "revenue" ? "Taxes" : "Spending"} <b class="num">{pct(now)}</b> <span class="faint small">target {pct(target)}</span>
              </span>
              <span class="row-act">
                <button class="tile mini" aria-label={`Lower ${field}`} onClick={() => budget(field, -1)}>−</button>
                <button class="tile mini" aria-label={`Raise ${field}`} onClick={() => budget(field, 1)}>+</button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ConstructionPanel({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const [msg, setMsg] = useState("");
  const state = session.state;
  const tag = state?.player;
  const cs = tag ? state?.countries[tag] : undefined;
  const e = cs?.economy;
  if (!state || !tag || !cs || !e) return <p class="dim pad">No economy data for this country yet.</p>;
  const cp = constructionPerDay(db, cs);
  const sel = selectedProvince.value;
  const selName = sel ? session.map.provinces[sel - 1]?.name : undefined;
  const ownSel = sel && state.provinceOwner[sel - 1] === tag;
  const queue = (building: string, province?: number) => setMsg(session.dispatch({ type: "queue_building", tag, building, province }).text);
  const perProject = db.economyRules.max_factories_per_project * db.economyRules.construction_per_factory;
  return (
    <div class="cons">
      <dl class="kv">
        <dt>Construction</dt>
        <dd class="num" {...tip(() => ({ title: "Construction capacity", rows: [["Civilian factories free", Math.round(cp.factories)], ["Consumer goods share", `${Math.round(cp.consumerShare * 100)}%`], ["Points per day", Math.round(cp.points)]], note: `Each project uses at most ${db.economyRules.max_factories_per_project} factories. The economic system law sets the consumer goods share.` }))}>
          {Math.round(cp.points)} points a day
        </dd>
      </dl>
      <div class="hp-section">Build</div>
      <div class="cons-build">
        {[...db.buildings.values()].map((b) => {
          const needsProv = b.level === "province";
          return (
            <button key={b.id} class="btn" disabled={needsProv && !ownSel} onClick={() => queue(b.id, needsProv ? sel : undefined)}
              {...tip(() => ({ title: b.name, body: <span class="dim">{b.description}</span>, rows: [["Cost", `${b.cost} points`], ["Days at full speed", Math.ceil(b.cost / perProject)]], note: needsProv ? (ownSel ? `In ${selName}.` : "Select one of your provinces on the map first.") : undefined }))}>
              {b.name}{needsProv && ownSel ? ` in ${selName}` : ""}
            </button>
          );
        })}
      </div>
      {msg && <p class="dim small pad">{msg}</p>}
      <div class="hp-section">Queue</div>
      {e.construction.length === 0 ? (
        <p class="faint small pad">Nothing under construction.</p>
      ) : (
        <ul class="dec-list">
          {e.construction.map((item, i) => {
            const b = db.buildings.get(item.building);
            const p = Math.min(1, item.progress / (b?.cost ?? 1));
            const where = item.province ? session.map.provinces[item.province - 1]?.name : null;
            return (
              <li class="dec-item" key={i}>
                <div class="dec-main">
                  <span class="dec-name">{b?.name}{where ? ` · ${where}` : ""}</span>
                  <span class="meter"><span style={{ width: `${p * 100}%` }} /></span>
                </div>
                <span class="num faint" {...tip(() => ({ title: "Progress", rows: [["Done", `${Math.round(item.progress)} / ${b?.cost}`]] }))}>{Math.round(p * 100)}%</span>
                <button class="btn" onClick={() => setMsg(session.dispatch({ type: "cancel_building", tag, index: i }).text)}>Cancel</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TradePanel({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const state = session.state;
  const tag = state?.player;
  const e = tag ? state?.countries[tag]?.economy : undefined;
  if (!state || !tag || !e) return <p class="dim pad">No economy data for this country yet.</p>;
  const wb = db.worldBank.countries[tag];
  const exp = wb?.exports_pct_gdp as number | undefined, imp = wb?.imports_pct_gdp as number | undefined;
  return (
    <div class="trade">
      <div class="hp-section">World resource market</div>
      <table class="tbl">
        <thead><tr><th></th><th>Resource</th><th class="r">Price</th><th class="r">Your rent</th><th class="r">Share of GDP</th></tr></thead>
        <tbody>
          {db.economyRules.resources.map((r) => {
            const price = state.market.prices[r.id] ?? 1;
            const rent = (e.resources[r.id] ?? 0) * price;
            return (
              <tr key={r.id} {...tip(() => ({ title: r.name, rows: [["Price index (2000 = 100)", Math.round(price * 100)], ["Your rent at today's price", fmtBn(rent)], ["World demand index", Math.round(state.market.demand * 100)]], note: "Rents are the World Bank's 2000 resource rents. Prices follow world demand against fixed 2000 supply." }))}>
                <td><i class="sw" style={{ background: r.color }} /></td>
                <td>{r.name}</td>
                <td class={`r num ${price > 1.05 ? "good" : price < 0.95 ? "bad" : ""}`}>{Math.round(price * 100)}</td>
                <td class="r num">{rent > 0 ? fmtBn(rent) : "—"}</td>
                <td class="r num">{rent > 0 ? pct((rent / e.gdp) * 100) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div class="hp-section">Trade</div>
      <dl class="kv">
        <dt>Exports</dt><dd class="num" {...tip(() => ({ title: "Exports", note: "World Bank, 2000: exports of goods and services as a share of GDP." }))}>{exp !== undefined ? pct(exp) + " of GDP (2000)" : "no figure"}</dd>
        <dt>Imports</dt><dd class="num" {...tip(() => ({ title: "Imports", note: "World Bank, 2000: imports of goods and services as a share of GDP." }))}>{imp !== undefined ? pct(imp) + " of GDP (2000)" : "no figure"}</dd>
      </dl>
      <TradeRelations db={db} session={session} />
    </div>
  );
}

/** The player's trade agreements and sanctions (set in the Diplomacy tab). */
function TradeRelations({ db, session }: { db: ContentDB; session: Session }) {
  version.value; // follow the clock (unchanged props skip re-rendering)
  const state = session.state;
  const me = state?.player;
  if (!state || !me || !state.diplomacy) return null;
  const d = state.diplomacy;
  const name = (t: string) => countryName(db, state, t);
  const deals = d.tradeDeals.filter(([a, b]) => a === me || b === me).map(([a, b]) => (a === me ? b : a));
  const ours = d.sanctions.filter(([a]) => a === me).map(([, b]) => b);
  const onUs = d.sanctions.filter(([, b]) => b === me).map(([a]) => a);
  const e = state.countries[me]?.economy;
  const part = e ? growthTarget(db, state, state.countries[me]!).parts.find((p) => p.label.startsWith("Trade agreements")) : undefined;
  return (
    <>
      <dl class="kv">
        <dt>Trade agreements</dt><dd>{deals.length ? deals.map(name).join(", ") : "None"}</dd>
        <dt>We sanction</dt><dd>{ours.length ? ours.map(name).join(", ") : "Nobody"}</dd>
        <dt>Sanctioned by</dt><dd class={onUs.length ? "warn" : ""}>{onUs.length ? onUs.map(name).join(", ") : "Nobody"}</dd>
        <dt>Effect on growth</dt>
        <dd class="num" {...tip(() => ({ title: "Trade, blocs and sanctions", note: "Change since 1 January 2000: trade agreements and economic blocs add growth in proportion to the partners' output; sanctions cut it." }))}>
          {part ? `${part.value >= 0 ? "+" : ""}${part.value.toFixed(2)} points` : "none since 2000"}
        </dd>
      </dl>
      <p class="faint small pad">Agreements and sanctions are made in the Diplomacy tab.</p>
    </>
  );
}
