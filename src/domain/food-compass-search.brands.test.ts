import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { FcsFood } from "./food-compass";
import { buildFoodSearchIndex, resolveTypedIdentity } from "./food-compass-search";

const foods = JSON.parse(
  readFileSync(path.join(process.cwd(), "src", "data", "food-compass", "fcs2-foods.json"), "utf-8")
) as FcsFood[];
const index = buildFoodSearchIndex(foods);

function resolved(query: string): string | null {
  const identity = resolveTypedIdentity(index, query, { limit: 3 });
  if (identity.kind === "alias_row") {
    return foods.find((food) => food.code === identity.code)?.description ?? null;
  }
  return identity.kind === "row" ? identity.food.description : null;
}

// Table S5 carries a brand parenthetical on 296 of its 9,273 rows and none of them is a
// cola, so every one of these used to land wherever BM25 pointed.
describe("supermarket brands the published table has no row for", () => {
  it.each([
    ["coca-cola", "Soft drink, cola"],
    ["coca cola", "Soft drink, cola"],
    ["pepsi", "Soft drink, cola"],
    ["diet coke", "Soft drink, cola, reduced sugar"],
    ["coke zero", "Soft drink, cola, reduced sugar"],
    ["diet pepsi", "Soft drink, cola, reduced sugar"],
    ["dr pepper", "Soft drink, pepper type"],
    ["dr. pepper", "Soft drink, pepper type"],
    ["sprite", "Soft drink, fruit flavored, caffeine free"],
    ["7up", "Soft drink, fruit flavored, caffeine free"],
    ["mtn dew", "Soft drink, fruit flavored, caffeine containing"],
    ["sun drop", "Soft drink, fruit flavored, caffeine containing"],
    ["lays", "Potato chips, plain"],
    ["lay's", "Potato chips, plain"],
    ["ruffles", "Potato chips, plain"],
    ["pringles", "Potato chips, plain"],
    ["cheetos", "Salty snacks, corn or cornmeal base, corn puffs and twists; corn-cheese puffs and twists"],
    ["oreo", "Cookie, chocolate sandwich"],
    ["oreos", "Cookie, chocolate sandwich"]
  ])("%s resolves to %s", (query, description) => {
    expect(resolved(query)).toBe(description);
  });
});

describe("brands the table names in full but search could not reach", () => {
  it.each([
    ["red bull", "Red Bull Energy Drink"],
    ["red bull sugar free", "Red Bull Energy Drink, sugar-free"],
    ["monster", "Monster Energy Drink"],
    ["rockstar", "Rockstar Energy Drink"],
    ["full throttle", "Full Throttle Energy Drink"]
  ])("%s resolves to %s", (query, description) => {
    expect(resolved(query)).toBe(description);
  });
});

describe("brands the table already carries keep resolving through the brand-row rule", () => {
  it.each([
    ["fritos", "Corn chips, plain (Fritos)"],
    ["cheerios", "Cereal (General Mills Cheerios)"],
    ["big mac", "Big Mac (McDonalds)"]
  ])("%s resolves to %s", (query, description) => {
    expect(resolved(query)).toBe(description);
  });
});

it("still refuses to guess which soft drink a Kentucky 'coke' means", () => {
  expect(resolved("coke")).toBeNull();
});
