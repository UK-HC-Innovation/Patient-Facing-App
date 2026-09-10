import type { FoodSource, IdentifiedFood, NutritionBasis, NutritionFacts } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positiveNum(value: unknown): number | null {
  const valueNumber = num(value);
  return valueNumber !== null && valueNumber > 0 ? valueNumber : null;
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

/** OpenFoodFacts often has "1 bar (53 g)" even when serving_quantity is absent. */
export function parseServingGrams(servingSize: string | null): number | null {
  if (!servingSize) return null;
  const matches = [...servingSize.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:g|gram|grams)\b/giu)];
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const grams = Number(matches[index][1].replace(",", "."));
    if (Number.isFinite(grams) && grams > 0 && grams <= 10_000) return grams;
  }
  return null;
}

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

function offPer100MassG(nutriments: OffNutriments, base: string): number | null {
  return num(nutriments[`${base}_100g`]);
}

function offPer100MassMg(nutriments: OffNutriments, base: string): number | null {
  const grams = offPer100MassG(nutriments, base);
  return grams === null ? null : Math.round(grams * 1000);
}

function offPer100SodiumMg(nutriments: OffNutriments): number | null {
  const sodium = offPer100MassMg(nutriments, "sodium");
  if (sodium !== null) return sodium;
  const salt = offPer100MassG(nutriments, "salt");
  return salt === null ? null : saltGramsToSodiumMg(salt);
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
  const declaredServingSize = str(product.serving_size);
  const servingQuantity = positiveNum(product.serving_quantity) ?? parseServingGrams(declaredServingSize);
  const usePer100g = servingQuantity === null && num(nutriments["energy-kcal_100g"]) !== null;
  const servingSize = usePer100g
    ? "per 100 g"
    : declaredServingSize ?? (servingQuantity !== null ? `${servingQuantity} g` : "serving");

  const nutrition: NutritionFacts = usePer100g
    ? {
        servingSize,
        calories: offPer100MassG(nutriments, "energy-kcal"),
        sodiumMg: offPer100SodiumMg(nutriments),
        potassiumMg: offPer100MassMg(nutriments, "potassium"),
        totalSugarsG: offPer100MassG(nutriments, "sugars"),
        addedSugarsG: offPer100MassG(nutriments, "added-sugars"),
        saturatedFatG: offPer100MassG(nutriments, "saturated-fat"),
        fiberG: offPer100MassG(nutriments, "fiber"),
        proteinG: offPer100MassG(nutriments, "proteins"),
        carbsG: offPer100MassG(nutriments, "carbohydrates"),
        totalFatG: offPer100MassG(nutriments, "fat"),
        monoFatG: offPer100MassG(nutriments, "monounsaturated-fat"),
        polyFatG: offPer100MassG(nutriments, "polyunsaturated-fat"),
        transFatG: offPer100MassG(nutriments, "trans-fat"),
        cholesterolMg: offPer100MassMg(nutriments, "cholesterol"),
        calciumMg: offPer100MassMg(nutriments, "calcium"),
        ironMg: offPer100MassMg(nutriments, "iron"),
        servingGrams: 100,
        basis: "per_100g"
      }
    : {
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

/** A 12-digit UPC-A and its 13-digit EAN form are the same product, so compare unpadded. */
function gtinMatchesBarcode(gtin: string, barcode: string): boolean {
  const strip = (value: string) => value.replace(/\D/g, "").replace(/^0+/, "");
  const left = strip(gtin);
  const right = strip(barcode);
  return left.length > 0 && left === right;
}

export function normalizeFdcFood(barcode: string, json: unknown): IdentifiedFood | null {
  if (!isRecord(json) || !Array.isArray(json.foods)) {
    return null;
  }

  // FDC's branded search is a text search, so a barcode query can return five unrelated
  // products that merely contain those digits somewhere. Taking foods[0] on a GTIN miss
  // reported a stranger's product under its real brand name, which is worse than no answer:
  // the caller falls back to the published table or the GS1 prefix instead.
  const match = json.foods.find(
    (food) => isRecord(food) && typeof food.gtinUpc === "string" && gtinMatchesBarcode(food.gtinUpc, barcode)
  );

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
