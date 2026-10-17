/**
 * Map modes: each mode maps a province to a colour. Modes whose underlying simulation does not
 * exist yet are listed as unavailable (with the phase that adds them) rather than faked.
 */
import type { ContentDB } from "../content/compile.ts";
import type { GameState } from "../sim/state.ts";
import { atWarWith, defensiveAllies, opinion } from "../sim/diplomacy/diplomacy.ts";
import type { MapData, Province } from "./mapData.ts";
import { canBuild, infrastructureOf, slotUse } from "../sim/economy/construction.ts";
import type { SimMap } from "../sim/simulation.ts";

/** The building being placed in the Construction tab (null: the mode shows free slots only). */
export const slotsView: { building: string | null } = { building: null };
const simMapCache = new WeakMap<MapData, SimMap>();
const simMapOf = (m: MapData): SimMap => {
  let s = simMapCache.get(m);
  if (!s) simMapCache.set(m, (s = { provinces: m.provinces, neighbours: new Map() }));
  return s;
};
/** Free slots (or levels left) in a province of the player's for the building being placed; -1 = not allowed. */
export function slotRoom(ctx: MapModeContext, p: Province): number {
  const st = ctx.state;
  const cs = st?.player ? st.countries[st.player] : undefined;
  if (!st || !cs?.economy || st.provinceOwner[p.id - 1] !== cs.tag) return -1;
  const sm = simMapOf(ctx.map);
  const b = slotsView.building ? ctx.db.buildings.get(slotsView.building) : undefined;
  if (b && canBuild(ctx.db, st, sm, cs, b.id, p.id)) return -1;
  if (b?.kind === "level") {
    const have = b.id === "infrastructure" ? infrastructureOf(st, p) : st.provinceBuildings[String(p.id)]?.[b.id] ?? 0;
    const queued = cs.economy.construction.filter((c) => c.building === b.id && c.province === p.id).length;
    return Math.max(0, (b.max_per_province ?? 1) - have - queued);
  }
  return slotUse(ctx.db, st, sm, cs, p).free;
}

export type RGB = [number, number, number];

export interface MapModeContext {
  db: ContentDB;
  map: MapData;
  /** Live game state when a game is running (ownership, governments, results). */
  state?: GameState | null;
}

/** Current owner and controller of a province (live state when a game runs). */
const ownerOf = (p: Province, ctx: MapModeContext) => ctx.state?.provinceOwner[p.id - 1] ?? p.owner;
const controllerOf = (p: Province, ctx: MapModeContext) => ctx.state?.provinceController[p.id - 1] ?? p.controller;
/** The leading governing party of a country (live when a game runs, else the 2000 data). */
function rulingParty(tag: string, ctx: MapModeContext): string | undefined {
  const live = ctx.state?.countries[tag];
  if (live) return live.rulingParties[0];
  return ctx.db.countries.get(tag)?.country?.start_2000.ruling_parties[0];
}

export interface MapMode {
  id: string;
  name: string;
  /** Short legend lines shown under the mode bar. */
  legend?: (ctx: MapModeContext) => { color: string; label: string }[];
  available: boolean;
  availableIn?: string;
  color?: (p: Province, ctx: MapModeContext) => RGB;
}

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const GREY: RGB = [70, 76, 86];

function ownerColor(tag: string, ctx: MapModeContext): RGB {
  const c = ctx.state?.dynamicCountries[tag]?.color ?? ctx.db.countryColors.get(tag);
  return c ? hexToRgb(c) : GREY;
}

/** Sequential ramp (dark blue -> teal -> yellow), t in 0..1. */
function ramp(t: number): RGB {
  const stops: RGB[] = [[22, 32, 66], [33, 102, 150], [53, 168, 140], [190, 210, 90], [250, 230, 120]];
  const x = Math.max(0, Math.min(0.9999, t)) * (stops.length - 1);
  const i = Math.floor(x);
  return mix(stops[i]!, stops[i + 1]!, x - i);
}

export const TERRAIN_COLORS: Record<string, string> = {
  plains: "#8fa860",
  forest: "#3f6b3a",
  hills: "#a59a62",
  mountains: "#8a7f74",
  desert: "#d6c08a",
  jungle: "#2f7d4a",
  marsh: "#5f8a7a",
  urban: "#9a8f8f",
  arctic: "#dfe7ec",
};

