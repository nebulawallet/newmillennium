/**
 * Unrest, coups and civil war: the escalation ladder protest -> strike -> mass movement ->
 * uprising -> coup or civil war. Interest group actions raise unrest; unrest fades monthly and
 * lowers the stability target. Very unhappy armed or excluded groups may stage a coup or rise up.
 * A civil war splits the country's provinces between the government and a rebel side, chosen by
 * culture, population density (by group) and geography, as one contiguous region where possible.
 * In a civil war the army splits (divisions in rebel regions, plus a share set by the rising group's
 * influence) and the war is fought out: it ends when either side holds none of its regions, or the
 * rebels hold most of the population. A war with no armies on either side ends by a monthly chance.
 */
import type { ContentDB } from "../../content/compile.ts";
import type { SimContext, System } from "../simulation.ts";
import type { CountryState, GameState } from "../state.ts";
import { clamp, countryModifiers, effectiveLeader, hashNormal, isAvailable, personParty } from "./common.ts";
import { igActions } from "./interestGroups.ts";
import { countryProvinces, type SimProvince } from "./voteModel.ts";
import { capitalProvince } from "../military/military.ts";

export const REBEL_SUFFIX = "-REB";
const ARMED = new Set(["military", "security_services"]);

/** Display name for any tag, including countries created during play. */
export function countryName(db: ContentDB, state: GameState | null | undefined, tag: string): string {
  const own = state?.countries[tag]?.name;
  if (own) return own;
  const dyn = state?.dynamicCountries[tag];
  if (dyn) return dyn.name;
  return db.countries.get(tag)?.country?.name.en ?? db.countryList.find((c) => c.tag === tag)?.name ?? db.armedGroups.get(tag)?.name ?? tag;
}

/** Short display name (map labels, news, war names): a renamed country's name, else the short name when there is one. */
export function countryShortName(db: ContentDB, state: GameState | null | undefined, tag: string): string {
  const own = state?.countries[tag]?.name;
  if (own) return own;
  const dyn = state?.dynamicCountries[tag];
  if (dyn) return dyn.name;
  return db.countryList.find((c) => c.tag === tag)?.short_name ?? countryName(db, null, tag);
}

/** Map colour for any tag. */
export function countryColor(db: ContentDB, state: GameState | null | undefined, tag: string): string | undefined {
  return state?.dynamicCountries[tag]?.color ?? db.countryColors.get(tag);
}

export function blankCountry(tag: string, govType: string, day: number): CountryState {
  return {
    tag, active: true, govType, politicalPower: 0, stability: 0.5, warSupport: 0.8, rulingParties: [], confidenceAndSupply: [],
    govSinceDay: day, offices: {}, officeSince: {}, historicalOffices: {}, followsHistory: false, partyPopularity: {}, partyStatus: {},
    partyLeader: {}, partyBias: {}, ideologySupport: {}, laws: {}, lawChangedDay: {}, interestGroups: {}, igBase: {}, seats: {},
    unrest: 0, economicMood: 0, schedule: [], civilWar: null, flags: {},
    timedModifiers: [], spirits: [], claims: [], focus: { tree: "", current: null, progress: 0, completed: [] }, decisionCooldowns: {}, activeDecisions: [], eventsFired: {},
  };
}

