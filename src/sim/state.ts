/**
 * GameState: everything that changes during a game. Plain JSON-serialisable data only (saves,
 * a future Web Worker). Static content stays in the ContentDB and is referenced by id.
 */
import { GAME_START, holdersOn, type ContentDB } from "../content/compile.ts";
import type { MapData } from "../render/mapData.ts";
import { dayOf } from "./date.ts";
import { seedRng, type RngState } from "./rng.ts";

export const STATE_VERSION = 1;

export interface GameRules {
  /** historical: real election winners are heavily weighted; dynamic: results come purely from the simulation. */
  electionMode: "historical" | "dynamic";
}

export interface InterestGroupState {
  influence: number; // 0..1
  approval: number; // 0..100
}

export interface CountryState {
  tag: string;
  /** Has politics data and exists as an actor (releasables are false until released). */
  active: boolean;
  politicalPower: number;
  stability: number; // 0..1
  warSupport: number; // 0..1
  rulingParties: string[];
  /** Current office holders (person ids; null = vacant). */
  offices: Record<string, (string | null)[]>;
  /** Offices whose real-world timeline still applies (cleared when the simulation diverges, e.g. by election). */
  historicalOffices: Record<string, boolean>;
  partyPopularity: Record<string, number>;
  partyStatus: Record<string, string>;
  partyLeader: Record<string, string | null>;
  ideologySupport: Record<string, number>;
  laws: Record<string, string>;
  interestGroups: Record<string, InterestGroupState>;
  /** Seats per chamber per party key. */
  seats: Record<string, Record<string, number>>;
  flags: Record<string, number>;
}

export interface LogEntry {
  day: number;
  tag: string | null;
  kind: string;
  text: string;
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

  for (const entry of db.countryList) {
    const cc = db.countries.get(entry.tag);
    const c = cc?.country;
    const gov = c ? db.governmentTypes.get(c.government.type) : undefined;

    const offices: Record<string, (string | null)[]> = {};
    const historicalOffices: Record<string, boolean> = {};
    for (const o of [...(c?.offices ?? []), ...(cc?.cabinet ?? []), ...(cc?.military ?? [])]) {
      if (o.ex_officio_of) continue;
      offices[o.id] = holdersOn(o, GAME_START).map((h) => h.person);
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

    countries[entry.tag] = {
      tag: entry.tag,
      active: !!c && entry.start_status !== "releasable",
      politicalPower: 50,
      stability: clamp01(c?.start_2000.stability ?? 0.5),
      warSupport: clamp01(c?.start_2000.war_support ?? 0.2),
      rulingParties: [...(c?.start_2000.ruling_parties ?? [])],
      offices,
      historicalOffices,
      partyPopularity,
      partyStatus,
      partyLeader,
      ideologySupport: { ...(c?.start_2000.ideology_support ?? {}) },
      laws,
      interestGroups,
      seats,
      flags: {},
    };
  }

  return {
    version: STATE_VERSION,
    contentHash: opts.contentHash,
    seed,
    rng: seedRng(seed),
    day,
    rules: { electionMode: "historical", ...opts.rules },
    player: opts.player ?? null,
    countries,
    provinceOwner: map.provinces.map((p) => p.owner),
    provinceController: map.provinces.map((p) => p.controller),
    log: [],
  };
}
