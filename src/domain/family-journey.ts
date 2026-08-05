import { firstStepsClock, hasEnrolledFirstSteps } from "./family-clocks";
import { getFamilyResourceById } from "./family-resources";
import { pendingFamilySafetyEvent } from "./family-safety";
import {
  activeFamilyAppointment,
  dueFamilyReminder,
  overdueFamilyAppointment
} from "./family-appointments";
import type { FamilyNavigatorState, FamilyResourceStep } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A month of silence is the check-in trigger — derived, never stored. */
export const CHECKIN_DUE_DAYS = 30;

// A planned or tried step goes stale after a week; that is when the follow-up
// turn earns its one ask.
const STEP_STALE_DAYS = 7;

// The header rung only shouts about the First Steps cutoff in its urgent tail.
// The resource card carries the calmer, wider window.
const RUNG_CLOCK_WEEKS = 8;

function daysBetween(from: Date, to: Date): number {
  return (to.valueOf() - from.valueOf()) / DAY_MS;
}

function isRealTimestamp(value: string): boolean {
  return !Number.isNaN(new Date(value).valueOf());
}

/**
 * Every stamp that counts as the family doing something. Screen answers are
 * deliberately absent — they carry no timestamp to honestly report.
 */
function familyTouchTimestamps(family: FamilyNavigatorState): string[] {
  return [
    ...family.interviews.map(({ createdAt }) => createdAt),
    ...family.steps.map(({ updatedAt }) => updatedAt),
    ...family.pulses.map(({ at }) => at),
    ...family.flags.flatMap(({ raisedAt, acknowledgedAt }) =>
      acknowledgedAt === undefined ? [raisedAt] : [raisedAt, acknowledgedAt]
    ),
    ...family.saved.map(({ savedAt }) => savedAt),
    ...family.appointments.flatMap(({ createdAt, reminderAcks }) => [
      createdAt,
      ...reminderAcks.map(({ acknowledgedAt }) => acknowledgedAt)
    ]),
    // A skipped check-in leaves no data behind, only this stamp — otherwise the
    // question would come straight back tomorrow.
    ...(family.checkinTouchedAt === null ? [] : [family.checkinTouchedAt])
  ].filter(isRealTimestamp);
}

export function familyLastTouchAt(family: FamilyNavigatorState): string | null {
  const stamps = familyTouchTimestamps(family);
  if (stamps.length === 0) {
    return null;
  }
  return stamps.reduce((latest, candidate) =>
    new Date(candidate).valueOf() > new Date(latest).valueOf() ? candidate : latest
  );
}

export function familyTouches(family: FamilyNavigatorState, since: Date): number {
  if (Number.isNaN(since.valueOf())) {
    return 0;
  }
  return familyTouchTimestamps(family).filter(
    (stamp) => new Date(stamp).valueOf() >= since.valueOf()
  ).length;
}

/**
 * A family that has never touched anything is not nagged — orientation is the
 * first touch, and a brand-new family just had it.
 */
export function checkInDue(family: FamilyNavigatorState, now: Date): boolean {
  if (family.profile === null) {
    return false;
  }
  const last = familyLastTouchAt(family);
  if (last === null) {
    return false;
  }
  return daysBetween(new Date(last), now) > CHECKIN_DUE_DAYS;
}

export function oldestStaleStep(
  steps: FamilyResourceStep[],
  now: Date
): FamilyResourceStep | undefined {
  return steps
    .filter(({ status }) => status === "planned" || status === "tried")
    .filter(({ updatedAt }) => daysBetween(new Date(updatedAt), now) > STEP_STALE_DAYS)
    .reduce<FamilyResourceStep | undefined>(
      (oldest, step) =>
        oldest === undefined ||
        new Date(step.updatedAt).valueOf() < new Date(oldest.updatedAt).valueOf()
          ? step
          : oldest,
      undefined
    );
}

/**
 * The oldest stale step the follow-up turn can actually ask about. Steps are
 * stored by id and survive a catalog revision, so a step whose resource has
 * left the catalog renders no question — and must not become the header's one
 * rung either. Both the turn and the rung read this, so they never disagree.
 */
export function answerableStaleStep(
  steps: FamilyResourceStep[],
  now: Date
): FamilyResourceStep | undefined {
  return oldestStaleStep(
    steps.filter(({ resourceId }) => getFamilyResourceById(resourceId) !== undefined),
    now
  );
}

/** The newest thing the family actually wrote, which is what the journal holds. */
function lastFamilyWriteAt(family: FamilyNavigatorState): string | null {
  const stamps = family.interviews.map(({ createdAt }) => createdAt).filter(isRealTimestamp);
  if (stamps.length === 0) {
    return null;
  }
  return stamps.reduce((latest, candidate) =>
    new Date(candidate).valueOf() > new Date(latest).valueOf() ? candidate : latest
  );
}

