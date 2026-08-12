import {
  FAMILY_RESOURCE_CATALOG,
  childAgeYears,
  findFamilyResources,
  getFamilyResourceById,
  type FamilyResource
} from "./family-resources";
import type { DevNeedDomain, FamilyProfile } from "./types";
import {
  actionDomainForIntent,
  deriveStructuredFamilyIntent,
  intentScore,
  resourceEligibleForIntent
} from "./family-resource-intent";

export type MatchedResource = {
  resource: FamilyResource;
  domain: DevNeedDomain;
  position: number;
};

export type FamilyMatchResult = {
  resources: MatchedResource[];
  isFallback: boolean;
};

export const FALLBACK_IDS = ["ky_spin", "hdi_resource_guide", "kynect_resources", "kentucky_211"] as const;
const FALLBACK_ID_SET = new Set<string>(FALLBACK_IDS);
const STATEWIDE_NAVIGATION_ID_SET = new Set<string>(["kynect_resources", "kentucky_211"]);
const MAX_PER_DOMAIN = 4;
// A ranking layer can only reorder what retrieval hands it, so the set it scores
// is the whole match list capped as a total — never truncated per domain, which
// would silently drop a low-in-catalog entry before ranking ever saw it.
export const MAX_RANK_CANDIDATES = 24;
export const MAX_DISPLAY_RESOURCES = 8;

export const normalizeCounty = (county: string): string => county.trim().replace(/\s+County$/i, "");

function prioritizeDomainCandidates(resources: FamilyResource[], county: string): FamilyResource[] {
  const normalizedCounty = normalizeCounty(county);
  return resources
    .map((resource, catalogPosition) => ({ resource, catalogPosition }))
    .sort(
      (left, right) =>
        Number(!left.resource.counties.includes(normalizedCounty)) -
          Number(!right.resource.counties.includes(normalizedCounty)) ||
        Number(!left.resource.actNow) - Number(!right.resource.actNow) ||
        left.catalogPosition - right.catalogPosition
    )
    .map(({ resource }) => resource);
}

function deferStatewideNavigationBehindLocalRide(
  resources: MatchedResource[],
  alreadyEnrolled: readonly string[]
): MatchedResource[] {
  const enrolled = new Set(alreadyEnrolled);
  const hasAvailableLklp = resources.some(
    ({ resource }) => resource.id === "lklp_transportation_region_13" && !enrolled.has(resource.id)
  );
  if (!hasAvailableLklp) return resources;

  const unenrolledResources = resources.filter(({ resource }) => !enrolled.has(resource.id));
  const enrolledResources = resources.filter(({ resource }) => enrolled.has(resource.id));
  return [
    ...unenrolledResources.filter(({ resource }) => !STATEWIDE_NAVIGATION_ID_SET.has(resource.id)),
    ...unenrolledResources.filter(({ resource }) => STATEWIDE_NAVIGATION_ID_SET.has(resource.id)),
    ...enrolledResources
  ].map((match, position) => ({ ...match, position }));
}

/**
 * Deterministic retrieval: county + age + active domains against the verified
 * catalog. This is the floor everything else sits on — a ranking layer may
 * reorder and explain what comes out of here, but it never adds to it.
 */
export function buildResourceMatches(
  profile: FamilyProfile,
  domains: DevNeedDomain[],
  alreadyEnrolled: string[],
  perDomainLimit: number = MAX_PER_DOMAIN
): FamilyMatchResult {
  if (domains.length === 0) {
    return { resources: [], isFallback: false };
  }

  const seen = new Set<string>();
  const matches: MatchedResource[] = [];
  const enrolled = new Set(alreadyEnrolled);
  for (const domain of domains) {
    const candidates = prioritizeDomainCandidates(
      findFamilyResources({
        county: profile.county,
        domain,
        childAgeYears: childAgeYears(profile),
        limit: FAMILY_RESOURCE_CATALOG.length
      }).filter(({ id }) => !seen.has(id)),
      profile.county
    );
    const selected = [
      ...candidates.filter(({ id }) => !enrolled.has(id)).slice(0, perDomainLimit),
      ...candidates.filter(({ id }) => enrolled.has(id))
    ];
    for (const resource of selected) {
      seen.add(resource.id);
      matches.push({ resource, domain, position: matches.length });
    }
  }

  const hasDomainSpecificMatch = matches.some(({ resource }) => !FALLBACK_ID_SET.has(resource.id));
  if (!hasDomainSpecificMatch) {
    const domain = domains[0];
    return {
      isFallback: true,
      resources: FALLBACK_IDS.flatMap((id, position) => {
        const resource = getFamilyResourceById(id);
        return resource ? [{ resource, domain, position }] : [];
      })
    };
  }

  const resources = [...matches].sort(
      (left, right) =>
        Number(enrolled.has(left.resource.id)) - Number(enrolled.has(right.resource.id)) ||
        left.position - right.position
    );
  return {
    isFallback: false,
    resources: deferStatewideNavigationBehindLocalRide(resources, alreadyEnrolled)
  };
}

