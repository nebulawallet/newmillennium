import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow-semi-condensed/500.css";
import "@fontsource/barlow-semi-condensed/600.css";
import "@fontsource/barlow-semi-condensed/700.css";
import "./ui/shell.css";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import * as THREE from "three";
import { fromBundle, type ContentBundle } from "./content/bundle.ts";
import type { ContentDB } from "./content/compile.ts";
import { runBenchmark, type BenchResult } from "./render/benchmark.ts";
import { SoakPanel } from "./ui/SoakPanel.tsx";
import { loadMapData, type MapData } from "./render/mapData.ts";
import { MapView } from "./render/MapView.ts";
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
import { ResearchView } from "./ui/research/ResearchPanel.tsx";
import { FocusTreeView } from "./ui/scripted/FocusTree.tsx";
import { PeaceConference } from "./ui/units/WarUi.tsx";
import { hoveredProvince, pickedCountry, planDraft, planTool, pointer, selectedArmy, selectedDivisions, selectedProvince } from "./ui/store.ts";
import { UnitCounters } from "./ui/units/UnitCounters.ts";
import { FrontOverlay } from "./ui/units/FrontOverlay.ts";
import { ArmyBar } from "./ui/units/ArmyBar.tsx";
import { version } from "./ui/session.ts";

async function loadContent(): Promise<{ db: ContentDB; bundle: ContentBundle }> {
  const res = await fetch("/content/bundle.json");
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
      const owner = map.provinces[id - 1]?.owner;
      if (owner) pickedCountry.value = owner;
      world.select(0);
      return;
    }
    selectedProvince.value = id;
    if (id) panel.value = null;
  };
  selectedProvince.subscribe((id) => world.select(id));
  window.addEventListener("pointermove", (e) => (pointer.value = { x: e.clientX, y: e.clientY }));
  const session = new Session(db, map, world, bundle.hash);
  // unit counters follow the game state; right-click orders the selected divisions to a province
  const counters = new UnitCounters(view, map, db, () => (screen.value === "game" ? session.state : null));
  version.subscribe((v) => counters.refresh(v));
  selectedDivisions.subscribe(() => counters.refresh(-2 - Math.random()));
  // fronts and battle plans drawn on the map
  const fronts = new FrontOverlay(view, map, () => session.sim?.context.map, () => (screen.value === "game" ? session.state : null));
  version.subscribe(() => fronts.refresh());
  selectedArmy.subscribe(() => { fronts.refresh(true); counters.refresh(-2 - Math.random()); });
  screen.subscribe((s) => { if (s !== "game") { counters.clear(); selectedDivisions.value = []; selectedArmy.value = 0; planTool.value = null; } fronts.refresh(true); });
  // drawing an offensive line or a spearhead: a left drag collects the provinces it crosses
  let last: [number, number] | null = null;
  const crossed = (x: number, y: number) => {
    // sample the stroke between pointer events so no province along it is skipped
    const [x0, y0] = last ?? [x, y];
    const steps = Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0) / 0.15));
    let draft = planDraft.value;
    for (let i = 1; i <= steps; i++) {
      const id = world.pickAt(x0 + ((x - x0) * i) / steps, y0 + ((y - y0) * i) / steps);
      if (id && draft.at(-1) !== id) draft = [...draft.filter((p) => p !== id), id];
    }
    planDraft.value = draft;
    last = [x, y];
  };
  planTool.subscribe((tool) => {
    view.capture = !tool ? null : (phase, x, y) => {
      if (phase === "down") { last = null; planDraft.value = []; crossed(x, y); }
      else if (phase === "move") crossed(x, y);
      else {
        crossed(x, y);
        const st = session.state;
        const drawn = planDraft.value;
        if (st?.player && drawn.length) {
          if (tool.kind === "offensive") {
            const enemy = drawn.filter((p) => { const c = st.provinceController[p - 1]; return c && c !== st.player; });
            session.dispatch({ type: "set_offensive", tag: st.player, army: tool.army, provinces: enemy.length ? enemy : drawn });
          } else session.dispatch({ type: "add_spearhead", tag: st.player, army: tool.army, path: drawn });
        }
        planDraft.value = [];
        planTool.value = null;
        fronts.refresh(true);
      }
    };
  });
  world.onOrder = (id) => {
    const st = session.state;
    if (!id || !st?.player || !selectedDivisions.value.length) return;
    for (const d of selectedDivisions.value) session.dispatch({ type: "move_division", tag: st.player, division: d, province: id });
  };
  (window as unknown as { nm: unknown }).nm = { db, map, view, world, session, THREE };
  bindKeys(session);

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
  return (
    <>
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
      <ProvinceTooltip db={db} map={map} />
      {inGame && panel.value === "focus" && <FocusTreeView db={db} session={session} />}
      {inGame && panel.value === "research" && <ResearchView db={db} session={session} />}
      {inGame && <ElectionNight db={db} session={session} />}
      {inGame && <EventWindow db={db} session={session} />}
      {inGame && <PeaceConference db={db} session={session} />}
      {inGame && <CoalitionPanel db={db} session={session} />}
      {inGame && panel.value === "menu" && <GameMenu session={session} />}
      <TooltipLayer />
      <ContentChangedBanner />
    </>
  );
}

/** HOI4 keys: Q-P open the tab row, Space pauses, +/- or 1-5 set speed, Esc closes or opens the menu. */
function bindKeys(session: Session): void {
  window.addEventListener("keydown", (e) => {
    if (screen.value !== "game" || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement | null)?.closest?.("input, select, textarea")) return;
    const tab = TABS.find((t) => t.key === e.key.toUpperCase());
    if (e.code === "Space") { e.preventDefault(); session.setPaused(!paused.value); }
    else if (/^Digit[1-5]$/.test(e.code)) session.setSpeed(Number(e.code.slice(5)));
    else if (e.key === "+" || e.key === "=") session.setSpeed(speed.value + 1);
    else if (e.key === "-") session.setSpeed(speed.value - 1);
    else if (tab) { panel.value = panel.value === tab.id ? null : tab.id; activeTip.value = null; }
    else if (e.key === "Escape" && planTool.value) { planTool.value = null; planDraft.value = []; }
    else if (e.key === "Escape") panel.value = panel.value ? null : selectedProvince.value ? ((selectedProvince.value = 0), null) : "menu";
  });
}

boot().catch((err: Error) => {
  console.error(err);
  render(<div class="error-box panel">Failed to start: {err.message}</div>, document.getElementById("ui")!);
});
