/**
 * The simulation: advances GameState one day at a time and runs registered systems on daily,
 * weekly (Mondays), monthly (1st) and yearly (1 January) hooks. Pure TypeScript, no DOM, so it
 * can move to a Web Worker later. Player and AI actions enter as commands (src/sim/commands.ts).
 */
import { holdersOn, type ContentDB } from "../content/compile.ts";
import { applyCommand, type Command, type CommandResult } from "./commands.ts";
import { dayOf, isoOf, ymdOf } from "./date.ts";
import { confidenceSystem } from "./politics/coalition.ts";
import { electionSystem } from "./politics/elections.ts";
import { interestGroupSystem } from "./politics/interestGroups.ts";
import { lawDriftSystem } from "./politics/laws.ts";
import { createPartyLifecycleSystem, pollSystem } from "./politics/parties.ts";
import { unrestSystem } from "./politics/unrest.ts";
import { personParty } from "./politics/common.ts";
import type { SimProvince } from "./politics/voteModel.ts";
import { Rng } from "./rng.ts";
import type { CountryState, ElectionResult, GameState, LogEntry } from "./state.ts";

/** Static map facts the simulation reads (never saved; rebuilt from the map on load). */
export interface SimMap {
  provinces: SimProvince[];
  /** Land neighbours per province id. */
  neighbours: Map<number, number[]>;
}

/** Transient notifications for the UI (not part of the saved state). */
export type SimEvent =
  | { type: "election"; result: ElectionResult }
  | { type: "coalition_needed"; tag: string }
  | { type: "coup"; tag: string }
  | { type: "civil_war"; tag: string }
  | { type: "map_changed" };

export interface SimContext {
  db: ContentDB;
  state: GameState;
  rng: Rng;
  map?: SimMap;
  log(tag: string | null, kind: string, text: string): void;
  emit(e: SimEvent): void;
}

export interface System {
  id: string;
  /** Called once when the simulation is created or a game is loaded. */
  init?(ctx: SimContext): void;
  daily?(ctx: SimContext): void;
  weekly?(ctx: SimContext): void;
  monthly?(ctx: SimContext): void;
  yearly?(ctx: SimContext): void;
}

const LOG_LIMIT = 500;

/** Build the simulation's map context from province records and adjacency pairs. */
export function simMapFrom(provinces: SimProvince[], adjacency: [number, number, number][] = []): SimMap {
  const neighbours = new Map<number, number[]>();
  for (const [a, b] of adjacency) {
    neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
    neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
  }
  return { provinces, neighbours };
}

export class Simulation {
  readonly rng: Rng;
  private listeners: ((e: LogEntry) => void)[] = [];
  private eventListeners: ((e: SimEvent) => void)[] = [];
  private ctx: SimContext;

  constructor(
    readonly db: ContentDB,
    readonly state: GameState,
    readonly systems: System[] = defaultSystems(),
    map?: SimMap,
  ) {
    this.rng = new Rng(state.rng);
    this.ctx = {
      db,
      state,
      rng: this.rng,
      map,
      log: (tag, kind, text) => {
        const e: LogEntry = { day: state.day, tag, kind, text };
        state.log.push(e);
        if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
        for (const l of this.listeners) l(e);
      },
      emit: (e) => {
        for (const l of this.eventListeners) l(e);
      },
    };
    for (const s of systems) s.init?.(this.ctx);
  }

  onLog(f: (e: LogEntry) => void): () => void {
    this.listeners.push(f);
    return () => (this.listeners = this.listeners.filter((x) => x !== f));
  }

  onEvent(f: (e: SimEvent) => void): () => void {
    this.eventListeners.push(f);
    return () => (this.eventListeners = this.eventListeners.filter((x) => x !== f));
  }

  /** Apply a player or AI command now (between ticks). */
  dispatch(cmd: Command): CommandResult {
    const r = applyCommand(this.ctx, cmd);
    this.state.rng = this.rng.state;
    return r;
  }

