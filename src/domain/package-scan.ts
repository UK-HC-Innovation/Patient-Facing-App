import { z } from "zod";
import { computeLabelScore, type DomainKey } from "./food-compass";
import type { IdentifiedFood, NutritionFacts } from "./types";

export const FOOD_PACKAGE_DISCLOSURE_VERSION = "2026-08-31";

/** The front photograph is evidence for identity only. It never selects a catalog row. */
export const MIN_PACKAGE_FRONT_CONFIDENCE = 0.85;

export const MAX_PACKAGE_IDENTITY_TEXT = 120;
export const MAX_PACKAGE_VISIBLE_TEXT_ITEMS = 24;
export const MAX_PACKAGE_VISIBLE_TEXT = 180;
export const MAX_PACKAGE_RAW_TEXT = 160;
export const MAX_PACKAGE_INGREDIENT_TEXT = 5_000;
export const MAX_PACKAGE_NUTRITION_ROWS = 16;

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;

const boundedWireText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !CONTROL_CHARACTERS.test(value), "control_characters");

const nullableWireText = (max: number) => boundedWireText(max).nullable();

export const packageFrontSchema = z
  .object({
    kind: z.enum(["single_package", "multiple_packages", "not_package", "unreadable"]),
    quality: z.enum(["good", "blur", "glare", "too_far", "cropped"]),
    brand: nullableWireText(MAX_PACKAGE_IDENTITY_TEXT),
    product: nullableWireText(MAX_PACKAGE_IDENTITY_TEXT),
    flavor: nullableWireText(MAX_PACKAGE_IDENTITY_TEXT),
    visibleText: z
      .array(boundedWireText(MAX_PACKAGE_VISIBLE_TEXT))
      .max(MAX_PACKAGE_VISIBLE_TEXT_ITEMS),
    confidence: z.number().finite().min(0).max(1)
  })
  .strict();

export type PackageFrontOutput = z.infer<typeof packageFrontSchema>;
export type PackageImageQuality = PackageFrontOutput["quality"];

export type PackageIdentityCandidate = {
  brand: string | null;
  product: string | null;
  flavor: string | null;
  displayName: string;
  visibleText: string[];
  confidence: number;
  quality: "good";
};

export type PackageFrontRescanReason =
  | "invalid_output"
  | "multiple_packages"
  | "not_package"
  | "unreadable"
  | "poor_quality"
  | "low_confidence"
  | "missing_identity"
  | "insufficient_evidence"
  | "instruction_text";

export type PackageFrontDecision =
  | { accepted: true; candidate: PackageIdentityCandidate }
  | { accepted: false; reason: PackageFrontRescanReason };

// These words do not distinguish one package from another. The list intentionally
// includes the generic examples frozen in spec 28 as well as their common Spanish
// equivalents. A caller may still display every word; these are ignored only for proof.
const GENERIC_PACKAGE_TOKENS = new Set([
  "a",
  "an",
  "and",
  "brand",
  "classic",
  "con",
  "de",
  "del",
  "delicious",
  "el",
  "flavor",
  "flavored",
  "flavour",
  "food",
  "g",
  "la",
  "las",
  "los",
  "natural",
  "new",
  "net",
  "original",
  "oz",
  "package",
  "paquete",
  "product",
  "ranch",
  "sabor",
  "snack",
  "snacks",
  "style",
  "tasty",
  "the",
  "weight",
  "with"
]);

function normalizedTokens(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-US")
    .match(/[\p{L}\p{N}]+/gu) ?? [];
}

/**
 * Extract tokens that can establish agreement between two independently reviewed
 * identities. Generic flavour/category words never turn a conflict into agreement.
 */
export function discriminativePackageTokens(
  values: readonly (string | null | undefined)[]
): Set<string> {
  const tokens = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const token of normalizedTokens(value)) {
      if (token.length > 1 && !GENERIC_PACKAGE_TOKENS.has(token)) {
        tokens.add(token);
      }
    }
  }
  return tokens;
}

