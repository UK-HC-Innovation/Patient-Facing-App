import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyQueryScoreability, type FcsFood } from "./food-compass";
import { buildFoodSearchIndex, describesQuery, expandFoodQuery, matchFood } from "./food-compass-search";

// The 19 lines a real person typed into the two food doors during the 2026-09-06 critique
// (docs/qa/2026-09-06-food-lens-user-critique.md, findings H5 and G9). Every expectation
// below is the row that answer should land on, written out, so a regression names itself.
const foods = JSON.parse(
  readFileSync(path.join(process.cwd(), "src", "data", "food-compass", "fcs2-foods.json"), "utf-8")
) as FcsFood[];
const index = buildFoodSearchIndex(foods);

function top(query: string): FcsFood | null {
  return matchFood(index, query).candidates[0]?.food ?? null;
}

const WRONG_FAMILIES = /liver|gizzard|meatless|frozen meal|energy drink|\bAMP\b/i;

describe("critique queries land on the right published row", () => {
  it("Brenda in the cereal aisle", () => {
    expect(top("honey nut cheerios")?.description).toBe("Cereal (General Mills Cheerios Honey Nut)");
    // The score the critique compared the barcode against.
    expect(top("cheerios")).toMatchObject({ code: "57123000", description: "Cereal (General Mills Cheerios)", fcs2: 77 });
    expect(top("plain cheerios")?.code).toBe("57123000");
    expect(top("honey nut cherios")?.description).toBe("Cereal (General Mills Cheerios Honey Nut)");
    // Great Value is not in the table; the nearest honey nut oat cereal is the honest answer.
    expect(top("great value honey nut o's")?.description).toBe("Cereal (Malt-O-Meal Honey Nut Toasty O's)");
  });

  it("Sunday dinner, one food at a time", () => {
    // H5: this used to be "Chicken liver, fried", score 71.
    const chicken = top("fried chicken");
    expect(chicken?.description).toMatch(/^Chicken, /);
    expect(chicken?.description).toMatch(/fried/);
    expect(chicken?.description).not.toMatch(WRONG_FAMILIES);

    // H5: this used to be a frozen chopped-sirloin dinner, score 23.
    const potatoes = top("mashed potatoes with gravy");
    expect(potatoes?.description).toMatch(/^Potato, mashed/);
    expect(potatoes?.description).toMatch(/gravy/);
    expect(potatoes?.description).not.toMatch(WRONG_FAMILIES);

    expect(top("green beans cooked with bacon")?.description).toMatch(/^Green beans/);

    // H5: the mix row scores 1, the home recipe scores 33.
    expect(top("cornbread")).toMatchObject({ description: "Cornbread, made from home recipe", fcs2: 33 });
    // Said out loud, the mix is still the mix.
    expect(top("cornbread from a mix")?.description).toBe("Cornbread, prepared from mix");

    expect(top("sweet tea")?.description).toMatch(/^Tea, iced,.*sweetened/);
  });

  it("keeps the whole plate off the wrong row families until P3 splits it", () => {
    const line = "fried chicken, mashed potatoes with gravy, green beans cooked with bacon, cornbread, sweet tea";
    const { candidates } = matchFood(index, line);
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.food.description, line).not.toMatch(WRONG_FAMILIES);
    }
  });

  it("regional names the table does not use", () => {
    expect(top("soup beans")?.description).toMatch(/^Pinto beans/);
    expect(top("soup beans and cornbread")?.description).toMatch(/Pinto beans/);

    const dumplings = top("chicken and dumplins");
    expect(dumplings?.description).toMatch(/dumplings/i);
    expect(dumplings?.description).toMatch(/chicken/i);

    // H5: Ale-8 is a Kentucky ginger soda. It was refused as alcohol.
    expect(classifyQueryScoreability("Ale-8")).toBeNull();
    expect(classifyQueryScoreability("ginger ale")).toBeNull();
    expect(classifyQueryScoreability("cream ale soda")).toBeNull();
    expect(classifyQueryScoreability("root beer")).toBeNull();
    // Actual alcohol still is.
    for (const drink of ["pale ale", "a cold beer", "bourbon", "red wine", "vodka soda"]) {
      expect(classifyQueryScoreability(drink), drink).toEqual({ scoreable: false, reason: "alcohol" });
    }
    for (const query of ["Ale-8", "ale 8", "ale8", "Ale-8-One"]) {
      expect(top(query)?.description, query).toBe("Soft drink, ginger ale");
    }
  });

  it("brand sodas are not energy drinks", () => {
    // H5: "Mountain Dew" scored the AMP energy drink row.
    const dew = matchFood(index, "Mountain Dew");
    expect(dew.confident?.description).toBe("Soft drink, fruit flavored, caffeine containing");
    for (const candidate of dew.candidates) {
      expect(candidate.food.description).not.toMatch(WRONG_FAMILIES);
    }
  });

  it("a restaurant the table does not carry returns no match", () => {
    // H5: this scored "Fun Fruits Creme Supremes", 1.
    expect(matchFood(index, "Bojangles chicken supremes combo").candidates).toEqual([]);
    // A question is not a food either.
    expect(matchFood(index, "what should I cut back on").candidates).toEqual([]);
  });

  it("Spanish dishes", () => {
    // H5: this scored "Sopa seca de arroz" and offered "Cafe con leche" as the alternative.
    expect(top("arroz con pollo")?.description).toBe("Rice with chicken, Puerto Rican style");

    // NOT FIXED by P5. "tamales" still lands on the dessert tamale rather than a savoury
    // one. Separating them needs a dessert signal the table does not carry: demoting
    // every "sweet" row in the sweets group also breaks "cinnamon roll" and "chocolate".
    expect(top("tamales")?.description).toMatch(/^Tamale/);
  });
});

