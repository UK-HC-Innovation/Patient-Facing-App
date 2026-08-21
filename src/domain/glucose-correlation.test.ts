import { describe, expect, it } from "vitest";
import { diabetesLens } from "./condition-lens";
import { defaultDemoState } from "./fixtures";
import {
  foodHistoryVoiceLine,
  lastTimeYouAte,
  postMealCheckDue,
  summarizeFoodGlucoseLink,
  summarizeScoreGlucoseLink
} from "./glucose-correlation";
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

function withScore(
  entry: MealLogEntry,
  band: "encourage" | "moderate" | "minimize",
  overrides: Partial<MealLogEntry> = {}
): MealLogEntry {
  return {
    ...entry,
    compassScore: { fcs: band === "minimize" ? 20 : 75, band, tier: "T1" },
    ...overrides
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

  it("groups plate siblings, sums their carbs, and pairs the plate only once", () => {
    const highPlate = [
      { ...meal("2026-07-01T12:00:00.000Z", 20), id: "high-a", mealId: "plate-high" },
      { ...meal("2026-07-01T12:00:00.000Z", 20), id: "high-b", mealId: "plate-high" },
      { ...meal("2026-07-01T12:00:00.000Z", 20), id: "high-c", mealId: "plate-high" }
    ];
    const other = meal("2026-07-02T12:00:00.000Z", 20);
    const insight = summarizeFoodGlucoseLink(
      [...highPlate, other],
      [reading("2026-07-01T13:00:00.000Z", 210), reading("2026-07-02T13:00:00.000Z", 150)],
      diabetesLens,
      { minSamplesPerBucket: 1 }
    );

    expect(insight?.higherCarbSamples).toBe(1);
    expect(insight?.otherSamples).toBe(1);
  });
});

describe("summarizeScoreGlucoseLink", () => {
  it("buckets scored meals by band and applies the delta floor", () => {
    const meals: MealLogEntry[] = [];
    const readings: GlucoseReading[] = [];
    for (const day of ["01", "02", "03"]) {
      meals.push(withScore(meal(`2026-07-${day}T12:00:00.000Z`, 20), "minimize"));
      readings.push(reading(`2026-07-${day}T13:00:00.000Z`, 210));
    }
    for (const day of ["04", "05", "06"]) {
      meals.push(withScore(meal(`2026-07-${day}T12:00:00.000Z`, 20), "encourage"));
      readings.push(reading(`2026-07-${day}T13:00:00.000Z`, 150));
    }

    const insight = summarizeScoreGlucoseLink(meals, readings);
    expect(insight).toMatchObject({
      minimizeMeanMgDl: 210,
      otherMeanMgDl: 150,
      deltaMgDl: 60,
      minimizeSamples: 3,
      otherSamples: 3
    });
    expect(insight?.message).toContain("minimize-band item");
    expect(insight?.message).toContain("not a diagnosis");
    expect(summarizeScoreGlucoseLink(meals, readings, { deltaFloorMgDl: 61 })).toBeNull();
  });

  it("uses minimize-if-any and pairs a three-item plate once", () => {
    const plateTime = "2026-07-01T12:00:00.000Z";
    const plate = [
      withScore(meal(plateTime, 10), "encourage", { id: "plate-a", mealId: "plate-1" }),
      withScore(meal(plateTime, 10), "minimize", { id: "plate-b", mealId: "plate-1" }),
      withScore(meal(plateTime, 10), "moderate", { id: "plate-c", mealId: "plate-1" })
    ];
    const other = withScore(meal("2026-07-02T12:00:00.000Z", 20), "encourage");
    const insight = summarizeScoreGlucoseLink(
      [...plate, other],
      [reading("2026-07-01T13:00:00.000Z", 210), reading("2026-07-02T13:00:00.000Z", 150)],
      { minSamplesPerBucket: 1 }
    );

    expect(insight?.minimizeSamples).toBe(1);
    expect(insight?.otherSamples).toBe(1);
  });

  it("skips groups without any score", () => {
    const minimize = withScore(meal("2026-07-01T12:00:00.000Z", 20), "minimize");
    const unscored = meal("2026-07-02T12:00:00.000Z", 20);
    expect(
      summarizeScoreGlucoseLink(
        [minimize, unscored],
        [reading("2026-07-01T13:00:00.000Z", 210), reading("2026-07-02T13:00:00.000Z", 150)],
        { minSamplesPerBucket: 1 }
      )
    ).toBeNull();
  });
});

describe("lastTimeYouAte", () => {
  it("returns the newest prior full-id match and its nearest post-meal reading", () => {
    const older = { ...meal("2026-07-01T12:00:00.000Z", 20), id: "older", food: { ...food(20), id: "fndds:123" } };
    const latest = { ...meal("2026-07-03T12:00:00.000Z", 20), id: "latest", food: { ...food(20), id: "fndds:123" } };
    const sameNameWrongId = {
      ...meal("2026-07-04T12:00:00.000Z", 20),
      id: "wrong-id",
      food: { ...food(20), id: "fndds:999" }
    };
    const history = lastTimeYouAte(
      "fndds:123",
      [older, latest, sameNameWrongId],
      [
        reading("2026-07-03T14:00:00.000Z", 178),
        reading("2026-07-03T13:00:00.000Z", 170)
      ]
    );

    expect(history).toEqual({ loggedAt: latest.loggedAt, postMealReading: 170 });
    expect(foodHistoryVoiceLine(history!, "Jul 3")).not.toContain("170");
  });

  it("does not treat a current unlogged scan as history", () => {
    expect(lastTimeYouAte("fndds:today", [], [])).toBeNull();
  });
});

describe("default demo correlation", () => {
  it("ships with enough paired scored meals for both flagship insights", () => {
    expect(
      summarizeFoodGlucoseLink(defaultDemoState.mealLog, defaultDemoState.glucoseReadings, diabetesLens)
    ).not.toBeNull();
    expect(summarizeScoreGlucoseLink(defaultDemoState.mealLog, defaultDemoState.glucoseReadings)).not.toBeNull();
  });
});

describe("postMealCheckDue", () => {
  const now = new Date("2026-07-05T15:00:00.000Z");

  it("returns the newest meal in the one-to-three-hour window without a following reading", () => {
    const older = meal("2026-07-05T12:30:00.000Z", 20);
    const newer = meal("2026-07-05T13:00:00.000Z", 20);
    expect(postMealCheckDue([older, newer], [], now)?.id).toBe(newer.id);
  });

  it("does not nudge after a reading already followed the meal", () => {
    const due = meal("2026-07-05T13:00:00.000Z", 20);
    expect(postMealCheckDue([due], [reading("2026-07-05T14:00:00.000Z", 150)], now)).toBeNull();
  });

  it("uses later array order to break identical plate-sibling times", () => {
    const first = { ...meal("2026-07-05T13:00:00.000Z", 20), id: "plate-first", mealId: "plate-1" };
    const second = { ...meal("2026-07-05T13:00:00.000Z", 20), id: "plate-second", mealId: "plate-1" };
    expect(postMealCheckDue([first, second], [], now)?.id).toBe("plate-second");
  });

  it("includes the exact one- and three-hour boundaries", () => {
    const oneHour = meal("2026-07-05T14:00:00.000Z", 20);
    const threeHours = meal("2026-07-05T12:00:00.000Z", 20);
    expect(postMealCheckDue([threeHours, oneHour], [], now)?.id).toBe(oneHour.id);
    expect(postMealCheckDue([threeHours], [], now)?.id).toBe(threeHours.id);
  });
});
