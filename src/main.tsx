import { render } from "preact";
import { fromBundle, type ContentBundle } from "./content/bundle.ts";
import { MapView } from "./render/MapView.ts";
import { App } from "./ui/App.tsx";

async function boot(): Promise<void> {
  const ui = document.getElementById("ui")!;
  render(<div class="loading">Loading content…</div>, ui);

  const res = await fetch("/content/bundle.json");
  if (!res.ok) throw new Error(`content bundle: HTTP ${res.status}`);
  const bundle = (await res.json()) as ContentBundle;
  const db = fromBundle(bundle);

  const errors = bundle.issues.filter((i) => i.severity === "error");
  if (errors.length) {
    console.warn(`[content] ${errors.length} content errors (run npm run validate-data for details)`);
    for (const e of errors.slice(0, 50)) console.warn(`[content] [${e.code}] ${e.file}: ${e.message}`);
  }
  console.info(`[content] ${db.countries.size} countries, ${db.people.size} people, ${db.parties.size} parties (hash ${bundle.hash})`);

  const map = new MapView(document.getElementById("map") as HTMLCanvasElement);
  (window as unknown as { nm: unknown }).nm = { db, map };

  render(<App db={db} issues={bundle.issues} />, ui);
}

boot().catch((err: Error) => {
  console.error(err);
  render(<div class="error-box panel">Failed to start: {err.message}</div>, document.getElementById("ui")!);
});
