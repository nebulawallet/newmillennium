/**
 * Wars, battles and peace (Phase 10).
 *  - A war has two sides; divisions may enter enemy territory and occupy provinces they reach.
 *  - Divisions ordered into a province held by enemy divisions attack from their border province.
 *    Each day both sides deal damage: attack (soft against soft targets, hard against armour,
 *    halved when piercing is below the target's armour) against defence (or breakthrough when
 *    attacking), with terrain, entrenchment, air superiority and organisation. Only divisions up
 *    to the combat width fight. A side whose organisation collapses retreats (or is destroyed).
 *  - Supply: each province supplies a few divisions (more with infrastructure, half in enemy
 *    territory); divisions beyond that lose strength.
 *  - War support falls each month. A side capitulates when its enemies hold most of its
 *    population; exhausted sides make a white peace. Winners take what they occupy (conquest).
 */
import type { ContentDB } from "../../content/compile.ts";
import { riverBetween, type SimContext, type System } from "../simulation.ts";
import type { CountryState, GameState, War } from "../state.ts";
import { clamp, countryModifiers } from "../politics/common.ts";
import { justification, onWarDeclared } from "../diplomacy/diplomacy.ts";
import { capitalProvince, templateNeeds, templateStats, type Division } from "./military.ts";
import { afterPeace, aiTerms, capitulated, concludePeace, type PeaceTerm } from "./peace.ts";

export interface Battle {
  province: number;
  attackers: number[];
  defenders: number[];
  attackerTag: string;
  defenderTag: string;
  startDay: number;
  /** 0..1: how far the attackers are toward winning (0.5 = even), from both sides' organisation. */
  progress?: number;
  /** Average organisation of each side when the battle began. */
  attackerOrg0?: number;
  defenderOrg0?: number;
  /** Provinces the attack comes from (more than one: a flanking bonus). */
  directions?: number;
  /** The day's modifiers, for the tooltip. */
  terrain?: string;
  terrainBonus?: number;
  entrenchment?: number;
  flanking?: number;
  air?: number;
  supply?: { attacker: number; defender: number };
  /** Manpower lost so far by each side. */
  casualties?: { attacker: number; defender: number };
  /** A river the attack crosses (and how many attacking divisions cross it). */
  river?: { name: string; crossing: number };
}

/** conquest: the winner keeps what it holds; status_quo: control returns; limited: the attacker aims only at land near its border and no side capitulates. */
export type WarGoal = "conquest" | "status_quo" | "limited";

/** How far (in provinces) beyond its own border an attacker in a limited war advances. */
export const LIMITED_WAR_DEPTH = 2;

/** Provinces of the target within `depth` steps of the attacker's own territory. */
function limitedZone(ctx: SimContext, attacker: string, target: string, depth: number): number[] {
  const { state, map } = ctx;
  if (!map) return [];
  let frontier = new Set<number>();
  state.provinceOwner.forEach((o, i) => { if (o === attacker) frontier.add(i + 1); });
  const zone = new Set<number>();
  for (let d = 0; d < depth; d++) {
    const next = new Set<number>();
    for (const p of frontier)
      for (const n of map.neighbours.get(p) ?? [])
        if (state.provinceOwner[n - 1] === target && !zone.has(n)) { zone.add(n); next.add(n); }
    frontier = next;
  }
  return [...zone].sort((a, b) => a - b);
}

// ------------------------------------------------------------------ sides

export function warsOf(state: GameState, tag: string): War[] {
  return state.wars.filter((w) => w.attackers.includes(tag) || w.defenders.includes(tag));
}

/** Are these two countries enemies (in a war or a civil war)? */
export function hostile(state: GameState, a: string, b: string): boolean {
  if (a === b) return false;
  if (state.countries[a]?.civilWar?.rebel === b || state.countries[b]?.civilWar?.rebel === a) return true;
  return state.wars.some((w) => (w.attackers.includes(a) && w.defenders.includes(b)) || (w.defenders.includes(a) && w.attackers.includes(b)));
}

