import { describe, expect, it } from "vitest";
import {
  bpReadingInputSchema,
  careContextInputSchema,
  identifiedFoodSchema
} from "./schemas";
import { labelExtractionSchema } from "./label-extraction-schema";

describe("domain schemas", () => {
  it("accepts a valid blood pressure reading", () => {
    const result = bpReadingInputSchema.parse({
      systolic: "128",
      diastolic: "82",
      pulse: "72",
      contexts: ["morning"],
      note: "Before coffee"
    });

    expect(result.systolic).toBe(128);
    expect(result.pulse).toBe(72);
  });

  it("rejects an implausible blood pressure reading", () => {
    expect(() =>
      bpReadingInputSchema.parse({
        systolic: 80,
        diastolic: 120,
        pulse: 72,
        contexts: ["morning"],
        note: "Before coffee"
      })
    ).toThrow();

    expect(() =>
      bpReadingInputSchema.parse({
        systolic: 340,
        diastolic: 20,
        pulse: 72,
        contexts: ["morning"],
        note: ""
      })
    ).toThrow();
  });

  it("requires enough care instruction text to interpret", () => {
    expect(() =>
      careContextInputSchema.parse({
        title: "Visit",
        rawText: "BP",
        sourceLabel: "Portal"
      })
    ).toThrow();
  });

  it("rejects whitespace-only care context text", () => {
    expect(() =>
      careContextInputSchema.parse({
        title: "Visit",
        rawText: "         ",
        sourceLabel: "Portal"
      })
    ).toThrow();
  });

  it("accepts the label-vision source in the identified-food contract", () => {
    expect(
      identifiedFoodSchema.parse({
        id: "label:000000000001",
        barcode: "000000000001",
        name: "Plain yogurt",
        brand: null,
        category: null,
        nutrition: null,
        source: "label_vision",
        ingredientText: null
      }).source
    ).toBe("label_vision");
  });

  it("turns non-finite and out-of-range label values into null independently", () => {
    const parsed = labelExtractionSchema.parse({
      calories: Number.POSITIVE_INFINITY,
      sodiumMg: 10_001,
      fiberG: -1,
      proteinG: 7
    });

    expect(parsed.calories).toBeNull();
    expect(parsed.sodiumMg).toBeNull();
    expect(parsed.fiberG).toBeNull();
    expect(parsed.proteinG).toBe(7);
  });
});
