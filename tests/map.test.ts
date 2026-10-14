/** Regression tests for the generated 1 January 2000 map (public/map, built by npm run build-map). */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const provPath = resolve(root, "public/map/provinces.json");
const built = existsSync(provPath);

interface P { id: number; name: string; owner: string; controller: string; adm1: string[]; population: number; area_km2: number; terrain: string }

describe.skipIf(!built)("map of 1 January 2000", () => {
  const provinces: P[] = built ? JSON.parse(readFileSync(provPath, "utf8")) : [];
  const tags = new Set<string>(JSON.parse(readFileSync(resolve(root, "data/world/countries.json"), "utf8")).countries.map((c: { tag: string }) => c.tag));
  const ownerOfAdm1 = (code: string) => provinces.find((p) => p.adm1.includes(code))?.owner;
  const owners = new Set(provinces.map((p) => p.owner));

  it("has 3,000-5,000 provinces with sequential ids", () => {
    expect(provinces.length).toBeGreaterThanOrEqual(3000);
    expect(provinces.length).toBeLessThanOrEqual(5000);
    provinces.forEach((p, i) => expect(p.id).toBe(i + 1));
  });

  it("only uses known country tags", () => {
    for (const p of provinces) {
      expect(tags.has(p.owner), p.owner).toBe(true);
      expect(tags.has(p.controller), p.controller).toBe(true);
    }
  });

  it("puts Crimea and Sevastopol in Ukraine", () => {
    expect(ownerOfAdm1("RUS-283")).toBe("UKR");
    expect(ownerOfAdm1("RUS-5482")).toBe("UKR");
  });

  it("keeps Serbia, Montenegro and Kosovo in FR Yugoslavia, and South Sudan in Sudan", () => {
    const yug = provinces.filter((p) => p.owner === "YUG").flatMap((p) => p.adm1.map((a) => a.slice(0, 3)));
    expect(new Set(yug)).toEqual(new Set(["SRB", "MNE", "KOS"]));
    expect(owners.has("SSD")).toBe(false);
    expect(ownerOfAdm1("SDS-865")).toBe("SDN");
  });

  it("has the de facto entities of 2000 and separate Taiwan", () => {
    for (const t of ["PMR", "ABK", "SOS", "NKR", "NCY", "SML", "KUR", "TWN", "PSE", "TLS"]) expect(owners.has(t), t).toBe(true);
  });

  it("gives every UN member with territory at least one province", () => {
    const list = JSON.parse(readFileSync(resolve(root, "data/world/countries.json"), "utf8")).countries as { tag: string; start_status: string }[];
    const missing = list.filter((c) => c.start_status === "independent" && !owners.has(c.tag)).map((c) => c.tag);
    // Microstates absent from Natural Earth admin-1 at 1:10m would show up here.
    expect(missing).toEqual([]);
  });

  it("reproduces world population in 2000 (about 6.1 billion)", () => {
    const total = provinces.reduce((s, p) => s + p.population, 0);
    expect(total).toBeGreaterThan(5.9e9);
    expect(total).toBeLessThan(6.3e9);
  });

  it("names provinces uniquely within each country", () => {
    const seen = new Set<string>();
    for (const p of provinces) {
      const k = `${p.owner}|${p.name}`;
      expect(seen.has(k), k).toBe(false);
      seen.add(k);
    }
  });
});
