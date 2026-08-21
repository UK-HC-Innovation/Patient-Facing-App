import { describe, expect, it } from "vitest";
import { parsePortionServings, resolvePortionServings, scaleNutrition } from "./portion";
import type { NutritionFacts } from "./types";

const nutrition: NutritionFacts = {
  servingSize: "1 slice",
  calories: 120,
  sodiumMg: 230,
  potassiumMg: null,
  totalSugarsG: 4,
  addedSugarsG: 2,
  saturatedFatG: 1.25,
  fiberG: 1.5,
  proteinG: 5,
  carbsG: 22,
  totalFatG: null,
  monoFatG: null,
  polyFatG: null,
  transFatG: null,
  cholesterolMg: null,
  calciumMg: null,
  ironMg: null,
  servingGrams: null,
  basis: "per_serving"
};

describe("parsePortionServings", () => {
  it("parses English portions with digits, words, articles, and half servings", () => {
    expect(parsePortionServings("two slices", "en")).toBe(2);
    expect(parsePortionServings("a cup of rice", "en")).toBe(1);
    expect(parsePortionServings("3 servings", "en")).toBe(3);
    expect(parsePortionServings("half cup", "en")).toBe(0.5);
  });

  it("parses Spanish portions with words, explicit servings, and half servings", () => {
    expect(parsePortionServings("dos rebanadas", "es")).toBe(2);
    expect(parsePortionServings("3 porciones", "es")).toBe(3);
    expect(parsePortionServings("media taza", "es")).toBe(0.5);
  });

  it("returns null with no portion cue", () => {
    expect(parsePortionServings("just pizza", "en")).toBeNull();
  });

  it("caps large serving counts at 20", () => {
    expect(parsePortionServings("500 slices", "en")).toBe(20);
  });
});

describe("resolvePortionServings", () => {
  it("gives an explicit numeric portion precedence over a size word", () => {
    expect(resolvePortionServings("large pizza, two slices", "en")).toEqual({ servings: 2, spokenSize: null });
  });

  it("maps a conversational size when no numeric portion is present", () => {
    expect(resolvePortionServings("large pepperoni pizza", "en")).toEqual({
      servings: 1.5,
      spokenSize: "large"
    });
  });

  it("leaves an utterance without a portion cue unresolved", () => {
    expect(resolvePortionServings("banana", "en")).toBeNull();
  });

  it("parses Spanish size phrasing", () => {
    expect(resolvePortionServings("una pizza extra grande", "es")).toEqual({
      servings: 2,
      spokenSize: "extra large"
    });
  });
});

describe("scaleNutrition", () => {
  it("scales numeric nutrients and leaves nulls null", () => {
    expect(scaleNutrition(nutrition, 2)).toEqual({
      servingSize: "2 x 1 slice",
      calories: 240,
      sodiumMg: 460,
      potassiumMg: null,
      totalSugarsG: 8,
      addedSugarsG: 4,
      saturatedFatG: 2.5,
      fiberG: 3,
      proteinG: 10,
      carbsG: 44,
      totalFatG: null,
      monoFatG: null,
      polyFatG: null,
      transFatG: null,
      cholesterolMg: null,
      calciumMg: null,
      ironMg: null,
      servingGrams: null,
      basis: "per_serving"
    });
  });

  it("keeps the original serving size when servings are one", () => {
    expect(scaleNutrition(nutrition, 1).servingSize).toBe("1 slice");
  });
});
