/**
 * Scripted content at runtime: events (historical dates, random events, triggered events),
 * national focuses and decisions. The player answers events and picks focuses and decisions
 * through commands; AI countries choose by the content's ai_weight.
 */
import type { ContentDB } from "../../content/compile.ts";
import type { DecisionDef, FocusDef } from "../../content/schemas/scripted.ts";
import { dayOf } from "../date.ts";
import type { SimContext, System } from "../simulation.ts";
import type { CountryState, GameState } from "../state.ts";
import { evalTrigger, runEffects, type Scope } from "./engine.ts";

const scopeOf = (tag: string, from: string | null = null): Scope => ({ tag, root: tag, from });
/** Countries that run scripted content: active, with politics data, not a civil-war side. */
const actors = (db: ContentDB, state: GameState) => Object.values(state.countries).filter((c) => c.active && !!db.countries.get(c.tag)?.country);

// ------------------------------------------------------------------ events

/** Fire an event for a country: the player gets a choice, AI countries answer at once. */
export function fireEvent(ctx: SimContext, eventId: string, tag: string, from: string | null): void {
  const { db, state, rng } = ctx;
  const ev = db.events.get(eventId);
  const cs = state.countries[tag];
  if (!ev || !cs) return;
  cs.eventsFired[eventId] = state.day;
  if (ev.major) ctx.log(tag, "event", ev.title);
  if (tag === state.player) {
    state.pendingEvents.push({ key: `${eventId}:${tag}:${state.day}`, event: eventId, tag, from, day: state.day });
    ctx.emit({ type: "event", tag, event: eventId });
    return;
  }
  const options = ev.options.filter((o) => o.trigger === undefined || evalTrigger(ctx, scopeOf(tag, from), o.trigger));
  if (!options.length) return;
  const pick = options[rng.weighted(options.map((o) => o.ai_weight))]!;
  runEffects(ctx, scopeOf(tag, from), pick.effects, `event:${eventId}`);
}

/** The player's answer to a pending event. */
export function answerEvent(ctx: SimContext, key: string, optionId: string): { ok: boolean; text: string } {
  const { db, state } = ctx;
  const i = state.pendingEvents.findIndex((p) => p.key === key);
  const pe = state.pendingEvents[i];
  const ev = pe ? db.events.get(pe.event) : undefined;
  const opt = ev?.options.find((o) => o.id === optionId);
  if (!pe || !ev || !opt) return { ok: false, text: "That choice is no longer open." };
  if (opt.trigger !== undefined && !evalTrigger(ctx, scopeOf(pe.tag, pe.from), opt.trigger)) return { ok: false, text: "That option is not available." };
  state.pendingEvents.splice(i, 1);
  runEffects(ctx, scopeOf(pe.tag, pe.from), opt.effects, `event:${ev.id}`);
  return { ok: true, text: opt.name };
}

function canFire(ctx: SimContext, cs: CountryState, eventId: string): boolean {
  const ev = ctx.db.events.get(eventId)!;
  if (ev.countries && !ev.countries.includes(cs.tag)) return false;
  if (ev.fire_only_once && eventId in cs.eventsFired) return false;
  return evalTrigger(ctx, scopeOf(cs.tag), ev.trigger);
}

// ------------------------------------------------------------------ focuses

export type FocusStatus = "completed" | "current" | "available" | "locked" | "excluded" | "unavailable";

export function focusOf(db: ContentDB, cs: CountryState, id: string): FocusDef | undefined {
  return db.focusTrees.get(cs.focus.tree)?.focuses.find((f) => f.id === id);
}

export function focusStatus(ctx: Pick<SimContext, "db" | "state" | "rng" | "map" | "log" | "emit">, cs: CountryState, f: FocusDef): FocusStatus {
  if (cs.focus.completed.includes(f.id)) return "completed";
  if (cs.focus.current === f.id) return "current";
  if (f.mutually_exclusive.some((m) => cs.focus.completed.includes(m) || cs.focus.current === m)) return "excluded";
  if (!f.prerequisites.every((g) => g.some((p) => cs.focus.completed.includes(p)))) return "locked";
  if (f.available !== undefined && !evalTrigger(ctx as SimContext, scopeOf(cs.tag), f.available)) return "unavailable";
  return "available";
}

function completeFocus(ctx: SimContext, cs: CountryState, f: FocusDef, bypassed: boolean): void {
  cs.focus.completed.push(f.id);
  if (cs.focus.current === f.id) {
    cs.focus.current = null;
    cs.focus.progress = 0;
  }
  if (!bypassed) runEffects(ctx, scopeOf(cs.tag), f.effects, `focus:${f.id}`);
  if (cs.tag === ctx.state.player) ctx.log(cs.tag, "focus", `Focus completed: ${f.name}`);
}

export function setFocus(ctx: SimContext, tag: string, focusId: string): { ok: boolean; text: string } {
  const cs = ctx.state.countries[tag];
  const f = cs ? focusOf(ctx.db, cs, focusId) : undefined;
  if (!cs || !f) return { ok: false, text: "Unknown focus." };
  const st = focusStatus(ctx, cs, f);
  if (st !== "available") return { ok: false, text: st === "completed" ? "Already completed." : st === "current" ? "Already in progress." : "Not available yet." };
  cs.focus.current = f.id;
  cs.focus.progress = 0;
  return { ok: true, text: `Working on ${f.name}.` };
}

function aiPickFocus(ctx: SimContext, cs: CountryState): void {
  const tree = ctx.db.focusTrees.get(cs.focus.tree);
  if (!tree) return;
  const options = tree.focuses.filter((f) => f.ai_weight > 0 && focusStatus(ctx, cs, f) === "available");
  if (!options.length) return;
  cs.focus.current = options[ctx.rng.weighted(options.map((f) => f.ai_weight))]!.id;
  cs.focus.progress = 0;
}

