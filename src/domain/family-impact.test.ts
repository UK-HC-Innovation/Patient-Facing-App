import { describe, expect, it } from "vitest";
import {
  LADDER_IMPACT_DEMO_AS_OF,
  LADDER_IMPACT_DEMO_COHORT
} from "./family-impact-fixtures";
import { buildFamilyImpactSnapshot, type FamilyImpactCohortMember } from "./family-impact";
import { schoolAgeFamilyState } from "./family-fixtures";

const AS_OF = new Date(LADDER_IMPACT_DEMO_AS_OF);

describe("buildFamilyImpactSnapshot", () => {
  it("reconciles every displayed metric to the frozen synthetic cohort", () => {
    const snapshot = buildFamilyImpactSnapshot(LADDER_IMPACT_DEMO_COHORT, AS_OF);

    expect(snapshot.cohort).toEqual({
      included: 12,
      excludedNotEnrolled: 0,
      excludedMissingProfile: 0
    });
    expect(snapshot.engagement).toEqual({
      numerator: 7,
      denominator: 12,
      percent: 58,
      touches: 8,
      targetPercent: 50
    });
    expect(snapshot.visits).toEqual({
      completed: 6,
      missed: 2,
      pending: 1,
      excludedReplaced: 0,
      followThrough: { numerator: 6, denominator: 8, percent: 75 },
      noShow: { numerator: 2, denominator: 8, percent: 25 },
      noShowReferencePercent: 25
    });
    expect(snapshot.experience).toEqual({
      numerator: 8,
      denominator: 10,
      percent: 80,
      respondingFamilies: 9,
      distribution: { 1: 1, 2: 1, 3: 0, 4: 5, 5: 3 }
    });
  });

  it("reports null rates instead of inventing a percentage for empty denominators", () => {
    const snapshot = buildFamilyImpactSnapshot([], AS_OF);

    expect(snapshot.engagement).toMatchObject({ numerator: 0, denominator: 0, percent: null });
    expect(snapshot.visits.followThrough).toEqual({ numerator: 0, denominator: 0, percent: null });
    expect(snapshot.visits.noShow).toEqual({ numerator: 0, denominator: 0, percent: null });
    expect(snapshot.experience).toMatchObject({ numerator: 0, denominator: 0, percent: null });
  });

  it("excludes future enrollment, missing profiles, and future pulses from their denominators", () => {
    const rows: FamilyImpactCohortMember[] = [
      {
        id: "included",
        enrolledAt: "2026-07-01T12:00:00.000Z",
        family: {
          ...schoolAgeFamilyState,
          appointments: [
            {
              id: "future-outcome",
              clinic: "Fictional clinic",
              offeredSlots: ["2026-08-10T12:00:00.000Z"],
              scheduledFor: "2026-08-10T12:00:00.000Z",
              status: "missed",
              barriers: [],
              barriersAsked: true,
              reminderAcks: [],
              createdAt: "2026-08-02T12:00:00.000Z"
            }
          ],
          pulses: [
            { at: "2026-07-20T12:00:00.000Z", score: 5 },
            { at: "2026-08-02T12:00:00.000Z", score: 1 }
          ]
        }
      },
      {
        id: "future-enrollment",
        enrolledAt: "2026-08-02T12:00:00.000Z",
        family: schoolAgeFamilyState
      },
      {
        id: "missing-profile",
        enrolledAt: "2026-07-01T12:00:00.000Z",
        family: { ...schoolAgeFamilyState, profile: null }
      }
    ];

    const snapshot = buildFamilyImpactSnapshot(rows, AS_OF);

    expect(snapshot.cohort).toEqual({
      included: 1,
      excludedNotEnrolled: 1,
      excludedMissingProfile: 1
    });
    expect(snapshot.engagement).toMatchObject({ numerator: 1, denominator: 1, percent: 100 });
    expect(snapshot.visits.noShow).toEqual({ numerator: 0, denominator: 0, percent: null });
    expect(snapshot.experience).toMatchObject({ numerator: 1, denominator: 1, percent: 100 });
  });

  it("fails closed when the reporting clock is invalid", () => {
    expect(() => buildFamilyImpactSnapshot([], new Date("invalid"))).toThrow(RangeError);
  });
});
