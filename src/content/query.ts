/** Read-only helpers over the ContentDB, shared by UI and simulation. */
import { GAME_START, holdersOn, type ContentDB } from "./compile.ts";
import type { Person } from "./schemas/country.ts";

/** People holding an office on a date (follows ex officio links, e.g. a realm's monarch). */
export function officeHolders(db: ContentDB, officeId: string, date = GAME_START): (Person | null)[] {
  let o = db.offices.get(officeId);
  for (let i = 0; o?.ex_officio_of && i < 5; i++) o = db.offices.get(o.ex_officio_of);
  if (!o) return [];
  return holdersOn(o, date).map((h) => (h.person ? (db.people.get(h.person) ?? null) : null));
}

export interface CountrySummary {
  tag: string;
  name: string;
  region: string;
  status: string;
  govType: string;
  headOfState: string;
  headOfGovernment: string;
  rulingParty: string;
  rulingPartyColor: string;
}

const names = (ps: (Person | null)[]) => (ps.length ? ps.map((p) => (p ? p.name.en : "Vacant")).join(" / ") : "—");

export function countrySummary(db: ContentDB, tag: string, date = GAME_START): CountrySummary | null {
  const cc = db.countries.get(tag);
  const c = cc?.country;
  if (!cc || !c) return null;
  const lead = c.start_2000.ruling_parties[0];
  const party = lead ? db.parties.get(lead) : undefined;
  return {
    tag,
    name: c.name.en,
    region: cc.entry.region,
    status: cc.entry.start_status,
    govType: db.governmentTypes.get(c.government.type)?.name ?? c.government.type,
    headOfState: names(officeHolders(db, c.government.head_of_state_office, date)),
    headOfGovernment: names(officeHolders(db, c.government.head_of_government_office, date)),
    rulingParty: party ? `${party.name.en} (${party.abbrev.en})` : "—",
    rulingPartyColor: party?.color ?? "#555",
  };
}
