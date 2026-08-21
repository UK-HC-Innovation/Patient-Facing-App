import { describe, expect, it } from "vitest";
import { diabetesLens, hypertensionLens } from "./condition-lens";
import {
  activeMedDietRules,
  bpTrendFlag,
  computeFoodFlags,
  nutrientRuleFlag,
  percentOfDailyLimit
} from "./food-flags";
import type { HomeReading, IdentifiedFood, Medication, NutritionFacts } from "./types";
import type { DayTotal } from "./day-totals";

const sodiumRule = hypertensionLens.nutrientRules.find((rule) => rule.nutrient === "sodiumMg")!;

function nutrition(overrides: Partial<NutritionFacts> = {}): NutritionFacts {
  return {
    servingSize: "1 serving",
    calories: null,
    sodiumMg: null,
    potassiumMg: null,
    totalSugarsG: null,
    addedSugarsG: null,
    saturatedFatG: null,
    fiberG: null,
    proteinG: null,
    carbsG: null,
    totalFatG: null,
    monoFatG: null,
    polyFatG: null,
    transFatG: null,
    cholesterolMg: null,
    calciumMg: null,
    ironMg: null,
    servingGrams: null,
    basis: "per_serving",
    ...overrides
  };
}

function food(overrides: Partial<IdentifiedFood> = {}): IdentifiedFood {
  return {
    id: "food-1",
    barcode: "1",
    name: "Test Food",
    brand: null,
    category: null,
    nutrition: nutrition(),
    source: "barcode_seed",
    ingredientText: null,
    ...overrides
  };
}

function medication(name: string): Medication {
  return {
    id: `med-${name}`,
    patientId: "patient-1",
    name,
    dose: "10 mg",
    schedule: "Once daily",
    purpose: "Lowers blood pressure.",
    preventionBenefit: "Reduces risk.",
    safetyNote: "Do not stop without asking.",
    source: "patient_reported",
    activeBarriers: []
  };
}

function reading(systolic: number, measuredAt: string): HomeReading {
  return { id: measuredAt, patientId: "patient-1", systolic, diastolic: 80, pulse: 70, measuredAt, contexts: ["morning"], note: "" };
}

describe("percentOfDailyLimit", () => {
  it("rounds the percentage of the daily limit", () => {
    expect(percentOfDailyLimit(890, 1500)).toBe(59);
    expect(percentOfDailyLimit(0, 1500)).toBe(0);
  });
});

describe("nutrientRuleFlag", () => {
  it("flags a warning at 890 mg sodium", () => {
    const flag = nutrientRuleFlag(nutrition({ sodiumMg: 890 }), sodiumRule, "en");
    expect(flag?.severity).toBe("warning");
    expect(flag?.text).toContain("890 mg sodium");
    expect(flag?.text).toContain("59%");
  });

  it("flags a caution at 230 mg sodium", () => {
    const flag = nutrientRuleFlag(nutrition({ sodiumMg: 230 }), sodiumRule, "en");
    expect(flag?.severity).toBe("caution");
  });

  it("returns null at 100 mg sodium", () => {
    expect(nutrientRuleFlag(nutrition({ sodiumMg: 100 }), sodiumRule, "en")).toBeNull();
  });

  it("localizes to Spanish", () => {
    const flag = nutrientRuleFlag(nutrition({ sodiumMg: 890 }), sodiumRule, "es");
    expect(flag?.text).toContain("de sodio");
  });
});

describe("bpTrendFlag", () => {
  it("flags rising systolic readings", () => {
    const flag = bpTrendFlag(
      [reading(132, "2026-07-02"), reading(141, "2026-07-03"), reading(149, "2026-07-04")],
      "en"
    );
    expect(flag?.severity).toBe("info");
  });

  it("returns null for flat readings", () => {
    expect(bpTrendFlag([reading(120, "2026-07-02"), reading(120, "2026-07-03"), reading(120, "2026-07-04")], "en")).toBeNull();
  });

  it("returns null with no readings", () => {
    expect(bpTrendFlag([], "en")).toBeNull();
  });
});

