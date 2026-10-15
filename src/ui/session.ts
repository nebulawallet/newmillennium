/**
 * Game session: owns the Simulation, the Clock and the map, and exposes signals the UI renders
 * from. UI components never mutate GameState directly (later phases route actions through
 * simulation commands).
 */
import { signal } from "@preact/signals";
import type { ContentDB } from "../content/compile.ts";
import type { MapData } from "../render/mapData.ts";
import type { WorldMap } from "../render/WorldMap.ts";
import type { TabId } from "./tabs.ts";
import { Clock } from "../sim/clock.ts";
import { Simulation, simMapFrom, type SimEvent, type SimMap } from "../sim/simulation.ts";
import { createInitialState, migrateState, type ElectionResult, type GameRules, type GameState, type LogEntry } from "../sim/state.ts";

export type Screen = "select" | "game";
export type Panel = TabId | "menu" | "focus" | "economy" | null;

export const screen = signal<Screen>("select");
export const panel = signal<Panel>(null);
/** Incremented whenever the simulation advances or state changes; components read it to re-render. */
export const version = signal(0);
export const speed = signal(2);
export const paused = signal(true);
export const feed = signal<LogEntry[]>([]);
/** Election result shown on the election-night screen (player's country), or null. */
export const electionNight = signal<ElectionResult | null>(null);

export class Session {
  sim: Simulation | null = null;
  clock: Clock | null = null;
  readonly simMap: SimMap;
  /** Set when ownership, governments or results changed; the map recolours on the next tick. */
  private mapDirty = false;

  constructor(
    readonly db: ContentDB,
    readonly map: MapData,
    readonly world: WorldMap,
    readonly contentHash: string,
  ) {
    this.simMap = simMapFrom(map.provinces, map.adjacency);
  }

  get state(): GameState | null {
    return this.sim?.state ?? null;
  }

  newGame(player: string, rules: Partial<GameRules>): void {
    const state = createInitialState(this.db, this.map, { contentHash: this.contentHash, player, rules });
    this.start(state);
  }

  /** Start (or resume) from a state, e.g. a loaded save. */
  start(state: GameState): void {
    this.clock?.dispose();
    if (state.contentHash !== this.contentHash)
      console.warn(`[save] content changed since this save (save ${state.contentHash}, game ${this.contentHash}); continuing`);
    this.sim = new Simulation(this.db, migrateState(this.db, state), undefined, this.simMap);
    this.sim.onLog((e) => {
      feed.value = [e, ...feed.value].slice(0, 40);
    });
    this.sim.onEvent((e) => this.onSimEvent(e));
    this.world.setOwners(this.sim.state);
    feed.value = [...state.log].reverse().slice(0, 40);
    this.clock = new Clock(this.sim, () => {
      version.value += 1;
      if (this.mapDirty) {
        this.mapDirty = false;
        this.world.refresh();
      }
    });
    this.clock.setSpeed(speed.value);
    paused.value = true;
    screen.value = "game";
    version.value += 1;
    // focus the camera on the player's country
    const label = this.map.labels.find((l) => l.tag === state.player);
    if (label) this.world.view.lookAt(label.x, label.y, Math.max(12, Math.min(60, label.extent * 2.2)));
  }

  private onSimEvent(e: SimEvent): void {
    const st = this.sim?.state;
    if (!st) return;
    if (e.type !== "coalition_needed") this.mapDirty = true;
    if (e.type === "election" && e.result.tag === st.player) {
      electionNight.value = e.result;
      this.setPaused(true);
    } else if ((e.type === "coalition_needed" || e.type === "event") && e.tag === st.player) {
      this.setPaused(true);
    }
  }

  setPaused(p: boolean): void {
    // the player must answer a pending government formation first
    if (!p && this.sim?.state.pendingCoalition) return;
    this.clock?.setPaused(p);
    paused.value = p;
  }

  setSpeed(s: number): void {
    this.clock?.setSpeed(s);
    speed.value = this.clock?.speed ?? s;
  }

  /** Send a player command to the simulation and refresh the UI. */
  dispatch(cmd: Parameters<Simulation["dispatch"]>[0]) {
    const r = this.sim?.dispatch(cmd) ?? { ok: false, text: "No game running." };
    version.value += 1;
    this.world.refresh();
    return r;
  }

  quitToMenu(): void {
    this.clock?.dispose();
    this.sim = null;
    this.clock = null;
    this.world.setOwners(null);
    paused.value = true;
    panel.value = null;
    electionNight.value = null;
    screen.value = "select";
  }
}
