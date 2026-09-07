import {
  classifyQueryScoreability,
  kcalPer100g,
  lookupScore,
  type CompassScore,
  type FcsFood
} from "@/domain/food-compass";
import { describesQuery, matchFood } from "@/domain/food-compass-search";
import { demoFoodSeed } from "@/domain/food-seed";
import { resolveBarcode } from "@/domain/food-lookup";
import { brandForBarcode, cleanProductName } from "@/domain/food-order-intent";
import { barcodeLookupRequestSchema } from "@/domain/schemas";
import type { IdentifiedFood } from "@/domain/types";
import { loadFoodCompassData } from "@/server/food-compass-data";
import { readBoundedJson } from "@/server/read-bounded-json";

export const dynamic = "force-dynamic";

const cache = new Map<string, IdentifiedFood>();

type ProductRejection =
  | "sodium_out_of_range"
  | "sugars_exceed_carbs"
  | "calories_out_of_range"
  | "no_serving_size";

type PublishedTableMatch = {
  code: string;
  description: string;
  group: string;
  score: CompassScore;
};

// A scanned label is data entry by a stranger. Coca-Cola's row reads 45,000 mg of sodium
// and more added sugar than carbohydrate; both are impossible, and a score built on them
// teaches the person that the numbers are noise. Anything past these bounds is not a
// serving of food, so the row is dropped and the published table answers instead.
const MAX_SODIUM_MG = 5_000;
const MAX_CALORIES = 2_000;

function rejectProductRow(food: IdentifiedFood): ProductRejection | null {
  const nutrition = food.nutrition;
  if (!nutrition) {
    return "no_serving_size";
  }
  if (nutrition.servingSize.trim().length === 0) {
    return "no_serving_size";
  }
  if (nutrition.basis === "per_serving" && nutrition.servingGrams === null) {
    // Without the serving mass nothing on the label can be put on a per-100 g footing,
    // so every number that follows is unanchored.
    return "no_serving_size";
  }
  if (nutrition.sodiumMg !== null && nutrition.sodiumMg > MAX_SODIUM_MG) {
    return "sodium_out_of_range";
  }
  if (nutrition.addedSugarsG !== null && nutrition.carbsG !== null && nutrition.addedSugarsG > nutrition.carbsG) {
    return "sugars_exceed_carbs";
  }
  if (nutrition.calories !== null && nutrition.calories > MAX_CALORIES) {
    return "calories_out_of_range";
  }
  return null;
}

/** How far the product's own energy density may sit from the row's before they are not the same food. */
const KCAL_TOLERANCE = 0.15;

function publishedMatch(row: FcsFood, nutrients: ReturnType<typeof loadFoodCompassData>["nutrients"], siblings: FcsFood[]): PublishedTableMatch {
  return {
    code: row.code,
    description: row.description,
    group: row.group,
    score: lookupScore(row, siblings, nutrients[row.code] ?? null)
  };
}

/**
 * The published row for a product name.
 *
 * `product` is the scanned label. When it is given the row has to agree with it on
 * energy density before its published score is allowed to replace the label estimate:
 * the name alone is not enough evidence to publish someone else's number. When it is
 * null the label has already been rejected, so the best-ranked row is the answer.
 */
function resolvePublishedRow(name: string, product: IdentifiedFood | null): PublishedTableMatch | null {
  const query = name.trim();
  if (query.length === 0) {
    return null;
  }
  const carveOut = classifyQueryScoreability(query);
  if (carveOut && !carveOut.scoreable) {
    return null;
  }

  const data = loadFoodCompassData();
  const { candidates, confident } = matchFood(data.index, query, 5);
  if (candidates.length === 0) {
    return null;
  }
  const top = candidates[0].food;
  // Replacing a working label needs the row to carry the whole product name. Replacing a
  // rejected one only needs the best-ranked row, which is what a typed name gets too.
  const row = confident ?? (product === null || describesQuery(top.description, query) ? top : null);
  if (!row) {
    return null;
  }

  if (product) {
    const productKcal = kcalPer100g(product.nutrition);
    // FNDDS is reported per 100 g, so the record's own energy is already the density.
    const rowKcal = data.nutrients[row.code]?.kcal ?? null;
    if (productKcal === null || rowKcal === null || rowKcal <= 0) {
      return null;
    }
    if (Math.abs(productKcal - rowKcal) / rowKcal > KCAL_TOLERANCE) {
      return null;
    }
  }

  return publishedMatch(row, data.nutrients, data.byCode.get(row.code) ?? [row]);
}

export async function POST(request: Request): Promise<Response> {
  const body = await readBoundedJson(request, 256);
  if (!body.ok) {
    return Response.json({ error: "invalid_barcode" }, { status: 400 });
  }

  const parsed = barcodeLookupRequestSchema.safeParse(body.value);

  if (!parsed.success) {
    return Response.json({ error: "invalid_barcode" }, { status: 400 });
  }

  const barcode = parsed.data.barcode;
  const result = await resolveBarcode(barcode, {
    cache,
    seed: demoFoodSeed,
    fdcApiKey: process.env.USDA_FDC_API_KEY ?? null,
    signal: request.signal
  });

  const headers = { "Cache-Control": "no-store" };

  if (!result.found) {
    // Nothing to score, but a GS1 prefix still names the maker, which is a better start
    // for the ask box than an empty line.
    const brand = brandForBarcode(barcode);
    return Response.json({ found: false, ...(brand ? { brand, prefill: brand } : {}) }, { headers });
  }

  const name = cleanProductName(result.food.name, result.food.brand);
  const food = { ...result.food, name };
  const rejected = rejectProductRow(food);

  if (rejected) {
    const fallback = resolvePublishedRow(name, null);
    if (!fallback) {
      return Response.json({ found: false, rejected, prefill: name }, { headers });
    }
    // The label is gone; only the published row is reported, so there is one number and
    // it is not the broken one.
    return Response.json({ found: true, food: { ...food, nutrition: null }, published: fallback, rejected }, { headers });
  }

  const published = resolvePublishedRow(name, food);
  return Response.json({ found: true, food, ...(published ? { published } : {}) }, { headers });
}