// ------------------------------------------------------------------ decisions

export type DecisionStatus = { visible: boolean; available: boolean; reasons: string[] };

export function decisionStatus(ctx: SimContext, cs: CountryState, d: DecisionDef): DecisionStatus {
  const reasons: string[] = [];
  if (d.countries && !d.countries.includes(cs.tag)) return { visible: false, available: false, reasons: ["Not for this country."] };
  const scope = scopeOf(cs.tag);
  if (d.visible !== undefined && !evalTrigger(ctx, scope, d.visible)) return { visible: false, available: false, reasons: [] };
  if (d.fire_once && d.id in cs.decisionCooldowns) return { visible: false, available: false, reasons: [] };
  const cd = cs.decisionCooldowns[d.id];
  if (cd !== undefined && cd > ctx.state.day) reasons.push(`Available again in ${cd - ctx.state.day} days.`);
  if (cs.activeDecisions.some((a) => a.id === d.id)) reasons.push("Already in effect.");
  if (cs.politicalPower < d.cost.political_power) reasons.push(`Needs ${d.cost.political_power} political power.`);
  if (d.available !== undefined && !evalTrigger(ctx, scope, d.available)) reasons.push("Conditions not met.");
  return { visible: true, available: reasons.length === 0, reasons };
}

export function takeDecision(ctx: SimContext, tag: string, id: string): { ok: boolean; text: string } {
  const cs = ctx.state.countries[tag];
  const d = ctx.db.decisions.get(id);
  if (!cs || !d) return { ok: false, text: "Unknown decision." };
  const st = decisionStatus(ctx, cs, d);
  if (!st.available) return { ok: false, text: st.reasons.join(" ") || "Not available." };
  cs.politicalPower -= d.cost.political_power;
  cs.decisionCooldowns[d.id] = ctx.state.day + Math.max(d.cooldown_days, d.days ?? 0);
  runEffects(ctx, scopeOf(tag), d.effects, `decision:${d.id}`);
  if (d.days) cs.activeDecisions.push({ id: d.id, until: ctx.state.day + d.days });
  if (tag === ctx.state.player) ctx.log(tag, "decision", d.name);
  return { ok: true, text: d.name };
}

// ------------------------------------------------------------------ system

export function createScriptedSystem(): System {
  let historical = new Map<number, string[]>();
  return {
    id: "scripted",
    init({ db, state }) {
      historical = new Map();
      for (const e of db.events.values()) {
        if (!e.historical) continue;
        const d = dayOf(e.historical.date);
        if (d > state.day) historical.set(d, [...(historical.get(d) ?? []), e.id]);
      }
    },
    daily(ctx) {
      const { db, state } = ctx;
      for (const cs of actors(db, state)) {
        if (cs.timedModifiers.length) cs.timedModifiers = cs.timedModifiers.filter((m) => m.until > state.day);
        for (const a of cs.activeDecisions.filter((x) => x.until <= state.day)) {
          const d = db.decisions.get(a.id);
          if (d) runEffects(ctx, scopeOf(cs.tag), d.complete_effects, `decision:${d.id}`);
        }
        cs.activeDecisions = cs.activeDecisions.filter((x) => x.until > state.day);

        // national focus
        const tree = db.focusTrees.get(cs.focus.tree);
        if (!tree) continue;
        if (cs.focus.current) {
          const f = tree.focuses.find((x) => x.id === cs.focus.current);
          if (!f) cs.focus.current = null;
          else if (++cs.focus.progress >= f.days) completeFocus(ctx, cs, f, false);
        } else if (cs.tag !== state.player && state.day % 7 === 0) aiPickFocus(ctx, cs);
        // bypassed focuses complete on their own (checked weekly)
        if (state.day % 7 === 3)
          for (const f of tree.focuses)
            if (f.bypass !== undefined && !cs.focus.completed.includes(f.id) && focusStatus(ctx, cs, f) !== "excluded" && evalTrigger(ctx, scopeOf(cs.tag), f.bypass))
              completeFocus(ctx, cs, f, true);
      }

      // historical events on their real date
      for (const id of historical.get(state.day) ?? []) {
        const ev = db.events.get(id)!;
        const h = ev.historical!;
        if (state.rules.electionMode === "dynamic" && !h.dynamic_mode) continue;
        for (const cs of actors(db, state)) {
          if (state.rules.electionMode === "historical" && !cs.followsHistory && !h.any_path) continue;
          if (canFire(ctx, cs, id)) fireEvent(ctx, id, cs.tag, null);
        }
      }
      // queued events
      if (state.scheduledEvents.length) {
        const due = state.scheduledEvents.filter((e) => e.day <= state.day);
        state.scheduledEvents = state.scheduledEvents.filter((e) => e.day > state.day);
        for (const e of due) if (state.countries[e.tag]?.active) fireEvent(ctx, e.event, e.tag, e.from);
      }
    },
    monthly(ctx) {
      const { db, state, rng } = ctx;
      const countries = actors(db, state);
      // random events
      for (const ev of db.events.values()) {
        if (!ev.mean_days) continue;
        const p = Math.min(1, 30 / ev.mean_days);
        for (const cs of countries) if (rng.chance(p) && canFire(ctx, cs, ev.id)) fireEvent(ctx, ev.id, cs.tag, null);
      }
      // AI decisions
      for (const cs of countries) {
        if (cs.tag === state.player) continue;
        for (const d of db.decisions.values()) {
          if (d.ai_weight <= 0 || !rng.chance(Math.min(0.5, 0.1 * d.ai_weight))) continue;
          if (decisionStatus(ctx, cs, d).available) takeDecision(ctx, cs.tag, d.id);
        }
      }
    },
  };
}
