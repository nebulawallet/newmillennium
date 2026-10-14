import * as THREE from "three";
import type { MapData } from "../mapData.ts";
import { ProvinceColors } from "./ProvinceColors.ts";

/**
 * Approach A: one merged triangle mesh for all provinces. Each vertex carries its province id;
 * the fragment shader colours it from the lookup texture. Hover/selection are uniforms.
 */
export class ProvinceMesh {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;

  constructor(map: MapData, colors: ProvinceColors) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(map.positions, 2));
    const pid = new Float32Array(map.provinceOfVertex.length);
    for (let i = 0; i < pid.length; i++) pid[i] = map.provinceOfVertex[i]!;
    g.setAttribute("pid", new THREE.Float32BufferAttribute(pid, 1));
    g.setIndex(new THREE.BufferAttribute(map.indices, 1));
    g.computeBoundingSphere();

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uColors: { value: colors.texture },
        uHover: { value: -1 },
        uSelected: { value: -1 },
      },
      vertexShader: /* glsl */ `
        attribute float pid;
        varying float vPid;
        void main() {
          vPid = pid;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uColors;
        uniform float uHover;
        uniform float uSelected;
        varying float vPid;
        ${ProvinceColors.GLSL}
        void main() {
          float pid = floor(vPid + 0.5);
          vec3 c = texture2D(uColors, provinceUv(pid)).rgb;
          if (abs(pid - uSelected) < 0.5) c = mix(c, vec3(1.0), 0.35);
          else if (abs(pid - uHover) < 0.5) c = mix(c, vec3(1.0), 0.18);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
  }

  setHover(id: number): void {
    this.material.uniforms.uHover!.value = id || -1;
  }
  setSelected(id: number): void {
    this.material.uniforms.uSelected!.value = id || -1;
  }
}
