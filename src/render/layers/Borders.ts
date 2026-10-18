import * as THREE from "three";
import { provinceAt, type MapData } from "../mapData.ts";
import { setWorldBounds } from "./ProvinceColors.ts";

/**
 * Border lines as screen-space-width quads (WebGL lines are 1px only). Each segment becomes a
 * quad whose half-width is computed in the vertex shader from a pixel width and the current
 * world-units-per-pixel, so borders stay crisp at every zoom level.
 */
export class Borders {
  /** Country borders and coastlines (always drawn). */
  readonly mesh: THREE.Mesh;
  /** Province borders (hidden when zoomed out). */
  readonly provinceMesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;

  /** Land border segments (types 0 and 1) with the provinces on each side, in mesh order. */
  private land: { a: number; b: number }[] = [];

  constructor(private map: MapData) {
    const all = map.borders;
    // every land segment goes in both meshes (hidden in one of them by type 3), so a border can
    // switch between country and province when ownership changes; coasts only in the main mesh
    const land: number[] = [], coast: number[] = [];
    for (let i = 0; i < all.length; i += 5) {
      const t = all[i + 4]!;
      const seg = [all[i]!, all[i + 1]!, all[i + 2]!, all[i + 3]!, t];
      if (t === 2) coast.push(...seg);
      else { land.push(...seg); this.land.push(Borders.sides(map, seg)); }
    }
    const country = land.slice(), province = land.slice();
    for (let i = 4; i < land.length; i += 5) { country[i] = land[i] === 1 ? 1 : 3; province[i] = land[i] === 1 ? 3 : 0; }
    this.material = Borders.createMaterial();
    this.mesh = Borders.buildMesh(new Float32Array([...country, ...coast]), this.material);
    this.provinceMesh = Borders.buildMesh(new Float32Array(province), this.material);
  }

  /** The provinces on each side of a segment (sampled in the id map; 0 when unknown). */
  private static sides(map: MapData, seg: number[]): { a: number; b: number } {
    const [x0, y0, x1, y1] = seg as [number, number, number, number];
    const eps = (360 / map.grid.width) * 1.3;
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = (-(y1 - y0) / len) * eps, ny = ((x1 - x0) / len) * eps;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    return { a: provinceAt(map, mx + nx, my + ny), b: provinceAt(map, mx - nx, my - ny) };
  }

  /** Re-classify land borders by current ownership: different owners draw a country border. */
  setOwners(ownerOf: (province: number) => string | undefined): void {
    const ct = this.mesh.geometry.getAttribute("aType") as THREE.BufferAttribute;
    const pt = this.provinceMesh.geometry.getAttribute("aType") as THREE.BufferAttribute;
    let changed = false;
    this.land.forEach(({ a, b }, i) => {
      if (!a || !b || a === b) return;
      const country = ownerOf(a) !== ownerOf(b);
      const c = country ? 1 : 3, p = country ? 3 : 0;
      if (ct.getX(i * 4) === c && pt.getX(i * 4) === p) return;
      for (let k = 0; k < 4; k++) { ct.setX(i * 4 + k, c); pt.setX(i * 4 + k, p); }
      changed = true;
    });
    if (changed) { ct.needsUpdate = true; pt.needsUpdate = true; }
  }

  private static buildMesh(seg: Float32Array, material: THREE.ShaderMaterial): THREE.Mesh {
    const n = seg.length / 5;
    const start = new Float32Array(n * 4 * 2);
    const end = new Float32Array(n * 4 * 2);
    const corner = new Float32Array(n * 4 * 2);
    const type = new Float32Array(n * 4);
    const index = new Uint32Array(n * 6);
    const corners = [-1, 0, 1, 0, -1, 1, 1, 1];
    for (let s = 0; s < n; s++) {
      const x1 = seg[s * 5]!, y1 = seg[s * 5 + 1]!, x2 = seg[s * 5 + 2]!, y2 = seg[s * 5 + 3]!, t = seg[s * 5 + 4]!;
      for (let k = 0; k < 4; k++) {
        const v = s * 4 + k;
        start[v * 2] = x1; start[v * 2 + 1] = y1;
        end[v * 2] = x2; end[v * 2 + 1] = y2;
        corner[v * 2] = corners[k * 2]!; corner[v * 2 + 1] = corners[k * 2 + 1]!;
        type[v] = t;
      }
      index.set([s * 4, s * 4 + 1, s * 4 + 2, s * 4 + 1, s * 4 + 3, s * 4 + 2], s * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(start, 2)); // required by three; unused
    g.setAttribute("aStart", new THREE.Float32BufferAttribute(start, 2));
    g.setAttribute("aEnd", new THREE.Float32BufferAttribute(end, 2));
    g.setAttribute("aCorner", new THREE.Float32BufferAttribute(corner, 2));
    g.setAttribute("aType", new THREE.Float32BufferAttribute(type, 1));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    setWorldBounds(g);
    const mesh = new THREE.Mesh(g, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    return mesh;
  }

  private static createMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide, // quad winding depends on segment direction
      uniforms: {
        uWorldPerPx: { value: 0.1 },
        uWidths: { value: new THREE.Vector3(0.8, 1.8, 1.0) }, // province, country, coast (px)
        uProvinceAlpha: { value: 0.35 },
      },
      vertexShader: /* glsl */ `
        attribute vec2 aStart;
        attribute vec2 aEnd;
        attribute vec2 aCorner;
        attribute float aType;
        uniform float uWorldPerPx;
        uniform vec3 uWidths;
        varying float vType;
        void main() {
          vType = aType;
          vec2 dir = aEnd - aStart;
          float len = length(dir);
          dir = len > 0.0 ? dir / len : vec2(1.0, 0.0);
          vec2 nrm = vec2(-dir.y, dir.x);
          // type 3: a land segment drawn by the other mesh (collapsed to nothing here)
          float w = aType > 2.5 ? 0.0 : (aType < 0.5 ? uWidths.x : aType < 1.5 ? uWidths.y : uWidths.z) * uWorldPerPx * 0.5;
          vec2 p = mix(aStart, aEnd, aCorner.y) + nrm * aCorner.x * w + dir * (aCorner.y * 2.0 - 1.0) * w;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uProvinceAlpha;
        varying float vType;
        void main() {
          if (vType > 2.5) discard;
          if (vType < 0.5) gl_FragColor = vec4(0.03, 0.06, 0.14, uProvinceAlpha);
          else if (vType < 1.5) gl_FragColor = vec4(0.02, 0.04, 0.10, 0.9);
          else gl_FragColor = vec4(0.04, 0.10, 0.20, 0.8);
        }
      `,
    });
  }

  update(worldPerPx: number, zoom: number): void {
    this.material.uniforms.uWorldPerPx!.value = worldPerPx;
    // province borders fade in as you zoom in, and are not drawn at all when invisible
    const a = Math.min(0.45, Math.max(0, (zoom - 1.5) / 4) * 0.45);
    this.material.uniforms.uProvinceAlpha!.value = a;
    this.provinceVisible = a > 0.01;
  }

  /** Read by WorldMap to toggle the province-border mesh (and its world copies). */
  provinceVisible = false;
}
