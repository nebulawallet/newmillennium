/**
 * Vite plugin: compiles data/ with the same compiler as validate-data and serves it at
 * /content/bundle.json. In dev it recompiles and reloads the page whenever a data file changes;
 * in production builds it emits the bundle as an asset.
 */
import { readFileSync } from "node:fs";
import type { Plugin, ViteDevServer } from "vite";
import { compileContent } from "../../src/content/compile.ts";
import { toBundle } from "../../src/content/bundle.ts";
import { generateScenarios } from "../../src/sim/scenario.ts";
import { simMapFrom } from "../../src/sim/simulation.ts";
import { DATA_ROOT, NodeFiles } from "../lib/nodeFiles.ts";

const URL_PATH = "/content/bundle.json";
const SCENARIO_PATH = "/scenarios/";

function compile() {
  const result = compileContent(new NodeFiles(), { tier: "core" });
  // Countries without data are expected while the database is being built; don't ship 200 errors.
  result.issues = result.issues.filter((i) => i.code !== "MISSING_COUNTRY");
  return result;
}

function build(): string {
  return JSON.stringify(toBundle(compile()));
}

/** Later start dates: the historical game run to each bookmark (src/sim/scenario.ts). About half a minute. */
function scenarios(): Map<string, string> {
  const result = compile();
  const bundle = toBundle(result);
  const read = (f: string) => JSON.parse(readFileSync(`public/map/${f}`, "utf8"));
  const provinces = read("provinces.json");
  const rivers = (() => { try { return read("rivers.json").pairs; } catch { return []; } })();
  const t0 = Date.now();
  const out = generateScenarios(result.db, { provinces }, simMapFrom(provinces, read("adjacency.json"), rivers), bundle.hash);
  console.info(`[scenarios] ${[...out.keys()].join(", ")} generated in ${Math.round((Date.now() - t0) / 1000)} s`);
  return out;
}

export function contentPlugin(): Plugin {
  let cached: string | null = null;
  let scenarioCache: Map<string, string> | null = null;
  return {
    name: "new-millennium-content",
    configureServer(server: ViteDevServer) {
      server.watcher.add(DATA_ROOT);
      // Don't force a reload (that would wipe a running game); notify the page, debounced.
      let timer: ReturnType<typeof setTimeout> | null = null;
      server.watcher.on("all", (_event, file) => {
        if (file.replace(/\\/g, "/").includes("/data/") && file.endsWith(".json")) {
          cached = null;
          scenarioCache = null;
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => server.ws.send({ type: "custom", event: "nm:content-changed", data: {} }), 800);
        }
      });
      server.middlewares.use(SCENARIO_PATH, (req, res, next) => {
        const id = (req.url ?? "").replace(/^\//, "").replace(/\.json.*$/, "");
        scenarioCache ??= scenarios();
        const body = scenarioCache.get(id);
        if (!body) return next();
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(body);
      });
      server.middlewares.use(URL_PATH, (_req, res) => {
        cached ??= build();
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(cached);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: URL_PATH.slice(1), source: build() });
      for (const [id, json] of scenarios()) this.emitFile({ type: "asset", fileName: `${SCENARIO_PATH.slice(1)}${id}.json`, source: json });
    },
  };
}
