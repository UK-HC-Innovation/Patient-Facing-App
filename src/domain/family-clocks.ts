import { isFirstStepsResource } from "./family-resources";
import { childAgeMonths } from "./family-screenings";
import type { FamilyNavigatorState, FamilyProfile } from "./types";

export const CLOCK_WARNING_WEEKS = 26; // surface within ~6 months of the cutoff
const DAY_MS = 24 * 60 * 60 * 1000;
/** First Steps stops taking a new referral 45 days before the third birthday. */
const CUTOFF_LEAD_MS = 45 * DAY_MS;

/**
 * Two truths, two shapes.
 *
 * `dated` — the birth month is known, so there is a real cutoff date and a real
 * number of weeks to it.
 *
 * `range` — only the birth year is known, so there is no week count to give.
 * The honest answer is the window the cutoff falls in and whose birthday decides
 * it. `earliest: null` means the earliest possible cutoff is already behind us,
 * so it may have passed — which is still true, and still worth one phone call.
 *
 * Naming a week count from a birth *year* is the false precision the audit
 * caught (P5), and it is not recoverable by adding a caveat sentence under it.
 */
export type FirstStepsClock =
  | { kind: "dated"; weeksLeft: number; cutoff: Date }
  | { kind: "range"; earliest: Date | null; latest: Date };

/**
 * Year-only profiles assume the EARLIEST possible birthday for anything that
 * gates visibility, so the warning fires early, never late.
 */
export function firstStepsClock(
  profile: FamilyProfile,
  now: Date,
  enrolled: boolean
): FirstStepsClock | null {
  if (enrolled) return null;
  if (Number.isNaN(now.valueOf())) return null;
  const months = childAgeMonths(profile, now);
  const thirdBirthdayYear = profile.birthYear + 3;

  if (months !== null) {
    // Day 1 of the birth month: within a known month we still take the earliest
    // possible birthday rather than guess a day.
    const cutoff = Date.UTC(thirdBirthdayYear, (profile.birthMonth ?? 1) - 1, 1) - CUTOFF_LEAD_MS;
    const msLeft = cutoff - now.valueOf();
    if (msLeft <= 0) return null; // past the cutoff: no countdown, cards still render
    if (months >= 36) return null;
    const weeksLeft = Math.max(1, Math.floor(msLeft / (7 * DAY_MS)));
    return weeksLeft <= CLOCK_WARNING_WEEKS
      ? { kind: "dated", weeksLeft, cutoff: new Date(cutoff) }
      : null;
  }

  // Only the year. The birthday could be January 1st or December 31st, so the
  // cutoff is a window between those two — and never a number of weeks.
  const earliest = Date.UTC(thirdBirthdayYear, 0, 1) - CUTOFF_LEAD_MS;
  const latest = Date.UTC(thirdBirthdayYear, 11, 31) - CUTOFF_LEAD_MS;
  if (latest <= now.valueOf()) return null; // every possible cutoff is behind us
  // Visibility follows the earliest possible cutoff, same as before.
  if (earliest - now.valueOf() > CLOCK_WARNING_WEEKS * 7 * DAY_MS) return null;
  return {
    kind: "range",
    earliest: earliest > now.valueOf() ? new Date(earliest) : null,
    latest: new Date(latest)
  };
}

/** Weeks to the cutoff when we can honestly count them, and nothing when we cannot. */
export function firstStepsWeeksLeft(clock: FirstStepsClock | null): number | null {
  return clock?.kind === "dated" ? clock.weeksLeft : null;
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
