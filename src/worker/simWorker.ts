/**
 * Simulation in a Web Worker (Phase 12). The simulation is pure TypeScript with JSON state, so it
 * runs here unchanged. Used for long headless runs (the `?soak` acceptance page): the main thread
 * stays free while years are simulated. Live play stays on the main thread, where staggered
 * country buckets keep a game day well inside the speed-5 budget; mirroring the full state back
 * every few days would cost more than it saves.
 *
 * Protocol: post { type: "soak", years, dynamic, seed }; receive "year" progress messages, then
 * "done" (or "error" with the message and the game day it happened on).
 */
import { fromBundle, type ContentBundle } from "../content/bundle.ts";
import { ymdOf } from "../sim/date.ts";
import { Simulation, simMapFrom } from "../sim/simulation.ts";
import { createInitialState } from "../sim/state.ts";

export type SoakRequest = { type: "soak"; years: number; dynamic: boolean; seed: number };
export type SoakMessage =
  | { type: "year"; year: number; msPerDay: number; worstMs: number; wars: number; warsNow: number; divisions: number; tension: number }
  | { type: "done"; days: number; seconds: number; meanMs: number; p99Ms: number; worstMs: number; countries: number; wars: number; civilWars: number; blocs: Record<string, number>; log: string[] }
  | { type: "error"; message: string; day: string };

const post = (m: SoakMessage) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (e: MessageEvent<SoakRequest>) => {
  if (e.data.type !== "soak") return;
  const { years, dynamic, seed } = e.data;
  let sim: Simulation | null = null;
  try {
    const [bundle, provinces, adjacency] = await Promise.all([
      fetch("/content/bundle.json").then((r) => r.json() as Promise<ContentBundle>),
      fetch("/map/provinces.json").then((r) => r.json()),
      fetch("/map/adjacency.json").then((r) => r.json()),
    ]);
    const db = fromBundle(bundle);
    const state = createInitialState(db, { provinces }, { contentHash: bundle.hash, seed, player: null, rules: { electionMode: dynamic ? "dynamic" : "historical" } });
    const rivers = await fetch("/map/rivers.json").then((r) => (r.ok ? r.json() : { pairs: [] })).catch(() => ({ pairs: [] }));
    sim = new Simulation(db, state, undefined, simMapFrom(provinces, adjacency, rivers.pairs));
    let civilWars = 0;
    sim.onEvent((ev) => { if (ev.type === "civil_war") civilWars++; });
    const seen = new Set<number>();
    const times: number[] = [];
    const days = Math.round(years * 365.25);
    const t0 = performance.now();
    for (let i = 0; i < days; i++) {
      const a = performance.now();
      sim.step();
      times.push(performance.now() - a);
      for (const w of state.wars) seen.add(w.id);
      if (i % 365 === 364 || i === days - 1) {
        const yr = times.slice(-365);
        post({ type: "year", year: ymdOf(state.day).year, msPerDay: yr.reduce((s, x) => s + x, 0) / yr.length, worstMs: Math.max(...yr), wars: seen.size, warsNow: state.wars.length, divisions: state.divisions.length, tension: state.worldTension });
      }
    }
    const sorted = [...times].sort((a, b) => a - b);
    post({
      type: "done",
      days,
      seconds: (performance.now() - t0) / 1000,
      meanMs: times.reduce((s, x) => s + x, 0) / days,
      p99Ms: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
      worstMs: sorted[sorted.length - 1] ?? 0,
      countries: Object.values(state.countries).filter((c) => c.active).length,
      wars: seen.size,
      civilWars,
      blocs: Object.fromEntries(Object.entries(state.diplomacy.blocs).map(([k, v]) => [k, v.length])),
      log: state.log.filter((l) => l.kind === "war" || l.kind === "civil_war" || l.kind === "diplomacy").slice(-12).map((l) => `${ymdOf(l.day).year} ${l.tag ?? ""} ${l.text}`),
    });
  } catch (err) {
    post({ type: "error", message: (err as Error).stack ?? String(err), day: sim ? `${ymdOf(sim.state.day).year}-${ymdOf(sim.state.day).month}-${ymdOf(sim.state.day).day}` : "setup" });
  }
};