// ------------------------------------------------------------------ division stats

export interface DivisionStats {
  soft: number;
  hard: number;
  defence: number;
  breakthrough: number;
  armour: number;
  piercing: number;
  airAttack: number;
  hardness: number;
  width: number;
}

/** Combat stats of a division from the equipment it actually holds (best variants weighted by count). */
export function divisionStats(db: ContentDB, d: Division): DivisionStats {
  const out: DivisionStats = { soft: 0, hard: 0, defence: 0, breakthrough: 0, armour: 0, piercing: 0, airAttack: 0, hardness: 0, width: templateStats(db, d.units).width };
  let armoured = 0, total = 0, maxArmour = 0, maxPiercing = 0;
  for (const [family, need] of Object.entries(templateNeeds(db, d.units))) {
    const fam = db.equipment.get(family);
    if (!fam) continue;
    let held = 0;
    const acc = { soft: 0, hard: 0, defence: 0, breakthrough: 0, armour: 0, piercing: 0, air: 0 };
    for (const v of fam.variants) {
      const n = d.equipment[v.id] ?? 0;
      if (!n) continue;
      held += n;
      acc.soft += v.stats.soft_attack * n;
      acc.hard += v.stats.hard_attack * n;
      acc.defence += v.stats.defence * n;
      acc.breakthrough += v.stats.breakthrough * n;
      acc.air += v.stats.air_attack * n;
      if (v.stats.armour > 0) armoured += n;
      maxArmour = Math.max(maxArmour, v.stats.armour);
      maxPiercing = Math.max(maxPiercing, v.stats.piercing);
    }
    total += Math.min(held, need);
    const used = Math.min(held, need) / Math.max(1, held);
    out.soft += acc.soft * used;
    out.hard += acc.hard * used;
    out.defence += acc.defence * used;
    out.breakthrough += acc.breakthrough * used;
    out.airAttack += acc.air * used;
  }
  for (const k of ["soft", "hard", "defence", "breakthrough", "airAttack"] as const) out[k] /= 100;
  out.hardness = total ? armoured / total : 0;
  out.armour = maxArmour;
  out.piercing = maxPiercing;
  return out;
}

/** Air power of a country: fighters and drones in its stockpile. */
export function airPower(db: ContentDB, cs: CountryState): number {
  let p = 0;
  for (const f of db.equipment.values()) {
    if (f.domain !== "air") continue;
    for (const v of f.variants) p += (cs.military?.stockpile[v.id] ?? 0) * (v.stats.air_attack + v.stats.soft_attack * 0.5);
  }
  return p * (1 + (countryModifiers(db, cs).air_effectiveness ?? 0));
}

// ------------------------------------------------------------------ commands

