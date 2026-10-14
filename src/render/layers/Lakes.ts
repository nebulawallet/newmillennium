import * as THREE from "three";
import type { MapData } from "../mapData.ts";
import { setWorldBounds } from "./ProvinceColors.ts";

/** Major lakes drawn over the provinces. */
export function createLakes(map: MapData): THREE.Mesh {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(map.lakePositions, 2));
  g.setIndex(new THREE.BufferAttribute(map.lakeIndices, 1));
  setWorldBounds(g);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color("#1f3842") }));
  m.frustumCulled = false;
  m.renderOrder = 1;
  return m;
}
