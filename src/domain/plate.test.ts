import { describe, expect, it } from "vitest";
import { buildPlateEntries, formatPlateContext, summarizePlate, type PlateItem } from "./plate";
import type { IdentifiedFood, NutritionFacts } from "./types";

function food(id: string, calories: number | null, carbsG: number | null, sodiumMg = 100): IdentifiedFood {
  const nutrition: NutritionFacts = {
    servingSize: "1 serving",
    servingGrams: 100,
    basis: "per_serving",
    calories,
    sodiumMg,
    potassiumMg: 20,
    totalSugarsG: 1,
    addedSugarsG: 0,
    saturatedFatG: 1,
    fiberG: 1,
    proteinG: 2,
    carbsG,
    totalFatG: 2,
    monoFatG: 1,
    polyFatG: 1,
    transFatG: 0,
    cholesterolMg: 0,
    calciumMg: 10,
    ironMg: 1
  };
  return {
    id,
    barcode: null,
    name: id,
    brand: null,
    category: null,
    nutrition,
    source: "vision_estimate",
    ingredientText: null
  };
}

function item(
  id: string,
  fcs: number,
  calories: number | null,
  servings = 1,
  carbsG: number | null = 10
): PlateItem {
  return {
    food: food(id, calories, carbsG),
    servings,
    compassScore: { fcs, band: fcs >= 70 ? "encourage" : fcs <= 30 ? "minimize" : "moderate", tier: "T1" }
  };
}

describe("summarizePlate", () => {
  it("scales portions before summing and computes a calorie-weighted plate average", () => {
    const summary = summarizePlate([item("soup", 20, 100, 2), item("oats", 80, 200)]);

    expect(summary.nutrition).toMatchObject({ calories: 400, carbsG: 30, sodiumMg: 300 });
    expect(summary.plateAverage).toEqual({ fcs: 50, band: "moderate", method: "calorie_weighted" });
  });

  it("propagates null fields and falls back to a simple mean when a scored item's calories are missing", () => {
    const summary = summarizePlate([item("unknown", 20, null, 1, null), item("oats", 80, 200)]);

    expect(summary.incomplete).toBe(true);
    expect(summary.nutrition?.calories).toBeNull();
    expect(summary.nutrition?.carbsG).toBeNull();
    expect(summary.plateAverage).toEqual({ fcs: 50, band: "moderate", method: "simple_mean" });
  });
});

describe("buildPlateEntries", () => {
  it("writes scaled snapshots once with unique ids, per-item scores, and one shared meal id", () => {
    const entries = buildPlateEntries({
      items: [item("soup", 20, 100, 2, 10), item("oats", 80, 200, 1, 25)],
      patientId: "patient-1",
      language: "en",
      lastAssistantText: null,
      now: new Date("2026-07-05T12:00:00.000Z"),
      mealId: "plate-meal"
    });

    expect(entries).toHaveLength(2);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(2);
    expect(entries.map((entry) => entry.mealId)).toEqual(["plate-meal", "plate-meal"]);
    expect(entries[0].food.nutrition?.carbsG).toBe(20);
    expect(entries[0].servings).toBe(2);
    expect(entries.map((entry) => entry.compassScore?.fcs)).toEqual([20, 80]);
  });
});

describe("formatPlateContext photo-portion line", () => {
  const scannedItem: PlateItem = {
    id: "scan-1",
    food: {
      id: "fndds:56204005",
      barcode: null,
      name: "Quinoa, no added fat",
      brand: null,
      category: "1000_Grains",
      nutrition: null,
      source: "fndds_lookup",
      ingredientText: null
    },
    servings: 1.5,
    compassScore: { fcs: 89, band: "encourage", tier: "T1" },
    portion: { origin: "vision", basis: "about two thirds of a cup" }
  };

  it("tells the coach the portions were estimated, alongside the exact-numbers rule", () => {
    const line = formatPlateContext([scannedItem], summarizePlate([scannedItem]));
    expect(line).toContain("Portions were estimated from a photo");
    expect(line).toContain("rough estimates");
  });

  it("says nothing about photos once every portion is the patient's own", () => {
    const owned: PlateItem = { ...scannedItem, portion: { origin: "user", basis: "about two thirds of a cup" } };
    expect(formatPlateContext([owned], summarizePlate([owned]))).not.toContain("estimated from a photo");
  });
});
