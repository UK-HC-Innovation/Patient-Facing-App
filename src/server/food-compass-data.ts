// Server-only loader for the Food Compass lookup assets.
//
// The two JSON files are ~5 MB together and must never reach a client bundle, which is
// why nothing in src/components or src/app/**/page.tsx imports this module and why
// scripts/check-ladder-bundle.mjs enforces per-route budgets for /food/demo and /food.
//
// Read from disk and JSON.parse rather than `import ... from "*.json"`: webpack would
// otherwise inline 5 MB as a JavaScript object literal, which is far slower to parse at
// cold start than JSON.parse of the same bytes.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { FcsFood, FnddsRecord } from "@/domain/food-compass";
import { buildFoodSearchIndex, type FoodSearchIndex } from "@/domain/food-compass-search";

export type FoodCompassData = {
  foods: FcsFood[];
  byCode: Map<string, FcsFood[]>;
  nutrients: Record<string, FnddsRecord | undefined>;
  index: FoodSearchIndex;
};

let cached: FoodCompassData | null = null;

function assetPath(file: string): string {
  return path.join(process.cwd(), "src", "data", "food-compass", file);
}

export function loadFoodCompassData(): FoodCompassData {
  if (cached) {
    return cached;
  }

  const foods = JSON.parse(readFileSync(assetPath("fcs2-foods.json"), "utf-8")) as FcsFood[];
  const nutrients = JSON.parse(readFileSync(assetPath("fndds-nutrients.json"), "utf-8")) as Record<
    string,
    FnddsRecord
  >;

  // 22 food codes appear twice in Table S5 with different scores from different survey
  // cycles, so the map holds every row for a code rather than the last one to win.
  const byCode = new Map<string, FcsFood[]>();
  for (const food of foods) {
    const existing = byCode.get(food.code);
    if (existing) {
      existing.push(food);
    } else {
      byCode.set(food.code, [food]);
    }
  }

  cached = { foods, byCode, nutrients, index: buildFoodSearchIndex(foods) };
  return cached;
}

export function findFoodByCode(data: FoodCompassData, code: string): FcsFood | null {
  return data.byCode.get(code)?.[0] ?? null;
}