export function declareWar(ctx: SimContext, tag: string, target: string, goal: WarGoal = "conquest", requireJustification = false, scripted = false, zone?: number[]): { ok: boolean; text: string } {
  const { db, state } = ctx;
  if (tag === target) return { ok: false, text: "A country cannot declare war on itself." };
  const a = state.countries[tag], b = state.countries[target];
  if (!a?.active || !b?.active) return { ok: false, text: "Unknown country." };
  if (hostile(state, tag, target)) return { ok: false, text: "Already at war." };
  if (state.subjects[tag] === target || state.subjects[target] === tag) return { ok: false, text: "A puppet and its overlord cannot go to war with each other." };
  const rules = db.warRules;
  const j = justification(state, tag, target);
  // historical wars started by events carry no justification penalty
  const justified = scripted || (!!j && j.done <= state.day);
  if (requireJustification && !justified) return { ok: false, text: j ? "The war goal is still being justified." : "Justify a war goal first." };
  const name = `${countryShort(db, state, tag)}–${countryShort(db, state, target)} war`;
  const id = state.nextWarId++;
  // wars with an armed group (src/sim/conflicts) call in no allies and never end by exhaustion
  const group = state.dynamicCountries[tag]?.kind === "armed_group" || state.dynamicCountries[target]?.kind === "armed_group";
  // puppets follow their overlords into the war
  const puppets = (t: string) => Object.entries(state.subjects ?? {}).filter(([s, o]) => o === t && state.countries[s]?.active).map(([s]) => s);
  state.wars.push({ id, name, attackers: [tag, ...puppets(tag)], defenders: [target, ...puppets(target)], startDay: state.day, goal, ...(goal === "limited" ? { zone: zone ?? limitedZone(ctx, tag, target, LIMITED_WAR_DEPTH) } : {}), ...(group ? { armedGroup: true } : {}), ...(scripted ? { scripted: true } : {}) });
  const nuclear = rules.nuclear_states_2000.includes(target) || rules.nuclear_states_2000.includes(tag);
  state.worldTension = clamp(state.worldTension + rules.tension_per_war * (nuclear ? rules.nuclear_tension_multiplier : 1) * (justified ? 1 : db.diplomacyRules.unjustified_tension_multiplier), 0, 1);
  a.warSupport = clamp(a.warSupport - 0.05, 0, 1);
  b.warSupport = clamp(Math.max(b.warSupport + 0.15, rules.defender_rally), 0, 1);
  // a war the player or AI chooses leaves history; a historical war started by an event is history
  if (!scripted) {
    a.followsHistory = false;
    b.followsHistory = false;
  }
  ctx.log(tag, "war", `Declares war on ${countryShort(db, state, target)}${justified ? "" : " without a justification"}`);
  if (!group) onWarDeclared(ctx, id, tag, target, justified, scripted);
  ctx.emit({ type: "map_changed" });
  return { ok: true, text: `War declared on ${countryShort(db, state, target)}.` };
}

const countryShort = (db: ContentDB, state: GameState, tag: string) =>
  state.dynamicCountries[tag]?.name ?? db.countryList.find((c) => c.tag === tag)?.short_name ?? db.countries.get(tag)?.country?.name.en ?? db.countryList.find((c) => c.tag === tag)?.name ?? tag;

// ------------------------------------------------------------------ peace

function provincePopulation(ctx: SimContext, id: number): number {
  return ctx.map?.provinces[id - 1]?.population ?? 1;
}

/** Share of a country's population held by its enemies. */
export function occupiedShare(ctx: SimContext, tag: string): number {
  let own = 0, lost = 0;
  ctx.state.provinceOwner.forEach((o, i) => {
    if (o !== tag) return;
    const pop = provincePopulation(ctx, i + 1);
    own += pop;
    const c = ctx.state.provinceController[i]!;
    if (c !== tag && hostile(ctx.state, tag, c)) lost += pop;
  });
  return own ? lost / own : 0;
}

export interface SideStatus {
  /** 0..100: occupation of the other side (60%), its share of the casualties (20%) and battles won (20%). */
  score: number;
  /** Enemy provinces and population this side holds. */
  provinces: number;
  population: number;
  casualties: number;
  victories: number;
  /** Share of the side leader's own population the enemy holds. */
  occupied: number;
}

