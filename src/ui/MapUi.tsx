import type { ContentDB } from "../content/compile.ts";
import type { MapData } from "../render/mapData.ts";
import { MAP_MODES } from "../render/mapModes.ts";
import type { WorldMap } from "../render/WorldMap.ts";
import { Icon, type IconName } from "./icons.tsx";
import { hoveredProvince, mapMode, pointer } from "./store.ts";
import { activeTip, tip, TipBox } from "./tooltip.tsx";

const MODE_ICON: Record<string, IconName> = {
  political: "political", terrain: "terrain", ideology: "ideology", party: "party", population: "population",
  infrastructure: "infrastructure", control: "occupation", election: "election", unrest: "unrest",
  resources: "resources", supply: "supply", diplomacy: "relations", factions: "factions",
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
export function ProvinceTooltip({ db, map }: { db: ContentDB; map: MapData }) {
  const id = hoveredProvince.value;
  if (!id || activeTip.value) return null;
  const p = map.provinces[id - 1];
  if (!p) return null;
  const { x, y } = pointer.value;
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
        ],
      }}
    />
  );
}

