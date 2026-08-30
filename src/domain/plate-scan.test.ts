import { describe, expect, it } from "vitest";
import { scaleNutrition } from "./portion";
import type { NutritionFacts } from "./types";
import {
  CARB_RANGE_BAND,
  MAX_PLATE_FOODS,
  MAX_PLATE_SERVINGS,
  clampPlateServings,
  doublePlateServings,
  halvePlateServings,
  normalizePlateFoods,
  plateChoiceRows,
  servingsFromGrams,
  withPlateServings
} from "./plate-scan";

describe("servingsFromGrams", () => {
  // One serving of a T1 ledger match is 100 g, because toIdentifiedFood emits per-100 g
  // facts. Half-steps are the honest resolution: 137 g and 152 g are the same guess.
  it.each([
    [140, 1.5],
    [80, 1],
    [30, 0.5],
    [900, 6],
    [100, 1],
    [175, 2],
    [225, 2.5],
    [1, 0.5],
    [1_900, 6]
  ])("snaps %i g to %s servings", (grams, expected) => {
    expect(servingsFromGrams(grams)).toBe(expected);
  });

  it("returns null when the model gave no mass", () => {
    expect(servingsFromGrams(null)).toBeNull();
    expect(servingsFromGrams(0)).toBeNull();
    expect(servingsFromGrams(-40)).toBeNull();
    expect(servingsFromGrams(Number.NaN)).toBeNull();
  });
});

describe("normalizePlateFoods", () => {
  it("keeps a well-formed plate intact", () => {
    const foods = normalizePlateFoods({
      foods: [
        { name: "chicken breast, grilled", grams: 140, note: "about one breast", confidence: 0.9 },
        { name: "rice, white, cooked", grams: 160, note: "about a cup", confidence: 0.8 }
      ]
    });
    expect(foods).toEqual([
      { name: "chicken breast, grilled", grams: 140, note: "about one breast", confidence: 0.9 },
      { name: "rice, white, cooked", grams: 160, note: "about a cup", confidence: 0.8 }
    ]);
  });

  it("fails each field independently rather than discarding a readable entry", () => {
    // One implausible gram value must not take the food's name down with it.
    const foods = normalizePlateFoods({
      foods: [{ name: "broccoli", grams: 9_000, note: 42, confidence: "high" }]
    });
    expect(foods).toEqual([{ name: "broccoli", grams: null, note: null, confidence: null }]);
  });

  it("drops nameless entries and low-confidence guesses, and keeps unstated confidence", () => {
    const foods = normalizePlateFoods({
      foods: [
        { name: "", grams: 100, note: null, confidence: 0.9 },
        { name: "garnish", grams: 5, note: null, confidence: 0.1 },
        { name: "apple, raw", grams: 80, note: null }
      ]
    });
    expect(foods.map((food) => food.name)).toEqual(["apple, raw"]);
    expect(foods[0].confidence).toBeNull();
  });

  it("truncates past five foods", () => {
    const foods = normalizePlateFoods({
      foods: Array.from({ length: 8 }, (_, index) => ({ name: `food ${index}`, grams: 100, confidence: 0.9 }))
    });
    expect(foods).toHaveLength(MAX_PLATE_FOODS);
    expect(foods[4].name).toBe("food 4");
  });

  it("reads no food from junk, a missing key, or an empty list", () => {
    expect(normalizePlateFoods(null)).toEqual([]);
    expect(normalizePlateFoods({})).toEqual([]);
    expect(normalizePlateFoods({ foods: "banana" })).toEqual([]);
    expect(normalizePlateFoods({ foods: [] })).toEqual([]);
    expect(normalizePlateFoods({ foods: [7, "rice"] })).toEqual([]);
  });
});

