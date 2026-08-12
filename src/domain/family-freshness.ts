/**
 * The one mechanism in this app that ever notices a fact going stale.
 *
 * Spec 20 F5a. `verifiedAt` was display-only: no build, test, or surface ever
 * compared it to today, so a dead phone number or a year-old waitlist count
 * would sit on a card forever wearing a "Checked on" date that only got older.
 * `family-freshness.test.ts` turns that date into a failing test.
 *
 * This is a deliberate time bomb, and the trade is named in Open Question 1 of
 * the spec: when the budget passes, `npm run check` starts failing with no code
 * change, because nothing else in the world will tell us the catalog decayed.
 * The two ways out are both honest — re-verify, or allowlist with a reason and a
 * review-by date.
 */
export const FRESHNESS_BUDGET_DAYS = 45;

export type StaleAccepted = {
  id: string;
  /** Review-by date. Past it, the allowlist entry itself fails the test. */
  until: string;
  reason: string;
};

/**
 * Entries a machine cannot re-verify, each with a reason and an expiry, so the
 * allowlist can never quietly become the permanent answer.
 */
export const STALE_ACCEPTED: readonly StaleAccepted[] = [
  {
    id: "dsack",
    until: "2026-10-01",
    reason:
      "dsack.org returned 403 to the checker on 2026-08-12; a manual browser review confirmed the current program and contact pages."
  }
];

export type FreshnessSubject = {
  id: string;
  catalog: string;
  verifiedAt: string;
  humanVerify?: boolean;
};

export type StaleEntry = FreshnessSubject & { ageDays: number };

function ageInDays(verifiedAt: string, now: Date): number {
  return (now.valueOf() - new Date(`${verifiedAt}T00:00:00.000Z`).valueOf()) / (24 * 60 * 60 * 1000);
}

/**
 * Runtime truth for a single card. Unlike the build gate below, this ignores
 * allowlists and `humanVerify`: those are maintenance escape hatches, not a
 * reason to let a caregiver mistake old evidence for current evidence. Invalid
 * and future dates fail closed because neither can support a "checked" claim.
 */
export function catalogEntryNeedsRefresh(
  subject: Pick<FreshnessSubject, "verifiedAt">,
  now: Date = new Date()
): boolean {
  const ageDays = ageInDays(subject.verifiedAt, now);
  return !Number.isFinite(ageDays) || ageDays < 0 || ageDays > FRESHNESS_BUDGET_DAYS;
}

/**
 * Everything past the budget that is neither owner-owned (`humanVerify`) nor on
 * a live allowlist entry. Returned rather than thrown so the failure message can
 * name every offender and its age at once.
 */
export function staleCatalogEntries(
  subjects: readonly FreshnessSubject[],
  now: Date,
  accepted: readonly StaleAccepted[] = STALE_ACCEPTED
): StaleEntry[] {
  const live = new Set(
    accepted.filter((entry) => new Date(`${entry.until}T00:00:00.000Z`).valueOf() > now.valueOf()).map(({ id }) => id)
  );
  return subjects
    .filter((subject) => subject.humanVerify !== true && !live.has(subject.id))
    .map((subject) => ({ ...subject, ageDays: ageInDays(subject.verifiedAt, now) }))
    .filter(({ ageDays }) => ageDays > FRESHNESS_BUDGET_DAYS)
    .sort((left, right) => right.ageDays - left.ageDays);
}

/** Allowlist entries whose own review-by date has passed. */
export function expiredStaleAcceptances(
  now: Date,
  accepted: readonly StaleAccepted[] = STALE_ACCEPTED
): StaleAccepted[] {
  return accepted.filter(
    (entry) => new Date(`${entry.until}T00:00:00.000Z`).valueOf() <= now.valueOf()
  );
}