/** Change the regime after a successful coup (or a rebel victory) by an interest group. */
export function regimeChange(ctx: SimContext, cs: CountryState, ig: string, how: "coup" | "rebel_victory"): void {
  const { db, state } = ctx;
  const c = db.countries.get(cs.tag)?.country;
  const govType = ARMED.has(ig) || how === "coup" ? "military_junta" : "hybrid_authoritarian";
  const gov = db.governmentTypes.get(govType);
  cs.govType = govType;
  // the new leader: the serving military chief if there is one; otherwise an unnamed military council
  let leader: string | null = null;
  for (const o of [...(db.countries.get(cs.tag)?.military ?? [])]) {
    if (o.role !== "military_chief" && o.role !== "army_chief") continue;
    const h = cs.offices[o.id]?.[0];
    if (h && isAvailable(db, h, state.day)) { leader = h; break; }
  }
  if (c) {
    for (const o of new Set([c.government.effective_executive, c.government.head_of_state_office, c.government.head_of_government_office])) {
      if (db.offices.get(o)?.ex_officio_of) continue;
      cs.offices[o] = [leader];
      cs.officeSince[o] = state.day;
    }
  }
  for (const k of Object.keys(cs.historicalOffices)) cs.historicalOffices[k] = false;
  cs.followsHistory = false;
  cs.rulingParties = [];
  cs.confidenceAndSupply = [];
  cs.govSinceDay = state.day;
  for (const [cat, law] of Object.entries(cs.laws)) if (gov?.forbidden_laws.includes(law)) cs.laws[cat] = gov.default_laws[cat] ?? law;
  if (gov && !gov.holds_elections) cs.schedule = [];
  cs.stability = clamp(cs.stability - 0.1, 0, 1);
  cs.unrest = clamp(cs.unrest + 0.15, 0, 1);
  cs.igBase[ig] = (cs.igBase[ig] ?? 0) + 20;
  for (const g of ["urban_middle_class", "youth_students", "media"]) cs.igBase[g] = (cs.igBase[g] ?? 0) - 10;
  const groupName = db.interestGroupTypes.get(ig)?.name ?? ig;
  const who = leader ? db.people.get(leader)?.name.en : "a military council";
  ctx.log(cs.tag, "coup", how === "coup" ? `Coup d'état backed by ${groupName}: ${who} takes power` : `${groupName} win the civil war: ${who} takes power`);
  ctx.emit({ type: "coup", tag: cs.tag });
}

/** Loyalty of a province to the government against a rising group (lower = more likely rebel). */
function loyalty(prov: SimProvince, ig: string, primary: string | undefined, tag: string): number {
  const dz = clamp((Math.log10(Math.max(1, prov.population / Math.max(1, prov.area_km2))) - 2) / 1.2, -2, 2);
  let s = 0.6 * hashNormal(`${tag}:${prov.id}:loyalty`);
  if (ig === "minorities") s += prov.culture && primary && prov.culture !== primary ? -3 : 1;
  else if (ig === "rural") s += dz;
  else if (ig === "urban_middle_class" || ig === "youth_students") s -= dz;
  return s;
}

