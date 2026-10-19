/**
 * Schemas for global definition files: modifiers, ideologies, government types,
 * interest group types, laws, traits and the master country list.
 */
import { z } from "zod";
import { Color, Id, IsoDate, Modifiers, sourced, Tag } from "./common.ts";

// ---------------------------------------------------------------- modifiers

export const ModifierDef = z.strictObject({
  id: Id,
  name: z.string(),
  description: z.string(),
  /** How the value is shown: 0.05 as "+5%" (percent) or "+0.05" (flat). */
  display: z.enum(["percent", "flat"]),
  /** Whether a positive value is good for the country (drives green/red colouring). */
  positive_is_good: z.boolean().default(true),
});
export const ModifiersFile = z.strictObject({ modifiers: z.array(ModifierDef) });

// ---------------------------------------------------------------- ideologies

export const POLICY_AXES = ["economy", "social", "authority", "sovereignty", "religion", "environment"] as const;
export const PolicyAxis = z.enum(POLICY_AXES);

/**
 * Position on six axes, each -1..+1:
 *  economy:     -1 state-directed  .. +1 free market
 *  social:      -1 progressive     .. +1 traditional
 *  authority:   -1 pluralist       .. +1 authoritarian
 *  sovereignty: -1 integrationist  .. +1 sovereigntist
 *  religion:    -1 secular         .. +1 religious
 *  environment: -1 growth first    .. +1 environment first
 */
export const PolicyVector = z.strictObject(
  Object.fromEntries(POLICY_AXES.map((a) => [a, z.number().min(-1).max(1)])) as Record<
    (typeof POLICY_AXES)[number],
    z.ZodNumber
  >,
);
export type PolicyVector = z.infer<typeof PolicyVector>;

export const IdeologyGroup = z.strictObject({
  id: Id,
  name: z.string(),
  color: Color,
  description: z.string(),
  /** Opinion modifier toward countries ruled by each group (-100..100). Must list every group. */
  diplomacy_affinity: z.record(Id, z.number().min(-100).max(100)),
});

export const SubIdeology = z.strictObject({
  id: Id,
  group: Id,
  name: z.string(),
  color: Color,
  description: z.string(),
  policy: PolicyVector,
  laws: z.strictObject({
    /** Laws this sub-ideology pushes for, per law category. */
    preferred: z.record(Id, z.array(Id)).default({}),
    /** Laws a government of this sub-ideology will not enact. */
    forbidden: z.array(Id).default([]),
  }),
  /** If set, this sub-ideology can only rule under these government types. */
  gov_types_allowed: z.array(Id).optional(),
  modifiers: Modifiers.default({}),
  /** AI personality weights (e.g. aggression, trade, integration, militarism), 0..2, 1 = neutral. */
  ai_weights: z.record(Id, z.number().min(0).max(2)).default({}),
  /** Interest group approval bonus/penalty when this sub-ideology governs (-30..30). */
  ig_affinity: z.record(Id, z.number().min(-30).max(30)).default({}),
});
export type SubIdeology = z.infer<typeof SubIdeology>;

export const IdeologyGroupsFile = z.strictObject({ groups: z.array(IdeologyGroup) });
export const SubIdeologiesFile = z.strictObject({ sub_ideologies: z.array(SubIdeology) });

// ---------------------------------------------------------------- cultures

export const Culture = z.strictObject({
  id: Id,
  name: z.string(),
  /** Broader culture group, used for name pools and separatism affinity. */
  group: Id,
});
export const CulturesFile = z.strictObject({ cultures: z.array(Culture) });

// ---------------------------------------------------------------- government types

export const GovernmentType = z.strictObject({
  id: Id,
  name: z.string(),
  description: z.string(),
  /** Does this system hold national elections at all? Drives the election-calendar requirement. */
  holds_elections: z.boolean(),
  /** Does the government need a legislative majority / confidence? */
  needs_majority: z.boolean(),
  /** Is a legislature required in the country file? */
  legislature_required: z.boolean(),
  /** Are parties required? (false allows party_system "no_parties"). */
  parties_required: z.boolean(),
  coup_base_risk: z.number().min(0).max(1),
  political_power_gain: z.number(),
  succession_model: z.enum(["election", "hereditary", "party", "council", "military", "religious", "external", "none"]),
  /** Laws that cannot be enacted under this government type. */
  forbidden_laws: z.array(Id).default([]),
  /** Starting law per category for countries without a laws.json. */
  default_laws: z.record(Id, Id).default({}),
  /** Starting interest group influence (0..1) for countries without an interest_groups.json. */
  default_ig_influence: z.record(Id, z.number().min(0).max(1)).default({}),
  modifiers: Modifiers.default({}),
});
export const GovernmentTypesFile = z.strictObject({ government_types: z.array(GovernmentType) });

// ---------------------------------------------------------------- interest groups

export const IG_ACTIONS = ["protest", "strike", "mass_movement", "uprising", "coup", "impeachment", "civil_war"] as const;

