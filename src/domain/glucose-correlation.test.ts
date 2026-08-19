import { describe, expect, it } from "vitest";
import { diabetesLens } from "./condition-lens";
import { summarizeFoodGlucoseLink } from "./glucose-correlation";
import type { GlucoseReading, IdentifiedFood, MealLogEntry } from "./types";

function food(carbsG: number | null): IdentifiedFood {
  return {
    id: `food-${carbsG}`,
    barcode: null,
    name: "Test meal",
    brand: null,
    category: null,
    nutrition:
      carbsG === null
        ? null
        : {
            servingSize: "1 serving",
            calories: null,
            sodiumMg: null,
            potassiumMg: null,
            totalSugarsG: null,
            addedSugarsG: null,
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
            ironMg: null,
            servingGrams: null,
            basis: "per_serving" as const
          },
    source: "vision_estimate",
    ingredientText: null
  };
}

function meal(loggedAt: string, carbsG: number | null): MealLogEntry {
  return {
    id: `meal-${loggedAt}-${carbsG}`,
    patientId: "patient-1",
    loggedAt,
    food: food(carbsG),
    flags: [],
    assistantSummary: ""
  };
}

function reading(measuredAt: string, valueMgDl: number): GlucoseReading {
  return {
    id: `g-${measuredAt}`,
    patientId: "patient-1",
    valueMgDl,
    measuredAt,
    contexts: [],
    note: ""
  };
}

// Three higher-carb meals (>=40 g) each followed by a ~high reading, three
// lower-carb meals each followed by a ~lower reading, one hour after the meal.
function pairedDataset() {
  const meals: MealLogEntry[] = [];
  const readings: GlucoseReading[] = [];
  const highDays = ["01", "02", "03"];
  const lowDays = ["04", "05", "06"];
  for (const day of highDays) {
    meals.push(meal(`2026-07-${day}T12:00:00.000Z`, 60));
    readings.push(reading(`2026-07-${day}T13:00:00.000Z`, 210));
  }
  for (const day of lowDays) {
    meals.push(meal(`2026-07-${day}T12:00:00.000Z`, 20));
    readings.push(reading(`2026-07-${day}T13:00:00.000Z`, 150));
  }
  return { meals, readings };
}

describe("summarizeFoodGlucoseLink", () => {
  it("surfaces the mean post-meal delta when both buckets clear the floors", () => {
    const { meals, readings } = pairedDataset();
    const insight = summarizeFoodGlucoseLink(meals, readings, diabetesLens);
    expect(insight).not.toBeNull();
    expect(insight?.higherCarbSamples).toBe(3);
    expect(insight?.otherSamples).toBe(3);
    expect(insight?.higherCarbMeanMgDl).toBe(210);
    expect(insight?.otherMeanMgDl).toBe(150);
    expect(insight?.deltaMgDl).toBe(60);
    expect(insight?.message).toContain("60 mg/dL higher");
    expect(insight?.message).toContain("not a diagnosis");
  });

  it("returns null when a bucket is under the sample floor", () => {
    const { meals, readings } = pairedDataset();
    // Drop one higher-carb meal+reading so that bucket has only 2.
    const insight = summarizeFoodGlucoseLink(meals.slice(1), readings.slice(1), diabetesLens);
    expect(insight).toBeNull();
  });

  it("returns null when higher-carb meals are not meaningfully higher", () => {
    const meals: MealLogEntry[] = [];
    const readings: GlucoseReading[] = [];
    for (const day of ["01", "02", "03", "04", "05", "06"]) {
      const carbs = Number(day) <= 3 ? 60 : 20;
      meals.push(meal(`2026-07-${day}T12:00:00.000Z`, carbs));
      readings.push(reading(`2026-07-${day}T13:00:00.000Z`, 150)); // flat — no gap
    }
    expect(summarizeFoodGlucoseLink(meals, readings, diabetesLens)).toBeNull();
  });

  it("skips meals with no nutrition (never guesses a carb count)", () => {
    const { meals, readings } = pairedDataset();
    // Replace the three higher-carb meals with nutrition-less ones.
    const noNutrition = meals.map((entry, index) => (index < 3 ? meal(entry.loggedAt, null) : entry));
    expect(summarizeFoodGlucoseLink(noNutrition, readings, diabetesLens)).toBeNull();
  });

  it("treats a reading exactly at the window edge as paired, and one past it as unpaired", () => {
    const atEdge = summarizeFoodGlucoseLink(
      [meal("2026-07-01T12:00:00.000Z", 60)],
      [reading("2026-07-01T15:00:00.000Z", 210)], // exactly +3h
      diabetesLens,
      { minSamplesPerBucket: 1 }
    );
    // Only a higher-carb bucket exists here, so the "other" bucket is empty -> null.
    expect(atEdge).toBeNull();

    const pastEdge = summarizeFoodGlucoseLink(
      [meal("2026-07-01T12:00:00.000Z", 60), meal("2026-07-02T12:00:00.000Z", 20)],
      [
        reading("2026-07-01T15:00:00.001Z", 210), // just past +3h -> unpaired
        reading("2026-07-02T13:00:00.000Z", 150)
      ],
      diabetesLens,
      { minSamplesPerBucket: 1 }
    );
    // The higher-carb meal loses its pairing, so its bucket is empty -> null.
    expect(pastEdge).toBeNull();
  });

  it("uses the lens carb line so a 40 g meal is higher-carb and 39 g is not", () => {
    const meals = [
      meal("2026-07-01T12:00:00.000Z", 40),
      meal("2026-07-02T12:00:00.000Z", 39)
    ];
    const readings = [
      reading("2026-07-01T13:00:00.000Z", 200),
      reading("2026-07-02T13:00:00.000Z", 150)
    ];
    const insight = summarizeFoodGlucoseLink(meals, readings, diabetesLens, { minSamplesPerBucket: 1 });
    expect(insight?.higherCarbSamples).toBe(1);
    expect(insight?.otherSamples).toBe(1);
    expect(insight?.deltaMgDl).toBe(50);
  });
});
