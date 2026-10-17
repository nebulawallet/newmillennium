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
export const planTool = signal<{ army: number; kind: "front" | "offensive" | "spearhead" } | null>(null);
/** Provinces crossed so far by the line or arrow being drawn. */
export const planDraft = signal<number[]>([]);
/** Building being placed from the Construction tab: map clicks queue it in the clicked province. */
export const buildMode = signal<string | null>(null);
/** Result of the last placement click (shown in the Construction tab). */
export const buildMsg = signal("");
/** A short message near the bottom of the screen (orders refused, plans set). */
export const toast = signal<{ text: string; bad?: boolean; at: number } | null>(null);
/** The war shown in the war overview (null: closed). */
export const openWar = signal<number | null>(null);
/** Peace conference: the defeated country whose provinces map clicks add or remove (null: off). */
export const peacePick = signal<string | null>(null);
/** A peace imposed on the player (shown until dismissed). */
export const peaceNotice = signal<{ title: string; lines: string[] } | null>(null);
/** Peace conference drafts: per defeated country, the kind of term, picked provinces and ideology. */
export const draftTerms = signal<Record<string, { kind: "none" | "annex" | "provinces" | "puppet"; provinces: number[]; ideology: string | null }>>({});
