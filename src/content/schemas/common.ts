import { z } from "zod";

/** Calendar date, "YYYY-MM-DD". */
export const IsoDate = z.iso.date().describe("Calendar date, YYYY-MM-DD");
export type IsoDate = z.infer<typeof IsoDate>;

/** A date or a bare year (for founding dates known only to the year). */
export const DateOrYear = z.union([IsoDate, z.number().int().min(1500).max(2100)]);

/** Lower-case snake_case identifier. */
export const Id = z
  .string()
  .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, "ids are lower snake_case");

/** Country tag: three upper-case letters (ISO alpha-3 where one exists). */
export const Tag = z.string().regex(/^[A-Z]{3}$/, "country tags are three upper-case letters");

/**
 * Country-scoped id, e.g. "deu.angela_merkel", "usa.president", "gbr.labour".
 * The prefix is the lower-cased country tag that owns the record.
 */
export const ScopedId = z
  .string()
  .regex(/^[a-z]{3}\.[a-z0-9]+(?:_[a-z0-9]+)*$/, "scoped ids look like 'deu.some_name'");

export const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "colors are #rrggbb");

export const Share = z.number().min(0).max(1);

export const LocalName = z.strictObject({
  en: z.string().min(1),
  /** Name in the original language and script. */
  native: z.string().min(1).optional(),
  /** Romanisation of `native` when it is not in Latin script. */
  native_latin: z.string().min(1).optional(),
});
export type LocalName = z.infer<typeof LocalName>;

export const SourceRef = z.strictObject({
  url: z.url(),
  title: z.string().min(1),
  accessed: IsoDate,
  note: z.string().optional(),
});
export type SourceRef = z.infer<typeof SourceRef>;

export const Confidence = z.enum(["verified", "needs_review"]);
export type Confidence = z.infer<typeof Confidence>;

/** Every record about the real world carries these. */
export const sourced = {
  source: z.array(SourceRef).min(1, "at least one source is required"),
  confidence: Confidence,
  /** What exactly needs checking, when confidence is needs_review. */
  review_note: z.string().optional(),
};

/** Map of modifier id -> value. Modifier ids are checked against data/modifiers.json. */
export const Modifiers = z.record(Id, z.number());
