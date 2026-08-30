import type { Language } from "@/i18n/strings";
import { bandForScore, type CompassBand, type CompassScore, type CompassTier } from "./food-compass";
import type { FoodFlag } from "./food-flags";
import { buildMealLogEntry } from "./meal-log";
import { scaleNutrition } from "./portion";
import type { IdentifiedFood, MealLogEntry, NutritionFacts } from "./types";

export type PlateItemScore = Pick<CompassScore, "fcs" | "band" | "tier">;

export type PlateItem = {
  id?: string;
  food: IdentifiedFood;
  servings: number;
  compassScore: PlateItemScore | null;
  /**
   * Where this item's serving count came from, for the surfaces that hedge a photo estimate.
   * Session-only by construction: `summarizePlate` and `buildPlateEntries` both ignore it, so
   * nothing here reaches `mealLogEntrySchema` or the stored state.
   */
  portion?: { origin: "vision" | "user"; basis: string | null };
};

export type PlateAverage = {
  fcs: number;
  band: CompassBand;
  method: "calorie_weighted" | "simple_mean";
};

export type PlateSummary = {
  nutrition: NutritionFacts | null;
  incomplete: boolean;
  flagsFood: IdentifiedFood | null;
  plateAverage: PlateAverage | null;
};

const numericNutritionFields = [
  "servingGrams",
  "calories",
  "sodiumMg",
  "potassiumMg",
  "totalSugarsG",
  "addedSugarsG",
  "saturatedFatG",
  "fiberG",
  "proteinG",
  "carbsG",
  "totalFatG",
  "monoFatG",
  "polyFatG",
  "transFatG",
  "cholesterolMg",
  "calciumMg",
  "ironMg"
] as const satisfies ReadonlyArray<Exclude<keyof NutritionFacts, "servingSize" | "basis">>;

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

export function summarizePlate(items: PlateItem[]): PlateSummary {
  if (items.length === 0) {
    return { nutrition: null, incomplete: false, flagsFood: null, plateAverage: null };
  }

  const scaledNutrition = items.map((item) =>
    item.food.nutrition ? scaleNutrition(item.food.nutrition, item.servings) : null
  );
  const nutrition: NutritionFacts = {
    servingSize: "Whole plate",
    basis: "per_serving",
    servingGrams: null,
    calories: null,
    sodiumMg: null,
    potassiumMg: null,
    totalSugarsG: null,
    addedSugarsG: null,
    saturatedFatG: null,
    fiberG: null,
    proteinG: null,
    carbsG: null,
    totalFatG: null,
    monoFatG: null,
    polyFatG: null,
    transFatG: null,
    cholesterolMg: null,
    calciumMg: null,
    ironMg: null
  };
  let incomplete = false;

  for (const field of numericNutritionFields) {
    const values = scaledNutrition.map((facts) => facts?.[field] ?? null);
    if (values.some((value) => value === null)) {
      nutrition[field] = null;
      incomplete = true;
    } else {
      nutrition[field] = roundOne((values as number[]).reduce((sum, value) => sum + value, 0));
    }
  }

  const scored = items.filter((item) => item.compassScore !== null);
  let plateAverage: PlateAverage | null = null;
  if (scored.length > 0) {
    const weighted = scored.flatMap((item) => {
      const calories = item.food.nutrition?.calories;
      return calories !== null && calories !== undefined && calories > 0
        ? [{ fcs: item.compassScore!.fcs, calories: calories * item.servings }]
        : [];
    });
    const canWeightEveryScore = weighted.length === scored.length;
    const totalCalories = weighted.reduce((sum, item) => sum + item.calories, 0);
    const method = canWeightEveryScore && totalCalories > 0 ? "calorie_weighted" : "simple_mean";
    const average =
      method === "calorie_weighted"
        ? weighted.reduce((sum, item) => sum + item.fcs * item.calories, 0) / totalCalories
        : scored.reduce((sum, item) => sum + item.compassScore!.fcs, 0) / scored.length;
    const fcs = Math.round(average);
    plateAverage = { fcs, band: bandForScore(fcs), method };
  }

  const flagsFood: IdentifiedFood = {
    id: "plate:current",
    barcode: null,
    name: "Plate",
    brand: null,
    category: "Plate",
    nutrition,
    source: "vision_estimate",
    ingredientText: null
  };

  return { nutrition, incomplete, flagsFood, plateAverage };
}

export function formatPlateContext(items: PlateItem[], summary: PlateSummary): string | null {
  if (items.length === 0) {
    return null;
  }
  const itemLines = items
    .map((item) =>
      item.compassScore
        ? `${item.food.name}: ${item.compassScore.fcs} (${item.compassScore.band})`
        : `${item.food.name}: not scored`
    )
    .join("; ");
  // A plate of one is not an average: the per-item number is the published score, and
  // handing the coach averaging language for it would under-claim a real value.
  const averageLine =
    items.length < 2
      ? "Single item: report its published Food Compass Score, never a plate average."
      : summary.plateAverage
        ? `Display-only plate average: ${summary.plateAverage.fcs} (${summary.plateAverage.band}). Call this the plate average, never a Food Compass Score for a food.`
        : "Display-only plate average: unavailable.";
  return `Plate items and per-item Food Compass scores: ${itemLines}. ${averageLine}`;
}

export function buildPlateEntries(args: {
  items: PlateItem[];
  patientId: string;
  language: Language;
  flags?: FoodFlag[];
  flagsForFood?: (food: IdentifiedFood) => FoodFlag[];
  lastAssistantText: string | null;
  now?: Date;
  mealId?: string;
}): MealLogEntry[] {
  const now = args.now ?? new Date();
  const mealId = args.mealId ?? crypto.randomUUID();
  return args.items.map((item) => {
    const food = item.food.nutrition
      ? { ...item.food, nutrition: scaleNutrition(item.food.nutrition, item.servings) }
      : item.food;
    const score: { fcs: number; band: CompassBand; tier: CompassTier } | null = item.compassScore
      ? { fcs: item.compassScore.fcs, band: item.compassScore.band, tier: item.compassScore.tier }
      : null;
    return buildMealLogEntry({
      patientId: args.patientId,
      food,
      flags: args.flagsForFood?.(food) ?? args.flags ?? [],
      lastAssistantText: args.lastAssistantText,
      language: args.language,
      now,
      servings: item.servings,
      mealId,
      compassScore: score
    });
  });
}
