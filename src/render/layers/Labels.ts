import * as THREE from "three";
// @ts-expect-error troika-three-text ships without type declarations
import { Text } from "troika-three-text";
import fontUrl from "@fontsource/inter/files/inter-latin-600-normal.woff?url";
import type { CountryLabel } from "../mapData.ts";

interface TroikaText extends THREE.Mesh {
  text: string;
  font: string;
  fontSize: number;
  anchorX: string;
  anchorY: string;
  color: number;
  outlineWidth: number | string;
  outlineColor: number;
  outlineOpacity: number;
  fillOpacity: number;
  letterSpacing: number;
  sync(): void;
  dispose(): void;
}

/**
 * Zoom-scaled country labels (SDF text). Size follows the country's extent; labels are hidden
 * when they would be too small to read or too large for the screen.
 */
export class Labels {
  readonly group = new THREE.Group();
  private items: { label: CountryLabel; text: TroikaText; worldSize: number }[] = [];

  constructor(labels: CountryLabel[], nameOf: (tag: string) => string) {
    for (const l of labels) {
      const name = nameOf(l.tag).toUpperCase();
      // world-unit font size: fill ~70% of the country's extent
      const worldSize = Math.max(0.15, Math.min(6, (l.extent * 0.7) / Math.max(4, name.length * 0.62)));
      const t = new Text() as TroikaText;
      t.text = name;
      t.font = fontUrl;
      t.fontSize = worldSize;
      t.anchorX = "center";
      t.anchorY = "middle";
      t.color = 0xf2f4f7;
      t.letterSpacing = 0.12;
      t.outlineWidth = "8%";
      t.outlineColor = 0x05070a;
      t.outlineOpacity = 0.6;
      t.position.set(l.x, l.y, 0.5);
      t.rotation.z = l.angle;
      t.renderOrder = 5;
      t.frustumCulled = false; // bounds are unknown until the SDF glyphs are generated
      (t.material as THREE.Material).depthTest = false;
      t.sync();
      this.group.add(t);
      this.items.push({ label: l, text: t, worldSize });
    }
  }

  setText(tag: string, name: string): void {
    const it = this.items.find((i) => i.label.tag === tag);
    if (it) { it.text.text = name.toUpperCase(); it.text.sync(); }
  }

  /** Show labels whose on-screen height is within a readable range. */
  update(worldPerPx: number): void {
    for (const it of this.items) {
      const px = it.worldSize / worldPerPx;
      const visible = px >= 9 && px <= 90;
      it.text.visible = visible;
      if (visible) it.text.fillOpacity = Math.min(1, (px - 9) / 6) * Math.min(1, (90 - px) / 20);
    }
  }
}
