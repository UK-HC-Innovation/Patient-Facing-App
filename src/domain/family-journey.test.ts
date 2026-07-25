import { describe, expect, it } from "vitest";
import { eighteenMonthFamilyState, schoolAgeFamilyState } from "./family-fixtures";
import {
  CHECKIN_DUE_DAYS,
  checkInDue,
  familyLastTouchAt,
  familyTouches,
  monthsOnList,
  nextFamilyRung,
  oldestStaleStep
} from "./family-journey";
import type {
  FamilyAppointment,
  FamilyInterview,
  FamilyNavigatorState,
  FamilyResourceStep
} from "./types";

const NOW = new Date("2026-07-17T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(NOW.valueOf() - days * DAY_MS).toISOString();
}

function interview(createdAt: string, id = `interview-${createdAt}`): FamilyInterview {
  return {
    id,
    rawText: "He is pointing at pictures now.",
    source: "typed",
    createdAt,
    extraction: "mock",
    kind: "note"
  };
}

// Steps stay semantically coherent (updatedAt >= plannedAt) so the fixtures
// match what the storage sanitizer would actually keep.
function step(overrides: Partial<FamilyResourceStep> = {}): FamilyResourceStep {
  const plannedAt = overrides.plannedAt ?? overrides.updatedAt ?? daysAgo(20);
  return {
    id: "step-1",
    resourceId: "first-steps",
    domain: "early_intervention",
    status: "planned",
    plannedAt,
    updatedAt: plannedAt,
    ...overrides
  };
}

function appointment(overrides: Partial<FamilyAppointment> = {}): FamilyAppointment {
  return {
    id: "appointment-1",
    clinic: "UK Developmental Pediatrics",
    offeredSlots: [],
    status: "offered",
    barriers: [],
    barriersAsked: false,
    reminderAcks: [],
    createdAt: daysAgo(60),
    ...overrides
  };
}

const base = schoolAgeFamilyState;
const STAMP = daysAgo(5);

describe("familyLastTouchAt", () => {
  it("returns null for a family that has not done anything yet", () => {
    expect(familyLastTouchAt(base)).toBeNull();
  });

  const singleSourceStates: Array<{ source: string; state: FamilyNavigatorState }> = [
    { source: "interviews", state: { ...base, interviews: [interview(STAMP)] } },
    { source: "steps", state: { ...base, steps: [step({ plannedAt: STAMP, updatedAt: STAMP })] } },
    { source: "pulses", state: { ...base, pulses: [{ at: STAMP, score: 3 }] } },
    {
      source: "raised flags",
      state: {
        ...base,
        flags: [{ id: "flag-1", type: "regression", source: "text", raisedAt: STAMP }]
      }
    },
    {
      source: "acknowledged flags",
      state: {
        ...base,
        flags: [
          {
            id: "flag-1",
            type: "regression",
            source: "text",
            raisedAt: daysAgo(9),
            acknowledgedAt: STAMP
          }
        ]
      }
    },
    {
      source: "saved resources",
      state: { ...base, saved: [{ resourceId: "first-steps", savedAt: STAMP, domain: "therapies" }] }
    },
    { source: "appointments", state: { ...base, appointments: [appointment({ createdAt: STAMP })] } },
    {
      source: "reminder acknowledgements",
      state: {
        ...base,
        appointments: [
          appointment({
            createdAt: daysAgo(9),
            reminderAcks: [{ offset: "t3", acknowledgedAt: STAMP }]
          })
        ]
      }
    }
  ];

  it.each(singleSourceStates)("counts $source as a touch", ({ state }) => {
    expect(familyLastTouchAt(state)).toBe(STAMP);
  });

  it("picks the newest timestamp when every source has one", () => {
    const family: FamilyNavigatorState = {
      ...base,
      interviews: [interview(daysAgo(60))],
      steps: [step({ plannedAt: daysAgo(50), updatedAt: daysAgo(45) })],
      pulses: [{ at: daysAgo(40), score: 4 }],
      flags: [
        {
          id: "flag-1",
          type: "regression",
          source: "probe",
          raisedAt: daysAgo(35),
          acknowledgedAt: daysAgo(30)
        }
      ],
      saved: [{ resourceId: "first-steps", savedAt: daysAgo(25), domain: "early_intervention" }],
      appointments: [
        appointment({
          createdAt: daysAgo(20),
          reminderAcks: [{ offset: "t14", acknowledgedAt: daysAgo(2) }]
        })
      ]
    };
    expect(familyLastTouchAt(family)).toBe(daysAgo(2));
  });
});

describe("familyTouches", () => {
  it("counts only the touches at or after the cutoff", () => {
    const family: FamilyNavigatorState = {
      ...base,
      interviews: [interview(daysAgo(40), "old"), interview(daysAgo(10), "recent")],
      pulses: [{ at: daysAgo(1), score: 5 }]
    };
    expect(familyTouches(family, new Date(NOW.valueOf() - 30 * DAY_MS))).toBe(2);
    expect(familyTouches(family, new Date(NOW.valueOf() - 60 * DAY_MS))).toBe(3);
  });
});

