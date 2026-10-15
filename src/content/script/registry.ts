/**
 * Registry of scripting effects and triggers shared by focuses, events and decisions.
 *
 * Phase 1 defines names and argument schemas so validate-data can check every script.
 * Execution handlers are attached in Phase 6 (src/sim/scripting).
 *
 * Script format (JSON):
 *   trigger node:  { "<trigger>": args }  |  { "all": [..] } | { "any": [..] } | { "not": node }
 *                  | { "<scope>": { "limit"?: node, "trigger": node } }   (scoped trigger, e.g. any_neighbor)
 *   effect list:   [ { "<effect>": args }, ... ]
 *                  control: { "if": { "limit": trigger, "then": [..], "else"?: [..] } }
 *                           { "random_list": [ { "weight": n, "effects": [..] }, ... ] }
 *                           { "<scope>": { "limit"?: trigger, "effects": [..] } }
 */
import { z } from "zod";
import { Id, IsoDate, ScopedId, Share, Tag } from "../schemas/common.ts";

/** What kind of content id an argument refers to; checked against the content database. */
export type RefKind =
  | "tag"
  | "person"
  | "party"
  | "office"
  | "sub_ideology"
  | "ideology_group"
  | "law"
  | "law_category"
  | "interest_group"
  | "government_type"
  | "trait"
  | "modifier"
  | "tech";

interface ScriptDef {
  args: z.ZodType;
  description: string;
  /** Reference checks: arg path (dot-separated, "" = whole arg) -> kind. */
  refs?: Record<string, RefKind>;
}

const num = z.number();
const igArgs = z.strictObject({ group: Id, value: num });

