/**
 * Schemas for the per-country politics files in data/countries/<TAG>/.
 */
import { z } from "zod";
import { Color, DateOrYear, Id, IsoDate, LocalName, ScopedId, Share, Tag, sourced } from "./common.ts";

// ---------------------------------------------------------------- offices

export const OFFICE_ROLES = [
  "head_of_state",
  "head_of_government",
  "head_of_state_and_government",
  "supreme_leader",
  "party_general_secretary",
  "governor_general",
  "deputy",
  "collective_head_member",
  "transitional_administrator",
  "military_council_chair",
  "minister",
  "intelligence_chief",
  "military_chief",
  "army_chief",
  "navy_chief",
  "air_chief",
  "other",
] as const;
export const OfficeRole = z.enum(OFFICE_ROLES);

/** Roles that count as "head of state" when resolving who held it on a date. */
export const HEAD_OF_STATE_ROLES = new Set([
  "head_of_state",
  "head_of_state_and_government",
  "supreme_leader",
  "collective_head_member",
  "transitional_administrator",
]);
/** Roles that count as "head of government". */
export const HEAD_OF_GOVERNMENT_ROLES = new Set([
  "head_of_government",
  "head_of_state_and_government",
  "military_council_chair",
  "transitional_administrator",
]);

export const PORTFOLIOS = [
  "foreign",
  "defence",
  "finance",
  "interior",
  "economy",
  "justice",
  "energy",
  "trade",
  "intelligence",
  "other",
] as const;

export const Holder = z.strictObject({
  /** Person id, or null for a documented vacancy. */
  person: ScopedId.nullable(),
  from: IsoDate,
  /** Omit if still in office today. */
  to: IsoDate.optional(),
  acting: z.boolean().optional(),
  /** Required when person is null. */
  vacant_reason: z.string().optional(),
  note: z.string().optional(),
});
export type Holder = z.infer<typeof Holder>;

export const Office = z.strictObject({
  id: ScopedId,
  title: LocalName,
  role: OfficeRole,
  /** For role "minister": which portfolio. */
  portfolio: z.enum(PORTFOLIOS).optional(),
  /** Share of executive power, 0..1. Nominal offices are low (about 0.1). */
  power_weight: Share,
  selection: z.enum([
    "direct_election",
    "legislature",
    "electoral_college",
    "hereditary",
    "appointed",
    "party_congress",
    "council",
    "military",
    "religious_council",
    "foreign_ex_officio",
    "rotation",
    "external_appointment",
  ]),
  appointed_by: ScopedId.optional(),
  /** Office held ex officio by the holder of another office, possibly in another country. */
  ex_officio_of: ScopedId.optional(),
  term_years: z.number().positive().optional(),
  term_limit: z.strictObject({ max_terms: z.number().int().positive(), consecutive_only: z.boolean() }).optional(),
  /** Collective offices: number of members sitting at once. */
  seats: z.number().int().positive().optional(),
  succession: z
    .strictObject({
      type: z.enum(["line", "vice", "council_choice", "election", "acting_then_election"]),
      /** Line of succession (hereditary systems), in order. */
      heirs: z.array(ScopedId).optional(),
      /** Office whose holder acts on a vacancy. */
      acting_office: ScopedId.optional(),
    })
    .optional(),
  /** Real tenure timeline from at least 2000-01-01 onward, in chronological order. */
  holders: z.array(Holder),
  note: z.string().optional(),
  ...sourced,
});
export type Office = z.infer<typeof Office>;

/** cabinet.json and military.json share this shape. */
export const OfficesFile = z.strictObject({ offices: z.array(Office) });

// ---------------------------------------------------------------- legislature

export const ElectoralSystem = z.strictObject({
  type: z.enum(["fptp", "two_round", "av", "list_pr", "mmp", "parallel", "stv", "block", "sntv", "appointed", "indirect", "mixed_other"]),
  formula: z.enum(["dhondt", "sainte_lague", "hare", "droop", "imperiali"]).optional(),
  /** National vote share threshold for PR seats, 0..1. */
  threshold: Share.optional(),
  district_model: z.enum(["national", "provinces", "admin1", "custom"]).optional(),
  /** Share of seats allocated by PR in mixed systems. */
  pr_share: Share.optional(),
  reserved_seats: z.array(z.strictObject({ group: z.string(), seats: z.number().int().positive() })).optional(),
  note: z.string().optional(),
});

export const Chamber = z.strictObject({
  id: Id,
  name: LocalName,
  seats: z.number().int().positive(),
  /** Omit for chambers whose members have no fixed term (e.g. delegates of state governments). */
  term_years: z.number().positive().optional(),
  elected: z.enum(["direct", "indirect", "appointed", "mixed"]),
  system: ElectoralSystem,
  /** Seat distribution on 2000-01-01. Keys are party ids or the special keys below. */
  seats_2000: z.record(z.string(), z.number().int().min(0)),
  /** Can this chamber bring down the government? */
  confidence_chamber: z.boolean(),
  ...sourced,
});
export type Chamber = z.infer<typeof Chamber>;
export const SEAT_SPECIAL_KEYS = new Set(["independents", "vacant", "appointed", "others", "speaker"]);

