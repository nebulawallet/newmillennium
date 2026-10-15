/**
 * Staggered per-country work (Phase 12): monthly country updates run on the country's own day of
 * the month (1st-28th) instead of all on the 1st, so no single day carries every country.
 */
import { ymdOf } from "./date.ts";

/** Stable bucket for a tag (0..n-1). */
export function bucketOf(tag: string, n: number): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return h % n;
}

/** Is today this country's monthly slot? */
export function monthlyDue(tag: string, day: number): boolean {
  return bucketOf(tag, 28) === ymdOf(day).day - 1;
}
