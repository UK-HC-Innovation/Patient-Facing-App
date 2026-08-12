import { CHECKIN_DUE_DAYS, familyEngagement } from "./family-journey";
import type { FamilyNavigatorState, FamilyPulse } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export const LADDER_ENGAGEMENT_TARGET_PERCENT = 50;
export const LADDER_NO_SHOW_REFERENCE_PERCENT = 25;

export type FamilyImpactCohortMember = {
  /** Synthetic row id only. The dashboard never needs a child or caregiver name. */
  id: string;
  enrolledAt: string;
  family: FamilyNavigatorState;
};

export type ImpactRate = {
  numerator: number;
  denominator: number;
  percent: number | null;
};

export type FamilyImpactSnapshot = {
  asOf: string;
  windowStart: string;
  cohort: {
    included: number;
    excludedNotEnrolled: number;
    excludedMissingProfile: number;
  };
  engagement: ImpactRate & {
    touches: number;
    targetPercent: number;
  };
  visits: {
    completed: number;
    missed: number;
    pending: number;
    excludedReplaced: number;
    followThrough: ImpactRate;
    noShow: ImpactRate;
    noShowReferencePercent: number;
  };
  experience: ImpactRate & {
    respondingFamilies: number;
    distribution: Record<FamilyPulse["score"], number>;
  };
};

function percent(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.round((numerator / denominator) * 100);
}

function isAtOrBefore(value: string, through: Date): boolean {
  const at = new Date(value).valueOf();
  return Number.isFinite(at) && at <= through.valueOf();
}

/**
 * Spec 21's complete metric model. It reads the existing persisted journey
 * records; it does not introduce analytics events, cookies, or network calls.
 */
export function buildFamilyImpactSnapshot(
  members: readonly FamilyImpactCohortMember[],
  asOf: Date
): FamilyImpactSnapshot {
  if (Number.isNaN(asOf.valueOf())) {
    throw new RangeError("A valid dashboard as-of timestamp is required.");
  }

  const windowStart = new Date(asOf.valueOf() - CHECKIN_DUE_DAYS * DAY_MS);
  const enrolled = members.filter(({ enrolledAt }) => isAtOrBefore(enrolledAt, asOf));
  const included = enrolled.filter(({ family }) => family.profile !== null);

  const engagementRows = included.map(({ family }) => familyEngagement(family, asOf));
  const engagedFamilies = engagementRows.filter(({ touchesInLast30Days }) => touchesInLast30Days > 0)
    .length;
  const touches = engagementRows.reduce(
    (total, { touchesInLast30Days }) => total + touchesInLast30Days,
    0
  );

  const appointments = included.flatMap(({ family }) =>
    family.appointments.filter(({ createdAt }) => isAtOrBefore(createdAt, asOf))
  );
  const completed = appointments.filter(({ status }) => status === "completed").length;
  const missed = appointments.filter(({ status }) => status === "missed").length;
  const pending = appointments.filter(({ status }) =>
    status === "offered" || status === "booked" || status === "confirmed"
  ).length;
  const excludedReplaced = appointments.filter(({ status }) => status === "replaced").length;
  const outcomeDenominator = completed + missed;

  const pulseRows = included.flatMap(({ id, family }) =>
    family.pulses
      .filter(({ at }) => isAtOrBefore(at, asOf))
      .map((pulse) => ({ memberId: id, pulse }))
  );
  const positivePulses = pulseRows.filter(({ pulse }) => pulse.score >= 4).length;
  const distribution: Record<FamilyPulse["score"], number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0
  };
  for (const { pulse } of pulseRows) {
    distribution[pulse.score] += 1;
  }

  return {
    asOf: asOf.toISOString(),
    windowStart: windowStart.toISOString(),
    cohort: {
      included: included.length,
      excludedNotEnrolled: members.length - enrolled.length,
      excludedMissingProfile: enrolled.length - included.length
    },
    engagement: {
      numerator: engagedFamilies,
      denominator: included.length,
      percent: percent(engagedFamilies, included.length),
      touches,
      targetPercent: LADDER_ENGAGEMENT_TARGET_PERCENT
    },
    visits: {
      completed,
      missed,
      pending,
      excludedReplaced,
      followThrough: {
        numerator: completed,
        denominator: outcomeDenominator,
        percent: percent(completed, outcomeDenominator)
      },
      noShow: {
        numerator: missed,
        denominator: outcomeDenominator,
        percent: percent(missed, outcomeDenominator)
      },
      noShowReferencePercent: LADDER_NO_SHOW_REFERENCE_PERCENT
    },
    experience: {
      numerator: positivePulses,
      denominator: pulseRows.length,
      percent: percent(positivePulses, pulseRows.length),
      respondingFamilies: new Set(pulseRows.map(({ memberId }) => memberId)).size,
      distribution
    }
  };
}
