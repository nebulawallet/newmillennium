/**
 * NATO-style (APP-6) land unit symbols, drawn as our own SVG: a framed box in the country colour
 * with the branch mark inside.
 *  - infantry: crossed lines (X);
 *  - armour: an oval track;
 *  - motorised infantry: the X with wheels under it;
 *  - mechanised infantry: the X plus the armour oval.
 */
import type { MapSymbol } from "../../sim/military/fronts.ts";

export const SYMBOL_NAME: Record<MapSymbol, string> = {
  infantry: "Infantry",
  motorised: "Motorised infantry",
  mechanised: "Mechanised infantry",
  armour: "Armour",
};

/** Marks inside a 20×13 frame (the frame itself is drawn by the caller). */
function marks(s: MapSymbol): string {
  const x = `<path d="M1 1L19 12M1 12L19 1"/>`;
  const oval = `<rect x="4.5" y="3.5" width="11" height="6" rx="3"/>`;
  if (s === "infantry") return x;
  if (s === "armour") return oval;
  if (s === "mechanised") return x + oval;
  // motorised: the X and two wheels below the frame line
  return `<path d="M1 1L19 9.5M1 9.5L19 1"/><circle cx="7" cy="11" r="1.3"/><circle cx="13" cy="11" r="1.3"/>`;
}

/** SVG markup (for plain-DOM counters). */
export function symbolSvg(s: MapSymbol, color: string): string {
  return `<svg class="app6" viewBox="0 0 20 13" width="20" height="13" aria-hidden="true"><rect x="0.5" y="0.5" width="19" height="12" fill="${color}"/><g class="app6-m">${marks(s)}</g><rect class="app6-f" x="0.5" y="0.5" width="19" height="12"/></svg>`;
}
