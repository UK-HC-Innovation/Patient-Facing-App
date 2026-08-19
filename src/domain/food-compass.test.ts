import { describe, expect, it } from "vitest";
import {
  RAW_HIGH,
  RAW_LOW,
  addedSugarStep,
  aggregateLipids,
  bandForScore,
  calorieDensity,
  classifyQueryScoreability,
  classifyScoreability,
  computeFullScore,
  computeLabelScore,
  findAlternatives,
  kcalPer100g,
  lnRatioScore,
  lookupScore,
  novaScore,
  rawToFcs,
  scaleScore,
  topByMagnitude,
  type FcsFood,
  type FnddsRecord,
  type FullScoreContext
} from "./food-compass";
import type { NutritionFacts } from "./types";

function facts(overrides: Partial<NutritionFacts> = {}): NutritionFacts {
  return {
    servingSize: "1 serving",
    servingGrams: 100,
    basis: "per_serving",
    calories: 200,
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
    ironMg: null,
    ...overrides
  };
}

function record(overrides: Partial<FnddsRecord> = {}): FnddsRecord {
  const empty = {
    desc: "Test food",
    wweia: null as string | null,
    kcal: 100,
    protein: null,
    carb: null,
    sugar: null,
    fiber: null,
    fat: null,
    sfa: null,
    mufa: null,
    pufa: null,
    chol: null,
    vitA: null,
    vitB1: null,
    vitB2: null,
    vitB3: null,
    vitB6: null,
    folate: null,
    choline: null,
    vitB12: null,
    vitC: null,
    vitD: null,
    vitE: null,
    vitK: null,
    ca: null,
    p: null,
    mg: null,
    fe: null,
    zn: null,
    cu: null,
    se: null,
    k: null,
    na: null,
    alcohol: null,
    water: null,
    c8: null,
    c10: null,
    c12: null,
    epa: null,
    dha: null,
    c183: null,
    carotenoidProxy: null
  } satisfies FnddsRecord;
  return { ...empty, ...overrides };
}

function context(overrides: Partial<FullScoreContext> = {}): FullScoreContext {
  return {
    nova: 1,
    fermentedEnergyPercent: 0,
    fried: false,
    dairy: false,
    addedSugarPercentEnergy: null,
    processedMeatPercentEnergy: null,
    binaryAdditiveCount: 0,
    includeTransFat: false,
    transPercentEnergy: null,
    flavonoidsMg: null,
    ...overrides
  };
}

function food(overrides: Partial<FcsFood> = {}): FcsFood {
  return {
    code: "00000001",
    description: "Test food",
    group: "2000_Fruit",
    fcs2: 50,
    fcs1: 50,
    nova: 1,
    hsr: 3,
    nutriScore: "C",
    ambiguous: false,
    ...overrides
  };
}

describe("scaleScore", () => {
  it("clips at both ends before scaling", () => {
    expect(scaleScore(-99, 0, 10, 0, 10)).toBe(0);
    expect(scaleScore(99, 0, 10, 0, 10)).toBe(10);
    expect(scaleScore(5, 0, 10, 0, 10)).toBe(5);
  });

  it("scales a descending range for the negative attributes", () => {
    expect(scaleScore(575, 0, 575, 0, -10)).toBe(-10);
    expect(scaleScore(0, 0, 575, 0, -10)).toBe(0);
    expect(scaleScore(9999, 0, 575, 0, -10)).toBe(-10);
  });
});

describe("lnRatioScore — the natural-log tripwire", () => {
  // This is the bug that made the original prototype inconsistent at the extremes: the
  // cut-points are calibrated in natural log, the spreadsheet used log10.
  it("uses natural log, not log10, for unsaturated:saturated fat", () => {
    const score = lnRatioScore(2.32, 1, -0.66, 1.77);
    expect(score).toBeCloseTo(2.36, 2);

    // Same inputs through log10 land on the other side of zero -- a sign flip, not a rounding drift.
    const log10Version = scaleScore(Math.log10(2.32), -0.66, 1.77, -10, 10);
    expect(log10Version).toBeCloseTo(-1.56, 2);
    expect(Math.sign(score!)).not.toBe(Math.sign(log10Version));
  });

  it("clips an infinite ratio high and a zero numerator low", () => {
    expect(lnRatioScore(5, 0, -0.66, 1.77)).toBe(10);
    expect(lnRatioScore(0, 5, -7.02, -0.78)).toBe(-10);
    expect(lnRatioScore(0, 0, -0.66, 1.77)).toBeNull();
  });

  it("scores potassium:sodium in the right direction", () => {
    // Raspberries ~ K 151 mg / Na 1 mg per 100 g must beat cheddar ~ K 77 / Na 654.
    const raspberries = lnRatioScore(151, 1, -2.02, 3.3)!;
    const cheddar = lnRatioScore(77, 654, -2.02, 3.3)!;
    expect(raspberries).toBeGreaterThan(cheddar);
    expect(raspberries).toBeGreaterThan(0);
    expect(cheddar).toBeLessThan(0);
  });
});

