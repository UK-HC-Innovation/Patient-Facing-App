import { describe, expect, it } from "vitest";
import {
  buildFoodMatchProvenance,
  foodOrderCorrectionQueries,
  parseFoodOrderIntent
} from "./food-order-intent";

describe("parseFoodOrderIntent", () => {
  it("extracts the restaurant and toppings from a spoken pizza order", () => {
    expect(parseFoodOrderIntent("I am ordering a pepperoni and sausage pizza from Papa John's")).toEqual({
      kind: "food_order",
      originalText: "I am ordering a pepperoni and sausage pizza from Papa John's",
      restaurant: "Papa John's",
      item: "pizza",
      toppings: ["pepperoni", "sausage"],
      size: null,
      crust: null,
      matchQuery: "Pizza with pepperoni, from restaurant or fast food, NS as to type of crust"
    });
  });

  it("normalizes a possessive-free brand alias and preserves size and crust", () => {
    expect(parseFoodOrderIntent("Getting a large thin crust pepperoni pizza at Papa Johns")).toMatchObject({
      restaurant: "Papa John's",
      item: "pizza",
      toppings: ["pepperoni"],
      size: "large",
      crust: "thin",
      matchQuery: "Pizza with pepperoni, from restaurant or fast food, thin crust"
    });
  });

  it("leaves ordinary short food searches on the existing path", () => {
    expect(parseFoodOrderIntent("pizza")).toBeNull();
    expect(parseFoodOrderIntent("banana")).toBeNull();
  });
});

describe("food-order provenance", () => {
  it("states which branded-order details the published match does not represent", () => {
    const intent = parseFoodOrderIntent("Pepperoni and sausage pizza from Papa John's");
    expect(intent).not.toBeNull();
    if (!intent) return;

    const provenance = buildFoodMatchProvenance(
      intent,
      "Pizza with pepperoni, from restaurant or fast food, NS as to type of crust"
    );
    expect(provenance.exact).toBe(false);
    expect(provenance.unmatchedDetails).toEqual(["Papa John's exact menu item", "sausage-specific topping"]);
    expect(provenance.note).toContain("not Papa John's nutrition");
  });

  it("offers deterministic topping-category corrections", () => {
    const intent = parseFoodOrderIntent("Pepperoni and sausage pizza from Papa John's");
    expect(intent).not.toBeNull();
    if (!intent) return;

    expect(foodOrderCorrectionQueries(intent)).toEqual([
      "Pizza with meat other than pepperoni, from restaurant or fast food, NS as to type of crust",
      "Pizza, cheese, from restaurant or fast food, NS as to type of crust"
    ]);
  });
});
