/**
 * Game dates are integer day numbers since 2000-01-01 (day 0) in the proleptic Gregorian
 * calendar (UTC), which keeps state compact and arithmetic trivial.
 */
const EPOCH = Date.UTC(2000, 0, 1);
const DAY_MS = 86_400_000;

export function dayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / DAY_MS);
}

export function isoOf(day: number): string {
  return new Date(EPOCH + day * DAY_MS).toISOString().slice(0, 10);
}

export interface Ymd {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  weekday: number; // 0 = Sunday
}

export function ymdOf(day: number): Ymd {
  const d = new Date(EPOCH + day * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay() };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatDate(day: number): string {
  const { year, month, day: d } = ymdOf(day);
  return `${d} ${MONTHS[month - 1]} ${year}`;
}

/** Whole years between a birth year and a game day (approximate age). */
export function ageOn(birthYear: number, day: number): number {
  return ymdOf(day).year - birthYear;
}
