import { describe, expect, it } from "vitest";
import { brentState, demoState } from "@/domain/fixtures";
import { MEAL_DIGEST_SOURCE_ID } from "@/domain/food-week";
import { verifyGrounding } from "@/domain/grounding";
import type { AppState, ScreeningResult } from "@/domain/types";
import { coachCitations, collectSourceFacts } from "./grounding-facts";

function knownSourceIds(state: AppState): Set<string> {
  const ids = new Set<string>();
  ids.add(state.carePlan.id);
  state.carePlan.goals.forEach((goal) => ids.add(goal.id));
  state.medications.forEach((medication) => ids.add(medication.id));
  state.readings.forEach((reading) => ids.add(reading.id));
  state.glucoseReadings.forEach((reading) => ids.add(reading.id));
  state.contextItems.forEach((item) => ids.add(item.id));
  state.extractedFacts.forEach((fact) => ids.add(fact.id));
  state.screeningResults.forEach((result) => ids.add(result.id));
  return ids;
}

const confirmedScreeningResult: ScreeningResult = {
  id: "result-eye-1",
  gapId: "gap-demo-dr",
  outcome: "abnormal",
  grade: "moderate_npdr",
  dmePresent: false,
  source: "photo_report",
  reportRef: "report-moderate-npdr.svg",
  confirmedAt: "2026-07-07T10:00:00.000Z"
};

describe("collectSourceFacts", () => {
  it("emits exactly the known app source ids for brentState", () => {
    const factIds = new Set(collectSourceFacts(brentState).map((fact) => fact.id));
    expect(factIds).toEqual(knownSourceIds(brentState));
  });

  it("emits exactly the known app source ids for demoState", () => {
    const factIds = new Set(collectSourceFacts(demoState).map((fact) => fact.id));
    expect(factIds).toEqual(knownSourceIds(demoState));
  });

  it("carries the care-plan threshold and diabetes context as grounding values", () => {
    const facts = collectSourceFacts(brentState);
    const plan = facts.find((fact) => fact.id === brentState.carePlan.id);
    const context = facts.find((fact) => fact.sourceKind === "context_item");

    expect(plan?.value).toContain("160/100");
    expect(facts.some((fact) => /type 2 diabetes/i.test(fact.value))).toBe(true);
    expect(context).toBeDefined();
  });

  it("grounds a confirmed screening result with the locked copy — the coach repeats, never re-grades", () => {
    const withResult: AppState = { ...demoState, screeningResults: [confirmedScreeningResult] };
    const facts = collectSourceFacts(withResult);
    const screeningFact = facts.find((fact) => fact.id === "result-eye-1");

    expect(screeningFact).toBeDefined();
    expect(screeningFact?.sourceKind).toBe("screening_result");
    expect(screeningFact?.value).toBe(
      "Your report shows changes that need a closer look by an eye doctor. This is common and treatable when caught early."
    );
    expect(screeningFact?.patientConfirmed).toBe(true);
    expect(screeningFact?.effectiveDate).toBe("2026-07-07T10:00:00.000Z");
    expect(new Set(facts.map((fact) => fact.id))).toEqual(knownSourceIds(withResult));
  });

  it("adds the latest screening result to the coach citation set", () => {
    const withResult: AppState = { ...demoState, screeningResults: [confirmedScreeningResult] };
    expect(coachCitations(withResult)).toContain("result-eye-1");
    expect(coachCitations(demoState)).not.toContain("result-eye-1");
  });

  it("marks confirmed facts and medications as patientConfirmed", () => {
    const confirmedState: AppState = {
      ...brentState,
      extractedFacts: brentState.extractedFacts.map((fact, index) =>
        index === 0 ? { ...fact, status: "confirmed" } : fact
      ),
      medications: brentState.medications.map((medication, index) =>
        index === 0 ? { ...medication, source: "confirmed" } : medication
      )
    };

    const facts = collectSourceFacts(confirmedState);
    const confirmedFact = facts.find((fact) => fact.id === confirmedState.extractedFacts[0].id);
    const confirmedMed = facts.find((fact) => fact.id === confirmedState.medications[0].id);

    expect(confirmedFact?.patientConfirmed).toBe(true);
    expect(confirmedMed?.patientConfirmed).toBe(true);
  });

  it("emits and cites the food-only digest only when recent meals clear the floor", () => {
    const now = new Date();
    const recentMeals = brentState.mealLog
      .filter((entry) => entry.compassScore !== undefined)
      .slice(0, 3)
      .map((entry, index) => ({
        ...entry,
        loggedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - index, 12).toISOString()
      }));
    const state = { ...brentState, mealLog: recentMeals };
    const facts = collectSourceFacts(state);
    const digest = facts.find((fact) => fact.id === MEAL_DIGEST_SOURCE_ID);

    expect(digest?.sourceKind).toBe("meal_log");
    expect(digest?.value).not.toMatch(/glucose|blood\s+sugar|blood\s+pressure|\ba1c\b|mg\s*\/?\s*dL/i);
    expect(coachCitations(state)).toContain(MEAL_DIGEST_SOURCE_ID);
    expect(
      verifyGrounding({
        answer: "You logged 3 grouped meals this week.",
        sourceFacts: facts,
        citationIds: [MEAL_DIGEST_SOURCE_ID]
      }).allowed
    ).toBe(true);

    expect(collectSourceFacts({ ...state, mealLog: recentMeals.slice(0, 2) }).map((fact) => fact.id)).not.toContain(
      MEAL_DIGEST_SOURCE_ID
    );
    expect(coachCitations({ ...state, mealLog: [] })).not.toContain(MEAL_DIGEST_SOURCE_ID);
  });
});
