/**
 * Spec 31 C1: the swap finder against the real Table S5 assets.
 *
 * The named cases are appendix A of the spec. The table-wide block is C20: every swap the
 * route can return passes the pool, threshold and exclusion rules, and no row prints a rank
 * claim the table contradicts.
 */
import { describe, expect, it } from "vitest";
import { loadFoodCompassData } from "@/server/food-compass-data";
import type { FcsFood } from "./food-compass";
import {
  SWAP_DISPLAY_NAMES,
  SWAP_FAMILIES,
  SWAP_THRESHOLD,
  belowFiveKcal,
  findSwaps,
  swapIndexFor
} from "./food-swaps";

const data = loadFoodCompassData();
const index = swapIndexFor(data.foods, data.nutrients);

function row(description: string): FcsFood {
  const food = data.foods.find((candidate) => candidate.description === description && !candidate.ambiguous);
  if (!food) throw new Error(`no row ${description}`);
  return food;
}

const swapsFor = (description: string) => findSwaps(row(description), index);
const describedAs = (description: string) => swapsFor(description).alternatives.map((alternative) => alternative.description);

describe("findSwaps: named cases", () => {
  it("offers plain Cheerios for Honey Nut Cheerios, from the same product line", () => {
    const result = swapsFor("Cereal (General Mills Cheerios Honey Nut)");
    expect(result.state).toBe("swap");
    expect(result.alternatives[0]).toMatchObject({
      description: "Cereal (General Mills Cheerios)",
      fcs: 77,
      pool: "line",
      displayName: { en: "Cheerios", es: "Cheerios" }
    });
  });

  it("affirms Cheerios, soup beans and a banana without claiming a rank", () => {
    expect(swapsFor("Cereal (General Mills Cheerios)").state).toBe("affirm");
    expect(swapsFor("Pinto beans, from dried, fat added").state).toBe("affirm");
    expect(swapsFor("Banana, raw").state).toBe("affirm");
  });

  it("gives sweet tea water or unsweetened tea, with no score and no sugary drink as a target", () => {
    const result = swapsFor("Tea, iced, brewed, black, pre-sweetened with sugar");
    expect(result.state).toBe("no_score_swap");
    expect(result.noScoreSwap).toBe("water_or_unsweetened_tea");
    expect(describedAs("Tea, iced, brewed, black, pre-sweetened with sugar")).not.toContain("Tea, hibiscus");
  });

  it("gives a cola the no-score swap instead of a fruit drink or an energy drink", () => {
    const result = swapsFor("Soft drink, cola");
    expect(result.state).toBe("no_score_swap");
    expect(result.alternatives.map((alternative) => alternative.description).join(" ")).not.toMatch(/fruit juice drink|energy drink/i);
  });

  it("gives a sweetened coffee black coffee", () => {
    const result = swapsFor("Coffee, pre-sweetened with sugar");
    expect(result).toMatchObject({ state: "no_score_swap", noScoreSwap: "black_coffee" });
  });

  it("offers baking for fried catfish, with the baked row's own score", () => {
    const [first] = swapsFor("Catfish, battered, fried").alternatives;
    expect(first).toMatchObject({ pool: "action", action: "bake", fcs: 83 });
    expect(first.description).toMatch(/^Catfish, baked or broiled/);
  });

  it("offers taking the skin off a fried wing, and never chicken liver or egg substitute", () => {
    const result = swapsFor("Chicken, wing, fried, no coating, skin eaten, made with oil");
    expect(result.alternatives[0]).toMatchObject({ action: "skin_off", fcs: 63 });
    expect(result.alternatives.map((alternative) => alternative.description).join(" ")).not.toMatch(/liver|egg substitute/i);
  });

  it("offers brown rice for plain white rice, and never rice cooked with oil", () => {
    const result = swapsFor("Rice, white, cooked, no added fat");
    expect(result.alternatives[0]).toMatchObject({
      description: "Rice, brown, cooked, no added fat",
      action: "whole_grain",
      fcs: 69
    });
    expect(result.alternatives.some((alternative) => /made with oil|fat added/i.test(alternative.description))).toBe(false);
  });

  it("offers whole wheat for white bread", () => {
    expect(swapsFor("Bread, white").alternatives[0]).toMatchObject({ action: "whole_grain" });
  });

  it("never offers a pizza topping as a pizza", () => {
    expect(describedAs("Pizza, cheese, stuffed crust").some((description) => /^Topping from/.test(description))).toBe(false);
  });

  it("prefers air-popped popcorn for plain potato chips", () => {
    expect(swapsFor("Potato chips, plain").alternatives[0]).toMatchObject({
      description: "Popcorn, air-popped, unbuttered",
      pool: "preferred"
    });
  });

  it("prefers a baked potato for mashed, and a boiled one for fries the baked potato does not clear", () => {
    expect(describedAs("Potato, mashed, from restaurant")[0]).toBe("Potato, baked, peel eaten");
    expect(describedAs("Potato, french fries, restaurant")[0]).toBe("Potato, boiled, from fresh, peel eaten, no addded fat");
  });

  it("does not offer another survey code for the same grits as a swap", () => {
    expect(describedAs("Grits, with cheese, fat added").some((description) => /^Grits, cooked, corn or hominy, with cheese/.test(description))).toBe(false);
  });

  it("keeps organ meat and cocoa powder out of the cured-meat and bacon rows", () => {
    for (const description of ["Bologna, beef", "Bacon, for use with vegetables"]) {
      expect(describedAs(description).join(" ")).not.toMatch(/liver|cocoa/i);
    }
  });

  it("puts a recipe query on the default swap only, and only with a reviewed name", () => {
    const result = swapsFor("Potato chips, plain");
    expect(result.alternatives[0].recipeQuery).toEqual({
      en: "air-popped popcorn recipe",
      es: "receta de palomitas de maíz naturales"
    });
    expect(result.alternatives.slice(1).every((alternative) => alternative.recipeQuery === null)).toBe(true);
  });

  it("withholds the score of a row under 5 kcal per 100 g", () => {
    expect(belowFiveKcal(data.nutrients["92306090"] ?? null)).toBe(true);
    expect(belowFiveKcal(data.nutrients["63107010"] ?? null)).toBe(false);
  });
});