export const Legislature = z.strictObject({
  name: LocalName,
  chambers: z.array(Chamber).min(1),
});

// ---------------------------------------------------------------- country.json

export const CivilWarStart = z.strictObject({
  /** Tags of the sides (this country plus insurgent/de facto entities). */
  sides: z.array(Tag).min(2),
  note: z.string(),
});

export const Country = z.strictObject({
  tag: Tag,
  name: LocalName.extend({ official: LocalName.optional() }),
  adjective: z.string(),
  culture_primary: Id,
  government: z.strictObject({
    type: Id,
    /** Office whose holder the player acts as. */
    effective_executive: ScopedId,
    head_of_state_office: ScopedId,
    head_of_government_office: ScopedId,
    constitution: z.strictObject({
      term_limit_amendable: z.boolean(),
      emergency_powers: z.boolean(),
      referendum_required_for: z.array(z.string()).default([]),
    }),
    note: z.string().optional(),
  }),
  offices: z.array(Office).min(1),
  legislature: Legislature.nullable(),
  party_system: z.enum(["multi_party", "dominant_party", "one_party", "no_parties"]),
  no_parties_reason: z.string().optional(),
  start_2000: z.strictObject({
    ruling_parties: z.array(ScopedId),
    confidence_and_supply: z.array(ScopedId).default([]),
    /** Popular support per sub-ideology on 2000-01-01; must sum to 1. */
    ideology_support: z.record(Id, Share),
    ideology_support_note: z.string(),
    /** Gameplay starting values, 0..1. */
    stability: Share,
    war_support: Share,
    at_war_with: z.array(Tag).default([]),
    civil_war: CivilWarStart.optional(),
  }),
  claims: z.array(z.strictObject({ tag: Tag, note: z.string() })).default([]),
  ...sourced,
});
export type Country = z.infer<typeof Country>;

// ---------------------------------------------------------------- people.json

export const ROLE_TAGS = [
  "head_of_state",
  "head_of_government",
  "presidential_candidate",
  "opposition_leader",
  "party_leader",
  "faction_leader",
  "foreign_minister",
  "defence_minister",
  "finance_minister",
  "interior_minister",
  "economy_minister",
  "justice_minister",
  "energy_minister",
  "intelligence_chief",
  "army_chief",
  "navy_chief",
  "air_chief",
  "chief_of_staff",
  "monarch",
  "heir",
  "religious_leader",
  "insurgent_leader",
  "interest_group_leader",
] as const;
export const RoleTag = z.enum(ROLE_TAGS);

export const Person = z.strictObject({
  id: ScopedId,
  name: LocalName,
  gender: z.enum(["male", "female"]),
  birth_year: z.number().int().min(1880).max(2010),
  birth_date: IsoDate.optional(),
  /** Only for people who have actually died. Used by historical-mode events only. */
  died: z.union([IsoDate, z.string().regex(/^\d{4}(-\d{2})?$/, "YYYY, YYYY-MM or YYYY-MM-DD")]).optional(),
  country: Tag,
  /** Party at game start or when they enter the game. */
  party: ScopedId.optional(),
  party_history: z.array(z.strictObject({ party: ScopedId, from: DateOrYear, to: DateOrYear.optional() })).default([]),
  sub_ideology: Id,
  traits: z.array(Id).default([]),
  roles_possible: z.array(RoleTag).min(1),
  /** When this person becomes/stops being available as a game character. */
  available: z.strictObject({ from: IsoDate.optional(), to: IsoDate.optional() }).default({}),
  /** Election balancing knob, 0..100, default 50. Tuned so historical results reproduce. Not a judgement. */
  electoral_appeal: z.number().min(0).max(100).default(50),
  military: z.strictObject({ branch: z.enum(["army", "navy", "air", "joint", "marines", "intelligence"]), rank: z.string() }).optional(),
  /** True only for procedurally generated post-2026 leaders. Real people omit this. */
  generated: z.boolean().optional(),
  /** One or two neutral sentences of documented facts. */
  bio: z.string().max(400).optional(),
  /** Free-text note, e.g. conflicting sources about a date. */
  note: z.string().optional(),
  ...sourced,
});
export type Person = z.infer<typeof Person>;
export const PeopleFile = z.strictObject({ people: z.array(Person) });

// ---------------------------------------------------------------- parties.json

