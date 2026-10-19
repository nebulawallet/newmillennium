import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/source-serif-4/opsz.css";
import "./ui/shell.css";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import * as THREE from "three";
import { fromBundle, type ContentBundle } from "./content/bundle.ts";
import type { ContentDB } from "./content/compile.ts";
import { runBenchmark, type BenchResult } from "./render/benchmark.ts";
import { SoakPanel } from "./ui/SoakPanel.tsx";
import { loadMapData, type MapData } from "./render/mapData.ts";
import { MapView, millerY as millerYOf } from "./render/MapView.ts";
import { WorldMap, type RenderApproach } from "./render/WorldMap.ts";
import { CountrySelect } from "./ui/CountrySelect.tsx";
import { GameMenu } from "./ui/hud/GameMenu.tsx";
import { TopBar } from "./ui/hud/TopBar.tsx";
import { LeftPanel, Outliner } from "./ui/hud/Panels.tsx";
import { TABS } from "./ui/tabs.ts";
import { activeTip, TooltipLayer } from "./ui/tooltip.tsx";
import { panel, paused, screen, Session, speed } from "./ui/session.ts";
import { MapModeBar, ProvinceTooltip } from "./ui/MapUi.tsx";
import { CoalitionPanel } from "./ui/politics/CoalitionPanel.tsx";
import { ElectionNight } from "./ui/politics/ElectionNight.tsx";
import { EventWindow } from "./ui/scripted/EventWindow.tsx";
import { researchPick, ResearchView } from "./ui/research/ResearchPanel.tsx";
import { FocusTreeView } from "./ui/scripted/FocusTree.tsx";
import { PeaceNotice, PeaceScreen } from "./ui/units/PeaceScreen.tsx";
import { buildMode, draftTerms, hoveredProvince, mapMode, openWar, peacePick, toast, pickedCountry, planDraft, planTool, pointer, selectedArmy, selectedDivisions, selectedProvince, showAlliedDivisions } from "./ui/store.ts";
import { slotsView } from "./render/mapModes.ts";
import { UnitCounters } from "./ui/units/UnitCounters.ts";
import { FrontOverlay } from "./ui/units/FrontOverlay.ts";
import { ArmyBar } from "./ui/units/ArmyBar.tsx";
import { BattleMarkers } from "./ui/units/BattleMarkers.ts";
import { WarPanel } from "./ui/units/WarPanel.tsx";
import { createPlanDrawer } from "./ui/units/planDrawing.ts";
import { DivisionPanel, Toast } from "./ui/units/DivisionPanel.tsx";
import { version } from "./ui/session.ts";
import { buildMsg, scenarioWorld } from "./ui/store.ts";

async function loadContent(): Promise<{ db: ContentDB; bundle: ContentBundle }> {
  const res = await fetch(`${import.meta.env.BASE_URL}content/bundle.json`);
  if (!res.ok) throw new Error(`content bundle: HTTP ${res.status}`);
  const bundle = (await res.json()) as ContentBundle;
  return { db: fromBundle(bundle), bundle };
}

