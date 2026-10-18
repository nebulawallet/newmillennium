/**
 * Later start dates (data/scenarios/bookmarks.json). A bookmark's world is not written by hand: the historical
 * game runs from 1 January 2000 to its date with history followed exactly (`strictHistory`: real election
 * results, no coups or civil wars on the historical path), so leaders, borders, wars and armed groups are what
 * the data says on that day. The snapshots are made when the game is built (scripts/vite/contentPlugin.ts);
 * the start screen loads one and hands it to the player.
 */
import type { ContentDB } from "../content/compile.ts";
import { dayOf } from "./date.ts";
import { Simulation, type SimMap } from "./simulation.ts";
import { createInitialState, dynamicOffices, type GameRules, type GameState } from "./state.ts";
import type { MapData } from "../render/mapData.ts";

/** Run history once and take a snapshot at each later bookmark (JSON text, ready to serve). */
export function generateScenarios(db: ContentDB, map: Pick<MapData, "provinces">, simMap: SimMap, contentHash: string): Map<string, string> {
  const out = new Map<string, string>();
  const later = db.bookmarks.filter((b) => b.date > "2000-01-01").sort((a, b) => a.date.localeCompare(b.date));
  if (!later.length) return out;
  const state = createInitialState(db, map, { contentHash, player: null, rules: { electionMode: "historical", strictHistory: true } });
  const sim = new Simulation(db, state, undefined, simMap);
  for (const b of later) {
    while (state.day < dayOf(b.date)) sim.step();
    const snap: GameState = { ...state, rules: { electionMode: "historical" }, player: null, log: state.log.slice(-60), scenario: b.id };
    out.set(b.id, JSON.stringify(snap));
  }
  return out;
}

/** A loaded snapshot made ready to play: the player's country and the election mode the start screen chose. */
export function playScenario(db: ContentDB, snapshot: GameState, player: string, rules: Partial<GameRules>): GameState {
  const state: GameState = { ...snapshot, player, rules: { electionMode: rules.electionMode ?? "historical" } };
  if (state.rules.electionMode === "dynamic") for (const cs of Object.values(state.countries)) dynamicOffices(db, cs);
  return state;
}
