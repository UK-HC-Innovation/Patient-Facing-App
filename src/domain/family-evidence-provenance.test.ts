import { describe, expect, it } from "vitest";
import { traceFamilyEvidence, traceFamilyFact } from "@/domain/family-evidence-provenance";
import type { FamilyFact, FamilyInterview } from "@/domain/types";

const interview: FamilyInterview = {
  id: "conversation-1",
  rawText: "Maya points to pictures and uses two short words.",
  source: "mixed",
  createdAt: "2026-08-09T12:00:00.000Z",
  extraction: "live",
  kind: "orientation"
};

function fact(overrides: Partial<FamilyFact> = {}): FamilyFact {
  return {
    id: "fact-1",
    interviewId: interview.id,
    label: "Communication",
    value: "Uses two short words",
    status: "patient_reported",
    sourceSnippet: "uses two short words",
    ...overrides
  };
}

describe("family evidence provenance", () => {
  it("links exact evidence to its conversation without copying the narrative", () => {
    const trace = traceFamilyFact({ interviews: [interview] }, fact());

    expect(trace).toEqual({
      factId: "fact-1",
      status: "patient_reported",
      origin: "conversation",
      interviewId: "conversation-1",
      capturedAt: "2026-08-09T12:00:00.000Z",
      captureSource: "mixed",
      extraction: "online",
      quoteMatch: "exact",
      sourceRange: { start: 28, end: 48 }
    });
    expect(JSON.stringify(trace)).not.toContain(interview.rawText);
  });

  it("distinguishes guided answers and broken legacy links", () => {
    const guided = fact({ id: "screen-fact", interviewId: undefined });
    const orphaned = fact({ id: "orphan", interviewId: "missing" });
    const traces = traceFamilyEvidence({ facts: [guided, orphaned], interviews: [] });

    expect(traces.map(({ origin }) => origin)).toEqual([
      "guided_screen",
      "orphaned_conversation"
    ]);
    expect(traces.every(({ sourceRange }) => sourceRange === null)).toBe(true);
  });

  it("marks inferred text as unmatched when it is not a verbatim quote", () => {
    const trace = traceFamilyFact(
      { interviews: [{ ...interview, extraction: "mock" }] },
      fact({ sourceSnippet: "paraphrased by the extractor", status: "inferred" })
    );

    expect(trace).toMatchObject({
      extraction: "on_device",
      quoteMatch: "unmatched",
      sourceRange: null
    });
  });
});
