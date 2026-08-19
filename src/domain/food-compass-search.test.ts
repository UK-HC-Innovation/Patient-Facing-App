import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildFoodSearchIndex, matchFood, SHORT_CIRCUIT_MARGIN } from "./food-compass-search";
import type { FcsFood } from "./food-compass";

// Runs against the real published Table S5 asset: what a demo audience actually types is
// the thing worth testing, and a hand-built fixture would not prove the index works.
const foods = JSON.parse(
  readFileSync(path.join(process.cwd(), "src", "data", "food-compass", "fcs2-foods.json"), "utf-8")
) as FcsFood[];
const index = buildFoodSearchIndex(foods);

describe("matchFood", () => {
  it("finds the published row for each demo query", () => {
    const cases: { query: string; expected: RegExp }[] = [
      { query: "banana", expected: /^Banana/i },
      { query: "doritos", expected: /Doritos/i },
      { query: "pizza", expected: /pizza/i },
      { query: "caesar salad", expected: /Caesar/i },
      { query: "water", expected: /water/i },
      { query: "quinoa", expected: /quinoa/i }
    ];

    for (const { query, expected } of cases) {
      const { candidates } = matchFood(index, query);
      expect(candidates.length, query).toBeGreaterThan(0);
      expect(candidates.some((c) => expected.test(c.food.description)), query).toBe(true);
    }
  });

  it("puts the plain banana ahead of banana-flavoured products", () => {
    const { candidates } = matchFood(index, "banana");
    expect(candidates[0].food.description).toBe("Banana, raw");
    expect(candidates[0].food.code).toBe("63107010");
    expect(candidates[0].food.fcs2).toBe(83);
  });

  it("returns nothing for an empty query instead of the whole table", () => {
    expect(matchFood(index, "   ").candidates).toEqual([]);
  });

  it("short-circuits only when the top hit clearly leads the runner-up", () => {
    const clear = matchFood(index, "quinoa");
    expect(clear.candidates.length).toBeGreaterThan(0);

    // "pizza" matches hundreds of near-identical rows, so no single candidate should win
    // outright -- that is exactly the case the disambiguation call exists for.
    const crowded = matchFood(index, "pizza");
    const [top, runnerUp] = crowded.candidates;
    expect(top.score / runnerUp.score).toBeLessThan(SHORT_CIRCUIT_MARGIN);
    expect(crowded.confident).toBeNull();
  });

  it("indexes each food code once even though 22 codes are listed twice", () => {
    const oyster = matchFood(index, "oyster sauce").candidates.filter((c) => c.food.code === "27150200");
    expect(oyster).toHaveLength(1);
    expect(oyster[0].food.ambiguous).toBe(true);
  });
});