/** Where a war stands, for each side. */
export function warStatus(ctx: SimContext, war: War): { attackers: SideStatus; defenders: SideStatus } {
  const { state } = ctx;
  const held = (side: string[], other: string[]) => {
    let provinces = 0, population = 0;
    for (let i = 0; i < state.provinceOwner.length; i++) {
      const o = state.provinceOwner[i]!, c = state.provinceController[i]!;
      if (other.includes(o) && side.includes(c)) { provinces++; population += provincePopulation(ctx, i + 1); }
    }
    return { provinces, population };
  };
  const pop = (side: string[]) => {
    let p = 0;
    for (let i = 0; i < state.provinceOwner.length; i++) if (side.includes(state.provinceOwner[i]!)) p += provincePopulation(ctx, i + 1);
    return Math.max(1, p);
  };
  const cas = war.casualties ?? { attackers: 0, defenders: 0 };
  const vic = war.victories ?? { attackers: 0, defenders: 0 };
  const side = (me: "attackers" | "defenders"): SideStatus => {
    const them = me === "attackers" ? "defenders" : "attackers";
    const h = held(war[me], war[them]);
    const occ = h.population / pop(war[them]);
    const casShare = cas[me] + cas[them] > 0 ? cas[them] / (cas[me] + cas[them]) : 0.5;
    const vicShare = vic[me] + vic[them] > 0 ? vic[me] / (vic[me] + vic[them]) : 0.5;
    return { score: Math.round(Math.min(1, occ / ctx.db.warRules.capitulation_share) * 60 + casShare * 20 + vicShare * 20), ...h, casualties: cas[me], victories: vic[me], occupied: occupiedShare(ctx, war[me][0]!) };
  };
  return { attackers: side("attackers"), defenders: side("defenders") };
}

/** End a war. `winner` takes the provinces its side occupies when the goal is conquest; otherwise control returns. */
export function makePeace(ctx: SimContext, war: War, winner: "attackers" | "defenders" | null, annex: boolean): void {
  const { state } = ctx;
  const winners = winner === "attackers" ? war.attackers : winner === "defenders" ? war.defenders : [];
  const losers = winner === "attackers" ? war.defenders : winner === "defenders" ? war.attackers : [];
  const sides = new Set([...war.attackers, ...war.defenders]);
  for (let i = 0; i < state.provinceOwner.length; i++) {
    const o = state.provinceOwner[i]!, c = state.provinceController[i]!;
    if (o === c || !sides.has(o) || !sides.has(c)) continue;
    if (annex && winners.includes(c) && losers.includes(o)) state.provinceOwner[i] = c;
    else state.provinceController[i] = o;
  }
  // divisions left in foreign territory go home
  const homes = new Map<string, number>();
  for (const d of state.divisions) {
    if (!sides.has(d.owner)) continue;
    const here = state.provinceOwner[d.province - 1];
    if (here && here !== d.owner) {
      if (!homes.has(d.owner)) homes.set(d.owner, capitalProvince(state, ctx.map, d.owner));
      const home = homes.get(d.owner)!;
      if (home >= 1) d.province = home;
      d.path = [];
      d.attacking = undefined;
    }
  }
  state.wars = state.wars.filter((w) => w.id !== war.id);
  for (const t of sides) {
    const cs = state.countries[t];
    if (!cs) continue;
    cs.warSupport = clamp(cs.warSupport * 0.6, 0, 1);
    if (winners.includes(t)) cs.stability = clamp(cs.stability + 0.05, 0, 1);
    if (losers.includes(t)) cs.stability = clamp(cs.stability - 0.1, 0, 1);
  }
  if (state.pendingPeace?.war === war.id) state.pendingPeace = null;
  const who = winners.map((t) => countryShort(ctx.db, state, t)).join(", ");
  const one = winners.length === 1;
  const terms = !winner ? "a white peace" : annex ? `${who} ${one ? "annexes" : "annex"} the occupied provinces` : `${who} ${one ? "prevails" : "prevail"}; occupied provinces are returned`;
  ctx.log(null, "war", `The ${war.name} ends: ${terms}`);
  ctx.emit({ type: "map_changed" });
}

// ------------------------------------------------------------------ daily combat

function terrainOf(ctx: SimContext, province: number): string {
  return (ctx.map?.provinces[province - 1] as { terrain?: string } | undefined)?.terrain ?? "plains";
}

/** Divisions of one side that fit in the combat width. */
function frontline(db: ContentDB, ds: Division[], width: number): Division[] {
  const out: Division[] = [];
  let w = 0;
  for (const d of [...ds].sort((a, b) => b.organisation * b.strength - a.organisation * a.strength)) {
    const dw = Math.max(1, templateStats(db, d.units).width);
    if (w + dw > width && out.length) break;
    out.push(d);
    w += dw;
  }
  return out;
}