/** Start a civil war: a rebel side takes part of the country's provinces. Returns the rebel tag. */
export function startCivilWar(ctx: SimContext, cs: CountryState, ig: string): string | null {
  const { db, state } = ctx;
  if (cs.civilWar) return null;
  const provinces = countryProvinces(state, ctx.map?.provinces, cs.tag).filter((p) => p.id > 0);
  const rebel = cs.tag + REBEL_SUFFIX;
  const primary = db.countries.get(cs.tag)?.country?.culture_primary;
  const influence = cs.interestGroups[ig]?.influence ?? 0.2;
  const targetShare = clamp(0.2 + 0.4 * influence, 0.2, 0.55);

  const taken = new Set<number>();
  if (provinces.length >= 2) {
    const score = new Map(provinces.map((p) => [p.id, loyalty(p, ig, primary, cs.tag)]));
    const totalPop = provinces.reduce((s, p) => s + p.population, 0);
    const byId = new Map(provinces.map((p) => [p.id, p]));
    const neighbours = ctx.map?.neighbours;
    const frontier = new Set<number>();
    let pop = 0;
    const seed = [...provinces].sort((a, b) => score.get(a.id)! - score.get(b.id)!)[0]!;
    frontier.add(seed.id);
    // grow one compact region from the least loyal province: loyalty plus distance from the seed
    const sc = seed.centroid;
    const dist = (p: SimProvince) => (sc && p.centroid ? Math.hypot((p.centroid[0] - sc[0]) * Math.cos((sc[1] * Math.PI) / 180), p.centroid[1] - sc[1]) : 0);
    const prio = (id: number) => score.get(id)! + dist(byId.get(id)!) / 6;
    while (pop < totalPop * targetShare && taken.size < provinces.length - 1) {
      let next: number | undefined;
      for (const id of frontier) if (next === undefined || prio(id) < prio(next)) next = id;
      if (next === undefined) {
        // region exhausted (islands): jump to the least loyal remaining province
        next = [...provinces].filter((p) => !taken.has(p.id)).sort((a, b) => score.get(a.id)! - score.get(b.id)!)[0]?.id;
        if (next === undefined) break;
      }
      frontier.delete(next);
      taken.add(next);
      pop += byId.get(next)!.population;
      for (const n of neighbours?.get(next) ?? []) if (byId.has(n) && !taken.has(n)) frontier.add(n);
    }
  }
  // no enclaves: a government province surrounded by rebel provinces joins them (and vice versa)
  const neighbours = ctx.map?.neighbours;
  if (neighbours) {
    for (let pass = 0; pass < 2; pass++)
      for (const p of provinces) {
        const ns = (neighbours.get(p.id) ?? []).filter((n) => provinces.some((q) => q.id === n));
        if (ns.length < 2) continue;
        const rebelNs = ns.filter((n) => taken.has(n)).length;
        if (!taken.has(p.id) && rebelNs === ns.length) taken.add(p.id);
        else if (taken.has(p.id) && rebelNs === 0) taken.delete(p.id);
      }
  }
  for (const id of taken) {
    state.provinceOwner[id - 1] = rebel;
    state.provinceController[id - 1] = rebel;
  }
  const adjective = db.countries.get(cs.tag)?.country?.adjective ?? cs.tag;
  const groupName = db.interestGroupTypes.get(ig)?.name ?? ig;
  state.dynamicCountries[rebel] = { name: `${adjective} insurgents (${groupName})`, color: rebelColor(db.countryColors.get(cs.tag)), parent: cs.tag, kind: "rebels" };
  state.countries[rebel] = blankCountry(rebel, "insurgent_movement", state.day);
  cs.civilWar = { rebel, startDay: state.day, group: ig };
  splitArmy(ctx, cs.tag, rebel, taken, ig === "military" ? 0.25 + 0.6 * influence : 0.1 + 0.3 * influence);
  cs.followsHistory = false;
  cs.stability = clamp(cs.stability - 0.2, 0, 1);
  cs.warSupport = clamp(cs.warSupport + 0.2, 0, 1);
  cs.unrest = clamp(cs.unrest + (db.politicsRules.unrest.action_unrest.civil_war ?? 0.3), 0, 1);
  ctx.log(cs.tag, "civil_war", `Civil war: ${groupName} rise up and take ${taken.size} provinces`);
  ctx.emit({ type: "civil_war", tag: cs.tag });
  ctx.emit({ type: "map_changed" });
  return rebel;
}

/** Divisions in rebel regions defect, plus a share of the rest (moved to rebel regions). */
function splitArmy(ctx: SimContext, gov: string, rebel: string, taken: Set<number>, share: number): void {
  const { state, rng } = ctx;
  const mine = state.divisions.filter((d) => d.owner === gov);
  if (!mine.length || !taken.size) return;
  const rebelProvinces = [...taken];
  let want = Math.round(mine.length * clamp(share, 0, 0.7));
  for (const d of mine) {
    if (!taken.has(d.province)) continue;
    d.owner = rebel;
    d.path = [];
    d.attacking = undefined;
    want--;
  }
  for (const d of mine) {
    if (want <= 0) break;
    if (d.owner !== gov || !rng.chance(share)) continue;
    d.owner = rebel;
    d.province = rebelProvinces[rng.int(rebelProvinces.length)]!;
    d.path = [];
    d.attacking = undefined;
    want--;
  }
}

