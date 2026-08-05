import { familyResourcePhones, familyResourceTel } from "./family-resource-contact";
import {
  FAMILY_RESOURCE_CATALOG,
  FIRST_STEPS_POE_BY_COUNTY,
  childAgeYears,
  type FamilyResource
} from "./family-resources";
import type { FamilyNavigatorState } from "./types";

/**
 * Who the clinic-now card tells a family to call, and with what number.
 *
 * The card fires at the scariest moment a caregiver has — right after the app
 * has read "possible loss of skills" out of their own sentence — so it may not
 * name a clinic the family has no relationship with, and it may not print a
 * phone number that is not in the verified catalog verbatim (FR-1, FR-2).
 *
 * Before this existed the card fell back to the hardcoded demo clinic ("UK
 * Developmental Pediatrics") for every family without a referral, and carried no
 * number at all — so the instruction was "call a clinic you have never heard of"
 * with no way to call it.
 */
export type FamilyClinicNowTarget =
  /** The family's own record names this clinic. */
  | { kind: "referral"; clinic: string; number?: string; tel?: string }
  /** No referral yet, but a First Steps clock is running: their county's POE. */
  | { kind: "first_steps"; office: string; number?: string; tel?: string }
  /** Nothing we can name honestly — their own doctor, no invented name. */
  | { kind: "generic" };

/**
 * A number renders only if it is in the catalog verbatim. Matched on the
 * catalog's own name, so a clinic the catalog does not carry (or carries with no
 * dialable contact line, as the UK entry does) simply renders without a number.
 */
function catalogPhoneForClinic(clinic: string): { number?: string; tel?: string } {
  const needle = clinic.trim().toLowerCase();
  if (needle.length === 0) return {};
  const entry = FAMILY_RESOURCE_CATALOG.find((resource) => {
    const name = resource.name.toLowerCase();
    return name === needle || name.includes(needle);
  });
  return entry ? catalogPhone(entry) : {};
}

function catalogPhone(resource: FamilyResource): { number?: string; tel?: string } {
  const [first] = familyResourcePhones(resource.contact);
  return first === undefined ? {} : { number: first, tel: familyResourceTel(first) };
}

/** The county's First Steps point of entry, or undefined outside the map. */
export function firstStepsPoeForCounty(county: string | undefined): FamilyResource | undefined {
  if (!county) return undefined;
  const district = FIRST_STEPS_POE_BY_COUNTY[county];
  if (!district) return undefined;
  return FAMILY_RESOURCE_CATALOG.find(
    (resource) => resource.domains.includes("early_intervention") && resource.name.includes(district)
  );
}

export function resolveFamilyClinicNowTarget(
  family: FamilyNavigatorState | null | undefined,
  now: Date = new Date()
): FamilyClinicNowTarget {
  const clinic = family?.referral?.clinic;
  if (clinic) {
    return { kind: "referral", clinic, ...catalogPhoneForClinic(clinic) };
  }

  const profile = family?.profile ?? null;
  const onFirstStepsClock =
    profile !== null &&
    (family?.activeDomains.includes("early_intervention") ?? false) &&
    childAgeYears(profile, now) < 3;
  if (onFirstStepsClock) {
    const poe = firstStepsPoeForCounty(profile.county);
    if (poe) {
      return {
        kind: "first_steps",
        office: FIRST_STEPS_POE_BY_COUNTY[profile.county] ?? poe.name,
        ...catalogPhone(poe)
      };
    }
  }

  return { kind: "generic" };
}