describe("checkInDue", () => {
  it("leaves a brand-new family alone", () => {
    expect(checkInDue({ ...base, interviews: [interview(daysAgo(1))] }, NOW)).toBe(false);
    expect(checkInDue(base, NOW)).toBe(false);
  });

  it("comes due once the last touch passes 30 days", () => {
    expect(checkInDue({ ...base, interviews: [interview(daysAgo(CHECKIN_DUE_DAYS))] }, NOW)).toBe(
      false
    );
    expect(checkInDue({ ...base, interviews: [interview(daysAgo(31))] }, NOW)).toBe(true);
  });

  it("never fires before a profile exists", () => {
    const family: FamilyNavigatorState = {
      ...base,
      profile: null,
      interviews: [interview(daysAgo(45))]
    };
    expect(checkInDue(family, NOW)).toBe(false);
  });
});

describe("oldestStaleStep", () => {
  it("returns the oldest planned or tried step past a week", () => {
    const steps = [
      step({ id: "fresh", resourceId: "fresh", updatedAt: daysAgo(3) }),
      step({ id: "stale", resourceId: "stale", updatedAt: daysAgo(9) }),
      step({ id: "stalest", resourceId: "stalest", status: "tried", updatedAt: daysAgo(30) })
    ];
    expect(oldestStaleStep(steps, NOW)?.id).toBe("stalest");
  });

  it("ignores settled steps and steps inside the week", () => {
    const steps = [
      step({ id: "enrolled", status: "enrolled", updatedAt: daysAgo(90) }),
      step({ id: "declined", status: "not_for_us", updatedAt: daysAgo(90) }),
      step({ id: "fresh", updatedAt: daysAgo(7) })
    ];
    expect(oldestStaleStep(steps, NOW)).toBeUndefined();
  });
});

describe("nextFamilyRung", () => {
  it("puts an unacknowledged safety event above everything else", () => {
    const family: FamilyNavigatorState = {
      ...base,
      safetyEvents: [{ id: "safety-1", tier: "crisis", domain: "self_harm", createdAt: daysAgo(1) }],
      appointments: [appointment()],
      flags: [{ id: "flag-1", type: "regression", source: "text", raisedAt: daysAgo(2) }],
      steps: [step({ updatedAt: daysAgo(40) })],
      interviews: [interview(daysAgo(60))]
    };
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "safety" });
  });

  it("puts an offered visit above an unacknowledged flag", () => {
    const family: FamilyNavigatorState = {
      ...base,
      appointments: [appointment({ status: "offered" })],
      flags: [{ id: "flag-1", type: "regression", source: "text", raisedAt: daysAgo(2) }]
    };
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "visit" });
  });

  it("puts an unacknowledged flag above a due check-in", () => {
    const family: FamilyNavigatorState = {
      ...base,
      flags: [{ id: "flag-1", type: "regression", source: "probe", raisedAt: daysAgo(45) }],
      interviews: [interview(daysAgo(45))]
    };
    expect(checkInDue(family, NOW)).toBe(true);
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "clinic_now" });
  });

  it("raises no clock rung while the First Steps clock is stubbed (Task 8 lands it)", () => {
    const family: FamilyNavigatorState = {
      ...eighteenMonthFamilyState(NOW),
      interviews: [interview(daysAgo(45))]
    };
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "checkin" });
  });

  it("puts a due check-in above a stale step", () => {
    const family: FamilyNavigatorState = {
      ...base,
      steps: [step({ resourceId: "first-steps", updatedAt: daysAgo(40) })],
      interviews: [interview(daysAgo(40))]
    };
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "checkin" });
  });

  it("puts a stale step above the journal nudge once the check-in is not due", () => {
    const family: FamilyNavigatorState = {
      ...base,
      steps: [step({ resourceId: "first-steps", updatedAt: daysAgo(20) })],
      interviews: [interview(daysAgo(2))]
    };
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "step", resourceId: "first-steps" });
  });

  it("falls back to the journal nudge at exactly 30 quiet days", () => {
    const family: FamilyNavigatorState = {
      ...base,
      interviews: [interview(daysAgo(CHECKIN_DUE_DAYS))]
    };
    expect(checkInDue(family, NOW)).toBe(false);
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "journal" });
  });

  it("stays quiet when everything is fresh", () => {
    const family: FamilyNavigatorState = {
      ...base,
      interviews: [interview(daysAgo(1))],
      steps: [step({ updatedAt: daysAgo(1) })],
      appointments: [appointment({ status: "completed", scheduledFor: daysAgo(3) })]
    };
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "quiet" });
  });
});

describe("monthsOnList", () => {
  it("counts whole months since the referral", () => {
    expect(monthsOnList("2026-03-10T00:00:00.000Z", NOW)).toBe(4);
  });

  it("returns 0 inside the first month and never goes negative", () => {
    expect(monthsOnList("2026-07-01T00:00:00.000Z", NOW)).toBe(0);
    expect(monthsOnList("2026-09-01T00:00:00.000Z", NOW)).toBe(0);
  });
});
