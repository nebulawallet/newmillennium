import type { ComponentChildren } from "preact";
import { Icon, type IconName } from "../icons.tsx";

/** Left slide-out panel docked under the top bar (HOI4 position). */
export function SidePanel({ title, icon, onClose, children, label }: { title: string; icon?: IconName; onClose: () => void; children: ComponentChildren; label?: string }) {
  return (
    <section class="side hp" aria-label={label ?? title}>
      <header class="hp-head">
        {icon && <span class="side-ic">{Icon[icon]({ size: 18 })}</span>}
        <h2 class="hp-title">{title}</h2>
        <button class="x" onClick={onClose} aria-label="Close panel">{Icon.close({ size: 14 })}</button>
      </header>
      <div class="side-body">{children}</div>
    </section>
  );
}

/** Silhouette placeholder until real portraits are supplied (data/portraits/<person-id>.jpg, later). */
export function Portrait({ size = "md", tint }: { size?: "sm" | "md" | "lg"; tint?: string }) {
  return (
    <span class={`portrait p-${size}`} style={tint ? { "--tint": tint } : undefined} aria-hidden="true">
      <svg viewBox="0 0 60 76" preserveAspectRatio="xMidYMax slice">
        <circle cx="30" cy="28" r="12.5" />
        <path d="M5 76c1.5-17 11.5-27 25-27s23.5 10 25 27Z" />
        <path class="collar" d="M23 50l7 9 7-9" />
      </svg>
    </span>
  );
}