export function buildNearbyTherapeuticRecreation(
  profile: FamilyProfile,
  primaryResourceIds: Set<string>,
  alreadyEnrolled: string[]
): MatchedResource[] {
  const normalizedCounty = normalizeCounty(profile.county);
  const enrolled = new Set(alreadyEnrolled);
  return findFamilyResources({
    county: profile.county,
    domain: "recreation",
    childAgeYears: childAgeYears(profile),
    limit: FAMILY_RESOURCE_CATALOG.length
  })
    .filter(
      (resource) =>
        resource.counties.includes(normalizedCounty) &&
        resource.domains.includes("therapies") &&
        !primaryResourceIds.has(resource.id)
    )
    .map((resource, position) => ({ resource, domain: "recreation" as const, position }))
    .sort(
      (left, right) =>
        Number(enrolled.has(left.resource.id)) - Number(enrolled.has(right.resource.id)) ||
        left.position - right.position
    )
    .slice(0, 2);
}

/**
 * The candidate set handed to a ranking layer: the same deterministic retrieval,
 * without the per-domain display truncation, capped as a total.
 */
export function buildRankCandidates(
  profile: FamilyProfile,
  domains: DevNeedDomain[],
  alreadyEnrolled: string[],
  max: number = MAX_RANK_CANDIDATES
): FamilyMatchResult {
  const matches = buildResourceMatches(profile, domains, alreadyEnrolled, FAMILY_RESOURCE_CATALOG.length);
  const resources = matches.resources.slice(0, max);
  return { ...matches, resources: deferStatewideNavigationBehindLocalRide(resources, alreadyEnrolled) };
}

/**
 * Wave 2 retrieval contract. Domains still define the catalog pool; structured
 * intent only removes unsupported candidates, orders direct asks, and chooses
 * the domain under which a multi-domain action is persisted.
 */
export function buildStructuredResourceMatches(
  profile: FamilyProfile,
  domains: DevNeedDomain[],
  alreadyEnrolled: string[],
  rawText: string,
  max: number = MAX_RANK_CANDIDATES
): FamilyMatchResult {
  const structured = deriveStructuredFamilyIntent(rawText, profile, domains);
  const enrolled = new Set(alreadyEnrolled);
  const broad = buildResourceMatches(profile, domains, alreadyEnrolled, FAMILY_RESOURCE_CATALOG.length);
  const resources = broad.resources
    .filter(({ resource }) => resourceEligibleForIntent(resource, structured, rawText))
    .map((match) => ({
      ...match,
      domain: actionDomainForIntent(match.resource, match.domain, structured)
    }))
    .sort(
      (left, right) =>
        Number(enrolled.has(left.resource.id)) - Number(enrolled.has(right.resource.id)) ||
        intentScore(left.resource, structured, profile.county) -
          intentScore(right.resource, structured, profile.county) ||
        left.position - right.position
    )
    .slice(0, Math.max(0, Math.floor(max)))
    .map((match, position) => ({ ...match, position }));

  const hasDomainSpecificMatch = resources.some(({ resource }) => !FALLBACK_ID_SET.has(resource.id));
  if (resources.length === 0 || !hasDomainSpecificMatch) {
    const domain = domains[0];
    return {
      isFallback: true,
      resources: domain
        ? FALLBACK_IDS.flatMap((id, position) => {
            const resource = getFamilyResourceById(id);
            return resource ? [{ resource, domain, position }] : [];
          })
        : []
    };
  }
  return { resources, isFallback: false };
}