function rulingSubIdeologyColor(tag: string, ctx: MapModeContext): RGB | null {
  const lead = rulingParty(tag, ctx);
  const party = lead ? ctx.db.parties.get(lead) : undefined;
  const sub = party ? ctx.db.subIdeologies.get(party.sub_ideology) : undefined;
  return sub ? hexToRgb(sub.color) : null;
}

export const MAP_MODES: MapMode[] = [
  {
    id: "political",
    name: "Political",
    available: true,
    color: (p, ctx) => {
      const owner = ownerOf(p, ctx), ctrl = controllerOf(p, ctx);
      const own = ownerColor(owner, ctx);
      return ctrl === owner ? own : mix(own, ownerColor(ctrl, ctx), 0.55);
    },
  },
  {
    id: "terrain",
    name: "Terrain",
    available: true,
    color: (p) => hexToRgb(TERRAIN_COLORS[p.terrain] ?? "#777777"),
    legend: () => Object.entries(TERRAIN_COLORS).map(([k, c]) => ({ color: c, label: k })),
  },
  {
    id: "ideology",
    name: "Ruling ideology",
    available: true,
    color: (p, ctx) => rulingSubIdeologyColor(ownerOf(p, ctx), ctx) ?? GREY,
    legend: (ctx) => {
      const seen = new Map<string, string>();
      for (const cc of ctx.db.countries.values()) {
        const lead = rulingParty(cc.entry.tag, ctx);
        const sub = lead ? ctx.db.subIdeologies.get(ctx.db.parties.get(lead)?.sub_ideology ?? "") : undefined;
        if (sub) seen.set(sub.name, sub.color);
      }
      return [...seen].map(([label, color]) => ({ label, color })).concat([{ label: "no politics data yet", color: "#464c56" }]);
    },
  },
  {
    id: "party",
    name: "Ruling party",
    available: true,
    color: (p, ctx) => {
      const lead = rulingParty(ownerOf(p, ctx), ctx);
      const party = lead ? ctx.db.parties.get(lead) : undefined;
      return party ? hexToRgb(party.color) : GREY;
    },
  },
  {
    id: "population",
    name: "Population density",
    available: true,
    color: (p) => ramp(Math.log10(Math.max(1, p.population / Math.max(1, p.area_km2))) / 3.3),
    legend: () => [1, 10, 100, 1000].map((d) => ({ color: rgbHex(ramp(Math.log10(d) / 3.3)), label: `${d}/km²` })),
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    available: true,
    color: (p, ctx) => ramp((Math.min(10, p.infrastructure + (ctx.state?.provinceBuildings[String(p.id)]?.infrastructure ?? 0)) - 1) / 9),
  },
  {
    id: "control",
    name: "Occupation",
    available: true,
    color: (p, ctx) => (controllerOf(p, ctx) === ownerOf(p, ctx) ? mix(ownerColor(ownerOf(p, ctx), ctx), [40, 44, 52], 0.75) : ownerColor(controllerOf(p, ctx), ctx)),
  },
  {
    id: "election",
    name: "Election results",
    available: true,
    // the latest election in each country: the party that came first in each province; countries
    // with no election yet show their governing party, dimmed
    color: (p, ctx) => {
      const owner = ownerOf(p, ctx);
      const won = ctx.state?.mapResults[owner]?.[String(p.id)];
      const party = won ? ctx.db.parties.get(won) : undefined;
      if (party) return hexToRgb(party.color);
      const lead = rulingParty(owner, ctx);
      const gov = lead ? ctx.db.parties.get(lead) : undefined;
      return gov ? mix(hexToRgb(gov.color), [30, 34, 40], 0.7) : GREY;
    },
    legend: (ctx) => {
      const count = new Map<string, number>();
      for (const res of Object.values(ctx.state?.mapResults ?? {})) for (const party of Object.values(res)) count.set(party, (count.get(party) ?? 0) + 1);
      const top = [...count].sort((a, b) => b[1] - a[1]).slice(0, 10);
      return [
        ...top.map(([id]) => ({ color: ctx.db.parties.get(id)?.color ?? "#777777", label: ctx.db.parties.get(id)?.name.en ?? id })),
        { color: "#2c3036", label: "no election yet (governing party, dimmed)" },
      ];
    },
  },
  {
    id: "unrest",
    name: "Unrest",
    available: true,
    // country unrest, higher in provinces whose culture differs from the country's, and in rebel hands
    color: (p, ctx) => {
      const owner = ownerOf(p, ctx);
      const cs = ctx.state?.countries[owner];
      if (ctx.state?.dynamicCountries[owner]) return [200, 40, 30];
      if (!cs) return [40, 44, 52];
      const primary = ctx.db.countries.get(owner)?.country?.culture_primary;
      const minority = p.culture && primary && p.culture !== primary ? 0.15 : 0;
      const u = Math.min(1, cs.unrest + minority * (0.5 + cs.unrest) + (cs.civilWar ? 0.35 : 0));
      return heat(u);
    },
    legend: () => [0, 0.25, 0.5, 0.75, 1].map((u) => ({ color: rgbHex(heat(u)), label: u === 0 ? "calm" : u === 1 ? "civil war / rebel held" : `${Math.round(u * 100)}% unrest` })),
  },
  {
    id: "resources",
    name: "Resources",
    available: true,
    // national resource rents (World Bank 2000) by country: the dominant resource, brighter where rents are a larger share of GDP
    color: (p, ctx) => {
      const owner = ownerOf(p, ctx);
      const e = ctx.state?.countries[owner]?.economy;
      const wb = ctx.db.worldBank.countries[owner];
      let best: { color: string; share: number } | null = null;
      for (const r of ctx.db.economyRules.resources) {
        const share = e ? ((e.resources[r.id] ?? 0) * (ctx.state?.market.prices[r.id] ?? 1)) / Math.max(1, e.gdp) : ((wb?.[r.rent_key] as number | undefined) ?? 0) / 100;
        if (share > (best?.share ?? 0.002)) best = { color: r.color, share };
      }
      if (!best) return [40, 44, 52];
      return mix([40, 44, 52], hexToRgb(best.color), Math.min(1, 0.35 + best.share * 6));
    },
    legend: (ctx) => [
      ...ctx.db.economyRules.resources.map((r) => ({ color: r.color, label: r.name })),
      { color: "#282c34", label: "little resource income" },
    ],
  },
  {
    id: "supply",
    name: "Supply",
    available: true,
    // divisions a province can supply (base + infrastructure, including built roads)
    color: (p, ctx) => {
      const r = ctx.db.warRules;
      const infra = Math.min(10, p.infrastructure + (ctx.state?.provinceBuildings[String(p.id)]?.infrastructure ?? 0));
      const cap = r.supply_base + r.supply_per_infrastructure * infra;
      return supplyRamp(cap / (r.supply_base + r.supply_per_infrastructure * 10));
    },
    legend: (ctx) => {
      const r = ctx.db.warRules;
      const max = r.supply_base + r.supply_per_infrastructure * 10;
      return [r.supply_base + r.supply_per_infrastructure, max * 0.5, max].map((c) => ({ color: rgbHex(supplyRamp(c / max)), label: `${Math.round(c)} divisions (half in enemy territory)` }));
    },
  },
  {
    id: "diplomacy",
    name: "Relations",
    available: true,
    // each country's opinion of the player (green friendly, red hostile); allies blue, enemies at war deep red
    color: (p, ctx) => {
      const s = ctx.state;
      const me = s?.player;
      const owner = ownerOf(p, ctx);
      if (!s || !me || !s.diplomacy) return [40, 44, 52];
      if (owner === me) return [214, 182, 96];
      return relationColor(ctx, owner, me);
    },
    legend: () => [
      { color: "#d6b660", label: "your country" },
      { color: "#3a6fd8", label: "ally (defensive bloc or guarantee)" },
      { color: rgbHex(opinionRamp(1)), label: "opinion of you +100" },
      { color: rgbHex(opinionRamp(0.5)), label: "neutral" },
      { color: rgbHex(opinionRamp(0)), label: "opinion of you -100" },
      { color: "#8c1a14", label: "at war with you" },
    ],
  },
  {
    id: "factions",
    name: "Blocs",
    available: true,
    // the country's military bloc, else its economic bloc, else its political bloc
    color: (p, ctx) => {
      const owner = ownerOf(p, ctx);
      const bloc = primaryBloc(ctx, owner);
      return bloc ? hexToRgb(ctx.db.blocs.get(bloc)?.color ?? "#888888") : [40, 44, 52];
    },
    legend: (ctx) => [...ctx.db.blocs.values()].map((b) => ({ color: b.color, label: b.name })),
  },
  {
    id: "slots",
    name: "Building slots",
    available: true,
    // your provinces by free building slots (or levels left for the building being placed)
    color: (p, ctx) => {
      if (ctx.state?.provinceOwner[p.id - 1] !== ctx.state?.player) return [34, 38, 44];
      const room = slotRoom(ctx, p);
      if (room < 0) return [92, 40, 34];
      if (room === 0) return [70, 62, 52];
      return mix([88, 120, 70], [170, 220, 110], Math.min(1, room / 8));
    },
    legend: () => [
      { color: "#aadc6e", label: "8 or more free" },
      { color: "#78a056", label: "a few free" },
      { color: "#463e34", label: "full" },
      { color: "#5c2822", label: "cannot build here" },
      { color: "#22262c", label: "not yours" },
    ],
  },
];

