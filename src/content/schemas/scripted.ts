/**
 * Schemas for scripted content: events, decisions and national focus trees. Trigger and effect
 * scripts are checked against the registry (src/content/script) by the compiler.
 */
import { z } from "zod";
import { Id, IsoDate, Tag, sourced } from "./common.ts";

/** A trigger node (validated by the script validator, not by zod). */
export const Trigger = z.unknown();
/** An effect list (validated by the script validator). */
export const Effects = z.array(z.unknown()).default([]);

export const EventOption = z.strictObject({
  id: Id,
  name: z.string().min(1),
  /** Only shown when true. */
  trigger: Trigger.optional(),
  /** Relative weight when the AI chooses (0 = never). */
  ai_weight: z.number().min(0).default(1),
  effects: Effects,
});

export const EventDef = z.strictObject({
  id: Id,
  title: z.string().min(1),
  /** Neutral text. Events about real events describe documented facts only. */
  description: z.string().min(1),
  /** Countries that can receive the event (omit = any country with politics data). */
  countries: z.array(Tag).optional(),
  trigger: Trigger.optional(),
  /** Fires on this real date (historical mode, while the country follows history unless `any_path`). */
  historical: z
    .strictObject({
      date: IsoDate,
      /** Also fire after the country has left the historical path (e.g. world events). */
      any_path: z.boolean().default(false),
      /** Also fire in dynamic mode (world events that are not political outcomes). */
      dynamic_mode: z.boolean().default(false),
      ...sourced,
    })
    .optional(),
  /** Random event: average days until it fires while its trigger holds (checked monthly). */
  mean_days: z.number().positive().optional(),
  /** Only fired by a country_event effect. */
  triggered_only: z.boolean().default(false),
  fire_only_once: z.boolean().default(true),
  /** Reported in every country's news. */
  major: z.boolean().default(false),
  options: z.array(EventOption).min(1),
});
export type EventDef = z.infer<typeof EventDef>;
export const EventsFile = z.strictObject({ events: z.array(EventDef), note: z.string().optional() });

export const DecisionDef = z.strictObject({
  id: Id,
  name: z.string().min(1),
  description: z.string().min(1),
  category: Id,
  countries: z.array(Tag).optional(),
  /** Shown in the list when true (default: always). */
  visible: Trigger.optional(),
  /** Can be taken when true (default: always). */
  available: Trigger.optional(),
  cost: z.strictObject({ political_power: z.number().min(0).default(0) }).prefault({}),
  /** Takes effect immediately. */
  effects: Effects,
  /** Optional duration: `complete_effects` run when it ends. */
  days: z.number().int().positive().optional(),
  complete_effects: Effects,
  /** Days before it can be taken again (omit with fire_once for one-off decisions). */
  cooldown_days: z.number().int().min(0).default(365),
  fire_once: z.boolean().default(false),
  ai_weight: z.number().min(0).default(1),
});
export type DecisionDef = z.infer<typeof DecisionDef>;
export const DecisionsFile = z.strictObject({
  categories: z.array(z.strictObject({ id: Id, name: z.string(), description: z.string() })).default([]),
  decisions: z.array(DecisionDef),
});

export const FocusDef = z.strictObject({
  id: Id,
  name: z.string().min(1),
  description: z.string().min(1),
  /** Grid position in the tree view. */
  x: z.number().int(),
  y: z.number().int().min(0),
  days: z.number().int().positive().default(70),
  /** All groups must be satisfied; within a group any one completed focus is enough. */
  prerequisites: z.array(z.array(Id).min(1)).default([]),
  mutually_exclusive: z.array(Id).default([]),
  available: Trigger.optional(),
  /** Completed automatically (without effects) when true. */
  bypass: Trigger.optional(),
  effects: Effects,
  ai_weight: z.number().min(0).default(1),
});
export type FocusDef = z.infer<typeof FocusDef>;

export const FocusTreeFile = z.strictObject({
  id: Id,
  name: z.string().min(1),
  /** Countries using this tree; empty = the generic tree for everyone else. */
  countries: z.array(Tag).default([]),
  focuses: z.array(FocusDef).min(1),
  /** Trees about real governments cite their sources (policies named in focuses). */
  source: sourced.source.optional(),
  confidence: sourced.confidence.optional(),
  note: z.string().optional(),
});
export type FocusTree = z.infer<typeof FocusTreeFile>;
