import * as THREE from "three";
import type { MapData } from "../mapData.ts";
import { ProvinceColors } from "./ProvinceColors.ts";

/**
 * Approach B: a single quad textured with the province-id raster. The fragment shader decodes
 * the id, looks up its colour and draws province/country borders by comparing neighbouring
 * texels (owner index is stored in the lookup texture's alpha channel).
 */
export class ProvinceTexture {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  readonly idTexture: THREE.Texture;

  constructor(map: MapData, colors: ProvinceColors) {
    this.idTexture = new THREE.Texture(map.idImage);
    this.idTexture.magFilter = THREE.NearestFilter;
    this.idTexture.minFilter = THREE.NearestFilter;
    this.idTexture.generateMipmaps = false;
    this.idTexture.colorSpace = THREE.NoColorSpace;
    this.idTexture.flipY = false;
    this.idTexture.premultiplyAlpha = false;
    this.idTexture.needsUpdate = true;

    const { yTop, yBottom } = map.grid;
    const geo = new THREE.PlaneGeometry(360, yTop - yBottom);
    geo.translate(0, (yTop + yBottom) / 2, 0);
    // map uv so v = 0 at the top row of the image (flipY = false)
    const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uIds: { value: this.idTexture },
        uColors: { value: colors.texture },
        uTexel: { value: new THREE.Vector2(1 / map.grid.width, 1 / map.grid.height) },
        uHover: { value: -1 },
        uSelected: { value: -1 },
        uBorderAlpha: { value: 0.35 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uIds;
        uniform sampler2D uColors;
        uniform vec2 uTexel;
        uniform float uHover;
        uniform float uSelected;
        uniform float uBorderAlpha;
        varying vec2 vUv;
        ${ProvinceColors.GLSL}
        float idAt(vec2 uv) {
          vec4 t = texture2D(uIds, uv);
          return floor(t.r * 255.0 + 0.5) + floor(t.g * 255.0 + 0.5) * 256.0;
        }
        void main() {
          float pid = idAt(vUv);
          if (pid < 0.5) discard;
          vec4 look = texture2D(uColors, provinceUv(pid));
          vec3 c = look.rgb;
          if (abs(pid - uSelected) < 0.5) c = mix(c, vec3(1.0), 0.35);
          else if (abs(pid - uHover) < 0.5) c = mix(c, vec3(1.0), 0.18);
          // borders: compare with the 4 neighbouring texels
          float edge = 0.0, country = 0.0;
          vec2 d[4];
          d[0] = vec2(uTexel.x, 0.0); d[1] = vec2(-uTexel.x, 0.0); d[2] = vec2(0.0, uTexel.y); d[3] = vec2(0.0, -uTexel.y);
          for (int i = 0; i < 4; i++) {
            float n = idAt(vUv + d[i]);
            if (n != pid) {
              edge = 1.0;
              if (n < 0.5 || texture2D(uColors, provinceUv(n)).a != look.a) country = 1.0;
            }
          }
          c = mix(c, vec3(0.05), country * 0.85 + (1.0 - country) * edge * uBorderAlpha);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
  }

  setHover(id: number): void {
    this.material.uniforms.uHover!.value = id || -1;
  }
  setSelected(id: number): void {
    this.material.uniforms.uSelected!.value = id || -1;
  }
}
