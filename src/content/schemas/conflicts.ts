/**
 * Non-state armed groups (data/conflicts/armed_groups.json). A group is not on the map at the start:
 * historical events spawn it on real regions (spawn_armed_group), shrink it (armed_group_loses) and end it
 * (end_armed_group), so it can fight as a side in the war system. See docs/CONFLICTS_PLAN.md.
 */
import { z } from "zod";
import { Color, Id, IsoDate, sourced, Tag } from "./common.ts";

export const ArmedGroup = z.strictObject({
  /** Three letters, distinct from every tag in world/countries.json. */
  tag: Tag,
  name: z.string(),
  short_name: z.string().optional(),
  color: Color,
  kind: z.enum(["insurgency", "militant_group", "separatist", "rebel_coalition"]),
  /** Division template the group fields (data/units/military.json), equipped with the oldest variants. */
  template: Id.default("infantry_division"),
  description: z.string(),
  ...sourced,
});
export type ArmedGroup = z.infer<typeof ArmedGroup>;

export const ArmedGroupsFile = z.strictObject({
  note: z.string().optional(),
  groups: z.array(ArmedGroup),
});

/** A region of a country's provinces: map adm1 codes or province names (all of them if neither). */
const Region = z.strictObject({ from: Tag, adm1: z.array(z.string()).optional(), provinces: z.array(z.string()).optional() });

/** A war already under way on 1 January 2000; opened when a new game starts. Its end is a dated event. */
export const StartWar = z.strictObject({
  id: Id,
  name: z.string(),
  attacker: Tag,
  defender: Tag,
  /** The real start date (shown as the war's start). */
  began: IsoDate,
  goal: z.enum(["conquest", "status_quo", "limited"]).default("limited"),
  ...sourced,
});
export type StartWar = z.infer<typeof StartWar>;

/** An armed group already holding land on 1 January 2000 (data/conflicts/armed_groups.json defines it). */
export const StartGroup = z.strictObject({
  group: Tag,
  regions: z.array(Region),
  divisions: z.number().int().min(0),
  /** The name its war goes by, and the war's real start date. */
  war_name: z.string().optional(),
  began: IsoDate.optional(),
  ...sourced,
});
export type StartGroup = z.infer<typeof StartGroup>;

export const StartConflictsFile = z.strictObject({
  note: z.string().optional(),
  wars: z.array(StartWar),
  groups: z.array(StartGroup).default([]),
});
