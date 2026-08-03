import { z } from "zod";
import { containsFamilyDiagnosisClaim } from "./family-diagnosis-lint";
import { devNeedDomainSchema } from "./family-interview";
import { FAMILY_RESOURCE_CATALOG, getFamilyResourceById } from "./family-resources";
import type { MatchedResource } from "./family-matching";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";
import type { DevNeedDomain, FamilyRecommendationItem, FamilyRecommendationSet } from "./types";

export const HEARD_MAX = 600;
export const WHY_MAX = 300;
export const QUOTE_MAX = 200;
export const MAX_RECOMMENDATIONS = 8;

const urgencySchema = z.enum(["act_now", "soon", "when_ready"]);

export const familyRankResultSchema = z
  .object({
    heard: z.string().min(1).max(HEARD_MAX),
    // Deliberately NOT the domain enum. The model reaches for categories our
    // 11 labels do not have ("behavioral_support" for a school-exclusion case),
    // and a taxonomy guess must never invalidate an otherwise good ranking.
    // coerceLead maps it back to a domain we own, or falls back.
    lead: z.string().min(1).max(60).optional(),
    recommendations: z
      .array(
        z
          .object({
            id: z.string().min(1).max(120),
            why: z.string().max(WHY_MAX).optional(),
            becauseYouSaid: z.string().max(QUOTE_MAX).optional(),
            urgency: urgencySchema
          })
          .strict()
      )
      .max(MAX_RECOMMENDATIONS)
  })
  .strict();

export type FamilyRankResult = z.infer<typeof familyRankResultSchema>;

export function parseFamilyRankPayload(payload: unknown): FamilyRankResult | null {
  const parsed = familyRankResultSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

// Every catalog name except the card's own. A justification may say what its own
// card already says; it may not send the family somewhere else by name, because
// only the deterministic catalog decides what gets offered.
function namesAnotherResource(text: string, ownResourceId: string): boolean {
  return FAMILY_RESOURCE_CATALOG.some(({ id, name }) => {
    if (id === ownResourceId) return false;
    return text.toLowerCase().includes(name.toLowerCase());
  });
}

export type ValidateRankOptions = {
  candidateIds: readonly string[];
  rawText: string;
  language: Language;
  childFirstName?: string;
};

/**
 * The whole trust boundary for a ranked result, applied to live and mock output
 * alike. Nothing here rewrites model text into something safer — a claim either
 * survives verbatim or is dropped for the deterministic equivalent.
 *
 * - an id outside the candidate set is dropped (a model cannot invent a resource)
 * - a diagnosis claim in `heard` or a `why` is dropped
 * - a `why` naming a different program is dropped
 * - a quote that is not verbatim caregiver text is dropped
 */
export function validateRankedItems(
  items: readonly FamilyRankResult["recommendations"][number][],
  { candidateIds, rawText, childFirstName }: ValidateRankOptions
): FamilyRecommendationItem[] {
  const allowed = new Set(candidateIds);
  const seen = new Set<string>();
  const validated: FamilyRecommendationItem[] = [];

  for (const item of items) {
    if (!allowed.has(item.id) || seen.has(item.id) || !getFamilyResourceById(item.id)) {
      continue;
    }
    seen.add(item.id);

    const why =
      item.why && !containsFamilyDiagnosisClaim(item.why, childFirstName) && !namesAnotherResource(item.why, item.id)
        ? item.why
        : undefined;
    const becauseYouSaid =
      item.becauseYouSaid && rawText.includes(item.becauseYouSaid) ? item.becauseYouSaid : undefined;

    validated.push({ resourceId: item.id, why, becauseYouSaid, urgency: item.urgency });
  }

  return validated;
}

/**
 * The model's `lead` is advisory. If it names one of our domains we take it;
 * otherwise we use the family's own first active domain. Either way the
 * recommendations survive.
 */
export function coerceLead(
  value: string | undefined,
  activeDomains: readonly DevNeedDomain[]
): DevNeedDomain {
  const parsed = devNeedDomainSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return activeDomains[0] ?? "parent_support";
}

export function validateHeard(heard: string, language: Language, childFirstName?: string): string {
  return containsFamilyDiagnosisClaim(heard, childFirstName)
    ? tFamily(language, "rankHeardFallback")
    : heard;
}

function urgencyFor(candidate: MatchedResource): FamilyRecommendationItem["urgency"] {
  if (candidate.resource.actNow) return "act_now";
  return candidate.position < 3 ? "soon" : "when_ready";
}

/**
 * The deterministic ranker. It is not a degraded path — it is what the zero-key
 * demo, the e2e suite, and every live failure land on, so it produces the same
 * shape with the same guarantees: catalog order, static rationales, and quotes
 * only when they are genuinely the caregiver's words.
 */
export function rankFamilyResourcesMock(
  candidates: readonly MatchedResource[],
  domains: readonly DevNeedDomain[],
  rawText: string,
  language: Language,
  interviewId: string,
  now = new Date()
): FamilyRecommendationSet {
  const lead: DevNeedDomain = domains[0] ?? "parent_support";
  const items = candidates.slice(0, MAX_RECOMMENDATIONS).map((candidate) => ({
    resourceId: candidate.resource.id,
    why: undefined,
    becauseYouSaid: undefined,
    urgency: urgencyFor(candidate)
  }));

  return {
    interviewId,
    createdAt: now.toISOString(),
    extraction: "mock",
    heard: tFamily(language, "rankHeardFallback"),
    lead,
    items
  };
}

export { rawTextMentions as familyQuoteIsGrounded };

function rawTextMentions(rawText: string, snippet: string): boolean {
  return snippet.length > 0 && rawText.includes(snippet);
}
