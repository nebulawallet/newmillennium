/**
 * A country in an actor role sits behind a delegate's nameplate: its flag and short name in wide
 * capitals. Seated (navy plate) by default; turned up (white plate) for the player, the selection
 * or the winner; absent (outlined) for a country out of play. A long name narrows on the font's
 * width axis to fit the plate instead of being cut.
 */
import type { ContentDB } from "../content/compile.ts";
import type { GameState } from "../sim/state.ts";
import { Flag } from "./Flag.tsx";
import { countryShortName } from "../sim/politics/unrest.ts";

/** The name a country goes by on the map and on plates (dynamic countries use their own). */
export function shortName(db: ContentDB, state: GameState | null | undefined, tag: string): string {
  // no game yet (the 1 January 2000 start screen): the name a country starts with
  if (!state) { const start = db.countryList.find((c) => c.tag === tag)?.start_name; if (start) return start; }
  return countryShortName(db, state, tag);
}

/** Width-axis setting that fits a name of this length: wide up to ten letters, narrower beyond. */
export const plateFit = (name: string) => `${Math.round(Math.max(75, Math.min(118, 1180 / Math.max(10, name.length))))}%`;

const FLAG_SIZE = { sm: "xs", md: "sm", lg: "md" } as const;

export function Placard({ db, state, tag, up, absent, size = "sm", name }: {
  db: ContentDB;
  state?: GameState | null;
  tag: string;
  up?: boolean;
  absent?: boolean;
  size?: "sm" | "md" | "lg";
  name?: string;
}) {
  const n = name ?? shortName(db, state, tag);
  const out = absent ?? state?.countries[tag]?.active === false;
  return (
    <span class={`placard pl-${size} ${up && !out ? "up" : ""} ${out ? "absent" : ""}`} style={{ "--fit": plateFit(n) }}>
      <Flag db={db} tag={tag} size={FLAG_SIZE[size]} />
      <span class="pl-name">{n}</span>
    </span>
  );
}
