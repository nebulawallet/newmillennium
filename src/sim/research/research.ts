/**
 * Research (Phase 8). Countries research technologies in a few parallel slots. Each technology
 * has a year: researching it before that year costs extra, catching up on older ones is cheaper.
 * Research speed rises with R&D spending (World Bank 2000) and research_speed modifiers.
 * Starting technologies come from real 2000 figures: every technology up to 2000 minus a lag set
 * by income tier, shortened by R&D spending (civilian) or military spending (military categories).
 */
import type { ContentDB } from "../../content/compile.ts";
import type { TechDef } from "../../content/schemas/research.ts";
import { ymdOf } from "../date.ts";
import type { SimContext, System } from "../simulation.ts";
import type { CountryState } from "../state.ts";
import { clamp, countryModifiers } from "../politics/common.ts";
import { incomeTier } from "../economy/economy.ts";

export interface ResearchState {
  /** Technology being researched in each slot (null = empty). */
  slots: (string | null)[];
  /** Days of progress per technology (kept if a slot is switched away). */
  progress: Record<string, number>;
  completed: string[];
  /** Research speed, refreshed monthly (modifiers change with laws, technologies and events). */
  speed?: number;
}

/** Lag in years behind the frontier at the start, for civilian and military categories. */
export function startLag(db: ContentDB, tag: string, gdp: number, population: number): { civil: number; military: number } {
  const r = db.researchRules;
  const wb = db.worldBank.countries[tag];
  const tier = incomeTier((gdp * 1e9) / Math.max(1, population));
  const base = r.start_lag_years[tier] ?? 6;
  const rnd = typeof wb?.rnd_pct_gdp === "number" ? wb.rnd_pct_gdp : 0;
  const mil = typeof wb?.military_spending_pct_gdp === "number" ? wb.military_spending_pct_gdp : 1.5;
  return {
    civil: Math.max(0, base - clamp((rnd - r.rnd_baseline) * r.rnd_lag_per_point, 0, r.max_rnd_lag_reduction)),
    military: Math.max(0, base - clamp((mil - 2) * r.military_lag_per_point, 0, r.max_military_lag_reduction)),
  };
}

export function initialResearch(db: ContentDB, tag: string, gdp: number, population: number): ResearchState {
  const lag = startLag(db, tag, gdp, population);
  const completed = new Set<string>();
  // in year order, so prerequisites come first
  const techs = [...db.techs.values()].sort((a, b) => a.year - b.year);
  for (const t of techs) {
    const military = db.techCategories.get(t.category)?.military;
    if (t.year > 2000 - (military ? lag.military : lag.civil)) continue;
    if (t.mutually_exclusive.some((m) => completed.has(m))) continue;
    if (t.prerequisites.every((g) => g.some((p) => completed.has(p)))) completed.add(t.id);
  }
  return { slots: Array.from({ length: researchSlots(db, gdp) }, () => null), progress: {}, completed: [...completed] };
}

export function researchSlots(db: ContentDB, gdp: number): number {
  const r = db.researchRules;
  return Math.min(r.max_slots, r.base_slots + r.slot_gdp_thresholds.filter((t) => gdp >= t).length);
}

export type TechStatus = "completed" | "researching" | "available" | "locked" | "excluded";

export function techStatus(cs: CountryState, t: TechDef): TechStatus {
  const r = cs.research!;
  if (r.completed.includes(t.id)) return "completed";
  if (r.slots.includes(t.id)) return "researching";
  if (t.mutually_exclusive.some((m) => r.completed.includes(m) || r.slots.includes(m))) return "excluded";
  return t.prerequisites.every((g) => g.some((p) => r.completed.includes(p))) ? "available" : "locked";
}

/** Research speed multiplier and its parts. */
export function researchSpeed(db: ContentDB, cs: CountryState): { total: number; parts: [string, number][] } {
  const r = db.researchRules;
  const wb = db.worldBank.countries[cs.tag];
  const rnd = typeof wb?.rnd_pct_gdp === "number" ? wb.rnd_pct_gdp : 0;
  const parts: [string, number][] = [];
  const rndBonus = clamp((rnd - r.rnd_baseline) * r.rnd_speed_per_point, -0.15, 0.4);
  if (rndBonus) parts.push(["R&D spending", rndBonus]);
  const mod = countryModifiers(db, cs).research_speed ?? 0;
  if (mod) parts.push(["Policies and technologies", mod]);
  return { total: Math.max(0.2, 1 + rndBonus + mod), parts };
}

