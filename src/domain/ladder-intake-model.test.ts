import { beforeEach, describe, expect, it } from "vitest";
import { demoState } from "@/domain/fixtures";
import { schoolAgeFamilyState } from "@/domain/family-fixtures";
import { extractFamilyInterviewMock } from "@/domain/family-interview";
import { runFamilyVignette } from "@/domain/family-vignette-runner";
import { FAMILY_VIGNETTES } from "@/domain/family-vignettes.corpus";
import type { AppState, FamilyFact, FamilyInterview, FamilyNavigatorState } from "@/domain/types";
import { buildDataExport } from "@/state/data-export";
import { loadStoredStateResult, saveStoredState } from "@/state/storage";
import { healthReducer } from "@/state/store";

const NOW = new Date("2026-08-08T12:00:00.000Z");

function emptyJourney(profile: NonNullable<FamilyNavigatorState["profile"]>): FamilyNavigatorState {
  return {
    ...schoolAgeFamilyState,
    profile,
    profileProvenance: "stated",
    interviews: [],
    facts: [],
    latestInterviewDomains: [],
    activeDomains: [],
    screenAnswers: [],
    recommendations: null,
    interviewDraft: ""
  };
}

function modelFacts(
  vignetteId: string,
  facts: ReturnType<typeof extractFamilyInterviewMock>["facts"]
): FamilyFact[] {
  return facts.map((fact, index) => ({
    id: `model-fact-${vignetteId}-${index}`,
    ...fact,
    status: "patient_reported"
  }));
}

beforeEach(() => localStorage.clear());

describe("Ladder intake state model", () => {
  it("changes list preferences without changing clinical or caregiver evidence", () => {
    const state: AppState = { ...demoState, family: schoolAgeFamilyState };
    const next = healthReducer(state, {
      type: "setFamilyResourcePreferences",
      preferences: { scope: "local_first", contact: "call_first" }
    });

    expect(next.family?.resourcePreferences).toEqual({
      scope: "local_first",
      contact: "call_first"
    });
    expect(next.family?.profile).toEqual(state.family?.profile);
    expect(next.family?.facts).toEqual(state.family?.facts);
    expect(next.family?.activeDomains).toEqual(state.family?.activeDomains);
    expect(next.family?.safetyEvents).toEqual(state.family?.safetyEvents);
  });

  it.each(FAMILY_VIGNETTES.map((vignette) => [vignette.id, vignette] as const))(
    "keeps extraction, reducer, persistence, and export invariants for %s",
    (id, vignette) => {
      const extracted = extractFamilyInterviewMock(
        vignette.text,
        vignette.profile,
        NOW,
        vignette.language
      );
      const outcome = runFamilyVignette(vignette, NOW);
      const startingDiagnoses = vignette.profile.diagnoses;
      let state: AppState = {
        ...demoState,
        patient: { ...demoState.patient, language: vignette.language },
        family: emptyJourney(vignette.profile)
      };
      state = healthReducer(state, { type: "setFamilyInterviewDraft", draft: vignette.text });

      if (outcome.safetyBanner) {
        state = healthReducer(state, {
          type: "recordFamilySafetyTurn",
          domains: outcome.domains
        });
      } else {
        const interview: FamilyInterview = {
          id: `model-interview-${id}`,
          rawText: vignette.text,
          source: "typed",
          extraction: "mock",
          kind: "orientation",
          createdAt: NOW.toISOString()
        };
        state = healthReducer(state, {
          type: "addFamilyInterview",
          interview,
          facts: modelFacts(id, extracted.facts),
          domains: outcome.domains
        });
      }

      expect(state.family?.interviewDraft).toBe("");
      expect(state.family?.profile?.diagnoses).toEqual(startingDiagnoses);
      for (const fact of state.family?.facts ?? []) {
        expect(vignette.text).toContain(fact.sourceSnippet);
      }

      expect(saveStoredState(state)).toBe(true);
      const reloaded = loadStoredStateResult();
      expect(reloaded.status).toBe("loaded");
      const exported = buildDataExport(reloaded.state, NOW);
      const interviewIds = new Set(exported.state.family?.interviews.map(({ id }) => id));
      for (const fact of exported.state.family?.facts ?? []) {
        expect(fact.interviewId === undefined || interviewIds.has(fact.interviewId)).toBe(true);
      }
      expect(exported.state.family).toMatchObject({
        referral: null,
        appointments: [],
        soonerList: null
      });

      if (outcome.safetyBanner) {
        expect(exported.state.family?.interviews).toEqual([]);
        expect(exported.state.family?.facts).toEqual([]);
        expect(JSON.stringify(exported)).not.toContain(vignette.text);
      } else {
        expect(exported.state.family?.interviews[0]?.rawText).toBe(vignette.text);
      }
    }
  );

  it("unions longitudinal check-in domains, deduplicates observations, and reloads idempotently", () => {
    const profile = schoolAgeFamilyState.profile!;
    const firstText = "Reading homework is hard every night.";
    const checkinText = "Reading homework is hard every night. I also need a ride to therapy.";
    const firstExtraction = extractFamilyInterviewMock(firstText, profile, NOW);
    const checkinExtraction = extractFamilyInterviewMock(checkinText, profile, NOW);
    let state: AppState = { ...demoState, family: emptyJourney(profile) };

    state = healthReducer(state, {
      type: "addFamilyInterview",
      interview: {
        id: "model-orientation",
        rawText: firstText,
        source: "typed",
        extraction: "mock",
        kind: "orientation",
        createdAt: "2026-07-08T12:00:00.000Z"
      },
      facts: modelFacts("orientation", firstExtraction.facts),
      domains: firstExtraction.domains.map(({ domain }) => domain)
    });
    const factsAfterOrientation = state.family?.facts.length ?? 0;
    state = healthReducer(state, {
      type: "addFamilyInterview",
      interview: {
        id: "model-checkin",
        rawText: checkinText,
        source: "typed",
        extraction: "mock",
        kind: "checkin",
        createdAt: NOW.toISOString()
      },
      facts: modelFacts("checkin", checkinExtraction.facts),
      domains: checkinExtraction.domains.map(({ domain }) => domain)
    });

    expect(state.family?.activeDomains).toEqual(expect.arrayContaining(["school_iep", "transportation"]));
    expect(state.family?.facts).toHaveLength(factsAfterOrientation);
    expect(new Set(state.family?.facts.map(({ sourceSnippet }) => sourceSnippet)).size).toBe(
      state.family?.facts.length
    );

    saveStoredState(state);
    const firstLoad = loadStoredStateResult();
    const firstRecord = localStorage.getItem("home-health-ai-ownership-state");
    const secondLoad = loadStoredStateResult();
    expect(secondLoad.state).toEqual(firstLoad.state);
    expect(localStorage.getItem("home-health-ai-ownership-state")).toBe(firstRecord);
  });
});