describe("topByMagnitude", () => {
  it("selects by absolute value, so a large negative beats a small positive", () => {
    expect(topByMagnitude([1, 2, -10], 2)).toBe((-10 + 2) / 2);
  });

  it("averages everything available when fewer than n scores exist", () => {
    expect(topByMagnitude([4, 6], 5)).toBe(5);
    expect(topByMagnitude([], 5)).toBeNull();
  });
});

describe("addedSugarStep", () => {
  it("matches the published step edges", () => {
    expect(addedSugarStep(0)).toBe(0);
    expect(addedSugarStep(0.1)).toBe(-1);
    expect(addedSugarStep(2.4)).toBe(-1);
    expect(addedSugarStep(2.5)).toBe(-2);
    expect(addedSugarStep(4.9)).toBe(-2);
    expect(addedSugarStep(5)).toBe(-3);
    expect(addedSugarStep(59.9)).toBe(-9);
    expect(addedSugarStep(60)).toBe(-10);
    expect(addedSugarStep(100)).toBe(-10);
  });
});

describe("rawToFcs", () => {
  it("truncates at both published percentiles", () => {
    expect(rawToFcs(RAW_HIGH)).toBe(100);
    expect(rawToFcs(RAW_LOW)).toBe(1);
    expect(rawToFcs(999)).toBe(100);
    expect(rawToFcs(-999)).toBe(1);
  });

  it("maps the middle of the range linearly", () => {
    // midpoint of (-12.1, 35.0) is 11.45 -> 100 - (23.55/47.1)*99 = 50.5 -> 51 after rounding
    expect(rawToFcs(11.45)).toBe(51);
  });
});

describe("bandForScore", () => {
  it("uses the published band edges", () => {
    expect(bandForScore(30)).toBe("minimize");
    expect(bandForScore(31)).toBe("moderate");
    expect(bandForScore(69)).toBe("moderate");
    expect(bandForScore(70)).toBe("encourage");
  });
});

describe("classifyScoreability", () => {
  it("carves out zero-calorie foods on every basis", () => {
    const water = classifyScoreability({ name: "Water", nutrition: facts({ calories: 0, servingGrams: null }) });
    expect(water).toEqual({ scoreable: false, reason: "zero_calorie" });
  });

  it("carves out anything under 5 kcal per 100 g", () => {
    const broth = classifyScoreability({
      name: "Clear broth",
      nutrition: facts({ calories: 2, basis: "per_100g" })
    });
    expect(broth).toEqual({ scoreable: false, reason: "below_5kcal" });
  });

  it("carves out alcohol, infant and specialized foods by name", () => {
    expect(classifyScoreability({ name: "Red wine", nutrition: null })).toEqual({
      scoreable: false,
      reason: "alcohol"
    });
    expect(classifyScoreability({ name: "Similac infant formula", nutrition: null })).toEqual({
      scoreable: false,
      reason: "infant"
    });
    expect(classifyScoreability({ name: "Enteral nutrition", nutrition: null })).toEqual({
      scoreable: false,
      reason: "specialized"
    });
  });

  it("stays scoreable with an unknown serving mass rather than guessing a density", () => {
    const result = classifyScoreability({
      name: "Mystery snack",
      nutrition: facts({ calories: 120, servingGrams: null })
    });
    expect(result).toEqual({ scoreable: true, kcalPer100g: null });
  });
});