  /** Advance one day and run the hooks that fall on it. */
  step(): void {
    this.state.day += 1;
    const { day, weekday, month } = ymdOf(this.state.day);
    for (const s of this.systems) s.daily?.(this.ctx);
    if (weekday === 1) for (const s of this.systems) s.weekly?.(this.ctx);
    if (day === 1) for (const s of this.systems) s.monthly?.(this.ctx);
    if (day === 1 && month === 1) for (const s of this.systems) s.yearly?.(this.ctx);
    this.state.rng = this.rng.state;
  }
}

// ------------------------------------------------------------------ Phase 4 systems

const activeCountries = (state: GameState) => Object.values(state.countries).filter((c) => c.active);

/** Daily political power gain and its parts (also shown in the UI tooltip). */
export function politicalPowerGain(db: ContentDB, c: CountryState): { base: number; stabilityFactor: number; total: number } {
  const gov = db.governmentTypes.get(c.govType);
  const base = (gov?.political_power_gain ?? 1) * 0.25;
  const stabilityFactor = 0.6 + 0.4 * c.stability;
  return { base, stabilityFactor, total: base * stabilityFactor };
}

/** Influence-weighted mean interest group approval (0..100), unrest, and the stability they pull toward. */
export function stabilityTarget(c: CountryState, unrestPenalty = 0.4): { approval: number; unrest: number; target: number } {
  let w = 0, a = 0;
  for (const ig of Object.values(c.interestGroups)) { w += ig.influence; a += ig.influence * ig.approval; }
  const approval = w > 0 ? a / w : 50;
  const target = 0.5 + (approval - 50) / 80 - unrestPenalty * c.unrest;
  return { approval, unrest: c.unrest, target: Math.max(0.05, Math.min(0.95, target)) };
}

/** Political power accrues daily from the government type. */
export const politicalPowerSystem: System = {
  id: "political_power",
  daily({ db, state }) {
    for (const c of activeCountries(state)) c.politicalPower = Math.min(2000, c.politicalPower + politicalPowerGain(db, c).total);
  },
};

/** Weekly stability drift toward a target set by interest group approval and unrest. */
export const stabilitySystem: System = {
  id: "stability",
  weekly({ db, state }) {
    const pen = db.politicsRules.unrest.stability_penalty;
    for (const c of activeCountries(state)) c.stability += (stabilityTarget(c, pen).target - c.stability) * 0.03;
  },
};

/**
 * Historical timeline: in historical mode, real office holders and party leaders take over on
 * their real dates for as long as the office still follows history (elections, coups and player
 * actions clear `historicalOffices[officeId]`; party leaders follow history while the country does).
 * Real referendums are reported as news on their dates.
 */
