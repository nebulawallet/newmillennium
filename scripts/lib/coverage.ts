import { GAME_START, holdersOn, type ContentDB } from "../../src/content/compile.ts";

/** Per-region / per-country completeness table for --report. */
export function coverageTable(db: ContentDB, only?: Set<string>): string {
  const rows: string[] = [];
  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  rows.push(
    pad("TAG", 5) + pad("region", 18) + pad("T", 3) + pad("HoS 2000", 26) + pad("HoG 2000", 26) +
      pad("ppl", 5) + pad("pty", 5) + pad("elec", 5) + pad("cab", 5) + pad("mil", 5) + "review",
  );
  const byRegion = new Map<string, { done: number; total: number }>();
  for (const e of db.countryList) {
    if (only && !only.has(e.tag)) continue;
    const cc = db.countries.get(e.tag)!;
    const r = byRegion.get(e.region) ?? { done: 0, total: 0 };
    r.total++;
    if (cc.country) r.done++;
    byRegion.set(e.region, r);
    const name = (officeId?: string) => {
      const o = officeId ? db.offices.get(officeId) : undefined;
      if (!o) return "-";
      const target = o.ex_officio_of ? (db.offices.get(o.ex_officio_of) ?? o) : o;
      const hs = holdersOn(target, GAME_START);
      if (!hs.length) return "MISSING";
      return hs
        .map((h) => (h.person ? (db.people.get(h.person)?.name.en ?? h.person) : "vacant"))
        .join(" / ")
        .slice(0, 24);
    };
    const review = [...cc.people, ...cc.parties, ...(cc.country?.offices ?? []), ...cc.cabinet, ...cc.military].filter(
      (r) => r.confidence === "needs_review",
    ).length;
    rows.push(
      pad(e.tag, 5) + pad(e.region, 18) + pad(e.detail_tier, 3) +
        pad(name(cc.country?.government.head_of_state_office), 26) +
        pad(name(cc.country?.government.head_of_government_office), 26) +
        pad(cc.people.length, 5) + pad(cc.parties.length, 5) + pad(cc.elections?.elections.length ?? 0, 5) +
        pad(cc.cabinet.length, 5) + pad(cc.military.length, 5) + review,
    );
  }
  rows.push("");
  for (const [r, v] of byRegion) rows.push(`${pad(r, 18)} ${v.done}/${v.total} countries with data`);
  return rows.join("\n");
}
