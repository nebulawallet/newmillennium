/**
 * Party lifecycle and between-election polling.
 *  - Founding: a not-yet-founded party becomes active on its founding date. Predecessors named in
 *    its lineage (formed_from, renamed_from) merge into it: their seats, vote share and calibration
 *    pass to the new party.
 *  - Dissolution: on its dissolution date a party merges into its successor (merged_into /
 *    renamed_to), or its seats pass to independents.
 *  - Polls: each week a party's support moves toward the vote model's current share.
 */
import type { ContentDB } from "../../content/compile.ts";
import { dayOf } from "../date.ts";
import type { SimContext, System } from "../simulation.ts";
import type { CountryState } from "../state.ts";
import { modelShares } from "./voteModel.ts";

const startDay = (d: string | number) => dayOf(typeof d === "number" ? `${d}-01-01` : d);
const endDay = (d: string | number) => dayOf(typeof d === "number" ? `${d}-12-31` : d);

/** Merge party `from` into `to`: seats, ruling positions, popularity and calibration. */
export function mergeParty(db: ContentDB, cs: CountryState, from: string, to: string | null): void {
  for (const seats of Object.values(cs.seats)) {
    const n = seats[from];
    if (!n) continue;
    delete seats[from];
    const key = to ?? "independents";
    seats[key] = (seats[key] ?? 0) + n;
  }
  const replace = (list: string[]) => [...new Set(list.map((p) => (p === from ? to : p)).filter((p): p is string => !!p))];
  cs.rulingParties = replace(cs.rulingParties);
  cs.confidenceAndSupply = replace(cs.confidenceAndSupply);
  if (to) {
    const pf = cs.partyPopularity[from] ?? 0, pt = cs.partyPopularity[to] ?? 0;
    const bf = cs.partyBias[from] ?? 1, bt = cs.partyBias[to];
    cs.partyBias[to] = bt === undefined || pt <= 0 ? bf : (bt * pt + bf * pf) / Math.max(1e-9, pt + pf);
    cs.partyPopularity[to] = pt + pf;
  }
  cs.partyPopularity[from] = 0;
  cs.partyStatus[from] = "dissolved";
  void db;
}

export function createPartyLifecycleSystem(): System {
  const events = new Map<number, { tag: string; party: string; kind: "found" | "dissolve" }[]>();
  const push = (day: number, e: { tag: string; party: string; kind: "found" | "dissolve" }) => events.set(day, [...(events.get(day) ?? []), e]);
  return {
    id: "party_lifecycle",
    init({ db, state }) {
      events.clear();
      for (const [tag, cc] of db.countries) {
        for (const p of cc.parties) {
          if (p.status_2000 === "not_yet_founded") {
            const d = startDay(p.founded);
            if (d > state.day) push(d, { tag, party: p.id, kind: "found" });
          }
          if (p.dissolved !== undefined) {
            const d = endDay(p.dissolved);
            if (d > state.day) push(d, { tag, party: p.id, kind: "dissolve" });
          }
        }
      }
    },
    daily({ db, state, log }) {
      for (const e of events.get(state.day) ?? []) {
        const cs = state.countries[e.tag];
        const p = db.parties.get(e.party);
        if (!cs || !p) continue;
        if (e.kind === "found" && cs.partyStatus[e.party] === "not_yet_founded") {
          cs.partyStatus[e.party] = "active";
          cs.partyPopularity[e.party] = cs.partyPopularity[e.party] ?? 0;
          cs.partyBias[e.party] = cs.partyBias[e.party] ?? 1;
          const preds = [...(p.lineage?.formed_from ?? []), ...(p.lineage?.renamed_from ? [p.lineage.renamed_from] : [])];
          for (const pr of preds) if (cs.partyStatus[pr] && cs.partyStatus[pr] !== "dissolved") mergeParty(db, cs, pr, e.party);
          if (!preds.length && p.lineage?.split_from) {
            // a split takes a fifth of its parent's support to start with
            const parent = p.lineage.split_from;
            const share = (cs.partyPopularity[parent] ?? 0) * 0.2;
            cs.partyPopularity[parent] = (cs.partyPopularity[parent] ?? 0) - share;
            cs.partyPopularity[e.party] = share;
            cs.partyBias[e.party] = cs.partyBias[parent] ?? 1;
          }
          if (!cs.partyPopularity[e.party]) cs.partyPopularity[e.party] = 0.01;
          // leader on founding (exact dates only; year-only leaders come from the timeline)
          const lead = p.leader_history.find((l) => startDay(l.from) <= state.day && (l.to === undefined || endDay(l.to) > state.day));
          if (lead) cs.partyLeader[e.party] = lead.person;
          log(e.tag, "party", `${p.name.en} founded`);
        } else if (e.kind === "dissolve" && cs.partyStatus[e.party] !== "dissolved") {
          const to = p.lineage?.merged_into ?? p.lineage?.renamed_to ?? null;
          if (to && cs.partyStatus[to] === "not_yet_founded") {
            cs.partyStatus[to] = "active";
            cs.partyBias[to] = cs.partyBias[to] ?? 1;
          }
          mergeParty(db, cs, e.party, to);
          log(e.tag, "party", to ? `${p.name.en} merges into ${db.parties.get(to)?.name.en ?? to}` : `${p.name.en} dissolved`);
        }
      }
    },
  };
}

/** Weekly polls: party support drifts toward the model's current share. */
export const pollSystem: System = {
  id: "polls",
  weekly({ db, state }) {
    for (const cs of Object.values(state.countries)) {
      if (!cs.active || !Object.keys(cs.partyStatus).length) continue;
      const m = modelShares(db, cs, state.day);
      for (const [p, v] of Object.entries(m)) cs.partyPopularity[p] = (cs.partyPopularity[p] ?? 0) * 0.92 + v * 0.08;
    }
  },
};