function BenchPanel({ results }: { results: BenchResult[] | null }) {
  if (!results) return <section class="bench hp">Running renderer benchmark…</section>;
  const views = Object.keys(results[0]!.frameMs);
  return (
    <section class="bench hp">
      <h2>Renderer benchmark</h2>
      <table>
        <thead>
          <tr>
            <th>metric</th>
            {results.map((r) => (
              <th key={r.approach}>{r.approach === "mesh" ? "A: meshes" : "B: id texture"}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr><td>init (ms)</td>{results.map((r) => <td key={r.approach}>{r.initMs}</td>)}</tr>
          {views.map((v) => (
            <tr key={v}><td>frame, {v} (ms)</td>{results.map((r) => <td key={r.approach}>{r.frameMs[v]}</td>)}</tr>
          ))}
          <tr><td>map-mode switch (ms)</td>{results.map((r) => <td key={r.approach}>{r.modeSwitchMs}</td>)}</tr>
          <tr><td>GPU memory, est. (MB)</td>{results.map((r) => <td key={r.approach}>{r.gpuMB}</td>)}</tr>
        </tbody>
      </table>
    </section>
  );
}

async function boot(): Promise<void> {
  const ui = document.getElementById("ui")!;
  render(<div class="loading">Loading content and map…</div>, ui);
  const params = new URLSearchParams(location.search);

  const [{ db, bundle }, map] = await Promise.all([loadContent(), loadMapData()]);
  const errors = bundle.issues.filter((i) => i.severity === "error");
  if (errors.length) {
    console.warn(`[content] ${errors.length} content errors (run npm run validate-data for details)`);
    for (const e of errors.slice(0, 50)) console.warn(`[content] [${e.code}] ${e.file}: ${e.message}`);
  }
  console.info(`[content] ${db.countries.size} countries, ${db.people.size} people, ${db.parties.size} parties (hash ${bundle.hash})`);
  console.info(`[map] ${map.provinces.length} provinces, loaded in ${Math.round(map.loadMs)} ms`);

  const canvas = document.getElementById("map") as HTMLCanvasElement;

  if (params.has("soak")) {
    render(<SoakPanel years={Number(params.get("soak")) || 10} dynamic={params.has("dynamic")} seed={Number(params.get("seed")) || 20000101} />, ui);
    return;
  }

  if (params.has("bench")) {
    render(<BenchPanel results={null} />, ui);
    const results = await runBenchmark(canvas, map, db);
    console.table(results.map((r) => ({ approach: r.approach, init: r.initMs, ...r.frameMs, modeSwitch: r.modeSwitchMs, gpuMB: r.gpuMB })));
    render(<BenchPanel results={results} />, ui);
    return;
  }

  const approach = (params.get("renderer") as RenderApproach | null) ?? "mesh";
  const view = new MapView(canvas);
  const world = new WorldMap(view, map, db, approach);
  world.onHoverChange = (id) => (hoveredProvince.value = id);
  world.onSelectChange = (id) => {
    // start screen: clicking the map picks that province's country; in game it opens the state view
    if (screen.value === "select") {
      if (!id) return; // world.select(0) below re-enters here
      const owner = scenarioWorld.value?.provinceOwner[id - 1] ?? map.provinces[id - 1]?.owner;
      if (owner) pickedCountry.value = owner;
      world.select(0);
      return;
    }
    // peace conference: clicks add or remove the defeated country's provinces
    const st = session.state;
    if (peacePick.value && id && st?.pendingPeace) {
      const t = peacePick.value;
      if (st.provinceOwner[id - 1] === t) {
        const d = draftTerms.value[t] ?? { kind: "provinces" as const, provinces: [], ideology: null };
        const provinces = d.provinces.includes(id) ? d.provinces.filter((x) => x !== id) : [...d.provinces, id];
        draftTerms.value = { ...draftTerms.value, [t]: { ...d, kind: "provinces", provinces } };
        fronts.refresh(true);
      }
      world.select(0);
      return;
    }
    if (buildMode.value && id && st?.player) {
      const r = session.dispatch({ type: "queue_building", tag: st.player, building: buildMode.value, province: id });
      buildMsg.value = r.text;
      world.refresh();
      world.select(0);
      return;
    }
    if (buildMode.value) return;
    selectedProvince.value = id;
    if (id) panel.value = null;
  };
  selectedProvince.subscribe((id) => world.select(id));
  window.addEventListener("pointermove", (e) => (pointer.value = { x: e.clientX, y: e.clientY }));
  const session = new Session(db, map, world, bundle.hash);
  // building placement shows the slots map mode and returns to the previous mode afterwards
  let modeBefore: string | null = null;
  buildMode.subscribe((b) => {
    slotsView.building = b;
    if (b) {
      if (mapMode.value !== "slots") modeBefore = mapMode.value;
      world.setMode("slots");
      mapMode.value = "slots";
    } else if (modeBefore) {
      world.setMode(modeBefore);
      mapMode.value = modeBefore;
      modeBefore = null;
    } else if (mapMode.value === "slots") world.refresh();
  });
  panel.subscribe((p) => {
    if (p !== "construction" && buildMode.value) buildMode.value = null;
    if (p !== "research") researchPick.value = null;
  });
  // unit counters follow the game state; right-click orders the selected divisions to a province
  const counters = new UnitCounters(view, map, db, () => (screen.value === "game" ? session.state : null));
  version.subscribe((v) => counters.refresh(v));
  selectedDivisions.subscribe(() => counters.refresh(-2 - Math.random()));
  showAlliedDivisions.subscribe(() => counters.refresh(-2 - Math.random()));
  // fronts and battle plans drawn on the map
  const fronts = new FrontOverlay(view, map, db, () => session.sim?.context.map, () => (screen.value === "game" ? session.state : null));
  version.subscribe(() => fronts.refresh());
  const battles = new BattleMarkers(view, map, db, () => (screen.value === "game" ? session.state : null));
  version.subscribe(() => battles.refresh());
  selectedArmy.subscribe(() => { fronts.refresh(true); counters.refresh(-2 - Math.random()); });
  selectedDivisions.subscribe(() => fronts.refresh(true));
  screen.subscribe((s) => { if (s !== "game") { counters.clear(); battles.clear(); openWar.value = null; selectedDivisions.value = []; selectedArmy.value = 0; planTool.value = null; buildMode.value = null; } fronts.refresh(true); });
  // drawing an offensive line or a spearhead: a left drag collects the provinces it crosses
  // battle-plan drawing (front, offensive line, spearhead): src/ui/units/planDrawing.ts
  const drawer = createPlanDrawer(view, world, session, () => fronts.refresh(true));
  // in game a left drag draws a selection box over your divisions (shift adds); right or middle drag pans,
  // a left click without dragging still selects the province
  const box = document.createElement("div");
  box.className = "sel-box";
  ui.appendChild(box);
  let boxFrom: { sx: number; sy: number; wx: number; wy: number } | null = null;
  const boxSelect = (phase: "down" | "move" | "up", x: number, y: number, e: PointerEvent) => {
    if (phase === "down") {
      boxFrom = { sx: e.clientX, sy: e.clientY, wx: x, wy: y };
      return;
    }
    if (!boxFrom) return;
    const moved = Math.hypot(e.clientX - boxFrom.sx, e.clientY - boxFrom.sy) >= 5;
    if (phase === "move") {
      box.style.display = moved ? "block" : "none";
      box.style.left = `${Math.min(boxFrom.sx, e.clientX)}px`;
      box.style.top = `${Math.min(boxFrom.sy, e.clientY)}px`;
      box.style.width = `${Math.abs(e.clientX - boxFrom.sx)}px`;
      box.style.height = `${Math.abs(e.clientY - boxFrom.sy)}px`;
      return;
    }
    box.style.display = "none";
    const from = boxFrom;
    boxFrom = null;
    const st = session.state;
    if (!moved) {
      // a plain click: clear the division selection and select the province (or place a building)
      if (!e.shiftKey && !buildMode.value) { selectedDivisions.value = []; selectedArmy.value = 0; }
      world.select(world.pickAt(x, y));
      return;
    }
    if (!st?.player) return;
    const [x0, x1] = [Math.min(from.wx, x), Math.max(from.wx, x)], [y0, y1] = [Math.min(from.wy, y), Math.max(from.wy, y)];
    const inside = st.divisions.filter((d) => {
      if (d.owner !== st.player) return false;
      const p = map.provinces[d.province - 1];
      if (!p) return false;
      const px = p.centroid[0], py = millerYOf(p.centroid[1]);
      return px >= x0 && px <= x1 && py >= y0 && py <= y1;
    }).map((d) => d.id);
    selectedArmy.value = 0;
    selectedDivisions.value = e.shiftKey ? [...new Set([...selectedDivisions.value, ...inside])] : inside;
  };
  const setCapture = () => {
    const tool = planTool.value;
    view.capture = tool ? drawer.capture : screen.value === "game" ? boxSelect : null;
  };
  planTool.subscribe(setCapture);
  screen.subscribe(setCapture);
  // right-click: cancels a drawing tool; otherwise moves or attacks with the selected divisions
  world.onOrder = (id) => {
    if (planTool.value) { drawer.cancel(); return; }
    const st = session.state;
    if (!st?.player || !selectedDivisions.value.length) return;
    if (!id) { toast.value = { text: "That is sea: divisions move over land only.", bad: true, at: Date.now() }; return; }
    const results = selectedDivisions.value.map((d) => session.dispatch({ type: "move_division", tag: st.player!, division: d, province: id }));
    const ok = results.filter((r) => r.ok);
    toast.value = ok.length
      ? { text: `${ok.length > 1 ? `${ok.length} divisions: ` : ""}${ok[0]!.text}${ok.length < results.length ? ` (${results.length - ok.length} cannot get there)` : ""}`, at: Date.now() }
      : { text: results[0]!.text, bad: true, at: Date.now() };
    fronts.refresh(true);
  };
  (window as unknown as { nm: unknown }).nm = { db, map, view, world, session, THREE };
  bindKeys(session, drawer.key);

  render(<Root db={db} map={map} world={world} session={session} issues={bundle.issues} />, ui);
}

function ContentChangedBanner() {
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    import.meta.hot?.on("nm:content-changed", () => setChanged(true));
  }, []);
  if (!changed) return null;
  return (
    <div class="content-banner hp">
      Game data changed on disk. <button class="btn" onClick={() => location.reload()}>Reload</button>
    </div>
  );
}

function Root({ db, map, world, session, issues }: { db: ContentDB; map: MapData; world: WorldMap; session: Session; issues: ContentBundle["issues"] }) {
  const inGame = screen.value === "game" && !!session.state;
  const fullView = inGame && (panel.value === "focus" || (panel.value === "research" && researchPick.value !== null) || openWar.value !== null);
  return (
    <>
      {fullView && <div class="veil" aria-hidden="true" />}
      {inGame ? (
        <>
          <TopBar db={db} session={session} />
          <LeftPanel db={db} map={map} session={session} />
          <Outliner db={db} session={session} />
        </>
      ) : (
        <CountrySelect db={db} session={session} issues={issues} />
      )}
      {inGame && <MapModeBar db={db} map={map} world={world} />}
      {inGame && <ArmyBar db={db} session={session} />}
      {inGame && <DivisionPanel db={db} session={session} />}
      {inGame && <WarPanel db={db} session={session} />}
      <Toast />
      <ProvinceTooltip db={db} map={map} session={inGame ? session : undefined} />
      {inGame && panel.value === "focus" && <FocusTreeView db={db} session={session} />}
      {inGame && panel.value === "research" && researchPick.value !== null && <ResearchView db={db} session={session} />}
      {inGame && <ElectionNight db={db} session={session} />}
      {inGame && <EventWindow db={db} session={session} />}
      {inGame && <PeaceScreen db={db} session={session} />}
      {inGame && <PeaceNotice />}
      {inGame && <CoalitionPanel db={db} session={session} />}
      {inGame && panel.value === "menu" && <GameMenu session={session} />}
      <TooltipLayer />
      <ContentChangedBanner />
    </>
  );
}

/** HOI4 keys: Q-P open the tab row, Space pauses, +/- or 1-5 set speed, Esc closes or opens the menu. */
function bindKeys(session: Session, planKey: (e: KeyboardEvent) => boolean): void {
  window.addEventListener("keydown", (e) => {
    if (screen.value !== "game" || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement | null)?.closest?.("input, select, textarea")) return;
    if (planKey(e)) { e.preventDefault(); return; }
    const tab = TABS.find((t) => t.key === e.key.toUpperCase());
    if (e.code === "Space") { e.preventDefault(); session.setPaused(!paused.value); }
    else if (/^Digit[1-5]$/.test(e.code)) session.setSpeed(Number(e.code.slice(5)));
    else if (e.key === "+" || e.key === "=") session.setSpeed(speed.value + 1);
    else if (e.key === "-") session.setSpeed(speed.value - 1);
    else if (tab) { panel.value = panel.value === tab.id ? null : tab.id; activeTip.value = null; }
    else if (e.key === "Escape" && buildMode.value) buildMode.value = null;
    else if (e.key === "Escape" && researchPick.value !== null) researchPick.value = null;
    else if (e.key === "Escape") panel.value = panel.value ? null : selectedProvince.value ? ((selectedProvince.value = 0), null) : "menu";
  });
}

boot().catch((err: Error) => {
  console.error(err);
  render(<div class="error-box panel">Failed to start: {err.message}</div>, document.getElementById("ui")!);
});