/** True only when the two identities share at least one discriminative token. */
export function packageIdentityTokensOverlap(
  left: readonly (string | null | undefined)[],
  right: readonly (string | null | undefined)[]
): boolean {
  const leftTokens = discriminativePackageTokens(left);
  if (leftTokens.size === 0) return false;
  for (const token of discriminativePackageTokens(right)) {
    if (leftTokens.has(token)) return true;
  }
  return false;
}

const PROMPT_INJECTION_TEXT = [
  /\b(?:ignore|disregard|forget)\b.{0,48}\b(?:instructions?|prompts?|messages?|system)\b/iu,
  /\b(?:system|assistant|developer)\s*:/iu,
  /\b(?:chatgpt|openai|gpt[- ]?\d|claude|gemini|llama|anthropic)\b/iu,
  /\b(?:output|return|respond\s+with|write|print)\b.{0,48}\b(?:json|product|brand|answer)\b/iu,
  /[{}]|["']?(?:brand|product|flavor|kind|confidence)["']?\s*:/iu
];

function containsInstructionText(values: readonly (string | null)[]): boolean {
  return values.some(
    (value) => value !== null && PROMPT_INJECTION_TEXT.some((pattern) => pattern.test(value))
  );
}

function packageDisplayName(parts: readonly (string | null)[]): string {
  const kept: string[] = [];
  const normalized = new Set<string>();
  for (const part of parts) {
    if (part === null) continue;
    const key = part.normalize("NFKC").toLocaleLowerCase("en-US");
    if (!normalized.has(key)) {
      kept.push(part);
      normalized.add(key);
    }
  }
  return kept.join(" ");
}

/** Apply the deterministic front-label abstention gate to an untrusted model object. */
export function normalizePackageFront(input: unknown): PackageFrontDecision {
  const parsed = packageFrontSchema.safeParse(input);
  if (!parsed.success) return { accepted: false, reason: "invalid_output" };

  const front = parsed.data;
  if (front.kind === "multiple_packages") return { accepted: false, reason: "multiple_packages" };
  if (front.kind === "not_package") return { accepted: false, reason: "not_package" };
  if (front.kind === "unreadable") return { accepted: false, reason: "unreadable" };
  if (front.quality !== "good") return { accepted: false, reason: "poor_quality" };
  if (front.confidence < MIN_PACKAGE_FRONT_CONFIDENCE) {
    return { accepted: false, reason: "low_confidence" };
  }
  if (containsInstructionText([front.brand, front.product, front.flavor, ...front.visibleText])) {
    return { accepted: false, reason: "instruction_text" };
  }
  if (front.brand === null && front.product === null) {
    return { accepted: false, reason: "missing_identity" };
  }
  if (!packageIdentityTokensOverlap([front.brand, front.product], front.visibleText)) {
    return { accepted: false, reason: "insufficient_evidence" };
  }

  return {
    accepted: true,
    candidate: {
      brand: front.brand,
      product: front.product,
      flavor: front.flavor,
      displayName: packageDisplayName([front.brand, front.product, front.flavor]),
      visibleText: front.visibleText,
      confidence: front.confidence,
      quality: "good"
    }
  };
}

export const packageNutritionFieldSchema = z.enum([
  "calories",
  "total_fat",
  "saturated_fat",
  "trans_fat",
  "cholesterol",
  "sodium",
  "total_carbohydrate",
  "fiber",
  "total_sugars",
  "added_sugars",
  "protein",
  "potassium",
  "calcium",
  "iron",
  "mono_fat",
  "poly_fat"
]);

export type PackageNutritionField = z.infer<typeof packageNutritionFieldSchema>;

export const packageNutritionRowSchema = z
  .object({
    field: packageNutritionFieldSchema,
    printedLabel: boundedWireText(MAX_PACKAGE_RAW_TEXT),
    printedAmount: boundedWireText(MAX_PACKAGE_RAW_TEXT),
    printedUnit: nullableWireText(24)
  })
  .strict();

export type NutritionRow = z.infer<typeof packageNutritionRowSchema>;

const packageNutritionRootSchema = z
  .object({
    kind: z.enum(["nutrition_facts", "not_label", "unreadable", "ambiguous_columns"]),
    quality: z.enum(["good", "blur", "glare", "too_far", "cropped"]),
    servingSizeRaw: nullableWireText(MAX_PACKAGE_RAW_TEXT),
    servingsPerContainerRaw: nullableWireText(MAX_PACKAGE_RAW_TEXT),
    columnCount: z.number().int().min(0).max(8),
    selectedColumnHeading: nullableWireText(MAX_PACKAGE_RAW_TEXT),
    rows: z.array(packageNutritionRowSchema).max(MAX_PACKAGE_NUTRITION_ROWS),
    ingredientTextRaw: nullableWireText(MAX_PACKAGE_INGREDIENT_TEXT),
    confidence: z.number().finite().min(0).max(1)
  })
  .strict();

/** Strict wire object: every root/row key is required and row fields are unique. */
export const packageNutritionSchema = packageNutritionRootSchema.superRefine((value, context) => {
  const seen = new Set<PackageNutritionField>();
  value.rows.forEach((row, index) => {
    if (seen.has(row.field)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duplicate_nutrition_field",
        path: ["rows", index, "field"]
      });
    }
    seen.add(row.field);
  });
});