describe("computeFoodFlags", () => {
  const risingReadings = [reading(132, "2026-07-02"), reading(141, "2026-07-03"), reading(149, "2026-07-04")];

  it("suppresses the potassium encourage flag and warns when an ACE inhibitor is present", () => {
    const flags = computeFoodFlags(
      food({ nutrition: nutrition({ potassiumMg: 500 }) }),
      hypertensionLens,
      { medications: [medication("Lisinopril")], readings: [] },
      "en"
    );

    expect(flags.some((flag) => flag.id === "nutrient-potassiumMg")).toBe(false);
    expect(flags.some((flag) => flag.id === "med-ace_arb_potassium-nutrient")).toBe(true);
  });

  it("keeps the potassium encourage flag when no ACE inhibitor is present", () => {
    const flags = computeFoodFlags(
      food({ nutrition: nutrition({ potassiumMg: 500 }) }),
      hypertensionLens,
      { medications: [medication("Amlodipine")], readings: [] },
      "en"
    );

    expect(flags.some((flag) => flag.id === "nutrient-potassiumMg")).toBe(true);
  });

  it("triggers the salt-substitute rule from the product name even with no nutrition", () => {
    const flags = computeFoodFlags(
      food({ name: "Lite Salt", brand: "Morton", nutrition: null }),
      hypertensionLens,
      { medications: [medication("Lisinopril")], readings: [] },
      "en"
    );

    expect(flags.some((flag) => flag.id === "med-ace_arb_potassium-pattern")).toBe(true);
  });

  it("does not show a patient trend before a food is identified", () => {
    const flags = computeFoodFlags(null, hypertensionLens, { medications: [], readings: risingReadings }, "en");
    expect(flags).toEqual([]);
  });

  it("orders warnings before cautions before info", () => {
    const flags = computeFoodFlags(
      food({ nutrition: nutrition({ sodiumMg: 890, potassiumMg: 500 }) }),
      hypertensionLens,
      { medications: [], readings: risingReadings },
      "en"
    );
    const severities = flags.map((flag) => flag.severity);
    expect(severities).toEqual([...severities].sort((a, b) => (a === "warning" ? -1 : b === "warning" ? 1 : a === "caution" ? -1 : 1)));
    expect(flags[0].severity).toBe("warning");
  });

  it.each([
    ["en" as const, "Together with today's meals"],
    ["es" as const, "Junto con las comidas de hoy"]
  ])("flags when the current food pushes a complete day total past its limit in %s", (language, text) => {
    const dayTotals: DayTotal[] = [
      {
        nutrient: "sodiumMg",
        flagKey: sodiumRule.flagKey,
        unit: "mg",
        total: 1400,
        dailyLimit: 1500,
        percent: 93,
        incomplete: false
      }
    ];
    const flags = computeFoodFlags(
      food({ nutrition: nutrition({ sodiumMg: 200 }) }),
      hypertensionLens,
      { medications: [], readings: [] },
      language,
      dayTotals
    );

    expect(flags.find((flag) => flag.id === "day-total-sodiumMg")?.text).toContain(text);
  });

  it("does not claim a crossing from an incomplete total", () => {
    const dayTotals: DayTotal[] = [
      {
        nutrient: "sodiumMg",
        flagKey: sodiumRule.flagKey,
        unit: "mg",
        total: 1400,
        dailyLimit: 1500,
        percent: 93,
        incomplete: true
      }
    ];
    const flags = computeFoodFlags(
      food({ nutrition: nutrition({ sodiumMg: 200 }) }),
      hypertensionLens,
      { medications: [], readings: [] },
      "en",
      dayTotals
    );

    expect(flags.some((flag) => flag.id === "day-total-sodiumMg")).toBe(false);
  });
});

describe("activeMedDietRules", () => {
  it("matches the ACE rule by medication name", () => {
    expect(activeMedDietRules([medication("Lisinopril")], hypertensionLens.medDietRules)).toHaveLength(1);
    expect(activeMedDietRules([medication("Amlodipine")], hypertensionLens.medDietRules)).toHaveLength(0);
  });
});

describe("diabetes lens flags", () => {
  it("flags carbs over the caution threshold", () => {
    const flags = computeFoodFlags(
      food({ nutrition: nutrition({ carbsG: 65 }) }),
      diabetesLens,
      { medications: [], readings: [] },
      "en"
    );
    const carbFlag = flags.find((flag) => flag.id === "nutrient-carbsG");
    expect(carbFlag).toBeDefined();
    expect(carbFlag?.text).toContain("65 g carbs");
  });

  it("encourages fiber", () => {
    const flags = computeFoodFlags(
      food({ nutrition: nutrition({ fiberG: 6 }) }),
      diabetesLens,
      { medications: [], readings: [] },
      "en"
    );
    expect(flags.some((flag) => flag.id === "nutrient-fiberG")).toBe(true);
  });

  it("fires the metformin rule for an alcohol product", () => {
    const flags = computeFoodFlags(
      food({ name: "Red wine", nutrition: null }),
      diabetesLens,
      { medications: [medication("Metformin")], readings: [] },
      "en"
    );
    expect(flags.some((flag) => flag.id === "med-metformin_gi-pattern")).toBe(true);
  });
});
