import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FileProvider } from "../../src/content/files.ts";

export const DATA_ROOT = resolve(import.meta.dirname, "../../data");

/** Reads the data/ directory from disk. */
export class NodeFiles implements FileProvider {
  constructor(private root = DATA_ROOT) {}
  read(path: string): string | undefined {
    const p = join(this.root, path);
    return existsSync(p) ? readFileSync(p, "utf8").replace(/^﻿/, "") : undefined;
  }
  listFiles(dir: string): string[] {
    const p = join(this.root, dir);
    if (!existsSync(p)) return [];
    return readdirSync(p)
      .filter((f) => statSync(join(p, f)).isFile())
      .map((f) => `${dir}/${f}`);
  }
}

/** Minimal argv parser: --flag, --key value, --key=value. */
export function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq > 0) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1]!.startsWith("--")) out[a.slice(2)] = argv[++i]!;
    else out[a.slice(2)] = true;
  }
  return out;
}
