/**
 * Non-state armed groups (ISIS, the Taliban insurgency, Hamas, the Donbas separatists, the Syrian opposition, ...).
 * Groups are defined in data/conflicts/armed_groups.json and put on the map only by script effects:
 *  - spawn_armed_group: the group takes real provinces (owner and controller) and fields divisions there; it
 *    fights the countries it took them from (or a given list) in limited wars that never end by exhaustion.
 *  - armed_group_loses: provinces go back to the country they were taken from (or to another side).
 *  - end_armed_group: the group is defeated (its land goes back, its units disband) or merges into a country
 *    (a takeover such as Kabul 2021, or an annexation).
 * While a group is at war, land changes hands with control: a group that captures a province holds it, and a
 * group province taken by an enemy goes back to its original country. A group with no land left is defeated.
 * Each province a group holds remembers the country it belonged to (`state.armedGroups.home`).
 */
import type { ContentDB } from "../../content/compile.ts";
import type { SimContext, System } from "../simulation.ts";
import type { GameState } from "../state.ts";
import { declareWar, hostile } from "../military/war.ts";
import { ordinal, templateNeeds } from "../military/military.ts";
import { blankCountry } from "../politics/unrest.ts";

export interface GroupRegion {
  from: string;
  adm1?: string[];
  provinces?: string[];
}

export const isArmedGroup = (state: GameState, tag: string): boolean => state.dynamicCountries[tag]?.kind === "armed_group";

const homeOf = (state: GameState, id: number): string => state.armedGroups.home[String(id)] ?? state.provinceOwner[id - 1]!;

/** Province ids (1-based) matching a region: held by `owner`, in the region's adm1 codes or named provinces (all if neither). */
function select(ctx: SimContext, r: GroupRegion, test: (id: number) => boolean): number[] {
  const codes = new Set(r.adm1 ?? []);
  const names = new Set(r.provinces ?? []);
  const all = !codes.size && !names.size;
  const out: number[] = [];
  for (const p of ctx.map?.provinces ?? []) {
    if (!test(p.id)) continue;
    if (all || p.adm1.some((c) => codes.has(c)) || (p.name !== undefined && names.has(p.name))) out.push(p.id);
  }
  return out;
}

/** Move a division to the nearest province its owner holds (breadth-first over land), or report none. */
function moveHome(ctx: SimContext, d: GameState["divisions"][number]): boolean {
  const { state, map } = ctx;
  const seen = new Set([d.province]);
  let frontier = [d.province];
  while (frontier.length) {
    const next: number[] = [];
    for (const p of frontier)
      for (const n of map?.neighbours.get(p) ?? []) {
        if (seen.has(n)) continue;
        seen.add(n);
        if (state.provinceController[n - 1] === d.owner) {
          d.province = n;
          d.path = [];
          d.attacking = undefined;
          d.progress = 0;
          return true;
        }
        next.push(n);
      }
    frontier = next;
  }
  const any = state.provinceController.findIndex((c) => c === d.owner);
  if (any < 0) return false;
  d.province = any + 1;
  d.path = [];
  d.attacking = undefined;
  return true;
}

/** Hand a province to a new holder; divisions of anyone now hostile to it leave. */
function setHolder(ctx: SimContext, id: number, tag: string): void {
  const { state } = ctx;
  state.provinceOwner[id - 1] = tag;
  state.provinceController[id - 1] = tag;
  const out: number[] = [];
  for (const d of state.divisions) if (d.province === id && d.owner !== tag && !moveHome(ctx, d)) out.push(d.id);
  if (out.length) state.divisions = state.divisions.filter((d) => !out.includes(d.id));
}

/** Fully equipped divisions of the group's template with the oldest equipment variants. */
function raise(ctx: SimContext, db: ContentDB, tag: string, count: number, provinces: number[]): void {
  const { state, map } = ctx;
  const def = db.armedGroups.get(tag);
  const tpl = db.militaryRules.templates.find((t) => t.id === def?.template) ?? db.militaryRules.templates[0];
  if (!tpl || !provinces.length || count <= 0) return;
  const byPop = [...provinces].sort((a, b) => (map?.provinces[b - 1]?.population ?? 0) - (map?.provinces[a - 1]?.population ?? 0));
  const equipment: Record<string, number> = {};
  for (const [family, n] of Object.entries(templateNeeds(db, tpl.units))) {
    const v = db.equipment.get(family)?.variants[0];
    if (v) equipment[v.id] = n;
  }
  let n = state.divisions.filter((d) => d.owner === tag).length;
  for (let i = 0; i < count; i++) {
    state.divisions.push({
      id: state.nextDivisionId++, owner: tag, name: `${ordinal(++n)} ${tpl.name}`, template: tpl.id, units: { ...tpl.units }, equipment: { ...equipment },
      province: byPop[i % byPop.length]!, path: [], progress: 0, strength: 1, organisation: 0.8, entrenchment: 0,
    });
  }
}

