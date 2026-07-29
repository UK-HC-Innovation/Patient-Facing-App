import { beforeEach, describe, expect, it, vi } from "vitest";
import { firstStepsClock, hasEnrolledFirstSteps } from "@/domain/family-clocks";
import { createFamilyAppointmentOffer, createSoonerAppointmentOffer } from "@/domain/family-appointments";
import { brentState, deletedDemoState, demoState } from "@/domain/fixtures";
import { INSTRUMENTS } from "@/domain/instruments/registry";
import type { ScreeningInstrument } from "@/domain/instruments/types";
import { clearStoredState, loadStoredState, saveStoredState } from "./storage";
import { healthReducer } from "./store";
import type {
  FamilyAppointment,
  FamilyFlag,
  FamilyNavigatorState,
  FamilyResourceStep
} from "@/domain/types";

const STORAGE_KEY = "home-health-ai-ownership-state";

describe("storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const validFamily: FamilyNavigatorState = {
    profile: {
      childFirstName: "Riley",
      birthYear: 2017,
      birthMonth: 5,
      schoolStage: "elementary",
      county: "Scott",
      diagnoses: [
        { id: "diagnosis-dyslexia", label: "dyslexia", diagnosedAt: "2026-05" },
        { id: "diagnosis-adhd", label: "adhd" }
      ]
    },
    referral: null,
    appointments: [],
    safetyEvents: [],
    recommendations: null,
    interviewDraft: "Riley is in fourth grade.",
    screenAnswers: [{ questionId: "school", domain: "school_iep", response: "yes" }],
    interviews: [
      {
        id: "interview-1",
        rawText: "Reading homework is hard.",
        source: "typed",
        createdAt: "2026-07-17T12:00:00.000Z",
        extraction: "mock",
        kind: "orientation"
      }
    ],
    facts: [
      {
        id: "fact-1",
        interviewId: "interview-1",
        label: "Homework",
        value: "hard",
        status: "patient_reported",
        sourceSnippet: "Reading homework is hard."
      }
    ],
    latestInterviewDomains: ["school_iep"],
    activeDomains: ["school_iep", "school_iep"],
    saved: [
      { resourceId: "ky-spin", savedAt: "2026-07-17T12:00:00.000Z", domain: "parent_support" }
    ],
    alreadyEnrolled: ["first-steps", "first-steps"],
    steps: [],
    pulses: [],
    flags: [],
    soonerList: null,
    packetQuestionIds: [],
    checkinTouchedAt: null
  };

  it("backfills a pre-family payload to null without resetting adult state", () => {
    const original: Record<string, unknown> = {
      ...demoState,
      patient: { ...demoState.patient, name: "Original Adult", preferredName: "Original" }
    };
    delete original.family;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(original));

    expect(loadStoredState()).toMatchObject({ patient: original.patient, family: null });
  });

  it("round-trips a valid family slice and writes sanitized arrays", () => {
    saveStoredState({ ...demoState, family: validFamily });

    const loaded = loadStoredState();

    expect(loaded.family).toMatchObject({
      profile: validFamily.profile,
      safetyEvents: [],
      recommendations: null,
      interviewDraft: validFamily.interviewDraft,
      interviews: validFamily.interviews,
      facts: validFamily.facts
    });
    expect(loaded.family?.activeDomains).toEqual(["school_iep"]);
    expect(loaded.family?.alreadyEnrolled).toEqual(["first-steps"]);
    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string);
    expect(persisted.family.activeDomains).toEqual(["school_iep"]);
  });

  it("drops malformed family entries while retaining valid entries", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        family: {
          ...validFamily,
          profile: {
            ...validFamily.profile,
            diagnoses: [...(validFamily.profile?.diagnoses ?? []), { id: "bad", label: "not-a-diagnosis" }]
          },
          screenAnswers: [...validFamily.screenAnswers, { questionId: "bad", domain: "school_iep", response: "maybe" }],
          interviews: [...validFamily.interviews, { id: "bad" }],
          facts: [
            ...validFamily.facts,
            { id: "bad-status", label: "Imported", value: "bad", status: "imported", sourceSnippet: "bad" }
          ],
          saved: [...validFamily.saved, { resourceId: 123, savedAt: "bad", domain: "therapies" }]
        }
      })
    );

    const loaded = loadStoredState();

    expect(loaded.family?.profile?.diagnoses).toHaveLength(2);
    expect(loaded.family?.screenAnswers).toHaveLength(1);
    expect(loaded.family?.interviews).toHaveLength(1);
    expect(loaded.family?.facts).toHaveLength(1);
    expect(loaded.family?.saved).toHaveLength(1);
    expect(loaded.patient.id).toBe(demoState.patient.id);
  });

  it("turns an invalid family container into null without resetting adult state", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        patient: { ...demoState.patient, name: "Kept Adult", preferredName: "Kept" },
        family: { profile: "invalid" }
      })
    );

    const loaded = loadStoredState();

    expect(loaded.patient.name).toBe("Kept Adult");
    expect(loaded.family).toBeNull();
  });

  it("backfills missing draft and latest interview domains in an otherwise valid family slice", () => {
    const legacyFamily: Record<string, unknown> = { ...validFamily };
    delete legacyFamily.interviewDraft;
    delete legacyFamily.latestInterviewDomains;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...demoState, family: legacyFamily }));

    const loaded = loadStoredState();

    expect(loaded.family?.interviewDraft).toBe("");
    expect(loaded.family?.latestInterviewDomains).toEqual([]);
  });

  it("loads a pre-safety-events family payload intact and backfills the array", () => {
    const preSprintFamily: Record<string, unknown> = { ...validFamily };
    delete preSprintFamily.safetyEvents;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...demoState, family: preSprintFamily }));

    const loaded = loadStoredState();

    expect(loaded.family?.safetyEvents).toEqual([]);
    expect(loaded.family?.profile?.county).toBe(validFamily.profile?.county);
    expect(loaded.family?.activeDomains).toEqual(["school_iep"]);
    expect(loaded.patient.id).toBe(demoState.patient.id);
  });

  it("keeps a stored safety event and drops a malformed one without resetting the slice", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        family: {
          ...validFamily,
          safetyEvents: [
            { id: "event-1", tier: "crisis", domain: "harm_to_others", createdAt: "2026-07-21T00:00:00.000Z" },
            { id: "event-2", tier: "not-a-tier", domain: "self_harm", createdAt: "2026-07-21T00:00:00.000Z" },
            { tier: "crisis", domain: "self_harm" }
          ]
        }
      })
    );

    const loaded = loadStoredState();

    expect(loaded.family?.safetyEvents).toHaveLength(1);
    expect(loaded.family?.safetyEvents[0]).toMatchObject({ id: "event-1", domain: "harm_to_others" });
    expect(loaded.family?.activeDomains).toEqual(["school_iep"]);
  });

  it("backfills referral and appointments on saves written before Ladder", () => {
    const legacyFamily: Partial<FamilyNavigatorState> = { ...validFamily };
    delete legacyFamily.referral;
    delete legacyFamily.appointments;
    saveStoredState({ ...demoState, family: legacyFamily as FamilyNavigatorState });

    const loaded = loadStoredState();

    expect(loaded.family).not.toBeNull();
    expect(loaded.family?.referral).toBeNull();
    expect(loaded.family?.appointments).toEqual([]);
  });

  it("drops malformed appointments but keeps the family slice", () => {
    saveStoredState({
      ...demoState,
      family: {
        ...validFamily,
        appointments: [{ id: 1 }] as unknown as FamilyNavigatorState["appointments"]
      }
    });

    const loaded = loadStoredState();

    expect(loaded.family).not.toBeNull();
    expect(loaded.family?.appointments).toEqual([]);
  });

  it("preserves a valid referral and appointment on load", () => {
    const appointment: FamilyNavigatorState["appointments"][number] = {
      id: "appointment-1",
      clinic: "UK Developmental Pediatrics",
      offeredSlots: ["2026-08-14T13:30:00.000Z"],
      scheduledFor: "2026-08-14T13:30:00.000Z",
      status: "confirmed",
      barriers: ["ride"],
      barriersAsked: true,
      reminderAcks: [{ offset: "t14", acknowledgedAt: "2026-07-31T12:00:00.000Z" }],
      createdAt: "2026-07-24T12:00:00.000Z"
    };
    const referral = { clinic: "UK Developmental Pediatrics", referredAt: "2026-07-24T12:00:00.000Z" };
    saveStoredState({ ...demoState, family: { ...validFamily, referral, appointments: [appointment] } });

    const loaded = loadStoredState();

    expect(loaded.family?.referral).toEqual(referral);
    expect(loaded.family?.appointments).toEqual([appointment]);
  });

  it("filters a reminder acknowledgement that predates appointment creation without resetting family state", () => {
    const validAppointment: FamilyAppointment = {
      id: "valid-confirmed",
      clinic: "UK Developmental Pediatrics",
      offeredSlots: ["2026-08-14T13:30:00.000Z"],
      scheduledFor: "2026-08-14T13:30:00.000Z",
      status: "confirmed",
      barriers: ["ride"],
      barriersAsked: true,
      reminderAcks: [{ offset: "t1", acknowledgedAt: "2026-07-24T12:00:00.000Z" }],
      createdAt: "2026-07-24T12:00:00.000Z"
    };
    const impossibleAcknowledgement: FamilyAppointment = {
      ...validAppointment,
      id: "pre-creation-acknowledgement",
      reminderAcks: [{ offset: "t1", acknowledgedAt: "2026-07-23T12:00:00.000Z" }]
    };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        family: {
          ...validFamily,
          appointments: [validAppointment, impossibleAcknowledgement]
        }
      })
    );

    const loaded = loadStoredState();

    expect(loaded.family?.appointments).toEqual([validAppointment]);
    expect(loaded.family?.profile).toEqual(validFamily.profile);
  });

  it("keeps coherent rows for every reducer-produced status and filters mixed semantic failures", () => {
    const offered: FamilyAppointment = {
      id: "valid-offered",
      clinic: "UK Developmental Pediatrics",
      offeredSlots: [
        "2026-08-14T13:30:00.000Z",
        "2026-08-21T13:30:00.000Z",
        "2026-08-28T13:30:00.000Z"
      ],
      status: "offered",
      barriers: [],
      barriersAsked: false,
      reminderAcks: [],
      createdAt: "2026-07-24T12:00:00.000Z"
    };
    const scheduledFor = offered.offeredSlots[0];
    const booked: FamilyAppointment = {
      ...offered,
      id: "valid-booked",
      status: "booked",
      scheduledFor
    };
    const confirmed: FamilyAppointment = {
      ...booked,
      id: "valid-confirmed",
      status: "confirmed",
      barriers: ["ride"],
      barriersAsked: true,
      reminderAcks: [{ offset: "t14", acknowledgedAt: "2026-07-31T12:00:00.000Z" }]
    };
    const completed: FamilyAppointment = {
      ...confirmed,
      id: "valid-completed",
      status: "completed"
    };
    const missed: FamilyAppointment = {
      ...booked,
      id: "valid-missed",
      status: "missed"
    };
    // The visit a family gave up when they took an earlier opening.
    const replaced: FamilyAppointment = {
      ...confirmed,
      id: "valid-replaced",
      status: "replaced"
    };
    const backfill: FamilyAppointment = {
      ...booked,
      id: "valid-backfill",
      supersedesId: replaced.id
    };
    const invalidRows: FamilyAppointment[] = [
      { ...backfill, id: "blank-supersedes", supersedesId: "   " },
      { ...backfill, id: "supersedes-itself", supersedesId: "supersedes-itself" },
      { ...offered, id: "bad-created-at", createdAt: "2026-07-24" },
      { ...offered, id: "bad-slot", offeredSlots: ["not-a-date"] },
      {
        ...offered,
        id: "duplicate-slots",
        offeredSlots: [offered.offeredSlots[0], offered.offeredSlots[0]]
      },
      { ...booked, id: "booked-without-schedule", scheduledFor: undefined },
      { ...offered, id: "offered-with-schedule", scheduledFor },
      {
        ...confirmed,
        id: "duplicate-acks",
        reminderAcks: [
          { offset: "t14", acknowledgedAt: "2026-07-31T12:00:00.000Z" },
          { offset: "t14", acknowledgedAt: "2026-08-01T12:00:00.000Z" }
        ]
      },
      { ...booked, id: "barriers-before-ask", barriers: ["ride"], barriersAsked: false },
      { ...booked, id: "asked-without-barriers", barriers: [], barriersAsked: true },
      { ...booked, id: "none-with-ride", barriers: ["none", "ride"], barriersAsked: true },
      { ...confirmed, id: "confirmed-without-ack", reminderAcks: [] },
      { ...offered, id: "   " },
      { ...offered, id: "blank-clinic", clinic: "   " }
    ];
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        family: {
          ...validFamily,
          referral: { clinic: "UK Developmental Pediatrics", referredAt: "2026-07-24" },
          appointments: [
            offered,
            booked,
            confirmed,
            completed,
            missed,
            replaced,
            backfill,
            ...invalidRows
          ]
        }
      })
    );

    const loaded = loadStoredState();

    expect(loaded.family?.referral).toBeNull();
    expect(loaded.family?.appointments.map(({ id }) => id)).toEqual([
      "valid-offered",
      "valid-booked",
      "valid-confirmed",
      "valid-completed",
      "valid-missed",
      "valid-replaced",
      "valid-backfill"
    ]);
    expect(loaded.family?.appointments.at(-1)?.supersedesId).toBe("valid-replaced");
    expect(loaded.family?.profile).toEqual(validFamily.profile);
    expect(loaded.patient.id).toBe(demoState.patient.id);
  });

  it("preserves coherent supersession history while clearing incoherent child links", () => {
    const booked = (id: string): FamilyAppointment => ({
      id,
      clinic: "UK Developmental Pediatrics",
      offeredSlots: ["2026-08-14T13:30:00.000Z"],
      scheduledFor: "2026-08-14T13:30:00.000Z",
      status: "booked",
      barriers: [],
      barriersAsked: false,
      reminderAcks: [],
      createdAt: "2026-07-24T12:00:00.000Z"
    });
    const confirmed = (id: string): FamilyAppointment => ({
      ...booked(id),
      status: "confirmed",
      barriers: ["ride"],
      barriersAsked: true,
      reminderAcks: [{ offset: "t14", acknowledgedAt: "2026-07-31T12:00:00.000Z" }]
    });
    const offered = (id: string, supersedesId: string): FamilyAppointment => ({
      ...booked(id),
      status: "offered",
      scheduledFor: undefined,
      supersedesId
    });
    const replaced = (id: string): FamilyAppointment => ({ ...confirmed(id), status: "replaced" });

    const validBookedParent = booked("valid-booked-parent");
    const validConfirmedParent = confirmed("valid-confirmed-parent");
    const validReplacedBookedParent = replaced("valid-replaced-booked-parent");
    const validReplacedConfirmedParent = replaced("valid-replaced-confirmed-parent");
    const validReplacedTerminalParent = replaced("valid-replaced-terminal-parent");
    const laterParent = booked("later-parent");
    const incompatibleParent = booked("incompatible-parent");
    const replacedOfferedParent = replaced("replaced-offered-parent");

    const appointments: FamilyAppointment[] = [
      validBookedParent,
      offered("valid-offered-over-booked", validBookedParent.id),
      validConfirmedParent,
      offered("valid-offered-over-confirmed", validConfirmedParent.id),
      validReplacedBookedParent,
      { ...booked("valid-booked-over-replaced"), supersedesId: validReplacedBookedParent.id },
      validReplacedConfirmedParent,
      { ...confirmed("valid-confirmed-over-replaced"), supersedesId: validReplacedConfirmedParent.id },
      validReplacedTerminalParent,
      { ...booked("valid-terminal-over-replaced"), status: "completed", supersedesId: validReplacedTerminalParent.id },
      offered("missing-parent-child", "missing-parent"),
      offered("later-parent-child", laterParent.id),
      laterParent,
      incompatibleParent,
      { ...booked("incompatible-child"), supersedesId: incompatibleParent.id },
      replacedOfferedParent,
      offered("offered-over-replaced", replacedOfferedParent.id)
    ];
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...demoState, family: { ...validFamily, appointments } })
    );

    const loaded = loadStoredState();
    const links = new Map(loaded.family?.appointments.map(({ id, supersedesId }) => [id, supersedesId]));

    expect(loaded.family?.appointments.map(({ id }) => id)).toEqual(appointments.map(({ id }) => id));
    expect(links.get("valid-offered-over-booked")).toBe("valid-booked-parent");
    expect(links.get("valid-offered-over-confirmed")).toBe("valid-confirmed-parent");
    expect(links.get("valid-booked-over-replaced")).toBe("valid-replaced-booked-parent");
    expect(links.get("valid-confirmed-over-replaced")).toBe("valid-replaced-confirmed-parent");
    expect(links.get("valid-terminal-over-replaced")).toBe("valid-replaced-terminal-parent");
    expect(links.get("missing-parent-child")).toBeUndefined();
    expect(links.get("later-parent-child")).toBeUndefined();
    expect(links.get("incompatible-child")).toBeUndefined();
    expect(links.get("offered-over-replaced")).toBeUndefined();
  });

  it("preserves replacement history through reload before a rebooked reschedule", () => {
    const at = "2026-07-24T12:00:00.000Z";
    const referred = healthReducer(
      { ...demoState, family: validFamily },
      { type: "setFamilyReferral", referral: { clinic: "UK Developmental Pediatrics", referredAt: at } }
    );
    const original = createFamilyAppointmentOffer(new Date(at));
    const booked = healthReducer(
      healthReducer(referred, { type: "offerFamilyAppointment", appointment: original }),
      { type: "bookFamilyAppointment", appointmentId: original.id, slot: original.offeredSlots[0], at }
    );
    const listed = healthReducer(booked, {
      type: "setFamilySoonerList",
      soonerList: { optedInAt: at, constraints: ["weekday_mornings"] }
    });
    const earlier = createSoonerAppointmentOffer(new Date(at), ["weekday_mornings"], original.id);
    const accepted = healthReducer(
      healthReducer(listed, { type: "offerFamilyAppointment", appointment: earlier }),
      { type: "bookFamilyAppointment", appointmentId: earlier.id, slot: earlier.offeredSlots[0], at }
    );

    saveStoredState(accepted);
    const reloaded = loadStoredState();
    const reopened = healthReducer(reloaded, {
      type: "requestFamilyAppointmentReschedule",
      appointmentId: earlier.id,
      at
    });
    const rebooked = healthReducer(reopened, {
      type: "bookFamilyAppointment",
      appointmentId: earlier.id,
      slot: reopened.family?.appointments.find(({ id }) => id === earlier.id)?.offeredSlots[0] ?? "",
      at
    });

    expect(reloaded.family?.appointments.map(({ id, status, supersedesId }) => ({ id, status, supersedesId }))).toEqual([
      { id: original.id, status: "replaced", supersedesId: undefined },
      { id: earlier.id, status: "booked", supersedesId: original.id }
    ]);
    expect(rebooked.family?.appointments.map(({ id, status, supersedesId }) => ({ id, status, supersedesId }))).toEqual([
      { id: original.id, status: "replaced", supersedesId: undefined },
      { id: earlier.id, status: "booked", supersedesId: undefined }
    ]);
    expect(rebooked.auditEvents.filter(({ label }) => label === "Earlier visit replaced the prior booking")).toHaveLength(1);
    expect(rebooked.auditEvents.at(-1)?.label).toBe("Evaluation visit booked");
  });

  it.each([
    ["blank clinic", { clinic: "   ", referredAt: "2026-07-24T12:00:00.000Z" }],
    ["invalid ISO timestamp", { clinic: "UK Developmental Pediatrics", referredAt: "not-a-date" }]
  ])("backfills a referral with %s to null", (_, referral) => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...demoState, family: { ...validFamily, referral } })
    );

    const loaded = loadStoredState();

    expect(loaded.family?.referral).toBeNull();
    expect(loaded.family?.profile).toEqual(validFamily.profile);
  });

  it("backfills companion fields on saves written before spec 13", () => {
    const legacyFamily: Record<string, unknown> = { ...validFamily };
    delete legacyFamily.steps;
    delete legacyFamily.pulses;
    delete legacyFamily.flags;
    delete legacyFamily.soonerList;
    delete legacyFamily.packetQuestionIds;
    delete legacyFamily.checkinTouchedAt;
    legacyFamily.interviews = validFamily.interviews.map((interview) => {
      const legacyInterview: Record<string, unknown> = { ...interview };
      delete legacyInterview.kind;
      return legacyInterview;
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...demoState, family: legacyFamily }));

    const loaded = loadStoredState();

    expect(loaded.family).not.toBeNull();
    expect(loaded.family?.steps).toEqual([]);
    expect(loaded.family?.pulses).toEqual([]);
    expect(loaded.family?.flags).toEqual([]);
    expect(loaded.family?.soonerList).toBeNull();
    expect(loaded.family?.packetQuestionIds).toEqual([]);
    expect(loaded.family?.checkinTouchedAt).toBeNull();
    expect(loaded.family?.interviews.every((row) => row.kind === "orientation")).toBe(true);
  });

  // A family who ticked "we're already in First Steps" before the step tracker
  // shipped has the enrollment only in `alreadyEnrolled`. The deadline countdown
  // must stay retired for them — nagging about a deadline they already met is
  // how an app loses a family's trust.
  it("keeps the First Steps countdown retired for a pre-spec-13 enrollment", () => {
    const toddler = {
      childFirstName: "Avery",
      birthYear: 2023,
      birthMonth: 12,
      schoolStage: "not_school_age" as const,
      county: "Fayette",
      diagnoses: []
    };
    const legacyFamily: Record<string, unknown> = {
      ...validFamily,
      profile: toddler,
      alreadyEnrolled: ["first_steps_bluegrass"]
    };
    delete legacyFamily.steps;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...demoState, family: legacyFamily }));

    const loaded = loadStoredState();

    expect(loaded.family?.steps).toEqual([]);
    expect(loaded.family?.alreadyEnrolled).toEqual(["first_steps_bluegrass"]);
    const now = new Date("2026-07-17T12:00:00.000Z");
    expect(firstStepsClock(toddler, now, false)).not.toBeNull();
    expect(hasEnrolledFirstSteps(loaded.family!)).toBe(true);
    expect(firstStepsClock(toddler, now, hasEnrolledFirstSteps(loaded.family!))).toBeNull();
  });

  it("drops incoherent companion rows without resetting the family slice", () => {
    saveStoredState({
      ...demoState,
      family: {
        ...validFamily,
        steps: [
          {
            id: "s1",
            resourceId: "r",
            domain: "therapies",
            status: "sideways",
            plannedAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-02T00:00:00.000Z"
          }
        ],
        pulses: [{ at: "2026-07-01T00:00:00.000Z", score: 9 }],
        flags: [
          {
            id: "f1",
            type: "regression",
            source: "probe",
            raisedAt: "2026-07-02T00:00:00.000Z",
            acknowledgedAt: "2026-07-01T00:00:00.000Z"
          }
        ],
        soonerList: { optedInAt: "2026-07-01T00:00:00.000Z", constraints: [] },
        checkinTouchedAt: "last Tuesday"
      } as unknown as FamilyNavigatorState
    });

    const loaded = loadStoredState();

    expect(loaded.family).not.toBeNull();
    expect(loaded.family?.steps).toEqual([]);
    expect(loaded.family?.pulses).toEqual([]);
    expect(loaded.family?.flags).toEqual([]);
    expect(loaded.family?.soonerList).toBeNull();
    expect(loaded.family?.checkinTouchedAt).toBeNull();
    expect(loaded.family?.profile).toEqual(validFamily.profile);
  });

  it("keeps coherent companion rows and dedupes steps, flags, and packet questions by id", () => {
    const step: FamilyResourceStep = {
      id: "step-1",
      resourceId: "first-steps",
      domain: "early_intervention",
      status: "in_touch",
      plannedAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-08T00:00:00.000Z"
    };
    const flag: FamilyFlag = {
      id: "flag-1",
      type: "regression",
      source: "probe",
      raisedAt: "2026-07-02T00:00:00.000Z",
      acknowledgedAt: "2026-07-03T00:00:00.000Z"
    };
    saveStoredState({
      ...demoState,
      family: {
        ...validFamily,
        steps: [step, { ...step, status: "planned" }],
        pulses: [{ at: "2026-07-02T00:00:00.000Z", score: 4 }],
        flags: [flag, { ...flag, source: "text" }],
        soonerList: { optedInAt: "2026-07-01T00:00:00.000Z", constraints: ["weekday_mornings"] },
        packetQuestionIds: ["who_to_call", "who_to_call", "home_help"],
        checkinTouchedAt: "2026-07-05T00:00:00.000Z"
      }
    });

    const loaded = loadStoredState();

    expect(loaded.family?.steps).toEqual([step]);
    expect(loaded.family?.pulses).toEqual([{ at: "2026-07-02T00:00:00.000Z", score: 4 }]);
    expect(loaded.family?.flags).toEqual([flag]);
    expect(loaded.family?.soonerList).toEqual({
      optedInAt: "2026-07-01T00:00:00.000Z",
      constraints: ["weekday_mornings"]
    });
    expect(loaded.family?.packetQuestionIds).toEqual(["who_to_call", "home_help"]);
    expect(loaded.family?.checkinTouchedAt).toBe("2026-07-05T00:00:00.000Z");
  });

  it("starts a fresh browser on the retinopathy-due demo state", () => {
    const loaded = loadStoredState();

    expect(loaded).toEqual(brentState);
    expect(loaded.patient.preferredName).toBe("Brent");
    expect(loaded.carePlan.conditions).toContain("diabetes");
    expect(loaded.screeningGaps).toContainEqual(
      expect.objectContaining({ condition: "diabetes", status: "overdue" })
    );
  });

  it("removes structurally invalid but syntactically valid payloads and falls back to the retinopathy demo state", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        patient: { id: "patient-1", name: "Jordan", preferredName: "Jordan" },
        carePlan: { id: "plan-1", patientId: "patient-1", condition: "hypertension" },
        medications: "not-an-array",
        readings: [],
        tasks: [],
        contextItems: [],
        extractedFacts: [],
        aiMessages: [],
        auditEvents: []
      })
    );

    expect(() => loadStoredState()).not.toThrow();
    expect(loadStoredState()).toEqual(brentState);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("falls back to the retinopathy demo state when localStorage.getItem throws", () => {
    const getItemSpy = vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });

    expect(() => loadStoredState()).not.toThrow();
    expect(loadStoredState()).toEqual(brentState);

    getItemSpy.mockRestore();
  });

  it("falls back to the retinopathy demo state for malformed localStorage payloads and removes the entry", () => {
    window.localStorage.setItem(STORAGE_KEY, "{malformed json");

    expect(() => loadStoredState()).not.toThrow();
    expect(loadStoredState()).toEqual(brentState);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("falls back to the retinopathy demo state for malformed medication entries and clears storage", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        medications: [{}],
        readings: [],
        tasks: [],
        contextItems: [],
        extractedFacts: [],
        aiMessages: [],
        auditEvents: []
      })
    );

    const loaded = loadStoredState();

    expect(loaded).toEqual(brentState);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("keeps valid saved state when some tasks are invalid by dropping invalid tasks only", () => {
    const legacySavedState = {
      ...demoState,
      patient: {
        ...demoState.patient,
        name: "Saved Patient",
        preferredName: "Sam"
      },
      tasks: [
        {
          id: "task-valid-1",
          title: "Review readings",
          body: "Current readings can be shared with your care team.",
          href: "/chat",
          priority: 2,
          kind: "reading",
          status: "confirmed"
        },
        {
          id: "task-missing-status",
          title: "Missing status",
          body: "Task created before status was required.",
          href: "/chat",
          priority: 1,
          kind: "reading"
        },
        {
          id: "task-valid-2",
          title: "Prepare visit",
          body: "Review goals before your next visit.",
          href: "/visits",
          priority: 3,
          kind: "visit",
          status: "needs_review"
        }
      ],
      readings: [],
      contextItems: [],
      extractedFacts: [],
      aiMessages: [],
      auditEvents: []
    };

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(legacySavedState)
    );

    const loaded = loadStoredState();

    expect(loaded.patient.name).toBe("Saved Patient");
    expect(loaded.patient.preferredName).toBe("Sam");
    expect(loaded.tasks).toHaveLength(2);
    expect(loaded.tasks.map((task) => task.id)).toEqual(["task-valid-1", "task-valid-2"]);
    const persisted = window.localStorage.getItem(STORAGE_KEY);
    expect(persisted).not.toBeNull();
    const persistedState = JSON.parse(persisted ?? "{}");
    expect(persistedState.tasks).toHaveLength(2);
    expect(persistedState.tasks.map((task) => task.id)).toEqual(["task-valid-1", "task-valid-2"]);
  });

  it("falls back to the retinopathy demo state for carePlan patient mismatch and clears storage", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        carePlan: {
          ...demoState.carePlan,
          patientId: "another-patient"
        }
      })
    );

    const loaded = loadStoredState();

    expect(loaded).toEqual(brentState);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("falls back to the retinopathy demo state for medication/readings patient mismatch and clears storage", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        medications: [
          {
            ...demoState.medications[0],
            patientId: "another-patient"
          }
        ],
        readings: [
          {
            id: "reading-1",
            patientId: "patient-1",
            systolic: 126,
            diastolic: 81,
            pulse: null,
            measuredAt: "2026-07-05T09:00:00.000Z",
            contexts: ["morning"],
            note: "good"
          }
        ]
      })
    );

    const loaded = loadStoredState();

    expect(loaded).toEqual(brentState);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("falls back to the retinopathy demo state for malformed audit events and clears storage", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        medications: [],
        readings: [],
        tasks: [],
        contextItems: [],
        extractedFacts: [],
        aiMessages: [],
        auditEvents: ["oops"]
      })
    );

    const loaded = loadStoredState();

    expect(loaded).toEqual(brentState);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("falls back to the retinopathy demo state for non-finite care plan thresholds and clears storage", () => {
    const rawPayload = JSON.stringify(demoState).replace(
      "\"callThresholdSystolic\":160",
      "\"callThresholdSystolic\":1e309"
    );

    window.localStorage.setItem(STORAGE_KEY, rawPayload);

    const loaded = loadStoredState();

    expect(loaded).toEqual(brentState);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("does not throw when saveStoredState cannot write", () => {
    const originalState = { ...demoState, readings: [...demoState.readings] };
    const setItemSpy = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("Storage is full");
    });

    expect(() => saveStoredState(originalState)).not.toThrow();
    expect(clearStoredState()).toBeUndefined();

    setItemSpy.mockRestore();
  });

  it("does not throw when clearStoredState cannot remove", () => {
    const removeItemSpy = vi.spyOn(window.localStorage, "removeItem").mockImplementation(() => {
      throw new Error("Cannot remove");
    });

    expect(() => clearStoredState()).not.toThrow();
    expect(loadStoredState()).toEqual(brentState);

    removeItemSpy.mockRestore();
  });

  it("keeps a valid deleted demo state without rehydrating seeded demo data", () => {
    saveStoredState(deletedDemoState);

    const loaded = loadStoredState();

    expect(loaded.patient.id).toBe("patient-deleted");
    expect(loaded.patient.name).not.toBe(demoState.patient.name);
    expect(loaded.medications).toHaveLength(0);
    expect(loaded.readings).toHaveLength(0);
    expect(loaded.aiMessages).toHaveLength(0);
  });

  it("falls back to the retinopathy demo state for invalid reading pulse or contexts and clears storage", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        readings: [
          {
            id: "bad-reading",
            patientId: demoState.patient.id,
            systolic: 120,
            diastolic: 80,
            pulse: "72",
            measuredAt: "2026-07-05T09:00:00.000Z",
            contexts: ["foo"],
            note: "invalid"
          }
        ]
      })
    );

    const loaded = loadStoredState();

    expect(loaded).toEqual(brentState);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("falls back to the retinopathy demo state for extracted facts with unknown contextItemId", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        contextItems: [
          {
            id: "context-1",
            patientId: "patient-1",
            title: "Lab update",
            rawText: "Sodium 140",
            sourceLabel: "Clinic portal",
            createdAt: "2026-07-04T00:00:00.000Z"
          }
        ],
        extractedFacts: [
          {
            id: "fact-1",
            contextItemId: "missing-context",
            label: "Sodium",
            value: "normal",
            confidence: "high",
            status: "inferred",
            sourceSnippet: "Sodium 140"
          }
        ]
      })
    );

    const loaded = loadStoredState();

    expect(loaded).toEqual(brentState);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("migrates a legacy state without mealLog to an empty meal log without resetting", () => {
    const legacy: Record<string, unknown> = {
      ...demoState,
      patient: { ...demoState.patient, name: "Legacy Patient", preferredName: "Legacy" }
    };
    delete legacy.mealLog;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const loaded = loadStoredState();

    expect(loaded.patient.name).toBe("Legacy Patient");
    expect(loaded.mealLog).toEqual([]);
    expect(loaded.readings).toHaveLength(demoState.readings.length);
  });

  it("drops malformed meal log entries while keeping the rest of the state", () => {
    const validEntry = {
      id: "meal-1",
      patientId: "patient-1",
      loggedAt: "2026-07-05T12:00:00.000Z",
      food: { id: "1", barcode: "1", name: "Soup", brand: null, category: null, nutrition: null, source: "barcode_seed" },
      flags: ["890 mg sodium"],
      assistantSummary: "High in sodium."
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...demoState, mealLog: [validEntry, {}] }));

    const loaded = loadStoredState();

    expect(loaded.mealLog).toHaveLength(1);
    expect(loaded.mealLog[0].id).toBe("meal-1");
    expect(loaded.patient.id).toBe("patient-1");
  });

  const validGlucose = {
    id: "glucose-1",
    patientId: "patient-1",
    valueMgDl: 120,
    measuredAt: "2026-07-05T07:00:00.000Z",
    contexts: ["morning"],
    note: ""
  };

  it("backfills a legacy payload with an empty glucoseReadings array without resetting", () => {
    const legacy: Record<string, unknown> = {
      ...demoState,
      patient: { ...demoState.patient, name: "Pre-Glucose Patient", preferredName: "Pre" }
    };
    delete legacy.glucoseReadings;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const loaded = loadStoredState();

    expect(loaded.patient.name).toBe("Pre-Glucose Patient");
    expect(loaded.glucoseReadings).toEqual([]);
  });

  it("keeps a valid glucose reading", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...demoState, glucoseReadings: [validGlucose] }));

    const loaded = loadStoredState();

    expect(loaded.glucoseReadings).toHaveLength(1);
    expect(loaded.glucoseReadings[0].valueMgDl).toBe(120);
  });

  it("drops malformed glucose readings while keeping the rest of the state", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...demoState, glucoseReadings: [validGlucose, {}] }));

    const loaded = loadStoredState();

    expect(loaded.glucoseReadings).toHaveLength(1);
    expect(loaded.glucoseReadings[0].id).toBe("glucose-1");
    expect(loaded.patient.id).toBe("patient-1");
  });

  it("drops a foreign-patient glucose reading from the persisted state", () => {
    const foreign = { ...validGlucose, id: "glucose-foreign", patientId: "another-patient" };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...demoState, glucoseReadings: [validGlucose, foreign] })
    );

    const loaded = loadStoredState();

    expect(loaded.glucoseReadings).toHaveLength(1);
    expect(loaded.glucoseReadings[0].id).toBe("glucose-1");

    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string);
    expect(persisted.glucoseReadings).toHaveLength(1);
    expect(persisted.glucoseReadings[0].id).toBe("glucose-1");
  });

  it("keeps optional glucose call thresholds on the care plan", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        carePlan: { ...demoState.carePlan, callThresholdGlucoseLow: 54, callThresholdGlucoseHigh: 300 }
      })
    );

    const loaded = loadStoredState();

    expect(loaded.carePlan.callThresholdGlucoseLow).toBe(54);
    expect(loaded.carePlan.callThresholdGlucoseHigh).toBe(300);
  });

  it("keeps an optional conditions array on the care plan", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        carePlan: { ...demoState.carePlan, conditions: ["hypertension", "diabetes"] }
      })
    );

    const loaded = loadStoredState();

    expect(loaded.carePlan.conditions).toEqual(["hypertension", "diabetes"]);
  });

  it("accepts food-mode ai messages", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        aiMessages: [
          {
            id: "message-1",
            mode: "food",
            role: "assistant",
            content: "That soup is high in sodium.",
            createdAt: "2026-07-05T12:00:00.000Z",
            safety: "allowed",
            sources: [demoState.carePlan.id]
          }
        ]
      })
    );

    const loaded = loadStoredState();

    expect(loaded.aiMessages).toHaveLength(1);
    expect(loaded.aiMessages[0].mode).toBe("food");
  });

  it("accepts a diabetes care plan condition", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...demoState, carePlan: { ...demoState.carePlan, condition: "diabetes" } })
    );

    const loaded = loadStoredState();

    expect(loaded.carePlan.condition).toBe("diabetes");
  });

  it("accepts a crisis ai message and crisis_escalated audit event", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        aiMessages: [
          {
            id: "message-crisis",
            mode: "trouble",
            role: "assistant",
            content: "Please reach out now: call or text 988.",
            createdAt: "2026-07-06T12:00:00.000Z",
            safety: "crisis",
            sources: [],
            actions: ["crisis_call_988", "crisis_text_988", "call_emergency", "safety_plan"]
          }
        ],
        auditEvents: [
          {
            id: "audit-crisis",
            patientId: "patient-1",
            action: "crisis_escalated",
            label: "Crisis resources shown",
            createdAt: "2026-07-06T12:00:00.000Z"
          }
        ]
      })
    );

    const loaded = loadStoredState();

    expect(loaded.aiMessages).toHaveLength(1);
    expect(loaded.aiMessages[0].safety).toBe("crisis");
    expect(loaded.aiMessages[0].actions).toEqual([
      "crisis_call_988",
      "crisis_text_988",
      "call_emergency",
      "safety_plan"
    ]);
    expect(loaded.auditEvents[0].action).toBe("crisis_escalated");
  });

  it("filters unknown ai message action strings without resetting the state", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        patient: { ...demoState.patient, name: "Kept Patient", preferredName: "Kept" },
        aiMessages: [
          {
            id: "message-mixed",
            mode: "trouble",
            role: "assistant",
            content: "Here are your options.",
            createdAt: "2026-07-06T12:00:00.000Z",
            safety: "crisis",
            sources: [],
            actions: ["crisis_call_988", "totally_made_up", "draft_message"]
          }
        ]
      })
    );

    const loaded = loadStoredState();

    expect(loaded.patient.name).toBe("Kept Patient");
    expect(loaded.aiMessages[0].actions).toEqual(["crisis_call_988", "draft_message"]);
  });

  it("backfills a pre-fill payload with an empty medicationFills array", () => {
    const legacy: Record<string, unknown> = {
      ...demoState,
      patient: { ...demoState.patient, name: "Pre-Fill Patient", preferredName: "Pre" }
    };
    delete legacy.medicationFills;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const loaded = loadStoredState();

    expect(loaded.patient.name).toBe("Pre-Fill Patient");
    expect(loaded.medicationFills).toEqual([]);
    expect(loaded.doseEvents).toHaveLength(demoState.doseEvents.length);
  });

  it("keeps valid medication fills and drops foreign or unknown-medication fills", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        medicationFills: [
          {
            id: "fill-valid",
            patientId: "patient-1",
            medicationId: "med-1",
            medicationName: "Lisinopril",
            dateOfService: "2026-01-05",
            daysSupply: 30,
            source: "patient_reported"
          },
          {
            id: "fill-foreign",
            patientId: "another-patient",
            medicationId: "med-1",
            medicationName: "Lisinopril",
            dateOfService: "2026-01-05",
            daysSupply: 30,
            source: "patient_reported"
          },
          {
            id: "fill-unknown-med",
            patientId: "patient-1",
            medicationId: "med-does-not-exist",
            medicationName: "Ghost",
            dateOfService: "2026-01-05",
            daysSupply: 30,
            source: "patient_reported"
          }
        ]
      })
    );

    const loaded = loadStoredState();

    expect(loaded.medicationFills.map((fill) => fill.id)).toEqual(["fill-valid"]);
  });

  it("accepts a phq9 assessment event and backfills a pre-assessment payload", () => {
    const legacy: Record<string, unknown> = {
      ...demoState,
      assessmentEvents: [
        {
          id: "assessment-1",
          patientId: "patient-1",
          instrumentId: "phq9",
          itemResponses: [0, 1, 2, 3, 0, 0, 0, 0, 0],
          totalScore: 6,
          severityBand: "mild",
          status: "patient_reported",
          recordedAt: "2026-07-06T12:00:00.000Z"
        }
      ]
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const loaded = loadStoredState();

    expect(loaded.assessmentEvents).toHaveLength(1);
    expect(loaded.assessmentEvents[0].severityBand).toBe("mild");
  });

  it("filters unknown and malformed instrument rows without resetting valid state", () => {
    const valid = {
      id: "assessment-valid",
      patientId: "patient-1",
      instrumentId: "phq9",
      itemResponses: [0, 1, 2, 3, 0, 0, 0, 0, 0],
      totalScore: 6,
      severityBand: "mild",
      status: "patient_reported",
      recordedAt: "2026-07-06T12:00:00.000Z"
    };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        patient: { ...demoState.patient, name: "Preserve Me" },
        assessmentEvents: [
          valid,
          { ...valid, id: "unknown", instrumentId: "future-screen" },
          { ...valid, id: "short", itemResponses: [0, 1] },
          { ...valid, id: "bad-choice", itemResponses: [0, 1, 2, 4, 0, 0, 0, 0, 0] },
          { ...valid, id: "bad-band", severityBand: "not-a-band" }
        ]
      })
    );

    const loaded = loadStoredState();

    expect(loaded.patient.name).toBe("Preserve Me");
    expect(loaded.assessmentEvents.map(({ id }) => id)).toEqual(["assessment-valid"]);
  });

  it("filters a prototype-key instrument row without resetting the rest of stored state", () => {
    const valid = {
      id: "assessment-valid",
      patientId: "patient-1",
      instrumentId: "phq9",
      itemResponses: [0, 1, 2, 3, 0, 0, 0, 0, 0],
      totalScore: 6,
      severityBand: "mild",
      status: "patient_reported",
      recordedAt: "2026-07-06T12:00:00.000Z"
    };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        patient: { ...demoState.patient, name: "Preserve Prototype State" },
        assessmentEvents: [valid, { ...valid, id: "prototype-key", instrumentId: "constructor" }]
      })
    );

    const loaded = loadStoredState();

    expect(loaded.patient.name).toBe("Preserve Prototype State");
    expect(loaded.assessmentEvents.map(({ id }) => id)).toEqual(["assessment-valid"]);
  });

  it("validates registry number ranges and conditional sentinel values", () => {
    const conditionalInstrument: ScreeningInstrument = {
      id: "storage-conditional",
      title: { en: "Storage conditional", es: "Condicional de almacenamiento" },
      audience: "self",
      tier: 1,
      items: [
        { id: "trigger", kind: "choice", en: "Trigger", es: "Activador" },
        {
          id: "count",
          kind: "number",
          en: "Count",
          es: "Cantidad",
          min: 1,
          max: 3,
          conditionalOn: { itemId: "trigger", atLeast: 1 },
          notApplicableValue: -1
        }
      ],
      defaultOptions: [
        { value: 0, en: "No", es: "No" },
        { value: 1, en: "Yes", es: "Sí" }
      ],
      score: (responses) => ({ totalScore: responses[0], band: "ok" }),
      bands: ["ok"],
      bandSummaries: { ok: { en: "Recorded.", es: "Registrado." } },
      consent: {
        en: { title: "Consent", points: ["Point"], acknowledge: "Continue" },
        es: { title: "Consentimiento", points: ["Punto"], acknowledge: "Continuar" }
      },
      wordingVerified: true,
      licenseStatus: "clear",
      attribution: { en: "Test", es: "Prueba" }
    };
    const event = {
      id: "conditional-skipped",
      patientId: "patient-1",
      instrumentId: conditionalInstrument.id,
      itemResponses: [0, -1],
      totalScore: 0,
      severityBand: "ok",
      status: "patient_reported",
      recordedAt: "2026-07-06T12:00:00.000Z"
    };
    INSTRUMENTS[conditionalInstrument.id] = conditionalInstrument;

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...demoState,
          assessmentEvents: [
            event,
            { ...event, id: "conditional-shown", itemResponses: [1, 3] },
            { ...event, id: "sentinel-while-shown", itemResponses: [1, -1] },
            { ...event, id: "out-of-range", itemResponses: [1, 4] },
            { ...event, id: "bad-choice", itemResponses: [2, -1] }
          ]
        })
      );

      expect(loadStoredState().assessmentEvents.map(({ id }) => id)).toEqual([
        "conditional-skipped",
        "conditional-shown"
      ]);
    } finally {
      delete INSTRUMENTS[conditionalInstrument.id];
    }
  });

  it("uses the same inclusive upper-bound condition semantics when loading stored results", () => {
    const equalityInstrument: ScreeningInstrument = {
      id: "storage-equality",
      title: { en: "Storage equality", es: "Igualdad de almacenamiento" },
      audience: "self",
      tier: 0,
      items: [
        { id: "trigger", kind: "choice", en: "Trigger", es: "Activador" },
        {
          id: "answer",
          kind: "choice",
          en: "Answer",
          es: "Respuesta",
          conditionalOn: { itemId: "trigger", atLeast: 0, atMost: 0 },
          notApplicableValue: -1
        }
      ],
      defaultOptions: [
        { value: 0, en: "No", es: "No" },
        { value: 1, en: "Yes", es: "Sí" }
      ],
      score: (responses) => ({ totalScore: responses[0], band: "ok" }),
      bands: ["ok"],
      bandSummaries: { ok: { en: "Recorded.", es: "Registrado." } },
      consent: {
        en: { title: "Consent", points: ["Point"], acknowledge: "Continue" },
        es: { title: "Consentimiento", points: ["Punto"], acknowledge: "Continuar" }
      },
      wordingVerified: true,
      licenseStatus: "clear",
      attribution: { en: "Test", es: "Prueba" }
    };
    const event = {
      id: "equality-visible",
      patientId: "patient-1",
      instrumentId: equalityInstrument.id,
      itemResponses: [0, 1],
      totalScore: 0,
      severityBand: "ok",
      status: "patient_reported",
      recordedAt: "2026-07-06T12:00:00.000Z"
    };
    INSTRUMENTS[equalityInstrument.id] = equalityInstrument;

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...demoState,
          assessmentEvents: [
            event,
            { ...event, id: "equality-hidden", itemResponses: [1, -1] },
            { ...event, id: "answer-while-hidden", itemResponses: [1, 1] }
          ]
        })
      );

      expect(loadStoredState().assessmentEvents.map(({ id }) => id)).toEqual([
        "equality-visible",
        "equality-hidden"
      ]);
    } finally {
      delete INSTRUMENTS[equalityInstrument.id];
    }
  });

  it("filters a fractional NIDA count while preserving a valid whole-number result", () => {
    const valid = {
      id: "nida-valid",
      patientId: "patient-1",
      instrumentId: "nida_single",
      itemResponses: [1],
      totalScore: 1,
      severityBand: "positive",
      status: "patient_reported",
      recordedAt: "2026-07-06T12:00:00.000Z"
    };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        assessmentEvents: [valid, { ...valid, id: "nida-fractional", itemResponses: [1.5], totalScore: 1.5 }]
      })
    );

    expect(loadStoredState().assessmentEvents.map(({ id }) => id)).toEqual(["nida-valid"]);
  });

  it("round-trips an eligible current-smoker lung event with the quit sentinel", () => {
    const lungEvent = {
      id: "lung-current-eligible",
      patientId: demoState.patient.id,
      instrumentId: "lung_ldct_eligibility",
      itemResponses: [1, 60, 1, 20, -1, 0],
      totalScore: 20,
      severityBand: "eligible",
      status: "patient_reported",
      recordedAt: "2026-07-20T12:00:00.000Z"
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...demoState, assessmentEvents: [lungEvent] }));

    expect(loadStoredState().assessmentEvents).toEqual([lungEvent]);
  });

  it("enforces P2 ranges, whole numbers, sentinels, and registered bands", () => {
    const base = {
      patientId: demoState.patient.id,
      status: "patient_reported",
      recordedAt: "2026-07-20T12:00:00.000Z"
    };
    const validMalePrediabetes = {
      ...base,
      id: "prediabetes-male-skip",
      instrumentId: "prediabetes_risk",
      itemResponses: [3, 1, 0, 1, 1, 1, 70, 280],
      totalScore: 9,
      severityBand: "high_risk"
    };
    const validWomanNoGestational = {
      ...base,
      id: "prediabetes-woman-no",
      instrumentId: "prediabetes_risk",
      itemResponses: [1, 0, 0, 0, 0, 0, 65, 130],
      totalScore: 1,
      severityBand: "lower_risk"
    };
    const validSteadiSkip = {
      ...base,
      id: "steadi-skip",
      instrumentId: "steadi3",
      itemResponses: [0, 0, 0, -1],
      totalScore: 0,
      severityBand: "lower_risk"
    };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        assessmentEvents: [
          validMalePrediabetes,
          validWomanNoGestational,
          validSteadiSkip,
          { ...validMalePrediabetes, id: "bad-age-points", itemResponses: [4, 1, 0, 1, 1, 1, 70, 280] },
          { ...validMalePrediabetes, id: "fractional-age", instrumentId: "lung_ldct_eligibility", itemResponses: [1, 60.5, 1, 20, -1, 0], totalScore: 20, severityBand: "eligible" },
          { ...validMalePrediabetes, id: "current-with-quit-months", instrumentId: "lung_ldct_eligibility", itemResponses: [1, 60, 1, 20, 20, 0], totalScore: 20, severityBand: "eligible" },
          { ...validMalePrediabetes, id: "former-with-sentinel", instrumentId: "lung_ldct_eligibility", itemResponses: [0, 60, 1, 20, -1, 0], totalScore: 20, severityBand: "eligible" },
          { ...validMalePrediabetes, id: "bad-audit-choice", instrumentId: "audit_c", itemResponses: [1, 5, 0, 0], totalScore: 5, severityBand: "positive" },
          { ...validMalePrediabetes, id: "bad-dds-range", instrumentId: "dds2", itemResponses: [0, 3], totalScore: 1.5, severityBand: "lower_distress" },
          { ...validSteadiSkip, id: "steadi-answer-while-hidden", itemResponses: [0, 0, 0, 0] },
          { ...validSteadiSkip, id: "steadi-sentinel-while-visible", itemResponses: [1, 0, 0, -1], severityBand: "at_risk" },
          { ...validSteadiSkip, id: "unknown-band", severityBand: "unknown" }
        ]
      })
    );

    expect(loadStoredState().assessmentEvents.map(({ id }) => id)).toEqual([
      "prediabetes-male-skip",
      "prediabetes-woman-no",
      "steadi-skip"
    ]);
  });

  it("backfills a payload with no assessmentEvents array", () => {
    const legacy: Record<string, unknown> = {
      ...demoState,
      patient: { ...demoState.patient, name: "Pre-Assessment", preferredName: "Pre" }
    };
    delete legacy.assessmentEvents;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const loaded = loadStoredState();

    expect(loaded.patient.name).toBe("Pre-Assessment");
    expect(loaded.assessmentEvents).toEqual([]);
  });

  it("loads a patient without an accessibilityPreferences field cleanly", () => {
    const legacyPatient: Record<string, unknown> = { ...demoState.patient };
    delete legacyPatient.accessibilityPreferences;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...demoState, patient: legacyPatient }));

    const loaded = loadStoredState();

    expect(loaded.patient.id).toBe("patient-1");
    expect(loaded.patient.accessibilityPreferences).toBeUndefined();
  });

  it("keeps valid accessibility preferences on the patient profile", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        patient: { ...demoState.patient, accessibilityPreferences: ["high_contrast", "keyboard_navigation"] }
      })
    );

    const loaded = loadStoredState();

    expect(loaded.patient.accessibilityPreferences).toEqual(["high_contrast", "keyboard_navigation"]);
  });

  it("loads a pre-crisis persisted payload without data loss", () => {
    const legacy = {
      ...demoState,
      patient: { ...demoState.patient, name: "Legacy Owner", preferredName: "Legacy" },
      aiMessages: [
        {
          id: "message-legacy",
          mode: "why",
          role: "assistant",
          content: "Lisinopril helps lower your blood pressure.",
          createdAt: "2026-07-01T12:00:00.000Z",
          safety: "allowed",
          sources: ["med-1"],
          actions: ["call_clinic", "draft_message"]
        }
      ]
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const loaded = loadStoredState();

    expect(loaded.patient.name).toBe("Legacy Owner");
    expect(loaded.aiMessages).toHaveLength(1);
    expect(loaded.aiMessages[0].actions).toEqual(["call_clinic", "draft_message"]);
    expect(loaded.readings).toHaveLength(demoState.readings.length);
    expect(loaded.doseEvents).toHaveLength(demoState.doseEvents.length);
  });

  // House tripwire for the DR sprint: a payload persisted before the screening
  // arrays existed must load with backfilled empties, never reset to demo.
  it("backfills a pre-DR-screening payload with empty screening arrays without resetting", () => {
    const legacy: Record<string, unknown> = {
      ...demoState,
      patient: { ...demoState.patient, name: "Pre-Screening Patient", preferredName: "Pre" }
    };
    delete legacy.screeningGaps;
    delete legacy.screeningResults;
    delete legacy.referrals;
    delete legacy.recallReminders;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const loaded = loadStoredState();

    expect(loaded.patient.name).toBe("Pre-Screening Patient");
    expect(loaded.screeningGaps).toEqual([]);
    expect(loaded.screeningResults).toEqual([]);
    expect(loaded.referrals).toEqual([]);
    expect(loaded.recallReminders).toEqual([]);
    expect(loaded.readings).toHaveLength(demoState.readings.length);
  });

  it("keeps a valid screening pathway and drops orphaned results and referrals", () => {
    const gap = { id: "gap-1", condition: "diabetes", status: "referral", lastScreeningDate: "2024-12-10" };
    const result = {
      id: "result-1",
      gapId: "gap-1",
      outcome: "abnormal",
      grade: "moderate_npdr",
      dmePresent: false,
      source: "photo_report",
      reportRef: "report-moderate-npdr.svg",
      confirmedAt: "2026-07-07T10:00:00.000Z"
    };
    const orphanResult = { ...result, id: "result-orphan", gapId: "gap-missing" };
    const referral = {
      id: "referral-1",
      resultId: "result-1",
      tier: "optometry_routine",
      destinationId: "dest-1",
      stageHistory: [
        { stage: "drafted", at: "2026-07-07T10:00:00.000Z", note: "Referral drafted from your confirmed report" },
        { stage: "sent", at: "2026-07-07T10:00:01.000Z", note: "Sent to the clinic" }
      ],
      sentAt: "2026-07-07T10:00:01.000Z"
    };
    const orphanReferral = { ...referral, id: "referral-orphan", resultId: "result-missing" };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        screeningGaps: [gap],
        screeningResults: [result, orphanResult, {}],
        referrals: [referral, orphanReferral],
        recallReminders: [{ id: "recall-1", dueAt: "2027-07-07T10:00:00.000Z", reason: "annual_rescreen" }, {}]
      })
    );

    const loaded = loadStoredState();

    expect(loaded.screeningGaps.map((entry) => entry.id)).toEqual(["gap-1"]);
    expect(loaded.screeningResults.map((entry) => entry.id)).toEqual(["result-1"]);
    expect(loaded.referrals.map((entry) => entry.id)).toEqual(["referral-1"]);
    expect(loaded.recallReminders.map((entry) => entry.id)).toEqual(["recall-1"]);
    expect(loaded.patient.id).toBe("patient-1");
  });

  it("keeps an ai message citing a screening result as a known source", () => {
    const gap = { id: "gap-1", condition: "diabetes", status: "referral", lastScreeningDate: "2024-12-10" };
    const result = {
      id: "result-cited",
      gapId: "gap-1",
      outcome: "normal",
      grade: "no_dr",
      dmePresent: false,
      source: "photo_report",
      reportRef: "report-no-dr.svg",
      confirmedAt: "2026-07-07T10:00:00.000Z"
    };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demoState,
        screeningGaps: [gap],
        screeningResults: [result],
        aiMessages: [
          {
            id: "message-screening",
            mode: "ask",
            role: "assistant",
            content: "Your report from July 7 says no signs of diabetic eye disease were found.",
            createdAt: "2026-07-07T11:00:00.000Z",
            safety: "allowed",
            sources: ["result-cited"]
          }
        ]
      })
    );

    const loaded = loadStoredState();

    expect(loaded.aiMessages).toHaveLength(1);
    expect(loaded.screeningResults[0].id).toBe("result-cited");
  });
});