describe("kcalPer100g and calorieDensity", () => {
  it("reads a per-100g basis directly and converts a per-serving one", () => {
    expect(kcalPer100g(facts({ calories: 250, basis: "per_100g" }))).toBe(250);
    expect(kcalPer100g(facts({ calories: 60, servingGrams: 126 }))).toBeCloseTo(47.6, 1);
  });

  it("reports unknown rather than a guessed band when the serving mass is missing", () => {
    expect(calorieDensity(facts({ calories: 150, servingGrams: null }))).toEqual({
      kcalPer100g: null,
      band: "unknown"
    });
  });

  it("bands by energy density", () => {
    expect(calorieDensity(facts({ calories: 40, basis: "per_100g" })).band).toBe("very_low");
    expect(calorieDensity(facts({ calories: 100, basis: "per_100g" })).band).toBe("low");
    expect(calorieDensity(facts({ calories: 250, basis: "per_100g" })).band).toBe("medium");
    expect(calorieDensity(facts({ calories: 520, basis: "per_100g" })).band).toBe("high");
  });
});

describe("computeFullScore", () => {
  it("drops a ratio whose energy gate fails", () => {
    // 1 g fat in a 200 kcal food is 4.5% of energy: below the 10% gate, so the
    // unsaturated:saturated ratio is absent from the D1 mean rather than scored badly.
    const gated = computeFullScore(
      record({ kcal: 200, fat: 1, sfa: 1, mufa: 0, pufa: 0, carb: 40, fiber: 8 }),
      context()
    );
    const passing = computeFullScore(
      record({ kcal: 200, fat: 10, sfa: 9, mufa: 0.5, pufa: 0.5, carb: 40, fiber: 8 }),
      context()
    );
    const gatedD1 = gated.domains.find((d) => d.key === "D1")!.value;
    const passingD1 = passing.domains.find((d) => d.key === "D1")!.value;
    expect(gatedD1).toBeGreaterThan(passingD1);
  });

  it("halves the dairy unsaturated:saturated score and then plain-averages (ledger 3)", () => {
    const base = record({ kcal: 100, fat: 33, sfa: 21, mufa: 9, pufa: 1, carb: 3 });
    const nonDairy = computeFullScore(base, context({ dairy: false })).domains.find((d) => d.key === "D1")!.value;
    const dairy = computeFullScore(base, context({ dairy: true })).domains.find((d) => d.key === "D1")!.value;

    // Only the fat ratio passes its gate here (carbohydrate is 12% of energy... below it),
    // so the dairy reading is exactly half the non-dairy one.
    expect(dairy).toBeCloseTo(nonDairy / 2, 6);
  });

  it("converts FNDDS fatty acids from grams to milligrams for the EPA+DHA target", () => {
    // 62.5 mg per 100 kcal is the target. At 100 kcal per 100 g, 0.0625 g of EPA+DHA
    // hits it exactly; a tenth of that must not.
    const atTarget = computeFullScore(record({ kcal: 100, epa: 0.03, dha: 0.0325 }), context());
    const wellBelow = computeFullScore(record({ kcal: 100, epa: 0.003, dha: 0.00325 }), context());
    expect(atTarget.domains.find((d) => d.key === "D7")!.value).toBeGreaterThan(
      wellBelow.domains.find((d) => d.key === "D7")!.value
    );
    // A gram-vs-milligram slip would saturate both at +10 and make them equal.
    expect(atTarget.domains.find((d) => d.key === "D7")!.value).not.toBeCloseTo(
      wellBelow.domains.find((d) => d.key === "D7")!.value,
      3
    );
  });

  it("scores NOVA on the 2.0 scale and interpolates mixed dishes", () => {
    expect(novaScore(1)).toBe(10);
    expect(novaScore(2)).toBe(7.5);
    expect(novaScore(3)).toBe(5);
    expect(novaScore(4)).toBe(-10);
    expect(novaScore(3.5)).toBe(-2.5);
  });

  it("excludes trans fat under publication parity and includes it when asked", () => {
    const base = record({ kcal: 100, chol: 100 });
    const parity = computeFullScore(base, context({ includeTransFat: false, transPercentEnergy: 30 }));
    const withTrans = computeFullScore(base, context({ includeTransFat: true, transPercentEnergy: 30 }));
    expect(withTrans.domains.find((d) => d.key === "D7")!.value).toBeLessThan(
      parity.domains.find((d) => d.key === "D7")!.value
    );
  });
});

describe("aggregateLipids — ledger 5", () => {
  it("takes a weighted mean of the top three by absolute score, not a weighted sum", () => {
    const lipids = [
      { score: 10, weight: 1 },
      { score: -8, weight: 0.5 },
      { score: 6, weight: 0.5 },
      { score: 1, weight: 0.5 }
    ];
    // weighted mean over the top 3: (10*1 + -8*0.5 + 6*0.5) / 2 = 4.5
    expect(aggregateLipids(lipids)).toBeCloseTo(4.5, 6);
    // a weighted sum would give 9 and push the domain outside the +/-10 every other domain occupies
    expect(aggregateLipids(lipids)).not.toBeCloseTo(9, 6);
  });
});