export function createHistoricalTimelineSystem(): System {
  // day -> changes, built once from content
  let officeChanges = new Map<number, { tag: string; officeId: string }[]>();
  let leaderChanges = new Map<number, { tag: string; partyId: string; person: string }[]>();
  let referendums = new Map<number, { tag: string; text: string }[]>();
  const push = <T>(m: Map<number, T[]>, day: number, v: T) => m.set(day, [...(m.get(day) ?? []), v]);
  return {
    id: "historical_timeline",
    init({ db, state }) {
      officeChanges = new Map();
      leaderChanges = new Map();
      referendums = new Map();
      for (const [tag, cc] of db.countries) {
        for (const o of [...(cc.country?.offices ?? []), ...cc.cabinet, ...cc.military]) {
          for (const h of o.holders) {
            const d = dayOf(h.from);
            if (d > state.day) push(officeChanges, d, { tag, officeId: o.id });
            if (h.to) {
              const e = dayOf(h.to);
              if (e > state.day) push(officeChanges, e, { tag, officeId: o.id });
            }
          }
        }
        for (const p of cc.parties)
          for (const l of p.leader_history) {
            if (typeof l.from !== "string") continue; // year-only dates: no exact day to apply
            const d = dayOf(l.from);
            if (d > state.day) push(leaderChanges, d, { tag, partyId: p.id, person: l.person });
          }
        for (const e of cc.elections?.elections ?? []) {
          if (e.kind !== "referendum") continue;
          const d = dayOf(e.date);
          if (d <= state.day) continue;
          const yes = e.historical.yes_share;
          const opts = e.historical.options?.map((o) => `${o.label}${o.share !== undefined ? ` ${(o.share * 100).toFixed(1)}%` : ""}`).join(", ");
          const outcome = opts ?? (yes !== undefined ? `${(yes * 100).toFixed(1)}% in favour` : e.historical.winner ?? "");
          push(referendums, d, { tag, text: `Referendum${e.question ? `: ${e.question}` : ""} — ${outcome}` });
        }
      }
    },
    daily({ db, state, log }) {
      const historical = state.rules.electionMode === "historical";
      const today = isoOf(state.day);
      for (const ch of officeChanges.get(state.day) ?? []) {
        const c: CountryState | undefined = state.countries[ch.tag];
        if (!c?.historicalOffices[ch.officeId]) continue;
        const office = db.offices.get(ch.officeId)!;
        const before = c.offices[ch.officeId] ?? [];
        // only continue history from where history was: the current holder must be the real predecessor
        // (looking back a few days, across a skipped one-day gap between holders)
        const pred = [1, 2, 3, 4].map((k) => JSON.stringify(holdersOn(office, isoOf(state.day - k)).map((h) => h.person)));
        if (!pred.includes(JSON.stringify(before))) continue;
        const after = holdersOn(office, today).map((h) => h.person);
        if (JSON.stringify(before) === JSON.stringify(after)) continue;
        // `to` may be the last day in office: don't report a one-day vacancy before a successor starts
        const soon = isoOf(state.day + 2);
        if (after.length === 0 && office.holders.some((h) => h.from > today && h.from <= soon)) continue;
        c.offices[ch.officeId] = after;
        c.officeSince[ch.officeId] = state.day;
        // the head of government's party governs (where it changes hands on the historical track)
        const gov = db.countries.get(ch.tag)?.country?.government;
        if (historical && gov && ch.officeId === gov.effective_executive && after[0]) {
          const party = personParty(db, c, after[0]);
          if (party && c.rulingParties[0] !== party && c.partyStatus[party] === "active") {
            // a coalition partner taking the lead keeps the coalition; otherwise the new party governs alone
            c.rulingParties = c.rulingParties.includes(party) ? [party, ...c.rulingParties.filter((p) => p !== party)] : [party];
            c.govSinceDay = state.day;
          }
        }
        const names = after.map((p) => (p ? (db.people.get(p)?.name.en ?? p) : "vacant")).join(", ") || "vacant";
        log(ch.tag, "office", `${names} — ${office.title.en}`);
      }
      for (const ch of leaderChanges.get(state.day) ?? []) {
        const c = state.countries[ch.tag];
        if (!c || c.partyLeader[ch.partyId] === ch.person) continue;
        // a party's leadership follows history while it is still on its historical track
        const hist = db.parties.get(ch.partyId)?.leader_history ?? [];
        const i = hist.findIndex((l) => l.person === ch.person && typeof l.from === "string" && dayOf(l.from) === state.day);
        const prev = i > 0 ? hist[i - 1]!.person : null;
        if (historical ? !c.followsHistory && c.partyLeader[ch.partyId] !== prev : c.partyLeader[ch.partyId] !== prev && c.partyLeader[ch.partyId] !== null) continue;
        c.partyLeader[ch.partyId] = ch.person;
      }
      for (const r of referendums.get(state.day) ?? []) {
        if (state.countries[r.tag]?.followsHistory) log(r.tag, "referendum", r.text);
      }
    },
  };
}

/** A fresh set of systems (some keep per-game indexes, so each Simulation gets its own). */
export function defaultSystems(): System[] {
  return [
    createHistoricalTimelineSystem(),
    createPartyLifecycleSystem(),
    politicalPowerSystem,
    electionSystem,
    confidenceSystem,
    interestGroupSystem,
    lawDriftSystem,
    pollSystem,
    unrestSystem,
    stabilitySystem,
  ];
}
