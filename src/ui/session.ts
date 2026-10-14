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
import { Simulation } from "../sim/simulation.ts";
import { createInitialState, type GameRules, type GameState, type LogEntry } from "../sim/state.ts";

export type Screen = "select" | "game";
export type Panel = TabId | "menu" | null;

export const screen = signal<Screen>("select");
export const panel = signal<Panel>(null);
/** Incremented whenever the simulation advances or state changes; components read it to re-render. */
export const version = signal(0);
export const speed = signal(2);
export const paused = signal(true);
export const feed = signal<LogEntry[]>([]);

export class Session {
  sim: Simulation | null = null;
  clock: Clock | null = null;

  constructor(
    readonly db: ContentDB,
    readonly map: MapData,
    readonly world: WorldMap,
    readonly contentHash: string,
  ) {}

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
    this.sim = new Simulation(this.db, state);
    this.sim.onLog((e) => {
      feed.value = [e, ...feed.value].slice(0, 40);
    });
    feed.value = [...state.log].reverse().slice(0, 40);
    this.clock = new Clock(this.sim, () => (version.value += 1));
    this.clock.setSpeed(speed.value);
    paused.value = true;
    screen.value = "game";
    version.value += 1;
    // focus the camera on the player's country
    const label = this.map.labels.find((l) => l.tag === state.player);
    if (label) this.world.view.lookAt(label.x, label.y, Math.max(12, Math.min(60, label.extent * 2.2)));
  }

  setPaused(p: boolean): void {
    this.clock?.setPaused(p);
    paused.value = p;
  }

  setSpeed(s: number): void {
    this.clock?.setSpeed(s);
    speed.value = this.clock?.speed ?? s;
  }

  quitToMenu(): void {
    this.clock?.dispose();
    this.sim = null;
    this.clock = null;
    paused.value = true;
    panel.value = null;
    screen.value = "select";
  }
}
