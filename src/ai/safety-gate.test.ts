import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brentState, demoState } from "@/domain/fixtures";
import { safetyStrings, tSafety } from "@/i18n/strings";
import { verifyGrounding } from "@/domain/grounding";
import { collectSourceFacts } from "./grounding-facts";
import { MockHealthAiProvider } from "./mock-provider";
import { CARE_TEAM_ACTIONS, CRISIS_ACTIONS, EMERGENCY_ACTIONS, createSafeAiResponse } from "./safety-gate";
import type { AppState } from "@/domain/types";
import type { HealthAiProvider, HealthAiRequest } from "./types";

const soupFood = {
  id: "food-soup",
  barcode: "051000012616",
  name: "Chicken noodle soup, canned",
  brand: null,
  category: "Canned soup",
  nutrition: {
    servingSize: "1 cup (240 mL)",
    calories: 180,
    sodiumMg: 890,
    potassiumMg: 200,
    totalSugarsG: 3,
    addedSugarsG: 1,
    saturatedFatG: 1.5,
    fiberG: 2,
    proteinG: 9,
    carbsG: 22,
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
  source: "barcode_off" as const,
  ingredientText: null
};

const dangerousReadingAtNow = {
  id: "reading-1",
  patientId: "patient-1",
  systolic: 170,
  diastolic: 104,
  pulse: 76,
  measuredAt: "2026-07-05T12:00:00.000Z",
  contexts: ["morning" as const],
  note: ""
};

const NOW = new Date("2026-07-05T12:00:00.000Z");

const chestPainReading = {
  id: "reading-chest-pain-older",
  patientId: "patient-1",
  systolic: 128,
  diastolic: 82,
  pulse: 72,
  measuredAt: "2026-07-05T10:30:00.000Z",
  contexts: ["morning" as const],
  note: "I had chest pain for 5 minutes."
};

const thresholdReading = {
  id: "reading-threshold-later",
  patientId: "patient-1",
  systolic: 165,
  diastolic: 102,
  pulse: 70,
  measuredAt: "2026-07-05T11:00:00.000Z",
  contexts: ["morning" as const],
  note: ""
};

describe("createSafeAiResponse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("escalates when a recent stored glucose reading is a severe low, before calling the provider", async () => {
    const stateWithLowGlucose: AppState = {
      ...demoState,
      glucoseReadings: [
        {
          id: "g-low",
          patientId: "patient-1",
          valueMgDl: 45,
          measuredAt: "2026-07-05T12:00:00.000Z",
          contexts: ["morning"],
          note: ""
        }
      ]
    };
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({ content: "should not be called", safety: "allowed" as const, sources: ["plan-1"] })
    };

    const response = await createSafeAiResponse(
      { mode: "explain", patientInput: "how do I keep my blood sugar under control", state: stateWithLowGlucose },
      provider
    );

    expect(response.safety).toBe("escalate");
    expect(response.sources).toContain("g-low");
    expect(response.content).toContain("very low");
    expect(provider.respond).not.toHaveBeenCalled();
  });

  it("blocks unsafe medication change requests before provider call", async () => {
    const response = await createSafeAiResponse(
      {
        mode: "trouble",
        patientInput: "Should I stop taking lisinopril?",
        state: demoState
      },
      new MockHealthAiProvider()
    );

    expect(response.safety).toBe("blocked");
    expect(response.banner).toContain("I cannot tell you to stop");
    expect(response.actions).toContain("call_clinic");
    expect(response.content.length).toBeGreaterThan(0);
  });

  it("escalates for dangerous state reading even when patient input is blocked", async () => {
    const stateWithDangerousReading: AppState = {
      ...demoState,
      readings: [
        {
          id: "reading-1",
          patientId: "patient-1",
          systolic: 170,
          diastolic: 104,
          pulse: 76,
          measuredAt: "2026-07-05T12:00:00.000Z",
          contexts: ["morning"],
          note: "Morning check."
        }
      ]
    };
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({
        content: "This should not be called.",
        safety: "allowed" as const,
        sources: ["plan-1"]
      })
    };

    const response = await createSafeAiResponse(
      {
        mode: "trouble",
        patientInput: "Should I stop taking lisinopril?",
        state: stateWithDangerousReading
      },
      provider
    );

    expect(response.safety).toBe("escalate");
    expect(response.banner).toContain("call threshold");
    expect(response.actions).toContain("call_clinic");
    expect(provider.respond).toHaveBeenCalledTimes(1);
  });

  it("allows education requests through the provider", async () => {
    const response = await createSafeAiResponse(
      {
        mode: "why",
        patientInput: "Why am I taking lisinopril?",
        state: demoState
      },
      new MockHealthAiProvider()
    );

    expect(response.safety).toBe("allowed");
    expect(response.content).toContain("Lisinopril");
  });

  it("escalates on dangerous latest reading even with normal patient input", async () => {
    const stateWithDangerousReading: AppState = {
      ...demoState,
      readings: [
        {
          id: "reading-1",
          patientId: "patient-1",
          systolic: 170,
          diastolic: 104,
          pulse: 76,
          measuredAt: "2026-07-05T12:00:00.000Z",
          contexts: ["morning"],
          note: "Morning check."
        }
      ]
    };
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({
        content: "This should not be called.",
        safety: "allowed" as const,
        sources: ["plan-1"]
      })
    };

    const response = await createSafeAiResponse(
      {
        mode: "today",
        patientInput: "What should I do today?",
        state: stateWithDangerousReading
      },
      provider
    );

    expect(response.safety).toBe("escalate");
    expect(response.banner).toContain("call threshold");
    expect(response.banner).toContain("If you are feeling worse");
    expect(response.actions).toContain("call_clinic");
    expect(provider.respond).toHaveBeenCalledTimes(1);
  });

  it("escalates on very low recent reading before provider call", async () => {
    const stateWithLowReading: AppState = {
      ...demoState,
      readings: [
        {
          id: "reading-low",
          patientId: "patient-1",
          systolic: 82,
          diastolic: 50,
          pulse: 62,
          measuredAt: "2026-07-05T12:00:00.000Z",
          contexts: ["morning"],
          note: "Feeling weak."
        }
      ]
    };
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({
        content: "This should not be called.",
        safety: "allowed" as const,
        sources: ["plan-1"]
      })
    };

    const response = await createSafeAiResponse(
      {
        mode: "today",
        patientInput: "What should I do today?",
        state: stateWithLowReading
      },
      provider
    );

    expect(response.safety).toBe("escalate");
    expect(response.content).toContain("seek urgent help now");
    expect(response.sources).toContain("reading-low");
    expect(provider.respond).not.toHaveBeenCalled();
  });


  it("escalates on earlier dangerous reading when a later normal reading exists", async () => {
    const stateWithEarlierDangerousReading: AppState = {
      ...demoState,
      readings: [
        {
          id: "reading-latest",
          patientId: "patient-1",
          systolic: 128,
          diastolic: 82,
          pulse: 72,
          measuredAt: "2026-07-05T11:00:00.000Z",
          contexts: ["morning"],
          note: "Feeling okay now."
        },
        {
          id: "reading-earlier",
          patientId: "patient-1",
          systolic: 170,
          diastolic: 104,
          pulse: 76,
          measuredAt: "2026-07-05T10:00:00.000Z",
          contexts: ["morning"],
          note: "Morning check."
        }
      ]
    };
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({
        content: "This should not be called.",
        safety: "allowed" as const,
        sources: ["plan-1"]
      })
    };

    const response = await createSafeAiResponse(
      {
        mode: "today",
        patientInput: "What should I do?",
        state: stateWithEarlierDangerousReading
      },
      provider
    );

    expect(response.safety).toBe("escalate");
    expect(response.banner).toContain("call threshold");
    expect(response.banner).toContain("If you are feeling worse");
    expect(response.actions).toContain("call_clinic");
    expect(provider.respond).toHaveBeenCalledTimes(1);
  });

  it("does not escalate from stale urgent or blocked readings outside the 24-hour real-time window", async () => {
    const stateWithStaleReadings: AppState = {
      ...demoState,
      readings: [
        {
          id: "reading-stale-blocked",
          patientId: "patient-1",
          systolic: 120,
          diastolic: 80,
          pulse: 74,
          measuredAt: "2026-07-03T09:00:00.000Z",
          contexts: ["morning"],
          note: "Should I increase my dose?"
        },
        {
          id: "reading-stale-danger",
          patientId: "patient-1",
          systolic: 170,
          diastolic: 104,
          pulse: 76,
          measuredAt: "2026-07-03T10:00:00.000Z",
          contexts: ["morning"],
          note: "Morning check."
        },
        {
          id: "reading-current-safe",
          patientId: "patient-1",
          systolic: 128,
          diastolic: 82,
          pulse: 72,
          measuredAt: "2026-07-05T10:00:00.000Z",
          contexts: ["morning"],
          note: "Feeling okay now."
        }
      ]
    };
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({
        content: "I can help you plan your next check-in.",
        safety: "allowed" as const,
        sources: []
      })
    };

    const response = await createSafeAiResponse(
      {
        mode: "today",
        patientInput: "What should I do today?",
        state: stateWithStaleReadings
      },
      provider
    );

    expect(response.safety).toBe("allowed");
    expect(response.content).toContain("next check-in");
    expect(provider.respond).toHaveBeenCalledTimes(1);
  });

  it("escalates when an older dangerous reading exists and a newer blocked note is newer", async () => {
    const stateWithBlockedLatestAndEarlierDanger: AppState = {
      ...demoState,
      readings: [
        {
          id: "reading-latest",
          patientId: "patient-1",
          systolic: 120,
          diastolic: 80,
          pulse: 74,
          measuredAt: "2026-07-05T11:00:00.000Z",
          contexts: ["morning"],
          note: "Should I increase my dose?"
        },
        {
          id: "reading-earlier-danger",
          patientId: "patient-1",
          systolic: 170,
          diastolic: 104,
          pulse: 76,
          measuredAt: "2026-07-05T10:00:00.000Z",
          contexts: ["morning"],
          note: "Morning check."
        }
      ]
    };
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({
        content: "This should not be called.",
        safety: "allowed" as const,
        sources: ["plan-1"]
      })
    };

    const response = await createSafeAiResponse(
      {
        mode: "today",
        patientInput: "What should I do today?",
        state: stateWithBlockedLatestAndEarlierDanger
      },
      provider
    );

    expect(response.safety).toBe("escalate");
    expect(response.banner).toContain("call threshold");
    expect(response.sources).toContain("reading-earlier-danger");
    expect(response.sources).toContain("plan-1");
    expect(provider.respond).toHaveBeenCalledTimes(1);
  });

  it("escalates on an older chest-pain reading when a newer threshold reading exists", async () => {
    const stateWithOlderSymptomAndNewerThreshold: AppState = {
      ...demoState,
      readings: [thresholdReading, chestPainReading]
    };
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({
        content: "This should not be called.",
        safety: "allowed" as const,
        sources: ["plan-1"]
      })
    };

    const response = await createSafeAiResponse(
      {
        mode: "today",
        patientInput: "What should I do today?",
        state: stateWithOlderSymptomAndNewerThreshold
      },
      provider
    );

    expect(response.safety).toBe("escalate");
    expect(response.content).toContain("Some signs need urgent medical attention");
    expect(response.sources).toContain("reading-chest-pain-older");
    expect(response.sources).not.toContain("reading-threshold-later");
    expect(response.sources).not.toContain("plan-1");
    expect(provider.respond).not.toHaveBeenCalled();
  });

  it("blocks earlier blocked reading classification when later reading is normal", async () => {
    const stateWithBlockedEarlierReading: AppState = {
      ...demoState,
      readings: [
        {
          id: "reading-latest",
          patientId: "patient-1",
          systolic: 128,
          diastolic: 82,
          pulse: 72,
          measuredAt: "2026-07-05T11:00:00.000Z",
          contexts: ["morning"],
          note: "Feeling okay now."
        },
        {
          id: "reading-blocked-previous",
          patientId: "patient-1",
          systolic: 120,
          diastolic: 80,
          pulse: 74,
          measuredAt: "2026-07-05T10:00:00.000Z",
          contexts: ["morning"],
          note: "Should I increase my dose?"
        }
      ]
    };
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({
        content: "This should not be called.",
        safety: "allowed" as const,
        sources: ["plan-1"]
      })
    };

    const response = await createSafeAiResponse(
      {
        mode: "today",
        patientInput: "What is my blood pressure target?",
        state: stateWithBlockedEarlierReading
      },
      provider
    );

    expect(response.safety).toBe("blocked");
    expect(response.banner).toContain("I cannot tell you to stop");
    expect(response.sources).toContain("reading-blocked-previous");
    expect(provider.respond).toHaveBeenCalledTimes(1);
  });

  it("allows education when a side effects barrier exists but the current question is safe", async () => {
    const stateWithSideEffects: AppState = {
      ...demoState,
      medications: [
        {
          ...demoState.medications[0],
          activeBarriers: ["side_effects"]
        }
      ]
    };
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({
        content: "This should not be called.",
        safety: "allowed" as const,
        sources: ["plan-1"]
      })
    };

    const response = await createSafeAiResponse(
      {
        mode: "why",
        patientInput: "Can you explain why I'm taking lisinopril?",
        state: stateWithSideEffects
      },
      provider
    );

    expect(response.safety).toBe("allowed");
    expect(response.content).toBe("This should not be called.");
    expect(provider.respond).toHaveBeenCalledTimes(1);
  });

  it("escalates when an active side effects barrier and current symptom concern are present", async () => {
    const stateWithSideEffects: AppState = {
      ...demoState,
      medications: [
        {
          ...demoState.medications[0],
          activeBarriers: ["side_effects"]
        }
      ]
    };
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({
        content: "This should not be called.",
        safety: "allowed" as const,
        sources: ["plan-1"]
      })
    };

    const response = await createSafeAiResponse(
      {
        mode: "trouble",
        patientInput: "This medicine made me feel dizzy.",
        state: stateWithSideEffects
      },
      provider
    );

    expect(response.safety).toBe("escalate");
    expect(response.content).toContain("active side effects");
    expect(response.content).toContain("contact your care team");
    expect(provider.respond).not.toHaveBeenCalled();
  });

  it("lets urgent symptom escalation win over side-effect medication barriers", async () => {
    const stateWithSideEffects: AppState = {
      ...demoState,
      medications: [
        {
          ...demoState.medications[0],
          activeBarriers: ["side_effects"]
        }
      ]
    };
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({
        content: "This should not be called.",
        safety: "allowed" as const,
        sources: ["plan-1"]
      })
    };

    const response = await createSafeAiResponse(
      {
        mode: "trouble",
        patientInput: "I have chest pain",
        state: stateWithSideEffects
      },
      provider
    );

    expect(response.safety).toBe("escalate");
    expect(response.content).toContain("Some signs need urgent medical attention");
    expect(response.content).not.toContain("active side effects");
    expect(provider.respond).not.toHaveBeenCalled();
  });

  it("answers the question with a banner instead of a broken record when a fresh high reading exists", async () => {
    const stateWithFreshHighReading: AppState = {
      ...demoState,
      readings: [
        {
          id: "reading-high",
          patientId: "patient-1",
          systolic: 162,
          diastolic: 101,
          pulse: 78,
          measuredAt: "2026-07-05T11:30:00.000Z",
          contexts: ["morning"],
          note: ""
        }
      ]
    };

    const response = await createSafeAiResponse(
      {
        mode: "explain",
        patientInput: "why do I have to take this if I feel fine?",
        state: stateWithFreshHighReading
      },
      new MockHealthAiProvider()
    );

    expect(response.safety).toBe("escalate");
    expect(response.banner).toContain("call threshold");
    expect(response.actions).toEqual(expect.arrayContaining(["call_clinic", "draft_message"]));
    // The medicine question is still answered (default "explain" is inferred to "why").
    expect(response.content).toContain("Lisinopril");
  });

  it("blocks pause-for-a-week phrasing and still offers care-team actions", async () => {
    const response = await createSafeAiResponse(
      {
        mode: "explain",
        patientInput: "the cough is annoying, can I just stop the lisinopril for a week?",
        state: demoState
      },
      new MockHealthAiProvider()
    );

    expect(response.safety).toBe("blocked");
    expect(response.banner).toContain("I cannot tell you to stop");
    expect(response.actions).toContain("call_clinic");
  });

  it("routes a self-harm disclosure to the crisis tier ahead of a dangerous stored reading", async () => {
    const state: AppState = { ...demoState, readings: [dangerousReadingAtNow] };
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({
        content: "This should not be called.",
        safety: "allowed" as const,
        sources: ["plan-1"]
      })
    };

    const response = await createSafeAiResponse(
      { mode: "trouble", patientInput: "I want to die", state },
      provider
    );

    expect(response.safety).toBe("crisis");
    expect(response.content).toBe(tSafety("en", "crisisResponse"));
    expect(response.actions).toEqual(CRISIS_ACTIONS);
    expect(response.sources).toEqual([]);
    expect(provider.respond).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "reported child ideation",
      input: "my son says he wants to die",
      expectedSafety: "crisis" as const,
      expectedAction: "crisis_call_988" as const
    },
    {
      label: "caregiver collapse",
      input: "I can't do this anymore, I want to give up",
      expectedSafety: "crisis" as const,
      expectedAction: "crisis_call_988" as const
    },
    {
      label: "missing child",
      input: "my kid ran away from home and we can't find her",
      expectedSafety: "escalate" as const,
      expectedAction: "call_emergency" as const
    }
  ])("short-circuits the provider for $label", async ({ input, expectedSafety, expectedAction }) => {
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({ content: "unused", safety: "allowed" as const, sources: [] })
    };

    const response = await createSafeAiResponse({ mode: "trouble", patientInput: input, state: demoState }, provider);

    expect(response.safety).toBe(expectedSafety);
    expect(response.actions).toContain(expectedAction);
    expect(provider.respond).not.toHaveBeenCalled();
  });

  it("routes an abuse disclosure to people with existing crisis and care-team actions", async () => {
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({ content: "unused", safety: "allowed" as const, sources: [] })
    };

    const response = await createSafeAiResponse(
      { mode: "trouble", patientInput: "someone is hurting my child", state: demoState },
      provider
    );

    expect(response.safety).toBe("crisis");
    expect(response.content).toBe(safetyStrings.en.abuseResponse);
    expect(response.actions).toEqual(
      expect.arrayContaining(["crisis_call_988", "call_emergency", "call_clinic", "draft_message"])
    );
    expect(provider.respond).not.toHaveBeenCalled();
  });

  it("routes a harm-to-others disclosure to the emergency-department copy without calling the provider", async () => {
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({ content: "unused", safety: "allowed" as const, sources: [] })
    };

    const response = await createSafeAiResponse(
      { mode: "trouble", patientInput: "He has been harmful towards animals", state: demoState },
      provider
    );

    expect(response.safety).toBe("crisis");
    expect(response.content).toBe(safetyStrings.en.harmToOthersResponse);
    expect(response.content).toContain("911");
    expect(response.content).toContain("emergency department");
    expect(response.content).toContain("988");
    expect(response.actions).toEqual(
      expect.arrayContaining(["crisis_call_988", "call_emergency", "call_clinic", "draft_message"])
    );
    expect(provider.respond).not.toHaveBeenCalled();
  });

  it("renders the harm-to-others copy in Spanish for a Spanish speaker", async () => {
    const state: AppState = {
      ...demoState,
      patient: { ...demoState.patient, language: "es" }
    };

    const response = await createSafeAiResponse(
      { mode: "trouble", patientInput: "mi hijo lastima a los animales cuando se enoja", state },
      new MockHealthAiProvider()
    );

    expect(response.safety).toBe("crisis");
    expect(response.content).toBe(safetyStrings.es.harmToOthersResponse);
  });

  it("renders the abuse human-routing copy correctly for a Spanish speaker", async () => {
    const state: AppState = {
      ...demoState,
      patient: { ...demoState.patient, language: "es" }
    };

    const response = await createSafeAiResponse(
      { mode: "trouble", patientInput: "someone is hurting my child", state },
      new MockHealthAiProvider()
    );

    expect(response.content).toBe(safetyStrings.es.abuseResponse);
    expect(response.content).toContain("est\u00e1");
    expect(response.content).toContain("Tambi\u00e9n");
  });

  it("returns the Spanish crisis constant for a Spanish speaker", async () => {
    const state: AppState = {
      ...demoState,
      patient: { ...demoState.patient, language: "es" }
    };

    const response = await createSafeAiResponse(
      { mode: "trouble", patientInput: "no quiero estar aquí, I don't want to be here", state },
      new MockHealthAiProvider()
    );

    expect(response.safety).toBe("crisis");
    expect(response.content).toBe(tSafety("es", "crisisResponse"));
  });

  it("does not let a co-mingled clinical question bury the crisis response", async () => {
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({
        content: "Your blood pressure target is under 130/80.",
        safety: "allowed" as const,
        sources: ["plan-1"]
      })
    };

    const response = await createSafeAiResponse(
      { mode: "ask", patientInput: "I don't want to be here, also what is my BP?", state: demoState },
      provider
    );

    expect(response.safety).toBe("crisis");
    expect(response.content).toBe(tSafety("en", "crisisResponse"));
    expect(provider.respond).not.toHaveBeenCalled();
  });

  it("does not escalate negated self-harm phrasing to a crisis", async () => {
    const response = await createSafeAiResponse(
      {
        mode: "explain",
        patientInput: "I would never hurt myself, I just want to understand my plan",
        state: demoState
      },
      new MockHealthAiProvider()
    );

    expect(response.safety).toBe("allowed");
  });

  it("gives urgent symptoms an emergency-tier answer with a call 911 action", async () => {
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({
        content: "This should not be called.",
        safety: "allowed" as const,
        sources: ["plan-1"]
      })
    };

    const response = await createSafeAiResponse(
      { mode: "trouble", patientInput: "I have chest pain", state: demoState },
      provider
    );

    expect(response.safety).toBe("escalate");
    expect(response.actions).toEqual(EMERGENCY_ACTIONS);
    expect(response.actions).toContain("call_emergency");
    expect(provider.respond).not.toHaveBeenCalled();
  });

  it("escalates sudden vision loss to the emergency tier with a 911 action", async () => {
    const response = await createSafeAiResponse(
      { mode: "trouble", patientInput: "I suddenly cannot see out of my left eye", state: demoState },
      new MockHealthAiProvider()
    );

    expect(response.safety).toBe("escalate");
    expect(response.actions).toContain("call_emergency");
  });

  it("answers a diabetic-retinopathy education question from the knowledge base, not the model", async () => {
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({ content: "should not be called", safety: "allowed" as const, sources: [] })
    };

    const response = await createSafeAiResponse(
      { mode: "explain", patientInput: "what is diabetic retinopathy?", state: demoState },
      provider
    );

    expect(response.safety).toBe("allowed");
    expect(response.content).toContain("eye damage from diabetes");
    expect(response.content).toContain("Not a diagnosis");
    expect(provider.respond).not.toHaveBeenCalled();
  });

  it("escalates a plain-language acute eye symptom instead of answering it as education", async () => {
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({ content: "should not be called", safety: "allowed" as const, sources: [] })
    };

    const response = await createSafeAiResponse(
      { mode: "explain", patientInput: "I think I am losing my sight", state: demoState },
      provider
    );

    expect(response.safety).toBe("escalate");
    expect(response.actions).toContain("call_emergency");
    expect(response.content).not.toContain("eye damage from diabetes");
    expect(provider.respond).not.toHaveBeenCalled();
  });

  it("escalates a material emergency with 911/211 guidance and emergency actions", async () => {
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({ content: "unused", safety: "allowed" as const, sources: [] })
    };

    const response = await createSafeAiResponse(
      { mode: "trouble", patientInput: "I have no food today and the kids are hungry", state: demoState },
      provider
    );

    expect(response.safety).toBe("escalate");
    expect(response.content).toContain("911");
    expect(response.content).toContain("211");
    expect(response.actions).toContain("call_emergency");
    expect(provider.respond).not.toHaveBeenCalled();
  });

  it("keeps a side-effect escalation on the care-team tier", async () => {
    const stateWithSideEffects: AppState = {
      ...demoState,
      medications: [{ ...demoState.medications[0], activeBarriers: ["side_effects"] }]
    };

    const response = await createSafeAiResponse(
      { mode: "trouble", patientInput: "this medicine made me feel dizzy", state: stateWithSideEffects },
      new MockHealthAiProvider()
    );

    expect(response.safety).toBe("escalate");
    expect(response.actions).toEqual(["call_clinic", "draft_message"]);
    expect(response.actions).not.toContain("call_emergency");
  });

  it("replaces an ungrounded model answer with a localized care-team fallback", async () => {
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({
        content: "Your A1C is 9.9 now, so you should increase your dose.",
        safety: "allowed" as const,
        sources: []
      })
    };

    const response = await createSafeAiResponse(
      { mode: "ask", patientInput: "what do my numbers mean?", state: demoState },
      provider
    );

    expect(response.safety).toBe("blocked");
    expect(response.content).toBe(tSafety("en", "groundingFallback"));
    expect(response.banner).toBe(tSafety("en", "groundingFallbackBanner"));
    expect(response.actions).toEqual(CARE_TEAM_ACTIONS);
    expect(response.sources).toEqual([]);
    expect(response.grounding?.allowed).toBe(false);
  });

  it("runs grounding on the soft-block path too", async () => {
    const stateWithBlockedNote: AppState = {
      ...demoState,
      readings: [
        {
          id: "reading-note-block",
          patientId: "patient-1",
          systolic: 128,
          diastolic: 82,
          pulse: 72,
          measuredAt: "2026-07-05T11:00:00.000Z",
          contexts: ["morning"],
          note: "Should I increase my dose?"
        }
      ]
    };
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({
        content: "Your A1C is 9.9 now.",
        safety: "allowed" as const,
        sources: []
      })
    };

    const response = await createSafeAiResponse(
      { mode: "ask", patientInput: "what is my target?", state: stateWithBlockedNote },
      provider
    );

    expect(response.content).toBe(tSafety("en", "groundingFallback"));
    expect(response.grounding?.allowed).toBe(false);
  });
});