describe("P4 assessment storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const family = {
    profile: {
      childFirstName: "Avery",
      birthYear: 2025,
      birthMonth: 1,
      schoolStage: "not_school_age" as const,
      county: "Fayette",
      diagnoses: []
    },
    referral: null,
    appointments: [],
    safetyEvents: [],
    recommendations: null,
    interviewDraft: "",
    screenAnswers: [],
    interviews: [],
    facts: [],
    latestInterviewDomains: [],
    activeDomains: [],
    saved: [],
    alreadyEnrolled: [],
    steps: [],
    pulses: [],
    flags: [],
    soonerList: null,
    packetQuestionIds: [],
    checkinTouchedAt: null
  };

  const posiEvent = {
    id: "posi-valid",
    patientId: demoState.patient.id,
    instrumentId: "swyc_posi",
    itemResponses: [0, 0, 0, 0, 0, 0, 5],
    totalScore: 1,
    severityBand: "lower_risk",
    status: "patient_reported" as const,
    recordedAt: "2026-07-20T12:00:00.000Z"
  };

  it("round-trips zero and declared POSI masks plus a 13-value PHQ-A event", () => {
    const phqAEvent = {
      ...posiEvent,
      id: "phqa-valid",
      instrumentId: "phq_a",
      itemResponses: Array(13).fill(0),
      totalScore: 0,
      severityBand: "minimal"
    };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...demoState, family, assessmentEvents: [posiEvent, phqAEvent] })
    );

    expect(loadStoredState().assessmentEvents).toEqual([posiEvent, phqAEvent]);
  });

  it.each([
    ["unknown bit", 32],
    ["fractional mask", 1.5],
    ["negative mask", -1],
    ["declared plus unknown bit", 33],
    ["high unknown bit", 2 ** 32],
    ["high unknown bit plus declared bit", 2 ** 32 + 1],
    ["another high unknown bit plus declared bit", 2 ** 40 + 8]
  ])("filters a POSI %s without resetting patient or family state", (_, mask) => {
    const malformed = {
      ...posiEvent,
      id: `invalid-${mask}`,
      itemResponses: [0, 0, 0, 0, 0, 0, mask]
    };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...demoState, family, assessmentEvents: [posiEvent, malformed] })
    );

    const loaded = loadStoredState();
    expect(loaded.patient).toEqual(demoState.patient);
    expect(loaded.family).toEqual(family);
    expect(loaded.assessmentEvents.map(({ id }) => id)).toEqual(["posi-valid"]);
  });
});