describe("lookupScore", () => {
  it("returns the published score untouched", () => {
    const banana = food({ code: "63107010", description: "Banana, raw", fcs2: 83 });
    const score = lookupScore(banana, [banana], null);
    expect(score.fcs).toBe(83);
    expect(score.band).toBe("encourage");
    expect(score.tier).toBe("T1");
    expect(score.range).toBeNull();
  });

  it("reports both published values for a twice-listed food code", () => {
    const rows = [
      food({ code: "27150200", description: "Oyster sauce", fcs2: 80, ambiguous: true }),
      food({ code: "27150200", description: "Oyster sauce", fcs2: 26, ambiguous: true })
    ];
    const score = lookupScore(rows[0], rows, null);
    expect(score.ambiguous).toBe(true);
    expect(score.range).toEqual([26, 80]);
  });
});

describe("computeLabelScore", () => {
  const soup = facts({
    calories: 60,
    servingGrams: 126,
    sodiumMg: 890,
    potassiumMg: 100,
    totalSugarsG: 1,
    addedSugarsG: 0,
    saturatedFatG: 0.5,
    fiberG: 1,
    proteinG: 3,
    carbsG: 8
  });

  it("scores what the label supports and discloses what it could not", () => {
    const result = computeLabelScore(soup, { name: "Condensed Chicken Noodle Soup", category: "Canned soups" });
    expect(result.tier).toBe("T2");
    expect(result.fcs).toBeGreaterThanOrEqual(1);
    expect(result.fcs).toBeLessThanOrEqual(100);
    expect(result.coverage.included).toContain("D3");
    expect(result.coverage.included).toContain("D8");
    // No FPED data on a label, so the food-based ingredient domain is never available.
    expect(result.coverage.missing).toContain("D4");
    expect(result.coverage.missing).toContain("D2");
  });

  it("penalises the binary additives it can actually see in an ingredient list", () => {
    const plain = computeLabelScore(soup, { name: "Soup", ingredientText: "water, carrots, chicken" });
    const additives = computeLabelScore(soup, {
      name: "Soup",
      ingredientText: "water, high fructose corn syrup, monosodium glutamate, partially hydrogenated soybean oil"
    });
    // "partially hydrogenated soybean oil" is one additive, not two.
    expect([...additives.additives].sort()).toEqual(["high_fructose_corn_syrup", "msg", "partially_hydrogenated_oil"]);
    expect(additives.fcs).toBeLessThan(plain.fcs);
  });

  it("omits the processing domain when nothing marks the food as ultra-processed", () => {
    const plain = computeLabelScore(soup, { name: "Soup", ingredientText: "water, carrots, chicken" });
    expect(plain.coverage.missing).toContain("D6");
    const upf = computeLabelScore(soup, { name: "Soup", ingredientText: "water, maltodextrin, natural flavor" });
    expect(upf.coverage.included).toContain("D6");
    expect(upf.domains.find((d) => d.key === "D6")!.value).toBe(-5);
  });
});

