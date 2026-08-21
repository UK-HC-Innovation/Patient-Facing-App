import { describe, expect, it } from "vitest";
import { summarizeWeekInFood } from "./food-week";
import type { MealLogEntry } from "./types";

function meal(args: {
  id: string;
  at: Date;
  fcs?: number;
  band?: "encourage" | "moderate" | "minimize";
  mealId?: string;
}): MealLogEntry {
  return {
    id: args.id,
    patientId: "patient-1",
    loggedAt: args.at.toISOString(),
    food: {
      id: `food-${args.id}`,
      barcode: null,
      name: args.id,
      brand: null,
      category: null,
      nutrition: null,
      source: "fndds_lookup",
      ingredientText: null
    },
    flags: [],
    assistantSummary: "",
    ...(args.mealId ? { mealId: args.mealId } : {}),
    ...(args.fcs !== undefined
      ? { compassScore: { fcs: args.fcs, band: args.band ?? "moderate", tier: "T1" as const } }
      : {})
  };
}

describe("summarizeWeekInFood", () => {
  it("derives a fixed-clock seven-local-day summary", () => {
    const now = new Date(2026, 6, 10, 12, 0, 0);
    const summary = summarizeWeekInFood(
      [
        meal({ id: "best", at: new Date(2026, 6, 10, 8), fcs: 83, band: "encourage" }),
        meal({ id: "middle", at: new Date(2026, 6, 7, 12), fcs: 50 }),
        meal({ id: "worst", at: new Date(2026, 6, 4, 18), fcs: 20, band: "minimize" }),
        meal({ id: "outside", at: new Date(2026, 6, 3, 23, 59), fcs: 100, band: "encourage" })
      ],
      now
    );

    expect(summary).toMatchObject({
      meals: 3,
      scoredMeals: 3,
      avgFcs: 51,
      bandCounts: { encourage: 1, moderate: 1, minimize: 1 },
      best: { name: "best", fcs: 83 },
      worst: { name: "worst", fcs: 20 }
    });
  });

  it("counts shared-mealId plate items once while averaging real item scores", () => {
    const now = new Date(2026, 6, 10, 12);
    const summary = summarizeWeekInFood(
      [
        meal({ id: "plate-low", mealId: "plate-1", at: now, fcs: 20, band: "minimize" }),
        meal({ id: "plate-high", mealId: "plate-1", at: now, fcs: 80, band: "encourage" }),
        meal({ id: "single-1", at: new Date(2026, 6, 9, 12), fcs: 75, band: "encourage" }),
        meal({ id: "single-2", at: new Date(2026, 6, 8, 12), fcs: 25, band: "minimize" })
      ],
      now
    );

    expect(summary?.meals).toBe(3);
    expect(summary?.scoredMeals).toBe(3);
    expect(summary?.avgFcs).toBe(50);
    expect(Object.values(summary?.bandCounts ?? {}).reduce((sum, count) => sum + count, 0)).toBe(3);
  });

  it("stays hidden below three grouped scored meals", () => {
    const now = new Date(2026, 6, 10, 12);
    expect(
      summarizeWeekInFood(
        [
          meal({ id: "plate-a", mealId: "plate", at: now, fcs: 80, band: "encourage" }),
          meal({ id: "plate-b", mealId: "plate", at: now, fcs: 20, band: "minimize" }),
          meal({ id: "single", at: new Date(2026, 6, 9, 12), fcs: 50 })
        ],
        now
      )
    ).toBeNull();
  });
});
