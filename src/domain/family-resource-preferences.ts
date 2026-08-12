import type { MatchedResource } from "@/domain/family-matching";
import { normalizeCounty } from "@/domain/family-matching";
import type { FamilyResource } from "@/domain/family-resources";
import type { FamilyResourcePreferences } from "@/domain/types";

export const DEFAULT_FAMILY_RESOURCE_PREFERENCES: FamilyResourcePreferences = {
  scope: "no_preference",
  contact: "no_preference"
};

export function isFamilyResourcePreferences(value: unknown): value is FamilyResourcePreferences {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<FamilyResourcePreferences>;
  return (
    ["no_preference", "local_first", "statewide_first"].includes(candidate.scope ?? "") &&
    ["no_preference", "self_serve_first", "call_first", "school_or_provider_first"].includes(
      candidate.contact ?? ""
    )
  );
}

function scopeScore(
  resource: FamilyResource,
  county: string,
  preference: FamilyResourcePreferences["scope"]
): number {
  if (preference === "no_preference") return 0;
  const local = resource.counties.includes(normalizeCounty(county));
  return preference === "local_first" ? Number(!local) : Number(local);
}

function contactScore(
  resource: FamilyResource,
  preference: FamilyResourcePreferences["contact"]
): number {
  if (preference === "no_preference") return 0;
  if (preference === "self_serve_first") return Number(resource.referralMode !== "self_serve");
  if (preference === "call_first") {
    return Number(resource.referralMode !== "call" && resource.referralMode !== "navigator_referral");
  }
  return Number(
    resource.referralMode !== "school_contact" && resource.referralMode !== "provider_referral"
  );
}

/**
 * Stable soft ordering over an already eligible list. The lead stays fixed so a
 * direct caregiver intent, deadline, or safety-driven route cannot be displaced.
 * Membership never changes and neutral preferences return the original array.
 */
export function applyFamilyResourcePreferences(
  matches: readonly MatchedResource[],
  preferences: FamilyResourcePreferences,
  county: string
): MatchedResource[] | readonly MatchedResource[] {
  if (
    matches.length < 2 ||
    (preferences.scope === "no_preference" && preferences.contact === "no_preference")
  ) {
    return matches;
  }

  const [lead, ...tail] = matches;
  const orderedTail = tail
    .map((match, index) => ({ match, index }))
    .sort(
      (left, right) =>
        scopeScore(left.match.resource, county, preferences.scope) -
          scopeScore(right.match.resource, county, preferences.scope) ||
        contactScore(left.match.resource, preferences.contact) -
          contactScore(right.match.resource, preferences.contact) ||
        left.index - right.index
    )
    .map(({ match }) => match);
  const ordered = [lead, ...orderedTail];
  const unchanged = ordered.every((match, index) => match === matches[index]);
  return unchanged ? matches : ordered.map((match, position) => ({ ...match, position }));
}
