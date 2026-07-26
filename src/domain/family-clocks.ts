import { isFirstStepsResource } from "./family-resources";
import { childAgeMonths } from "./family-screenings";
import type { FamilyNavigatorState, FamilyProfile } from "./types";

export const CLOCK_WARNING_WEEKS = 26; // surface within ~6 months of the cutoff
const DAY_MS = 24 * 60 * 60 * 1000;

export type FirstStepsClock = { weeksLeft: number; yearOnly: boolean };

// First Steps does not accept a new referral within 45 days of the third
// birthday (catalog-verified 2026-07-17). Year-only profiles assume the
// EARLIEST possible birthday (Jan 1) so the warning fires early, never late.
export function firstStepsClock(
  profile: FamilyProfile,
  now: Date,
  enrolled: boolean
): FirstStepsClock | null {
  if (enrolled) return null;
  const months = childAgeMonths(profile, now);
  const yearOnly = months === null;
  const thirdBirthday = Date.UTC(profile.birthYear + 3, (profile.birthMonth ?? 1) - 1, 1);
  const cutoff = thirdBirthday - 45 * DAY_MS;
  const msLeft = cutoff - now.valueOf();
  if (msLeft <= 0) return null; // past the cutoff: no countdown, cards still render
  const ageMonths = yearOnly ? (now.getUTCFullYear() - profile.birthYear) * 12 : months;
  if (ageMonths === null || ageMonths >= 36) return null;
  const weeksLeft = Math.max(1, Math.floor(msLeft / (7 * DAY_MS)));
  return weeksLeft <= CLOCK_WARNING_WEEKS ? { weeksLeft, yearOnly } : null;
}

/**
 * Enrollment retires the countdown — the family already made the deadline.
 *
 * `alreadyEnrolled` is the complete record and the step tracker is not. A save
 * written before the tracker existed carries no step at all, and the enrollment
 * toggle still refuses to invent one for a resource the catalog no longer knows
 * (see `stepsAfterEnrollmentToggle`) — which is exactly what a retired county
 * point-of-entry id looks like. Every other reader (matching exclusion, the
 * resource card) already asks `alreadyEnrolled`; asking only the tracker here is
 * what kept nagging a family who was already in about a deadline they had met.
 */
export function hasEnrolledFirstSteps(family: FamilyNavigatorState): boolean {
  return (
    family.alreadyEnrolled.some(isFirstStepsResource) ||
    family.steps.some(
      (step) => step.status === "enrolled" && isFirstStepsResource(step.resourceId)
    )
  );
}