/** Monthly check of a civil war: decided on the battlefield, or by chance when nobody is fighting. */
function civilWarProgress(ctx: SimContext, cs: CountryState): void {
  const { db, state, rng } = ctx;
  const cw = cs.civilWar!;
  let rebelHeld = 0, govHeld = 0, total = 0;
  const pop = (i: number) => ctx.map?.provinces[i]?.population ?? 1;
  for (let i = 0; i < state.provinceOwner.length; i++) {
    const o = state.provinceOwner[i], c = state.provinceController[i];
    if (o !== cs.tag && o !== cw.rebel) continue;
    total += pop(i);
    if (c === cw.rebel) rebelHeld += pop(i);
    else if (c === cs.tag) govHeld += pop(i);
  }
  if (rebelHeld === 0) return endCivilWar(ctx, cs, true);
  if (govHeld === 0 || rebelHeld >= total * db.warRules.capitulation_share) return endCivilWar(ctx, cs, false);
  const armies = state.divisions.some((d) => d.owner === cw.rebel) && state.divisions.some((d) => d.owner === cs.tag);
  if (!armies && rng.chance(db.politicsRules.unrest.civil_war_end_chance)) endCivilWar(ctx, cs, rng.chance((govHeld + 1) / (govHeld + rebelHeld + 2)));
}

