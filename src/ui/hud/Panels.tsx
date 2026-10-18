import type { ContentDB } from "../../content/compile.ts";
import { countrySummary } from "../../content/query.ts";
import type { MapData } from "../../render/mapData.ts";
import { TERRAIN_COLORS } from "../../render/mapModes.ts";
import { millerY as millerYOf } from "../../render/MapView.ts";
import { formatDate } from "../../sim/date.ts";
import { countryColor, countryName } from "../../sim/politics/unrest.ts";
import type { GameState } from "../../sim/state.ts";
import { Icon } from "../icons.tsx";
import { PoliticsPanel } from "../politics/PoliticsPanel.tsx";
import { DecisionsPanel } from "../scripted/DecisionsPanel.tsx";
import { ConstructionPanel, EconomyPanel, TradePanel } from "../economy/EconomyPanels.tsx";
import { DiplomacyPanel, IntelligencePanel } from "../diplomacy/DiplomacyPanels.tsx";
import { LogisticsPanel, ProductionPanel, RecruitmentPanel } from "../units/MilitaryPanels.tsx";
import { selectedArmy, selectedDivisions } from "../store.ts";
import { STATUS_TEXT } from "../../sim/military/fronts.ts";
import { infrastructureOf, slotUse } from "../../sim/economy/construction.ts";
import { WarButton, WarsOutliner } from "../units/WarUi.tsx";
import { feed, panel, version, type Session } from "../session.ts";
import { selectedProvince } from "../store.ts";
import { TABS, type TabDef } from "../tabs.ts";
import { Flag } from "../Flag.tsx";
import { ResearchSlotsPanel } from "../research/ResearchPanel.tsx";
import { tip } from "../tooltip.tsx";
import { SidePanel } from "./SidePanel.tsx";

const fmt = new Intl.NumberFormat("en");

/** Placeholder for a tab whose system is not built yet: honest about when it arrives. */
function StubPanel({ tab }: { tab: TabDef }) {
  return (
    <div class="stub-panel">
      <div class="stub-ic">{Icon[tab.icon]({ size: 56 })}</div>
      <p class="stub-text">{tab.summary}</p>
      <p class="stub-when">Arrives in <b>{tab.phase}</b>.</p>
    </div>
  );
}

/** The owner's government as it stands in the running game (2000 data on the start screen). */
export function liveSummary(db: ContentDB, state: GameState | null | undefined, tag: string) {
  const cs = state?.countries[tag];
  if (!state || !cs) return countrySummary(db, tag);
  const c = db.countries.get(tag)?.country;
  const people = (office: string | undefined) => {
    const ids = office ? (cs.offices[office] ?? []) : [];
    const ns = ids.map((id) => (id ? (db.people.get(id)?.name.en ?? id) : "Vacant"));
    return ns.length ? ns.join(", ") : "—";
  };
  const lead = cs.rulingParties[0];
  const party = lead ? db.parties.get(lead) : undefined;
  return {
    govType: db.governmentTypes.get(cs.govType)?.name ?? cs.govType,
    headOfState: c ? people(c.government.head_of_state_office) : "—",
    headOfGovernment: c ? people(c.government.head_of_government_office) : "—",
    rulingParty: party ? `${party.name.en} (${party.abbrev.en})` : "—",
    rulingPartyColor: party?.color ?? countryColor(db, state, tag) ?? "#555",
  };
}

