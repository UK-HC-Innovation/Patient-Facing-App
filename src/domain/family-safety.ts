import { classifyCrisis, classifySafety } from "./safety";
import { classifySocialEmergency } from "./social-screen";
import { crisisTierForDomain } from "./crisis-red-flags";
import type { DevNeedDomain, FamilySafetyEvent, FamilySafetyGuidance } from "./types";

export type FamilySafetyScreen = {
  matched: boolean;
  tier: "crisis" | "emergency" | "blocked";
  domain: string;
  guidance?: FamilySafetyGuidance;
};

/**
 * The one safety read for the family thread. Same three classifiers the flow has
 * always run before a network call — what changed is the response: the caller
 * shows the standard resources and keeps helping instead of redirecting away.
 */
export function screenFamilySafety(text: string): FamilySafetyScreen | null {
  const crisis = classifyCrisis(text);
  if (crisis.matched) {
    const tier = crisisTierForDomain(crisis.domain);
    return {
      matched: true,
      tier: tier === "emergency" ? "emergency" : "crisis",
      domain: crisis.domain ?? "unspecified",
      ...(crisis.ruleIds.some((ruleId) => ruleId.includes("missing_child"))
        ? { guidance: "missing_child" as const }
        : {})
    };
  }
  const safety = classifySafety(text);
  if (safety.level === "escalate") {
    return { matched: true, tier: "emergency", domain: "safety" };
  }
  if (safety.level === "blocked") {
    return { matched: true, tier: "blocked", domain: "medication_change" };
  }
  const socialEmergency = classifySocialEmergency(text);
  if (socialEmergency !== null) {
    return { matched: true, tier: "emergency", domain: "social", guidance: socialEmergency };
  }
  return null;
}

export function createFamilySafetyEvent(screen: FamilySafetyScreen, now = new Date()): FamilySafetyEvent {
  return {
    id: crypto.randomUUID(),
    tier: screen.tier,
    domain: screen.domain,
    ...(screen.guidance === undefined ? {} : { guidance: screen.guidance }),
    createdAt: now.toISOString()
  };
}

export function pendingFamilySafetyEvent(events: FamilySafetyEvent[]): FamilySafetyEvent | undefined {
  return events.find(({ acknowledgedAt }) => acknowledgedAt === undefined);
}

/**
 * What the active domains become after a turn that tripped a safety rule.
 * Disclosing a crisis is not a retraction of the family's needs, and a family
 * with no identified need still needs a person — never an empty page.
 *
 * F2b considered dropping the `parent_support` floor, because the review found
 * a child-safety disclosure being filed under an ordinary resource category.
 * Dropping it dead-ends: with no domains, retrieval returns nothing at all, and
 * the `missing_child_banner` vignette went to zero resources — answering a
 * caregiver's hardest message with a blank page. The floor stays, and the real
 * fix lands where the harm was: the crisis turn no longer renders a "what we
 * heard" interpretation, makes no facts, and is never written to the record
 * (see `recordFamilySafetyTurn` and F2b in family-experience).
 */
export function domainsAfterSafety(
  extracted: DevNeedDomain[],
  previous: readonly DevNeedDomain[]
): DevNeedDomain[] {
  if (extracted.length > 0) return extracted;
  if (previous.length > 0) return [...previous];
  return ["parent_support"];
}
