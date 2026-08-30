import { z } from "zod";
import type { CompassScore, FnddsRecord, NotScoreableReason } from "./food-compass";

// One photo of a dinner, decomposed. The model names the separate foods and estimates the
// mass of each; every number a patient ever sees still comes from the ledger row those
// names resolve to. This module holds the contract and the pure helpers so the route stays
// thin and the client can import the types without pulling minisearch into its bundle.

/** A ledger row offered as a one-tap correction for a scanned plate item. */
export type PlateCandidate = { code: string; description: string; fcs: number };

/**
 * The identify route's match shape minus `alternatives` and `estimatedDomains`. A plate of
 * five foods does not need five "better options" lists, and the per-item swap chips are the
 * correction path here.
 */
export type PlateMatch = {
  food: { code: string; description: string; group: string };
  tier: "T1";
  score: CompassScore;
  nutrients: FnddsRecord | null;
};

/**
 * Carve-outs are per item, so one glass of water on the table cannot swallow the plate.
 * (The identify route's whole-response `{mode:"carve_out"}` contract is untouched.)
 */
export type PlateItemResult =
  | {
      kind: "match";
      match: PlateMatch;
      candidates: PlateCandidate[];
      /** Half-steps of the 100 g ledger basis, clamped; null when the model gave no mass. */
      proposedServings: number | null;
      /** The model's household phrase for the amount, e.g. "about two cups". */
      basis: string | null;
    }
  | { kind: "carve_out"; name: string; reason: NotScoreableReason }
  | { kind: "none"; name: string; candidates: PlateCandidate[] };

export type PlateResponse =
  | { mode: "plate"; items: PlateItemResult[] }
  | { mode: "none" }
  | { mode: "unconfigured" }
  | { mode: "locked" }
  | { mode: "error"; message: "empty_request" | "plate_request_error" };

/** At most five foods per scan: past that the model is guessing at garnish. */
export const MAX_PLATE_FOODS = 5;
/** Below this the model is not naming a food, it is listing what might be there. */
export const MIN_PLATE_CONFIDENCE = 0.3;
const MAX_PLATE_GRAMS = 2_000;

/**
 * Half the width of the displayed carb range, as a fraction of the point estimate. Photo
 * portions are estimates and the range says so; nothing stored ever carries it.
 */
export const CARB_RANGE_BAND = 0.3;

const MIN_PROPOSED_SERVINGS = 0.5;
const MAX_PROPOSED_SERVINGS = 6;

/**
 * `toIdentifiedFood` emits per-100 g facts with `servingGrams: 100`, so one serving of a T1
 * ledger match IS 100 g. Half-steps are the honest resolution of a photo estimate: 137 g and
 * 152 g are the same guess.
 */
export function servingsFromGrams(grams: number | null): number | null {
  if (grams === null || !Number.isFinite(grams) || grams <= 0) {
    return null;
  }
  const halfSteps = Math.round((grams / 100) * 2) / 2;
  return Math.min(MAX_PROPOSED_SERVINGS, Math.max(MIN_PROPOSED_SERVINGS, halfSteps));
}

// Each field fails independently to null, following the label-extraction schema: one
// implausible gram value must not discard the four foods parsed either side of it.
const visionText = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional().catch(null).transform((value) => value ?? null);

const visionGrams = z
  .number()
  .finite()
  .gt(0)
  .max(MAX_PLATE_GRAMS)
  .nullable()
  .optional()
  .catch(null)
  .transform((value) => value ?? null);

const visionConfidence = z
  .number()
  .finite()
  .min(0)
  .max(1)
  .nullable()
  .optional()
  .catch(null)
  .transform((value) => value ?? null);

const EMPTY_VISION_FOOD = { name: null, grams: null, note: null, confidence: null };

const plateVisionFoodSchema = z.object({
  name: visionText(120),
  grams: visionGrams,
  note: visionText(120),
  confidence: visionConfidence
});

export const plateVisionSchema = z.object({
  foods: z.array(plateVisionFoodSchema.catch(EMPTY_VISION_FOOD)).catch([])
});

export type PlateVisionFood = {
  name: string;
  grams: number | null;
  note: string | null;
  confidence: number | null;
};

export function normalizePlateFoods(parsed: unknown): PlateVisionFood[] {
  const result = plateVisionSchema.safeParse(parsed);
  if (!result.success) {
    return [];
  }
  const kept: PlateVisionFood[] = [];
  for (const entry of result.data.foods) {
    if (entry.name === null) {
      continue;
    }
    if (entry.confidence !== null && entry.confidence < MIN_PLATE_CONFIDENCE) {
      continue;
    }
    kept.push({ name: entry.name, grams: entry.grams, note: entry.note, confidence: entry.confidence });
    if (kept.length === MAX_PLATE_FOODS) {
      break;
    }
  }
  return kept;
}

const EMPTY_CHOICE = { item: null, row: null };

const choiceNumber = z
  .number()
  .int()
  .nullable()
  .optional()
  .catch(null)
  .transform((value) => value ?? null);

export const plateChoicesSchema = z.object({
  choices: z.array(z.object({ item: choiceNumber, row: choiceNumber }).catch(EMPTY_CHOICE)).catch([])
});

/**
 * item index -> chosen row index. A missing item, or a `row: -1`, leaves the item unresolved
 * on purpose: the caller demotes it to `kind:"none"` with its candidates still attached.
 */
export function plateChoiceRows(parsed: unknown): Map<number, number> {
  const rows = new Map<number, number>();
  const result = plateChoicesSchema.safeParse(parsed);
  if (!result.success) {
    return rows;
  }
  for (const choice of result.data.choices) {
    if (choice.item === null || choice.row === null || rows.has(choice.item)) {
      continue;
    }
    rows.set(choice.item, choice.row);
  }
  return rows;
}
