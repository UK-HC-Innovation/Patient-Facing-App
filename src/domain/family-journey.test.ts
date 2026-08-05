import { describe, expect, it } from "vitest";
import type { FamilyNavigatorState } from "./types";
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
// match what the storage sanitizer would actually keep. The default resource id
// is a real catalog entry, because only a step the page can name gets a rung.
function step(overrides: Partial<FamilyResourceStep> = {}): FamilyResourceStep {
  const plannedAt = overrides.plannedAt ?? overrides.updatedAt ?? daysAgo(20);
  return {
    id: "step-1",
    resourceId: "first_steps_statewide",
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
// The appointment companion is its own surface, and it only exists once a
// referral fits the child — so the visit rung needs one behind it.
const REFERRAL = { clinic: "UK Developmental Pediatrics", referredAt: daysAgo(120) };

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
    },
    // A skipped check-in leaves no data, only this stamp — and it still counts.
    { source: "a skipped check-in", state: { ...base, checkinTouchedAt: STAMP } }
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

  it("rests for a month once the check-in is answered or skipped", () => {
    const stale: FamilyNavigatorState = { ...base, interviews: [interview(daysAgo(45))] };

    expect(checkInDue(stale, NOW)).toBe(true);
    expect(checkInDue({ ...stale, checkinTouchedAt: daysAgo(1) }, NOW)).toBe(false);
    expect(checkInDue({ ...stale, checkinTouchedAt: daysAgo(31) }, NOW)).toBe(true);
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
      referral: REFERRAL,
      appointments: [appointment({ status: "offered" })],
      flags: [{ id: "flag-1", type: "regression", source: "text", raisedAt: daysAgo(2) }]
    };
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "visit" });
  });

  it("puts a replaced latest visit above an unacknowledged flag so the card can find a new time", () => {
    const family: FamilyNavigatorState = {
      ...base,
      referral: REFERRAL,
      appointments: [
        appointment({
          status: "replaced",
          offeredSlots: ["2026-08-14T13:30:00.000Z"],
          scheduledFor: "2026-08-14T13:30:00.000Z"
        })
      ],
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

  // The card chip shows from 26 weeks out; the header only spends its one rung on
  // the urgent tail, so an 8-week threshold separates these three cases. Early
  // intervention is active in all of them: that is what puts the First Steps
  // card — and the section the rung links to — on the page at all.
  it("puts the First Steps cutoff above a due check-in inside the urgent tail", () => {
    const family: FamilyNavigatorState = {
      ...eighteenMonthFamilyState(NOW),
      // Born 2023-10 ⇒ cutoff 2026-08-17, four weeks out.
      profile: { ...eighteenMonthFamilyState(NOW).profile!, birthYear: 2023, birthMonth: 10 },
      activeDomains: ["early_intervention"],
      interviews: [interview(daysAgo(45))]
    };
    expect(checkInDue(family, NOW)).toBe(true);
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "clock", weeksLeft: 4 });
  });

  it("leaves the cutoff to the resource card until it reaches eight weeks", () => {
    const family: FamilyNavigatorState = {
      ...eighteenMonthFamilyState(NOW),
      // Born 2023-12 ⇒ cutoff 2026-10-17, thirteen weeks out: chip yes, rung no.
      profile: { ...eighteenMonthFamilyState(NOW).profile!, birthYear: 2023, birthMonth: 12 },
      activeDomains: ["early_intervention"],
      interviews: [interview(daysAgo(45))]
    };
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "checkin" });
  });

  it("drops the clock rung once First Steps is enrolled", () => {
    const family: FamilyNavigatorState = {
      ...eighteenMonthFamilyState(NOW),
      profile: { ...eighteenMonthFamilyState(NOW).profile!, birthYear: 2023, birthMonth: 10 },
      activeDomains: ["early_intervention"],
      interviews: [interview(daysAgo(45))],
      steps: [
        step({
          id: "first-steps-step",
          resourceId: "first_steps_statewide",
          status: "enrolled",
          plannedAt: daysAgo(50),
          updatedAt: daysAgo(45)
        })
      ]
    };
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "checkin" });
  });

  // The rung links to #family-resources, and that section is only on the page
  // once a domain is active — so the countdown waits for the section that
  // carries it rather than becoming a link to nothing.
  it("holds the clock rung until early intervention is an active domain", () => {
    const inUrgentTail: FamilyNavigatorState = {
      ...eighteenMonthFamilyState(NOW),
      profile: { ...eighteenMonthFamilyState(NOW).profile!, birthYear: 2023, birthMonth: 10 },
      interviews: [interview(daysAgo(45))]
    };

    expect(nextFamilyRung(inUrgentTail, NOW)).toEqual({ kind: "checkin" });
    expect(
      nextFamilyRung({ ...inUrgentTail, activeDomains: ["waivers_financial"] }, NOW)
    ).toEqual({ kind: "checkin" });
    expect(
      nextFamilyRung({ ...inUrgentTail, activeDomains: ["early_intervention"] }, NOW)
    ).toEqual({ kind: "clock", weeksLeft: 4 });
  });

  it("raises no clock rung for a family with no profile", () => {
    const family: FamilyNavigatorState = {
      ...base,
      profile: null,
      interviews: [interview(daysAgo(45))]
    };
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "journal" });
  });

  it("puts a due check-in above a stale step", () => {
    const family: FamilyNavigatorState = {
      ...base,
      steps: [step({ updatedAt: daysAgo(40) })],
      interviews: [interview(daysAgo(40))]
    };
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "checkin" });
  });

  // The card stays for the rest of the visit once it is started, and it hides
  // the follow-up turn while it is up — so the rung stays on it even after the
  // first answer stamps a touch and ends the month of silence.
  it("keeps the rung on an open check-in card that is no longer due", () => {
    const family: FamilyNavigatorState = {
      ...base,
      steps: [step({ updatedAt: daysAgo(20) })],
      interviews: [interview(daysAgo(2))],
      pulses: [{ at: daysAgo(0), score: 4 }]
    };

    expect(checkInDue(family, NOW)).toBe(false);
    expect(nextFamilyRung(family, NOW, { checkinOpen: true })).toEqual({ kind: "checkin" });
    expect(nextFamilyRung(family, NOW, { checkinOpen: false })).toEqual({
      kind: "step",
      resourceId: "first_steps_statewide"
    });
  });

  it("puts a stale step above the journal nudge once the check-in is not due", () => {
    const family: FamilyNavigatorState = {
      ...base,
      steps: [step({ updatedAt: daysAgo(20) })],
      interviews: [interview(daysAgo(2))]
    };
    expect(nextFamilyRung(family, NOW)).toEqual({
      kind: "step",
      resourceId: "first_steps_statewide"
    });
  });

  // A step whose resource left the catalog renders no follow-up question, so it
  // cannot be the rung either.
  it("skips a stale step whose resource is no longer in the catalog", () => {
    const family: FamilyNavigatorState = {
      ...base,
      steps: [step({ id: "retired", resourceId: "retired_resource", updatedAt: daysAgo(20) })],
      interviews: [interview(daysAgo(2))]
    };
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "quiet" });
  });

  it("falls back to the journal nudge at exactly 30 quiet days", () => {
    const family: FamilyNavigatorState = {
      ...base,
      interviews: [interview(daysAgo(CHECKIN_DUE_DAYS))]
    };
    expect(checkInDue(family, NOW)).toBe(false);
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "journal" });
  });

  // Sharing the check-in's clock left this rung reachable only at exactly
  // 30.000 quiet days. Answering or skipping the check-in is a touch but not a
  // note, so the journal is what has actually gone quiet.
  it("reaches the journal nudge after the check-in is answered", () => {
    const family: FamilyNavigatorState = {
      ...base,
      interviews: [interview(daysAgo(45))],
      pulses: [{ at: daysAgo(1), score: 4 }],
      checkinTouchedAt: daysAgo(1)
    };

    expect(checkInDue(family, NOW)).toBe(false);
    expect(familyLastTouchAt(family)).toBe(daysAgo(1));
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "journal" });
  });

  it("stays quiet for a family that has written recently", () => {
    const family: FamilyNavigatorState = {
      ...base,
      interviews: [interview(daysAgo(29))],
      checkinTouchedAt: daysAgo(1)
    };
    expect(nextFamilyRung(family, NOW)).toEqual({ kind: "quiet" });
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

// F7a. The invariant this module states — "a rung only fires when the section
// that owns it is on the page" — was not enforced for the step rung: the page
// gates that section on the thread as well, and the rung computation was never
// told about the thread.
describe("the step rung yields to an open thread", () => {
  const now = new Date("2026-07-17T12:00:00.000Z");
  const stale: FamilyNavigatorState = {
    ...schoolAgeFamilyState,
    steps: [
      {
        id: "step-1",
        resourceId: "michelle_p_waiver",
        domain: "waivers_financial",
        status: "planned",
        plannedAt: "2026-06-01T12:00:00.000Z",
        updatedAt: "2026-06-01T12:00:00.000Z"
      }
    ]
  };

  // checkinOpen: false keeps the monthly check-in — which outranks the step —
  // out of the way, so this is a clean read of the step rung alone.
  it("offers the step when the section is on the page", () => {
    expect(nextFamilyRung(stale, now, { checkinOpen: false })).toEqual({
      kind: "step",
      resourceId: "michelle_p_waiver"
    });
  });

  it("stands down while the thread owns the ask", () => {
    expect(nextFamilyRung(stale, now, { checkinOpen: false, threadActive: true }).kind).not.toBe(
      "step"
    );
  });
});