describe("grounding leaves every mock canned answer intact", () => {
  const scenarios: Array<{ label: string; request: (state: AppState) => HealthAiRequest }> = [
    { label: "why (named medication)", request: (state) => ({ mode: "why", patientInput: "why do I take lisinopril?", state }) },
    { label: "why (unspecified across meds)", request: (state) => ({ mode: "why", patientInput: "why do I take my medicines?", state }) },
    { label: "visit prep", request: (state) => ({ mode: "visit", patientInput: "help me prepare for my visit", state }) },
    { label: "default explain", request: (state) => ({ mode: "explain", patientInput: "what can you help me with?", state }) },
    {
      label: "food with sodium trend",
      request: (state) => ({ mode: "food", patientInput: "is this okay?", state, identifiedFood: soupFood })
    },
    {
      label: "eye report ask (no confirmed report yet)",
      request: (state) => ({ mode: "ask", patientInput: "what did my eye report say?", state })
    }
  ];

  for (const fixture of [{ name: "demoState", state: demoState }, { name: "brentState", state: brentState }]) {
    for (const scenario of scenarios) {
      it(`passes ${fixture.name} × ${scenario.label}`, async () => {
        const provider = new MockHealthAiProvider();
        const response = await provider.respond(scenario.request(fixture.state));
        const result = verifyGrounding({
          answer: response.content,
          sourceFacts: collectSourceFacts(fixture.state),
          citationIds: response.sources
        });

        expect(result.allowed).toBe(true);
      });
    }
  }

  it("passes a screening-grounded eye-report answer end to end, citing the confirmed result", async () => {
    const withResult: AppState = {
      ...brentState,
      screeningResults: [
        {
          id: "result-eye-brent",
          gapId: "gap-brent-dr",
          outcome: "abnormal",
          grade: "moderate_npdr",
          dmePresent: false,
          source: "photo_report",
          reportRef: "report-moderate-npdr.svg",
          confirmedAt: "2026-07-07T10:00:00.000Z"
        }
      ]
    };

    const provider = new MockHealthAiProvider();
    const response = await provider.respond({ mode: "ask", patientInput: "what did my eye report say?", state: withResult });
    expect(response.sources).toEqual(["result-eye-brent"]);

    const result = verifyGrounding({
      answer: response.content,
      sourceFacts: collectSourceFacts(withResult),
      citationIds: response.sources
    });
    expect(result.allowed).toBe(true);

    // The full gate keeps the grounded answer intact end to end.
    const gated = await createSafeAiResponse(
      { mode: "ask", patientInput: "what did my eye report say?", state: withResult },
      provider
    );
    expect(gated.safety).toBe("allowed");
    expect(gated.content).toContain("Your report from");
    expect(gated.content).toContain("closer look by an eye doctor");
  });
});
