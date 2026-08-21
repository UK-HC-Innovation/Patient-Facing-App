import type { FoodFavorite, MealLogEntry } from "./types";

export type RecentFoodPick = Pick<FoodFavorite, "foodId" | "description" | "fcs" | "band">;

function bareFnddsCode(entry: MealLogEntry): string | null {
  if (entry.food.source !== "fndds_lookup") {
    return null;
  }
  const code = entry.food.id.replace(/^fndds:/, "");
  return /^\d{8}$/.test(code) ? code : null;
}

/** Last distinct T1 foods that the exact-code identify endpoint can re-score for free. */
export function recentFoodPicks(mealLog: MealLogEntry[], limit = 8): RecentFoodPick[] {
  const seen = new Set<string>();
  const picks: RecentFoodPick[] = [];
  for (let index = mealLog.length - 1; index >= 0 && picks.length < limit; index -= 1) {
    const entry = mealLog[index];
    const foodId = bareFnddsCode(entry);
    const score = entry.compassScore;
    if (!foodId || seen.has(foodId) || !score || score.tier !== "T1") {
      continue;
    }
    seen.add(foodId);
    picks.push({
      foodId,
      description: entry.food.brand ? `${entry.food.brand} ${entry.food.name}` : entry.food.name,
      fcs: score.fcs,
      band: score.band
    });
  }
  return picks;
}
