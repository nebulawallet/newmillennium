/** Shared UI state (Preact signals). The simulation will publish into this in Phase 4. */
import { signal } from "@preact/signals";

export const hoveredProvince = signal(0);
export const selectedProvince = signal(0);
export const mapMode = signal("political");
export const pointer = signal({ x: 0, y: 0 });
/** Country highlighted on the start screen (clicked in the list or on the map). */
export const pickedCountry = signal<string | null>(null);
/** The player's selected divisions (ids). */
export const selectedDivisions = signal<number[]>([]);
/** The army whose card is selected in the bottom bar (0 = none). */
export const selectedArmy = signal(0);
/** Battle-plan drawing tool in use: the army it draws for and what it draws. */
export const planTool = signal<{ army: number; kind: "offensive" | "spearhead" } | null>(null);
/** Provinces crossed so far by the line or arrow being drawn. */
export const planDraft = signal<number[]>([]);
