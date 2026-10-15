/**
 * Units (Phase 9): equipment (data/units/equipment.json), battalion types
 * (data/units/sub_units.json), default division templates and military rules
 * (data/units/military.json). Equipment and units are generic abstractions; no real product names.
 */
import { z } from "zod";
import { Id } from "./common.ts";

const n = (v: number) => z.number().default(v);

export const EquipmentStats = z.strictObject({
  soft_attack: n(0),
  hard_attack: n(0),
  air_attack: n(0),
  defence: n(0),
  breakthrough: n(0),
  armour: n(0),
  piercing: n(0),
  /** km/h; omit for equipment that does not set a unit's speed. */
  speed: z.number().optional(),
});
export type EquipmentStats = z.infer<typeof EquipmentStats>;

export const EquipmentVariant = z.strictObject({
  id: Id,
  name: z.string(),
  /** Technology that unlocks this variant (omit for the base variant). */
  requires_tech: Id.optional(),
  /** Military-factory days per unit. */
  cost: z.number().positive(),
  stats: EquipmentStats,
});
export type EquipmentVariant = z.infer<typeof EquipmentVariant>;

export const EquipmentDef = z.strictObject({
  id: Id,
  name: z.string(),
  description: z.string(),
  domain: z.enum(["land", "air", "naval"]),
  /** Variants from oldest to newest; units use the best variant in the stockpile. */
  variants: z.array(EquipmentVariant).min(1),
});
export type EquipmentDef = z.infer<typeof EquipmentDef>;
export const EquipmentFile = z.strictObject({ equipment: z.array(EquipmentDef), note: z.string().optional() });

export const SubUnitDef = z.strictObject({
  id: Id,
  name: z.string(),
  description: z.string(),
  kind: z.enum(["battalion", "support"]),
  manpower: z.number().int().positive(),
  /** Equipment needed at full strength: equipment id -> count. */
  equipment: z.record(Id, z.number().int().positive()),
  /** Base stats before equipment. */
  organisation: n(30),
  hp: n(2),
  width: n(2),
  /** km/h when no equipment sets a speed. */
  speed: n(4),
  training_days: n(90),
});
export type SubUnitDef = z.infer<typeof SubUnitDef>;
export const SubUnitsFile = z.strictObject({ sub_units: z.array(SubUnitDef), note: z.string().optional() });

export const TemplateDef = z.strictObject({
  id: Id,
  name: z.string(),
  /** Sub-unit id -> count. */
  units: z.record(Id, z.number().int().positive()),
  /** Countries at or above this tier of the starting-army mix use it (0 = everyone). */
  modern_level: z.number().int().min(0).max(2).default(0),
});
export type TemplateDef = z.infer<typeof TemplateDef>;

export const MilitaryRulesFile = z.strictObject({
  note: z.string().optional(),
  /** Share of population available as military manpower, by conscription law. */
  manpower_share: z.record(Id, z.number().min(0).max(0.3)).default({}),
  /** Share of the manpower pool restored each month. */
  manpower_recovery: n(0.02),
  /** Output: equipment = factories * efficiency / cost per day. Efficiency grows daily toward the cap. */
  base_efficiency: n(0.1),
  efficiency_cap: n(0.5),
  efficiency_growth: n(0.01),
  max_factories_per_line: n(15),
  /** Starting armies: share of armed forces personnel serving in land divisions, and personnel per division. */
  land_share: n(0.6),
  personnel_per_division: n(12000),
  /** Starting stockpile on top of what starting divisions use. */
  reserve_stockpile: n(0.15),
  /** Hours of marching per day. */
  march_hours: n(10),
  max_division_width: n(30),
  templates: z.array(TemplateDef).default([]),
});
export type MilitaryRules = z.infer<typeof MilitaryRulesFile>;
