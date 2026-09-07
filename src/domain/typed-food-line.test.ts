import { describe, expect, it } from "vitest";
import { MAX_PLATE_ITEMS, isQuestionLine, splitPlateLine } from "./typed-food-line";

describe("isQuestionLine", () => {
  // Darnell's four questions, which must reach the coach and its dosing refusal.
  it.each([
    "how many units for this?",
    "is 45 carbs right, I'm about to dose",
    "can I skip my metformin tonight if I eat light",
    "what should I eat for breakfast tomorrow",
    "what should I cut back on",
    "does this granola bar have peanuts",
    "¿cuánto es esto?",
    "puedo comer esto con mi papá"
  ])("treats %j as a question", (line) => {
    expect(isQuestionLine(line)).toBe(true);
  });

  // Brenda's and Rosa's food names, which must go to the lookup and never open a session.
  it.each([
    "honey nut cheerios",
    "plain cheerios",
    "fried chicken",
    "Mountain Dew",
    "pan dulce",
    "arroz con pollo",
    "tamales",
    "2 slices of pepperoni pizza"
  ])("treats %j as a food", (line) => {
    expect(isQuestionLine(line)).toBe(false);
  });

  it("says nothing about an empty line", () => {
    expect(isQuestionLine("   ")).toBe(false);
  });
});

describe("splitPlateLine", () => {
  it("splits Darnell's plate into three foods", () => {
    expect(splitPlateLine("2 slices of pepperoni pizza, side salad with ranch, and a Mountain Dew")).toEqual({
      items: ["2 slices of pepperoni pizza", "side salad with ranch", "Mountain Dew"],
      dropped: []
    });
  });

  it("splits Brenda's Sunday dinner into five foods", () => {
    expect(
      splitPlateLine("fried chicken, mashed potatoes with gravy, green beans cooked with bacon, cornbread, sweet tea")
    ).toEqual({
      items: [
        "fried chicken",
        "mashed potatoes with gravy",
        "green beans cooked with bacon",
        "cornbread",
        "sweet tea"
      ],
      dropped: []
    });
  });

  // "with a" splits, plain "with" does not: one is a second food, the other is how the
  // first one was cooked.
  it("keeps a cooking method attached to its food", () => {
    expect(splitPlateLine("green beans cooked with bacon")).toEqual({
      items: ["green beans cooked with bacon"],
      dropped: []
    });
  });

  it("splits an added side introduced with a", () => {
    expect(splitPlateLine("side salad with a roll")).toEqual({ items: ["side salad", "roll"], dropped: [] });
  });

  it("leaves a single food alone", () => {
    expect(splitPlateLine("honey nut cheerios")).toEqual({ items: ["honey nut cheerios"], dropped: [] });
  });

  // Spec 30 R5, A05: items six and seven used to be sliced off with no trace, so a plate of
  // seven was presented as a complete answer to five of them.
  it("names what it dropped past five instead of clipping it silently", () => {
    const line = "rice, beans, chicken, salad, bread, cake, soda";
    expect(splitPlateLine(line)).toEqual({
      items: ["rice", "beans", "chicken", "salad", "bread"],
      dropped: ["cake", "soda"]
    });
    expect(splitPlateLine(line).items).toHaveLength(MAX_PLATE_ITEMS);
  });

  it("splits a Spanish plate", () => {
    expect(splitPlateLine("arroz con pollo, frijoles y pan dulce")).toEqual({
      items: ["arroz con pollo", "frijoles", "pan dulce"],
      dropped: []
    });
  });
});
