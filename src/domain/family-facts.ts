import { familyStrings } from "@/i18n/family-strings";
import type { FamilyFact, FamilyFlag } from "./types";

/**
 * A fact the caregiver has marked wrong. It stays in the journal with its badge
 * — the record is append-only (FR-3) — but it stops counting as something the
 * family told us: it leaves the visit packet, it stops counting toward the
 * "notes in the packet" chip, and if it was the only thing holding up a
 * regression flag, that flag's packet line is withdrawn with it.
 */
export function isRejectedFamilyFact(fact: FamilyFact): boolean {
  return fact.status === "rejected";
}

/** Everything the family still stands behind. */
export function activeFamilyFacts(facts: readonly FamilyFact[]): FamilyFact[] {
  return facts.filter((fact) => !isRejectedFamilyFact(fact));
}

// The regression fact's label is written in whichever language the caregiver was
// reading at the time, so both are matched — a family that switched to Spanish
// after writing an English note must still be able to retract it.
const REGRESSION_LABELS: readonly string[] = [
  familyStrings.en.factRegressionLabel,
  familyStrings.es.factRegressionLabel
];

export function isRegressionFact(fact: FamilyFact): boolean {
  return REGRESSION_LABELS.includes(fact.label);
}

/**
 * The facts a regression flag rests on: the loss-of-skills sentences from the
 * submission that raised it. A probe flag rests on a tap, not on words, so it
 * has none and cannot be withdrawn this way.
 */
export function familyFlagSupportingFacts(
  flag: FamilyFlag,
  facts: readonly FamilyFact[]
): FamilyFact[] {
  if (flag.source === "probe") return [];
  return facts.filter(
    (fact) =>
      isRegressionFact(fact) &&
      (flag.interviewId === undefined || fact.interviewId === flag.interviewId)
  );
}

/**
 * True when the caregiver has retracted every sentence behind this flag. The
 * flag itself is kept — the clinic history is not rewritten by the app — but the
 * printed "Possible loss of skills" line comes out (F2c, spec 19 F4a's next step).
 */
export function isFamilyFlagWithdrawn(flag: FamilyFlag, facts: readonly FamilyFact[]): boolean {
  const supporting = familyFlagSupportingFacts(flag, facts);
  return supporting.length > 0 && supporting.every(isRejectedFamilyFact);
}
