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
import { moveBuilding, queueBuilding } from "./economy/construction.ts";
import { setResearch } from "./research/research.ts";
import { addLine, moveDivision, setTemplate, trainDivision, type Template } from "./military/military.ts";
import { choosePeace, declareWar, type WarGoal } from "./military/war.ts";
import { applyPlanCommand, type PlanCommand } from "./military/fronts.ts";
import {
  applyToBloc,
  guarantee,
  justifyWar,
  leaveBlocCmd,
  proposeResolution,
  requestAccess,
  sanction,
  setImproveRelations,
  startCampaign,
  stopCampaign,
  tradeDeal,
} from "./diplomacy/diplomacy.ts";

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
  | { type: "take_decision"; tag: string; decision: string }
  /** Tax and spending targets, percent of GDP. */
  | { type: "set_budget"; tag: string; revenue?: number; spending?: number }
  | { type: "queue_building"; tag: string; building: string; province?: number }
  | { type: "cancel_building"; tag: string; index: number }
  | { type: "move_building"; tag: string; index: number; to: number }
  | { type: "set_research"; tag: string; slot: number; tech: string | null }
  | { type: "add_production_line"; tag: string; equipment: string; factories: number }
  | { type: "set_line_factories"; tag: string; line: number; factories: number }
  | { type: "remove_production_line"; tag: string; line: number }
  | { type: "set_template"; tag: string; template: Template }
  | { type: "train_division"; tag: string; template: string }
  | { type: "move_division"; tag: string; division: number; province: number }
  | PlanCommand
  | { type: "declare_war"; tag: string; target: string; goal?: WarGoal }
  | { type: "choose_peace"; annex: boolean }
  | { type: "improve_relations" | "guarantee" | "military_access" | "trade_deal" | "sanction"; tag: string; target: string; on: boolean }
  | { type: "justify_war"; tag: string; target: string }
  | { type: "apply_to_bloc" | "leave_bloc"; tag: string; bloc: string }
  | { type: "propose_resolution"; tag: string; kind: "condemn" | "sanctions"; target: string }
  | { type: "start_influence"; tag: string; target: string; kind: "fund_party" | "back_coup"; arg: string }
  | { type: "stop_influence"; tag: string; id: number };

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
    case "set_budget": {
      const e = state.countries[cmd.tag]?.economy;
      if (!e) return { ok: false, text: "No economy data." };
      if (cmd.revenue !== undefined) e.revenueTarget = Math.max(3, Math.min(70, cmd.revenue));
      if (cmd.spending !== undefined) e.spendingTarget = Math.max(5, Math.min(75, cmd.spending));
      return { ok: true, text: "Budget targets set." };
    }
    case "queue_building":
      return queueBuilding(ctx, cmd.tag, cmd.building, cmd.province);
    case "move_building":
      return moveBuilding(ctx, cmd.tag, cmd.index, cmd.to);
    case "cancel_building": {
      const e = state.countries[cmd.tag]?.economy;
      if (!e?.construction[cmd.index]) return { ok: false, text: "Nothing to cancel." };
      e.construction.splice(cmd.index, 1);
      return { ok: true, text: "Removed from the queue." };
    }
    case "set_research":
      return setResearch(ctx, cmd.tag, cmd.slot, cmd.tech);
    case "add_production_line":
      return addLine(ctx, cmd.tag, cmd.equipment, cmd.factories);
    case "set_line_factories": {
      const l = state.countries[cmd.tag]?.military?.lines.find((x) => x.id === cmd.line);
      if (!l) return { ok: false, text: "No such production line." };
      l.factories = Math.max(1, Math.min(db.militaryRules.max_factories_per_line, Math.round(cmd.factories)));
      return { ok: true, text: `${l.factories} factories assigned.` };
    }
    case "remove_production_line": {
      const m = state.countries[cmd.tag]?.military;
      if (!m) return { ok: false, text: "No military." };
      m.lines = m.lines.filter((x) => x.id !== cmd.line);
      return { ok: true, text: "Production line closed." };
    }
    case "set_template":
      return setTemplate(ctx, cmd.tag, cmd.template);
    case "train_division":
      return trainDivision(ctx, cmd.tag, cmd.template);
    case "move_division":
      return moveDivision(ctx, cmd.tag, cmd.division, cmd.province);
    case "create_army":
    case "disband_army":
    case "assign_divisions":
    case "set_front":
    case "set_offensive":
    case "add_spearhead":
    case "clear_plan":
    case "execute_plan":
      return applyPlanCommand(ctx, cmd);
    case "declare_war":
      return declareWar(ctx, cmd.tag, cmd.target, cmd.goal);
    case "improve_relations":
      return setImproveRelations(ctx, cmd.tag, cmd.target, cmd.on);
    case "guarantee":
      return guarantee(ctx, cmd.tag, cmd.target, cmd.on);
    case "military_access":
      return requestAccess(ctx, cmd.tag, cmd.target, cmd.on);
    case "trade_deal":
      return tradeDeal(ctx, cmd.tag, cmd.target, cmd.on);
    case "sanction":
      return sanction(ctx, cmd.tag, cmd.target, cmd.on);
    case "justify_war":
      return justifyWar(ctx, cmd.tag, cmd.target);
    case "apply_to_bloc":
      return applyToBloc(ctx, cmd.tag, cmd.bloc);
    case "leave_bloc":
      return leaveBlocCmd(ctx, cmd.tag, cmd.bloc);
    case "propose_resolution":
      return proposeResolution(ctx, cmd.tag, cmd.kind, cmd.target);
    case "start_influence":
      return startCampaign(ctx, cmd.tag, cmd.target, cmd.kind, cmd.arg);
    case "stop_influence":
      return stopCampaign(ctx, cmd.tag, cmd.id);
    case "choose_peace":
      return choosePeace(ctx, cmd.annex);
    case "force_coup": {
      const cs = state.countries[cmd.tag];
      if (!cs || !db.interestGroupTypes.has(cmd.group)) return { ok: false, text: "Unknown country or group." };
      regimeChange(ctx, cs, cmd.group, "coup");
      return { ok: true, text: "Coup staged." };
    }
  }
}