export const EFFECTS: Record<string, ScriptDef> = {
  add_stability: { args: num, description: "Add to stability (0..1 scale)." },
  add_war_support: { args: num, description: "Add to war support (0..1 scale)." },
  add_political_power: { args: num, description: "Add political power." },
  add_treasury: { args: num, description: "Add money to the treasury (billions USD)." },
  set_flag: { args: Id, description: "Set a country flag." },
  clear_flag: { args: Id, description: "Clear a country flag." },
  set_global_flag: { args: Id, description: "Set a global flag." },
  add_timed_modifier: {
    args: z.strictObject({ modifier: Id, value: num, days: z.number().int().positive() }),
    description: "Apply a modifier for a number of days.",
    refs: { modifier: "modifier" },
  },
  set_leader: {
    args: z.strictObject({ office: ScopedId, person: ScopedId }),
    description: "Put a person into an office.",
    refs: { office: "office", person: "person" },
  },
  set_party_popularity: {
    args: z.strictObject({ party: ScopedId, value: Share }),
    description: "Set a party's popularity.",
    refs: { party: "party" },
  },
  add_party_popularity: {
    args: z.strictObject({ party: ScopedId, value: num }),
    description: "Add to a party's popularity.",
    refs: { party: "party" },
  },
  set_party_leader: {
    args: z.strictObject({ party: ScopedId, person: ScopedId }),
    description: "Change a party's leader.",
    refs: { party: "party", person: "person" },
  },
  add_ideology_support: {
    args: z.strictObject({ sub_ideology: Id, value: num }),
    description: "Shift popular support toward (or away from) a sub-ideology.",
    refs: { sub_ideology: "sub_ideology" },
  },
  hold_election: {
    args: z.strictObject({ kind: z.enum(["presidential", "legislative", "referendum"]), chamber: Id.optional() }),
    description: "Hold an election now (snap election).",
  },
  change_law: {
    args: z.strictObject({ category: Id, law: Id }),
    description: "Enact a law without a vote or cost.",
    refs: { category: "law_category", law: "law" },
  },
  add_interest_group_approval: {
    args: igArgs,
    description: "Change an interest group's approval of the government.",
    refs: { group: "interest_group" },
  },
  add_interest_group_influence: {
    args: igArgs,
    description: "Change an interest group's influence.",
    refs: { group: "interest_group" },
  },
  trigger_coup: {
    args: z.strictObject({ by: Id, success_chance: Share.optional() }),
    description: "An interest group attempts a coup.",
    refs: { by: "interest_group" },
  },
  start_civil_war: {
    args: z.strictObject({ rebel_sub_ideology: Id, by: Id.optional() }),
    description: "Split the country into government and rebels.",
    refs: { rebel_sub_ideology: "sub_ideology" },
  },
  found_party: { args: ScopedId, description: "Activate a not-yet-founded party.", refs: { "": "party" } },
  ban_party: { args: ScopedId, description: "Ban a party.", refs: { "": "party" } },
  legalise_party: { args: ScopedId, description: "Legalise a banned party.", refs: { "": "party" } },
  dissolve_party: { args: ScopedId, description: "Dissolve a party.", refs: { "": "party" } },
  split_party: {
    args: z.strictObject({ party: ScopedId, into: ScopedId, share: Share }),
    description: "Split off part of a party's support into another (not-yet-founded) party.",
    refs: { party: "party", into: "party" },
  },
  merge_parties: {
    args: z.strictObject({ parties: z.array(ScopedId).min(2), into: ScopedId }),
    description: "Merge parties into one.",
    refs: { into: "party" },
  },
  rename_party: {
    args: z.strictObject({ party: ScopedId, to: ScopedId }),
    description: "Rename a party (transfers support to the renamed record).",
    refs: { party: "party", to: "party" },
  },
  set_government_type: { args: Id, description: "Change the government type.", refs: { "": "government_type" } },
  add_wargoal: {
    args: z.strictObject({ target: Tag, type: Id }),
    description: "Gain a war goal against a country.",
    refs: { target: "tag" },
  },
  add_opinion: {
    args: z.strictObject({ target: z.union([Tag, z.enum(["ROOT", "FROM"])]), value: num }),
    description: "Change this country's opinion of the target.",
  },
  release_country: { args: Tag, description: "Release a releasable country.", refs: { "": "tag" } },
  unlock_tech: { args: Id, description: "Grant a technology.", refs: { "": "tech" } },
  country_event: {
    args: z.strictObject({ id: Id, days: z.number().int().min(0).optional() }),
    description: "Fire an event for the scoped country.",
  },
  add_trait: {
    args: z.strictObject({ person: ScopedId, trait: Id }),
    description: "Give a person a trait.",
    refs: { person: "person", trait: "trait" },
  },
  add_unrest: { args: num, description: "Add to unrest (0..1 scale)." },
  economic_shock: {
    args: z.strictObject({ growth: num, months: z.number().positive(), unemployment: num.optional(), inflation: num.optional() }),
    description: "An economic shock: growth points (fading over the months), plus unemployment and inflation pressure.",
  },
  set_budget: {
    args: z.strictObject({ revenue: num.optional(), spending: num.optional() }),
    description: "Change the tax and spending targets by these points of GDP.",
  },
  add_economic_mood: { args: num, description: "Shift the economic mood (-1..1 scale)." },
  add_ruling_party_popularity: { args: num, description: "Add to the leading governing party's popularity." },
  person_leaves_office: {
    args: z.strictObject({ person: ScopedId, reason: z.enum(["resignation", "health", "term_end", "removed"]) }),
    description: "A person leaves office (neutral reason codes only).",
    refs: { person: "person" },
  },
};

