import { labelExtractionSchema } from "@/domain/label-extraction-schema";
import type { IdentifiedFood, NutritionFacts } from "@/domain/types";
import { t, type Language } from "@/i18n/strings";

type VisionRouteResponse =
  | { mode: "answer"; content: string }
  | { mode: "unconfigured" }
  | { mode: "locked" }
  | { mode: "error"; message?: string };

export type LabelExtractionResult =
  | { ok: true; food: IdentifiedFood }
  | { ok: false };

export const LABEL_EXTRACTION_QUESTION =
  "Transcribe the visible Nutrition Facts panel into the requested JSON object.";

export function buildLabelExtractionPrompt(): string {
  return [
    "Transcribe only text and numbers visibly printed in this nutrition-label photo.",
    "Never estimate, infer, calculate, fill in, or correct a nutritional value. Use null whenever a field is unreadable or is not printed.",
    "Return exactly one JSON object with these keys: productName, servingSize, servingGrams, calories, sodiumMg, potassiumMg, totalSugarsG, addedSugarsG, saturatedFatG, fiberG, proteinG, carbsG, totalFatG, monoFatG, polyFatG, transFatG, cholesterolMg, calciumMg, ironMg, ingredientText.",
    "Use numbers only for the printed per-serving values. Use grams for fields ending in G and milligrams for fields ending in Mg. servingGrams is only the printed gram weight of one serving.",
    "Copy productName, servingSize, and ingredientText as printed. Return JSON only, with no markdown or explanation."
  ].join("\n\n");
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function parseLabelExtraction(content: string) {
  const parsed = labelExtractionSchema.safeParse(safeJsonParse(content));
  return parsed.success ? parsed.data : null;
}

function toNutritionFacts(
  parsed: NonNullable<ReturnType<typeof parseLabelExtraction>>,
  language: Language
): NutritionFacts {
  return {
    servingSize: parsed.servingSize ?? t(language, "labelServingUnknown"),
    servingGrams: parsed.servingGrams,
    basis: "per_serving",
    calories: parsed.calories,
    sodiumMg: parsed.sodiumMg,
    potassiumMg: parsed.potassiumMg,
    totalSugarsG: parsed.totalSugarsG,
    addedSugarsG: parsed.addedSugarsG,
    saturatedFatG: parsed.saturatedFatG,
    fiberG: parsed.fiberG,
    proteinG: parsed.proteinG,
    carbsG: parsed.carbsG,
    totalFatG: parsed.totalFatG,
    monoFatG: parsed.monoFatG,
    polyFatG: parsed.polyFatG,
    transFatG: parsed.transFatG,
    cholesterolMg: parsed.cholesterolMg,
    calciumMg: parsed.calciumMg,
    ironMg: parsed.ironMg
  };
}

export async function extractNutritionLabel(args: {
  image: string | null;
  barcode: string | null;
  patientId: string;
  language: Language;
  passcode?: string;
}): Promise<LabelExtractionResult> {
  if (!args.image) {
    return { ok: false };
  }

  let route: VisionRouteResponse;
  try {
    const response = await fetch("/api/food/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: args.patientId,
        passcode: args.passcode,
        question: LABEL_EXTRACTION_QUESTION,
        system: buildLabelExtractionPrompt(),
        image: args.image,
        json: true,
        maxTokens: 700
      })
    });
    route = (await response.json()) as VisionRouteResponse;
  } catch {
    return { ok: false };
  }

  if (route.mode !== "answer") {
    return { ok: false };
  }

  const parsed = parseLabelExtraction(route.content);
  // computeLabelScore requires printed calories. Other unreadable fields remain
  // null and are handled by its existing label-coverage rules.
  if (!parsed || parsed.calories === null) {
    return { ok: false };
  }

  return {
    ok: true,
    food: {
      id: `label:${args.barcode ?? crypto.randomUUID()}`,
      barcode: args.barcode,
      name: parsed.productName ?? t(args.language, "unknownFood"),
      brand: null,
      category: null,
      nutrition: toNutritionFacts(parsed, args.language),
      source: "label_vision",
      ingredientText: parsed.ingredientText
    }
  };
}
