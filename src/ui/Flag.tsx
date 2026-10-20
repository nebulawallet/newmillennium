/**
 * National flag in a bronze mat. The SVGs are flag-icons (MIT, public/flags/LICENSE), mapped by
 * data/world/flags.json. Tags without an ISO flag (insurgent governments, de facto states, armed
 * groups, countries released in play) show their map colour with the tag.
 */
import type { ContentDB } from "../content/compile.ts";
import { isoOf } from "../sim/date.ts";
import { flagDay, flagOverrides } from "./store.ts";

const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";

export function flagUrl(db: ContentDB, tag: string, day = flagDay.value): string | null {
  // a flag used only for part of the period (the Islamic Emirate's in Afghanistan, 1997-2001 and from 2021)
  const own = flagOverrides.value[tag];
  if (own) return `${BASE}flags/${own}.svg`;
  const iso = isoOf(day);
  const dated = db.datedFlags.get(tag)?.find((f) => (!f.from || f.from <= iso) && (!f.to || iso < f.to));
  const code = dated?.code ?? db.flags.get(tag);
  return code ? `${BASE}flags/${code}.svg` : null;
}

export function Flag({ db, tag, color, size = "md" }: { db: ContentDB; tag: string; color?: string; size?: "xs" | "sm" | "md" | "lg" }) {
  const url = flagUrl(db, tag);
  const c = color ?? db.countryColors.get(tag) ?? "#555";
  return (
    <span class={`flag f-${size} ${url ? "img" : ""}`} style={{ "--flag": c }} aria-hidden="true">
      {url ? <img src={url} alt="" draggable={false} loading="lazy" /> : <span class="flag-tag">{tag}</span>}
    </span>
  );
}