function rebelColor(parent: string | undefined): string {
  const n = parseInt((parent ?? "#777777").slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  // darker and shifted toward a neutral rust so the split reads at a glance
  const mix = (c: number, t: number) => Math.round(c * 0.45 + t * 0.55);
  return "#" + [mix(r, 150), mix(g, 60), mix(b, 40)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** End a civil war: the winner takes the rebel provinces back, or the regime changes / the region secedes. */
export function endCivilWar(ctx: SimContext, cs: CountryState, governmentWins: boolean): void {
  const { db, state } = ctx;
  const cw = cs.civilWar;
  if (!cw) return;
  const secede = !governmentWins && cw.group === "minorities";
  if (!secede) {
    for (let i = 0; i < state.provinceOwner.length; i++) {
      if (state.provinceOwner[i] === cw.rebel) state.provinceOwner[i] = cs.tag;
      if (state.provinceController[i] === cw.rebel) state.provinceController[i] = cs.tag;
    }
    // a defeated rebellion's units disband; a victorious one's become the national army
    if (governmentWins) state.divisions = state.divisions.filter((d) => d.owner !== cw.rebel);
    else for (const d of state.divisions) if (d.owner === cw.rebel) d.owner = cs.tag;
    delete state.countries[cw.rebel];
    delete state.dynamicCountries[cw.rebel];
  } else {
    // the breakaway state keeps its units; each side's units leave the other's territory
    for (let i = 0; i < state.provinceOwner.length; i++) if (state.provinceOwner[i] === cs.tag && state.provinceController[i] === cw.rebel) state.provinceController[i] = cs.tag;
    for (let i = 0; i < state.provinceOwner.length; i++) if (state.provinceOwner[i] === cw.rebel && state.provinceController[i] === cs.tag) state.provinceController[i] = cw.rebel;
    for (const d of state.divisions) {
      if (d.owner !== cs.tag && d.owner !== cw.rebel) continue;
      if (state.provinceOwner[d.province - 1] === d.owner) continue;
      const home = capitalProvince(state, ctx.map, d.owner);
      if (home >= 1) d.province = home;
      d.path = [];
      d.attacking = undefined;
    }
  }
  cs.civilWar = null;
  const groupName = db.interestGroupTypes.get(cw.group)?.name ?? cw.group;
  if (governmentWins) {
    cs.igBase[cw.group] = (cs.igBase[cw.group] ?? 0) + 5;
    cs.unrest = clamp(cs.unrest - 0.2, 0, 1);
    ctx.log(cs.tag, "civil_war", `The civil war ends: the government defeats the ${groupName.toLowerCase()} uprising`);
  } else if (secede) {
    const dyn = state.dynamicCountries[cw.rebel];
    if (dyn) dyn.name = dyn.name.replace(/insurgents.*$/, "breakaway state").trim();
    ctx.log(cs.tag, "civil_war", `The civil war ends: the rebel regions break away`);
  } else regimeChange(ctx, cs, cw.group, "rebel_victory");
  ctx.emit({ type: "map_changed" });
}

/** Try to remove an elected executive by impeachment. */
function tryImpeachment(ctx: SimContext, cs: CountryState): void {
  const { db, state } = ctx;
  const c = db.countries.get(cs.tag)?.country;
  const exec = c?.government.effective_executive;
  const office = exec ? db.offices.get(exec) : undefined;
  if (!c || !office || (office.selection !== "direct_election" && office.selection !== "electoral_college")) return;
  const ch = c.legislature?.chambers.find((x) => x.elected !== "appointed");
  if (!ch) return;
  const seats = cs.seats[ch.id] ?? {};
  const total = Object.values(seats).reduce((a, b) => a + b, 0) || 1;
  const leaderParty = personParty(db, cs, cs.offices[exec!]?.[0] ?? "");
  const opposition = Object.entries(seats).filter(([k]) => k !== leaderParty && !cs.rulingParties.includes(k)).reduce((s, [, v]) => s + v, 0);
  if (opposition / total < 2 / 3) {
    ctx.log(cs.tag, "government", "An impeachment drive against the executive fails in the legislature");
    return;
  }
  const removed = cs.offices[exec!]?.[0];
  const acting = office.succession?.acting_office ? cs.offices[office.succession.acting_office]?.[0] ?? null : null;
  cs.offices[exec!] = [acting];
  cs.officeSince[exec!] = state.day;
  cs.historicalOffices[exec!] = false;
  cs.followsHistory = false;
  const s = cs.schedule.find((e) => e.office === exec);
  if (s && !acting) { s.day = state.day + 90; s.snap = true; cs.schedule.sort((a, b) => a.day - b.day); }
  ctx.log(cs.tag, "government", `${db.people.get(removed ?? "")?.name.en ?? "The executive"} is removed from office by impeachment${acting ? `; ${db.people.get(acting)?.name.en} takes over` : ""}`);
}

export const unrestSystem: System = {
  id: "unrest",
  monthly(ctx) {
    const { db, state, rng } = ctx;
    const ur = db.politicsRules.unrest;
    for (const cs of Object.values(state.countries)) {
      if (!cs.active || cs.tag.endsWith(REBEL_SUFFIX)) continue;
      // countries without an economy model (e.g. rebels) keep a neutral mood
      if (!cs.economy) cs.economicMood = clamp(cs.economicMood * 0.9, -1, 1);
      cs.unrest = clamp(cs.unrest * (1 - ur.monthly_decay), 0, 1);
      const actions = igActions(ctx, cs);
      const strict = !!state.rules.strictHistory && cs.followsHistory;
      if (!strict && actions.some((a) => a.startsWith("impeachment:"))) tryImpeachment(ctx, cs);

      const gov = db.governmentTypes.get(cs.govType);
      const mods = countryModifiers(db, cs);
      const histFactor = strict ? 0 : state.rules.electionMode === "historical" && cs.followsHistory ? ur.historical_factor : 1;
      for (const [ig, s] of Object.entries(cs.interestGroups)) {
        const def = db.interestGroupTypes.get(ig);
        for (const a of def?.actions ?? []) {
          if (s.approval >= a.approval_below || s.influence < a.min_influence) continue;
          const depth = (a.approval_below - s.approval) / Math.max(1, a.approval_below);
          if (a.action === "coup" && cs.govType !== "military_junta") {
            const p = (gov?.coup_base_risk ?? 0.002) * ur.coup_scale * depth * Math.max(0.1, 1 + (mods.coup_risk ?? 0)) * histFactor;
            if (rng.chance(p)) regimeChange(ctx, cs, ig, "coup");
          } else if (a.action === "civil_war" && !cs.civilWar && cs.unrest >= ur.civil_war_min_unrest) {
            if (rng.chance(ur.civil_war_scale * depth * histFactor)) startCivilWar(ctx, cs, ig);
          }
        }
      }
      if (cs.civilWar) civilWarProgress(ctx, cs);
    }
  },
};

export { effectiveLeader };
