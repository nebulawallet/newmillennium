/**
 * Vite plugin: compiles data/ with the same compiler as validate-data and serves it at
 * /content/bundle.json. In dev it recompiles and reloads the page whenever a data file changes;
 * in production builds it emits the bundle as an asset.
 */
import type { Plugin, ViteDevServer } from "vite";
import { compileContent } from "../../src/content/compile.ts";
import { toBundle } from "../../src/content/bundle.ts";
import { DATA_ROOT, NodeFiles } from "../lib/nodeFiles.ts";

const URL_PATH = "/content/bundle.json";

function build(): string {
  const result = compileContent(new NodeFiles(), { tier: "core" });
  // Countries without data are expected while the database is being built; don't ship 200 errors.
  result.issues = result.issues.filter((i) => i.code !== "MISSING_COUNTRY");
  return JSON.stringify(toBundle(result));
}

export function contentPlugin(): Plugin {
  let cached: string | null = null;
  return {
    name: "new-millennium-content",
    configureServer(server: ViteDevServer) {
      server.watcher.add(DATA_ROOT);
      server.watcher.on("all", (_event, file) => {
        if (file.replace(/\\/g, "/").includes("/data/") && file.endsWith(".json")) {
          cached = null;
          server.ws.send({ type: "full-reload" });
        }
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
    },
  };
}