/**
 * Days needed for a technology now (HOI4 style). Before its year the cost grows with every year
 * ahead (linear plus a squared part, so researching far ahead gets steep); after it, catching up
 * is cheaper, capped. The base cost itself grows slowly with the technology's year (data).
 */
export function techCost(db: ContentDB, t: TechDef, day: number): { cost: number; factor: number; yearsAhead: number } {
  const r = db.researchRules;
  const ymd = ymdOf(day);
  // fractional years, so the penalty eases off through the year rather than dropping on 1 January
  const now = ymd.year + (ymd.month - 1) / 12;
  const diff = t.year - now;
  const factor = diff > 0
    ? 1 + diff * r.ahead_penalty_per_year + diff * diff * r.ahead_penalty_growth
    : 1 - Math.min(r.max_behind_bonus, -diff * r.behind_bonus_per_year);
  return { cost: t.cost * factor, factor, yearsAhead: Math.max(0, Math.ceil(diff)) };
}

export function setResearch(ctx: SimContext, tag: string, slot: number, tech: string | null): { ok: boolean; text: string } {
  const cs = ctx.state.countries[tag];
  const r = cs?.research;
  if (!cs || !r) return { ok: false, text: "No research for this country." };
  if (slot < 0 || slot >= r.slots.length) return { ok: false, text: "No such slot." };
  if (tech === null) {
    r.slots[slot] = null;
    return { ok: true, text: "Slot cleared." };
  }
  const t = ctx.db.techs.get(tech);
  if (!t) return { ok: false, text: "Unknown technology." };
  const st = techStatus(cs, t);
  if (st === "completed") return { ok: false, text: "Already researched." };
  if (st === "researching") return { ok: false, text: "Already being researched." };
  if (st === "locked") return { ok: false, text: "Research its prerequisites first." };
  if (st === "excluded") return { ok: false, text: "A mutually exclusive technology was chosen instead." };
  r.slots[slot] = tech;
  return { ok: true, text: `Researching ${t.name}.` };
}

/** Complete a technology at once (script effect unlock_tech, focuses). */
export function grantTech(db: ContentDB, cs: CountryState, tech: string): void {
  const r = cs.research;
  if (!r || !db.techs.has(tech) || r.completed.includes(tech)) return;
  r.completed.push(tech);
  r.slots = r.slots.map((s) => (s === tech ? null : s));
  delete r.progress[tech];
}

function aiPick(ctx: SimContext, cs: CountryState): string | null {
  const r = cs.research!;
  // the same test as techStatus, with sets (this runs often over 330 technologies)
  const done = new Set(r.completed), busy = new Set(r.slots);
  const options: TechDef[] = [];
  for (const t of ctx.db.techs.values()) {
    if (done.has(t.id) || busy.has(t.id)) continue;
    if (t.mutually_exclusive.some((m) => done.has(m) || busy.has(m))) continue;
    if (t.prerequisites.every((g) => g.some((p) => done.has(p)))) options.push(t);
  }
  if (!options.length) return null;
  // prefer cheap, current technologies; a little randomness keeps countries apart
  const year = ymdOf(ctx.state.day).year;
  const w = options.map((t) => Math.exp(-Math.max(0, t.year - year) * 0.8) * (r.progress[t.id] ? 3 : 1));
  return options[ctx.rng.weighted(w)]!.id;
}

export const researchSystem: System = {
  id: "research",
  daily(ctx) {
    const { db, state } = ctx;
    for (const cs of Object.values(state.countries)) {
      const r = cs.research;
      if (!cs.active || !r) continue;
      r.speed ??= researchSpeed(db, cs).total;
      const speed = r.speed;
      r.slots.forEach((id, i) => {
        if (!id) {
          if (cs.tag !== state.player && state.day % 5 === i % 5) r.slots[i] = aiPick(ctx, cs);
          return;
        }
        const t = db.techs.get(id);
        if (!t) return void (r.slots[i] = null);
        r.progress[id] = (r.progress[id] ?? 0) + speed;
        if (r.progress[id]! >= techCost(db, t, state.day).cost) {
          grantTech(db, cs, id);
          if (cs.tag === state.player) ctx.log(cs.tag, "research", `Researched ${t.name}`);
        }
      });
    }
  },
  monthly({ db, state }) {
    for (const cs of Object.values(state.countries)) if (cs.active && cs.research) cs.research.speed = researchSpeed(db, cs).total;
  },
  yearly({ db, state }) {
    // growing economies earn more slots
    for (const cs of Object.values(state.countries)) {
      const r = cs.research;
      if (!r || !cs.economy) continue;
      const n = researchSlots(db, cs.economy.gdp);
      while (r.slots.length < n) r.slots.push(null);
    }
  },
};
