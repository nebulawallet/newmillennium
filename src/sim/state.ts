/**
 * GameState: everything that changes during a game. Plain JSON-serialisable data only (saves,
 * a future Web Worker). Static content stays in the ContentDB and is referenced by id.
 */
import { GAME_START, holdersOn, type ContentDB } from "../content/compile.ts";
import type { MapData } from "../render/mapData.ts";
import { dayOf } from "./date.ts";
import { calibrate } from "./politics/voteModel.ts";
import { initialSchedule } from "./politics/schedule.ts";
import { igTargets } from "./politics/interestGroups.ts";
import { seedRng, type RngState } from "./rng.ts";
import { initialEconomy, type EconomyState, type MarketState } from "./economy/economy.ts";
import { initialResearch, type ResearchState } from "./research/research.ts";

export const STATE_VERSION = 5;

export interface GameRules {
  /** historical: real election winners are heavily weighted; dynamic: results come purely from the simulation. */
  electionMode: "historical" | "dynamic";
}

export interface InterestGroupState {
  influence: number; // 0..1
  approval: number; // 0..100
}

/** An upcoming election in a country's calendar. */
export interface ScheduledElection {
  /** kind + chamber or office, e.g. "legislative:bundestag", "presidential:usa.president". */
  key: string;
  kind: string;
  chamber?: string;
  office?: string;
  day: number;
  everyYears: number;
  snapPossible: boolean;
  /** True for early elections called after a government collapse. */
  snap: boolean;
}

export interface CandidateResult {
  person: string;
  party?: string;
  share: number;
  round: number;
}

/** The outcome of one election (kept for the election-night screen, history and map mode). */
export interface ElectionResult {
  id: string;
  tag: string;
  day: number;
  kind: string;
  chamber?: string;
  office?: string;
  /** Id of the real election in the data this one corresponds to, if any. */
  historicalId?: string;
  /** True when the result followed the historical record (historical mode). */
  followedHistory: boolean;
  snap: boolean;
  turnout: number;
  /** Party shares (legislative) or candidate shares in the first round (presidential). */
  shares: Record<string, number>;
  seats?: Record<string, number>;
  seatsBefore?: Record<string, number>;
  totalSeats?: number;
  candidates?: CandidateResult[];
  /** Electoral college: votes per candidate and the unit each candidate carried. */
  unitVotes?: Record<string, number>;
  unitWinners?: Record<string, string>;
  /** Person (presidential) or party (legislative) id. */
  winner: string | null;
  winnerParty: string | null;
  /** Government formed after this election, when one was. */
  government?: { parties: string[]; support: string[]; leader: string | null; minority: boolean };
}

export interface CivilWarState {
  /** Tag of the rebel side (a dynamic country). */
  rebel: string;
  startDay: number;
  /** Interest group that rose up. */
  group: string;
}

/** National focus progress. */
export interface FocusState {
  tree: string;
  current: string | null;
  /** Days of work done on the current focus. */
  progress: number;
  completed: string[];
}

export interface TimedModifier {
  modifier: string;
  value: number;
  until: number;
  /** What applied it (event, decision or focus id), for tooltips. */
  source: string;
}

/** An event waiting for the player's choice. */
export interface PendingEvent {
  key: string;
  event: string;
  tag: string;
  from: string | null;
  day: number;
}

export interface CountryState {
  tag: string;
  /** Has politics data and exists as an actor (releasables are false until released). */
  active: boolean;
  govType: string;
  politicalPower: number;
  stability: number; // 0..1
  warSupport: number; // 0..1
  rulingParties: string[];
  confidenceAndSupply: string[];
  /** Day the current lead governing party took office (incumbency fatigue). */
  govSinceDay: number;
  /** Current office holders (person ids; null = vacant). */
  offices: Record<string, (string | null)[]>;
  /** Day the current holder of each office took it. */
  officeSince: Record<string, number>;
  /** Offices whose real-world timeline still applies (cleared when the simulation diverges, e.g. by election). */
  historicalOffices: Record<string, boolean>;
  /** False once the country's politics leave the historical record (elections, coups). */
  followsHistory: boolean;
  partyPopularity: Record<string, number>;
  partyStatus: Record<string, string>;
  partyLeader: Record<string, string | null>;
  /** Calibration factor per party so the vote model starts at the real vote shares. */
  partyBias: Record<string, number>;
  ideologySupport: Record<string, number>;
  laws: Record<string, string>;
  lawChangedDay: Record<string, number>;
  interestGroups: Record<string, InterestGroupState>;
  /** Per-group approval offset that makes the starting approvals an equilibrium. */
  igBase: Record<string, number>;
  /** Seats per chamber per party key. */
  seats: Record<string, Record<string, number>>;
  /** 0..1 */
  unrest: number;
  /** -1..1. A placeholder business cycle until the economy arrives in Phase 7. */
  economicMood: number;
  schedule: ScheduledElection[];
  civilWar: CivilWarState | null;
  flags: Record<string, number>;
  timedModifiers: TimedModifier[];
  focus: FocusState;
  /** Decision id -> day it can be taken again; `active` decisions finish on `until`. */
  decisionCooldowns: Record<string, number>;
  activeDecisions: { id: string; until: number }[];
  /** Event id -> day it last fired (fire_only_once). */
  eventsFired: Record<string, number>;
  /** Present for countries with politics data. */
  economy?: EconomyState;
  research?: ResearchState;
}