export const InterestGroupType = z.strictObject({
  id: Id,
  name: z.string(),
  description: z.string(),
  /** Approval change (-30..30) while each law is in force. */
  law_preferences: z.record(Id, z.number().min(-30).max(30)).default({}),
  /** Approval change (-20..20) when the effective leader has each trait. */
  trait_reactions: z.record(Id, z.number().min(-20).max(20)).default({}),
  /** How strongly approval tracks economic performance (0..2). */
  economy_sensitivity: z.number().min(0).max(2),
  /** Escalation actions this group can take, with the approval threshold below which each becomes possible. */
  actions: z.array(
    z.strictObject({
      action: z.enum(IG_ACTIONS),
      approval_below: z.number().min(0).max(100),
      min_influence: z.number().min(0).max(1),
    }),
  ),
});
export const InterestGroupsFile = z.strictObject({ interest_groups: z.array(InterestGroupType) });

// ---------------------------------------------------------------- laws

export const Law = z.strictObject({
  id: Id,
  name: z.string(),
  description: z.string(),
  pp_cost: z.number().min(0),
  requires_vote: z.boolean(),
  /** Restrict to these government types (omit = any). */
  allowed_gov_types: z.array(Id).optional(),
  modifiers: Modifiers.default({}),
  /** Weekly drift in popular support for sub-ideologies while in force. */
  ideology_support_drift: z.record(Id, z.number()).default({}),
  /** While in force, scheduled national elections do not take place (the calendar keeps its dates). */
  suspends_elections: z.boolean().default(false),
});
export const LawCategory = z.strictObject({
  id: Id,
  name: z.string(),
  description: z.string(),
  /** Laws are ordered along a spectrum; changes of more than one step cost extra. */
  laws: z.array(Law).min(2),
});
export type LawCategory = z.infer<typeof LawCategory>;

// ---------------------------------------------------------------- traits

export const TraitDef = z.strictObject({
  id: Id,
  name: z.string(),
  /** Neutral, factual description of what the trait records. */
  description: z.string(),
  kind: z.enum(["background", "stance", "experience", "advisor", "commander", "party"]),
  /** Who may carry it. */
  applies_to: z.array(z.enum(["leader", "advisor", "commander", "party"])).min(1),
  modifiers: Modifiers.default({}),
});
export const TraitsFile = z.strictObject({ traits: z.array(TraitDef) });

// ---------------------------------------------------------------- master country list

export const REGIONS = [
  "europe",
  "former_ussr",
  "north_america",
  "latam_caribbean",
  "mena",
  "subsaharan_africa",
  "south_asia",
  "east_se_asia",
  "oceania",
] as const;
export const Region = z.enum(REGIONS);

export const START_STATUSES = ["independent", "de_facto", "un_administered", "rival_government", "insurgent", "releasable"] as const;
export const StartStatus = z.enum(START_STATUSES);

export const CountryListEntry = z.strictObject({
  tag: Tag,
  name: z.string(),
  /** Short name for map labels when `name` is long (e.g. "Yugoslavia"). */
  short_name: z.string().optional(),
  region: Region,
  start_status: StartStatus,
  /** Member of the UN on 1 January 2000. */
  un_member_2000: z.boolean(),
  /** Member of the UN today (continuity states count, e.g. YUG -> Serbia). */
  un_member_today: z.boolean(),
  /** 1 = full cabinet/advisors and deep content, 2 = mid, 3 = small state with generic advisor slots. */
  detail_tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /**
   * How much politics research the country gets (docs/CONFLICTS_PLAN.md):
   * full = 2000–2026 history; light = leaders on 1 January 2000, main parties, last election before 2000, current
   * leaders; default = no research, the default profile in data/rules/politics.json (any folder is ignored).
   */
  research: z.enum(["full", "light", "default"]).default("default"),
  /** Country whose territory this entity occupies at start (de facto, insurgent, releasable). */
  parent: Tag.optional(),
  note: z.string().optional(),
});
export type CountryListEntry = z.infer<typeof CountryListEntry>;
export const CountryListFile = z.strictObject({
  /** Date the real-world data is current to; offices without an end date are "held as of" this date. */
  as_of: z.iso.date(),
  countries: z.array(CountryListEntry),
});

export const CountryColorsFile = z.strictObject({
  note: z.string().optional(),
  colors: z.record(Tag, Color),
});

/** Tag -> ISO 3166-1 alpha-2 code of the flag SVG in public/flags (generated by scripts/dev/gen-flags.ts), or
 * `x-<name>` for a flag drawn for this game (public/flags/x-<name>.svg). */
export const FlagsFile = z.strictObject({
  source: z.strictObject({ url: z.string(), title: z.string(), licence: z.string(), codes: z.string() }),
  confidence: z.enum(["verified", "needs_review"]),
  review_note: z.string().optional(),
  no_flag: z.array(Tag).default([]),
  flags: z.record(Tag, z.string().regex(/^([a-z]{2}|x-[a-z-]+)$/)),
  /** Flags in use only for part of the period: the first entry covering the game's date wins over `flags`. */
  dated: z.record(Tag, z.array(z.strictObject({
    code: z.string().regex(/^([a-z]{2}|x-[a-z-]+)$/),
    from: IsoDate.optional(),
    to: IsoDate.optional(),
    note: z.string().optional(),
  }))).default({}),
});

/** Start dates offered on the start screen (data/scenarios/bookmarks.json). The first is the game's own start. */
export const Bookmark = z.strictObject({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string(),
  date: IsoDate,
  description: z.string(),
  ...sourced,
});
export type Bookmark = z.infer<typeof Bookmark>;
export const BookmarksFile = z.strictObject({ note: z.string().optional(), bookmarks: z.array(Bookmark).min(1) });
