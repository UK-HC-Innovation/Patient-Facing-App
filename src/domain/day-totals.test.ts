import { describe, expect, it } from "vitest";
import { diabetesLens, hypertensionLens } from "./condition-lens";
import { formatDayTotalsContext, summarizeDayTotals } from "./day-totals";
import type { IdentifiedFood, MealLogEntry, NutritionBasis, NutritionFacts } from "./types";

function food(sodiumMg: number | null, carbsG: number | null, basis: NutritionBasis): IdentifiedFood {
  const nutrition: NutritionFacts = {
    servingSize: "snapshot",
    servingGrams: basis === "per_100g" ? 100 : null,
    basis,
    calories: null,
    sodiumMg,
    potassiumMg: null,
    totalSugarsG: null,
    addedSugarsG: carbsG,
    saturatedFatG: null,
    fiberG: null,
    proteinG: null,
    carbsG,
    totalFatG: null,
    monoFatG: null,
    polyFatG: null,
    transFatG: null,
    cholesterolMg: null,
    calciumMg: null,
    ironMg: null
  };
  return {
    id: `${basis}-${sodiumMg}-${carbsG}`,
    barcode: null,
    name: "Test food",
    brand: null,
    category: null,
    nutrition,
    source: "vision_estimate",
    ingredientText: null
  };
}

function meal(id: string, loggedAt: Date, identifiedFood: IdentifiedFood, servings?: number): MealLogEntry {
  return {
    id,
    patientId: "patient-1",
    loggedAt: loggedAt.toISOString(),
    food: identifiedFood,
    flags: [],
    assistantSummary: "",
    servings
  };
}

describe("summarizeDayTotals", () => {
  it("sums mixed snapshot bases once and never multiplies by servings", () => {
    const now = new Date(2026, 6, 5, 12);
    const totals = summarizeDayTotals(
      [
        meal("serving", now, food(300, 20, "per_serving"), 2),
        meal("per-100g", now, food(200, 25, "per_100g"), 3)
      ],
      diabetesLens,
      now
    );

    expect(totals.find((total) => total.nutrient === "carbsG")).toMatchObject({ total: 45, incomplete: false });
    expect(totals.some((total) => total.nutrient === "fiberG")).toBe(false);
  });

  it("marks a total incomplete when any contributing snapshot is missing it", () => {
    const now = new Date(2026, 6, 5, 12);
    const totals = summarizeDayTotals(
      [meal("known", now, food(500, 20, "per_serving")), meal("missing", now, food(null, 10, "per_serving"))],
      hypertensionLens,
      now
    );

    expect(totals.find((total) => total.nutrient === "sodiumMg")).toMatchObject({
      total: 500,
      percent: 33,
      incomplete: true
    });
    expect(formatDayTotalsContext(totals)).toContain("sodium at least 500 of 1500 mg");
  });

  it("uses the local calendar day at the evening boundary", () => {
    const now = new Date(2026, 6, 5, 0, 30);
    const yesterdayEvening = new Date(2026, 6, 4, 23, 30);
    const todayMorning = new Date(2026, 6, 5, 0, 15);
    const totals = summarizeDayTotals(
      [
        meal("yesterday", yesterdayEvening, food(900, 0, "per_serving")),
        meal("today", todayMorning, food(200, 0, "per_serving"))
      ],
      hypertensionLens,
      now
    );

    expect(totals.find((total) => total.nutrient === "sodiumMg")?.total).toBe(200);
  });
});
