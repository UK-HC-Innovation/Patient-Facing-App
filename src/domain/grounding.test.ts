import { describe, expect, it } from "vitest";
import {
  containsClinicalAdjacentClaim,
  extractBloodPressureClaims,
  extractGlucoseClaims,
  extractQuantitativeClaims,
  verifyGrounding,
  type SourceFact
} from "./grounding";

const facts: SourceFact[] = [
  {
    id: "plan-brent",
    label: "Care plan",
    value: "Keep blood pressure and blood sugar in range. Call threshold 160/100. Condition: hypertension.",
    sourceKind: "care_plan",
    sourceName: "Elkhorn Creek Family Medicine",
    confidence: "confirmed",
    patientConfirmed: false,
    effectiveDate: ""
  },
  {
    id: "fact-a1c",
    label: "A1c",
    value: "8.0%",
    sourceKind: "extracted_fact",
    sourceName: "Extracted from care context",
    confidence: "needs_review",
    patientConfirmed: false,
    effectiveDate: ""
  },
  {
    id: "reading-latest",
    label: "Home reading",
    value: "150/94",
    sourceKind: "reading",
    sourceName: "Home monitor",
    confidence: "patient_reported",
    patientConfirmed: true,
    effectiveDate: "2026-07-04T07:10:00.000Z"
  },
  {
    id: "context-avs",
    label: "After-visit summary",
    value: "For type 2 diabetes, continue metformin 500 mg twice daily.",
    sourceKind: "context_item",
    sourceName: "Elkhorn Creek Family Medicine",
    confidence: "imported",
    patientConfirmed: false,
    effectiveDate: ""
  },
  {
    id: "med-metformin",
    label: "Metformin",
    value: "Metformin 500 mg Twice daily. Helps your body handle blood sugar.",
    sourceKind: "medication",
    sourceName: "Elkhorn Creek Family Medicine",
    confidence: "imported",
    patientConfirmed: false,
    effectiveDate: ""
  },
  {
    id: "glucose-latest",
    label: "Home glucose",
    value: "152 mg/dL",
    sourceKind: "reading",
    sourceName: "Home monitor",
    confidence: "patient_reported",
    patientConfirmed: true,
    effectiveDate: "2026-07-04T07:05:00.000Z"
  }
];

describe("containsClinicalAdjacentClaim", () => {
  it("recognizes clinical-adjacent answer text but not generic chatter", () => {
    expect(containsClinicalAdjacentClaim("Your last A1C was 8.0.")).toBe(true);
    expect(containsClinicalAdjacentClaim("Your recent readings are trending up.")).toBe(true);
    expect(containsClinicalAdjacentClaim("I see multiple medications in your plan.")).toBe(false);
    expect(containsClinicalAdjacentClaim("What would you like help with next?")).toBe(false);
  });
});

describe("extractQuantitativeClaims / extractBloodPressureClaims", () => {
  it("extracts A1c claims", () => {
    expect(extractQuantitativeClaims("Your A1C is 8.0 right now.")).toEqual([{ kind: "a1c", value: "8.0" }]);
  });

  it("extracts blood-pressure pairs in slash and word form", () => {
    expect(extractBloodPressureClaims("Your reading is 150/94 today.")).toEqual([
      { systolic: "150", diastolic: "94" }
    ]);
    expect(extractBloodPressureClaims("blood pressure 200 over 130")).toEqual([
      { systolic: "200", diastolic: "130" }
    ]);
  });

  it("extracts glucose claims but ignores bare grams of sugar", () => {
    expect(extractGlucoseClaims("Your blood sugar was 152.")).toEqual([{ value: "152" }]);
    expect(extractGlucoseClaims("glucose of 250")).toEqual([{ value: "250" }]);
    expect(extractGlucoseClaims("65 g of added sugar")).toEqual([]);
  });
});

