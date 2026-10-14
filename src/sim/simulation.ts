/**
 * The simulation: advances GameState one day at a time and runs registered systems on daily,
 * weekly (Mondays), monthly (1st) and yearly (1 January) hooks. Pure TypeScript, no DOM, so it
 * can move to a Web Worker later. Player and AI actions will enter as commands (Phase 6+).
 */
import { holdersOn, type ContentDB } from "../content/compile.ts";
import { dayOf, isoOf, ymdOf } from "./date.ts";
import { Rng } from "./rng.ts";
import type { CountryState, GameState, LogEntry } from "./state.ts";

export interface SimContext {
  db: ContentDB;
  state: GameState;
  rng: Rng;
  log(tag: string | null, kind: string, text: string): void;
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

export class Simulation {
  readonly rng: Rng;
  private listeners: ((e: LogEntry) => void)[] = [];
  private ctx: SimContext;

  constructor(
    readonly db: ContentDB,
    readonly state: GameState,
    readonly systems: System[] = defaultSystems(),
  ) {
    this.rng = new Rng(state.rng);
    this.ctx = {
      db,
      state,
      rng: this.rng,
      log: (tag, kind, text) => {
        const e: LogEntry = { day: state.day, tag, kind, text };
        state.log.push(e);
        if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
        for (const l of this.listeners) l(e);
      },
    };
    for (const s of systems) s.init?.(this.ctx);
  }

  onLog(f: (e: LogEntry) => void): () => void {
    this.listeners.push(f);
    return () => (this.listeners = this.listeners.filter((x) => x !== f));
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
  const gov = db.governmentTypes.get(db.countries.get(c.tag)?.country?.government.type ?? "");
  const base = (gov?.political_power_gain ?? 1) * 0.25;
  const stabilityFactor = 0.6 + 0.4 * c.stability;
  return { base, stabilityFactor, total: base * stabilityFactor };
}

/** Influence-weighted mean interest group approval (0..100) and the stability it pulls toward. */
export function stabilityTarget(c: CountryState): { approval: number; target: number } {
  let w = 0, a = 0;
  for (const ig of Object.values(c.interestGroups)) { w += ig.influence; a += ig.influence * ig.approval; }
  const approval = w > 0 ? a / w : 50;
  return { approval, target: Math.max(0.05, Math.min(0.95, 0.5 + (approval - 50) / 80)) };
}

/** Political power accrues daily from the government type. */
export const politicalPowerSystem: System = {
  id: "political_power",
  daily({ db, state }) {
    for (const c of activeCountries(state)) c.politicalPower = Math.min(2000, c.politicalPower + politicalPowerGain(db, c).total);
  },
};

/** Weekly stability drift toward a target set by influence-weighted interest group approval. */
export const stabilitySystem: System = {
  id: "stability",
  weekly({ state }) {
    for (const c of activeCountries(state)) c.stability += (stabilityTarget(c).target - c.stability) * 0.03;
  },
};

/**
 * Historical timeline: in historical mode, real office holders and party leaders take over on
 * their real dates for as long as the office still follows history (elections, coups and player
 * actions in later phases clear `historicalOffices[officeId]`).
 */
export function createHistoricalTimelineSystem(): System {
  // day -> changes, built once from content
  let officeChanges = new Map<number, { tag: string; officeId: string }[]>();
  let leaderChanges = new Map<number, { tag: string; partyId: string; person: string }[]>();
  const push = <T>(m: Map<number, T[]>, day: number, v: T) => m.set(day, [...(m.get(day) ?? []), v]);
  return {
    id: "historical_timeline",
    init({ db, state }) {
      officeChanges = new Map();
      leaderChanges = new Map();
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
      }
    },
    daily({ db, state, log }) {
      if (state.rules.electionMode !== "historical") return;
      const today = isoOf(state.day);
      for (const ch of officeChanges.get(state.day) ?? []) {
        const c: CountryState | undefined = state.countries[ch.tag];
        if (!c?.historicalOffices[ch.officeId]) continue;
        const office = db.offices.get(ch.officeId)!;
        const before = c.offices[ch.officeId] ?? [];
        const after = holdersOn(office, today).map((h) => h.person);
        if (JSON.stringify(before) === JSON.stringify(after)) continue;
        // `to` may be the last day in office: don't report a one-day vacancy before a successor starts
        const soon = isoOf(state.day + 2);
        if (after.length === 0 && office.holders.some((h) => h.from > today && h.from <= soon)) continue;
        c.offices[ch.officeId] = after;
        const names = after.map((p) => (p ? (db.people.get(p)?.name.en ?? p) : "vacant")).join(", ") || "vacant";
        log(ch.tag, "office", `${names} — ${office.title.en}`);
      }
      for (const ch of leaderChanges.get(state.day) ?? []) {
        const c = state.countries[ch.tag];
        if (!c || c.partyLeader[ch.partyId] === ch.person) continue;
        c.partyLeader[ch.partyId] = ch.person;
      }
    },
  };
}

/** A fresh set of systems (some keep per-game indexes, so each Simulation gets its own). */
export function defaultSystems(): System[] {
  return [politicalPowerSystem, stabilitySystem, createHistoricalTimelineSystem()];
}