describe("findAlternatives", () => {
  const catalogue: FcsFood[] = [
    food({ code: "1", description: "Tortilla chips, nacho cheese flavor", group: "9000_SavorySweet", fcs2: 19 }),
    food({ code: "2", description: "Bean chips", group: "9000_SavorySweet", fcs2: 72 }),
    food({ code: "3", description: "Sweet potato chips", group: "9000_SavorySweet", fcs2: 59 }),
    food({ code: "4", description: "Candy, hard", group: "9000_SavorySweet", fcs2: 12 }),
    food({ code: "5", description: "Chocolate cake", group: "9000_SavorySweet", fcs2: 40 }),
    food({ code: "6", description: "Ambiguous chips", group: "9000_SavorySweet", fcs2: 90, ambiguous: true }),
    food({ code: "7", description: "Banana, raw", group: "2000_Fruit", fcs2: 83 })
  ];
  // Codes 1-4 share the WWEIA chip category; 5 is in the same coarse S5 group but a
  // different category, and 7 is neither.
  const nutrients: Record<string, FnddsRecord | undefined> = {
    "1": record({ kcal: 490, wweia: "Tortilla, corn, other chips" }),
    "2": record({ kcal: 470, wweia: "Tortilla, corn, other chips" }),
    "3": record({ kcal: 520, wweia: "Tortilla, corn, other chips" }),
    "4": record({ kcal: 390, wweia: "Tortilla, corn, other chips" }),
    "5": record({ kcal: 380, wweia: "Cakes and pies" }),
    "6": record({ kcal: 400, wweia: "Tortilla, corn, other chips" }),
    "7": record({ kcal: 89, wweia: "Bananas" })
  };

  it("suggests foods from the same WWEIA category, not the far coarser S5 food group", () => {
    const alternatives = findAlternatives(catalogue[0], catalogue, nutrients);
    expect(alternatives.map((a) => a.description)).toEqual(["Bean chips", "Sweet potato chips"]);
    // Chocolate cake is in the same S5 group and scores higher, but it is not a chip.
    expect(alternatives.map((a) => a.description)).not.toContain("Chocolate cake");
  });

  it("never suggests an ambiguous, twice-listed row", () => {
    expect(findAlternatives(catalogue[0], catalogue, nutrients).map((a) => a.code)).not.toContain("6");
  });

  it("carries a recipe link for every suggestion", () => {
    const alternatives = findAlternatives(catalogue[0], catalogue, nutrients);
    expect(alternatives.every((a) => a.recipeSearchUrl.startsWith("https://www.google.com/search?q="))).toBe(true);
  });

  it("returns nothing for a food already pinned at the top of the scale", () => {
    const best = food({ code: "9", description: "Raspberries, raw", group: "2000_Fruit", fcs2: 100 });
    expect(findAlternatives(best, [...catalogue, best], nutrients)).toEqual([]);
  });

  it("returns nothing when the category holds nothing meaningfully better", () => {
    expect(findAlternatives(catalogue[6], catalogue, nutrients)).toEqual([]);
  });

  it("reorders the qualifying set when the lower-calorie-density toggle is on", () => {
    const byScore = findAlternatives(catalogue[0], catalogue, nutrients, { preferHigherScore: true });
    const byDensity = findAlternatives(catalogue[0], catalogue, nutrients, { preferLowerCalorieDensity: true });
    expect(byScore[0].description).toBe("Bean chips");
    expect(byDensity[0].description).toBe("Bean chips"); // 470 kcal/100 g beats 520
    expect(byDensity.map((a) => a.calorieDensity.kcalPer100g)).toEqual([470, 520]);
  });

  it("falls back to shared words within the food group when a food predates FNDDS 2017-18", () => {
    // About a third of Table S5 has no WWEIA category. Without the shared-word rule this
    // would answer "taco burger" with whatever scores highest in 8000_Mixed.
    const legacy: FcsFood[] = [
      food({ code: "10", description: "Taco burger, on bun", group: "8000_Mixed", fcs2: 18 }),
      food({ code: "11", description: "Turkey or chicken burger, on wheat bun", group: "8000_Mixed", fcs2: 62 }),
      food({ code: "12", description: "Ceviche", group: "8000_Mixed", fcs2: 100 })
    ];
    const alternatives = findAlternatives(legacy[0], legacy, {});
    expect(alternatives.map((a) => a.description)).toEqual(["Turkey or chicken burger, on wheat bun"]);
  });
});

describe("classifyQueryScoreability", () => {
  it("carves out plain water before any lookup, in the shapes people actually type", () => {
    for (const query of ["water", "Water", "a glass of water", "tap water", "sparkling water", "seltzer", "club soda"]) {
      expect(classifyQueryScoreability(query), query).toEqual({ scoreable: false, reason: "zero_calorie" });
    }
  });

  it("does not carve out flavoured or brand waters, which are real scoreable products", () => {
    expect(classifyQueryScoreability("vitamin water")).toBeNull();
    expect(classifyQueryScoreability("watermelon")).toBeNull();
    expect(classifyQueryScoreability("water chestnut")).toBeNull();
  });

  it("defers to the food's own facts when the query says nothing decisive", () => {
    expect(classifyQueryScoreability("pizza")).toBeNull();
    expect(classifyQueryScoreability("")).toBeNull();
  });

  it("carves out alcohol from a typed query too", () => {
    expect(classifyQueryScoreability("a glass of red wine")).toEqual({ scoreable: false, reason: "alcohol" });
  });
});