export const TRIGGERS: Record<string, ScriptDef> = {
  always: { args: z.boolean(), description: "Always true/false." },
  date_after: { args: IsoDate, description: "Current date is on or after." },
  date_before: { args: IsoDate, description: "Current date is before." },
  tag: { args: Tag, description: "Scoped country is this tag.", refs: { "": "tag" } },
  has_flag: { args: Id, description: "Country flag is set." },
  has_global_flag: { args: Id, description: "Global flag is set." },
  is_ai: { args: z.boolean(), description: "Scoped country is AI controlled." },
  election_mode: { args: z.enum(["historical", "dynamic"]), description: "Game rule for elections." },
  ruling_party: { args: ScopedId, description: "Party leads the government.", refs: { "": "party" } },
  party_in_government: { args: ScopedId, description: "Party is in the governing coalition.", refs: { "": "party" } },
  ruling_sub_ideology: { args: Id, description: "Leading party's sub-ideology.", refs: { "": "sub_ideology" } },
  ruling_ideology_group: { args: Id, description: "Leading party's ideology group.", refs: { "": "ideology_group" } },
  government_type: { args: Id, description: "Current government type.", refs: { "": "government_type" } },
  has_law: { args: Id, description: "Law is in force.", refs: { "": "law" } },
  holds_office: {
    args: z.strictObject({ person: ScopedId, office: ScopedId.optional() }),
    description: "Person currently holds an office (or the given office).",
    refs: { person: "person", office: "office" },
  },
  person_available: { args: ScopedId, description: "Person is alive and available.", refs: { "": "person" } },
  party_exists: { args: ScopedId, description: "Party is active.", refs: { "": "party" } },
  party_popularity_above: {
    args: z.strictObject({ party: ScopedId, value: Share }),
    description: "Party popularity above value.",
    refs: { party: "party" },
  },
  ideology_support_above: {
    args: z.strictObject({ sub_ideology: Id, value: Share }),
    description: "Popular support for a sub-ideology above value.",
    refs: { sub_ideology: "sub_ideology" },
  },
  stability_above: { args: Share, description: "Stability above value." },
  stability_below: { args: Share, description: "Stability below value." },
  war_support_above: { args: Share, description: "War support above value." },
  ig_approval_below: {
    args: z.strictObject({ group: Id, value: z.number() }),
    description: "Interest group approval below value.",
    refs: { group: "interest_group" },
  },
  ig_approval_above: {
    args: z.strictObject({ group: Id, value: z.number() }),
    description: "Interest group approval above value.",
    refs: { group: "interest_group" },
  },
  ig_influence_above: {
    args: z.strictObject({ group: Id, value: Share }),
    description: "Interest group influence above value.",
    refs: { group: "interest_group" },
  },
  at_war: { args: z.boolean(), description: "Country is at war." },
  at_war_with: { args: Tag, description: "At war with the tag.", refs: { "": "tag" } },
  has_completed_focus: { args: Id, description: "Focus completed." },
  exists: { args: Tag, description: "Country exists on the map.", refs: { "": "tag" } },
  is_player: { args: z.boolean(), description: "Scoped country is the player's." },
  has_tech: { args: Id, description: "The technology has been researched.", refs: { "": "tech" } },
  unrest_above: { args: Share, description: "Unrest above value." },
  political_power_above: { args: z.number(), description: "Political power above value." },
  has_civil_war: { args: z.boolean(), description: "A civil war is under way." },
  follows_history: { args: z.boolean(), description: "The country's politics still follow the historical record." },
  has_emergency_powers: { args: z.boolean(), description: "The constitution provides emergency powers." },
  election_within_days: { args: z.number().int().positive(), description: "A national election is scheduled within this many days." },
  latest_winner: {
    args: z.strictObject({ office: ScopedId.optional(), chamber: Id.optional(), winner: z.string() }),
    description: "The most recent election of this office or chamber was won by this person or party.",
    refs: { office: "office" },
  },
  ruling_party_popularity_above: { args: Share, description: "The leading governing party's popularity above value." },
  gdp_growth_below: { args: z.number(), description: "Annual GDP growth below value." },
  gdp_growth_above: { args: z.number(), description: "Annual GDP growth above value." },
};

/** Scopes usable in both effects and triggers. */
export const SCOPES = new Set([
  "every_neighbor",
  "random_neighbor",
  "any_neighbor",
  "every_ally",
  "any_ally",
  "every_country",
  "any_country",
  "every_party",
  "any_party",
  "overlord",
  "root",
  "from",
]);
/** Scope that switches to a named country: { "country": { "tag": "RUS", ... } } */
export const COUNTRY_SCOPE = "country";
export const LOGIC_KEYS = new Set(["all", "any", "not"]);
