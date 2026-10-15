/**
 * Map modes: each mode maps a province to a colour. Modes whose underlying simulation does not
 * exist yet are listed as unavailable (with the phase that adds them) rather than faked.
 */
import type { ContentDB } from "../content/compile.ts";
import type { GameState } from "../sim/state.ts";
import type { MapData, Province } from "./mapData.ts";

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
  { id: "supply", name: "Supply", available: false, availableIn: "Phase 10" },
  { id: "diplomacy", name: "Relations", available: false, availableIn: "Phase 11" },
  { id: "factions", name: "Factions", available: false, availableIn: "Phase 11" },
];

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
