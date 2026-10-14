/**
 * Map modes: each mode maps a province to a colour. Modes whose underlying simulation does not
 * exist yet are listed as unavailable (with the phase that adds them) rather than faked.
 */
import type { ContentDB } from "../content/compile.ts";
import type { MapData, Province } from "./mapData.ts";

export type RGB = [number, number, number];

export interface MapModeContext {
  db: ContentDB;
  map: MapData;
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
  const c = ctx.db.countryColors.get(tag);
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
  const c = ctx.db.countries.get(tag)?.country;
  const lead = c?.start_2000.ruling_parties[0];
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
      const own = ownerColor(p.owner, ctx);
      return p.controller === p.owner ? own : mix(own, ownerColor(p.controller, ctx), 0.55);
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
    color: (p, ctx) => rulingSubIdeologyColor(p.owner, ctx) ?? GREY,
    legend: (ctx) => {
      const seen = new Map<string, string>();
      for (const cc of ctx.db.countries.values()) {
        const lead = cc.country?.start_2000.ruling_parties[0];
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
      const lead = ctx.db.countries.get(p.owner)?.country?.start_2000.ruling_parties[0];
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
    color: (p) => ramp((p.infrastructure - 1) / 9),
  },
  {
    id: "control",
    name: "Occupation",
    available: true,
    color: (p, ctx) => (p.controller === p.owner ? mix(ownerColor(p.owner, ctx), [40, 44, 52], 0.75) : ownerColor(p.controller, ctx)),
  },
  { id: "election", name: "Election results", available: false, availableIn: "Phase 5" },
  { id: "unrest", name: "Unrest", available: false, availableIn: "Phase 5" },
  { id: "resources", name: "Resources", available: false, availableIn: "Phase 7" },
  { id: "supply", name: "Supply", available: false, availableIn: "Phase 10" },
  { id: "diplomacy", name: "Relations", available: false, availableIn: "Phase 11" },
  { id: "factions", name: "Factions", available: false, availableIn: "Phase 11" },
];

export function rgbHex(c: RGB): string {
  return "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}
