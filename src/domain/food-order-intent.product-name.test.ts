import { describe, expect, it } from "vitest";
import { brandForBarcode, cleanProductName } from "./food-order-intent";

// Spec 29 P5, from critique finding N4: raw database product names on screen.
describe("cleanProductName", () => {
  it("says the brand once", () => {
    expect(cleanProductName("Cheerios Cheerios", "General Mills")).toBe("Cheerios");
    expect(cleanProductName("Coca cola Coca cola can cokes LG", "Coca-Cola")).toBe("Coca Cola");
  });

  it("drops the pack size", () => {
    expect(cleanProductName("Doritos Nacho Cheese 9.25 oz")).toBe("Doritos Nacho Cheese");
    expect(cleanProductName("Sprite 12 pack cans")).toBe("Sprite");
    expect(cleanProductName("Oatmeal family size")).toBe("Oatmeal");
  });

  it("title-cases what is left, hyphens included", () => {
    expect(cleanProductName("HONEY NUT cheerios")).toBe("Honey Nut Cheerios");
    expect(cleanProductName("coca-cola classic")).toBe("Coca-Cola Classic");
  });

  it("never returns nothing", () => {
    expect(cleanProductName("12 oz")).toBe("12 Oz");
    expect(cleanProductName("   ")).toBe("");
  });
});

describe("brandForBarcode", () => {
  it("names the maker behind a GS1 company prefix", () => {
    expect(brandForBarcode("028400064002")).toBe("Frito-Lay");
    expect(brandForBarcode("016000275287")).toBe("General Mills");
    // EAN-13 is a UPC with a leading zero.
    expect(brandForBarcode("0049000006346")).toBe("Coca-Cola");
  });

  it("says nothing about a prefix it does not know", () => {
    expect(brandForBarcode("999999999999")).toBeNull();
    expect(brandForBarcode("12")).toBeNull();
  });
});
