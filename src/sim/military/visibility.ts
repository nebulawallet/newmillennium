/**
 * Which foreign divisions a country can see (fog of war on the map): its own; those of countries it
 * is at war with; its allies' (optional); and any division in its own territory or within the radius
 * of one of its radar stations (buildings with `detection_radius_km`). Pure: the UI asks it per frame.
 */
import type { ContentDB } from "../../content/compile.ts";
import type { GameState } from "../state.ts";
import type { Division } from "./military.ts";

/** The part of the map visibility needs: province ids and centroids. */
export interface MapLike { provinces: readonly { id: number; centroid?: [number, number] }[] }

const EARTH_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
/** Great-circle distance between two [lon, lat] points in km. */
export function distanceKm(a: [number, number], b: [number, number]): number {
  const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Countries allied with `tag`: a shared military bloc, an overlord or subject, or the same side of a war. */
export function alliesOf(db: ContentDB, state: GameState, tag: string): Set<string> {
  const out = new Set<string>();
  for (const [bloc, members] of Object.entries(state.diplomacy.blocs)) {
    if (db.blocs.get(bloc)?.kind !== "military" || !members.includes(tag)) continue;
    for (const m of members) out.add(m);
  }
  for (const [sub, over] of Object.entries(state.subjects)) {
    if (sub === tag) out.add(over);
    if (over === tag) out.add(sub);
  }
  for (const w of state.wars) {
    if (w.attackers.includes(tag)) for (const t of w.attackers) out.add(t);
    if (w.defenders.includes(tag)) for (const t of w.defenders) out.add(t);
  }
  out.delete(tag);
  return out;
}

/** Countries at war with `tag`. */
export function enemiesOf(state: GameState, tag: string): Set<string> {
  const out = new Set<string>();
  for (const w of state.wars) {
    if (w.attackers.includes(tag)) for (const t of w.defenders) out.add(t);
    if (w.defenders.includes(tag)) for (const t of w.attackers) out.add(t);
  }
  return out;
}

/** Provinces a country's radar stations cover. */
export function radarCoverage(db: ContentDB, state: GameState, map: MapLike | undefined, tag: string): Set<number> {
  const out = new Set<number>();
  const radars = [...db.buildings.values()].filter((b) => (b.detection_radius_km ?? 0) > 0);
  if (!radars.length || !map) return out;
  const sites: { at: [number, number]; km: number }[] = [];
  for (const [pid, built] of Object.entries(state.provinceBuildings)) {
    const id = Number(pid);
    if (state.provinceOwner[id - 1] !== tag) continue;
    const c = map.provinces[id - 1]?.centroid;
    if (!c) continue;
    for (const b of radars) if ((built[b.id] ?? 0) > 0) sites.push({ at: c, km: b.detection_radius_km! });
  }
  if (!sites.length) return out;
  for (const p of map.provinces) {
    if (!p.centroid) continue;
    if (sites.some((s) => distanceKm(s.at, p.centroid!) <= s.km)) out.add(p.id);
  }
  return out;
}

export interface VisibilityOptions {
  /** Show allied divisions (a map toggle). */
  showAllies: boolean;
}

/** A test for whether `viewer` can see a division. With no viewer (spectating) everything is visible. */
export function divisionVisibility(db: ContentDB, state: GameState, map: MapLike | undefined, viewer: string | null, opts: VisibilityOptions): (d: Division) => boolean {
  if (!viewer) return () => true;
  const allies = alliesOf(db, state, viewer);
  const enemies = enemiesOf(state, viewer);
  const radar = radarCoverage(db, state, map, viewer);
  return (d) => {
    if (d.owner === viewer) return true;
    if (enemies.has(d.owner)) return true;
    if (allies.has(d.owner)) return opts.showAllies;
    const owner = state.provinceOwner[d.province - 1];
    if (owner === viewer || state.provinceController[d.province - 1] === viewer) return true;
    return radar.has(d.province);
  };
}
