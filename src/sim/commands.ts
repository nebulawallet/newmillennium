/**
 * Commands: the only way the player (and later the AI) changes the game state. Each command is
 * plain data, validated and applied by the simulation between ticks.
 */
import type { SimContext } from "./simulation.ts";
import { choosePendingCoalition } from "./politics/coalition.ts";
import { scheduleSnapElection } from "./politics/elections.ts";
import { changeLaw } from "./politics/laws.ts";
import { regimeChange, startCivilWar } from "./politics/unrest.ts";
import { answerEvent, setFocus, takeDecision } from "./scripting/systems.ts";

export type Command =
  | { type: "change_law"; tag: string; category: string; law: string }
  | { type: "choose_coalition"; option: number }
  | { type: "call_snap_election"; tag: string; chamber: string }
  /** Debug and scripting: force a civil war or a coup by an interest group. */
  | { type: "force_civil_war"; tag: string; group: string }
  | { type: "force_coup"; tag: string; group: string }
  | { type: "answer_event"; key: string; option: string }
  | { type: "set_focus"; tag: string; focus: string }
  | { type: "cancel_focus"; tag: string }
  | { type: "take_decision"; tag: string; decision: string };

export interface CommandResult {
  ok: boolean;
  text: string;
}

export function applyCommand(ctx: SimContext, cmd: Command): CommandResult {
  const { state, db } = ctx;
  switch (cmd.type) {
    case "change_law": {
      const r = changeLaw(ctx, cmd.tag, cmd.category, cmd.law);
      return { ok: r.passed, text: r.passed ? "Law enacted." : r.reasons.join(" ") || "The bill was defeated." };
    }
    case "choose_coalition":
      return choosePendingCoalition(ctx, cmd.option);
    case "call_snap_election": {
      const cs = state.countries[cmd.tag];
      if (!cs) return { ok: false, text: "Unknown country." };
      const cost = 50;
      if (cs.politicalPower < cost) return { ok: false, text: `Needs ${cost} political power.` };
      if (!scheduleSnapElection(ctx, cs, cmd.chamber, db.politicsRules.coalitions.snap_election_delay_days))
        return { ok: false, text: "No early election is possible for this chamber now." };
      cs.politicalPower -= cost;
      cs.followsHistory = false;
      return { ok: true, text: "Early election called." };
    }
    case "force_civil_war": {
      const cs = state.countries[cmd.tag];
      if (!cs || !db.interestGroupTypes.has(cmd.group)) return { ok: false, text: "Unknown country or group." };
      const rebel = startCivilWar(ctx, cs, cmd.group);
      return rebel ? { ok: true, text: `Civil war started (${rebel}).` } : { ok: false, text: "A civil war is already under way." };
    }
    case "answer_event":
      return answerEvent(ctx, cmd.key, cmd.option);
    case "set_focus":
      return setFocus(ctx, cmd.tag, cmd.focus);
    case "cancel_focus": {
      const cs = state.countries[cmd.tag];
      if (!cs?.focus.current) return { ok: false, text: "No focus in progress." };
      cs.focus.current = null;
      cs.focus.progress = 0;
      return { ok: true, text: "Focus cancelled." };
    }
    case "take_decision":
      return takeDecision(ctx, cmd.tag, cmd.decision);
    case "force_coup": {
      const cs = state.countries[cmd.tag];
      if (!cs || !db.interestGroupTypes.has(cmd.group)) return { ok: false, text: "Unknown country or group." };
      regimeChange(ctx, cs, cmd.group, "coup");
      return { ok: true, text: "Coup staged." };
    }
  }
}
