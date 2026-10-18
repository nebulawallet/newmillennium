import * as THREE from "three";
// @ts-expect-error troika-three-text ships without type declarations
import { Text } from "troika-three-text";
import fontUrl from "@fontsource/archivo/files/archivo-latin-700-normal.woff?url";
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

  constructor(labels: CountryLabel[], private nameOf: (tag: string) => string) {
    this.rebuild(labels);
  }

  private make(l: CountryLabel): { label: CountryLabel; text: TroikaText; worldSize: number } {
    const t = new Text() as TroikaText;
    t.font = fontUrl;
    t.anchorX = "center";
    t.anchorY = "middle";
    t.color = 0xf2f4f7;
    t.letterSpacing = 0.12;
    t.outlineWidth = "8%";
    t.outlineColor = 0x061127;
    t.outlineOpacity = 0.6;
    t.renderOrder = 5;
    t.frustumCulled = false; // bounds are unknown until the SDF glyphs are generated
    (t.material as THREE.Material).depthTest = false;
    this.group.add(t);
    return { label: l, text: t, worldSize: 1 };
  }

  private place(it: { label: CountryLabel; text: TroikaText; worldSize: number }, l: CountryLabel): void {
    const name = this.nameOf(l.tag).toUpperCase();
    // world-unit font size: fill ~70% of the country's extent
    it.label = l;
    it.worldSize = Math.max(0.15, Math.min(6, (l.extent * 0.7) / Math.max(4, name.length * 0.62)));
    it.text.text = name;
    it.text.fontSize = it.worldSize;
    it.text.position.set(l.x, l.y, 0.5);
    it.text.userData.baseX = l.x; // WorldMap moves labels to the world copy nearest the camera from here
    it.text.rotation.z = l.angle;
    it.text.sync();
  }

  /** Place labels for these anchors: new countries get one, gone ones lose theirs, the rest move. */
  rebuild(labels: CountryLabel[]): void {
    const want = new Map(labels.map((l) => [l.tag, l]));
    this.items = this.items.filter((it) => {
      if (want.has(it.label.tag)) return true;
      this.group.remove(it.text);
      it.text.dispose();
      return false;
    });
    for (const l of labels) {
      let it = this.items.find((i) => i.label.tag === l.tag);
      if (!it) { it = this.make(l); this.items.push(it); this.place(it, l); continue; }
      const o = it.label;
      if (o.x !== l.x || o.y !== l.y || o.angle !== l.angle || o.extent !== l.extent) this.place(it, l);
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
      const visible = px >= 9 && px <= 160;
      it.text.visible = visible;
      if (visible) it.text.fillOpacity = Math.min(1, (px - 9) / 6) * Math.min(1, (160 - px) / 30);
    }
  }
}
