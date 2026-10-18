/**
 * Wars and armed groups already under way on 1 January 2000 (data/conflicts/wars_2000.json): the Second
 * Congo War, the Eritrean–Ethiopian War, the Afghan civil war, the Second Chechen War and others. A new game
 * opens them once, before the first day; each one ends through a dated event in data/events/conflicts.json.
 * Like wars started by historical events they are scripted (no justification penalty, no end by exhaustion
 * in historical mode) and limited unless the data says otherwise.
 */
import { dayOf, formatDate } from "../date.ts";
import { declareWar, hostile } from "../military/war.ts";
import type { System } from "../simulation.ts";
import { spawnArmedGroup } from "./armedGroups.ts";

export const startConflictsSystem: System = {
  id: "start_conflicts",
  init(ctx) {
    const { db, state } = ctx;
    if (state.startConflicts || state.day !== 0) return;
    state.startConflicts = true;
    // these wars were already running: world tension and war support keep their starting values
    const tension = state.worldTension;
    const support = new Map(Object.entries(state.countries).map(([t, c]) => [t, c.warSupport]));
    for (const g of db.startConflicts.groups) {
      const before = state.wars.length;
      spawnArmedGroup(ctx, g.group, g.regions, g.divisions);
      for (const war of state.wars.slice(before)) {
        if (g.war_name) war.name = g.war_name;
        if (g.began) war.startDay = dayOf(g.began);
      }
    }
    for (const w of db.startConflicts.wars) {
      const a = state.countries[w.attacker], d = state.countries[w.defender];
      if (!a?.active || !d?.active || hostile(state, w.attacker, w.defender)) continue;
      // a side that holds no land (an insurgency that lost it, a country missing from this map) is skipped
      const holds = (t: string) => state.provinceController.includes(t) || state.provinceOwner.includes(t);
      if (!holds(w.attacker) || !holds(w.defender)) continue;
      // no allies are called in: who fought in these wars is in the data, not in bloc treaties
      const r = declareWar(ctx, w.attacker, w.defender, w.goal, false, true, undefined, false);
      if (!r.ok) continue;
      const war = state.wars[state.wars.length - 1]!;
      war.name = w.name;
      war.startDay = dayOf(w.began);
      const entry = state.log[state.log.length - 1];
      if (entry?.tag === w.attacker && entry.kind === "war") entry.text = `${w.name}: at war since ${formatDate(war.startDay)}`;
    }
    state.worldTension = tension;
    for (const [t, v] of support) state.countries[t]!.warSupport = v;
  },
};
