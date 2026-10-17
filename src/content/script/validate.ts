/**
 * Structural validation of trigger/effect scripts against the registry.
 * Reference checks (does this party exist?) are delegated to a callback so this
 * module has no dependency on the content database.
 */
import { COUNTRY_SCOPE, EFFECTS, LOGIC_KEYS, SCOPES, TRIGGERS, type RefKind } from "./registry.ts";

export interface ScriptIssue {
  path: string;
  message: string;
}
export type RefChecker = (kind: RefKind, value: string) => boolean;

function single(node: unknown, path: string, out: ScriptIssue[]): [string, unknown] | null {
  if (typeof node !== "object" || node === null || Array.isArray(node)) {
    out.push({ path, message: "script node must be an object with exactly one key" });
    return null;
  }
  const keys = Object.keys(node);
  if (keys.length !== 1) {
    out.push({ path, message: `script node must have exactly one key, found ${keys.length} (${keys.join(", ")})` });
    return null;
  }
  const k = keys[0]!;
  return [k, (node as Record<string, unknown>)[k]];
}

/** Every value at a dot-separated path; arrays along the way (and at the end) are flattened. */
function valuesAt(obj: unknown, path: string): unknown[] {
  let cur: unknown[] = [obj];
  for (const p of path === "" ? [] : path.split(".")) {
    cur = cur.flatMap((o) => (Array.isArray(o) ? o : [o])).map((o) => (o && typeof o === "object" ? (o as Record<string, unknown>)[p] : undefined));
  }
  return cur.flatMap((o) => (Array.isArray(o) ? o : [o]));
}

function checkArgs(
  table: typeof EFFECTS,
  key: string,
  args: unknown,
  path: string,
  out: ScriptIssue[],
  refs?: RefChecker,
): void {
  const def = table[key]!;
  const r = def.args.safeParse(args);
  if (!r.success) {
    for (const iss of r.error.issues) out.push({ path: `${path}.${key}${iss.path.length ? "." + iss.path.join(".") : ""}`, message: iss.message });
    return;
  }
  if (refs && def.refs) {
    for (const [p, kind] of Object.entries(def.refs)) {
      for (const v of valuesAt(args, p))
        if (typeof v === "string" && !refs(kind, v)) out.push({ path: `${path}.${key}${p ? "." + p : ""}`, message: `unknown ${kind} '${v}'` });
    }
  }
}

export function validateTrigger(node: unknown, path: string, out: ScriptIssue[], refs?: RefChecker): void {
  const kv = single(node, path, out);
  if (!kv) return;
  const [k, v] = kv;
  if (LOGIC_KEYS.has(k)) {
    if (k === "not") return validateTrigger(v, `${path}.not`, out, refs);
    if (!Array.isArray(v)) return void out.push({ path: `${path}.${k}`, message: `'${k}' takes an array` });
    v.forEach((c, i) => validateTrigger(c, `${path}.${k}[${i}]`, out, refs));
    return;
  }
  if (SCOPES.has(k) || k === COUNTRY_SCOPE) return validateScopeBlock(k, v, `${path}.${k}`, out, refs, "trigger");
  if (!(k in TRIGGERS)) return void out.push({ path, message: `unknown trigger '${k}'` });
  checkArgs(TRIGGERS, k, v, path, out, refs);
}

export function validateEffects(list: unknown, path: string, out: ScriptIssue[], refs?: RefChecker): void {
  if (!Array.isArray(list)) return void out.push({ path, message: "effects must be an array" });
  list.forEach((node, i) => validateEffect(node, `${path}[${i}]`, out, refs));
}

function validateEffect(node: unknown, path: string, out: ScriptIssue[], refs?: RefChecker): void {
  const kv = single(node, path, out);
  if (!kv) return;
  const [k, v] = kv;
  if (k === "if") {
    const b = v as Record<string, unknown>;
    if (!b || typeof b !== "object") return void out.push({ path, message: "'if' takes { limit, then, else? }" });
    validateTrigger(b.limit, `${path}.if.limit`, out, refs);
    validateEffects(b.then, `${path}.if.then`, out, refs);
    if (b.else !== undefined) validateEffects(b.else, `${path}.if.else`, out, refs);
    return;
  }
  if (k === "random_list") {
    if (!Array.isArray(v)) return void out.push({ path, message: "'random_list' takes an array" });
    v.forEach((o, i) => {
      const e = o as Record<string, unknown>;
      if (typeof e?.weight !== "number") out.push({ path: `${path}.random_list[${i}]`, message: "entry needs numeric weight" });
      validateEffects(e?.effects, `${path}.random_list[${i}].effects`, out, refs);
    });
    return;
  }
  if (SCOPES.has(k) || k === COUNTRY_SCOPE) return validateScopeBlock(k, v, `${path}.${k}`, out, refs, "effect");
  if (!(k in EFFECTS)) return void out.push({ path, message: `unknown effect '${k}'` });
  checkArgs(EFFECTS, k, v, path, out, refs);
}

function validateScopeBlock(
  scope: string,
  v: unknown,
  path: string,
  out: ScriptIssue[],
  refs: RefChecker | undefined,
  mode: "trigger" | "effect",
): void {
  const b = v as Record<string, unknown>;
  if (!b || typeof b !== "object" || Array.isArray(b)) return void out.push({ path, message: "scope block must be an object" });
  if (scope === COUNTRY_SCOPE) {
    if (typeof b.tag !== "string") out.push({ path, message: "'country' scope needs a tag" });
    else if (refs && !refs("tag", b.tag)) out.push({ path: `${path}.tag`, message: `unknown tag '${b.tag}'` });
  }
  if (b.limit !== undefined) validateTrigger(b.limit, `${path}.limit`, out, refs);
  if (mode === "effect") validateEffects(b.effects, `${path}.effects`, out, refs);
  else validateTrigger(b.trigger, `${path}.trigger`, out, refs);
}