export type PackageNutritionOutput = z.infer<typeof packageNutritionRootSchema>;

export type NutritionNumberLocale = "en" | "es" | "bilingual";
export type PackageNutritionUnit = "kcal" | "g" | "mg";

export type NormalizedNutritionRow = NutritionRow & {
  value: number | null;
  normalizedUnit: PackageNutritionUnit;
  precision: "exact" | "upper_bound";
};

export type UnusableNutritionRowReason =
  | "label_mismatch"
  | "invalid_amount"
  | "percent_daily_value"
  | "wrong_unit"
  | "above_cap";

export type UnusableNutritionRow = NutritionRow & {
  reason: UnusableNutritionRowReason;
};

export type PackageNutritionWarning =
  | { code: "upper_bound_normalized_to_null"; field: PackageNutritionField }
  | {
      code: "macro_energy_mismatch";
      calories: number;
      macroCalories: number;
      difference: number;
    };

export type PackageNutritionDraft = {
  servingSize: string;
  servingGrams: number | null;
  servingsPerContainer: string | null;
  selectedColumnHeading: string | null;
  nutrition: NutritionFacts;
  rows: NormalizedNutritionRow[];
  unusableRows: UnusableNutritionRow[];
  /** Fields with no visible row at all; unusable and upper-bound rows are listed elsewhere. */
  omittedFields: PackageNutritionField[];
  ingredientText: string | null;
  warnings: PackageNutritionWarning[];
  includedDomains: DomainKey[];
  carveOut: "zero_calorie" | null;
  confidence: number;
};

export type PackageNutritionRescanReason =
  | "invalid_output"
  | "not_label"
  | "unreadable"
  | "ambiguous_columns"
  | "poor_quality"
  | "missing_serving_size"
  | "multiple_columns"
  | "per_container_column"
  | "unclear_column"
  | "duplicate_rows"
  | "missing_required_rows"
  | "relationship_mismatch"
  | "macro_factor_mismatch"
  | "insufficient_domains";

export type PackageNutritionDecision =
  | { accepted: true; draft: PackageNutritionDraft }
  | {
      accepted: false;
      reason: PackageNutritionRescanReason;
      missingFields?: PackageNutritionField[];
      unusableRows?: UnusableNutritionRow[];
      warnings?: PackageNutritionWarning[];
    };

type FieldRule = {
  unit: PackageNutritionUnit;
  max: number;
  labels: RegExp[];
};