function sideAttack(db: ContentDB, ds: Division[], targetHardness: number, targetArmour: number, bonus: number, mods: (d: Division) => number): number {
  let total = 0;
  for (const d of ds) {
    const s = divisionStats(db, d);
    const pierce = s.piercing >= targetArmour ? 1 : db.warRules.armour_penalty;
    total += (s.soft * (1 - targetHardness) + s.hard * targetHardness) * pierce * (0.4 + 0.6 * d.organisation) * d.strength * (1 + mods(d));
  }
  return total * (1 + bonus);
}

/**
 * Retreat a beaten division to a friendly neighbouring province (the one least exposed to the
 * enemy), or destroy it if it has none (encircled).
 */
function retreat(ctx: SimContext, d: Division, from: number): boolean {
  const { state, map } = ctx;
  const friendly = (c: string | undefined) => !!c && (c === d.owner || (!hostile(state, d.owner, c) && state.wars.some((w) => (w.attackers.includes(d.owner) && w.attackers.includes(c)) || (w.defenders.includes(d.owner) && w.defenders.includes(c)))));
  const options = (map?.neighbours.get(from) ?? []).filter((p) => friendly(state.provinceController[p - 1]) && !state.divisions.some((x) => x.province === p && hostile(state, x.owner, d.owner)));
  d.path = [];
  d.attacking = undefined;
  d.progress = 0;
  d.entrenchment = 0;
  if (!options.length) return false;
  const exposure = (p: number) => (map?.neighbours.get(p) ?? []).filter((n) => { const c = state.provinceController[n - 1]; return !!c && hostile(state, d.owner, c); }).length;
  d.province = options.sort((a, b) => exposure(a) - exposure(b))[0]!;
  return true;
}

/** Divisions of `owner` in a province against what it can supply (1 = in supply, below = short). */
function supplyFactor(ctx: SimContext, province: number, owner: string, count: number): number {
  const r = ctx.db.warRules;
  const p = ctx.map?.provinces[province - 1] as { infrastructure?: number } | undefined;
  const infra = (p?.infrastructure ?? 3) + (ctx.state.provinceBuildings[String(province)]?.infrastructure ?? 0);
  const own = ctx.state.provinceController[province - 1] === owner;
  const cap = (r.supply_base + r.supply_per_infrastructure * infra) * (own ? 1 : 0.5);
  return count <= cap ? 1 : Math.max(0.3, cap / count);
}

/** Manpower of a division at full strength. */
function divisionManpower(db: ContentDB, d: Division): number {
  return templateStats(db, d.units).manpower;
}

/** The war in which two countries face each other, and which side `tag` is on. */
function warBetween(state: GameState, tag: string, other: string): { war: War; side: "attackers" | "defenders" } | null {
  for (const w of state.wars) {
    if (w.attackers.includes(tag) && w.defenders.includes(other)) return { war: w, side: "attackers" };
    if (w.defenders.includes(tag) && w.attackers.includes(other)) return { war: w, side: "defenders" };
  }
  return null;
}

