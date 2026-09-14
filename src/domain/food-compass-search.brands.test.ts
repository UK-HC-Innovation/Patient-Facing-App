import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { FcsFood } from "./food-compass";
import { buildFoodSearchIndex, expandFoodQuery, resolveTypedIdentity } from "./food-compass-search";

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
    ["mello yello", "Soft drink, fruit flavored, caffeine containing"],
    ["lays", "Potato chips, plain"],
    ["lay's", "Potato chips, plain"],
    // The curly apostrophe a phone keyboard types.
    ["lay’s", "Potato chips, plain"],
    ["ruffles", "Potato chips, plain"],
    ["pringles", "Potato chips, plain"],
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
    // A rewrite sent this to the generic corn-puff row, scored 23, until 2026-09-14.
    ["cheetos", "Cheese flavored corn snacks (Cheetos)"],
    ["fritos", "Corn chips, plain (Fritos)"],
    ["cheerios", "Cereal (General Mills Cheerios)"],
    ["big mac", "Big Mac (McDonalds)"]
  ])("%s resolves to %s", (query, description) => {
    expect(resolved(query)).toBe(description);
  });
});

// The table's only Oreo row is a cereal and its only Mountain Dew rows are AMP energy
// drinks. A line that names one of them is offered that row first, never a cookie or a soda.
describe("rows the table carries under a rewritten brand name", () => {
  it.each([
    ["oreo o's", "Oreo O's cereal, Post"],
    ["oreo cereal", "Oreo O's cereal, Post"],
    ["mountain dew amp", "Mountain Dew AMP Energy Drink"],
    ["mtn dew amp", "Mountain Dew AMP Energy Drink"]
  ])("%s offers %s first", (query, description) => {
    const identity = resolveTypedIdentity(index, query, { limit: 3 });
    expect(identity.kind).toBe("proposal");
    expect(identity.kind === "proposal" ? identity.candidates[0]?.food.description : null).toBe(description);
  });

  it("never rewrites a row's own description", () => {
    const rewritten = foods.filter((food) => expandFoodQuery(food.description) !== food.description);
    expect(rewritten.map((food) => food.description)).toEqual([]);
  });
});

it("still refuses to guess which soft drink a Kentucky 'coke' means", () => {
  expect(resolved("coke")).toBeNull();
});
