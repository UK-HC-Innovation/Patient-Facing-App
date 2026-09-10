import { describe, expect, it } from "vitest";
import { kcalPer100g } from "./food-compass";
import { normalizeFdcFood, normalizeOffProduct, parseServingGrams, saltGramsToSodiumMg } from "./food-normalize";

describe("normalizeOffProduct", () => {
  it("reads per-serving sodium in grams and converts to mg", () => {
    const food = normalizeOffProduct("051000012616", {
      status: 1,
      product: {
        product_name: "Chicken Noodle Soup",
        brands: "TestBrand",
        categories: "Soups",
        serving_size: "126 g",
        serving_quantity: 126,
        nutriments: {
          "sodium_serving": 0.89,
          "energy-kcal_serving": 60,
          "sugars_serving": 1,
          "proteins_serving": 3
        }
      }
    });

    expect(food).not.toBeNull();
    expect(food?.source).toBe("barcode_off");
    expect(food?.nutrition?.sodiumMg).toBe(890);
    expect(food?.nutrition?.calories).toBe(60);
    expect(food?.nutrition?.proteinG).toBe(3);
  });

  it("falls back to salt when sodium is absent", () => {
    const food = normalizeOffProduct("111", {
      status: 1,
      product: {
        product_name: "Salty Snack",
        serving_quantity: 30,
        nutriments: { "salt_serving": 2.225 }
      }
    });

    expect(food?.nutrition?.sodiumMg).toBe(890);
  });

  it("scales from per-100g when only _100g values exist", () => {
    const food = normalizeOffProduct("222", {
      status: 1,
      product: {
        product_name: "Crackers",
        serving_quantity: 200,
        nutriments: { "sodium_100g": 0.5 }
      }
    });

    expect(food?.nutrition?.sodiumMg).toBe(1000);
  });

  it("recovers serving grams from the printed serving-size text", () => {
    const food = normalizeOffProduct("333", {
      status: 1,
      product: {
        product_name: "Protein Bar",
        serving_size: "1 bar (53 g)",
        nutriments: { "energy-kcal_serving": 220 }
      }
    });

    expect(food?.nutrition?.servingGrams).toBe(53);
    expect(kcalPer100g(food?.nutrition ?? null)).toBeCloseTo(415.1, 1);
  });

  it("uses a complete per-100g basis when no serving mass is available", () => {
    const food = normalizeOffProduct("444", {
      status: 1,
      product: {
        product_name: "Mystery Crackers",
        nutriments: {
          "energy-kcal_100g": 420,
          "proteins_100g": 10,
          "sodium_100g": 0.5
        }
      }
    });

    expect(food?.nutrition).toMatchObject({
      basis: "per_100g",
      servingGrams: 100,
      calories: 420,
      proteinG: 10,
      sodiumMg: 500
    });
  });

  it("returns null when the product is missing or unnamed", () => {
    expect(normalizeOffProduct("333", { status: 0 })).toBeNull();
    expect(normalizeOffProduct("333", { status: 1, product: { nutriments: {} } })).toBeNull();
    expect(normalizeOffProduct("333", "garbage")).toBeNull();
  });
});

describe("parseServingGrams", () => {
  it("accepts decimal grams and rejects absent or implausible masses", () => {
    expect(parseServingGrams("2 pieces (37.5 grams)")).toBe(37.5);
    expect(parseServingGrams("12 fl oz")).toBeNull();
    expect(parseServingGrams("1 piece (0 g)")).toBeNull();
  });
});

describe("normalizeFdcFood", () => {
  it("maps search-shape nutrients by number and matches the GTIN", () => {
    const food = normalizeFdcFood("030000010204", {
      foods: [
        {
          description: "Other Food",
          gtinUpc: "0000000000000",
          foodNutrients: []
        },
        {
          description: "Old Fashioned Oats",
          gtinUpc: "00030000010204",
          brandOwner: "Quaker",
          foodCategory: "Cereal",
          foodNutrients: [
            { nutrientNumber: "307", value: 0 },
            { nutrientNumber: "291", value: 4 },
            { nutrientNumber: "203", value: 5 }
          ]
        }
      ]
    });

    expect(food?.name).toBe("Old Fashioned Oats");
    expect(food?.source).toBe("barcode_fdc");
    expect(food?.nutrition?.sodiumMg).toBe(0);
    expect(food?.nutrition?.fiberG).toBe(4);
    expect(food?.nutrition?.proteinG).toBe(5);
  });

  it("returns null for garbage", () => {
    expect(normalizeFdcFood("1", { foods: [] })).toBeNull();
    expect(normalizeFdcFood("1", {})).toBeNull();
  });

  // FDC's branded endpoint is a text search, so a barcode query returns whatever contains
  // those digits. Reporting the first hit under its real brand name is worse than no answer.
  it("abstains when no returned product carries the scanned barcode", () => {
    const food = normalizeFdcFood("030000010204", {
      foods: [
        { description: "Someone Else's Cereal", gtinUpc: "0088888888888", brandOwner: "Not Yours", foodNutrients: [] },
        { description: "No GTIN At All", brandOwner: "Also Not Yours", foodNutrients: [] }
      ]
    });

    expect(food).toBeNull();
  });

  it("treats a 12-digit UPC and its zero-padded 13-digit form as the same product", () => {
    const food = normalizeFdcFood("030000010204", {
      foods: [{ description: "Old Fashioned Oats", gtinUpc: "0030000010204", brandOwner: "Quaker", foodNutrients: [] }]
    });

    expect(food?.name).toBe("Old Fashioned Oats");
  });
});

describe("saltGramsToSodiumMg", () => {
  it("converts salt grams to sodium milligrams", () => {
    expect(saltGramsToSodiumMg(1)).toBe(400);
    expect(saltGramsToSodiumMg(2.5)).toBe(1000);
  });
});