export const warSystem: System = {
  id: "war",
  daily(ctx) {
    const { db, state, map, rng } = ctx;
    if (!state.wars.length && !Object.values(state.countries).some((c) => c.civilWar)) {
      state.battles = [];
      return;
    }
    const rules = db.warRules;
    const modCache = new Map<string, Record<string, number>>();
    const mods = (tag: string) => {
      let m = modCache.get(tag);
      if (!m) modCache.set(tag, (m = state.countries[tag] ? countryModifiers(db, state.countries[tag]!) : {}));
      return m;
    };
    const airCache = new Map<string, number>();
    const air = (tag: string) => {
      let a = airCache.get(tag);
      if (a === undefined) airCache.set(tag, (a = state.countries[tag] ? airPower(db, state.countries[tag]!) : 0));
      return a;
    };

    // battles: attackers grouped by the province they attack
    const byTarget = new Map<number, Division[]>();
    for (const d of state.divisions) if (d.attacking) byTarget.set(d.attacking, [...(byTarget.get(d.attacking) ?? []), d]);
    const battles: Battle[] = [];
    const stackCount = new Map<string, number>();
    if (byTarget.size) for (const d of state.divisions) stackCount.set(`${d.province}:${d.owner}`, (stackCount.get(`${d.province}:${d.owner}`) ?? 0) + 1);
    for (const [province, attackersAll] of byTarget) {
      const attackerTag = attackersAll[0]!.owner;
      const defendersAll = state.divisions.filter((d) => d.province === province && hostile(state, d.owner, attackerTag));
      if (!defendersAll.length) {
        // nobody left to fight: the attackers move in
        for (const a of attackersAll) a.attacking = undefined;
        continue;
      }
      const attackers = frontline(db, attackersAll, rules.combat_width);
      const defenders = frontline(db, defendersAll, rules.combat_width);
      const defenderTag = defenders[0]!.owner;
      const prev = state.battles.find((b) => b.province === province);
      const avgOrg = (ds: Division[]) => ds.reduce((s, d) => s + d.organisation, 0) / Math.max(1, ds.length);
      // flanking: attacking from more provinces at once spreads the defence
      const directions = new Set(attackers.map((d) => d.province)).size;
      const flank = Math.min(rules.max_flanking_bonus, (directions - 1) * rules.flanking_bonus_per_direction);
      // supply: divisions over what their province supplies fight worse (as well as losing strength)
      const countAt = (p: number, tag: string) => stackCount.get(`${p}:${tag}`) ?? 0;
      const supplyOf = (d: Division) => supplyFactor(ctx, d.province, d.owner, countAt(d.province, d.owner));
      const aSupply = attackers.reduce((s, d) => s + supplyOf(d), 0) / attackers.length;
      const dSupply = defenders.reduce((s, d) => s + supplyOf(d), 0) / defenders.length;
      const battle: Battle = {
        province, attackers: attackers.map((d) => d.id), defenders: defenders.map((d) => d.id), attackerTag, defenderTag,
        startDay: prev?.startDay ?? state.day,
        attackerOrg0: prev?.attackerOrg0 ?? avgOrg(attackers), defenderOrg0: prev?.defenderOrg0 ?? avgOrg(defenders),
        directions, flanking: flank, supply: { attacker: aSupply, defender: dSupply },
        casualties: { attacker: prev?.casualties?.attacker ?? 0, defender: prev?.casualties?.defender ?? 0 },
      };
      battles.push(battle);

      const aStats = attackers.map((d) => divisionStats(db, d));
      const dStats = defenders.map((d) => divisionStats(db, d));
      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
      const aHard = avg(aStats.map((s) => s.hardness)), dHard = avg(dStats.map((s) => s.hardness));
      const aArmour = avg(aStats.map((s) => s.armour)), dArmour = avg(dStats.map((s) => s.armour));
      const ap = air(attackerTag), dp = air(defenderTag);
      const superiority = ap + dp > 0 ? (ap - dp) / (ap + dp) : 0;
      const terrain = rules.terrain_defence[terrainOf(ctx, province)] ?? 0;
      battle.terrain = terrainOf(ctx, province);
      battle.terrainBonus = terrain;
      battle.entrenchment = defenders.reduce((s, d) => s + d.entrenchment, 0) / defenders.length;
      battle.air = rules.air_superiority_bonus * superiority;

      const supplyHit = (f: number) => (f - 1) * rules.out_of_supply_combat_penalty;
      // river crossings: divisions attacking across a river on the border hit less hard
      const river = (d: Division) => riverBetween(map, d.province, province);
      const crossing = attackers.filter((d) => river(d));
      if (crossing.length) battle.river = { name: river(crossing[0]!)!, crossing: crossing.length };
      const aAttack = sideAttack(db, attackers, dHard, dArmour, rules.air_superiority_bonus * superiority + flank + supplyHit(aSupply), (d) => (mods(d.owner).army_attack ?? 0) - (river(d) ? rules.river_crossing_penalty : 0));
      const dAttack = sideAttack(db, defenders, aHard, aArmour, -rules.air_superiority_bonus * superiority + supplyHit(dSupply), (d) => mods(d.owner).army_attack ?? 0);
      const dDefence = defenders.reduce((s, d, i) => s + dStats[i]!.defence * d.strength * (1 + terrain + d.entrenchment) * (1 + (mods(d.owner).army_defence ?? 0)), 0);
      const aResist = attackers.reduce((s, d, i) => s + (aStats[i]!.breakthrough + 0.4 * aStats[i]!.defence) * d.strength * (1 + (mods(d.owner).army_defence ?? 0)), 0);
      const rD = aAttack / Math.max(1, dDefence), rA = dAttack / Math.max(1, aResist);
      for (const d of [...attackers, ...defenders]) d.lastCombat = state.day;
      let aLost = 0, dLost = 0;
      for (const d of defenders) {
        const j = 0.8 + 0.4 * rng.next();
        d.organisation = clamp(d.organisation - rules.org_damage * 5 * rD * j, 0, 1);
        const before = d.strength;
        d.strength = clamp(d.strength - rules.strength_damage * 5 * rD * j, 0, 1);
        dLost += (before - d.strength) * divisionManpower(db, d);
      }
      for (const d of attackers) {
        const j = 0.8 + 0.4 * rng.next();
        d.organisation = clamp(d.organisation - rules.org_damage * 5 * rA * j, 0, 1);
        const before = d.strength;
        d.strength = clamp(d.strength - rules.strength_damage * 5 * rA * j, 0, 1);
        aLost += (before - d.strength) * divisionManpower(db, d);
      }
      battle.casualties!.attacker += aLost;
      battle.casualties!.defender += dLost;
      const wb = warBetween(state, attackerTag, defenderTag);
      if (wb) {
        const c = (wb.war.casualties ??= { attackers: 0, defenders: 0 });
        c[wb.side] += aLost;
        c[wb.side === "attackers" ? "defenders" : "attackers"] += dLost;
      }
      // progress: each side's organisation left against where it began
      const aLeft = avgOrg(attackers) / Math.max(0.01, battle.attackerOrg0!), dLeft = avgOrg(defenders) / Math.max(0.01, battle.defenderOrg0!);
      battle.progress = clamp(0.5 + (aLeft - dLeft) / 2, 0, 1);
      // collapse: defenders retreat or are destroyed; attackers break off
      const beaten = defenders.filter((x) => x.organisation < 0.05 || x.strength < 0.05);
      if (wb && beaten.length === defenders.length && defendersAll.length === defenders.length) {
        const v = (wb.war.victories ??= { attackers: 0, defenders: 0 });
        v[wb.side]++;
      }
      for (const d of beaten) {
        if (!retreat(ctx, d, province)) {
          state.divisions = state.divisions.filter((x) => x.id !== d.id);
          ctx.log(d.owner, "war", `${d.name} destroyed`);
        }
      }
      for (const d of attackers.filter((x) => x.organisation < 0.05)) {
        d.attacking = undefined;
        d.path = [];
      }
    }
    state.battles = battles;

    // supply: divisions beyond what a province can supply lose strength
    if (map) {
      const count = new Map<number, number>();
      for (const d of state.divisions) count.set(d.province, (count.get(d.province) ?? 0) + 1);
      for (const d of state.divisions) {
        const p = map.provinces[d.province - 1] as { infrastructure?: number } | undefined;
        const infra = (p?.infrastructure ?? 3) + (state.provinceBuildings[String(d.province)]?.infrastructure ?? 0);
        const own = state.provinceController[d.province - 1] === d.owner;
        const cap = (rules.supply_base + rules.supply_per_infrastructure * infra) * (own ? 1 : 0.5);
        if ((count.get(d.province) ?? 0) > cap) d.strength = Math.max(0.05, d.strength - rules.out_of_supply_attrition);
      }
    }
  },
  monthly(ctx) {
    const { db, state } = ctx;
    const rules = db.warRules;
    state.worldTension = Math.max(0, state.worldTension - rules.tension_decay);
    for (const war of [...state.wars]) {
      const aLead = war.attackers[0]!, dLead = war.defenders[0]!;
      // exhaustion, offset by success: the share of the enemy leader's population held
      const aHeld = occupiedShare(ctx, dLead), dHeld = occupiedShare(ctx, aLead);
      for (const t of war.attackers) {
        const cs = state.countries[t];
        if (cs) cs.warSupport = clamp(cs.warSupport - rules.war_exhaustion_monthly + rules.occupation_war_support * aHeld, 0, 1);
      }
      for (const t of war.defenders) {
        const cs = state.countries[t];
        if (cs) cs.warSupport = clamp(cs.warSupport - rules.war_exhaustion_monthly + rules.occupation_war_support * dHeld, 0, 1);
      }
      // capitulation: the player's side picks terms at a conference; the AI imposes terms on the
      // player; AI wars among themselves end as before (conquest keeps what is held)
      const loser = capitulated(ctx, war, "defenders") ? "defenders" : capitulated(ctx, war, "attackers") ? "attackers" : null;
      if (loser) {
        const winner = loser === "defenders" ? "attackers" : "defenders";
        const p = state.player ?? "";
        if (war[winner].includes(p)) {
          state.pendingPeace = { war: war.id, winner };
          ctx.emit({ type: "coalition_needed", tag: p });
        } else if (war[loser].includes(p)) {
          const r = concludePeace(ctx, war, winner, aiTerms(ctx, war, winner), war[winner][0]!);
          ctx.emit({ type: "peace", tag: p, title: `${war.name}: your side capitulated`, lines: r.lines.length ? r.lines : ["Peace without territorial change."] });
        } else {
          makePeace(ctx, war, winner, war.goal === "conquest" && winner === "attackers");
          afterPeace(ctx);
        }
        continue;
      }
      const aWs = state.countries[aLead]?.warSupport ?? 0, dWs = state.countries[dLead]?.warSupport ?? 0;
      const months = (state.day - war.startDay) / 30;
      const held = war.armedGroup || (war.scripted && state.rules.electionMode === "historical");
      if (!held && months >= rules.white_peace_min_months && Math.min(aWs, dWs) <= rules.white_peace_war_support) {
        makePeace(ctx, war, null, false);
        afterPeace(ctx);
      }
    }
  },
};

/** The player's choice at a peace conference they won (annex = take the land they hold). */
export function choosePeace(ctx: SimContext, annex: boolean): { ok: boolean; text: string } {
  const p = ctx.state.pendingPeace;
  const war = p ? ctx.state.wars.find((w) => w.id === p.war) : undefined;
  if (!p || !war) return { ok: false, text: "No peace conference is open." };
  makePeace(ctx, war, p.winner, annex);
  afterPeace(ctx);
  return { ok: true, text: annex ? "The occupied provinces are annexed." : "Peace signed; occupied provinces are returned." };
}

/** The player's terms at a peace conference they won. */
export function signPeace(ctx: SimContext, terms: PeaceTerm[]): { ok: boolean; text: string } {
  const p = ctx.state.pendingPeace;
  const war = p ? ctx.state.wars.find((w) => w.id === p.war) : undefined;
  if (!p || !war || !ctx.state.player) return { ok: false, text: "No peace conference is open." };
  const r = concludePeace(ctx, war, p.winner, terms, ctx.state.player);
  if (r.ok) ctx.state.pendingPeace = null;
  return { ok: r.ok, text: r.text };
}

export { warsOf as wars };
