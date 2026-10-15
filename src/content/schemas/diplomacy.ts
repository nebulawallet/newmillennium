/** Diplomacy (Phase 11): blocs, the UN Security Council and diplomatic rules (data/diplomacy). */
import { z } from "zod";
import { Id, IsoDate, Tag, sourced } from "./common.ts";
import { Trigger } from "./scripted.ts";

const n = (v: number) => z.number().default(v);

export const BlocDef = z.strictObject({
  id: Id,
  name: z.string().min(1),
  /** Whether running text puts "the" before the name ("the European Union", but "NATO"). */
  article: z.boolean().default(true),
  /** Colour in the blocs map mode. */
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default("#888888"),
  description: z.string().min(1),
  /** military blocs with `defensive` call members into defensive wars; economic blocs add trade growth. */
  kind: z.enum(["military", "economic", "political"]),
  defensive: z.boolean().default(false),
  /** Opinion members hold of each other. */
  opinion: z.number().default(10),
  /** GDP growth points for members, scaled by the bloc's share of world GDP. */
  trade_growth: z.number().min(0).default(0),
  /** Days from an accepted application to membership. */
  accession_days: z.number().int().positive().default(730),
  /** A bloc whose members distrust this one's. */
  rival: Id.optional(),
  /** Applicants must meet this (scoped to the applicant). */
  join_trigger: Trigger.optional(),
  /** Later names (e.g. the OAU becoming the African Union). */
  renamed: z.array(z.strictObject({ date: IsoDate, name: z.string().min(1), ...sourced })).default([]),
  members_2000: z.array(Tag),
  ...sourced,
});
export type BlocDef = z.infer<typeof BlocDef>;
export const BlocsFile = z.strictObject({ note: z.string().optional(), blocs: z.array(BlocDef) });

export const UnFile = z.strictObject({
  note: z.string().optional(),
  permanent: z.array(Tag),
  /** Non-permanent seats per regional group. */
  seats: z.record(Id, z.number().int().positive()),
  groups: z.record(Id, z.array(Tag)),
  /** Real elected members with their terms; later terms are simulated. */
  elected: z.array(z.strictObject({ tags: z.array(Tag), from: IsoDate, until: IsoDate })),
  ...sourced,
});
export type UnData = z.infer<typeof UnFile>;

export const DiplomacyRulesFile = z.strictObject({
  note: z.string().optional(),
  /** Scale of ideology-group affinity (-100..100) into opinion. */
  ideology_weight: n(0.4),
  rival_bloc_opinion: n(-15),
  at_war_opinion: n(-100),
  guarantee_opinion: n(25),
  sanction_opinion: n(-40),
  trade_deal_opinion: n(10),
  aggressor_opinion: n(-30),
  /** Improve relations: opinion per month, its cap, PP per month, and how many at once. */
  improve_per_month: n(4),
  improve_cap: n(50),
  improve_pp_monthly: n(3),
  improve_slots: n(3),
  /** Opinion a country needs of the requester to grant access or a trade deal, or to admit a bloc applicant. */
  access_opinion: n(30),
  trade_opinion: n(0),
  join_opinion: n(20),
  guarantee_pp: n(25),
  sanction_pp: n(10),
  /** Growth points lost by a sanctioned country, times the sanctioners' share of world GDP. */
  sanctions_growth: n(6),
  /** Growth points per trade deal, times the partner's share of world GDP (capped). */
  trade_deal_growth: n(3),
  trade_growth_cap: n(0.8),
  /** War justification: days (shorter with world tension) and political power. */
  justify_days: n(90),
  justify_pp: n(30),
  justification_valid_days: n(365),
  /** Penalties for war without a justification. */
  unjustified_stability: n(-0.1),
  unjustified_tension_multiplier: n(2),
  /** UN Security Council: votes needed; opinion a permanent member needs of the target to veto. */
  unsc_votes_needed: n(9),
  veto_opinion: n(40),
  sanctions_resolution_days: n(730),
  /** Foreign influence: PP per month, popularity shift per month, monthly exposure chance. */
  influence_pp_monthly: n(2),
  influence_popularity: n(0.006),
  influence_detection: n(0.04),
  influence_exposed_opinion: n(-40),
  coup_days: n(180),
  coup_pp: n(50),
  coup_success_bonus: n(0.25),
  ...{ source: sourced.source.optional(), confidence: sourced.confidence.optional() },
});
export type DiplomacyRules = z.infer<typeof DiplomacyRulesFile>;
