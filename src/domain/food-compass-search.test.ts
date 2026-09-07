import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildFoodSearchIndex,
  coversBothSidesOfConjunctions,
  identityBasis,
  matchFood,
  resolveTypedIdentity,
  SHORT_CIRCUIT_MARGIN
} from "./food-compass-search";
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

// Spec 30 R4. A search result is a proposal unless the mapping is justified. The rank margin
// cannot be the gate: it is 1.00 to 1.11 for apple, banana, pinto beans, PB&J, chicken and
// dumplings, coffee and pizza, so gating on it would ask a question after nearly every input.
describe("identityBasis", () => {
  it.each([
    ["Apple, raw", "apple", "head_canonical"],
    ["Banana, raw", "banana", "head_canonical"],
    ["Pan Dulce, no topping", "pan dulce", "head_canonical"],
    ["Cereal (General Mills Cheerios)", "cheerios", "brand"],
    ["Cereal (General Mills Cheerios Honey Nut)", "honey nut cheerios", "brand"],
    ["Banana, baked", "baked banana", "coverage"],
    ["Soft drink, ginger ale", "Ale-8", "alias"]
  ])("publishes %j for %j on %s", (description, query, basis) => {
    expect(identityBasis(description, query)).toBe(basis);
  });

  it.each([
    // The exact rows spec 30 finding E03 caught being published with a score.
    ["Chicken, chicken roll, roasted", "chicken"],
    ["Soup, fruit", "soup"],
    ["Salad dressing, NFS, for salads", "salad"],
    ["Coffee, Latte", "coffee"],
    ["Cake, carrot, diet", "diet coke"],
    ["Pizza, cheese, stuffed crust", "pizza"],
    ["Cafe con leche", "leche"],
    ["Huevos rancheros", "huevos"],
    ["Soupy rice from Puerto Rican style Asopao de Pollo", "pollo asado"],
    ["Quinoa, fat added", "quinoa"]
  ])("proposes rather than publishes %j for %j", (description, query) => {
    expect(identityBasis(description, query)).toBeNull();
  });
});

describe("resolveTypedIdentity", () => {
  it("resolves a reviewed alias to one row", () => {
    expect(resolveTypedIdentity(index, "manzana")).toMatchObject({ kind: "alias_row", code: "63101000" });
    expect(resolveTypedIdentity(index, "plátano")).toMatchObject({ kind: "alias_row", code: "63107010" });
    expect(resolveTypedIdentity(index, "plain cheerios")).toMatchObject({ kind: "alias_row", code: "57123000" });
  });

  it("resolves a reviewed alias to a named question", () => {
    expect(resolveTypedIdentity(index, "frijoles")).toEqual({
      kind: "alias_candidates",
      codes: ["41104020", "41102020", "41205015"]
    });
    expect(resolveTypedIdentity(index, "pollo asado")).toEqual({
      kind: "alias_candidates",
      codes: ["24122120", "24122110", "24152220"]
    });
  });

  it("proposes rather than publishing a bare generic name", () => {
    for (const query of ["pizza", "chicken", "soup", "salad", "coffee", "diet coke"]) {
      expect(resolveTypedIdentity(index, query).kind, query).toBe("proposal");
    }
  });

  it("names the rows a miss retrieved and the coverage filter rejected", () => {
    const outcome = resolveTypedIdentity(index, "bojangles chicken supremes combo");
    expect(outcome.kind).toBe("none");
    expect(outcome.kind === "none" ? outcome.candidates.length : 0).toBeGreaterThan(0);
  });

  it("publishes the best row for a plate component, which the person already named", () => {
    const outcome = resolveTypedIdentity(index, "fried chicken", { bestRow: true });
    expect(outcome).toMatchObject({ kind: "row", basis: "coverage" });
    expect(resolveTypedIdentity(index, "fried chicken").kind).toBe("proposal");
  });

  // R4 rule 5: a lone hit used to be confident by virtue of being alone.
  it("does not call a lone unjustified hit confident", () => {
    const alone = matchFood(index, "huevos");
    expect(alone.candidates).toHaveLength(1);
    expect(alone.confident).toBeNull();
  });
});

// Spec 30 R5 step 5, finding E02. Splitting first turned "mac and cheese" into a Big Mac and
// a slice of cheese, while the row for the whole dish was never tried.
describe("coversBothSidesOfConjunctions", () => {
  it.each([
    ["Chicken or turkey, dumplings, and vegetables; gravy", "chicken and dumplings"],
    ["Macaroni or noodles with cheese, Easy Mac type", "mac and cheese"],
    ["Biscuit with gravy", "biscuits and gravy"],
    ["Peanut butter and jelly sandwich, on white bread", "peanut butter and jelly sandwich"]
  ])("keeps %j together for %j", (description, line) => {
    expect(coversBothSidesOfConjunctions(description, line)).toBe(true);
  });

  it("splits a line no single row covers", () => {
    expect(coversBothSidesOfConjunctions("Pizza, cheese and vegetables, thin crust", "pizza and salad")).toBe(false);
  });

  it("says nothing about a line with no conjunction", () => {
    expect(coversBothSidesOfConjunctions("Banana, raw", "banana")).toBe(false);
  });
});
