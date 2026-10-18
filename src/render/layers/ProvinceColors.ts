import * as THREE from "three";

/**
 * Per-province RGBA lookup texture (256 x 256 = 65,536 provinces), shared by both province
 * renderers. Map modes write colours here; switching a map mode is one texture upload.
 * Alpha holds an owner index (for country-border detection in the texture renderer).
 */
export class ProvinceColors {
  static readonly SIZE = 256;
  readonly data = new Uint8Array(ProvinceColors.SIZE * ProvinceColors.SIZE * 4);
  readonly texture: THREE.DataTexture;

  constructor() {
    this.texture = new THREE.DataTexture(this.data, ProvinceColors.SIZE, ProvinceColors.SIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.needsUpdate = true;
  }

  set(id: number, r: number, g: number, b: number): void {
    const i = id * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
  }

  setOwnerIndex(id: number, ownerIndex: number): void {
    this.data[id * 4 + 3] = ownerIndex % 256;
  }

  commit(): void {
    this.texture.needsUpdate = true;
  }

  /** GLSL helper shared by shaders: lookup uv for a province id. */
  static readonly GLSL = /* glsl */ `
    vec2 provinceUv(float pid) {
      float x = mod(pid, 256.0);
      float y = floor(pid / 256.0);
      return vec2((x + 0.5) / 256.0, (y + 0.5) / 256.0);
    }
    // atlas tone: map colours a little less saturated and settled toward the sea's navy, so the
    // political map reads as print under the HUD (presentation only; the data colours are unchanged)
    vec3 atlasTone(vec3 c) {
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 0.74);
      return mix(c, vec3(0.09, 0.16, 0.29), 0.14);
    }
  `;
}

/** Bounding sphere covering the whole projected world, for 2D (xy-only) geometries. */
export function setWorldBounds(g: THREE.BufferGeometry): void {
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 30, 0), 400);
  g.boundingBox = new THREE.Box3(new THREE.Vector3(-180, -120, -1), new THREE.Vector3(180, 180, 1));
}