/** Create or extend a group on the map. Returns false when the group is unknown. */
export function spawnArmedGroup(ctx: SimContext, tag: string, regions: GroupRegion[], divisions: number, warWith?: string[]): boolean {
  const { db, state } = ctx;
  const def = db.armedGroups.get(tag);
  if (!def) return false;
  const isNew = !state.countries[tag];
  if (isNew) {
    const cs = blankCountry(tag, "insurgent_movement", state.day);
    state.countries[tag] = cs;
    state.dynamicCountries[tag] = { name: def.short_name ?? def.name, color: def.color, parent: regions[0]?.from ?? "", kind: "armed_group" };
  }
  const taken: number[] = [];
  for (const r of regions)
    for (const id of select(ctx, r, (p) => state.provinceOwner[p - 1] === r.from && r.from !== tag)) {
      state.armedGroups.home[String(id)] ??= state.provinceOwner[id - 1]!;
      setHolder(ctx, id, tag);
      taken.push(id);
    }
  const held = state.provinceOwner.flatMap((o, i) => (o === tag ? [i + 1] : []));
  raise(ctx, db, tag, divisions, taken.length ? taken : held);
  if (!held.length && !state.divisions.some((d) => d.owner === tag)) {
    // nothing to stand on: the group does not appear
    if (isNew) { delete state.countries[tag]; delete state.dynamicCountries[tag]; }
    return true;
  }
  for (const enemy of new Set(warWith ?? regions.map((r) => r.from))) {
    if (enemy === tag || !state.countries[enemy]?.active || hostile(state, tag, enemy)) continue;
    if (!state.provinceOwner.includes(enemy)) continue;
    declareWar(ctx, tag, enemy, "limited", false, true);
  }
  if (taken.length) ctx.log(tag, "civil_war", `${def.name} ${isNew ? "takes" : "gains"} ${taken.length} province${taken.length === 1 ? "" : "s"}`);
  ctx.emit({ type: "map_changed" });
  return true;
}

/** The group loses provinces to their original country (`from` names it) or to `to`. */
export function armedGroupLoses(ctx: SimContext, tag: string, regions: GroupRegion[], to?: string): void {
  const { db, state } = ctx;
  if (!state.countries[tag]) return;
  let lost = 0;
  for (const r of regions)
    for (const id of select(ctx, r, (p) => state.provinceOwner[p - 1] === tag && homeOf(state, p) === r.from)) {
      const dest = to ?? homeOf(state, id);
      if (dest === homeOf(state, id)) delete state.armedGroups.home[String(id)];
      setHolder(ctx, id, dest);
      lost++;
    }
  if (!lost) return;
  ctx.log(tag, "civil_war", `${db.armedGroups.get(tag)?.name ?? tag} loses ${lost} province${lost === 1 ? "" : "s"}`);
  if (!state.provinceOwner.includes(tag)) endArmedGroup(ctx, tag);
  ctx.emit({ type: "map_changed" });
}

/** End a group: defeated (land goes back, units disband) or merged into `into` (land and units pass to it). */
export function endArmedGroup(ctx: SimContext, tag: string, into?: string, disbandArmyOf?: string): void {
  const { db, state } = ctx;
  if (!state.countries[tag]) return;
  if (disbandArmyOf) state.divisions = state.divisions.filter((d) => d.owner !== disbandArmyOf);
  for (let i = 0; i < state.provinceOwner.length; i++) {
    if (state.provinceOwner[i] === tag) {
      const dest = into ?? homeOf(state, i + 1);
      delete state.armedGroups.home[String(i + 1)];
      state.provinceOwner[i] = dest;
      state.provinceController[i] = dest;
    } else if (state.provinceController[i] === tag) state.provinceController[i] = state.provinceOwner[i]!;
  }
  if (into) for (const d of state.divisions) { if (d.owner === tag) { d.owner = into; d.path = []; d.attacking = undefined; } }
  else state.divisions = state.divisions.filter((d) => d.owner !== tag);
  // leave every war; a side left empty ends that war
  for (const w of state.wars) {
    w.attackers = w.attackers.filter((t) => t !== tag);
    w.defenders = w.defenders.filter((t) => t !== tag);
  }
  state.wars = state.wars.filter((w) => w.attackers.length && w.defenders.length);
  state.battles = state.battles.filter((b) => b.attackerTag !== tag && b.defenderTag !== tag);
  const name = db.armedGroups.get(tag)?.name ?? tag;
  delete state.countries[tag];
  delete state.dynamicCountries[tag];
  ctx.log(into ?? null, "civil_war", into ? `${name} takes power` : `${name} is defeated and holds no territory`);
  ctx.emit({ type: "map_changed" });
}

/** Land follows control in group wars; groups without land are defeated. */
export const armedGroupSystem: System = {
  id: "armed_groups",
  daily(ctx) {
    const { state } = ctx;
    const groups = Object.keys(state.dynamicCountries).filter((t) => isArmedGroup(state, t));
    if (!groups.length) return;
    const g = new Set(groups);
    let changed = false;
    for (let i = 0; i < state.provinceOwner.length; i++) {
      const o = state.provinceOwner[i]!, c = state.provinceController[i]!;
      if (o === c) continue;
      const id = i + 1;
      if (g.has(o) && hostile(state, o, c)) {
        // a group province taken by an enemy: back to its original country, held by the captor
        const home = homeOf(state, id);
        delete state.armedGroups.home[String(id)];
        state.provinceOwner[i] = g.has(c) ? c : home;
        if (g.has(c)) state.armedGroups.home[String(id)] = home;
        if (!hostile(state, c, state.provinceOwner[i]!)) state.provinceController[i] = state.provinceOwner[i]!;
        changed = true;
      } else if (g.has(c) && hostile(state, o, c)) {
        // a group captured the province: it holds it
        state.armedGroups.home[String(id)] ??= o;
        state.provinceOwner[i] = c;
        changed = true;
      }
    }
    if (changed) ctx.emit({ type: "map_changed" });
  },
  monthly(ctx) {
    const { state } = ctx;
    for (const t of Object.keys(state.dynamicCountries))
      if (isArmedGroup(state, t) && !state.provinceOwner.includes(t)) endArmedGroup(ctx, t);
  },
};
