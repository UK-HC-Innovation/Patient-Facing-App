import { describe, expect, it } from "vitest";
import { brentState } from "@/domain/fixtures";
import { buildCoachSystemPrompt } from "./coach-provider";

describe("buildCoachSystemPrompt", () => {
  it("scopes exact food-log numbers without relaxing the clinical-number rule", () => {
    const now = new Date();
    const recentMeals = brentState.mealLog
      .filter((entry) => entry.compassScore !== undefined)
      .slice(0, 3)
      .map((entry, index) => ({
        ...entry,
        loggedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - index, 12).toISOString()
      }));
    const prompt = buildCoachSystemPrompt({ ...brentState, mealLog: recentMeals });

    expect(prompt).toContain("Do not state a specific blood-pressure, A1C, or blood-sugar number");
    expect(prompt).toContain("Meal log digest for the last 7 local calendar days");
    expect(prompt).toContain("The food-log numbers below are safe to state exactly");
    expect(prompt).toContain("Use the numbers above exactly; do not recompute them.");
  });
});
