import { schoolAgeFamilyState } from "./family-fixtures";
import type { FamilyImpactCohortMember } from "./family-impact";
import type {
  FamilyAppointment,
  FamilyInterview,
  FamilyNavigatorState,
  FamilyPulse,
  FamilyResourceStep
} from "./types";

export const LADDER_IMPACT_DEMO_AS_OF = "2026-08-01T12:00:00.000Z";

const FICTIONAL_CLINIC = "Bluegrass Development Clinic (fictional)";
const ENROLLED_AT = "2026-01-05T12:00:00.000Z";

function note(id: string, createdAt: string, kind: FamilyInterview["kind"] = "note"): FamilyInterview {
  return {
    id,
    rawText: "Synthetic dashboard activity",
    source: "typed",
    createdAt,
    extraction: "mock",
    kind
  };
}

function step(id: string, updatedAt: string): FamilyResourceStep {
  return {
    id,
    resourceId: "first_steps_statewide",
    domain: "early_intervention",
    status: "in_touch",
    plannedAt: "2026-05-01T12:00:00.000Z",
    updatedAt
  };
}

function appointment(
  id: string,
  status: FamilyAppointment["status"],
  createdAt: string
): FamilyAppointment {
  const scheduledFor = status === "booked" ? "2026-08-20T13:30:00.000Z" : "2026-06-20T13:30:00.000Z";
  return {
    id,
    clinic: FICTIONAL_CLINIC,
    offeredSlots: [scheduledFor],
    ...(status === "offered" ? {} : { scheduledFor }),
    status,
    barriers: [],
    barriersAsked: status !== "offered",
    reminderAcks: [],
    createdAt
  };
}

function member(
  id: string,
  family: Partial<FamilyNavigatorState>,
  pulses: FamilyPulse[] = []
): FamilyImpactCohortMember {
  return {
    id,
    enrolledAt: ENROLLED_AT,
    family: {
      ...schoolAgeFamilyState,
      profile: {
        ...schoolAgeFamilyState.profile!,
        childFirstName: `Demo ${id.slice(-2)}`,
        diagnoses: []
      },
      referral: { clinic: FICTIONAL_CLINIC, referredAt: ENROLLED_AT },
      ...family,
      pulses
    }
  };
}

/**
 * Frozen, invented rows for stakeholder walkthroughs. The mix is deliberate:
 * 7/12 engaged in the trailing 30 days, 6/8 completed outcomes (2/8 missed),
 * and 8/10 scored pulses at 4-5. No row represents a real family or clinic.
 */
export const LADDER_IMPACT_DEMO_COHORT: readonly FamilyImpactCohortMember[] = [
  member(
    "synthetic-01",
    {
      interviews: [note("note-01", "2026-07-28T12:00:00.000Z")],
      appointments: [appointment("visit-01", "completed", "2026-05-10T12:00:00.000Z")]
    },
    [
      { at: "2026-06-01T12:00:00.000Z", score: 5 },
      { at: "2026-07-28T12:05:00.000Z", score: 4 }
    ]
  ),
  member(
    "synthetic-02",
    {
      appointments: [appointment("visit-02", "completed", "2026-04-10T12:00:00.000Z")]
    },
    [{ at: "2026-07-20T12:00:00.000Z", score: 4 }]
  ),
  member(
    "synthetic-03",
    {
      steps: [step("step-03", "2026-07-15T12:00:00.000Z")],
      appointments: [appointment("visit-03", "missed", "2026-05-12T12:00:00.000Z")]
    },
    [{ at: "2026-05-30T12:00:00.000Z", score: 4 }]
  ),
  member(
    "synthetic-04",
    {
      flags: [
        {
          id: "flag-04",
          type: "regression",
          source: "probe",
          raisedAt: "2026-07-10T12:00:00.000Z"
        }
      ],
      appointments: [appointment("visit-04", "completed", "2026-04-18T12:00:00.000Z")]
    },
    [{ at: "2026-06-10T12:00:00.000Z", score: 5 }]
  ),
  member(
    "synthetic-05",
    {
      saved: [
        {
          resourceId: "first_steps_statewide",
          savedAt: "2026-07-12T12:00:00.000Z",
          domain: "early_intervention"
        }
      ],
      appointments: [appointment("visit-05", "missed", "2026-05-20T12:00:00.000Z")]
    },
    [{ at: "2026-06-12T12:00:00.000Z", score: 2 }]
  ),
  member(
    "synthetic-06",
    {
      appointments: [appointment("visit-06", "booked", "2026-07-05T12:00:00.000Z")]
    },
    [{ at: "2026-06-15T12:00:00.000Z", score: 4 }]
  ),
  member(
    "synthetic-07",
    {
      checkinTouchedAt: "2026-07-25T12:00:00.000Z",
      appointments: [appointment("visit-07", "completed", "2026-05-25T12:00:00.000Z")]
    },
    [{ at: "2026-06-18T12:00:00.000Z", score: 5 }]
  ),
  member(
    "synthetic-08",
    {
      interviews: [note("note-08", "2026-05-01T12:00:00.000Z")],
      appointments: [appointment("visit-08", "completed", "2026-05-28T12:00:00.000Z")]
    },
    [{ at: "2026-06-20T12:00:00.000Z", score: 4 }]
  ),
  member(
    "synthetic-09",
    {
      interviews: [note("checkin-09", "2026-05-08T12:00:00.000Z", "checkin")],
      appointments: [appointment("visit-09", "completed", "2026-05-30T12:00:00.000Z")]
    },
    [{ at: "2026-06-22T12:00:00.000Z", score: 1 }]
  ),
  member("synthetic-10", { interviews: [note("note-10", "2026-04-01T12:00:00.000Z")] }),
  member("synthetic-11", { steps: [step("step-11", "2026-05-15T12:00:00.000Z")] }),
  member("synthetic-12", {})
];
