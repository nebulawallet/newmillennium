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
import { selectedDivisions } from "../store.ts";
import { WarButton, WarsOutliner } from "../units/WarUi.tsx";
import { feed, panel, version, type Session } from "../session.ts";
import { selectedProvince } from "../store.ts";
import { TABS, type TabDef } from "../tabs.ts";
import { Flag } from "../Flag.tsx";
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
function liveSummary(db: ContentDB, state: GameState | null | undefined, tag: string) {
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
  if (open && open !== "menu" && open !== "focus" && open !== "research") {
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
          const sel = new Set(selectedDivisions.value);
          return (
            <ul class="ol-list">
              {mine.slice(0, 40).map((d) => (
                <li key={d.id} class={sel.has(d.id) ? "mine" : ""}>
                  <button class="lnk" onClick={(e) => {
                    selectedDivisions.value = e.shiftKey ? [...new Set([...selectedDivisions.value, d.id])] : [d.id];
                    const p = session.map.provinces[d.province - 1];
                    if (p) session.world.view.lookAt(p.centroid[0], millerYOf(p.centroid[1]), 14);
                  }}>{d.name}</button>
                  <span class="faint num small">{Math.round(d.strength * 100)}%{d.path.length ? " · moving" : ""} · {session.map.provinces[d.province - 1]?.name ?? ""}</span>
                </li>
              ))}
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
