import { describe, expect, it } from "vitest";
import { brentState, demoState } from "./fixtures";
import { buildHealthBrief } from "./health-brief";
import type { AssessmentEvent } from "./assessment";
import type { AppState, GlucoseReading, IdentifiedFood, MealLogEntry } from "./types";

const FIXED = "2026-07-05T12:00:00.000Z";
const SCREENING_AS_OF = "2026-07-20T12:00:00.000Z";

function assessmentEvent(overrides: Partial<AssessmentEvent> = {}): AssessmentEvent {
  return {
    id: "phq9-latest",
    patientId: demoState.patient.id,
    instrumentId: "phq9",
    itemResponses: [1, 1, 1, 1, 1, 1, 1, 0, 0],
    totalScore: 7,
    severityBand: "mild",
    status: "patient_reported",
    recordedAt: "2026-07-12T23:30:00.000+05:00",
    ...overrides
  };
}

function titles(state: AppState): string[] {
  return buildHealthBrief(state, { generatedAt: FIXED }).sections.map((section) => section.title);
}

function carbFood(carbsG: number): IdentifiedFood {
  return {
    id: `food-${carbsG}`,
    barcode: null,
    name: "Test meal",
    brand: null,
    category: null,
    nutrition: {
      servingSize: "1 serving",
      calories: null,
      sodiumMg: null,
      potassiumMg: null,
      totalSugarsG: null,
      addedSugarsG: null,
      saturatedFatG: null,
      fiberG: null,
      proteinG: null,
      carbsG,
      totalFatG: null,
      monoFatG: null,
      polyFatG: null,
      transFatG: null,
      cholesterolMg: null,
      calciumMg: null,
      ironMg: null,
      servingGrams: null,
      basis: "per_serving" as const
    },
    source: "vision_estimate",
    ingredientText: null
  };
}

// demoState spread with a diabetes condition plus paired meal/glucose data that
// clears the correlation floors, to prove the brief wires the food pattern in.
function pairedDiabetesState(): AppState {
  const meals: MealLogEntry[] = [];
  const glucoseReadings: GlucoseReading[] = [];
  const highDays = ["01", "02", "03"];
  const lowDays = ["04", "05", "06"];
  for (const day of highDays) {
    meals.push({
      id: `meal-high-${day}`,
      patientId: "patient-1",
      loggedAt: `2026-07-${day}T12:00:00.000Z`,
      food: carbFood(60),
      flags: [],
      assistantSummary: "",
      compassScore: { fcs: 20, band: "minimize", tier: "T1" }
    });
    glucoseReadings.push({
      id: `g-high-${day}`,
      patientId: "patient-1",
      valueMgDl: 205,
      measuredAt: `2026-07-${day}T13:00:00.000Z`,
      contexts: ["after_medicine"],
      note: ""
    });
  }
  for (const day of lowDays) {
    meals.push({
      id: `meal-low-${day}`,
      patientId: "patient-1",
      loggedAt: `2026-07-${day}T12:00:00.000Z`,
      food: carbFood(20),
      flags: [],
      assistantSummary: "",
      compassScore: { fcs: 80, band: "encourage", tier: "T1" }
    });
    glucoseReadings.push({
      id: `g-low-${day}`,
      patientId: "patient-1",
      valueMgDl: 150,
      measuredAt: `2026-07-${day}T13:00:00.000Z`,
      contexts: ["after_medicine"],
      note: ""
    });
  }
  return {
    ...demoState,
    carePlan: { ...demoState.carePlan, conditions: ["hypertension", "diabetes"] },
    glucoseReadings,
    mealLog: meals
  };
}

