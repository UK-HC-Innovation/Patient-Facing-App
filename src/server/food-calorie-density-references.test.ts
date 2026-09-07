import { describe, expect, it } from "vitest";
import { publishedCalorieDensity, type FcsFood } from "@/domain/food-compass";
import { loadFoodCompassData } from "./food-compass-data";

function quantile(sorted: number[], percentile: number): number {
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function syntheticFood(group: string): FcsFood {
  return {
    code: `missing:${group}`,
    description: "Synthetic missing-nutrition row",
    group,
    fcs2: 50,
    fcs1: 50,
    nova: 3,
    hsr: 2.5,
    nutriScore: "C",
    ambiguous: false
  };
}

describe("published calorie-density reference cohorts", () => {
  it("matches every versioned median and range to the shipped data assets", () => {
    const data = loadFoodCompassData();
    const valuesByGroup = new Map<string, number[]>();
    const allValues: number[] = [];
    const seenCodes = new Set<string>();

    for (const food of data.foods) {
      if (seenCodes.has(food.code)) continue;
      seenCodes.add(food.code);
      const kcal = data.nutrients[food.code]?.kcal;
      if (kcal === null || kcal === undefined || !Number.isFinite(kcal) || kcal <= 0) continue;
      const values = valuesByGroup.get(food.group) ?? [];
      values.push(kcal);
      valuesByGroup.set(food.group, values);
      allValues.push(kcal);
    }

    for (const [group, unsorted] of valuesByGroup) {
      const values = [...unsorted].sort((left, right) => left - right);
      const density = publishedCalorieDensity(syntheticFood(group), null);
      expect(density.kcalPer100g, group).toBe(Math.round(quantile(values, 0.5)));
      expect(density.estimate, group).toMatchObject({
        method: "food_group_median",
        rangeKcalPer100g: [Math.round(quantile(values, 0.25)), Math.round(quantile(values, 0.75))],
        sampleCount: values.length
      });
    }

    const sortedAll = allValues.sort((left, right) => left - right);
    const globalDensity = publishedCalorieDensity(syntheticFood("future_group"), null);
    expect(globalDensity.kcalPer100g).toBe(Math.round(quantile(sortedAll, 0.5)));
    expect(globalDensity.estimate).toMatchObject({
      method: "global_median",
      rangeKcalPer100g: [Math.round(quantile(sortedAll, 0.25)), Math.round(quantile(sortedAll, 0.75))],
      sampleCount: sortedAll.length
    });
  });
});