/** HOI4 "state view": the selected province, shown in the left panel slot when no tab is open. */
function StatePanel({ db, map, id, session }: { db: ContentDB; map: MapData; id: number; session?: Session }) {
  version.value; // follow the clock (unchanged props skip re-rendering)
  const p = map.provinces[id - 1];
  if (!p) return null;
  const state = session?.state;
  // the running game's owner and controller (armed groups, occupations), else the 2000 map
  const ownerTag = state?.provinceOwner[id - 1] ?? p.owner;
  const ctrlTag = state?.provinceController[id - 1] ?? p.controller;
  const owner = liveSummary(db, state, ownerTag);
  const ownerName = countryName(db, state, ownerTag);
  const ctrlName = countryName(db, state, ctrlTag);
  const home = state?.armedGroups.home[String(id)];
  const culture = p.culture ? (db.cultures.get(p.culture)?.name ?? p.culture) : null;
  const rows: [string, string, string?][] = [
    ["Owner", ownerName],
    ...(home && home !== ownerTag ? [["Part of", countryName(db, state, home)] as [string, string]] : []),
    ...(ctrlTag !== ownerTag ? [["Controlled by", ctrlName, "warn"] as [string, string, string]] : []),
    ["Population", fmt.format(p.population)],
    ["Area", `${fmt.format(p.area_km2)} km²`],
    ["Density", `${fmt.format(Math.round(p.population / Math.max(1, p.area_km2)))} per km²`],
    ["Culture", culture ?? "—"],
    ["Coastal", p.coastal ? "Yes" : "No"],
  ];
  return (
    <SidePanel title={p.name} icon="political" onClose={() => (selectedProvince.value = 0)} label={`Province ${p.name}`}>
      <div class="state-hero" style={{ "--terrain": TERRAIN_COLORS[p.terrain] ?? "#777" }}>
        <div class="terrain-badge">
          <span class="tb-name">{p.terrain}</span>
          <span class="faint small num">{p.elevation_m} m · relief {p.ruggedness_m} m</span>
        </div>
        <div class="infra" {...tip(() => ({ title: "Infrastructure", rows: [["Level", `${p.infrastructure} / 10`]], note: `Estimated from road density and national income${session?.state?.provinceBuildings[String(id)]?.infrastructure ? `, plus ${session.state.provinceBuildings[String(id)]!.infrastructure} built` : ""}. Build more in the Construction tab.` }))}>
          <span class="faint small">Infrastructure</span>
          <span class="infra-pips">
            {Array.from({ length: 10 }, (_, i) => <i class={i < p.infrastructure ? "on" : ""} />)}
          </span>
        </div>
      </div>
      <dl class="kv">
        {rows.map(([k, v, cls]) => (
          <>
            <dt>{k}</dt>
            <dd class={`num ${cls ?? ""}`}>{v}</dd>
          </>
        ))}
      </dl>
      {db.armedGroups.has(ownerTag) ? (
        <>
          <div class="hp-section">{ownerName}</div>
          <p class="small pad">{db.armedGroups.get(ownerTag)!.description}</p>
        </>
      ) : owner && (
        <>
          <div class="hp-section">{ownerName}</div>
          <dl class="kv">
            <dt>Government</dt><dd>{owner.govType}</dd>
            <dt>Head of state</dt><dd>{owner.headOfState}</dd>
            <dt>Head of government</dt><dd>{owner.headOfGovernment}</dd>
            <dt>Ruling party</dt><dd><i class="sw" style={{ background: owner.rulingPartyColor }} /> {owner.rulingParty}</dd>
          </dl>
        </>
      )}
      {session && <WarButton db={db} session={session} target={(session.state?.provinceOwner[id - 1]) ?? p.owner} />}
      {session?.state && session.sim && (() => {
        const st = session.state!;
        const cs = st.countries[ownerTag];
        if (!cs?.economy) return null;
        const u = slotUse(db, st, session.sim!.context.map, cs, p);
        const list = (rec: Record<string, number>) => Object.entries(rec).filter(([, n]) => n);
        return (
          <>
            <div class="hp-section">Buildings</div>
            <dl class="kv">
              <dt>Building slots</dt>
              <dd class="num" {...tip(() => ({ title: "Building slots", rows: [["Total", u.total], ["Used", u.used], ["Free", u.free], ["Infrastructure", infrastructureOf(st, p)]], note: "Slots come from infrastructure, population and terrain. Factories, refineries, power plants and data centres take one; infrastructure, air bases and ports have their own levels." }))}>{u.used} of {u.total} used</dd>
              {[...list(u.organic), ...list(u.built)].length === 0 ? <><dt>Industry</dt><dd class="faint">None</dd></> : null}
              {list(u.organic).map(([b, n]) => <><dt>{db.buildings.get(b)?.name}</dt><dd class="num" {...tip(() => ({ title: db.buildings.get(b)?.name ?? b, note: "Part of the country's starting industry (World Bank 2000), placed here by population and infrastructure." }))}>{n}{u.built[b] ? ` + ${u.built[b]} built` : ""}</dd></>)}
              {list(u.built).filter(([b]) => !u.organic[b]).map(([b, n]) => <><dt>{db.buildings.get(b)?.name}</dt><dd class="num">{n} built</dd></>)}
            </dl>
            {ownerTag === st.player && <p class="faint small pad">Build here from the Construction tab (T): pick a building, then click this province.</p>}
          </>
        );
      })()}
      <div class="hp-section">Resources</div>
      <p class="faint small pad">Resources are national (World Bank rents); see the Trade tab and the Resources map mode. Province deposits are not modelled.</p>
    </SidePanel>
  );
}

