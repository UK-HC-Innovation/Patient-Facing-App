import { describe, expect, it } from "vitest";
import {
  buildFoodMatchProvenance,
  foodOrderIntentToLookupText,
  foodOrderCorrectionQueries,
  mergePizzaOrderRefinement,
  parseFoodOrderIntent,
  parseSpokenSize,
  servingsForSize
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

  it("understands restaurant and topping details added conversationally after the camera finds pizza", () => {
    expect(parseFoodOrderIntent("This came from Papa John's. It is a pepperoni and sausage pizza.")).toMatchObject({
      restaurant: "Papa John's",
      item: "pizza",
      toppings: ["pepperoni", "sausage"],
      matchQuery: "Pizza with pepperoni, from restaurant or fast food, NS as to type of crust"
    });
  });

  it("merges restaurant and topping details when speech recognition splits them into separate turns", () => {
    const restaurantTurn = mergePizzaOrderRefinement("This came from Papa John's.");
    expect(restaurantTurn).toMatchObject({ restaurant: "Papa John's", item: "pizza", toppings: [] });

    const toppingTurn = mergePizzaOrderRefinement("It is pepperoni and sausage.", restaurantTurn);
    expect(toppingTurn).toMatchObject({
      restaurant: "Papa John's",
      item: "pizza",
      toppings: ["pepperoni", "sausage"]
    });
    expect(foodOrderIntentToLookupText(toppingTurn!)).toBe(
      "I am ordering a pepperoni and sausage pizza from Papa John's"
    );
  });

  it("accepts a terse pizza-context follow-up without making the global parser infer pizza", () => {
    expect(parseFoodOrderIntent("Papa John's, pepperoni and sausage")).toBeNull();
    expect(mergePizzaOrderRefinement("Papa John's, pepperoni and sausage")).toMatchObject({
      restaurant: "Papa John's",
      toppings: ["pepperoni", "sausage"]
    });
  });

  it("leaves ordinary short food searches on the existing path", () => {
    expect(parseFoodOrderIntent("pizza")).toBeNull();
    expect(parseFoodOrderIntent("banana")).toBeNull();
  });
});

describe("spoken food sizes", () => {
  it("recognizes conversational English and Spanish sizes outside order syntax", () => {
    expect(parseSpokenSize("large pepperoni pizza", "en")).toBe("large");
    expect(parseSpokenSize("pizza de tamaño familiar", "es")).toBe("family");
  });

  it("uses the locked serving assumptions", () => {
    expect(servingsForSize("personal")).toBe(0.75);
    expect(servingsForSize("regular")).toBe(1);
    expect(servingsForSize("large")).toBe(1.5);
    expect(servingsForSize("extra large")).toBe(2);
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
