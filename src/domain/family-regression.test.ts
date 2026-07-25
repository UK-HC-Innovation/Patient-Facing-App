import { describe, expect, it } from "vitest";
import { detectRegressionCue } from "./family-interview";
import { REGRESSION_CASES } from "./family-regression.corpus";

// Same discipline as the family vignette gate: deterministic, no env, inside
// `npm test`. Positives must fire, traps must stay silent, en and es.
describe("regression cue gate (deterministic tier)", () => {
  it("keeps the corpus honest: unique ids, both languages, trap-heavy", () => {
    expect(new Set(REGRESSION_CASES.map(({ id }) => id)).size).toBe(REGRESSION_CASES.length);
    expect(REGRESSION_CASES.filter(({ expectCue }) => expectCue).length).toBeGreaterThanOrEqual(8);
    expect(REGRESSION_CASES.filter(({ expectCue }) => !expectCue).length).toBeGreaterThanOrEqual(6);
    for (const language of ["en", "es"] as const) {
      const cases = REGRESSION_CASES.filter((candidate) => candidate.language === language);
      expect(cases.some(({ expectCue }) => expectCue), language).toBe(true);
      expect(cases.some(({ expectCue }) => !expectCue), language).toBe(true);
    }
  });

  it.each(REGRESSION_CASES.map((regressionCase) => [regressionCase.id, regressionCase] as const))(
    "detects the cue exactly when expected: %s",
    (_id, regressionCase) => {
      const cue = detectRegressionCue(regressionCase.text, regressionCase.language);
      expect(cue !== null, `${regressionCase.id}: ${regressionCase.text}`).toBe(regressionCase.expectCue);
    }
  );

  it("returns the caregiver's own sentence verbatim, never a canned phrase", () => {
    for (const regressionCase of REGRESSION_CASES.filter(({ expectCue }) => expectCue)) {
      const cue = detectRegressionCue(regressionCase.text, regressionCase.language);
      expect(cue, regressionCase.id).not.toBeNull();
      expect(regressionCase.text, regressionCase.id).toContain(cue!);
    }
  });

  // The tripwire the plan names by hand: "no longer" is only a cue in front of a
  // skill verb. A gain ("no longer needs diapers") must never read as a loss.
  it("keeps 'no longer' scoped to skill verbs, so a gain never reads as a loss", () => {
    expect(detectRegressionCue("He no longer needs diapers at night.", "en")).toBeNull();
    expect(detectRegressionCue("He no longer says the words he knew.", "en")).not.toBeNull();
  });

  it("does not fire on the other language's lexicon", () => {
    expect(detectRegressionCue("Dejó de hablar casi por completo este mes.", "en")).toBeNull();
    expect(detectRegressionCue("He stopped saying the words he knew.", "es")).toBeNull();
  });

  it("only picks the sentence that carries the cue out of a longer note", () => {
    const note =
      "We finally got the paperwork in. He stopped saying the words he knew, like more and mama. Therapy is on Tuesdays.";
    expect(detectRegressionCue(note, "en")).toBe("He stopped saying the words he knew, like more and mama.");
  });
});