const FIELD_RULES: Record<PackageNutritionField, FieldRule> = {
  calories: {
    unit: "kcal",
    max: 2_000,
    labels: [/\bcalories?\b/u, /\bcalorias?\b/u]
  },
  total_fat: {
    unit: "g",
    max: 300,
    labels: [/\btotal fat\b/u, /\bgrasa total\b/u]
  },
  saturated_fat: {
    unit: "g",
    max: 300,
    labels: [/\bsaturated fat\b/u, /\bgrasa saturada\b/u]
  },
  trans_fat: {
    unit: "g",
    max: 300,
    labels: [/\btrans fat\b/u, /\bfat trans\b/u, /\bgrasa trans\b/u]
  },
  cholesterol: {
    unit: "mg",
    max: 5_000,
    labels: [/\bcholesterol\b/u, /\bcolesterol\b/u]
  },
  sodium: {
    unit: "mg",
    max: 10_000,
    labels: [/\bsodium\b/u, /\bsodio\b/u]
  },
  total_carbohydrate: {
    unit: "g",
    max: 500,
    labels: [
      /\btotal carbohydrate\b/u,
      /\bcarbohydrate total\b/u,
      /\bcarbohidratos? totales?\b/u,
      /\btotal de carbohidratos?\b/u,
      /\bhidratos? de carbono\b/u
    ]
  },
  fiber: {
    unit: "g",
    max: 300,
    labels: [/\bdietary fib(?:er|re)\b/u, /\bfib(?:er|re)\b/u, /\bfibra dietetica\b/u, /\bfibra\b/u]
  },
  total_sugars: {
    unit: "g",
    max: 500,
    labels: [/\btotal sugars?\b/u, /\bsugars? total\b/u, /\bazucares? totales?\b/u]
  },
  added_sugars: {
    unit: "g",
    max: 500,
    labels: [/\badded sugars?\b/u, /\bsugars? added\b/u, /\bazucares? anadidos?\b/u, /\bazucares? agregados?\b/u]
  },
  protein: {
    unit: "g",
    max: 300,
    labels: [/\bprotein\b/u, /\bproteina\b/u]
  },
  potassium: {
    unit: "mg",
    max: 10_000,
    labels: [/\bpotassium\b/u, /\bpotasio\b/u]
  },
  calcium: {
    unit: "mg",
    max: 10_000,
    labels: [/\bcalcium\b/u, /\bcalcio\b/u]
  },
  iron: {
    unit: "mg",
    max: 500,
    labels: [/\biron\b/u, /\bhierro\b/u]
  },
  mono_fat: {
    unit: "g",
    max: 300,
    labels: [/\bmonounsaturated fat\b/u, /\bgrasa monoinsaturada\b/u]
  },
  poly_fat: {
    unit: "g",
    max: 300,
    labels: [/\bpolyunsaturated fat\b/u, /\bgrasa poliinsaturada\b/u]
  }
};

export const REQUIRED_PACKAGE_NUTRITION_FIELDS: readonly PackageNutritionField[] = [
  "calories",
  "total_fat",
  "saturated_fat",
  "sodium",
  "total_carbohydrate",
  "fiber",
  "total_sugars",
  "added_sugars",
  "protein"
];

