/**
 * Interest groups. Each group's approval drifts weekly toward a target set by the laws in force,
 * the ruling sub-ideology, the leader's traits and the economy. A per-country offset (igBase)
 * makes the researched 2000 approvals the starting equilibrium, so only changes move them.
 * Monthly, unhappy groups act (protests, strikes, mass movements, uprisings, impeachment drives),
 * which raises unrest. Coups and civil wars are handled by the unrest system.
 */
import type { ContentDB } from "../../content/compile.ts";
import type { SimContext, System } from "../simulation.ts";
import type { CountryState } from "../state.ts";
import { clamp, effectiveLeader, rulingSubIdeology } from "./common.ts";

export interface IgTargetPart {
  label: string;
  value: number;
}

/** Breakdown of one group's target approval (before the country offset), for tooltips. */
export function igTargetParts(db: ContentDB, cs: CountryState, ig: string): IgTargetPart[] {
  const def = db.interestGroupTypes.get(ig);
  if (!def) return [];
  const parts: IgTargetPart[] = [];
  for (const law of Object.values(cs.laws)) {
    const v = def.law_preferences[law];
    if (v) parts.push({ label: db.lawCategories.get(db.lawCategoryOf.get(law) ?? "")?.laws.find((l) => l.id === law)?.name ?? law, value: v });
  }
  const sub = rulingSubIdeology(db, cs);
  const aff = sub ? db.subIdeologies.get(sub)?.ig_affinity[ig] : undefined;
  if (aff) parts.push({ label: `Ruling ideology: ${db.subIdeologies.get(sub!)?.name}`, value: aff });
  const leader = effectiveLeader(db, cs);
  for (const t of (leader ? db.people.get(leader)?.traits : undefined) ?? []) {
    const v = def.trait_reactions[t];
    if (v) parts.push({ label: `Leader: ${db.traits.get(t)?.name ?? t}`, value: v });
  }
  const econ = db.politicsRules.interest_groups.economy_points * def.economy_sensitivity * cs.economicMood;
  if (Math.abs(econ) >= 0.05) parts.push({ label: "Economy", value: econ });
  const unrest = -cs.unrest * 10;
  if (unrest <= -0.05) parts.push({ label: "Unrest", value: unrest });
  return parts;
}

/** Target approval per group, before the per-country offset. */
export function igTargets(db: ContentDB, cs: CountryState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ig of db.interestGroupTypes.keys()) out[ig] = 50 + igTargetParts(db, cs, ig).reduce((s, p) => s + p.value, 0);
  return out;
}

/** Final target approval (0..100) including the country offset. */
export function igTarget(db: ContentDB, cs: CountryState, ig: string): number {
  return clamp((igTargets(db, cs)[ig] ?? 50) + (cs.igBase[ig] ?? 0), 0, 100);
}

const NEWS_ACTIONS: Record<string, string> = {
  protest: "protests by",
  strike: "strikes called by",
  mass_movement: "a mass movement led by",
  uprising: "an uprising by",
  impeachment: "an impeachment drive backed by",
};

/** One month of interest group actions for a country. Returns the actions taken. */
export function igActions(ctx: SimContext, cs: CountryState): string[] {
  const { db, rng } = ctx;
  const rules = db.politicsRules;
  const taken: string[] = [];
  for (const [ig, s] of Object.entries(cs.interestGroups)) {
    const def = db.interestGroupTypes.get(ig);
    if (!def) continue;
    for (const a of def.actions) {
      if (a.action === "coup" || a.action === "civil_war") continue;
      if (s.approval >= a.approval_below || s.influence < a.min_influence) continue;
      const depth = (a.approval_below - s.approval) / Math.max(1, a.approval_below);
      if (!rng.chance(rules.interest_groups.action_chance * depth)) continue;
      cs.unrest = clamp(cs.unrest + (rules.unrest.action_unrest[a.action] ?? 0.03) * (0.5 + s.influence), 0, 1);
      taken.push(`${a.action}:${ig}`);
      if (ctx.state.player === cs.tag) ctx.log(cs.tag, "unrest", `${NEWS_ACTIONS[a.action] ?? a.action} ${def.name}`.replace(/^./, (c) => c.toUpperCase()));
      break; // one action per group per month
    }
  }
  return taken;
}

export const interestGroupSystem: System = {
  id: "interest_groups",
  weekly({ db, state }) {
    const k = db.politicsRules.interest_groups.weekly_drift;
    for (const cs of Object.values(state.countries)) {
      if (!cs.active) continue;
      const targets = igTargets(db, cs);
      for (const [ig, s] of Object.entries(cs.interestGroups)) {
        const t = clamp((targets[ig] ?? 50) + (cs.igBase[ig] ?? 0), 0, 100);
        s.approval += (t - s.approval) * k;
      }
    }
  },
};
