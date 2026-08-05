import { describe, expect, it } from "vitest";
import {
  activeFamilyFacts,
  familyFlagSupportingFacts,
  isFamilyFlagWithdrawn,
  isRegressionFact
} from "./family-facts";
import { familyStrings } from "@/i18n/family-strings";
import type { FamilyFact, FamilyFlag } from "./types";

function fact(overrides: Partial<FamilyFact> = {}): FamilyFact {
  return {
    id: "fact-1",
    interviewId: "interview-1",
    label: familyStrings.en.factRegressionLabel,
    value: familyStrings.en.factRegressionValue,
    status: "patient_reported",
    sourceSnippet: "He stopped saying more at dinner.",
    ...overrides
  };
}

const textFlag: FamilyFlag = {
  id: "flag-1",
  type: "regression",
  source: "text",
  raisedAt: "2026-07-17T12:00:00.000Z",
  interviewId: "interview-1"
};

describe("activeFamilyFacts", () => {
  it("drops what the caregiver marked wrong and keeps everything else", () => {
    const facts = [fact(), fact({ id: "fact-2", status: "rejected" }), fact({ id: "fact-3", status: "inferred" })];

    expect(activeFamilyFacts(facts).map(({ id }) => id)).toEqual(["fact-1", "fact-3"]);
  });
});

describe("isRegressionFact", () => {
  it("recognises the loss-of-skills label in either language", () => {
    expect(isRegressionFact(fact())).toBe(true);
    expect(isRegressionFact(fact({ label: familyStrings.es.factRegressionLabel }))).toBe(true);
    expect(isRegressionFact(fact({ label: "Grade" }))).toBe(false);
  });
});

describe("familyFlagSupportingFacts", () => {
  it("takes the loss-of-skills sentences from the submission that raised the flag", () => {
    const facts = [
      fact(),
      fact({ id: "fact-other-interview", interviewId: "interview-2" }),
      fact({ id: "fact-not-regression", label: "Grade" })
    ];

    expect(familyFlagSupportingFacts(textFlag, facts).map(({ id }) => id)).toEqual(["fact-1"]);
  });

  // A probe flag rests on a tap, not on words. There is nothing to retract.
  it("finds nothing behind a probe flag", () => {
    expect(familyFlagSupportingFacts({ ...textFlag, source: "probe" }, [fact()])).toEqual([]);
  });

  it("falls back to every regression fact for a flag saved before the link existed", () => {
    const legacy: FamilyFlag = { ...textFlag, interviewId: undefined };
    const facts = [fact(), fact({ id: "fact-2", interviewId: "interview-2" })];

    expect(familyFlagSupportingFacts(legacy, facts).map(({ id }) => id)).toEqual(["fact-1", "fact-2"]);
  });
});

describe("isFamilyFlagWithdrawn", () => {
  it("withdraws only when every sentence behind it is marked wrong", () => {
    expect(isFamilyFlagWithdrawn(textFlag, [fact({ status: "rejected" })])).toBe(true);
    expect(
      isFamilyFlagWithdrawn(textFlag, [fact({ status: "rejected" }), fact({ id: "fact-2" })])
    ).toBe(false);
  });

  it("never withdraws a flag nothing supports — silence is not a retraction", () => {
    expect(isFamilyFlagWithdrawn(textFlag, [])).toBe(false);
    expect(isFamilyFlagWithdrawn({ ...textFlag, source: "probe" }, [fact({ status: "rejected" })])).toBe(
      false
    );
  });
});