describe("query rewriting", () => {
  it("says regional names in the table's own words", () => {
    expect(expandFoodQuery("Ale-8")).toBe("ginger ale");
    expect(expandFoodQuery("chicken and dumplins")).toBe("chicken and dumplings");
    expect(expandFoodQuery("soup beans")).toBe("pinto beans");
    expect(expandFoodQuery("a cold Mountain Dew")).toBe("a cold soft drink, fruit flavored, caffeine containing");
  });

  it("leaves everything else alone", () => {
    expect(expandFoodQuery("sweet tea")).toBe("sweet tea");
    expect(expandFoodQuery("pale ale")).toBe("pale ale");
  });
});

describe("demotions release when the query asks for the thing", () => {
  it("still finds organ meats and energy drinks by name", () => {
    expect(top("chicken liver")?.description).toMatch(/liver/i);
    expect(top("meatless chicken")?.description).toMatch(/meatless/i);
    expect(top("energy drink")?.description).toMatch(/energy drink/i);
  });

  it("keeps a branded row when the query is the product, not the manufacturer", () => {
    expect(top("big mac")?.description).toBe("Big Mac (McDonalds)");
    expect(top("doritos")?.description).toMatch(/\(Doritos\)/);
  });
});

describe("describesQuery", () => {
  it("holds only when the row carries every word of the query", () => {
    expect(describesQuery("Cereal (General Mills Cheerios)", "Cheerios")).toBe(true);
    // Coca Cola used to be the example of a query no row carried. It is now a reviewed
    // alias to this exact row, and describesQuery expands before it compares, so it holds.
    // Barq's is the replacement: still no mapping, still no shared word.
    expect(describesQuery("Soft drink, cola", "Coca Cola")).toBe(true);
    expect(describesQuery("Soft drink, cola", "Barq's root beer")).toBe(false);
    expect(describesQuery("Fun Fruits Creme Supremes", "Bojangles chicken supremes combo")).toBe(false);
    expect(describesQuery("Tortilla chips, plain", "")).toBe(false);
  });
});
