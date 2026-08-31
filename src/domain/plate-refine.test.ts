import { describe, expect, it } from "vitest";
import { parseFatPreparation, plateRefineQuestion } from "./plate-refine";
import type { PlateCandidate } from "./plate-scan";

function rows(...descriptions: string[]): PlateCandidate[] {
  return descriptions.map((description, index) => ({
    code: `1000000${index}`,
    description,
    fcs: 50
  }));
}

describe("parseFatPreparation", () => {
  // Every string below is a real Table S5 description, typo included.
  it.each([
    ["Quinoa, no added fat", "quinoa", "none"],
    ["Quinoa, fat added", "quinoa", "added"],
    ["Quinoa, NS as to fat", "quinoa", "unspecified"],
    ["Spaghetti, cooked, fat not added in cooking", "spaghetti|cooked", "none"],
    ["Spaghetti, cooked, fat added in cooking", "spaghetti|cooked", "added"],
    ["Green beans, fresh, cooked with oil", "green beans|fresh|cooked", "added"],
    ["Green beans, fresh, cooked, no added fat", "green beans|fresh|cooked", "none"],
    ["Potato, boiled, from fresh, peel eaten, no addded fat", "potato|boiled|from fresh|peel eaten", "none"],
    ["Potato, boiled, from fresh, peel eaten, made with butter", "potato|boiled|from fresh|peel eaten", "added"]
  ])("reads %s as core %s prepared %s", (description, core, preparation) => {
    expect(parseFatPreparation(description)).toEqual({ core, preparation });
  });

  it("leaves a description with no fat qualifier unprepared", () => {
    expect(parseFatPreparation("Banana, raw")).toEqual({ core: "banana|raw", preparation: null });
  });
});

describe("plateRefineQuestion", () => {
  it("asks about the oil when the ledger lists the same food both ways", () => {
    const question = plateRefineQuestion(
      "Quinoa, no added fat",
      rows("Quinoa, no added fat", "Quinoa, fat added", "Quinoa, NS as to fat")
    );
    expect(question?.question).toBe("refineOilQuestion");
    expect(question?.options).toEqual([{ foodId: "10000001", labelKey: "refineWithOil" }]);
  });

  it("offers every distinct preparation once, and never the one already picked", () => {
    const question = plateRefineQuestion(
      "Rice, white, cooked, no added fat",
      rows(
        "Rice, white, cooked, no added fat",
        "Rice, white, cooked, made with oil",
        "Rice, white, cooked, made with butter",
        "Rice, white, cooked, made with margarine"
      )
    );
    // Three "added" rows collapse to one chip: the label already says oil or butter.
    expect(question?.options).toEqual([{ foodId: "10000001", labelKey: "refineWithOil" }]);
  });

  it("works from the fat-added row back to the plain one", () => {
    const question = plateRefineQuestion(
      "Spaghetti, cooked, fat added in cooking",
      rows("Spaghetti, cooked, fat added in cooking", "Spaghetti, cooked, fat not added in cooking")
    );
    expect(question?.options).toEqual([{ foodId: "10000001", labelKey: "refineNoOil" }]);
  });

  it("reaches across the two ways FNDDS writes the same cooking step", () => {
    const question = plateRefineQuestion(
      "Green beans, fresh, cooked, no added fat",
      rows("Green beans, fresh, cooked, no added fat", "Green beans, fresh, cooked with oil")
    );
    expect(question?.options).toEqual([{ foodId: "10000001", labelKey: "refineWithOil" }]);
  });

  it("offers frying as its own answer", () => {
    const question = plateRefineQuestion(
      "Potato, cooked, no added fat",
      rows("Potato, cooked, no added fat", "Potato, cooked, fried")
    );
    expect(question?.options).toEqual([{ foodId: "10000001", labelKey: "refineFried" }]);
  });

  it("asks nothing when the candidates are different foods, not different cooking", () => {
    expect(
      plateRefineQuestion(
        "Rice, white, cooked, no added fat",
        rows("Rice, white, cooked, no added fat", "Rice, white, cooked, glutinous", "Rice, brown, cooked")
      )
    ).toBeNull();
    expect(plateRefineQuestion("Banana, raw", rows("Banana, raw", "Banana, baked"))).toBeNull();
    expect(plateRefineQuestion("Apple, raw", rows("Apple, raw"))).toBeNull();
    expect(plateRefineQuestion("Apple, raw", [])).toBeNull();
  });

  it("never offers an unspecified row as an answer", () => {
    expect(plateRefineQuestion("Quinoa, fat added", rows("Quinoa, NS as to fat"))).toBeNull();
  });
});
