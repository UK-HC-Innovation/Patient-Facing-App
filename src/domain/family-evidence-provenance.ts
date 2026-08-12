import type {
  FamilyEvidenceStatus,
  FamilyFact,
  FamilyInterview,
  FamilyNavigatorState
} from "@/domain/types";

export type FamilyEvidenceTrace = {
  factId: string;
  status: FamilyEvidenceStatus;
  origin: "conversation" | "guided_screen" | "orphaned_conversation";
  interviewId: string | null;
  capturedAt: string | null;
  captureSource: FamilyInterview["source"] | "structured" | "unknown";
  extraction: "online" | "on_device" | "structured" | "unknown";
  quoteMatch: "exact" | "structured" | "unmatched";
  /** UTF-16 offsets into the linked interview. No caregiver text is duplicated. */
  sourceRange: { start: number; end: number } | null;
};

/**
 * Builds a deterministic evidence edge from a saved fact back to the interaction
 * that produced it. The trace is derived instead of persisted, so the caregiver's
 * words still have one canonical copy and older saves gain provenance immediately.
 */
export function traceFamilyFact(
  family: Pick<FamilyNavigatorState, "interviews">,
  fact: FamilyFact
): FamilyEvidenceTrace {
  if (fact.interviewId === undefined) {
    return {
      factId: fact.id,
      status: fact.status,
      origin: "guided_screen",
      interviewId: null,
      capturedAt: null,
      captureSource: "structured",
      extraction: "structured",
      quoteMatch: "structured",
      sourceRange: null
    };
  }

  const interview = family.interviews.find(({ id }) => id === fact.interviewId);
  if (interview === undefined) {
    return {
      factId: fact.id,
      status: fact.status,
      origin: "orphaned_conversation",
      interviewId: fact.interviewId,
      capturedAt: null,
      captureSource: "unknown",
      extraction: "unknown",
      quoteMatch: "unmatched",
      sourceRange: null
    };
  }

  const start = interview.rawText.indexOf(fact.sourceSnippet);
  return {
    factId: fact.id,
    status: fact.status,
    origin: "conversation",
    interviewId: interview.id,
    capturedAt: interview.createdAt,
    captureSource: interview.source,
    extraction: interview.extraction === "live" ? "online" : "on_device",
    quoteMatch: start >= 0 ? "exact" : "unmatched",
    sourceRange:
      start >= 0 ? { start, end: start + fact.sourceSnippet.length } : null
  };
}

export function traceFamilyEvidence(
  family: Pick<FamilyNavigatorState, "facts" | "interviews">
): FamilyEvidenceTrace[] {
  return family.facts.map((fact) => traceFamilyFact(family, fact));
}
