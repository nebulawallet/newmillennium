import type { ContentDB } from "../content/compile.ts";
import { countrySummary } from "../content/query.ts";
import type { MapData } from "../render/mapData.ts";
import { MAP_MODES } from "../render/mapModes.ts";
import type { WorldMap } from "../render/WorldMap.ts";
import { hoveredProvince, mapMode, pointer, selectedProvince } from "./store.ts";

interface Props {
  db: ContentDB;
  map: MapData;
  world: WorldMap;
}

const fmt = new Intl.NumberFormat("en");
const countryName = (db: ContentDB, tag: string) =>
  db.countries.get(tag)?.country?.name.en ?? db.countryList.find((c) => c.tag === tag)?.name ?? tag;

export function MapModeBar({ db, map, world }: Props) {
  const active = mapMode.value;
  const mode = MAP_MODES.find((m) => m.id === active);
  const legend = mode?.legend?.({ db, map }) ?? [];
  return (
    <div class="mapmode-bar panel">
      <div class="modes">
        {MAP_MODES.map((m) => (
          <button
            key={m.id}
            class={m.id === active ? "on" : ""}
            disabled={!m.available}
            title={m.available ? m.name : `${m.name} — arrives in ${m.availableIn}`}
            onClick={() => {
              world.setMode(m.id);
              mapMode.value = m.id;
            }}
          >
            {m.name}
          </button>
        ))}
      </div>
      {legend.length > 0 && (
        <div class="legend">
          {legend.slice(0, 14).map((l) => (
            <span key={l.label}>
              <i class="swatch" style={{ background: l.color }} /> {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProvinceTooltip({ db, map }: Omit<Props, "world">) {
  const id = hoveredProvince.value;
  if (!id) return null;
  const p = map.provinces[id - 1];
  if (!p) return null;
  const { x, y } = pointer.value;
  return (
    <div class="tooltip panel" style={{ left: `${x + 16}px`, top: `${y + 16}px` }}>
      <div class="tt-name">{p.name}</div>
      <div class="dim">{countryName(db, p.owner)}</div>
      {p.controller !== p.owner && <div class="warn">Controlled by {countryName(db, p.controller)}</div>}
      <div class="faint">
        {p.terrain} · {fmt.format(p.population)} people
      </div>
    </div>
  );
}

export function ProvincePanel({ db, map }: Omit<Props, "world">) {
  const id = selectedProvince.value;
  if (!id) return null;
  const p = map.provinces[id - 1];
  if (!p) return null;
  const owner = countrySummary(db, p.owner);
  return (
    <section class="province-panel panel">
      <header>
        <h2>{p.name}</h2>
        <button class="close" onClick={() => (selectedProvince.value = 0)} aria-label="Close">×</button>
      </header>
      <dl>
        <dt>Owner</dt>
        <dd>{countryName(db, p.owner)}</dd>
        {p.controller !== p.owner && (
          <>
            <dt>Controller</dt>
            <dd class="warn">{countryName(db, p.controller)}</dd>
          </>
        )}
        <dt>Population</dt>
        <dd>{fmt.format(p.population)}</dd>
        <dt>Area</dt>
        <dd>{fmt.format(p.area_km2)} km²</dd>
        <dt>Terrain</dt>
        <dd>{p.terrain} <span class="faint">({p.elevation_m} m, relief {p.ruggedness_m} m)</span></dd>
        <dt>Infrastructure</dt>
        <dd>{p.infrastructure} / 10</dd>
        <dt>Coastal</dt>
        <dd>{p.coastal ? "yes" : "no"}</dd>
        <dt>Source units</dt>
        <dd class="mono faint">{p.adm1.slice(0, 4).join(", ")}{p.adm1.length > 4 ? ` +${p.adm1.length - 4}` : ""}</dd>
      </dl>
      {owner && (
        <div class="owner-box">
          <div class="dim">{owner.govType}</div>
          <div>Head of state: {owner.headOfState}</div>
          <div>Head of government: {owner.headOfGovernment}</div>
        </div>
      )}
    </section>
  );
}