describe("findSwaps: every row in Table S5", () => {
  const rows = data.foods.filter((food) => !food.ambiguous);
  const results = rows.map((food) => ({ food, result: findSwaps(food, index) }));

  it("offers only swaps that clear the threshold and pass the exclusions", () => {
    const problems: string[] = [];
    for (const { food, result } of results) {
      if (result.alternatives.length > 3) problems.push(`${food.description}: more than three`);
      for (const alternative of result.alternatives) {
        const label = `${food.description} -> ${alternative.description}`;
        if (alternative.fcs < food.fcs2 + SWAP_THRESHOLD) problems.push(`${label}: under the threshold`);
        if (/^Topping from/i.test(alternative.description)) problems.push(`${label}: a topping`);
        const organ = /\b(?:liver|livers|gizzards?|giblets|kidneys?|tripe|brains?|chitterlings|variety meats)\b/i;
        if (organ.test(alternative.description) && !organ.test(food.description)) {
          problems.push(`${label}: organ meat`);
        }
        const kcal = data.nutrients[alternative.code]?.kcal;
        if (kcal !== null && kcal !== undefined && kcal < 5) problems.push(`${label}: under 5 kcal`);
        if (data.nutrients[alternative.code]?.wweia === "Not included in a food category") problems.push(`${label}: not a pool`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("gives each state the meaning its line claims", () => {
    const problems: string[] = [];
    for (const { food, result } of results) {
      const label = `${food.description} (${food.fcs2}) ${result.state}`;
      if (result.state === "swap" && result.alternatives.length === 0) problems.push(label);
      if (result.state === "affirm" && (food.fcs2 < 70 || result.alternatives.length > 0)) problems.push(label);
      if ((result.state === "similar" || result.state === "none_higher") && (food.fcs2 >= 70 || result.alternatives.length > 0)) {
        problems.push(label);
      }
      if (result.state === "no_score_swap" && result.noScoreSwap === null) problems.push(label);
    }
    expect(problems).toEqual([]);
  });

  it("never lists one food twice, or one action twice", () => {
    const problems = results.filter(({ result }) => {
      const codes = result.alternatives.map((alternative) => alternative.code);
      const actions = result.alternatives.map((alternative) => alternative.action).filter(Boolean);
      return new Set(codes).size !== codes.length || new Set(actions).size !== actions.length;
    });
    expect(problems.map(({ food }) => food.description)).toEqual([]);
  });

  it("gives most of the table a swap or an affirmation", () => {
    const usable = results.filter(({ result }) => result.state === "swap" || result.state === "no_score_swap" || result.state === "affirm").length;
    expect(usable / rows.length).toBeGreaterThan(0.8);
  });

  it("names only rows and categories that exist", () => {
    const descriptions = new Set(data.foods.map((food) => food.description));
    const categories = new Set(Object.values(data.nutrients).map((record) => record?.wweia));
    for (const description of Object.keys(SWAP_DISPLAY_NAMES)) expect(descriptions.has(description), description).toBe(true);
    for (const family of SWAP_FAMILIES) {
      for (const description of family.preferred) expect(descriptions.has(description), description).toBe(true);
      for (const category of family.categories) expect(categories.has(category), category).toBe(true);
    }
  });
});