export type FamilyRung =
  | { kind: "safety" }
  | { kind: "visit" }
  | { kind: "clinic_now" }
  // `weeksLeft` is absent when only the birth year is known: there is a real
  // cutoff window but no honest number of weeks to it.
  | { kind: "clock"; weeksLeft?: number }
  | { kind: "checkin" }
  | { kind: "step"; resourceId: string }
  | { kind: "journal" }
  | { kind: "quiet" };

/**
 * What the page is showing that the stored state cannot say on its own. The
 * check-in card outlives the month of silence that summoned it — the
 * caregiver's first answer stamps a touch — and while it is up the follow-up
 * turn is suppressed, so without this the header would point past it at a
 * section that is not in the document.
 */
export type FamilyRungView = {
  /** True while the check-in card is mounted and owns the page's one ask. */
  checkinOpen?: boolean;
  /**
   * True while a conversation is underway in the thread. The step section is
   * additionally gated on this — one ask at a time — and the gate stays on
   * through `status === "complete"`, so after any note submission the step rung
   * was pointing at #family-followup, a section that is not on the page. F7a:
   * the rung computation now receives the same input the render does, which is
   * what the invariant above has always claimed.
   */
  threadActive?: boolean;
};

/**
 * The single next thing, in the spec's fixed priority order. One rung at a time
 * is the whole point: the header points, it never asks.
 *
 * Every rung names a section, and the header links to it, so the invariant here
 * is that a rung only fires when the section that owns it is on the page. A
 * rung whose anchor is missing is the header's one control doing nothing.
 */
export function nextFamilyRung(
  family: FamilyNavigatorState,
  now: Date,
  view: FamilyRungView = {}
): FamilyRung {
  if (pendingFamilySafetyEvent(family.safetyEvents) !== undefined) {
    return { kind: "safety" };
  }

  // The appointment companion is a whole surface now, and that surface exists
  // only once a referral fits this child — so without one there is nothing for
  // this rung to point at.
  const appointment = family.referral === null ? undefined : activeFamilyAppointment(family.appointments);
  if (
    appointment !== undefined &&
    (dueFamilyReminder(appointment, now) !== null ||
      overdueFamilyAppointment(appointment, now) ||
      appointment.status === "offered" ||
      appointment.status === "missed" ||
      appointment.status === "replaced")
  ) {
    return { kind: "visit" };
  }

  if (family.flags.some(({ acknowledgedAt }) => acknowledgedAt === undefined)) {
    return { kind: "clinic_now" };
  }

  // The countdown itself lives on the First Steps card, inside the resources
  // section — and both only exist once early intervention is an active domain.
  // A profile alone is not enough: without the section there is no card to
  // carry the weeks and no anchor to scroll to.
  const clock =
    family.profile && family.activeDomains.includes("early_intervention")
      ? firstStepsClock(family.profile, now, hasEnrolledFirstSteps(family))
      : null;
  if (clock !== null) {
    // A dated cutoff only earns the header once it is close. A year-only window
    // has no distance to measure, so it points as soon as the clock is showing —
    // the one tap that fixes it (add the birth month) lives on that card.
    if (clock.kind === "range") {
      return { kind: "clock" };
    }
    if (clock.weeksLeft <= RUNG_CLOCK_WEEKS) {
      return { kind: "clock", weeksLeft: clock.weeksLeft };
    }
  }

  // Once the card is up it stays up for the visit, so the rung stays on it: the
  // caregiver's first answer stamps a touch and would otherwise drop the header
  // to a follow-up turn the check-in is currently hiding.
  if (view.checkinOpen ?? checkInDue(family, now)) {
    return { kind: "checkin" };
  }

  const staleStep = view.threadActive === true ? undefined : answerableStaleStep(family.steps, now);
  if (staleStep !== undefined) {
    return { kind: "step", resourceId: staleStep.resourceId };
  }

  // Measured against the journal itself, not against any touch. Sharing the
  // check-in's clock left this rung reachable only at exactly 30.000 quiet
  // days, because every longer silence is a check-in first; a family who
  // answered or skipped the check-in has a fresh touch but may still not have
  // written anything in a month, and that is what this nudge is for.
  const lastWrite = lastFamilyWriteAt(family);
  if (lastWrite !== null && daysBetween(new Date(lastWrite), now) >= CHECKIN_DUE_DAYS) {
    return { kind: "journal" };
  }

  return { kind: "quiet" };
}

/** Whole months on the list, floored — never a prediction, only elapsed time. */
export function monthsOnList(referredAt: string, now: Date): number {
  const start = new Date(referredAt);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(now.valueOf())) {
    return 0;
  }
  const rawMonths =
    (now.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - start.getUTCMonth());
  const beforeAnniversary = now.getUTCDate() < start.getUTCDate();
  return Math.max(0, rawMonths - (beforeAnniversary ? 1 : 0));
}
