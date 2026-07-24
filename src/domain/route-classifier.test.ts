import { describe, expect, it } from "vitest";
import { mockRouteClassifier, parseRouteToolArgs, CLASSIFIER_HREFS } from "./route-classifier";

describe("mockRouteClassifier", () => {
  it("only ever returns navigate, coach, or clarify — never a write action", () => {
    const samples = [
      "take me to my prescriptions",
      "log a reading",
      "why does this matter?",
      "my food and my medicine",
      "delete my data",
      "gibberish zzz",
      "I want to die"
    ];
    for (const sample of samples) {
      const decision = mockRouteClassifier.classify(sample, CLASSIFIER_HREFS);
      expect(["navigate", "coach", "clarify"], `"${sample}"`).toContain(decision.kind);
    }
  });

  it("bridges a synonym the deterministic lexicon does not know", () => {
    expect(mockRouteClassifier.classify("take me to my prescription list", CLASSIFIER_HREFS)).toMatchObject({
      kind: "navigate",
      href: "/medicines"
    });
  });

  it("routes mood language to the moved PHQ-9 instrument", () => {
    expect(mockRouteClassifier.classify("mood", CLASSIFIER_HREFS)).toMatchObject({
      kind: "navigate",
      href: "/checkin/phq9"
    });
  });

  it.each(["health check", "wellness check", "questionnaire"])(
    "routes a check-in hub synonym to the hub: %s",
    (utterance) => {
      expect(mockRouteClassifier.classify(utterance, CLASSIFIER_HREFS)).toMatchObject({
        kind: "navigate",
        href: "/checkin"
      });
    }
  );

  it("keeps bare screening with the eye-screening route", () => {
    expect(mockRouteClassifier.classify("screening", CLASSIFIER_HREFS)).toMatchObject({
      kind: "navigate",
      href: "/screening"
    });
  });

  it.each([
    "ladder",
    "help for my daughter",
    "resources for my child",
    "support for my son",
    "services with my kid",
    "developmental resources for my kid"
  ])("routes family-specific help intent to the family navigator: %s", (utterance) => {
    expect(mockRouteClassifier.classify(utterance, CLASSIFIER_HREFS)).toMatchObject({
      kind: "navigate",
      href: "/ladder"
    });
  });

  it("keeps Spanish phrases out of the English-only mock classifier", () => {
    expect(mockRouteClassifier.classify("ayuda para mi hija", CLASSIFIER_HREFS)).toEqual({
      kind: "coach",
      confidence: 0.3
    });
  });

  it.each(["help for myself", "help for my anxiety"])(
    "does not treat an incomplete possessive prefix as a caregiver relationship: %s",
    (utterance) => {
      expect(mockRouteClassifier.classify(utterance, CLASSIFIER_HREFS)).toEqual({
        kind: "coach",
        confidence: 0.3
      });
    }
  );

  it("prefers general support when a family phrase also names an SDOH need", () => {
    expect(mockRouteClassifier.classify("housing resources for my child", CLASSIFIER_HREFS)).toMatchObject({
      kind: "navigate",
      href: "/support"
    });
  });

  it("keeps caregiver routing inside the allowed href set", () => {
    expect(mockRouteClassifier.classify("help for my child", ["/numbers"])).toEqual({
      kind: "coach",
      confidence: 0.3
    });
    expect(mockRouteClassifier.classify("housing resources for my child", ["/ladder"])).toMatchObject({
      kind: "navigate",
      href: "/ladder"
    });
  });

  it("defers questions and concerns to the Coach", () => {
    expect(mockRouteClassifier.classify("why does my medicine matter?", CLASSIFIER_HREFS).kind).toBe("coach");
    expect(mockRouteClassifier.classify("my prescriptions are confusing me", CLASSIFIER_HREFS).kind).toBe("coach");
  });

  it("asks to clarify when two destinations tie", () => {
    expect(mockRouteClassifier.classify("my food and my medicine", CLASSIFIER_HREFS).kind).toBe("clarify");
  });

  it("preserves base-score clarification and stable candidate order", () => {
    expect(mockRouteClassifier.classify("eye exam and prescriptions", CLASSIFIER_HREFS)).toEqual({
      kind: "clarify",
      candidates: ["/medicines", "/screening"],
      confidence: 0.5
    });
  });

  it("preserves base-score preference for overlapping prescription synonyms", () => {
    expect(mockRouteClassifier.classify("care plan and prescriptions", CLASSIFIER_HREFS)).toEqual({
      kind: "navigate",
      href: "/medicines",
      confidence: 0.8
    });
  });

  it("preserves legacy support ranking for plural resources alongside medication", () => {
    expect(mockRouteClassifier.classify("I need resources and medication", CLASSIFIER_HREFS)).toEqual({
      kind: "navigate",
      href: "/support",
      confidence: 0.8
    });
  });
});

describe("parseRouteToolArgs (live LLM output guard)", () => {
  it("accepts a navigate to an allowed href", () => {
    expect(parseRouteToolArgs({ kind: "navigate", href: "/numbers", confidence: 0.9 }, CLASSIFIER_HREFS)).toEqual({
      kind: "navigate",
      href: "/numbers",
      confidence: 0.9
    });
  });

  it("rejects a hallucinated href down to coach", () => {
    expect(parseRouteToolArgs({ kind: "navigate", href: "/wire-money", confidence: 0.99 }, CLASSIFIER_HREFS).kind).toBe("coach");
  });

  it("drops clarify candidates outside the allowed set", () => {
    const decision = parseRouteToolArgs({ kind: "clarify", candidates: ["/numbers", "/evil"], confidence: 0.5 }, CLASSIFIER_HREFS);
    expect(decision).toEqual({ kind: "clarify", candidates: ["/numbers"], confidence: 0.5 });
  });

  it("clamps confidence and coerces garbage to coach", () => {
    expect(parseRouteToolArgs({ kind: "navigate", href: "/numbers", confidence: 5 }, CLASSIFIER_HREFS)).toMatchObject({ confidence: 1 });
    expect(parseRouteToolArgs("not an object", CLASSIFIER_HREFS)).toEqual({ kind: "coach", confidence: 0 });
    expect(parseRouteToolArgs({ kind: "addReading", href: "/numbers", value: "80/50" }, CLASSIFIER_HREFS).kind).toBe("coach");
  });
});
