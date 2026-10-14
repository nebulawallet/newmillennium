import { describe, expect, it } from "vitest";
import { compileContent } from "../src/content/compile.ts";
import { NodeFiles } from "../scripts/lib/nodeFiles.ts";

describe("real data", () => {
  const { db, issues } = compileContent(new NodeFiles(), { tier: "full", only: new Set(["DEU"]) });
  const errors = issues.filter((i) => i.severity === "error");

  it("global definitions have no errors", () => {
    expect(errors.filter((e) => !e.file.startsWith("countries/"))).toEqual([]);
  });

  it("the DEU exemplar passes the full tier", () => {
    expect(errors.filter((e) => e.tag === "DEU")).toEqual([]);
  });

  it("DEU starts with Rau and Schröder and an SPD-Green government", () => {
    const deu = db.countries.get("DEU")!.country!;
    expect(deu.start_2000.ruling_parties).toEqual(["deu.spd", "deu.greens"]);
    const hos = db.offices.get(deu.government.head_of_state_office)!;
    const hog = db.offices.get(deu.government.head_of_government_office)!;
    expect(hos.holders[0]!.person).toBe("deu.johannes_rau");
    expect(hog.holders[0]!.person).toBe("deu.gerhard_schroeder");
  });

  it("covers every UN member state", () => {
    expect(db.countryList.filter((c) => c.un_member_today).length).toBe(193);
  });
});
