import { describe, expect, it } from "vitest";
import { recentFoodPicks } from "./food-recents";
import type { MealLogEntry } from "./types";

function meal(index: number, options: { code?: string; tier?: "T1" | "T2"; source?: MealLogEntry["food"]["source"] } = {}): MealLogEntry {
  const code = options.code ?? String(index).padStart(8, "0");
  const tier = options.tier ?? "T1";
  return {
    id: `meal-${index}`,
    patientId: "patient-1",
    loggedAt: new Date(Date.UTC(2026, 7, 1, 0, 0, index)).toISOString(),
    food: {
      id: `${options.source === "fndds_lookup" || options.source === undefined ? "fndds:" : ""}${code}`,
      barcode: null,
      name: `Food ${index}`,
      brand: null,
      category: null,
      nutrition: null,
      source: options.source ?? "fndds_lookup",
      ingredientText: null
    },
    flags: [],
    assistantSummary: "",
    compassScore: { fcs: index + 10, band: "moderate", tier }
  };
}

describe("recentFoodPicks", () => {
  it("returns the last eight distinct re-scoreable FNDDS foods newest-first", () => {
    const meals = Array.from({ length: 10 }, (_, index) => meal(index));
    meals.push(meal(10, { code: "00000009" }));
    meals.push(meal(11, { source: "barcode_off" }));
    meals.push(meal(12, { tier: "T2" }));

    const picks = recentFoodPicks(meals);

    expect(picks).toHaveLength(8);
    expect(picks[0].foodId).toBe("00000009");
    expect(new Set(picks.map((pick) => pick.foodId)).size).toBe(8);
    expect(picks.every((pick) => /^\d{8}$/.test(pick.foodId))).toBe(true);
  });
});
