import { toDateKey } from "./adherence";
import type { ConditionLens, NumericNutrient } from "./condition-lens";
import type { FoodLensStringKey } from "@/i18n/strings";
import type { Condition, MealLogEntry } from "./types";

export type DayTotal = {
  nutrient: NumericNutrient;
  flagKey: FoodLensStringKey;
  unit: "mg" | "g" | "kcal";
  total: number;
  dailyLimit: number;
  percent: number;
  incomplete: boolean;
};

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Local-calendar totals over stored as-consumed snapshots. A snapshot is
 * already portion-scaled; `servings` is provenance and is never multiplied in.
 * Any missing contributor marks the corresponding total incomplete.
 */
export function summarizeDayTotals(mealLog: MealLogEntry[], lens: ConditionLens, now: Date): DayTotal[] {
  const todayKey = toDateKey(now);
  const todayEntries = mealLog.filter((entry) => {
    const loggedAt = new Date(entry.loggedAt);
    return Number.isFinite(loggedAt.valueOf()) && toDateKey(loggedAt) === todayKey;
  });

  return lens.nutrientRules
    .filter((rule) => rule.direction === "limit")
    .map((rule) => {
      let total = 0;
      let incomplete = false;
      for (const entry of todayEntries) {
        const amount = entry.food.nutrition?.[rule.nutrient];
        if (amount === null || amount === undefined) {
          incomplete = true;
        } else {
          total += amount;
        }
      }
      const roundedTotal = roundOne(total);
      return {
        nutrient: rule.nutrient,
        flagKey: rule.flagKey,
        unit: rule.unit,
        total: roundedTotal,
        dailyLimit: rule.dailyLimit,
        percent: rule.dailyLimit > 0 ? Math.round((roundedTotal / rule.dailyLimit) * 100) : 0,
        incomplete
      };
    });
}

const contextNutrientLabels: Partial<Record<NumericNutrient, string>> = {
  sodiumMg: "sodium",
  carbsG: "carbohydrates",
  addedSugarsG: "added sugars",
  saturatedFatG: "saturated fat"
};

export function formatDayTotalsContext(dayTotals: DayTotal[]): string | null {
  if (dayTotals.length === 0) {
    return null;
  }
  return `Today's logged nutrition totals: ${dayTotals
    .map((total) => {
      const label = contextNutrientLabels[total.nutrient] ?? total.nutrient;
      const completeness = total.incomplete ? "at least " : "";
      const note = total.incomplete ? "; some foods are missing this value" : "";
      return `${label} ${completeness}${total.total} of ${total.dailyLimit} ${total.unit} (${total.percent}%${note})`;
    })
    .join("; ")}.`;
}

export function selectFoodLensDayTotals(dayTotals: DayTotal[], conditions: Condition[]): DayTotal[] {
  const nutrients: DayTotal["nutrient"][] = [];
  if (conditions.includes("hypertension")) {
    nutrients.push("sodiumMg");
  }
  if (conditions.includes("diabetes")) {
    nutrients.push("carbsG", "addedSugarsG");
  }
  return nutrients.flatMap((nutrient) => dayTotals.filter((total) => total.nutrient === nutrient));
}