describe("buildHealthBrief", () => {
  it("omits the screening section when there are no valid clear-license assessment events", () => {
    const brief = buildHealthBrief(demoState, { generatedAt: SCREENING_AS_OF });
    expect(brief.sections.map(({ title }) => title)).not.toContain("Check-ins and screenings");
  });

  it("keeps the newest event per instrument in registry order with UTC date and patient-reported provenance", () => {
    const state = {
      ...demoState,
      assessmentEvents: [
        assessmentEvent(),
        assessmentEvent({ id: "phq9-older", totalScore: 3, severityBand: "minimal", recordedAt: "2026-07-01T12:00:00.000Z" }),
        assessmentEvent({
          id: "gad2-row",
          instrumentId: "gad2",
          itemResponses: [0, 0],
          totalScore: 0,
          severityBand: "negative",
          recordedAt: "2026-07-10T12:00:00.000Z"
        })
      ]
    };

    const section = buildHealthBrief(state, { generatedAt: SCREENING_AS_OF }).sections.find(
      ({ title }) => title === "Check-ins and screenings"
    );

    expect(section).toEqual({
      title: "Check-ins and screenings",
      status: "patient_reported",
      items: [
        "Mood check-in (PHQ-9): 7 — mild — Jul 12, patient-reported.",
        "GAD-2 anxiety check: 0 — negative — Jul 10, patient-reported.",
        "App-derived due summary: 4 check-ins due."
      ]
    });
  });

  it("ignores unknown, invalid, future-dated, and pending-license assessment rows", () => {
    const state = {
      ...demoState,
      assessmentEvents: [
        assessmentEvent({ id: "unknown", instrumentId: "unknown", recordedAt: "2026-07-10T12:00:00.000Z" }),
        assessmentEvent({ id: "invalid", recordedAt: "not-a-date" }),
        assessmentEvent({ id: "future", recordedAt: "2026-07-21T12:00:00.000Z" }),
        assessmentEvent({
          id: "pending-nida",
          instrumentId: "nida_single",
          itemResponses: [0],
          totalScore: 0,
          severityBand: "negative",
          recordedAt: "2026-07-10T12:00:00.000Z"
        })
      ]
    };

    const brief = buildHealthBrief(state, { generatedAt: SCREENING_AS_OF });
    expect(brief.sections.map(({ title }) => title)).not.toContain("Check-ins and screenings");
  });

  it("includes care goal and medication sections", () => {
    const brief = buildHealthBrief(demoState);

    expect(brief.sections.map((section) => section.title)).toContain("What I am working on");
    expect(brief.sections.map((section) => section.title)).toContain("Medicines and barriers");
  });

  it("adds clinician-authored call threshold and warning symptom guidance", () => {
    const brief = buildHealthBrief(demoState);
    const urgencySection = brief.sections.find((section) => section.title === "When to call my care team");

    expect(urgencySection).toBeDefined();
    expect(urgencySection?.status).toBe("confirmed");
    expect(urgencySection?.items.join(" ")).toContain("Clinician-confirmed care-plan guidance.");
    expect(urgencySection?.items.join(" ")).toContain("160");
    expect(urgencySection?.items.join(" ")).toContain("100");
    expect(urgencySection?.items.join(" ")).toContain("chest pain");
  });

  it("marks inferred status for standard education threshold guidance", () => {
    const brief = buildHealthBrief({
      ...demoState,
      carePlan: {
        ...demoState.carePlan,
        thresholdSource: "standard_education"
      }
    });
    const urgencySection = brief.sections.find((section) => section.title === "When to call my care team");

    expect(urgencySection?.status).toBe("inferred");
    expect(urgencySection?.items.join(" ")).toContain("Standard education guidance");
  });

  it("uses provided generatedAt and marks missing medicines for review", () => {
    const brief = buildHealthBrief(
      { ...demoState, medications: [] },
      { generatedAt: "2026-07-05T12:00:00.000Z" }
    );
    const medicationSection = brief.sections.find((section) => section.title === "Medicines and barriers");

    expect(brief.generatedAt).toBe("2026-07-05T12:00:00.000Z");
    expect(medicationSection?.status).toBe("needs_review");
    expect(medicationSection?.items[0]).toBe(
      "No medicines are listed yet. Add them so your care team can review everything you take."
    );
  });

  it("adds a recent blood sugar section with a time-in-range band for a diabetic patient", () => {
    const brief = buildHealthBrief(brentState, { generatedAt: FIXED });
    const section = brief.sections.find((entry) => entry.title === "Recent blood sugar");

    expect(section).toBeDefined();
    expect(section?.status).toBe("patient_reported");
    expect(section?.items.join(" ")).toContain("mg/dL");
    expect(section?.items.join(" ")).toMatch(/in the 70–180 range \(\d+%\)/);
  });

  it("adds a glucose call threshold to the urgency section for a diabetic patient", () => {
    const brief = buildHealthBrief(brentState, { generatedAt: FIXED });
    const urgencySection = brief.sections.find((section) => section.title === "When to call my care team");

    expect(urgencySection?.items.join(" ")).toContain("blood sugar");
    expect(urgencySection?.items.join(" ")).toContain("54");
    expect(urgencySection?.items.join(" ")).toContain("300");
    // The blood-pressure line still stands beside it.
    expect(urgencySection?.items.join(" ")).toContain("blood pressure");
  });

  it("adds a refill-coverage and logged-dose adherence section", () => {
    const brief = buildHealthBrief(brentState, { generatedAt: FIXED });
    const section = brief.sections.find((entry) => entry.title === "Taking my medicines");

    expect(section).toBeDefined();
    expect(section?.items.join(" ")).toContain("% of days covered");
    expect(section?.items.join(" ")).toMatch(/\d+ of \d+ were marked taken/);
    expect(section?.items.join(" ")).toContain("cost");
  });

  it("adds an eye-screening status line for a diabetic patient with a screening gap", () => {
    const brief = buildHealthBrief(brentState, { generatedAt: FIXED });
    expect(brief.sections.map((section) => section.title)).toContain("Eye screening");
  });

  it("surfaces the food-glucose pattern when paired data clears the floors", () => {
    const brief = buildHealthBrief(pairedDiabetesState(), { generatedAt: FIXED });
    const section = brief.sections.find((entry) => entry.title === "Food & blood-sugar pattern");

    expect(section).toBeDefined();
    expect(section?.status).toBe("inferred");
    expect(section?.items.join(" ")).toContain("higher-carb meals");
    expect(section?.items.join(" ")).toContain("minimize-band item");
    expect(section?.items).toHaveLength(2);
    expect(section?.items.join(" ")).toContain("not a diagnosis");
  });

  it("omits diabetes-only sections for a blood-pressure-only patient", () => {
    const sectionTitles = titles(demoState);

    expect(sectionTitles).not.toContain("Recent blood sugar");
    expect(sectionTitles).not.toContain("Food & blood-sugar pattern");
    expect(sectionTitles).not.toContain("Eye screening");
  });
});
