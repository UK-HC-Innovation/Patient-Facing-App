import { firstStepsClock, hasEnrolledFirstSteps } from "./family-clocks";
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

export type FamilyRung =
  | { kind: "safety" }
  | { kind: "visit" }
  | { kind: "clinic_now" }
  | { kind: "clock"; weeksLeft: number }
  | { kind: "checkin" }
  | { kind: "step"; resourceId: string }
  | { kind: "journal" }
  | { kind: "quiet" };

/**
 * The single next thing, in the spec's fixed priority order. One rung at a time
 * is the whole point: the header points, it never asks.
 */
export function nextFamilyRung(family: FamilyNavigatorState, now: Date): FamilyRung {
  if (pendingFamilySafetyEvent(family.safetyEvents) !== undefined) {
    return { kind: "safety" };
  }

  const appointment = activeFamilyAppointment(family.appointments);
  if (
    appointment !== undefined &&
    (dueFamilyReminder(appointment, now) !== null ||
      overdueFamilyAppointment(appointment, now) ||
      appointment.status === "offered" ||
      appointment.status === "missed")
  ) {
    return { kind: "visit" };
  }

  if (family.flags.some(({ acknowledgedAt }) => acknowledgedAt === undefined)) {
    return { kind: "clinic_now" };
  }

  const clock = family.profile
    ? firstStepsClock(family.profile, now, hasEnrolledFirstSteps(family))
    : null;
  if (clock !== null && clock.weeksLeft <= RUNG_CLOCK_WEEKS) {
    return { kind: "clock", weeksLeft: clock.weeksLeft };
  }

  if (checkInDue(family, now)) {
    return { kind: "checkin" };
  }

  const staleStep = oldestStaleStep(family.steps, now);
  if (staleStep !== undefined) {
    return { kind: "step", resourceId: staleStep.resourceId };
  }

  const last = familyLastTouchAt(family);
  if (last !== null && daysBetween(new Date(last), now) >= CHECKIN_DUE_DAYS) {
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