function normalizedLabel(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function labelMatchesField(row: NutritionRow): boolean {
  const label = normalizedLabel(row.printedLabel);
  return FIELD_RULES[row.field].labels.some((pattern) => pattern.test(label));
}

const SPANISH_LABEL_MARKERS =
  /\b(?:calorias?|grasa|sodio|carbohidratos?|fibra|azucares?|proteina|potasio|calcio|hierro|porcion|porciones|envase)\b/u;
const ENGLISH_LABEL_MARKERS =
  /\b(?:calories?|fat|sodium|carbohydrate|fiber|sugars?|protein|potassium|calcium|iron|serving|container)\b/u;

export function inferNutritionNumberLocale(output: PackageNutritionOutput): NutritionNumberLocale {
  const text = normalizedLabel(
    [
      output.servingSizeRaw,
      output.servingsPerContainerRaw,
      output.selectedColumnHeading,
      ...output.rows.map((row) => row.printedLabel)
    ]
      .filter((value): value is string => value !== null)
      .join(" ")
  );
  const spanish = SPANISH_LABEL_MARKERS.test(text);
  const english = ENGLISH_LABEL_MARKERS.test(text);
  if (spanish && english) return "bilingual";
  return spanish ? "es" : "en";
}

function parseLocalizedNumber(token: string, locale: NutritionNumberLocale): number | null {
  if (!/^\d+(?:[.,]\d+)*$/u.test(token)) return null;

  let canonical = token;
  if (token.includes(",") && token.includes(".")) {
    if (locale === "en") {
      if (!/^\d{1,3}(?:,\d{3})+\.\d+$/u.test(token)) return null;
      canonical = token.replace(/,/gu, "");
    } else {
      if (!/^\d{1,3}(?:\.\d{3})+,\d+$/u.test(token)) return null;
      canonical = token.replace(/\./gu, "").replace(",", ".");
    }
  } else if (token.includes(",")) {
    if (locale === "en") {
      if (!/^\d{1,3}(?:,\d{3})+$/u.test(token)) return null;
      canonical = token.replace(/,/gu, "");
    } else if (locale === "bilingual" && /^\d+[,]\d{3}$/u.test(token) && !token.startsWith("0,")) {
      // In bilingual text, `1,000` can be either one (decimal comma) or one
      // thousand (English grouping). Abstain instead of choosing a convention.
      return null;
    } else {
      if (!/^\d+,\d+$/u.test(token)) return null;
      canonical = token.replace(",", ".");
    }
  } else if (token.includes(".") && locale !== "en" && /^\d{1,3}(?:\.\d{3})+$/u.test(token)) {
    canonical = token.replace(/\./gu, "");
  } else if ((token.match(/\./gu) ?? []).length > 1) {
    return null;
  }

  const value = Number(canonical);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizedUnit(unit: string | null): string {
  if (unit === null) return "";
  return normalizedLabel(unit).replace(/\s+/gu, "");
}

function unitKind(unit: string): PackageNutritionUnit | null {
  if (["g", "gram", "grams", "gramo", "gramos", "gr"].includes(unit)) return "g";
  if (["mg", "milligram", "milligrams", "miligramo", "miligramos"].includes(unit)) return "mg";
  if (["cal", "calorie", "calories", "caloria", "calorias", "kcal", "kilocalorie", "kilocalories"].includes(unit)) {
    return "kcal";
  }
  return null;
}

export type ParseNutritionRowResult =
  | { ok: true; row: NormalizedNutritionRow }
  | { ok: false; row: UnusableNutritionRow };

/** Parse one already schema-validated raw row without inferring or converting units. */
export function parseNutritionRow(
  row: NutritionRow,
  locale: NutritionNumberLocale = "en"
): ParseNutritionRowResult {
  if (!labelMatchesField(row)) {
    return { ok: false, row: { ...row, reason: "label_mismatch" } };
  }
  if (/%|percent|por ciento/iu.test(`${row.printedAmount} ${row.printedUnit ?? ""}`)) {
    return { ok: false, row: { ...row, reason: "percent_daily_value" } };
  }

  const amount = row.printedAmount
    .normalize("NFKC")
    .trim()
    .match(/^(<)?\s*(\d+(?:[.,]\d+)*)\s*([\p{L}]+)?$/u);
  if (!amount) {
    return { ok: false, row: { ...row, reason: "invalid_amount" } };
  }

  const value = parseLocalizedNumber(amount[2], locale);
  if (value === null) {
    return { ok: false, row: { ...row, reason: "invalid_amount" } };
  }

  const suffix = normalizedUnit(amount[3] ?? null);
  const separate = normalizedUnit(row.printedUnit);
  const suffixKind = suffix === "" ? null : unitKind(suffix);
  const separateKind = separate === "" ? null : unitKind(separate);
  if ((suffix !== "" && suffixKind === null) || (separate !== "" && separateKind === null)) {
    return { ok: false, row: { ...row, reason: "wrong_unit" } };
  }
  if (suffixKind !== null && separateKind !== null && suffixKind !== separateKind) {
    return { ok: false, row: { ...row, reason: "wrong_unit" } };
  }

  const expected = FIELD_RULES[row.field].unit;
  const seenUnit = separateKind ?? suffixKind;
  if (expected === "kcal") {
    if (seenUnit !== null && seenUnit !== "kcal") {
      return { ok: false, row: { ...row, reason: "wrong_unit" } };
    }
  } else if (seenUnit !== expected) {
    return { ok: false, row: { ...row, reason: "wrong_unit" } };
  }

  if (value > FIELD_RULES[row.field].max) {
    return { ok: false, row: { ...row, reason: "above_cap" } };
  }

  const precision = amount[1] === "<" ? "upper_bound" : "exact";
  return {
    ok: true,
    row: {
      ...row,
      value: precision === "upper_bound" ? null : value,
      normalizedUnit: expected,
      precision
    }
  };
}

function duplicateFields(rows: NutritionRow[]): boolean {
  return new Set(rows.map((row) => row.field)).size !== rows.length;
}

function duplicateFieldsInUnknown(input: unknown): boolean {
  if (typeof input !== "object" || input === null || !("rows" in input)) return false;
  const rows = (input as { rows?: unknown }).rows;
  if (!Array.isArray(rows)) return false;
  const seen = new Set<string>();
  for (const candidate of rows) {
    if (typeof candidate !== "object" || candidate === null || !("field" in candidate)) continue;
    const field = (candidate as { field?: unknown }).field;
    if (typeof field !== "string") continue;
    if (seen.has(field)) return true;
    seen.add(field);
  }
  return false;
}

function headingDecision(heading: string | null): "ok" | "per_container" | "unclear" {
  if (heading === null) return "ok";
  const normalized = normalizedLabel(heading);
  if (/\b(?:per|por) (?:container|package|envase|paquete)\b/u.test(normalized)) {
    return "per_container";
  }
  if (/\b(?:amount )?per serving\b/u.test(normalized) || /\bpor porcion\b/u.test(normalized)) {
    return "ok";
  }
  return "unclear";
}

function valueFor(
  rows: ReadonlyMap<PackageNutritionField, NormalizedNutritionRow>,
  field: PackageNutritionField
): number | null {
  return rows.get(field)?.value ?? null;
}

function servingGramsFromRaw(servingSize: string, locale: NutritionNumberLocale): number | null {
  const matches = [...servingSize.normalize("NFKC").matchAll(/(\d+(?:[.,]\d+)*)\s*(?:g|grams?|gramos?)\b/giu)];
  if (matches.length === 0) return null;
  const grams = parseLocalizedNumber(matches[matches.length - 1][1], locale);
  return grams !== null && grams <= 2_000 ? grams : null;
}

function relationshipMismatch(values: ReadonlyMap<PackageNutritionField, NormalizedNutritionRow>): boolean {
  const totalFat = valueFor(values, "total_fat");
  const saturatedFat = valueFor(values, "saturated_fat");
  const carbs = valueFor(values, "total_carbohydrate");
  const fiber = valueFor(values, "fiber");
  const totalSugars = valueFor(values, "total_sugars");
  const addedSugars = valueFor(values, "added_sugars");
  return (
    totalFat === null ||
    saturatedFat === null ||
    carbs === null ||
    fiber === null ||
    totalSugars === null ||
    addedSugars === null ||
    saturatedFat > totalFat + 1 ||
    addedSugars > totalSugars + 1 ||
    totalSugars > carbs + 1 ||
    fiber > carbs + 1
  );
}

function hasAlternateEnergyCue(output: PackageNutritionOutput, fiber: number): boolean {
  const text = normalizedLabel(
    [
      output.servingSizeRaw,
      output.selectedColumnHeading,
      output.ingredientTextRaw,
      ...output.rows.map((row) => row.printedLabel)
    ]
      .filter((value): value is string => value !== null)
      .join(" ")
  );
  return (
    fiber >= 5 ||
    /\b(?:sugar alcohols?|alcoholes? de azucar|polyols?|polialcoholes?|allulose|erythritol|xylitol|sorbitol|maltitol)\b/u.test(
      text
    )
  );
}

function nutritionFacts(
  output: PackageNutritionOutput,
  exactRows: ReadonlyMap<PackageNutritionField, NormalizedNutritionRow>,
  locale: NutritionNumberLocale
): NutritionFacts {
  const servingSize = output.servingSizeRaw as string;
  return {
    servingSize,
    servingGrams: servingGramsFromRaw(servingSize, locale),
    basis: "per_serving",
    calories: valueFor(exactRows, "calories"),
    sodiumMg: valueFor(exactRows, "sodium"),
    potassiumMg: valueFor(exactRows, "potassium"),
    totalSugarsG: valueFor(exactRows, "total_sugars"),
    addedSugarsG: valueFor(exactRows, "added_sugars"),
    saturatedFatG: valueFor(exactRows, "saturated_fat"),
    fiberG: valueFor(exactRows, "fiber"),
    proteinG: valueFor(exactRows, "protein"),
    carbsG: valueFor(exactRows, "total_carbohydrate"),
    totalFatG: valueFor(exactRows, "total_fat"),
    monoFatG: valueFor(exactRows, "mono_fat"),
    polyFatG: valueFor(exactRows, "poly_fat"),
    transFatG: valueFor(exactRows, "trans_fat"),
    cholesterolMg: valueFor(exactRows, "cholesterol"),
    calciumMg: valueFor(exactRows, "calcium"),
    ironMg: valueFor(exactRows, "iron")
  };
}

/**
 * Validate an untrusted Nutrition Facts root and produce a review-only per-serving draft.
 * No field is inferred: an unusable optional row stays visible and normalizes to null.
 */
export function validatePackageNutrition(input: unknown): PackageNutritionDecision {
  // Parse the strict shape before the unique-field refinement so duplicate rows can
  // produce the actionable rescan reason while `packageNutritionSchema` still rejects them.
  if (duplicateFieldsInUnknown(input)) return { accepted: false, reason: "duplicate_rows" };
  const parsed = packageNutritionRootSchema.safeParse(input);
  if (!parsed.success) return { accepted: false, reason: "invalid_output" };
  const output = parsed.data;

  if (duplicateFields(output.rows)) return { accepted: false, reason: "duplicate_rows" };
  if (output.kind === "not_label") return { accepted: false, reason: "not_label" };
  if (output.kind === "unreadable") return { accepted: false, reason: "unreadable" };
  if (output.kind === "ambiguous_columns") {
    return { accepted: false, reason: "ambiguous_columns" };
  }
  if (output.quality !== "good") return { accepted: false, reason: "poor_quality" };
  if (output.columnCount === 0) return { accepted: false, reason: "ambiguous_columns" };
  if (output.columnCount > 1) return { accepted: false, reason: "multiple_columns" };
  const heading = headingDecision(output.selectedColumnHeading);
  if (heading === "per_container") return { accepted: false, reason: "per_container_column" };
  if (heading === "unclear") return { accepted: false, reason: "unclear_column" };
  if (output.servingSizeRaw === null) return { accepted: false, reason: "missing_serving_size" };

  const locale = inferNutritionNumberLocale(output);
  const normalizedRows: NormalizedNutritionRow[] = [];
  const unusableRows: UnusableNutritionRow[] = [];
  const rowsByField = new Map<PackageNutritionField, NormalizedNutritionRow>();
  const warnings: PackageNutritionWarning[] = [];
  for (const rawRow of output.rows) {
    const result = parseNutritionRow(rawRow, locale);
    if (!result.ok) {
      unusableRows.push(result.row);
      continue;
    }
    normalizedRows.push(result.row);
    rowsByField.set(result.row.field, result.row);
    if (result.row.precision === "upper_bound") {
      warnings.push({ code: "upper_bound_normalized_to_null", field: result.row.field });
    }
  }

  const missingFields = REQUIRED_PACKAGE_NUTRITION_FIELDS.filter(
    (field) => rowsByField.get(field)?.precision !== "exact"
  );
  if (missingFields.length > 0) {
    return {
      accepted: false,
      reason: "missing_required_rows",
      missingFields: [...missingFields],
      unusableRows,
      warnings
    };
  }
  if (relationshipMismatch(rowsByField)) {
    return { accepted: false, reason: "relationship_mismatch", unusableRows, warnings };
  }

  const calories = valueFor(rowsByField, "calories") as number;
  const totalFat = valueFor(rowsByField, "total_fat") as number;
  const carbs = valueFor(rowsByField, "total_carbohydrate") as number;
  const protein = valueFor(rowsByField, "protein") as number;
  const fiber = valueFor(rowsByField, "fiber") as number;
  const macroCalories = 9 * totalFat + 4 * carbs + 4 * protein;
  const difference = Math.abs(macroCalories - calories);
  if (difference > Math.max(50, 0.5 * calories)) {
    warnings.push({ code: "macro_energy_mismatch", calories, macroCalories, difference });
  }
  const factorMismatch =
    macroCalories > 3 * calories + 100 || calories > 3 * macroCalories + 100;
  if (factorMismatch && !hasAlternateEnergyCue(output, fiber)) {
    return { accepted: false, reason: "macro_factor_mismatch", unusableRows, warnings };
  }

  const nutrition = nutritionFacts(output, rowsByField, locale);
  const score =
    calories === 0
      ? null
      : computeLabelScore(nutrition, {
          name: "",
          category: null,
          ingredientText: output.ingredientTextRaw
        });
  const includedDomains = score?.coverage.included ?? [];
  if (calories > 0 && includedDomains.length < 3) {
    return { accepted: false, reason: "insufficient_domains", unusableRows, warnings };
  }

  const visibleFields = new Set(output.rows.map((row) => row.field));
  const omittedFields = packageNutritionFieldSchema.options.filter(
    (field) => !visibleFields.has(field)
  );

  return {
    accepted: true,
    draft: {
      servingSize: output.servingSizeRaw,
      servingGrams: nutrition.servingGrams,
      servingsPerContainer: output.servingsPerContainerRaw,
      selectedColumnHeading: output.selectedColumnHeading,
      nutrition,
      rows: normalizedRows,
      unusableRows,
      omittedFields,
      ingredientText: output.ingredientTextRaw,
      warnings,
      includedDomains,
      carveOut: calories === 0 ? "zero_calorie" : null,
      confidence: output.confidence
    }
  };
}

export type ConfirmedPackageIdentity = {
  displayName: string | null;
  brand: string | null;
  category?: string | null;
};

/** Convert only a patient-confirmed identity plus patient-confirmed draft to persisted food. */
export function packageDraftToIdentifiedFood(args: {
  identity: ConfirmedPackageIdentity;
  draft: Pick<PackageNutritionDraft, "nutrition" | "ingredientText">;
  barcode?: string | null;
  id?: string;
  unknownName?: string;
}): IdentifiedFood {
  const displayName = args.identity.displayName?.trim();
  const unknownName = args.unknownName?.trim() || "Unknown packaged food";
  const barcode = args.barcode?.trim() || null;
  const brand = args.identity.brand?.trim() || null;
  const productName = brand && displayName?.toLocaleLowerCase().startsWith(`${brand.toLocaleLowerCase()} `)
    ? displayName.slice(brand.length).trim()
    : displayName;
  return {
    id: args.id ?? `label:${barcode ?? globalThis.crypto.randomUUID()}`,
    barcode,
    name: productName || displayName || unknownName,
    brand,
    category: args.identity.category?.trim() || null,
    nutrition: args.draft.nutrition,
    source: "label_vision",
    ingredientText: args.draft.ingredientText
  };
}

export type PackageScanResponse =
  | { mode: "front"; candidate: PackageIdentityCandidate }
  | { mode: "nutrition"; draft: PackageNutritionDraft }
  | {
      mode: "needs_rescan";
      kind: "front" | "nutrition";
      reason: PackageFrontRescanReason | PackageNutritionRescanReason;
    }
  | { mode: "disabled" }
  | { mode: "unconfigured" }
  | { mode: "locked" }
  | { mode: "error"; message: string };
