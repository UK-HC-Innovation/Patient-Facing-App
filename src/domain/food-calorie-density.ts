import type { NutritionFacts } from "./types";

export type CalorieDensityBand = "very_low" | "low" | "medium" | "high" | "unknown";

export type CalorieDensityEstimateMethod =
  | "equivalent_food"
  | "food_group_median"
  | "category_median"
  | "global_median";

export type CalorieDensityEstimate = {
  method: CalorieDensityEstimateMethod;
  /** Middle 50% of observed foods in the reference group, when a cohort is used. */
  rangeKcalPer100g: [number, number] | null;
  sampleCount: number | null;
  referenceCode: string | null;
  referenceDescription: string | null;
};

export type CalorieDensity = {
  kcalPer100g: number | null;
  band: CalorieDensityBand;
  /** Present only when kcalPer100g is inferred rather than observed for this exact food. */
  estimate?: CalorieDensityEstimate;
};

/** Exact kcal per 100 g; remains unknown when serving mass is absent. */
export function kcalPer100g(nutrition: NutritionFacts | null): number | null {
  if (!nutrition || nutrition.calories === null) return null;
  if (nutrition.basis === "per_100g") return nutrition.calories;
  if (nutrition.servingGrams !== null && nutrition.servingGrams > 0) {
    return (nutrition.calories / nutrition.servingGrams) * 100;
  }
  return null;
}

export function densityFromKcalPer100g(
  value: number,
  estimate?: CalorieDensityEstimate
): CalorieDensity {
  if (!Number.isFinite(value) || value < 0) return { kcalPer100g: null, band: "unknown" };
  const rounded = Math.round(value);
  const band: CalorieDensityBand =
    value < 60 ? "very_low" : value < 150 ? "low" : value <= 400 ? "medium" : "high";
  return { kcalPer100g: rounded, band, ...(estimate ? { estimate } : {}) };
}

export function calorieDensity(nutrition: NutritionFacts | null): CalorieDensity {
  const density = kcalPer100g(nutrition);
  return density === null
    ? { kcalPer100g: null, band: "unknown" }
    : densityFromKcalPer100g(density);
}