describe("plateChoiceRows", () => {
  it("maps each item to its chosen row", () => {
    const rows = plateChoiceRows({ choices: [{ item: 0, row: 2 }, { item: 1, row: 0 }] });
    expect(rows.get(0)).toBe(2);
    expect(rows.get(1)).toBe(0);
  });

  it("keeps a -1 so the caller can demote the item instead of guessing", () => {
    expect(plateChoiceRows({ choices: [{ item: 0, row: -1 }] }).get(0)).toBe(-1);
  });

  it("ignores malformed entries and duplicate items", () => {
    const rows = plateChoiceRows({
      choices: [{ item: 0, row: 1 }, { item: 0, row: 3 }, { item: "two", row: 1 }, {}]
    });
    expect(rows.get(0)).toBe(1);
    expect(rows.size).toBe(1);
  });

  it("reads nothing from junk", () => {
    expect(plateChoiceRows(null).size).toBe(0);
    expect(plateChoiceRows({ choices: 5 }).size).toBe(0);
  });
});

describe("CARB_RANGE_BAND", () => {
  it("is the +/-30% band the displayed carb range is built from", () => {
    expect(CARB_RANGE_BAND).toBe(0.3);
  });
});

describe("plate servings", () => {
  it.each([
    [0.1, 0.5],
    [0.5, 0.5],
    [1.5, 1.5],
    [40, MAX_PLATE_SERVINGS],
    [Number.NaN, 0.5]
  ])("clamps %s to %s", (servings, expected) => {
    expect(clampPlateServings(servings)).toBe(expected);
  });

  it("halves and doubles within the same bounds", () => {
    expect(halvePlateServings(1)).toBe(0.5);
    expect(halvePlateServings(0.5)).toBe(0.5);
    expect(doublePlateServings(1.5)).toBe(3);
    expect(doublePlateServings(15)).toBe(MAX_PLATE_SERVINGS);
  });

  it("round-trips a half-step proposal exactly, because the chips never snap", () => {
    expect(doublePlateServings(halvePlateServings(1.5))).toBe(1.5);
  });

  it("flips a photo portion to the patient's own on any correction, including About right", () => {
    const scanned = { servings: 1.5, portion: { origin: "vision" as const, basis: "about two cups" } };
    expect(withPlateServings(scanned, 1.5)).toEqual({
      servings: 1.5,
      portion: { origin: "user", basis: "about two cups" }
    });
    expect(withPlateServings(scanned, 3).portion?.origin).toBe("user");
  });

  it("clamps through the flip and leaves a hand-built item without a portion alone", () => {
    const scanned = { servings: 2, portion: { origin: "vision" as const, basis: null } };
    expect(withPlateServings(scanned, 99).servings).toBe(MAX_PLATE_SERVINGS);
    expect(withPlateServings({ servings: 1 }, 0.1)).toEqual({ servings: 0.5 });
  });
});

describe("portion rounding", () => {
  const per100g: NutritionFacts = {
    servingSize: "per 100 g",
    servingGrams: 100,
    basis: "per_100g",
    calories: 120,
    sodiumMg: 163,
    potassiumMg: 171,
    totalSugarsG: 0.87,
    addedSugarsG: null,
    saturatedFatG: 0.23,
    fiberG: 2.8,
    proteinG: 4.38,
    carbsG: 21.21,
    totalFatG: 1.91,
    monoFatG: 0.526,
    polyFatG: 1.074,
    transFatG: null,
    cholesterolMg: 0,
    calciumMg: 17,
    ironMg: 1.48
  };

  // scaleNutrition rounds to integers and to 0.1 g. Rescaling a scaled value would compound
  // that; deriving from the unscaled food every time is what keeps a half-then-double exact.
  it("returns the x1 numbers after halving and doubling", () => {
    const once = scaleNutrition(per100g, 1);
    const there = halvePlateServings(1);
    const back = doublePlateServings(there);
    expect(scaleNutrition(per100g, back)).toEqual(once);
  });

  it("stays exact from an odd half-step too", () => {
    const once = scaleNutrition(per100g, 1.5);
    expect(scaleNutrition(per100g, doublePlateServings(halvePlateServings(1.5)))).toEqual(once);
  });
});