/** Left panel slot: the open tab, else the selected province. */
export function LeftPanel({ db, map, session }: { db: ContentDB; map: MapData; session: Session }) {
  version.value;
  const open = panel.value;
  const state = session.state;
  if (open === "economy")
    return (
      <SidePanel title="Economy" icon="treasury" onClose={() => (panel.value = null)}>
        <EconomyPanel db={db} session={session} />
      </SidePanel>
    );
  if (open && open !== "menu" && open !== "focus") {
    const tab = TABS.find((t) => t.id === open)!;
    return (
      <SidePanel title={tab.label} icon={tab.icon} onClose={() => (panel.value = null)}>
        {tab.id === "politics" && state?.player ? (
          <PoliticsPanel db={db} state={state} tag={state.player} session={session} />
        ) : tab.id === "decisions" ? (
          <DecisionsPanel db={db} session={session} />
        ) : tab.id === "production" ? (
          <ProductionPanel db={db} session={session} />
        ) : tab.id === "recruitment" ? (
          <RecruitmentPanel db={db} session={session} />
        ) : tab.id === "research" ? (
          <ResearchSlotsPanel db={db} session={session} />
        ) : tab.id === "construction" ? (
          <ConstructionPanel db={db} session={session} />
        ) : tab.id === "trade" ? (
          <TradePanel db={db} session={session} />
        ) : tab.id === "diplomacy" ? (
          <DiplomacyPanel db={db} session={session} />
        ) : tab.id === "logistics" ? (
          <LogisticsPanel db={db} session={session} />
        ) : tab.id === "intelligence" ? (
          <IntelligencePanel db={db} session={session} />
        ) : (
          <StubPanel tab={tab} />
        )}
      </SidePanel>
    );
  }
  if (selectedProvince.value) return <StatePanel db={db} map={map} id={selectedProvince.value} session={session} />;
  return null;
}

/** Right-hand outliner (HOI4 position): collapsible sections. */
export function Outliner({ db, session }: { db: ContentDB; session: Session }) {
  version.value;
  const state = session.state;
  const items = feed.value.slice(0, 8);
  const nameOf = (tag: string | null) => (tag ? (state?.dynamicCountries[tag]?.name ?? db.countries.get(tag)?.country?.name.en ?? db.countryList.find((c) => c.tag === tag)?.name ?? tag) : "World");
  const playerName = state?.player ? nameOf(state.player) : "";
  return (
    <aside class="outliner hp" aria-label="Outliner">
      <details open>
        <summary class="ol-h">News</summary>
        {items.length === 0 ? (
          <p class="faint small ol-empty">Nothing has happened yet. Unpause to start the clock.</p>
        ) : (
          <ul class="ol-list">
            {items.map((e, i) => (
              <li key={`${e.day}-${i}`} class={e.tag === state?.player ? "mine" : ""}>
                <span class="faint num small">{formatDate(e.day)}</span>
                <span class="row-flag">{e.tag && <Flag db={db} tag={e.tag} size="xs" />}<span>{e.tag && <><b>{nameOf(e.tag)}</b> </>}{e.text}</span></span>
              </li>
            ))}
          </ul>
        )}
      </details>
      <details open>
        <summary class="ol-h">Armies</summary>
        {(() => {
          const mine = state?.divisions.filter((d) => d.owner === state.player) ?? [];
          if (!mine.length) return <p class="faint small ol-empty">{playerName} has no divisions.</p>;
          const armies = state!.armies.filter((a) => a.owner === state!.player);
          const inArmy = new Set(armies.flatMap((a) => a.divisions));
          const free = mine.filter((d) => !inArmy.has(d.id));
          const look = (id: number) => {
            const d = state!.divisions.find((x) => x.id === id);
            const p = d ? session.map.provinces[d.province - 1] : undefined;
            if (p) session.world.view.lookAt(p.centroid[0], millerYOf(p.centroid[1]), 14);
          };
          return (
            <ul class="ol-list">
              {armies.map((a) => (
                <li key={a.id} class={selectedArmy.value === a.id ? "mine" : ""}>
                  <button class="lnk" onClick={() => { selectedArmy.value = a.id; selectedDivisions.value = a.divisions; look(a.divisions[0]!); }}>{a.name}</button>
                  <span class="faint num small">{a.divisions.length} divisions · {STATUS_TEXT[a.status]}{a.executing ? " · executing" : ""}</span>
                </li>
              ))}
              {free.length > 0 && (
                <li {...tip(() => ({ title: "Unassigned divisions", rows: free.slice(0, 10).map((d) => [d.name, `${Math.round(d.strength * 100)}% · ${session.map.provinces[d.province - 1]?.name ?? ""}`] as [string, string]), note: "Click to select them all, then form an army with New army in the bottom bar." }))}>
                  <button class="lnk" onClick={() => { selectedArmy.value = 0; selectedDivisions.value = free.map((d) => d.id); look(free[0]!.id); }}>Unassigned divisions</button>
                  <span class="faint num small">{free.length} not in an army</span>
                </li>
              )}
            </ul>
          );
        })()}
      </details>
      <WarsOutliner db={db} session={session} />
      <details>
        <summary class="ol-h">Construction</summary>
        {(state?.player ? state.countries[state.player]?.economy?.construction ?? [] : []).length === 0 ? (
          <p class="faint small ol-empty">Nothing under construction.</p>
        ) : (
          <ul class="ol-list">
            {state!.countries[state!.player!]!.economy!.construction.slice(0, 6).map((c, i) => (
              <li key={i}><span>{db.buildings.get(c.building)?.name}</span><span class="faint num small">{Math.round((c.progress / (db.buildings.get(c.building)?.cost ?? 1)) * 100)}%</span></li>
            ))}
          </ul>
        )}
      </details>
    </aside>
  );
}
