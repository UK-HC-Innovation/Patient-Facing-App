import { describe, expect, it } from "vitest";
import { demoState } from "@/domain/fixtures";
import { hypertensionLens } from "@/domain/condition-lens";
import type { FoodFlag } from "@/domain/food-flags";
import { buildFoodLensInstructions, buildFoodVisionSystemPrompt, buildPerAskContext } from "./food-instructions";

describe("buildFoodLensInstructions", () => {
  it("includes the patient name, medication, condition, and reading trend", () => {
    const instructions = buildFoodLensInstructions(demoState, hypertensionLens);
    expect(instructions).toContain("Jordan");
    expect(instructions).toContain("Lisinopril");
    expect(instructions).toContain("hypertension");
    expect(instructions).toContain("trending up");
  });

  it("includes the ACE medication guidance only when the med matches", () => {
    const withMed = buildFoodLensInstructions(demoState, hypertensionLens);
    expect(withMed).toContain("salt substitutes");

    const noMed = buildFoodLensInstructions({ ...demoState, medications: [] }, hypertensionLens);
    expect(noMed).not.toContain("salt substitutes");
  });

  it("directs the model to speak Spanish for a Spanish-speaking patient", () => {
    const instructions = buildFoodLensInstructions(
      { ...demoState, patient: { ...demoState.patient, language: "es" } },
      hypertensionLens
    );
    expect(instructions).toContain("Speak Spanish");
  });
});

describe("buildFoodVisionSystemPrompt", () => {
  it("carries the base coach persona", () => {
    const prompt = buildFoodVisionSystemPrompt(demoState, hypertensionLens);
    expect(prompt).toContain("Jordan");
    expect(prompt).toContain("hypertension");
  });

  it("steers away from the phrasing that trips the grounding gate", () => {
    const prompt = buildFoodVisionSystemPrompt(demoState, hypertensionLens);
    // Command-shaped advice ("You should lower…") is blocked by the med-change
    // verifier; diagnosis-shaped statements ("you have hypertension") by the
    // diagnosis verifier. The prompt must explicitly warn the model off both.
    expect(prompt).toContain("You should stop");
    expect(prompt).toContain("gentle suggestions");
    expect(prompt).toContain("you have high blood pressure");
    expect(prompt).toContain("blood-pressure, A1C, or blood-sugar number");
  });
});

describe("buildPerAskContext", () => {
  const flags: FoodFlag[] = [{ id: "nutrient-sodiumMg", severity: "warning", text: "890 mg sodium — 59% of your 1500 mg daily limit" }];

  it("embeds the food JSON and flags", () => {
    const context = buildPerAskContext(
      { id: "1", barcode: "1", name: "Soup", brand: "Campbell's", category: "Soups", nutrition: null, source: "barcode_seed", ingredientText: null },
      flags
    );
    expect(context).toContain("Soup");
    expect(context).toContain("890 mg sodium");
  });

  it("reports no food data when the food is null", () => {
    const context = buildPerAskContext(null, []);
    expect(context).toContain('"foodData":"none"');
    expect(context).toContain("- none");
  });
});

describe("buildPerAskContext — Food Compass block", () => {
  it("hands the model the score, the density and the alternatives as facts", () => {
    const context = buildPerAskContext(null, [], {
      kind: "score",
      fcs: 83,
      band: "encourage",
      tier: "T1",
      calorieDensityKcalPer100g: 89,
      alternatives: [{ description: "Raspberries, raw", fcs: 100 }]
    });
    expect(context).toContain("83 out of 100");
    expect(context).toContain("encourage");
    expect(context).toContain("89 kcal per 100 g");
    expect(context).toContain("Raspberries, raw (100)");
    // The non-negotiable line every numeric context in this app closes with.
    expect(context).toContain("Use the numbers above exactly; do not recompute them.");
  });

  it("marks a label-derived score as estimated so the model does not present it as published", () => {
    const context = buildPerAskContext(null, [], {
      kind: "score",
      fcs: 19,
      band: "minimize",
      tier: "T2",
      calorieDensityKcalPer100g: null,
      alternatives: []
    });
    expect(context).toContain("estimated from the label");
  });

  it("tells the model to give no number at all for a carved-out food", () => {
    const context = buildPerAskContext(null, [], { kind: "carve_out", reason: "zero_calorie" });
    expect(context).toContain("outside the score's range");
    expect(context).toContain("do not give it a number");
  });

  it("says nothing about the compass when there is no score", () => {
    expect(buildPerAskContext(null, [])).not.toContain("Food Compass");
  });
});
