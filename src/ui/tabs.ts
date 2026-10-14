/** The HOI4 tab row: order, hotkeys, and which build phase delivers each system. */
import type { IconName } from "./icons.tsx";

export interface TabDef {
  id: TabId;
  label: string;
  key: string;
  icon: IconName;
  /** null = available now; otherwise the phase that adds it. */
  phase: string | null;
  /** What the tab will hold, shown on the placeholder panel. */
  summary: string;
}

export type TabId =
  | "politics" | "research" | "diplomacy" | "trade" | "construction"
  | "production" | "recruitment" | "logistics" | "intelligence" | "decisions";

export const TABS: TabDef[] = [
  { id: "politics", label: "Politics", key: "Q", icon: "politics", phase: null, summary: "Government, cabinet, parliament, parties, interest groups and laws." },
  { id: "research", label: "Research", key: "W", icon: "research", phase: "Phase 8", summary: "Technology trees from 1995 to beyond 2035: infantry, armour, artillery and missiles, air and drones, naval, electronics and cyber, industry and energy, economy and digital, doctrines." },
  { id: "diplomacy", label: "Diplomacy", key: "E", icon: "diplomacy", phase: "Phase 11", summary: "Relations, guarantees, military access, sanctions, blocs, the UN Security Council and foreign influence campaigns." },
  { id: "trade", label: "Trade", key: "R", icon: "trade", phase: "Phase 7", summary: "The international resource market: oil, gas, rare earths, steel, aluminium, uranium and trade deals." },
  { id: "construction", label: "Construction", key: "T", icon: "construction", phase: "Phase 7", summary: "The construction queue: infrastructure, factories, power plants, bases and air defences." },
  { id: "production", label: "Production", key: "Y", icon: "production", phase: "Phase 9", summary: "Production lines with efficiency for modern equipment, from rifles to carriers." },
  { id: "recruitment", label: "Recruitment", key: "U", icon: "recruitment", phase: "Phase 9", summary: "Division templates, training and deployment, and manpower." },
  { id: "logistics", label: "Logistics", key: "I", icon: "logistics", phase: "Phase 10", summary: "Supply, equipment stockpiles and shortfalls." },
  { id: "intelligence", label: "Intelligence", key: "O", icon: "intelligence", phase: "Phase 11", summary: "Intelligence services, foreign influence and covert support for parties and movements." },
  { id: "decisions", label: "Decisions", key: "P", icon: "decisions", phase: null, summary: "Player decisions with costs: election campaigns, reforms, emergencies." },
];
