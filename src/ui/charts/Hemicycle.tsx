/**
 * Parliament hemicycle: one dot per seat, arranged in concentric arcs, filled left to right in
 * the given party order. Party colours come from the data; identity is also carried by the
 * legend and per-seat hover titles.
 */
export interface SeatGroup {
  key: string;
  label: string;
  color: string;
  seats: number;
  /** Members of the governing coalition get a ring in the legend. */
  governing?: boolean;
}

interface Seat { x: number; y: number; angle: number }

/** Lay out n seats on concentric arcs (outer rows hold more seats). */
function layout(n: number, rInner = 0.38, rOuter = 1): { seats: Seat[]; dot: number } {
  if (n <= 0) return { seats: [], dot: 0 };
  // pick the row count whose arc lengths best fit n seats of equal pitch
  let rows = Math.max(1, Math.round(Math.sqrt(n / 2.2)));
  rows = Math.min(rows, 18);
  const radii = Array.from({ length: rows }, (_, i) => (rows === 1 ? (rInner + rOuter) / 2 : rInner + ((rOuter - rInner) * i) / (rows - 1)));
  const total = radii.reduce((s, r) => s + r, 0);
  const counts = radii.map((r) => Math.max(1, Math.round((n * r) / total)));
  let diff = n - counts.reduce((s, c) => s + c, 0);
  for (let i = rows - 1; diff !== 0; i = (i - 1 + rows) % rows) {
    counts[i]! += Math.sign(diff);
    diff -= Math.sign(diff);
  }
  const seats: Seat[] = [];
  radii.forEach((r, row) => {
    const c = counts[row]!;
    for (let k = 0; k < c; k++) {
      const angle = c === 1 ? Math.PI / 2 : Math.PI - (Math.PI * k) / (c - 1);
      seats.push({ x: r * Math.cos(angle), y: r * Math.sin(angle), angle });
    }
  });
  seats.sort((a, b) => b.angle - a.angle); // left (pi) to right (0)
  const pitch = (rOuter - rInner) / Math.max(1, rows - 1);
  const arcPitch = (Math.PI * rOuter) / Math.max(1, counts[rows - 1]! - 1);
  return { seats, dot: Math.min(pitch, arcPitch) * 0.42 };
}

export function Hemicycle({ groups, total, title }: { groups: SeatGroup[]; total: number; title: string }) {
  const counted = groups.reduce((s, g) => s + g.seats, 0);
  const n = Math.max(total, counted);
  const { seats, dot } = layout(n);
  const owner: SeatGroup[] = [];
  for (const g of groups) for (let i = 0; i < g.seats; i++) owner.push(g);
  const majority = Math.floor(n / 2) + 1;
  return (
    <figure class="hemicycle">
      <svg viewBox="-1.08 -1.08 2.16 1.16" role="img" aria-label={`${title}: ${n} seats`}>
        {seats.map((s, i) => {
          const g = owner[i];
          return (
            <circle cx={s.x} cy={-s.y} r={dot} fill={g?.color ?? "var(--line-2)"}>
              <title>{g ? `${g.label}: ${g.seats} seats` : "vacant"}</title>
            </circle>
          );
        })}
        <text x="0" y="-0.12" text-anchor="middle" class="hemi-total">{n}</text>
        <text x="0" y="-0.01" text-anchor="middle" class="hemi-sub">majority {majority}</text>
      </svg>
      <figcaption>
        {groups.filter((g) => g.seats > 0).map((g) => (
          <span class={g.governing ? "governing" : ""} key={g.key}>
            <i class="swatch" style={{ background: g.color }} /> {g.label} <b>{g.seats}</b>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
