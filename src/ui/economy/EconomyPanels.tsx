/**
 * Economy UI: the economy overview (opened from the top-bar treasury and factory readouts), the
 * Construction tab (building cards that start placing on the map, and the queue) and the Trade tab
 * (goods market, trade routes, resource market, agreements and sanctions).
 */
import { useState } from "preact/hooks";
import type { ContentDB } from "../../content/compile.ts";
import { constructionPerDay, factories, growthTarget, neutralRate, shockNow, type EconomyState } from "../../sim/economy/economy.ts";
import { buildingCount, moneyCost, priceLevel, queueEstimates } from "../../sim/economy/construction.ts";
import { tradeGrowthEffect } from "../../sim/economy/market.ts";
import { Flag } from "../Flag.tsx";
import { Icon, type IconName } from "../icons.tsx";
import { formatDate } from "../../sim/date.ts";
import { buildMode, buildMsg } from "../store.ts";
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
                <button class="tile mini" aria-label={`Lower ${field}`} onClick={() => budget(field, -1)}>{Icon.minus({ size: 12 })}</button>
                <button class="tile mini" aria-label={`Raise ${field}`} onClick={() => budget(field, 1)}>{Icon.plus({ size: 12 })}</button>
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
  const sm = session.sim?.context.map;
  const level = priceLevel(db, e);
  const allowance = db.buildingRules.investment_allowance_pct_gdp;
  const inv = e.investmentPct ?? 0;
  const eta = queueEstimates(db, e, cp.factories, cp.perFactory);
  const picking = buildMode.value;
  const run = (c: Parameters<Session["dispatch"]>[0]) => setMsg(session.dispatch(c).text);
  return (
    <div class="cons">
      <div class="cons-hero">
        <div {...tip(() => ({ title: "Construction capacity", rows: [["Civilian factories", factories(db, e).civ], ["Making consumer goods", `${Math.round(cp.consumerShare * 100)}%`], ["Free for construction", Math.round(cp.factories)], ["Points per factory a day", cp.perFactory.toFixed(1)], ["Points a day in all", Math.round(cp.points)]], note: `Each project takes at most ${db.economyRules.max_factories_per_project} factories; the rest go to the next project. Factories not building make industrial goods for the market. The economic system law sets the consumer goods share.` }))}>
          <div class="econ-big num">{Math.round(cp.factories)}</div>
          <div class="faint small">factories for construction</div>
        </div>
        <div {...tip(() => ({ title: "Construction spending", rows: [["Spending now", `${inv.toFixed(2)}% of GDP a year`], ["Already in the budget", `${allowance}% of GDP`], ["Added to the deficit", `${Math.max(0, inv - allowance).toFixed(2)}% of GDP`], ["Price level", `×${level.toFixed(2)}`]], note: "Each project is paid from the budget as the work progresses, never up front. Costs scale with the country's price level (GDP per person). Spending above the public investment already in the budget adds to the deficit." }))}>
          <div class={`econ-big num ${inv > allowance ? "warn" : ""}`}>{inv.toFixed(2)}%</div>
          <div class="faint small">of GDP on construction</div>
        </div>
        <div {...tip(() => ({ title: "Queue", rows: [["Projects", e.construction.length], ["Being worked on", e.construction.filter((c) => (c.factories ?? 0) > 0).length]], note: "Projects are worked on in order. Reorder them with the arrows." }))}>
          <div class="econ-big num">{e.construction.length}</div>
          <div class="faint small">projects queued</div>
        </div>
      </div>

      <div class="hp-section">Build</div>
      <div class="build-grid">
        {[...db.buildings.values()].map((b) => {
          const locked = b.requires_tech && !cs.research?.completed.includes(b.requires_tech) ? `Needs ${db.techs.get(b.requires_tech)?.name ?? b.requires_tech}` : b.requires_resource && !((e.resources[b.requires_resource] ?? 0) > 0) ? `Needs ${db.economyRules.resources.find((r) => r.id === b.requires_resource)?.name.toLowerCase() ?? b.requires_resource} production` : null;
          const n = buildingCount(db, state, sm, cs, b.id);
          const icon = b.icon && b.icon in Icon ? (b.icon as IconName) : "construction";
          const on = picking === b.id;
          return (
            <button key={b.id} class={`build-card ${on ? "on" : ""} ${locked ? "locked" : ""}`} disabled={!!locked}
              onClick={() => { buildMode.value = on ? null : b.id; setMsg(on ? "" : `Click your provinces on the map to build: ${b.name.toLowerCase()}.`); }}
              {...tip(() => ({
                title: b.name,
                body: <span class="dim">{b.description}</span>,
                rows: [
                  ["Construction", `${b.cost.toLocaleString("en")} points`],
                  ["Money", `${fmtBn(moneyCost(db, b, e))} (paid as it is built)`],
                  ["Days with 15 factories", Math.ceil(b.cost / (db.economyRules.max_factories_per_project * cp.perFactory))],
                  ["Uses", b.kind === "slot" ? "a building slot" : `its own levels, up to ${b.max_per_province} per province`],
                  ...(b.coastal ? [["Where", "coastal provinces"] as [string, string]] : []),
                  ["You have", b.id === "infrastructure" ? "province levels (see the map)" : `${n.organic + n.built}${n.organic ? ` (${n.organic} from the start)` : ""}`],
                  ...Object.entries(b.modifiers).map(([m, v]) => [db.modifiers.get(m)?.name ?? m, `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}% each (up to ${b.modifier_cap ?? "∞"})`] as [string, string]),
                  ...Object.entries(b.adds.goods ?? {}).map(([g, v]) => [db.goods.get(g)?.name ?? g, `+${v} a year`] as [string, string]),
                ],
                note: locked ?? (on ? "Click again or press Esc to stop placing." : "Click, then click your provinces on the map."),
              }))}>
              <span class="bc-ic">{Icon[icon]({ size: 22 })}</span>
              <span class="bc-name">{b.name}</span>
              <span class="bc-meta num">{locked ? <span class="faint">{Icon.lock({ size: 11 })}</span> : <>{b.id === "infrastructure" ? "levels" : n.organic + n.built}</>}</span>
            </button>
          );
        })}
      </div>
      {picking && <p class="build-hint small"><b>Placing {db.buildings.get(picking)?.name.toLowerCase()}.</b> Green provinces have room; the brighter, the more. Esc to stop.{buildMsg.value && <span class="dim"> {buildMsg.value}</span>}</p>}
      {msg && !picking && <p class="dim small pad">{msg}</p>}

      <div class="hp-section">Queue</div>
      {e.construction.length === 0 ? (
        <p class="faint small pad">Nothing under construction. Pick a building above, then click a province.</p>
      ) : (
        <ul class="cons-queue">
          {e.construction.map((item, i) => {
            const b = db.buildings.get(item.building);
            const p = Math.min(1, item.progress / (b?.cost ?? 1));
            const where = item.province ? session.map.provinces[item.province - 1]?.name : "National";
            const days = eta[i] ?? Infinity;
            const icon = b?.icon && b.icon in Icon ? (b.icon as IconName) : "construction";
            return (
              <li class={`cq-item ${(item.factories ?? 0) > 0 ? "active" : "waiting"}`} key={i}>
                <span class="cq-ic">{Icon[icon]({ size: 18 })}</span>
                <div class="cq-main" {...tip(() => ({ title: `${b?.name} · ${where}`, rows: [["Progress", `${Math.round(item.progress).toLocaleString("en")} / ${b?.cost.toLocaleString("en")} points`], ["Factories working", `${item.factories ?? 0} of ${db.economyRules.max_factories_per_project}`], ["Money spent", fmtBn(item.spent ?? 0)], ["Money left", fmtBn(b ? moneyCost(db, b, e) * (1 - p) : 0)], ["Estimated finish", Number.isFinite(days) ? formatDate(state.day + days) : "not before the projects ahead"]], note: "Estimate at today's capacity; projects further down wait for factories to come free." }))}>
                  <span class="cq-name clip">{b?.name} <span class="faint">· {where}</span></span>
                  <span class="meter"><span style={{ width: `${p * 100}%` }} /></span>
                  <span class="cq-meta faint small num">{Math.round(p * 100)}% · {item.factories ?? 0}/{db.economyRules.max_factories_per_project} factories · {Number.isFinite(days) ? formatDate(state.day + days) : "waiting"}</span>
                </div>
                <span class="cq-act">
                  <button class="tile mini" aria-label="Move up" disabled={i === 0} onClick={() => run({ type: "move_building", tag, index: i, to: i - 1 })} {...tip(() => ({ title: "Move up", note: "Earlier projects get factories first." }))}>{Icon.up({ size: 12 })}</button>
                  <button class="tile mini" aria-label="Move down" disabled={i === e.construction.length - 1} onClick={() => run({ type: "move_building", tag, index: i, to: i + 1 })} {...tip(() => ({ title: "Move down" }))}>{Icon.down({ size: 12 })}</button>
                  <button class="tile mini cq-x" aria-label="Cancel" onClick={() => run({ type: "cancel_building", tag, index: i })} {...tip(() => ({ title: "Cancel", note: "Progress and money spent are lost." }))}>{Icon.close({ size: 11 })}</button>
                </span>
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
  const t = e.trade;
  const goods = state.market.goods ?? {};
  const kindLabel = { deal: "trade agreement", bloc: "economic bloc", open: "open market" } as const;
  return (
    <div class="trade">
      <div class="econ-hero">
        <div {...tip(() => ({ title: "Exports sold", rows: t ? [["Surplus goods sold", fmtBn(t.exports)], ["Market access", `${Math.round(t.access * 100)}%`]] : [], note: "Goods you make beyond your own demand, sold along your trade routes. Access is the share of an open world market your routes reach: agreements and economic blocs raise it, sanctions close routes." }))}>
          <div class="econ-big num">{t ? fmtBn(t.exports) : "—"}</div>
          <div class="faint small">exports a year</div>
        </div>
        <div {...tip(() => ({ title: "Imports bought", rows: t ? [["Goods bought", fmtBn(t.imports)]] : [], note: "Goods you need beyond what you make, bought at world prices." }))}>
          <div class="econ-big num">{t ? fmtBn(t.imports) : "—"}</div>
          <div class="faint small">imports a year</div>
        </div>
        <div {...tip(() => ({ title: "Trade income", rows: t ? [["Now", fmtBn(t.income)], ["On 1 January 2000", fmtBn(t.income0 ?? t.income)], ["Growth effect", `${tradeGrowthEffect(db, e) >= 0 ? "+" : ""}${tradeGrowthEffect(db, e).toFixed(2)} points`], ["To reserves", `${Math.round(db.goodsRules.treasury_share * 100)}% of income`]] : [], note: "The change since 2000 moves growth (the 2000 figures already include that year's trade)." }))}>
          <div class={`econ-big num ${t && t.income < 0 ? "bad" : ""}`}>{t ? fmtBn(t.income) : "—"}</div>
          <div class="faint small">net a year</div>
        </div>
      </div>
      <div class="hp-section">World goods market</div>
      {Object.keys(goods).length === 0 ? <p class="faint small pad">The market opens at the end of the first month.</p> : (
        <table class="tbl">
          <thead><tr><th></th><th>Good</th><th class="r">Price</th><th class="r">You make</th><th class="r">You need</th><th class="r">Balance</th></tr></thead>
          <tbody>
            {[...db.goods.values()].map((g) => {
              const m = goods[g.id];
              if (!m) return null;
              const made = t?.production[g.id] ?? 0, need = t?.demand[g.id] ?? 0, bal = made - need;
              return (
                <tr key={g.id} {...tip(() => ({ title: g.name, body: <span class="dim">{g.description}</span>, rows: [["Price index (start = 100)", Math.round(m.price * 100)], ["World supply", Math.round(m.supply).toLocaleString("en")], ["World demand", Math.round(m.demand).toLocaleString("en")], ["You make", made.toFixed(1)], ["You need", need.toFixed(1)], ["Value of one unit", fmtBn(g.value_bn * m.price)]], note: "Prices move toward world demand over supply. Units are a year of one factory's output." }))}>
                  <td><i class="sw" style={{ background: g.color }} /></td>
                  <td>{g.name}</td>
                  <td class={`r num ${m.price > 1.05 ? "good" : m.price < 0.95 ? "bad" : ""}`}>{Math.round(m.price * 100)}</td>
                  <td class="r num">{made.toFixed(1)}</td>
                  <td class="r num">{need.toFixed(1)}</td>
                  <td class={`r num ${bal >= 0 ? "good" : "bad"}`}>{bal >= 0 ? "+" : ""}{bal.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div class="hp-section">Trade routes</div>
      {!t || !t.routes.length ? <p class="faint small pad">No exports to route yet.</p> : (
        <ul class="routes">
          {t.routes.map((r) => (
            <li key={r.partner} class={`route k-${r.kind}`} {...tip(() => ({ title: `Route to ${countryName(db, state, r.partner)}`, rows: [["Exports a year", fmtBn(r.value)], ["Terms", kindLabel[r.kind]]], note: "Routes weigh by the partner's GDP; agreements and blocs carry more, sanctions close a route." }))}>
              <span class="row-flag"><Flag db={db} tag={r.partner} size="xs" />{countryName(db, state, r.partner)}</span>
              <span class="route-bar"><span style={{ width: `${Math.min(100, (r.value / Math.max(1e-9, t.routes[0]!.value)) * 100)}%` }} /></span>
              <span class="num small">{fmtBn(r.value)}</span>
              <span class="faint small">{kindLabel[r.kind]}</span>
            </li>
          ))}
        </ul>
      )}
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
