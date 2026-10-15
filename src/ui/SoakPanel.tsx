/** `?soak=YEARS[&dynamic][&seed=N]`: runs the whole world under AI in a Web Worker and reports tick times (Phase 12 acceptance). */
import { useEffect, useState } from "preact/hooks";
import type { SoakMessage, SoakRequest } from "../worker/simWorker.ts";

export function SoakPanel({ years, dynamic, seed }: { years: number; dynamic: boolean; seed: number }) {
  const [rows, setRows] = useState<Extract<SoakMessage, { type: "year" }>[]>([]);
  const [done, setDone] = useState<Extract<SoakMessage, { type: "done" }> | null>(null);
  const [error, setError] = useState<Extract<SoakMessage, { type: "error" }> | null>(null);
  useEffect(() => {
    const w = new Worker(new URL("../worker/simWorker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<SoakMessage>) => {
      const m = e.data;
      if (m.type === "year") setRows((r) => [...r, m]);
      else if (m.type === "done") { setDone(m); console.info("[soak] done", m); w.terminate(); }
      else { setError(m); console.error(`[soak] error on ${m.day}: ${m.message}`); w.terminate(); }
    };
    w.postMessage({ type: "soak", years, dynamic, seed } satisfies SoakRequest);
    return () => w.terminate();
  }, []);
  return (
    <section class="bench hp soak">
      <h2>Soak run: {years} game-years, {dynamic ? "dynamic" : "historical"} elections, seed {seed}</h2>
      <p class="dim small">The simulation runs in a Web Worker with every country under AI; this page stays responsive.</p>
      <table>
        <thead><tr><th>year</th><th>ms/day</th><th>worst day (ms)</th><th>wars so far</th><th>under way</th><th>divisions</th><th>tension</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.year}><td>{r.year}</td><td>{r.msPerDay.toFixed(2)}</td><td>{r.worstMs.toFixed(1)}</td><td>{r.wars}</td><td>{r.warsNow}</td><td>{r.divisions}</td><td>{Math.round(r.tension * 100)}%</td></tr>
          ))}
        </tbody>
      </table>
      {!done && !error && <p class="dim">Running…</p>}
      {error && <p class="warn">Error on {error.day}: <code>{error.message}</code></p>}
      {done && (
        <>
          <p>{done.days} days in {done.seconds.toFixed(1)} s: mean {done.meanMs.toFixed(2)} ms/day, p99 {done.p99Ms.toFixed(2)} ms, worst {done.worstMs.toFixed(1)} ms. {done.countries} countries acting; {done.wars} wars, {done.civilWars} civil wars. No errors.</p>
          <p class="small">Blocs: {Object.entries(done.blocs).map(([k, v]) => `${k} ${v}`).join(", ")}</p>
          <ul class="small">{done.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </>
      )}
    </section>
  );
}
