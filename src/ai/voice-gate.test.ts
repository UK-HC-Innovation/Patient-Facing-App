import { describe, expect, it } from "vitest";
import { demoState } from "@/domain/fixtures";
import { tSafety } from "@/i18n/strings";
import {
  CARE_TEAM_ACTIONS,
  CRISIS_ACTIONS,
  EMERGENCY_ACTIONS,
  POISON_CONTROL_ACTIONS
} from "./safety-gate";
import { evaluateVoiceTranscript } from "./voice-gate";

describe("evaluateVoiceTranscript", () => {
  it("intercepts a self-harm disclosure to the crisis tier", () => {
    const decision = evaluateVoiceTranscript("I want to die", demoState, "en");

    expect(decision).toEqual({
      kind: "intercept",
      safety: "crisis",
      content: tSafety("en", "crisisResponse"),
      actions: CRISIS_ACTIONS
    });
  });

  it("intercepts a spoken word-form dangerous reading to the emergency tier", () => {
    const decision = evaluateVoiceTranscript("my pressure is one eighty over one twenty", demoState, "en");

    expect(decision.kind).toBe("intercept");
    if (decision.kind === "intercept") {
      expect(decision.safety).toBe("escalate");
      expect(decision.actions).toEqual(EMERGENCY_ACTIONS);
    }
  });

  it("intercepts a digit 'over' dangerous reading", () => {
    const decision = evaluateVoiceTranscript("it says 200 over 130", demoState, "en");

    expect(decision.kind).toBe("intercept");
    if (decision.kind === "intercept") {
      expect(decision.safety).toBe("escalate");
    }
  });

  it("soft-blocks a spoken medication-change request", () => {
    const decision = evaluateVoiceTranscript("should I stop taking my metformin?", demoState, "en");

    expect(decision.kind).toBe("intercept");
    if (decision.kind === "intercept") {
      expect(decision.safety).toBe("blocked");
      expect(decision.actions).toEqual(CARE_TEAM_ACTIONS);
    }
  });

  it("passes a routine food question", () => {
    expect(evaluateVoiceTranscript("is this soup okay for me?", demoState, "en")).toEqual({ kind: "pass" });
  });

  it("passes negated self-harm phrasing", () => {
    expect(evaluateVoiceTranscript("I would never hurt myself", demoState, "en")).toEqual({ kind: "pass" });
  });
});

// Spec 29 P1, from the 2026-09-06 Food Lens critique. Every phrase below was
// typed into the food lens and scored as a food name.
describe("evaluateVoiceTranscript — appetite hopelessness (critique H1)", () => {
  const interceptPhrases: Array<[string, "en" | "es"]> = [
    ["I don't want to eat anymore, what's the point", "en"],
    ["there is no point in eating", "en"],
    ["why bother eating", "en"],
    ["I stopped eating", "en"],
    ["what's the point", "en"],
    ["ya no quiero comer más, para qué", "es"],
    ["ya no vale la pena", "es"]
  ];

  it.each(interceptPhrases)("intercepts %s to the crisis tier", (phrase, language) => {
    const decision = evaluateVoiceTranscript(phrase, demoState, language);

    expect(decision).toEqual({
      kind: "intercept",
      safety: "crisis",
      content: tSafety(language, "crisisResponse"),
      actions: CRISIS_ACTIONS
    });
  });

  it("passes an ordinary food preference", () => {
    expect(evaluateVoiceTranscript("I don't want to eat cereal again", demoState, "en")).toEqual({
      kind: "pass"
    });
  });

  it("passes a label question that uses the same words", () => {
    expect(
      evaluateVoiceTranscript("what's the point of the carb count on this label", demoState, "en")
    ).toEqual({ kind: "pass" });
  });

  it("passes a Spanish food preference", () => {
    expect(evaluateVoiceTranscript("No quiero comer más pan, me llena mucho", demoState, "es")).toEqual({
      kind: "pass"
    });
  });
});

describe("evaluateVoiceTranscript — child ingestion (critique H4)", () => {
  it("answers with Poison Control, not a food score", () => {
    const decision = evaluateVoiceTranscript("my kid ate a whole bag of these", demoState, "en");

    expect(decision).toEqual({
      kind: "intercept",
      safety: "escalate",
      content: tSafety("en", "childIngestionResponse"),
      banner: tSafety("en", "voiceInterceptNotice"),
      actions: POISON_CONTROL_ACTIONS
    });
    expect(POISON_CONTROL_ACTIONS).toContain("call_poison_control");
    expect(POISON_CONTROL_ACTIONS).toContain("call_emergency");
  });

  it("intercepts a swallow with no quantity named", () => {
    expect(evaluateVoiceTranscript("my toddler swallowed one of these", demoState, "en").kind).toBe(
      "intercept"
    );
    expect(evaluateVoiceTranscript("my child swallowed a magnet", demoState, "en").kind).toBe("intercept");
    expect(evaluateVoiceTranscript("the toddler ate a whole box of gummies", demoState, "en").kind).toBe(
      "intercept"
    );
  });

  it("intercepts the Spanish phrasing", () => {
    const decision = evaluateVoiceTranscript("mi hijo se comió toda la bolsa", demoState, "es");

    expect(decision.kind).toBe("intercept");
    if (decision.kind === "intercept") {
      expect(decision.content).toBe(tSafety("es", "childIngestionResponse"));
      expect(decision.actions).toEqual(POISON_CONTROL_ACTIONS);
    }
  });

  it("passes an ordinary note about what a child ate", () => {
    expect(evaluateVoiceTranscript("my kid ate a peanut butter sandwich", demoState, "en")).toEqual({
      kind: "pass"
    });
  });
});

describe("evaluateVoiceTranscript — symptomatic hyperglycemia", () => {
  it("escalates 300 or more next to feeling sick", () => {
    const decision = evaluateVoiceTranscript("my sugar is 480 and I feel sick", demoState, "en");

    expect(decision.kind).toBe("intercept");
    if (decision.kind === "intercept") {
      expect(decision.safety).toBe("escalate");
      expect(decision.actions).toEqual(EMERGENCY_ACTIONS);
      expect(decision.actions).toContain("call_emergency");
      expect(decision.actions).toContain("call_clinic");
    }
  });

  it("escalates the Spanish phrasing", () => {
    expect(
      evaluateVoiceTranscript("mi azúcar en la sangre está en 380 y tengo mucha sed", demoState, "es").kind
    ).toBe("intercept");
  });

  it("leaves a high reading with no symptom to the coach", () => {
    expect(evaluateVoiceTranscript("my blood sugar was 310 this morning", demoState, "en")).toEqual({
      kind: "pass"
    });
  });
});
