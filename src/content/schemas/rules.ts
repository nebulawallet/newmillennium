/**
 * Tuning constants for the political simulation (data/rules/politics.json). Every field has a
 * default, so the file only needs to list the values a modder wants to change.
 */
import { z } from "zod";

const n = (v: number) => z.number().default(v);

export const ElectionRules = z.strictObject({
  /** Sharpness of voter-party affinity: exp(-k * policy distance). Higher = voters stick closer to their ideology. */
  affinity_sharpness: n(4),
  /** Party/candidate share multiplier per unit of (electoral_appeal - 50) / 50, applied as exp(w * x). */
  leader_appeal_weight: n(0.35),
  /** Logit bonus for governing parties and incumbent candidates (before law modifiers). */
  incumbency_bonus: n(0.04),
  /** Logit penalty per year in power beyond `fatigue_after_years`. */
  incumbency_fatigue: n(0.04),
  fatigue_after_years: n(6),
  /** Logit effect on governing parties of economic mood (-1..1). */
  economy_weight: n(0.25),
  /** Logit-normal noise (sigma) per party in dynamic mode. */
  dynamic_noise: n(0.12),
  /** Historical mode: probability that an election whose path still matches history follows the record. */
  historical_adherence: n(0.97),
  /** Historical mode: noise on recorded shares when following the record. */
  historical_noise: n(0.01),
  /** Historical mode, when an election leaves the record: weight of the recorded shares in the blend. */
  historical_pull: n(0.75),
  /** Persistent per-province partisan variation (logit sigma) for countries without regional data. */
  province_noise: n(0.3),
  /** Extra per-district noise (logit sigma) for single-member districts. */
  district_noise: n(0.5),
  /** Logit boost for regional parties in their base regions, and penalty elsewhere. */
  regional_boost: n(1.6),
  /** Logit effect of population density on parties favoured by rural or urban interest groups. */
  density_weight: n(0.25),
  /** Parties below this share do not field a presidential candidate (dynamic mode). */
  min_presidential_share: n(0.04),
  max_presidential_candidates: n(6),
  /** Minimum age to stand for head of state or government. */
  min_candidate_age: n(35),
  /** People this old or older are no longer picked as new candidates. */
  max_candidate_age: n(80),
  /** Single-member district magnitude used to approximate STV and SNTV (seats per district). */
  multi_member_magnitude: n(5),
});

export const CoalitionRules = z.strictObject({
  /** Only the largest N parties are considered for coalitions (2^N subsets). */
  max_parties_considered: n(9),
  /** Policy distance (0..1) above which a partner refuses outright. */
  max_partner_distance: n(0.55),
  /** Score penalty per extra party in a coalition. */
  party_count_penalty: n(0.06),
  /** Score penalty per surplus seat share beyond a bare majority. */
  surplus_penalty: n(0.6),
  /** Historical mode: score bonus for the coalition matching the real government (head of government's and ministers' parties). */
  historical_bonus: n(1.5),
  /** Score penalty for a coalition of the two largest parties (a grand coalition is a last resort). */
  grand_coalition_penalty: n(0.35),
  /** Score penalty per unit of economic-axis gap beyond 0.6 between the furthest-apart partners. */
  cross_bloc_penalty: n(1.0),
  /** Score penalty for a minority government (before confidence-and-supply partners). */
  minority_penalty: n(1.5),
  /** Monthly chance scale of a lost confidence vote for a minority government at zero stability. */
  confidence_loss_base: n(0.06),
  /** Days between a government collapse and the snap election. */
  snap_election_delay_days: n(60),
});

export const InterestGroupRules = z.strictObject({
  /** Share of the gap to target approval closed each week. */
  weekly_drift: n(0.05),
  /** Approval points per unit of economic mood, multiplied by the group's economy_sensitivity. */
  economy_points: n(10),
  /** Monthly chance scale of an action once approval is below its threshold. */
  action_chance: n(0.25),
});

export const UnrestRules = z.strictObject({
  /** Unrest added by each interest group action. */
  action_unrest: z.record(z.string(), z.number()).default({
    protest: 0.04,
    strike: 0.05,
    mass_movement: 0.1,
    uprising: 0.2,
    impeachment: 0.03,
    coup: 0.1,
    civil_war: 0.3,
  }),
  /** Share of unrest that fades each month. */
  monthly_decay: n(0.12),
  /** Stability target reduction per unit of unrest. */
  stability_penalty: n(0.4),
  /** Scale of the monthly coup chance (multiplies the government type's coup_base_risk). */
  coup_scale: n(40),
  /** Scale of the monthly civil war chance once a group is at its civil_war threshold and unrest is high. */
  civil_war_scale: n(0.03),
  /** Unrest needed before a civil war can start. */
  civil_war_min_unrest: n(0.5),
  /** Historical mode: dynamic coups and civil wars are scaled by this while a country follows history. */
  historical_factor: n(0.05),
  /** Monthly chance that an ongoing civil war ends (combat arrives in Phase 10). */
  civil_war_end_chance: n(0.04),
});

export const LawRules = z.strictObject({
  /** Extra cost per additional step along a law spectrum: cost * (1 + extra_step_cost * (steps - 1)). */
  extra_step_cost: n(0.5),
  /** Days before the same law category can change again. */
  cooldown_days: n(180),
  /** Stability lost when a law passes against the wishes of influential groups (per 10 approval points lost, weighted). */
  stability_hit: n(0.01),
});

/**
 * Countries with research "default" (data/world/countries.json) have no politics folder. They still play: the
 * profile gives them a generic government, so they have an economy, an army and diplomacy. No named people.
 */
export const DefaultProfileRules = z.strictObject({
  /** Government type for independent and de facto states. */
  government_type: z.string().default("default_government"),
  /** Government type for insurgent tags (start_status "insurgent"). */
  insurgent_government_type: z.string().default("insurgent_movement"),
  stability: n(0.5),
  war_support: n(0.2),
});

export const PoliticsRulesFile = z.strictObject({
  elections: ElectionRules.prefault({}),
  coalitions: CoalitionRules.prefault({}),
  interest_groups: InterestGroupRules.prefault({}),
  unrest: UnrestRules.prefault({}),
  laws: LawRules.prefault({}),
  default_profile: DefaultProfileRules.prefault({}),
  note: z.string().optional(),
});
export type PoliticsRules = z.infer<typeof PoliticsRulesFile>;

export const DEFAULT_POLITICS_RULES: PoliticsRules = PoliticsRulesFile.parse({});
