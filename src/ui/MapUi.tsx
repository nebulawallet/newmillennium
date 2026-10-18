import type { ContentDB } from "../content/compile.ts";
import type { MapData } from "../render/mapData.ts";
import { MAP_MODES } from "../render/mapModes.ts";
import type { WorldMap } from "../render/WorldMap.ts";
import { Icon, type IconName } from "./icons.tsx";
import { hoveredProvince, mapMode, pointer } from "./store.ts";
import { activeTip, tip, TipBox } from "./tooltip.tsx";
import { panel, type Session } from "./session.ts";
import { infrastructureOf, slotUse } from "../sim/economy/construction.ts";

/** Building slots of one of the player's provinces (shown in the Building slots map mode). */
function slotRows(db: ContentDB, map: MapData, session: Session | undefined, id: number): [string, string][] {
  const st = session?.state;
  const cs = st?.player ? st.countries[st.player] : undefined;
  const sm = session?.sim?.context.map;
  if (mapMode.value !== "slots" || !st || !cs || !sm || st.provinceOwner[id - 1] !== cs.tag) return [];
  const p = map.provinces[id - 1]!;
  const u = slotUse(db, st, sm, cs, p);
  const names = (rec: Record<string, number>) => Object.entries(rec).filter(([, n]) => n).map(([b, n]) => `${n} ${db.buildings.get(b)?.name.toLowerCase() ?? b}`).join(", ");
  return [
    ["Building slots", `${u.used} of ${u.total} used, ${u.free} free`],
    ["Infrastructure", `${infrastructureOf(st, p)} / 10`],
    ...(Object.keys(u.organic).length ? [["From the start", names(u.organic)] as [string, string]] : []),
    ...(Object.keys(u.built).length ? [["Built", names(u.built)] as [string, string]] : []),
    ...(u.queued ? [["Queued", String(u.queued)] as [string, string]] : []),
  ];
}

const MODE_ICON: Record<string, IconName> = {
  political: "political", terrain: "terrain", ideology: "ideology", party: "party", population: "population",
  infrastructure: "infrastructure", control: "occupation", election: "election", unrest: "unrest",
  resources: "resources", supply: "supply", diplomacy: "relations", factions: "factions", slots: "construction",
};

const fmt = new Intl.NumberFormat("en");
const nameOf = (db: ContentDB, tag: string) =>
  db.countries.get(tag)?.country?.name.en ?? db.countryList.find((c) => c.tag === tag)?.name ?? tag;

/** Bottom-right map mode cluster (HOI4 position) with the active mode's legend above it. */
export function MapModeBar({ db, map, world }: { db: ContentDB; map: MapData; world: WorldMap }) {
  const active = mapMode.value;
  const mode = MAP_MODES.find((m) => m.id === active);
  const legend = mode?.legend?.({ db, map }) ?? [];
  return (
    <div class="modes-dock">
      {legend.length > 0 && (
        <div class="legend hp">
          <div class="legend-h">{mode?.name}</div>
          {legend.slice(0, 12).map((l) => (
            <div class="legend-row" key={l.label}>
              <i class="sw" style={{ background: l.color }} />
              <span>{l.label}</span>
            </div>
          ))}
        </div>
      )}
      <div class="modes hp" role="toolbar" aria-label="Map modes">
        {MAP_MODES.map((m) => {
          return (
            <button
              key={m.id}
              class={`tile ${m.id === active ? "on" : ""} ${m.available ? "" : "stub"}`}
              aria-label={m.name}
              aria-pressed={m.id === active}
              disabled={!m.available}
              onClick={() => {
                world.setMode(m.id);
                mapMode.value = m.id;
              }}
              {...tip(() => ({ title: m.name, note: m.available ? undefined : `Arrives in ${m.availableIn}.` }))}
            >
              {Icon[MODE_ICON[m.id] ?? "political"]({ size: 20 })}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Map hover tooltip (only when no UI tooltip is showing). */
export function ProvinceTooltip({ db, map, session }: { db: ContentDB; map: MapData; session?: Session }) {
  const id = hoveredProvince.value;
  panel.value; // re-check when a panel or the menu opens under a still pointer
  if (!id || activeTip.value) return null;
  const p = map.provinces[id - 1];
  if (!p) return null;
  const { x, y } = pointer.value;
  // the map keeps its last hover when the pointer moves onto a panel: only show over the map
  const over = document.elementFromPoint(x, y);
  if (over && over.id !== "map" && !over.closest(".unit-layer, .battle-layer")) return null;
  return (
    <TipBox
      x={x}
      y={y}
      t={{
        title: p.name,
        rows: [
          ["Owner", nameOf(db, p.owner)],
          ...(p.controller !== p.owner ? [["Controller", <span class="warn">{nameOf(db, p.controller)}</span>] as [string, preact.ComponentChildren]] : []),
          ["Terrain", p.terrain],
          ["Population", fmt.format(p.population)],
          ...slotRows(db, map, session, id),
        ],
      }}
    />
  );
}

