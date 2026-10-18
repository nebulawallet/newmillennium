/**
 * Authored line icons for the game shell: one 24px grid, 1.6 stroke, round caps, currentColor.
 * Original drawings (no third-party icon art).
 */
import type { JSX } from "preact";

type P = { size?: number; class?: string };
const svg = (paths: JSX.Element, { size = 22, class: c }: P = {}) => (
  <svg class={`ic ${c ?? ""}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {paths}
  </svg>
);

export const Icon = {
  // ---- tabs
  politics: (p?: P) => svg(<><path d="M4 20h16" /><path d="M5 17h14" /><path d="M6 17V9M10 17V9M14 17V9M18 17V9" /><path d="M3.5 8.5 12 4l8.5 4.5" /></>, p),
  research: (p?: P) => svg(<><path d="M9.5 3h5" /><path d="M10.5 3v5.2L5.4 17.4A2 2 0 0 0 7.2 20.4h9.6a2 2 0 0 0 1.8-3L13.5 8.2V3" /><path d="M7.6 14h8.8" /></>, p),
  diplomacy: (p?: P) => svg(<><path d="M3 11.5 7 7.5l3 1.5 3-2 4 1 4 3.5" /><path d="M7 7.5 3.5 4M17 8l3.5-3.5" /><path d="m8 13 2.2 2.2a1.4 1.4 0 0 0 2-2L10 11" /><path d="m11 16 1.4 1.4a1.4 1.4 0 0 0 2-2L13 14" /><path d="m14.3 17.6.6.6a1.4 1.4 0 0 0 2-2L13 12" /><path d="M21 11.5 17 15.5" /></>, p),
  trade: (p?: P) => svg(<><path d="M12 4v16" /><path d="M7 20h10" /><path d="M5 7h14" /><path d="m5 7-3 6a3 3 0 0 0 6 0Z" /><path d="m19 7-3 6a3 3 0 0 0 6 0Z" /></>, p),
  construction: (p?: P) => svg(<><path d="M4 21V10l5-3v14" /><path d="M9 21V4h2v17" /><path d="M11 6h9l-2 3" /><path d="M18 9v4" /><path d="M16.5 13h3v2.5h-3z" /><path d="M2 21h20" /></>, p),
  production: (p?: P) => svg(<><path d="M3 20V11l5 3v-3l5 3v-3l5 3V5h3v15Z" /><path d="M7 17h1.5M11.5 17H13M16 17h1.5" /></>, p),
  recruitment: (p?: P) => svg(<><circle cx="12" cy="7.5" r="3.5" /><path d="M5 21c0-4 3.1-6.5 7-6.5s7 2.5 7 6.5" /><path d="M12 14.5v6.5" /><path d="M9 3.7 12 2l3 1.7" /></>, p),
  logistics: (p?: P) => svg(<><path d="M2 7h11v10H2z" /><path d="M13 10h4.5l3.5 3.5V17h-8" /><circle cx="6" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>, p),
  intelligence: (p?: P) => svg(<><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2" /></>, p),
  decisions: (p?: P) => svg(<><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><path d="M9 11h7M9 14h7M9 17h4" /></>, p),
  focus: (p?: P) => svg(<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>, p),
  // ---- stats
  power: (p?: P) => svg(<><path d="M12 3 5 7v2h14V7Z" /><path d="M7 9v8M12 9v8M17 9v8" /><path d="M4 20h16M5 17h14" /></>, p),
  stability: (p?: P) => svg(<><path d="M12 4v16" /><path d="M6 20h12" /><path d="M4 8h16" /><path d="M7 8 4.5 13.5h5Z" /><path d="M17 8l-2.5 5.5h5Z" /><circle cx="12" cy="4" r="1" /></>, p),
  warSupport: (p?: P) => svg(<><path d="M5 21V4" /><path d="M5 4h11l-2.5 3.5L16 11H5" /></>, p),
  manpower: (p?: P) => svg(<><circle cx="8" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.5" /><path d="M2.5 20c0-3.4 2.4-6 5.5-6s5.5 2.6 5.5 6" /><path d="M14 14.3c.8-.4 1.6-.6 2.5-.6 2.8 0 5 2.3 5 5.5" /></>, p),
  factories: (p?: P) => svg(<><path d="M3 20V11l5 3v-3l5 3V7h3v4h2V4h3v16Z" /></>, p),
  treasury: (p?: P) => svg(<><ellipse cx="12" cy="6" rx="7" ry="2.5" /><path d="M5 6v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" /><path d="M5 10v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4" /><path d="M5 14v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4" /></>, p),
  // ---- map modes
  political: (p?: P) => svg(<><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20Z" /><path d="M9 4v13.5M15 6.5V20" /></>, p),
  terrain: (p?: P) => svg(<><path d="m2 19 6.5-11 4 6.5 2.5-3.5L22 19Z" /><path d="m6.5 11.5 2 1.5 2-1" /></>, p),
  ideology: (p?: P) => svg(<><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17" /><path d="M12 12 18.3 6.3" /></>, p),
  party: (p?: P) => svg(<><path d="M4 21V9h16v12" /><path d="M2 9 12 3l10 6" /><path d="M9 21v-6h6v6" /></>, p),
  population: (p?: P) => svg(<><circle cx="6" cy="8" r="2.2" /><circle cx="12" cy="6.5" r="2.4" /><circle cx="18" cy="8" r="2.2" /><path d="M2.5 17c0-2.2 1.6-4 3.5-4M21.5 17c0-2.2-1.6-4-3.5-4" /><path d="M7.5 19c0-3 2-5.2 4.5-5.2s4.5 2.2 4.5 5.2" /></>, p),
  infrastructure: (p?: P) => svg(<><path d="M8 3 5 21M16 3l3 18" /><path d="M12 4v2.5M12 9.5v2.5M12 15v2.5M12 20v1" /></>, p),
  occupation: (p?: P) => svg(<><path d="M4 4h16v16H4z" /><path d="M4 12 12 4M4 20 20 4M12 20l8-8" /></>, p),
  election: (p?: P) => svg(<><path d="M4 11h16v9H4z" /><path d="M9 11V5h6v6" /><path d="M8 15h8" /></>, p),
  unrest: (p?: P) => svg(<><path d="M12 3 2.5 20h19Z" /><path d="M12 9.5v5" /><path d="M12 17.2v.3" /></>, p),
  resources: (p?: P) => svg(<><path d="M7 20h10l1-5H6Z" /><path d="M8.5 15c0-3 1.5-5 3.5-7.5 2 2.5 3.5 4.5 3.5 7.5" /><path d="M12 7.5V3" /></>, p),
  supply: (p?: P) => svg(<><path d="M3 8 12 3l9 5v8l-9 5-9-5Z" /><path d="m3 8 9 5 9-5M12 13v8" /></>, p),
  relations: (p?: P) => svg(<><circle cx="6" cy="12" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="m8.7 10.6 6.6-3.2M8.7 13.4l6.6 3.2" /></>, p),
  factions: (p?: P) => svg(<><path d="M12 3 4 6.5v5c0 4.6 3.4 8.4 8 9.5 4.6-1.1 8-4.9 8-9.5v-5Z" /><path d="M12 8v8M8 12h8" /></>, p),
  // ---- controls
  pause: (p?: P) => svg(<><path d="M8.5 5v14M15.5 5v14" stroke-width="2.4" /></>, p),
  play: (p?: P) => svg(<><path d="M7 4.5 19 12 7 19.5Z" fill="currentColor" stroke="none" /></>, p),
  plus: (p?: P) => svg(<><path d="M12 5v14M5 12h14" stroke-width="2" /></>, p),
  minus: (p?: P) => svg(<><path d="M5 12h14" stroke-width="2" /></>, p),
  close: (p?: P) => svg(<><path d="m6 6 12 12M18 6 6 18" stroke-width="2" /></>, p),
  menu: (p?: P) => svg(<><path d="M4 6.5h16M4 12h16M4 17.5h16" stroke-width="1.8" /></>, p),
  chevron: (p?: P) => svg(<><path d="m9 6 6 6-6 6" stroke-width="2" /></>, p),
  up: (p?: P) => svg(<><path d="m6 15 6-6 6 6" stroke-width="2" /></>, p),
  down: (p?: P) => svg(<><path d="m6 9 6 6 6-6" stroke-width="2" /></>, p),
  search: (p?: P) => svg(<><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>, p),
  lock: (p?: P) => svg(<><path d="M6 11h12v9H6z" /><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" /></>, p),
  check: (p?: P) => svg(<><path d="m5 12.5 4.5 4.5L19 7.5" stroke-width="2.2" /></>, p),
  exclusive: (p?: P) => svg(<><path d="M3 12h18" /><path d="m7 8-4 4 4 4M17 8l4 4-4 4" /><path d="M12 7v10" stroke-width="2.2" /></>, p),
  centre: (p?: P) => svg(<><circle cx="12" cy="12" r="3" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /></>, p),
  // ---- research categories and technologies
  infantry: (p?: P) => svg(<><path d="M5 18 19 4M5 4l14 14" /><path d="M3 20h4M17 20h4" /></>, p),
  armour: (p?: P) => svg(<><rect x="3" y="12" width="18" height="6" rx="3" /><path d="M7 12V9h8l2 3" /><path d="M15 10.5h6" /></>, p),
  artillery: (p?: P) => svg(<><path d="M4 18 18 6" /><path d="m16 4 4 4" /><circle cx="7" cy="18" r="2.5" /><path d="M10 18h8" /></>, p),
  air: (p?: P) => svg(<><path d="M12 3v18" /><path d="M3 13l9-4 9 4" /><path d="M8 20l4-2 4 2" /></>, p),
  naval: (p?: P) => svg(<><path d="M3 15h18l-3 5H6Z" /><path d="M8 15V9h6l2 6" /><path d="M11 9V5" /></>, p),
  doctrine: (p?: P) => svg(<><path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4Z" /><path d="M20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6Z" /></>, p),
  electronics: (p?: P) => svg(<><rect x="7" y="7" width="10" height="10" /><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" /></>, p),
  industry: (p?: P) => svg(<><path d="M13 2 5 13h6l-1 9 8-11h-6Z" /></>, p),
  digital: (p?: P) => svg(<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5Z" /></>, p),
  missile: (p?: P) => svg(<><path d="M14 4h6v6L9 21l-6-6Z" /><path d="m6 12 6 6M3 21l3-3" /></>, p),
};

export type IconName = keyof typeof Icon;