export const Faction = z.strictObject({
  id: Id,
  name: z.string(),
  sub_ideology: Id,
  /** Share of the party, 0..1. Factions within a party should sum to about 1. */
  strength: Share,
  figures: z.array(ScopedId).default([]),
  note: z.string().optional(),
});

export const Party = z.strictObject({
  id: ScopedId,
  name: LocalName,
  abbrev: LocalName,
  color: Color,
  sub_ideology: Id,
  founded: DateOrYear,
  dissolved: DateOrYear.optional(),
  status_2000: z.enum(["active", "extra_parliamentary", "banned", "exiled", "not_yet_founded", "insurgent"]),
  leader_history: z.array(
    z.strictObject({ person: ScopedId, from: DateOrYear, to: DateOrYear.optional(), title: z.string().optional() }),
  ),
  /** Latest real national vote share before 2000, or a credible estimate (say which in popularity_note). */
  popularity_2000: Share,
  popularity_note: z.string().optional(),
  lineage: z
    .strictObject({
      formed_from: z.array(ScopedId).optional(),
      merged_into: ScopedId.optional(),
      split_from: ScopedId.optional(),
      renamed_from: ScopedId.optional(),
      renamed_to: ScopedId.optional(),
    })
    .optional(),
  factions: z.array(Faction).default([]),
  /** Parties this party has documented refusals to govern with. */
  coalition_red_lines: z.array(ScopedId).default([]),
  /** Elected members do not take their seats (e.g. Sinn Féin at Westminster). */
  abstentionist: z.boolean().optional(),
  /** For regional parties: culture ids or region names where support is concentrated. */
  regional_base: z.array(z.string()).optional(),
  international: z.string().optional(),
  /** Free-text note, e.g. conflicting sources. */
  note: z.string().optional(),
  ...sourced,
});
export type Party = z.infer<typeof Party>;
export const PartiesFile = z.strictObject({ parties: z.array(Party) });

// ---------------------------------------------------------------- elections.json

export const ELECTION_KINDS = [
  "presidential",
  "legislative",
  "legislative_upper",
  "indirect_presidential",
  "referendum",
  "party_congress",
  "party_leadership",
  "local_regional",
  /** Elections to non-legislative national councils, e.g. Iran's Assembly of Experts. */
  "council",
] as const;
export const ElectionKind = z.enum(ELECTION_KINDS);

export const ElectionRule = z.strictObject({
  kind: ElectionKind,
  chamber: Id.optional(),
  office: ScopedId.optional(),
  every_years: z.number().positive(),
  /** A real election date the recurrence counts from. */
  anchor: IsoDate,
  snap_possible: z.boolean(),
  note: z.string().optional(),
});

export const Election = z.strictObject({
  id: Id,
  date: IsoDate,
  kind: ElectionKind,
  chamber: Id.optional(),
  office: ScopedId.optional(),
  rounds: z.number().int().positive().optional(),
  /** For referendums. */
  question: z.string().optional(),
  /** True if this was an early/snap election rather than a scheduled one. */
  snap: z.boolean().optional(),
  historical: z.strictObject({
    candidates: z
      .array(
        z.strictObject({
          person: ScopedId,
          party: ScopedId.optional(),
          share: Share.optional(),
          votes: z.number().int().optional(),
          round: z.number().int().positive().default(1),
        }),
      )
      .optional(),
    party_results: z
      .array(
        z.strictObject({
          party: z.string(),
          share: Share.optional(),
          /** Seats held after the election (chamber composition). */
          seats: z.number().int().min(0),
          /** Seats won in this election, when only part of the chamber was contested (e.g. US Senate classes). */
          seats_won: z.number().int().min(0).optional(),
        }),
      )
      .optional(),
    /** Referendum result: share for the proposal. */
    yes_share: Share.optional(),
    /** Referendum options when they are not a plain yes/no (e.g. Leave / Remain). */
    options: z.array(z.strictObject({ label: z.string(), share: Share.optional(), votes: z.number().int().optional() })).optional(),
    winner: z.string().optional(),
    turnout: Share.optional(),
    note: z.string().optional(),
    ...sourced,
  }),
});
export type Election = z.infer<typeof Election>;

export const ElectionsFile = z.strictObject({
  rules: z.array(ElectionRule),
  no_elections_reason: z.string().optional(),
  elections: z.array(Election),
  ...sourced,
});

// ---------------------------------------------------------------- interest_groups.json / laws.json

export const CountryInterestGroupsFile = z.strictObject({
  interest_groups: z.array(
    z.strictObject({
      type: Id,
      influence: Share,
      approval: z.number().min(0).max(100),
      figurehead: ScopedId.optional(),
      note: z.string().optional(),
    }),
  ),
  note: z.string().optional(),
});

export const CountryLawsFile = z.strictObject({
  /** law category id -> law id in force on 2000-01-01. */
  laws: z.record(Id, Id),
  note: z.string().optional(),
});