export interface LogEntry {
  day: number;
  tag: string | null;
  kind: string;
  text: string;
}

/** A coalition the player must choose (the game pauses until they do). */
export interface PendingCoalition {
  tag: string;
  chamber: string;
  resultId: string;
  options: CoalitionOption[];
}

export interface CoalitionOption {
  parties: string[];
  seats: number;
  majority: number;
  /** Probability each partner accepts (formateur = 1). */
  acceptance: Record<string, number>;
  /** Mean policy distance between members, 0..1. */
  distance: number;
  minority: boolean;
  support: string[];
}

/** Countries created during play (civil war sides). */
export interface DynamicCountry {
  name: string;
  color: string;
  parent: string;
  kind: "rebels";
}

export interface GameState {
  version: number;
  contentHash: string;
  seed: number;
  rng: RngState;
  day: number;
  rules: GameRules;
  player: string | null;
  countries: Record<string, CountryState>;
  /** Province ownership/control, index = province id - 1. */
  provinceOwner: string[];
  provinceController: string[];
  /** Recent election results, oldest first (capped). */
  elections: ElectionResult[];
  /** Latest election per country broken down by province: province id -> winning party id. */
  mapResults: Record<string, Record<string, string>>;
  pendingCoalition: PendingCoalition | null;
  dynamicCountries: Record<string, DynamicCountry>;
  globalFlags: Record<string, number>;
  market: MarketState;
  /** Buildings added during play, per province id. */
  provinceBuildings: Record<string, Record<string, number>>;
  /** Events waiting for the player's answer (AI answers at once). */
  pendingEvents: PendingEvent[];
  /** Events queued by country_event effects with a delay. */
  scheduledEvents: { event: string; tag: string; from: string | null; day: number }[];
  log: LogEntry[];
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Build the 1 January 2000 game state from content (+ map ownership). */
export function createInitialState(
  db: ContentDB,
  map: Pick<MapData, "provinces">,
  opts: { contentHash: string; seed?: number; player?: string | null; rules?: Partial<GameRules> },
): GameState {
  const seed = opts.seed ?? 20000101;
  const day = dayOf(GAME_START);
  const countries: Record<string, CountryState> = {};
  const rules: GameRules = { electionMode: "historical", ...opts.rules };
  const mapPop = new Map<string, number>();
  for (const p of map.provinces) mapPop.set(p.owner, (mapPop.get(p.owner) ?? 0) + p.population);

  for (const entry of db.countryList) {
    const cc = db.countries.get(entry.tag);
    const c = cc?.country;
    const gov = c ? db.governmentTypes.get(c.government.type) : undefined;

    const offices: Record<string, (string | null)[]> = {};
    const officeSince: Record<string, number> = {};
    const historicalOffices: Record<string, boolean> = {};
    for (const o of [...(c?.offices ?? []), ...(cc?.cabinet ?? []), ...(cc?.military ?? [])]) {
      if (o.ex_officio_of) continue;
      const hs = holdersOn(o, GAME_START);
      offices[o.id] = hs.map((h) => h.person);
      officeSince[o.id] = hs.length ? dayOf(hs[0]!.from) : day;
      historicalOffices[o.id] = true;
    }

    const partyPopularity: Record<string, number> = {};
    const partyStatus: Record<string, string> = {};
    const partyLeader: Record<string, string | null> = {};
    for (const p of cc?.parties ?? []) {
      partyPopularity[p.id] = p.popularity_2000;
      partyStatus[p.id] = p.status_2000;
      // year-only dates cover the whole year; co-leaders: the first listed counts as leader
      const start = (d: string | number) => (typeof d === "number" ? `${d}-01-01` : d);
      const end = (d: string | number) => (typeof d === "number" ? `${d}-12-31` : d);
      const lead = p.leader_history.find((l) => start(l.from) <= GAME_START && (l.to === undefined || end(l.to) > GAME_START));
      partyLeader[p.id] = lead?.person ?? null;
    }

    const laws: Record<string, string> = { ...(gov?.default_laws ?? {}), ...(cc?.laws?.laws ?? {}) };
    const interestGroups: Record<string, InterestGroupState> = {};
    for (const ig of db.interestGroupTypes.keys()) {
      const fromFile = cc?.interestGroups?.interest_groups.find((g) => g.type === ig);
      interestGroups[ig] = fromFile
        ? { influence: fromFile.influence, approval: fromFile.approval }
        : { influence: gov?.default_ig_influence[ig] ?? 0.1, approval: 50 };
    }

    const seats: Record<string, Record<string, number>> = {};
    for (const ch of c?.legislature?.chambers ?? []) seats[ch.id] = { ...ch.seats_2000 };

    // the lead governing party's time in office: from the effective executive's start date if same party
    const exec = c ? offices[c.government.effective_executive]?.[0] : null;
    const execSince = c ? officeSince[c.government.effective_executive] : undefined;
    const execParty = exec ? db.people.get(exec)?.party : undefined;
    const lead = c?.start_2000.ruling_parties[0];

    const cs: CountryState = {
      tag: entry.tag,
      active: !!c && entry.start_status !== "releasable",
      govType: c?.government.type ?? "failed_contested",
      politicalPower: 50,
      stability: clamp01(c?.start_2000.stability ?? 0.5),
      warSupport: clamp01(c?.start_2000.war_support ?? 0.2),
      rulingParties: [...(c?.start_2000.ruling_parties ?? [])],
      confidenceAndSupply: [...(c?.start_2000.confidence_and_supply ?? [])],
      govSinceDay: execParty && execParty === lead && execSince !== undefined ? execSince : day,
      offices,
      officeSince,
      historicalOffices,
      followsHistory: true,
      partyPopularity,
      partyStatus,
      partyLeader,
      partyBias: {},
      ideologySupport: { ...(c?.start_2000.ideology_support ?? {}) },
      laws,
      lawChangedDay: {},
      interestGroups,
      igBase: {},
      seats,
      unrest: 0,
      economicMood: 0,
      schedule: [],
      civilWar: null,
      flags: {},
      timedModifiers: [],
      focus: { tree: focusTreeFor(db, entry.tag), current: null, progress: 0, completed: [] },
      decisionCooldowns: {},
      activeDecisions: [],
      eventsFired: {},
    };
    if (c && rules.electionMode === "dynamic") {
      const needsMajority = !!gov?.needs_majority;
      for (const o of c.offices) {
        const elected = o.selection === "direct_election" || o.selection === "electoral_college" || o.selection === "legislature";
        const formed = needsMajority && o.id === c.government.head_of_government_office;
        if (elected || formed) cs.historicalOffices[o.id] = false;
      }
      for (const o of cc?.cabinet ?? []) if (needsMajority) cs.historicalOffices[o.id] = false;
    }
    if (c) {
      cs.economy = initialEconomy(db, entry.tag, mapPop.get(entry.tag) ?? 1_000_000);
      cs.research = initialResearch(db, entry.tag, cs.economy.gdp, cs.economy.population);
      cs.economicMood = 0;
      cs.partyBias = calibrate(db, cs, day);
      const targets = igTargets(db, cs);
      for (const [ig, s] of Object.entries(interestGroups)) cs.igBase[ig] = s.approval - (targets[ig] ?? 50);
      cs.schedule = initialSchedule(db, entry.tag, day);
    }
    countries[entry.tag] = cs;
  }

  return {
    version: STATE_VERSION,
    contentHash: opts.contentHash,
    seed,
    rng: seedRng(seed),
    day,
    rules,
    player: opts.player ?? null,
    countries,
    provinceOwner: map.provinces.map((p) => p.owner),
    provinceController: map.provinces.map((p) => p.controller),
    elections: [],
    mapResults: {},
    pendingCoalition: null,
    dynamicCountries: {},
    globalFlags: {},
    market: { prices: Object.fromEntries(db.economyRules.resources.map((r) => [r.id, 1])), demand: 1 },
    provinceBuildings: {},
    pendingEvents: [],
    scheduledEvents: [],
    log: [],
  };
}

/** The focus tree a country uses: one naming it, else the generic tree. */
export function focusTreeFor(db: ContentDB, tag: string): string {
  let generic = "";
  for (const t of db.focusTrees.values()) {
    if (t.countries.includes(tag)) return t.id;
    if (!t.countries.length) generic = t.id;
  }
  return generic;
}

/** Bring an older save up to the current state version (fields added later get their defaults). */
export function migrateState(db: ContentDB, s: GameState): GameState {
  if (s.version >= STATE_VERSION) return s;
  const fresh = createInitialState(db, { provinces: [] }, { contentHash: s.contentHash, seed: s.seed, player: s.player, rules: s.rules });
  for (const [tag, cs] of Object.entries(s.countries)) {
    const f = fresh.countries[tag];
    if (!f) continue;
    s.countries[tag] = { ...f, ...cs, schedule: (cs as Partial<CountryState>).schedule ?? f.schedule.filter((e) => e.day > s.day) };
  }
  s.elections ??= [];
  s.mapResults ??= {};
  s.pendingCoalition ??= null;
  s.dynamicCountries ??= {};
  s.globalFlags ??= {};
  s.market ??= fresh.market;
  s.provinceBuildings ??= {};
  s.pendingEvents ??= [];
  s.scheduledEvents ??= [];
  for (const [tag, cs] of Object.entries(s.countries)) {
    cs.timedModifiers ??= [];
    cs.focus ??= { tree: focusTreeFor(db, tag), current: null, progress: 0, completed: [] };
    cs.decisionCooldowns ??= {};
    cs.activeDecisions ??= [];
    cs.eventsFired ??= {};
    if (!cs.economy && fresh.countries[tag]?.economy) cs.economy = fresh.countries[tag]!.economy;
    if (!cs.research && fresh.countries[tag]?.research) cs.research = fresh.countries[tag]!.research;
  }
  s.version = STATE_VERSION;
  return s;
}
