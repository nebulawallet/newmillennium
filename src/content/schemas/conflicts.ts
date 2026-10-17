/**
 * Non-state armed groups (data/conflicts/armed_groups.json). A group is not on the map at the start:
 * historical events spawn it on real regions (spawn_armed_group), shrink it (armed_group_loses) and end it
 * (end_armed_group), so it can fight as a side in the war system. See docs/CONFLICTS_PLAN.md.
 */
import { z } from "zod";
import { Color, Id, sourced, Tag } from "./common.ts";

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
