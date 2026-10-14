import * as THREE from "three";
import type { MapData } from "../mapData.ts";
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

  constructor(map: MapData) {
    const all = map.borders;
    const pick = (keep: (t: number) => boolean) => {
      const out: number[] = [];
      for (let i = 0; i < all.length; i += 5) if (keep(all[i + 4]!)) for (let k = 0; k < 5; k++) out.push(all[i + k]!);
      return new Float32Array(out);
    };
    this.material = Borders.createMaterial();
    this.mesh = Borders.buildMesh(pick((t) => t !== 0), this.material);
    this.provinceMesh = Borders.buildMesh(pick((t) => t === 0), this.material);
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
          float w = (aType < 0.5 ? uWidths.x : aType < 1.5 ? uWidths.y : uWidths.z) * uWorldPerPx * 0.5;
          vec2 p = mix(aStart, aEnd, aCorner.y) + nrm * aCorner.x * w + dir * (aCorner.y * 2.0 - 1.0) * w;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uProvinceAlpha;
        varying float vType;
        void main() {
          if (vType < 0.5) gl_FragColor = vec4(0.04, 0.05, 0.07, uProvinceAlpha);
          else if (vType < 1.5) gl_FragColor = vec4(0.02, 0.02, 0.03, 0.9);
          else gl_FragColor = vec4(0.10, 0.16, 0.22, 0.75);
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
