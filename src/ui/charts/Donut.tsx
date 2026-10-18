/**
 * Donut chart for shares (ideology support). Slices under `minShare` fold into "Other" so there
 * are no unreadable slivers; a 2px surface-coloured gap separates slices; the legend (ranked,
 * with percentages) carries identity so colour is never the only cue.
 */
export interface Slice {
  key: string;
  label: string;
  color: string;
  value: number;
}

export function Donut({ slices, minShare = 0.03, size = 150 }: { slices: Slice[]; minShare?: number; size?: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const sorted = [...slices].sort((a, b) => b.value - a.value);
  const main = sorted.filter((s) => s.value / total >= minShare);
  const rest = sorted.filter((s) => s.value / total < minShare);
  const shown = rest.length ? [...main, { key: "other", label: `Other (${rest.length})`, color: "#5b6b86", value: rest.reduce((s, x) => s + x.value, 0) }] : main;

  const R = 1, r = 0.62;
  let a0 = -Math.PI / 2;
  const paths = shown.map((s) => {
    const a1 = a0 + (s.value / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${rad * Math.cos(a)} ${rad * Math.sin(a)}`;
    const d = shown.length === 1
      ? `M ${p(R, 0)} A ${R} ${R} 0 1 1 ${p(R, Math.PI)} A ${R} ${R} 0 1 1 ${p(R, 0)} M ${p(r, 0)} A ${r} ${r} 0 1 0 ${p(r, Math.PI)} A ${r} ${r} 0 1 0 ${p(r, 0)} Z`
      : `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z`;
    a0 = a1;
    return { s, d };
  });
  const pct = (v: number) => `${((v / total) * 100).toFixed(1)}%`;
  return (
    <div class="donut">
      <svg viewBox="-1.05 -1.05 2.1 2.1" width={size} height={size} role="img" aria-label="Popular support by sub-ideology">
        {paths.map(({ s, d }) => (
          <path d={d} fill={s.color} stroke="var(--s0)" stroke-width="0.03" fill-rule="evenodd">
            <title>{`${s.label}: ${pct(s.value)}`}</title>
          </path>
        ))}
      </svg>
      <ol class="donut-legend">
        {shown.map((s) => (
          <li key={s.key}>
            <i class="swatch" style={{ background: s.color }} />
            <span>{s.label}</span>
            <b class="mono">{pct(s.value)}</b>
          </li>
        ))}
      </ol>
    </div>
  );
}
