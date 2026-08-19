import type { FoodSource, IdentifiedFood, NutritionBasis, NutritionFacts } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function saltGramsToSodiumMg(saltG: number): number {
  return Math.round(saltG * 400);
}

function emptyNutrition(servingSize: string, basis: NutritionBasis, servingGrams: number | null): NutritionFacts {
  return {
    servingSize,
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
    ironMg: null,
    servingGrams,
    basis
  };
}

type OffNutriments = Record<string, unknown>;

function offMassMg(nutriments: OffNutriments, base: string, servingQuantity: number | null): number | null {
  const perServing = num(nutriments[`${base}_serving`]);
  if (perServing !== null) {
    return Math.round(perServing * 1000);
  }
  const per100 = num(nutriments[`${base}_100g`]);
  if (per100 !== null && servingQuantity !== null) {
    return Math.round(((per100 * servingQuantity) / 100) * 1000);
  }
  return null;
}

function offMassG(nutriments: OffNutriments, base: string, servingQuantity: number | null): number | null {
  const perServing = num(nutriments[`${base}_serving`]);
  if (perServing !== null) {
    return perServing;
  }
  const per100 = num(nutriments[`${base}_100g`]);
  if (per100 !== null && servingQuantity !== null) {
    return Math.round((per100 * servingQuantity) / 100 * 100) / 100;
  }
  return null;
}

function offSodiumMg(nutriments: OffNutriments, servingQuantity: number | null): number | null {
  const direct = offMassMg(nutriments, "sodium", servingQuantity);
  if (direct !== null) {
    return direct;
  }
  const saltServing = num(nutriments.salt_serving);
  if (saltServing !== null) {
    return saltGramsToSodiumMg(saltServing);
  }
  const salt100 = num(nutriments.salt_100g);
  if (salt100 !== null && servingQuantity !== null) {
    return saltGramsToSodiumMg((salt100 * servingQuantity) / 100);
  }
  return null;
}

export function normalizeOffProduct(barcode: string, json: unknown): IdentifiedFood | null {
  if (!isRecord(json) || json.status !== 1 || !isRecord(json.product)) {
    return null;
  }

  const product = json.product;
  const name = str(product.product_name) ?? str(product.generic_name);
  if (!name) {
    return null;
  }

  const nutriments: OffNutriments = isRecord(product.nutriments) ? product.nutriments : {};
  const servingQuantity = num(product.serving_quantity);
  const servingSize = str(product.serving_size) ?? (servingQuantity !== null ? `${servingQuantity} g` : "per 100 g");

  const nutrition: NutritionFacts = {
    servingSize,
    calories: offMassG(nutriments, "energy-kcal", servingQuantity),
    sodiumMg: offSodiumMg(nutriments, servingQuantity),
    potassiumMg: offMassMg(nutriments, "potassium", servingQuantity),
    totalSugarsG: offMassG(nutriments, "sugars", servingQuantity),
    addedSugarsG: offMassG(nutriments, "added-sugars", servingQuantity),
    saturatedFatG: offMassG(nutriments, "saturated-fat", servingQuantity),
    fiberG: offMassG(nutriments, "fiber", servingQuantity),
    proteinG: offMassG(nutriments, "proteins", servingQuantity),
    carbsG: offMassG(nutriments, "carbohydrates", servingQuantity),
    totalFatG: offMassG(nutriments, "fat", servingQuantity),
    monoFatG: offMassG(nutriments, "monounsaturated-fat", servingQuantity),
    polyFatG: offMassG(nutriments, "polyunsaturated-fat", servingQuantity),
    transFatG: offMassG(nutriments, "trans-fat", servingQuantity),
    cholesterolMg: offMassMg(nutriments, "cholesterol", servingQuantity),
    calciumMg: offMassMg(nutriments, "calcium", servingQuantity),
    ironMg: offMassMg(nutriments, "iron", servingQuantity),
    servingGrams: servingQuantity,
    basis: "per_serving"
  };

  return {
    id: barcode,
    barcode,
    name,
    brand: str(product.brands),
    category: str(product.categories),
    nutrition,
    source: "barcode_off",
    ingredientText: str(product.ingredients_text)
  };
}

type NumericNutritionKey = Exclude<keyof NutritionFacts, "servingSize" | "basis">;

const FDC_NUTRIENT_NUMBERS: Record<string, NumericNutritionKey> = {
  "208": "calories",
  "307": "sodiumMg",
  "306": "potassiumMg",
  "269": "totalSugarsG",
  "539": "addedSugarsG",
  "606": "saturatedFatG",
  "291": "fiberG",
  "203": "proteinG",
  "205": "carbsG",
  "204": "totalFatG",
  "645": "monoFatG",
  "646": "polyFatG",
  "605": "transFatG",
  "601": "cholesterolMg",
  "301": "calciumMg",
  "303": "ironMg"
};

export function normalizeFdcFood(barcode: string, json: unknown): IdentifiedFood | null {
  if (!isRecord(json) || !Array.isArray(json.foods)) {
    return null;
  }

  const match =
    json.foods.find((food) => isRecord(food) && typeof food.gtinUpc === "string" && food.gtinUpc.endsWith(barcode)) ??
    json.foods[0];

  if (!isRecord(match)) {
    return null;
  }

  const name = str(match.description);
  if (!name) {
    return null;
  }

  const nutrition = emptyNutrition("per 100 g", "per_100g", 100);
  if (Array.isArray(match.foodNutrients)) {
    for (const entry of match.foodNutrients) {
      if (!isRecord(entry)) {
        continue;
      }
      const nutrient = isRecord(entry.nutrient) ? entry.nutrient : {};
      const number = str(nutrient.number) ?? str(entry.nutrientNumber);
      const amount = num(entry.amount) ?? num(entry.value);
      if (number && amount !== null && number in FDC_NUTRIENT_NUMBERS) {
        nutrition[FDC_NUTRIENT_NUMBERS[number]] = amount;
      }
    }
  }

  return {
    id: barcode,
    barcode,
    name,
    brand: str(match.brandOwner) ?? str(match.brandName),
    category: str(match.foodCategory) ?? str(match.brandedFoodCategory),
    nutrition,
    source: "barcode_fdc",
    ingredientText: str(match.ingredients)
  };
}

export function withSource(food: IdentifiedFood, source: FoodSource): IdentifiedFood {
  return { ...food, source };
}
