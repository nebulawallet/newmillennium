/** Shared UI state (Preact signals). The simulation will publish into this in Phase 4. */
import { signal } from "@preact/signals";

export const hoveredProvince = signal(0);
export const selectedProvince = signal(0);
export const mapMode = signal("political");
export const pointer = signal({ x: 0, y: 0 });
/** Country highlighted on the start screen (clicked in the list or on the map). */
export const pickedCountry = signal<string | null>(null);