describe("verifyGrounding", () => {
  it("allows a cited A1c that matches the source fact", () => {
    const result = verifyGrounding({
      answer: "Your A1C is 8.0, and your care team is watching it.",
      sourceFacts: facts,
      citationIds: ["fact-a1c"]
    });

    expect(result.allowed).toBe(true);
  });

  it("blocks an A1c number that does not match cited facts", () => {
    const result = verifyGrounding({
      answer: "Your A1C is 9.9 now, so act quickly.",
      sourceFacts: facts,
      citationIds: ["fact-a1c"]
    });

    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("unsupported_numeric_claim:a1c:9.9");
  });

  it("allows a blood-pressure pair that matches a cited reading", () => {
    const result = verifyGrounding({
      answer: "Your reading is 150/94, which is close to your call line.",
      sourceFacts: facts,
      citationIds: ["reading-latest"]
    });

    expect(result.allowed).toBe(true);
  });

  it("blocks blood-pressure numbers that do not match a cited reading", () => {
    const result = verifyGrounding({
      answer: "Your reading is 200/130.",
      sourceFacts: facts,
      citationIds: ["reading-latest"]
    });

    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("unsupported_numeric_claim:blood_pressure:200/130");
  });

  it("allows a blood-sugar number that matches a cited glucose reading", () => {
    const result = verifyGrounding({
      answer: "Your blood sugar was 152 this morning, and your care team is watching it.",
      sourceFacts: facts,
      citationIds: ["glucose-latest"]
    });

    expect(result.allowed).toBe(true);
  });

  it("blocks a blood-sugar number that does not match a cited glucose reading", () => {
    const result = verifyGrounding({
      answer: "Your blood sugar is 250 now.",
      sourceFacts: facts,
      citationIds: ["glucose-latest"]
    });

    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("unsupported_numeric_claim:glucose:250");
  });

  it("does not misread grams of added sugar in a food answer as a glucose claim", () => {
    const result = verifyGrounding({
      answer: "This bottle has about 65 g of added sugar — more than two days' worth.",
      sourceFacts: facts,
      citationIds: ["plan-brent"]
    });

    expect(result.blockedReasons).not.toContain("unsupported_numeric_claim:glucose:65");
  });

  it("blocks diagnosis claims", () => {
    const result = verifyGrounding({
      answer: "You have diabetes and you are diagnosed with kidney disease.",
      sourceFacts: facts,
      citationIds: ["context-avs"]
    });

    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("diagnosis_claim");
  });

  it("blocks medication-change instructions", () => {
    const result = verifyGrounding({
      answer: "You should stop metformin before your next visit.",
      sourceFacts: facts,
      citationIds: ["med-metformin"]
    });

    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("medication_change_claim");
  });

  it("does not block a 'do not stop or change the dose' safety note", () => {
    const result = verifyGrounding({
      answer: "Do not stop or change the dose without asking your clinician.",
      sourceFacts: facts,
      citationIds: ["med-metformin"]
    });

    expect(result.allowed).toBe(true);
  });

  it("blocks clinical-adjacent claims with zero supporting facts", () => {
    const result = verifyGrounding({
      answer: "Your blood pressure and readings show you are overdue.",
      sourceFacts: [],
      citationIds: []
    });

    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("clinical_adjacent_claim_without_sources");
  });

  it("flags unknown citation ids", () => {
    const result = verifyGrounding({
      answer: "Here is some general information.",
      sourceFacts: facts,
      citationIds: ["does-not-exist"]
    });

    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("unknown_citation:does-not-exist");
  });
});

describe("plate-scan safety guards", () => {
  // A photo carb number is an estimate. Turning it into a dose is the one thing it must
  // never do, so the shapes that offer that arithmetic are blocked outright.
  it.each([
    "You can calculate your insulin dose by dividing 60 grams of carbs by your ratio of 10.",
    "To cover 45 grams of carbs you would need about 4 units of insulin.",
    "Figure out your bolus for this plate: it is roughly 30 g of carbs.",
    "Your insulin-to-carb ratio of 1:10 makes this plate about 3 units.",
    "Puedo calcular tu insulina: son unos 4 unidades para 45 g."
  ])("blocks dose-calculation help: %s", (answer) => {
    const result = verifyGrounding({ answer, sourceFacts: facts, citationIds: ["med-metformin"] });
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("insulin_dose_calculation");
  });

  it.each([
    // The hedge this app itself prints under a scanned plate. If the verifier ever matched
    // it, every compliant answer would be swapped for the generic fallback.
    "Carb numbers from a photo are rough. Never use them for insulin math; follow your care team's plan.",
    "Do not stop or change the dose without asking your clinician.",
    "This plate has about 30 to 45 g of carbs.",
    "Insulin is part of your plan, and this plate is about 40 g of carbs."
  ])("leaves an honest answer alone: %s", (answer) => {
    const result = verifyGrounding({ answer, sourceFacts: facts, citationIds: ["med-metformin"] });
    expect(result.blockedReasons).not.toContain("insulin_dose_calculation");
  });

  it.each([
    "Yes, this is safe for your peanut allergy.",
    "That is fine with your celiac.",
    "This is okay for your child.",
    "Your 4-year-old can eat this.",
    "It does not contain any peanuts.",
    "Su hijo puede comer esto."
  ])("blocks an allergy or child clearance: %s", (answer) => {
    const result = verifyGrounding({ answer, sourceFacts: facts, citationIds: ["med-metformin"] });
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("allergy_or_child_clearance");
  });

  it.each([
    "This is high in peanuts.",
    "Peanut butter is high in fat.",
    "Peanuts are the first ingredient listed on the label.",
    "Check the label and ask your care team about the peanut allergy."
  ])("leaves a plain nutrition statement alone: %s", (answer) => {
    const result = verifyGrounding({ answer, sourceFacts: facts, citationIds: ["med-metformin"] });
    expect(result.blockedReasons).not.toContain("allergy_or_child_clearance");
  });
});
