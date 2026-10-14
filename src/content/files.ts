/** Abstract access to the data/ directory so the compiler runs in Node, tests and (later) the browser. */
export interface FileProvider {
  /** Read a file relative to the data root; undefined if it does not exist. */
  read(path: string): string | undefined;
  /** List file paths (relative to the data root) directly inside a directory. */
  listFiles(dir: string): string[];
}

/** In-memory provider, used by tests. */
export class MemoryFiles implements FileProvider {
  constructor(private files: Record<string, unknown>) {}
  read(path: string): string | undefined {
    const v = this.files[path];
    if (v === undefined) return undefined;
    return typeof v === "string" ? v : JSON.stringify(v);
  }
  listFiles(dir: string): string[] {
    const prefix = dir.endsWith("/") ? dir : dir + "/";
    return Object.keys(this.files).filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"));
  }
}