const KIND_ORDER = { military: 0, economic: 1, political: 2 } as const;
function primaryBloc(ctx: MapModeContext, tag: string): string | null {
  const blocs = ctx.state?.diplomacy?.blocs ?? Object.fromEntries([...ctx.db.blocs.values()].map((b) => [b.id, b.members_2000]));
  let best: string | null = null;
  for (const [id, members] of Object.entries(blocs)) {
    if (!members.includes(tag)) continue;
    const k = KIND_ORDER[ctx.db.blocs.get(id)?.kind ?? "political"];
    if (best === null || k < KIND_ORDER[ctx.db.blocs.get(best)?.kind ?? "political"]) best = id;
  }
  return best;
}

// opinions are cached per country for one day of one game (a full map pass asks once per province)
let relCache: { state: GameState; key: string; colors: Map<string, RGB> } | null = null;
function relationColor(ctx: MapModeContext, owner: string, me: string): RGB {
  const s = ctx.state!;
  const d = s.diplomacy;
  const key = `${s.day}|${me}|${s.wars.length}|${d.guarantees.length}|${d.sanctions.length}|${d.tradeDeals.length}|${d.improving.length}|${Object.values(d.blocs).reduce((n, m) => n + m.length, 0)}`;
  if (relCache?.state !== s || relCache.key !== key) relCache = { state: s, key, colors: new Map() };
  let c = relCache.colors.get(owner);
  if (!c) {
    if (atWarWith(s, owner, me)) c = [140, 26, 20];
    else if (defensiveAllies(ctx.db, s, me).includes(owner)) c = [58, 111, 216];
    else c = opinionRamp((opinion(ctx.db, s, owner, me) + 100) / 200);
    relCache.colors.set(owner, c);
  }
  return c;
}

/** Hostile red through neutral grey to friendly green. */
function opinionRamp(t: number): RGB {
  return t < 0.5 ? mix([176, 52, 40], [70, 74, 80], t * 2) : mix([70, 74, 80], [70, 160, 80], (t - 0.5) * 2);
}

/** Poor supply (dark red) to good supply (green). */
function supplyRamp(t: number): RGB {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? mix([120, 40, 30], [180, 150, 60], x * 2) : mix([180, 150, 60], [70, 150, 80], (x - 0.5) * 2);
}

/** Calm (dark steel) to red. */
function heat(t: number): RGB {
  const stops: RGB[] = [[46, 52, 50], [110, 104, 60], [196, 140, 50], [214, 84, 40], [200, 40, 30]];
  const x = Math.max(0, Math.min(0.9999, t)) * (stops.length - 1);
  const i = Math.floor(x);
  return mix(stops[i]!, stops[i + 1]!, x - i);
}

export function rgbHex(c: RGB): string {
  return "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}
