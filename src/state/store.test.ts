import { describe, expect, it } from "vitest";
import { brentState, demoState } from "@/domain/fixtures";
import { schoolAgeFamilyState } from "@/domain/family-fixtures";
import {
  buildDemoSlotOffers,
  createFamilyAppointmentOffer,
  createSoonerAppointmentOffer
} from "@/domain/family-appointments";
import { checkInDue } from "@/domain/family-journey";
import { recordAuditEvent } from "@/domain/audit";
import { healthReducer } from "./store";
import type { HealthAction } from "./store";
import type {
  AppState,
  FamilyFact,
  FamilyInterview,
  FamilyPulse,
  FamilyScreenAnswer,
  FamilySoonerList,
  FamilyStepStatus,
  GlucoseReading,
  SavedFamilyResource
} from "@/domain/types";

const PLANNED_AT = "2026-07-17T12:00:00.000Z";

describe("healthReducer", () => {
  it("backdates stored family diagnosis months for the demo without replacing the clock", () => {
    const seeded: AppState = { ...demoState, family: schoolAgeFamilyState };
    const beforeDates = seeded.family?.profile?.diagnoses.map(({ diagnosedAt }) => diagnosedAt);

    const backdated = healthReducer(seeded, {
      type: "backdateFamilyDiagnoses",
      monthsAgo: 6,
      now: "2026-07-17T12:00:00.000Z"
    });

    expect(beforeDates).toEqual(["2026-05", "2026-05"]);
    expect(seeded.family?.profile?.diagnoses.map(({ diagnosedAt }) => diagnosedAt)).toEqual([
      "2026-05",
      "2026-05"
    ]);
    expect(backdated.family?.profile?.diagnoses.map(({ diagnosedAt }) => diagnosedAt)).toEqual([
      "2026-01",
      "2026-01"
    ]);
    expect(backdated.family?.interviewDraft).toBe(seeded.family?.interviewDraft);
    expect(backdated.auditEvents.at(-1)).toMatchObject({
      action: "updated",
      label: "Demo control: family diagnosis dates set to 6 months ago"
    });
  });

  it("does not backdate when a family profile has no diagnoses", () => {
    const seeded: AppState = { ...demoState, family: schoolAgeFamilyState };
    const withoutDiagnoses = healthReducer(seeded, {
      type: "saveFamilyProfile",
      profile: { ...seeded.family!.profile!, diagnoses: [] }
    });

    expect(
      healthReducer(withoutDiagnoses, {
        type: "backdateFamilyDiagnoses",
        monthsAgo: 3,
        now: "2026-07-17T12:00:00.000Z"
      })
    ).toBe(withoutDiagnoses);
  });

  it("removes a care context item with its facts and audits the deletion", () => {
    const contextItemId = demoState.contextItems[0]?.id ?? "voice-note-1";
    const state = {
      ...demoState,
      contextItems: [
        ...demoState.contextItems,
        {
          id: contextItemId,
          patientId: demoState.patient.id,
          title: "Voice note 1",
          rawText: "Check blood pressure every morning.",
          sourceLabel: "Spoken plan note",
          createdAt: "2026-07-20T12:00:00.000Z"
        }
      ],
      extractedFacts: [
        ...demoState.extractedFacts,
        {
          id: "voice-fact-1",
          contextItemId,
          label: "Home monitoring",
          value: "Check blood pressure at home",
          confidence: "medium" as const,
          status: "needs_review" as const,
          sourceSnippet: "Check blood pressure every morning."
        }
      ]
    };

    const next = healthReducer(state, { type: "removeContextItem", contextItemId });

    expect(next.contextItems.some((item) => item.id === contextItemId)).toBe(false);
    expect(next.extractedFacts.some((fact) => fact.contextItemId === contextItemId)).toBe(false);
    expect(next.auditEvents.at(-1)).toMatchObject({ action: "deleted", label: "Care note removed" });
  });

  it("switches the patient language and audits the change", () => {
    const next = healthReducer(demoState, { type: "setLanguage", language: "es" });

    expect(next.patient.language).toBe("es");
    expect(next.auditEvents.at(-1)).toMatchObject({
      patientId: demoState.patient.id,
      action: "updated",
      label: "Language preference updated"
    });
  });

  it("is a strict no-op for the current or an invalid language", () => {
    expect(healthReducer(demoState, { type: "setLanguage", language: "en" })).toBe(demoState);
    expect(healthReducer(demoState, { type: "setLanguage", language: "fr" as never })).toBe(demoState);
  });

  it("saves a family profile and interview draft", () => {
    const seeded: AppState = { ...demoState, family: schoolAgeFamilyState };
    const profiled = healthReducer(seeded, {
      type: "saveFamilyProfile",
      profile: {
        childFirstName: "Avery",
        birthYear: 2020,
        birthMonth: 6,
        schoolStage: "preschool",
        county: "Fayette",
        diagnoses: []
      }
    });
    const drafted = healthReducer(profiled, { type: "setFamilyInterviewDraft", draft: "School is hard." });

    expect(profiled.family?.profile?.childFirstName).toBe("Avery");
    expect(drafted.family?.interviewDraft).toBe("School is hard.");
  });

  it("replaces screen answers and screen facts while retracting yes-to-no domains", () => {
    const seeded: AppState = { ...demoState, family: schoolAgeFamilyState };
    const interviewFact: FamilyFact = {
      id: "interview-fact",
      interviewId: "interview-1",
      label: "Homework",
      value: "hard",
      status: "patient_reported",
      sourceSnippet: "homework is hard"
    };
    const firstAnswers: FamilyScreenAnswer[] = [
      { questionId: "school", domain: "school_iep", response: "yes" }
    ];
    const first = healthReducer(
      { ...seeded, family: seeded.family && { ...seeded.family, facts: [interviewFact] } },
      {
        type: "submitFamilyScreen",
        answers: firstAnswers,
        facts: [
          {
            id: "screen-fact-1",
            label: "School help",
            value: "yes",
            status: "patient_reported",
            sourceSnippet: "Do you need school help?"
          }
        ]
      }
    );
    const second = healthReducer(first, {
      type: "submitFamilyScreen",
      answers: [{ questionId: "school", domain: "school_iep", response: "no" }],
      facts: [
        {
          id: "screen-fact-2",
          label: "School help",
          value: "no",
          status: "patient_reported",
          sourceSnippet: "Do you need school help?"
        }
      ]
    });

    expect(second.family?.screenAnswers[0].response).toBe("no");
    expect(second.family?.facts.map((fact) => fact.id)).toEqual(["interview-fact", "screen-fact-2"]);
    expect(second.family?.activeDomains).not.toContain("school_iep");
  });

  it("appends interviews, clears the draft, and replaces the latest interview domains", () => {
    const seeded: AppState = { ...demoState, family: schoolAgeFamilyState };
    const firstInterview: FamilyInterview = {
      id: "interview-1",
      rawText: "I need school help.",
      source: "typed",
      createdAt: "2026-07-17T12:00:00.000Z",
      extraction: "mock",
      kind: "orientation"
    };
    const first = healthReducer(seeded, {
      type: "addFamilyInterview",
      interview: firstInterview,
      facts: [],
      domains: ["school_iep"]
    });
    const drafted = healthReducer(first, { type: "setFamilyInterviewDraft", draft: "We need speech therapy." });
    const second = healthReducer(drafted, {
      type: "addFamilyInterview",
      interview: { ...firstInterview, id: "interview-2", rawText: "We need speech therapy." },
      facts: [],
      domains: ["therapies"]
    });

    expect(second.family?.interviews.map((interview) => interview.id)).toEqual(["interview-1", "interview-2"]);
    expect(second.family?.interviewDraft).toBe("");
    expect(second.family?.latestInterviewDomains).toEqual(["therapies"]);
    expect(second.family?.activeDomains).toContain("therapies");
    expect(second.family?.activeDomains).not.toContain("school_iep");
  });

  it("confirms only family facts and leaves adult extracted facts untouched", () => {
    const seeded: AppState = { ...demoState, family: schoolAgeFamilyState };
    const before = {
      ...seeded,
      family: seeded.family && {
        ...seeded.family,
        facts: [
          {
            id: "family-fact",
            interviewId: "interview-1",
            label: "Grade",
            value: "fourth",
            status: "inferred" as const,
            sourceSnippet: "fourth grade"
          }
        ]
      }
    };
    const afterConfirm = healthReducer(before, { type: "confirmFamilyFact", factId: "family-fact" });

    expect(afterConfirm.family?.facts[0].status).toBe("confirmed");
    expect(afterConfirm.extractedFacts).toEqual(before.extractedFacts);
  });

  it("excludes only the targeted fact from the visit packet and never deletes it", () => {
    const facts: FamilyFact[] = [
      {
        id: "fact-a",
        interviewId: "interview-1",
        label: "Grade",
        value: "fourth",
        status: "patient_reported",
        sourceSnippet: "fourth grade"
      },
      {
        id: "fact-b",
        interviewId: "interview-1",
        label: "About school and learning",
        value: "reading is hard",
        status: "patient_reported",
        sourceSnippet: "reading is really hard"
      }
    ];
    const seeded: AppState = { ...demoState, family: { ...schoolAgeFamilyState, facts } };

    const excluded = healthReducer(seeded, {
      type: "setFamilyFactInclusion",
      factId: "fact-a",
      include: false
    });
    expect(excluded.family?.facts.map(({ id, includeInSummary }) => [id, includeInSummary])).toEqual([
      ["fact-a", false],
      ["fact-b", undefined]
    ]);
    expect(excluded.family?.facts).toHaveLength(2);

    const reincluded = healthReducer(excluded, {
      type: "setFamilyFactInclusion",
      factId: "fact-a",
      include: true
    });
    expect(reincluded.family?.facts[0].includeInSummary).toBe(true);
  });

  it("ignores a packet-inclusion toggle for an unknown fact", () => {
    const seeded: AppState = { ...demoState, family: schoolAgeFamilyState };

    expect(
      healthReducer(seeded, { type: "setFamilyFactInclusion", factId: "nope", include: false })
    ).toBe(seeded);
    expect(
      healthReducer({ ...demoState, family: null }, {
        type: "setFamilyFactInclusion",
        factId: "nope",
        include: false
      }).family
    ).toBeNull();
  });

  it("toggles packet starter questions and keeps unknown ids out of storage", () => {
    const seeded: AppState = { ...demoState, family: schoolAgeFamilyState };

    const picked = healthReducer(seeded, {
      type: "toggleFamilyPacketQuestion",
      questionId: "results_school"
    });
    const pickedTwo = healthReducer(picked, {
      type: "toggleFamilyPacketQuestion",
      questionId: "who_to_call"
    });
    const unpicked = healthReducer(pickedTwo, {
      type: "toggleFamilyPacketQuestion",
      questionId: "results_school"
    });

    expect(picked.family?.packetQuestionIds).toEqual(["results_school"]);
    expect(pickedTwo.family?.packetQuestionIds).toEqual(["results_school", "who_to_call"]);
    expect(unpicked.family?.packetQuestionIds).toEqual(["who_to_call"]);

    expect(
      healthReducer(pickedTwo, { type: "toggleFamilyPacketQuestion", questionId: "make_it_up" })
    ).toBe(pickedTwo);
    expect(
      healthReducer({ ...demoState, family: null }, {
        type: "toggleFamilyPacketQuestion",
        questionId: "results_school"
      }).family
    ).toBeNull();
  });

  it("saves a resource idempotently and toggles enrollment", () => {
    const seeded: AppState = { ...demoState, family: schoolAgeFamilyState };
    const resource: SavedFamilyResource = {
      resourceId: "ky-spin",
      savedAt: "2026-07-17T12:00:00.000Z",
      domain: "parent_support"
    };
    const saved = healthReducer(seeded, { type: "saveFamilyResource", resource });
    const savedTwice = healthReducer(saved, {
      type: "saveFamilyResource",
      resource: { ...resource, savedAt: "2026-07-17T13:00:00.000Z" }
    });
    const enrolled = healthReducer(savedTwice, { type: "toggleFamilyEnrollment", resourceId: "ky-spin" });
    const unenrolled = healthReducer(enrolled, { type: "toggleFamilyEnrollment", resourceId: "ky-spin" });

    expect(savedTwice.family?.saved).toEqual([resource]);
    expect(enrolled.family?.alreadyEnrolled).toEqual(["ky-spin"]);
    expect(unenrolled.family?.alreadyEnrolled).toEqual([]);
  });

  it("plans one step per resource and audits the commitment", () => {
    const seeded: AppState = { ...demoState, family: schoolAgeFamilyState };

    const planned = healthReducer(seeded, {
      type: "planFamilyStep",
      resourceId: "michelle_p_waiver",
      domain: "waivers_financial",
      at: PLANNED_AT
    });

    expect(planned.family?.steps).toHaveLength(1);
    expect(planned.family?.steps[0]).toMatchObject({
      resourceId: "michelle_p_waiver",
      domain: "waivers_financial",
      status: "planned",
      plannedAt: PLANNED_AT,
      updatedAt: PLANNED_AT
    });
    expect(planned.auditEvents.at(-1)).toMatchObject({
      action: "created",
      label: "Family step planned"
    });

    // A second "I'll do this" is the same commitment, not a new one.
    expect(
      healthReducer(planned, {
        type: "planFamilyStep",
        resourceId: "michelle_p_waiver",
        domain: "waivers_financial",
        at: "2026-07-20T12:00:00.000Z"
      })
    ).toBe(planned);
    expect(
      healthReducer(seeded, {
        type: "planFamilyStep",
        resourceId: "michelle_p_waiver",
        domain: "waivers_financial",
        at: "not-a-timestamp"
      })
    ).toBe(seeded);
  });

  it("moves a planned step through the follow-up statuses and syncs enrollment both ways", () => {
    const planned = healthReducer(
      { ...demoState, family: schoolAgeFamilyState },
      {
        type: "planFamilyStep",
        resourceId: "michelle_p_waiver",
        domain: "waivers_financial",
        at: PLANNED_AT
      }
    );
    const stepId = planned.family!.steps[0].id;

    const tried = healthReducer(planned, {
      type: "updateFamilyStep",
      stepId,
      status: "tried",
      at: "2026-07-20T12:00:00.000Z"
    });
    const enrolled = healthReducer(tried, {
      type: "updateFamilyStep",
      stepId,
      status: "enrolled",
      at: "2026-07-25T12:00:00.000Z"
    });
    const backOff = healthReducer(enrolled, {
      type: "updateFamilyStep",
      stepId,
      status: "in_touch",
      at: "2026-07-26T12:00:00.000Z"
    });

    expect(tried.family?.steps[0]).toMatchObject({
      status: "tried",
      plannedAt: PLANNED_AT,
      updatedAt: "2026-07-20T12:00:00.000Z"
    });
    expect(tried.family?.alreadyEnrolled).toEqual([]);
    expect(enrolled.family?.alreadyEnrolled).toEqual(["michelle_p_waiver"]);
    expect(backOff.family?.alreadyEnrolled).toEqual([]);
    expect(backOff.family?.steps[0].status).toBe("in_touch");
    expect(tried.auditEvents.at(-1)).toMatchObject({
      action: "updated",
      label: "Family step updated"
    });
  });

  it("refuses step updates that are unknown, undated, or older than the plan", () => {
    const planned = healthReducer(
      { ...demoState, family: schoolAgeFamilyState },
      {
        type: "planFamilyStep",
        resourceId: "michelle_p_waiver",
        domain: "waivers_financial",
        at: PLANNED_AT
      }
    );
    const stepId = planned.family!.steps[0].id;

    expect(
      healthReducer(planned, { type: "updateFamilyStep", stepId: "nope", status: "tried", at: PLANNED_AT })
    ).toBe(planned);
    expect(
      healthReducer(planned, { type: "updateFamilyStep", stepId, status: "tried", at: "whenever" })
    ).toBe(planned);
    expect(
      healthReducer(planned, {
        type: "updateFamilyStep",
        stepId,
        status: "tried",
        at: "2026-07-01T12:00:00.000Z"
      })
    ).toBe(planned);
    expect(
      healthReducer(
        { ...demoState, family: null },
        { type: "updateFamilyStep", stepId, status: "tried", at: PLANNED_AT }
      ).family
    ).toBeNull();
  });

  it("upserts a step from the enrollment checkbox and steps it back when the checkbox clears", () => {
    const seeded: AppState = { ...demoState, family: schoolAgeFamilyState };

    const enrolled = healthReducer(seeded, {
      type: "toggleFamilyEnrollment",
      resourceId: "michelle_p_waiver"
    });
    const cleared = healthReducer(enrolled, {
      type: "toggleFamilyEnrollment",
      resourceId: "michelle_p_waiver"
    });
    const reEnrolled = healthReducer(cleared, {
      type: "toggleFamilyEnrollment",
      resourceId: "michelle_p_waiver"
    });

    expect(enrolled.family?.steps).toHaveLength(1);
    expect(enrolled.family?.steps[0]).toMatchObject({
      resourceId: "michelle_p_waiver",
      domain: "waivers_financial",
      status: "enrolled"
    });
    expect(cleared.family?.steps[0].status).toBe("in_touch");
    expect(cleared.family?.alreadyEnrolled).toEqual([]);
    expect(reEnrolled.family?.steps).toHaveLength(1);
    expect(reEnrolled.family?.steps[0].status).toBe("enrolled");
    expect(reEnrolled.family?.alreadyEnrolled).toEqual(["michelle_p_waiver"]);

    // A resource the catalog no longer knows gets no invented step.
    const unknown = healthReducer(seeded, { type: "toggleFamilyEnrollment", resourceId: "ky-spin" });
    expect(unknown.family?.steps).toEqual([]);
    expect(unknown.family?.alreadyEnrolled).toEqual(["ky-spin"]);
  });

  it("keeps alreadyEnrolled and the step tracker agreeing across every entry path", () => {
    const seeded: AppState = { ...demoState, family: schoolAgeFamilyState };
    const plan = (state: AppState): AppState =>
      healthReducer(state, {
        type: "planFamilyStep",
        resourceId: "michelle_p_waiver",
        domain: "waivers_financial",
        at: PLANNED_AT
      });
    // Without an explicit stamp the update lands on the step's own last stamp, so
    // sequences that start from the checkbox (which stamps the real clock) stay
    // coherent whatever day the suite runs.
    const setStatus = (state: AppState, status: FamilyStepStatus, at?: string): AppState => {
      const step = state.family!.steps[0];
      return healthReducer(state, {
        type: "updateFamilyStep",
        stepId: step.id,
        status,
        at: at ?? step.updatedAt
      });
    };
    const toggle = (state: AppState): AppState =>
      healthReducer(state, { type: "toggleFamilyEnrollment", resourceId: "michelle_p_waiver" });

    const sequences: AppState[] = [
      setStatus(plan(seeded), "enrolled", "2026-07-20T12:00:00.000Z"),
      setStatus(setStatus(plan(seeded), "enrolled", "2026-07-20T12:00:00.000Z"), "not_for_us", "2026-07-21T12:00:00.000Z"),
      toggle(plan(seeded)),
      toggle(toggle(plan(seeded))),
      setStatus(toggle(seeded), "tried"),
      plan(toggle(seeded))
    ];

    for (const state of sequences) {
      const family = state.family!;
      const enrolledStep = family.steps.some(
        ({ resourceId, status }) => resourceId === "michelle_p_waiver" && status === "enrolled"
      );
      expect(family.alreadyEnrolled.includes("michelle_p_waiver")).toBe(enrolledStep);
      expect(family.steps.filter(({ resourceId }) => resourceId === "michelle_p_waiver")).toHaveLength(1);
    }
  });

  it("raises exactly one open regression flag at a time and lets a new one open after acknowledgement", () => {
    const seeded: AppState = { ...demoState, family: schoolAgeFamilyState };

    const raised = healthReducer(seeded, {
      type: "raiseFamilyRegressionFlag",
      source: "text",
      at: PLANNED_AT
    });

    expect(raised.family?.flags).toHaveLength(1);
    expect(raised.family?.flags[0]).toMatchObject({
      type: "regression",
      source: "text",
      raisedAt: PLANNED_AT
    });
    expect(raised.family?.flags[0].acknowledgedAt).toBeUndefined();
    expect(raised.auditEvents.at(-1)).toMatchObject({
      action: "created",
      label: "Family regression flag raised"
    });

    // The probe and the text lexicon describe the same worry: ask once.
    const raisedAgain = healthReducer(raised, {
      type: "raiseFamilyRegressionFlag",
      source: "probe",
      at: "2026-07-20T12:00:00.000Z"
    });
    expect(raisedAgain).toBe(raised);

    const acknowledged = healthReducer(raised, {
      type: "acknowledgeFamilyRegressionFlag",
      flagId: raised.family!.flags[0].id,
      at: "2026-07-20T12:00:00.000Z"
    });
    const reRaised = healthReducer(acknowledged, {
      type: "raiseFamilyRegressionFlag",
      source: "probe",
      at: "2026-07-21T12:00:00.000Z"
    });

    expect(acknowledged.family?.flags[0].acknowledgedAt).toBe("2026-07-20T12:00:00.000Z");
    expect(acknowledged.auditEvents.at(-1)).toMatchObject({
      action: "updated",
      label: "Family regression flag acknowledged"
    });
    expect(reRaised.family?.flags).toHaveLength(2);
    expect(reRaised.family?.flags[1]).toMatchObject({ source: "probe", raisedAt: "2026-07-21T12:00:00.000Z" });
  });

  it("refuses regression flag history that storage would drop on reload", () => {
    const seeded: AppState = { ...demoState, family: schoolAgeFamilyState };
    const raised = healthReducer(seeded, {
      type: "raiseFamilyRegressionFlag",
      source: "text",
      at: PLANNED_AT
    });
    const flagId = raised.family!.flags[0].id;

    expect(
      healthReducer(seeded, { type: "raiseFamilyRegressionFlag", source: "text", at: "whenever" })
    ).toBe(seeded);
    expect(
      healthReducer(raised, { type: "acknowledgeFamilyRegressionFlag", flagId, at: "whenever" })
    ).toBe(raised);
    expect(
      healthReducer(raised, { type: "acknowledgeFamilyRegressionFlag", flagId: "nope", at: PLANNED_AT })
    ).toBe(raised);
    // An acknowledgement older than the flag itself is impossible history.
    expect(
      healthReducer(raised, {
        type: "acknowledgeFamilyRegressionFlag",
        flagId,
        at: "2026-07-01T12:00:00.000Z"
      })
    ).toBe(raised);
    // Acknowledging twice is a no-op, not a second stamp.
    const acknowledged = healthReducer(raised, {
      type: "acknowledgeFamilyRegressionFlag",
      flagId,
      at: "2026-07-20T12:00:00.000Z"
    });
    expect(
      healthReducer(acknowledged, {
        type: "acknowledgeFamilyRegressionFlag",
        flagId,
        at: "2026-07-21T12:00:00.000Z"
      })
    ).toBe(acknowledged);
    expect(
      healthReducer(
        { ...demoState, family: null },
        { type: "acknowledgeFamilyRegressionFlag", flagId, at: PLANNED_AT }
      ).family
    ).toBeNull();
  });

  it("records a pulse, stamps the check-in touch, and audits it", () => {
    const seeded: AppState = { ...demoState, family: schoolAgeFamilyState };

    const recorded = healthReducer(seeded, {
      type: "recordFamilyPulse",
      pulse: { at: PLANNED_AT, score: 4 }
    });

    expect(recorded.family?.pulses).toEqual([{ at: PLANNED_AT, score: 4 }]);
    expect(recorded.family?.checkinTouchedAt).toBe(PLANNED_AT);
    expect(recorded.auditEvents.at(-1)).toMatchObject({
      action: "created",
      label: "Family pulse recorded"
    });
  });

  it("refuses pulse scores and stamps storage would drop on reload", () => {
    const seeded: AppState = { ...demoState, family: schoolAgeFamilyState };
    const badScore = (score: number) => ({
      type: "recordFamilyPulse" as const,
      pulse: { at: PLANNED_AT, score: score as FamilyPulse["score"] }
    });

    expect(healthReducer(seeded, badScore(0))).toBe(seeded);
    expect(healthReducer(seeded, badScore(6))).toBe(seeded);
    expect(healthReducer(seeded, badScore(3.5))).toBe(seeded);
    expect(
      healthReducer(seeded, { type: "recordFamilyPulse", pulse: { at: "whenever", score: 3 } })
    ).toBe(seeded);
    expect(
      healthReducer({ ...demoState, family: null }, {
        type: "recordFamilyPulse",
        pulse: { at: PLANNED_AT, score: 3 }
      }).family
    ).toBeNull();
  });

  // Skipping stores nothing about the child and still has to reset due-ness.
  it("skips the check-in by stamping a touch, and the selector agrees", () => {
    const quiet: FamilyInterview = {
      id: "interview-quiet",
      rawText: "She is doing about the same as last month.",
      source: "typed",
      createdAt: "2026-06-01T12:00:00.000Z",
      extraction: "mock",
      kind: "note"
    };
    const seeded: AppState = {
      ...demoState,
      family: { ...schoolAgeFamilyState, interviews: [quiet] }
    };
    const now = new Date(PLANNED_AT);

    expect(checkInDue(seeded.family!, now)).toBe(true);

    const skipped = healthReducer(seeded, { type: "skipFamilyCheckin", at: PLANNED_AT });

    expect(skipped.family?.checkinTouchedAt).toBe(PLANNED_AT);
    expect(skipped.family?.pulses).toEqual([]);
    expect(skipped.family?.interviews).toEqual([quiet]);
    expect(checkInDue(skipped.family!, now)).toBe(false);
    expect(skipped.auditEvents.at(-1)).toMatchObject({
      action: "updated",
      label: "Family check-in skipped"
    });
    expect(healthReducer(seeded, { type: "skipFamilyCheckin", at: "whenever" })).toBe(seeded);
    expect(
      healthReducer({ ...demoState, family: null }, { type: "skipFamilyCheckin", at: PLANNED_AT })
        .family
    ).toBeNull();
  });

  it("moves every family touch back for the demo and audits the move", () => {
    const seeded: AppState = {
      ...demoState,
      family: {
        ...schoolAgeFamilyState,
        interviews: [
          {
            id: "interview-1",
            rawText: "He is pointing at pictures now.",
            source: "typed",
            createdAt: PLANNED_AT,
            extraction: "mock",
            kind: "checkin"
          }
        ],
        pulses: [{ at: PLANNED_AT, score: 5 }],
        steps: [
          {
            id: "step-1",
            resourceId: "ky_spin",
            domain: "parent_support",
            status: "planned",
            plannedAt: PLANNED_AT,
            updatedAt: PLANNED_AT
          }
        ],
        saved: [{ resourceId: "ky_spin", savedAt: PLANNED_AT, domain: "parent_support" }],
        checkinTouchedAt: PLANNED_AT
      }
    };

    const moved = healthReducer(seeded, {
      type: "backdateFamilyTouches",
      days: 31,
      now: PLANNED_AT
    });
    const shifted = "2026-06-16T12:00:00.000Z";

    expect(moved.family?.interviews[0].createdAt).toBe(shifted);
    expect(moved.family?.pulses[0].at).toBe(shifted);
    // Both step stamps move together, so updatedAt never falls before plannedAt.
    expect(moved.family?.steps[0]).toMatchObject({ plannedAt: shifted, updatedAt: shifted });
    expect(moved.family?.saved[0].savedAt).toBe(shifted);
    expect(moved.family?.checkinTouchedAt).toBe(shifted);
    expect(checkInDue(moved.family!, new Date(PLANNED_AT))).toBe(true);
    expect(moved.auditEvents.at(-1)).toMatchObject({
      action: "updated",
      label: "Demo control: family activity moved 31 days back"
    });

    expect(healthReducer(seeded, { type: "backdateFamilyTouches", days: 0, now: PLANNED_AT })).toBe(
      seeded
    );
    expect(
      healthReducer(seeded, { type: "backdateFamilyTouches", days: 1.5, now: PLANNED_AT })
    ).toBe(seeded);
    expect(healthReducer(seeded, { type: "backdateFamilyTouches", days: 31, now: "whenever" })).toBe(
      seeded
    );
  });

  it("clears family data on reset and deletion", () => {
    const seeded: AppState = { ...demoState, family: schoolAgeFamilyState };

    expect(healthReducer(seeded, { type: "resetDemo" }).family).toBeNull();
    expect(healthReducer(seeded, { type: "deleteDemoData" }).family).toBeNull();
  });

  it("completeOnboarding sets the primary and full conditions, preserving the plan relationship", () => {
    const next = healthReducer(demoState, { type: "completeOnboarding", conditions: ["diabetes", "hypertension"] });

    expect(next.carePlan.conditions).toEqual(["hypertension", "diabetes"]);
    expect(next.carePlan.condition).toBe("hypertension");
    expect(next.carePlan.patientId).toBe(demoState.patient.id);
    expect(next.auditEvents.at(-1)?.label).toContain("Onboarding");
  });

  it("adds a glucose reading and audit event", () => {
    const reading: GlucoseReading = {
      id: "g-1",
      patientId: demoState.patient.id,
      valueMgDl: 120,
      measuredAt: "2026-07-05T07:00:00.000Z",
      contexts: ["morning"],
      note: ""
    };
    const next = healthReducer({ ...demoState, glucoseReadings: [] }, { type: "addGlucoseReading", reading });

    expect(next.glucoseReadings).toHaveLength(1);
    expect(next.glucoseReadings[0].valueMgDl).toBe(120);
    expect(next.auditEvents.at(-1)?.label).toContain("Blood sugar");
  });

  it("adds a blood pressure reading and audit event", () => {
    const next = healthReducer({ ...demoState, readings: [] }, {
      type: "addReading",
      reading: {
        id: "reading-1",
        patientId: "patient-1",
        systolic: 128,
        diastolic: 82,
        pulse: 72,
        measuredAt: "2026-07-05T09:00:00.000Z",
        contexts: ["morning"],
        note: "Before coffee"
      }
    });

    expect(next.readings).toHaveLength(1);
    expect(next.auditEvents.at(-1)?.label).toBe("Blood pressure reading added");
  });

  it("captures a medication barrier without removing existing medicine details", () => {
    const next = healthReducer(demoState, {
      type: "setMedicationBarriers",
      medicationId: "med-1",
      barriers: ["cost", "side_effects"]
    });

    expect(next.medications[0].name).toBe("Lisinopril");
    expect(next.medications[0].activeBarriers).toEqual(["cost", "side_effects"]);
  });

  it("appends a meal log entry and records an audit event", () => {
    const next = healthReducer(demoState, {
      type: "addMealLogEntry",
      entry: {
        id: "meal-1",
        patientId: "patient-1",
        loggedAt: "2026-07-05T12:00:00.000Z",
        food: { id: "1", barcode: "1", name: "Soup", brand: null, category: null, nutrition: null, source: "barcode_seed" },
        flags: ["890 mg sodium"],
        assistantSummary: "High in sodium."
      }
    });

    expect(next.mealLog).toHaveLength(1);
    expect(next.mealLog[0].id).toBe("meal-1");
    expect(next.auditEvents.at(-1)?.label).toBe("Meal logged from Food Lens");
  });

  it("returns the retinopathy-due demo state for a plain resetDemo action", () => {
    const modifiedState = {
      ...demoState,
      readings: [
        {
          id: "reading-1",
          patientId: "patient-1",
          systolic: 128,
          diastolic: 82,
          pulse: 72,
          measuredAt: "2026-07-05T09:00:00.000Z",
          contexts: ["morning"],
          note: "Before coffee"
        }
      ],
      medications: [
        {
          ...demoState.medications[0],
          activeBarriers: ["cost"]
        }
      ]
    };

    const next = healthReducer(modifiedState, { type: "resetDemo" });

    expect(next).toEqual(brentState);
  });

  it("deletes demo data without reseeding personal demo content", () => {
    const modifiedState = {
      ...demoState,
      readings: [
        {
          id: "reading-1",
          patientId: "patient-1",
          systolic: 128,
          diastolic: 82,
          pulse: 72,
          measuredAt: "2026-07-05T09:00:00.000Z",
          contexts: ["morning"],
          note: "Before coffee"
        }
      ],
      medications: [
        {
          ...demoState.medications[0],
          activeBarriers: ["cost"]
        }
      ]
    };

    const next = healthReducer(modifiedState, { type: "deleteDemoData" });

    expect(next.patient.id).toBe("patient-deleted");
    expect(next.patient.name).not.toBe(demoState.patient.name);
    expect(next.medications).toHaveLength(0);
    expect(next.readings).toHaveLength(0);
    expect(next.contextItems).toHaveLength(0);
    expect(next.aiMessages).toHaveLength(0);
    expect(next.auditEvents).toHaveLength(1);
    expect(next.auditEvents[0]).toMatchObject({
      action: "deleted",
      label: "Demo data deleted",
      patientId: "patient-deleted"
    });
    expect(next.auditEvents[0]?.createdAt).toBeTypeOf("string");
  });

  it("audits an assistant crisis message as crisis_escalated instead of ai_generated", () => {
    const next = healthReducer(demoState, {
      type: "addAiMessage",
      message: {
        id: "message-crisis",
        mode: "trouble",
        role: "assistant",
        content: "Please reach out now: call or text 988.",
        createdAt: "2026-07-06T12:00:00.000Z",
        safety: "crisis",
        sources: [],
        actions: ["crisis_call_988", "crisis_text_988", "call_emergency", "safety_plan"]
      }
    });

    expect(next.aiMessages.at(-1)?.safety).toBe("crisis");
    expect(next.auditEvents.at(-1)?.action).toBe("crisis_escalated");
    expect(next.auditEvents.at(-1)?.label).toBe("Crisis resources shown");
  });

  it("marks a crisis message acknowledged and audits the acknowledgement", () => {
    const withMessage = healthReducer(demoState, {
      type: "addAiMessage",
      message: {
        id: "message-crisis",
        mode: "trouble",
        role: "assistant",
        content: "Please reach out now.",
        createdAt: "2026-07-06T12:00:00.000Z",
        safety: "crisis",
        sources: [],
        actions: ["crisis_call_988"]
      }
    });

    const next = healthReducer(withMessage, { type: "acknowledgeCrisis", messageId: "message-crisis" });

    expect(next.aiMessages.find((message) => message.id === "message-crisis")?.acknowledged).toBe(true);
    expect(next.auditEvents.at(-1)?.action).toBe("updated");
    expect(next.auditEvents.at(-1)?.label).toBe("Crisis resources acknowledged");
  });

  it("logs a medication refill and records a created audit event", () => {
    const next = healthReducer(demoState, {
      type: "logMedicationFill",
      fill: {
        id: "fill-1",
        patientId: "patient-1",
        medicationId: "med-1",
        medicationName: "Lisinopril",
        dateOfService: "2026-06-01",
        daysSupply: 30,
        source: "patient_reported"
      }
    });

    expect(next.medicationFills).toHaveLength(1);
    expect(next.medicationFills[0].id).toBe("fill-1");
    expect(next.auditEvents.at(-1)?.action).toBe("created");
    expect(next.auditEvents.at(-1)?.label).toBe("Medication refill logged");
  });

  it("records a phq9 assessment event and audits assessment_recorded", () => {
    const next = healthReducer(demoState, {
      type: "addAssessmentEvent",
      event: {
        id: "assessment-1",
        patientId: "patient-1",
        instrumentId: "phq9",
        itemResponses: [1, 1, 1, 1, 1, 0, 0, 0, 0],
        totalScore: 5,
        severityBand: "mild",
        status: "patient_reported",
        recordedAt: "2026-07-06T12:00:00.000Z"
      }
    });

    expect(next.assessmentEvents).toHaveLength(1);
    expect(next.auditEvents.at(-1)?.action).toBe("assessment_recorded");
    expect(next.auditEvents.at(-1)?.label).toBe("PHQ-9 mood check-in recorded");
  });

  it("uses the generic audit fallback when an event references an unknown instrument", () => {
    const next = healthReducer(demoState, {
      type: "addAssessmentEvent",
      event: {
        id: "assessment-future",
        patientId: "patient-1",
        instrumentId: "future-screen",
        itemResponses: [1],
        totalScore: 1,
        severityBand: "positive",
        status: "patient_reported",
        recordedAt: "2026-07-06T12:00:00.000Z"
      }
    });

    expect(next.auditEvents.at(-1)?.label).toBe("Check-in recorded");
  });

  it("keeps the legacy Jordan fixture available through resetDemo with a patient argument", () => {
    const next = healthReducer(demoState, { type: "resetDemo", patient: "brent" });
    expect(next).toEqual(brentState);
    expect(healthReducer(brentState, { type: "resetDemo", patient: "jordan" })).toEqual(demoState);
  });

  it("updates accessibility preferences and audits the change", () => {
    const next = healthReducer(demoState, {
      type: "updateAccessibilityPreferences",
      preferences: ["large_text", "high_contrast"]
    });

    expect(next.patient.accessibilityPreferences).toEqual(["large_text", "high_contrast"]);
    expect(next.auditEvents.at(-1)?.action).toBe("updated");
    expect(next.auditEvents.at(-1)?.label).toBe("Display and access preferences updated");
  });

  it("records an exported event through addAuditEvent for privacy actions", () => {
    const exportedEvent = recordAuditEvent(demoState.patient.id, "exported", "Data exported");
    const next = healthReducer(demoState, {
      type: "addAuditEvent",
      event: exportedEvent
    });

    expect(next.auditEvents).toHaveLength(1);
    expect(next.auditEvents[0]).toEqual(exportedEvent);
    expect(next.auditEvents[0]?.action).toBe("exported");
    expect(next.auditEvents[0]?.label).toBe("Data exported");
  });

  it("bookScreening walks an overdue gap through engaged to scheduled and audits it", () => {
    const next = healthReducer(demoState, {
      type: "bookScreening",
      gapId: "gap-demo-dr",
      siteId: "site_fqhc_mobile",
      siteName: "Perry County FQHC Mobile Camera",
      when: "Tuesday 2:40 PM"
    });

    const gap = next.screeningGaps[0];
    expect(gap.status).toBe("scheduled");
    expect(gap.scheduledSiteId).toBe("site_fqhc_mobile");
    expect(gap.scheduledFor).toBe("Tuesday 2:40 PM");
    expect(next.auditEvents.at(-1)?.action).toBe("screening_scheduled");
    expect(next.auditEvents.at(-1)?.label).toContain("Perry County FQHC Mobile Camera");
  });

  it("bookScreening ignores a gap with no legal path to scheduled", () => {
    const closed = {
      ...demoState,
      screeningGaps: [{ ...demoState.screeningGaps[0], status: "closed" as const }]
    };
    const next = healthReducer(closed, {
      type: "bookScreening",
      gapId: "gap-demo-dr",
      siteId: "site_fqhc_mobile",
      siteName: "Perry County FQHC Mobile Camera",
      when: "Tuesday 2:40 PM"
    });

    expect(next).toBe(closed);
  });

  it("bookScreening reschedules a repeat gap directly", () => {
    const repeat = {
      ...demoState,
      screeningGaps: [{ ...demoState.screeningGaps[0], status: "repeat" as const }]
    };
    const next = healthReducer(repeat, {
      type: "bookScreening",
      gapId: "gap-demo-dr",
      siteId: "site_kroger",
      siteName: "Community Camera at Kroger",
      when: "Friday 4:00 PM"
    });

    expect(next.screeningGaps[0].status).toBe("scheduled");
  });

  const scheduledState = () => ({
    ...demoState,
    screeningGaps: [
      {
        ...demoState.screeningGaps[0],
        status: "scheduled" as const,
        scheduledSiteId: "site_fqhc_mobile",
        scheduledFor: "Tuesday 2:40 PM"
      }
    ]
  });

  it("screeningResultConfirmed imports an abnormal result, parks the gap, and places the routine referral", () => {
    const next = healthReducer(scheduledState(), {
      type: "screeningResultConfirmed",
      extraction: { grade: "moderate_npdr", dmePresent: false, ungradable: false },
      source: "photo_report",
      reportRef: "report-moderate-npdr.svg"
    });

    expect(next.screeningResults).toHaveLength(1);
    expect(next.screeningResults[0]).toMatchObject({
      gapId: "gap-demo-dr",
      outcome: "abnormal",
      grade: "moderate_npdr",
      source: "photo_report",
      reportRef: "report-moderate-npdr.svg"
    });
    expect(next.screeningGaps[0].status).toBe("referral");

    // The same dispatch places the referral: routine tier, nearest optometry,
    // drafted + sent history, its own audit event.
    expect(next.referrals).toHaveLength(1);
    expect(next.referrals[0]).toMatchObject({
      resultId: next.screeningResults[0].id,
      tier: "optometry_routine",
      destinationId: "dest_hazard_optometry"
    });
    expect(next.referrals[0].stageHistory.map((entry) => entry.stage)).toEqual(["drafted", "sent"]);
    expect(next.auditEvents.at(-2)?.action).toBe("screening_result_confirmed");
    expect(next.auditEvents.at(-1)?.action).toBe("referral_placed");
  });

  it("screeningResultConfirmed routes DME/PDR to the urgent retina destination", () => {
    const next = healthReducer(scheduledState(), {
      type: "screeningResultConfirmed",
      extraction: { grade: "pdr", dmePresent: true, ungradable: false },
      source: "photo_report",
      reportRef: "report-pdr-dme.svg"
    });

    expect(next.referrals[0]).toMatchObject({ tier: "retina_urgent", destinationId: "dest_uk_retina" });
  });

  it("screeningResultConfirmed closes the gap on a normal result with no referral", () => {
    const next = healthReducer(scheduledState(), {
      type: "screeningResultConfirmed",
      extraction: { grade: "no_dr", dmePresent: false, ungradable: false },
      source: "photo_report",
      reportRef: "report-no-dr.svg"
    });

    expect(next.screeningResults[0].outcome).toBe("normal");
    expect(next.screeningGaps[0].status).toBe("closed");
    expect(next.referrals).toHaveLength(0);
  });

  it("screeningResultConfirmed loops an ungradable result into the repeat flow", () => {
    const next = healthReducer(scheduledState(), {
      type: "screeningResultConfirmed",
      extraction: { grade: null, dmePresent: null, ungradable: true },
      source: "photo_report",
      reportRef: "report-ungradable.svg"
    });

    expect(next.screeningResults[0].outcome).toBe("ungradable");
    expect(next.screeningGaps[0].status).toBe("repeat");
  });

  it("screeningResultConfirmed schedules the annual recall on normal results", () => {
    const noDr = healthReducer(scheduledState(), {
      type: "screeningResultConfirmed",
      extraction: { grade: "no_dr", dmePresent: false, ungradable: false },
      source: "photo_report",
      reportRef: "report-no-dr.svg"
    });
    expect(noDr.recallReminders).toHaveLength(1);
    expect(noDr.recallReminders[0].reason).toBe("annual_rescreen");
    const confirmedAt = new Date(noDr.screeningResults[0].confirmedAt);
    const dueAt = new Date(noDr.recallReminders[0].dueAt);
    expect(dueAt.getUTCFullYear()).toBe(confirmedAt.getUTCFullYear() + 1);
    expect(dueAt.getUTCMonth()).toBe(confirmedAt.getUTCMonth());
    expect(noDr.auditEvents.at(-1)?.action).toBe("recall_scheduled");

    const mild = healthReducer(scheduledState(), {
      type: "screeningResultConfirmed",
      extraction: { grade: "mild_npdr", dmePresent: false, ungradable: false },
      source: "typed_entry",
      reportRef: "typed-entry"
    });
    expect(mild.recallReminders[0].reason).toBe("annual_rescreen_mild");

    const abnormal = healthReducer(scheduledState(), {
      type: "screeningResultConfirmed",
      extraction: { grade: "moderate_npdr", dmePresent: false, ungradable: false },
      source: "photo_report",
      reportRef: "report-moderate-npdr.svg"
    });
    expect(abnormal.recallReminders).toHaveLength(0);
  });

  it("checkReferralFollowup marks a silent referral stalled exactly once", () => {
    const withReferral = healthReducer(scheduledState(), {
      type: "screeningResultConfirmed",
      extraction: { grade: "moderate_npdr", dmePresent: false, ungradable: false },
      source: "photo_report",
      reportRef: "report-moderate-npdr.svg"
    });
    const referralId = withReferral.referrals[0].id;

    // Nothing due yet: strict no-op, same state reference.
    expect(healthReducer(withReferral, { type: "checkReferralFollowup" })).toBe(withReferral);

    const backdated = healthReducer(withReferral, { type: "backdateReferral", referralId, days: 6 });
    expect(new Date(backdated.referrals[0].sentAt).valueOf()).toBeLessThan(
      new Date(withReferral.referrals[0].sentAt).valueOf()
    );

    const escalated = healthReducer(backdated, { type: "checkReferralFollowup" });
    expect(escalated.referrals[0].stageHistory.at(-1)?.stage).toBe("stalled");
    expect(escalated.auditEvents.at(-1)?.action).toBe("referral_escalated");

    // Idempotent: a second check adds nothing.
    expect(healthReducer(escalated, { type: "checkReferralFollowup" })).toBe(escalated);
  });

  it("markClinicConfirmed appends the stage once and keeps the stalled history honest", () => {
    const withReferral = healthReducer(scheduledState(), {
      type: "screeningResultConfirmed",
      extraction: { grade: "pdr", dmePresent: true, ungradable: false },
      source: "photo_report",
      reportRef: "report-pdr-dme.svg"
    });
    const referralId = withReferral.referrals[0].id;
    const backdated = healthReducer(withReferral, { type: "backdateReferral", referralId, days: 3 });
    const stalled = healthReducer(backdated, { type: "checkReferralFollowup" });

    const confirmed = healthReducer(stalled, { type: "markClinicConfirmed", referralId });
    const stages = confirmed.referrals[0].stageHistory.map((entry) => entry.stage);
    expect(stages).toEqual(["drafted", "sent", "stalled", "clinic_confirmed"]);

    // Confirming again is a no-op.
    expect(healthReducer(confirmed, { type: "markClinicConfirmed", referralId })).toBe(confirmed);
  });

  it("bookReferralSlot appends the scheduled stage with the slot and audits it", () => {
    const withReferral = healthReducer(scheduledState(), {
      type: "screeningResultConfirmed",
      extraction: { grade: "moderate_npdr", dmePresent: false, ungradable: false },
      source: "photo_report",
      reportRef: "report-moderate-npdr.svg"
    });
    const referralId = withReferral.referrals[0].id;

    const booked = healthReducer(withReferral, {
      type: "bookReferralSlot",
      referralId,
      slot: "Tue Jul 14 · 9:20 AM"
    });

    expect(booked.referrals[0].scheduledFor).toBe("Tue Jul 14 · 9:20 AM");
    expect(booked.referrals[0].stageHistory.at(-1)).toMatchObject({
      stage: "scheduled",
      note: "Booked Tue Jul 14 · 9:20 AM at Hazard Optometry Associates"
    });
    expect(booked.auditEvents.at(-1)?.action).toBe("referral_booked");

    // A second booking or an off-catalog slot is refused.
    expect(healthReducer(booked, { type: "bookReferralSlot", referralId, slot: "Thu Jul 16 · 1:40 PM" })).toBe(booked);
    expect(
      healthReducer(withReferral, { type: "bookReferralSlot", referralId, slot: "Sun Jul 19 · 4:00 AM" })
    ).toBe(withReferral);
  });

  it("markReferralCompleted closes the loop once, self-reported", () => {
    const withReferral = healthReducer(scheduledState(), {
      type: "screeningResultConfirmed",
      extraction: { grade: "moderate_npdr", dmePresent: false, ungradable: false },
      source: "photo_report",
      reportRef: "report-moderate-npdr.svg"
    });
    const referralId = withReferral.referrals[0].id;
    const booked = healthReducer(withReferral, {
      type: "bookReferralSlot",
      referralId,
      slot: "Tue Jul 14 · 9:20 AM"
    });

    const completed = healthReducer(booked, { type: "markReferralCompleted", referralId });
    expect(completed.referrals[0].stageHistory.at(-1)?.stage).toBe("completed");
    expect(healthReducer(completed, { type: "markReferralCompleted", referralId })).toBe(completed);
  });

  it("screeningResultConfirmed refuses to import without a scheduled gap or with a refusal", () => {
    const noSchedule = healthReducer(demoState, {
      type: "screeningResultConfirmed",
      extraction: { grade: "no_dr", dmePresent: false, ungradable: false },
      source: "photo_report",
      reportRef: "report-no-dr.svg"
    });
    expect(noSchedule).toBe(demoState);

    const refused = healthReducer(scheduledState(), {
      type: "screeningResultConfirmed",
      extraction: { grade: null, dmePresent: null, ungradable: false, refusal: "unreadable" },
      source: "photo_report",
      reportRef: "IMG_1.jpg"
    });
    expect(refused.screeningResults).toHaveLength(0);
  });
});

describe("family appointment actions", () => {
  const NOW = "2026-07-24T12:00:00.000Z";
  const DAY_MS = 24 * 60 * 60 * 1000;

  function stateWithReferral(): AppState {
    const base: AppState = { ...demoState, family: schoolAgeFamilyState };
    return healthReducer(base, {
      type: "setFamilyReferral",
      referral: { clinic: "UK Developmental Pediatrics", referredAt: NOW }
    });
  }

  function stateWithOffer() {
    const seeded = stateWithReferral();
    const offer = createFamilyAppointmentOffer(new Date(NOW));
    return { state: healthReducer(seeded, { type: "offerFamilyAppointment", appointment: offer }), offer };
  }

  function bookFirstOffer(state: AppState, offer: ReturnType<typeof createFamilyAppointmentOffer>): AppState {
    return healthReducer(state, {
      type: "bookFamilyAppointment",
      appointmentId: offer.id,
      slot: offer.offeredSlots[0],
      at: NOW
    });
  }

  it("seeds a referral and one valid offer without duplicate audit events", () => {
    const { state, offer } = stateWithOffer();

    expect(state.family?.referral?.clinic).toBe("UK Developmental Pediatrics");
    expect(state.family?.appointments.at(-1)?.id).toBe(offer.id);
    expect(
      healthReducer(state, {
        type: "setFamilyReferral",
        referral: { clinic: "UK Developmental Pediatrics", referredAt: NOW }
      })
    ).toBe(state);
    expect(healthReducer(state, { type: "offerFamilyAppointment", appointment: offer })).toBe(state);
  });

  it("books a slot and confirms via a reminder ack", () => {
    const { state, offer } = stateWithOffer();
    const slot = offer.offeredSlots[0];
    const booked = bookFirstOffer(state, offer);
    expect(booked.family?.appointments.at(-1)?.status).toBe("booked");
    expect(booked.family?.appointments.at(-1)?.scheduledFor).toBe(slot);

    const reminderAt = new Date(new Date(slot).valueOf() - 0.5 * DAY_MS).toISOString();
    const confirmed = healthReducer(booked, {
      type: "acknowledgeFamilyAppointmentReminder",
      appointmentId: offer.id,
      offset: "t1",
      at: reminderAt
    });
    expect(confirmed.family?.appointments.at(-1)?.status).toBe("confirmed");
    expect(confirmed.family?.appointments.at(-1)?.reminderAcks).toEqual([
      { offset: "t1", acknowledgedAt: reminderAt }
    ]);
  });

  it("records coherent barriers once and merges domains without duplicates", () => {
    const { state, offer } = stateWithOffer();
    const booked = bookFirstOffer(state, offer);
    const withBarrier = healthReducer(booked, {
      type: "recordFamilyAppointmentBarriers",
      appointmentId: offer.id,
      barriers: ["ride"],
      at: NOW
    });
    expect(withBarrier.family?.appointments.at(-1)?.barriersAsked).toBe(true);
    expect(withBarrier.family?.activeDomains).toContain("transportation");

    const again = healthReducer(withBarrier, {
      type: "recordFamilyAppointmentBarriers",
      appointmentId: offer.id,
      barriers: ["ride"],
      at: NOW
    });
    expect(again).toBe(withBarrier);
    expect(again.auditEvents).toBe(withBarrier.auditEvents);
    expect(again.family?.activeDomains.filter((domain) => domain === "transportation")).toHaveLength(1);
  });

  it.each([
    ["empty", []],
    ["duplicate", ["ride", "ride"]],
    ["none plus another barrier", ["none", "ride"]]
  ] as const)("rejects %s barrier choices exactly", (_, barriers) => {
    const { state, offer } = stateWithOffer();
    const booked = bookFirstOffer(state, offer);
    const rejected = healthReducer(booked, {
      type: "recordFamilyAppointmentBarriers",
      appointmentId: offer.id,
      barriers: [...barriers],
      at: NOW
    });

    expect(rejected).toBe(booked);
    expect(rejected.auditEvents).toBe(booked.auditEvents);
  });

  it.each([
    ["off-catalog", "2026-09-01T12:00:00.000Z", NOW],
    ["no longer future", null, "2026-09-01T12:00:00.000Z"]
  ] as const)("rejects a %s booking without appending audit", (_, requestedSlot, at) => {
    const { state, offer } = stateWithOffer();
    const slot = requestedSlot ?? offer.offeredSlots[0];
    const rejected = healthReducer(state, {
      type: "bookFamilyAppointment",
      appointmentId: offer.id,
      slot,
      at
    });

    expect(rejected).toBe(state);
    expect(rejected.auditEvents).toBe(state.auditEvents);
  });

  it("returns the exact state for a missing target and repeated booking", () => {
    const { state, offer } = stateWithOffer();
    const missing = healthReducer(state, {
      type: "bookFamilyAppointment",
      appointmentId: "missing",
      slot: offer.offeredSlots[0],
      at: NOW
    });
    expect(missing).toBe(state);
    expect(missing.auditEvents).toBe(state.auditEvents);

    const booked = bookFirstOffer(state, offer);
    const repeated = healthReducer(booked, {
      type: "bookFamilyAppointment",
      appointmentId: offer.id,
      slot: offer.offeredSlots[0],
      at: NOW
    });
    expect(repeated).toBe(booked);
    expect(repeated.auditEvents).toBe(booked.auditEvents);
  });

  it("rejects source-state violations and premature close-out without audit", () => {
    const { state, offer } = stateWithOffer();
    const offeredActions: HealthAction[] = [
      {
        type: "recordFamilyAppointmentBarriers",
        appointmentId: offer.id,
        barriers: ["ride"],
        at: NOW
      },
      { type: "requestFamilyAppointmentReschedule", appointmentId: offer.id, at: NOW },
      {
        type: "setFamilyAppointmentCountdown",
        appointmentId: offer.id,
        daysUntil: 1,
        now: NOW
      }
    ];
    for (const action of offeredActions) {
      const rejected = healthReducer(state, action);
      expect(rejected, action.type).toBe(state);
      expect(rejected.auditEvents, action.type).toBe(state.auditEvents);
    }

    const booked = bookFirstOffer(state, offer);
    for (const type of ["completeFamilyAppointment", "missFamilyAppointment"] as const) {
      const rejected = healthReducer(booked, { type, appointmentId: offer.id, at: NOW });
      expect(rejected, type).toBe(booked);
      expect(rejected.auditEvents, type).toBe(booked.auditEvents);
    }
  });

  it("rejects wrong and duplicate reminder acknowledgements exactly", () => {
    const { state, offer } = stateWithOffer();
    const booked = bookFirstOffer(state, offer);
    const reminderAt = new Date(new Date(offer.offeredSlots[0]).valueOf() - 0.5 * DAY_MS).toISOString();
    const wrong = healthReducer(booked, {
      type: "acknowledgeFamilyAppointmentReminder",
      appointmentId: offer.id,
      offset: "t14",
      at: reminderAt
    });
    expect(wrong).toBe(booked);
    expect(wrong.auditEvents).toBe(booked.auditEvents);

    const confirmed = healthReducer(booked, {
      type: "acknowledgeFamilyAppointmentReminder",
      appointmentId: offer.id,
      offset: "t1",
      at: reminderAt
    });
    const duplicate = healthReducer(confirmed, {
      type: "acknowledgeFamilyAppointmentReminder",
      appointmentId: offer.id,
      offset: "t1",
      at: reminderAt
    });
    expect(duplicate).toBe(confirmed);
    expect(duplicate.auditEvents).toBe(confirmed.auditEvents);
  });

  it("replaces stale slots with fresh future offers when rescheduling late", () => {
    const { state, offer } = stateWithOffer();
    const booked = bookFirstOffer(state, offer);
    const late = "2026-09-01T12:00:00.000Z";
    const reopened = healthReducer(booked, {
      type: "requestFamilyAppointmentReschedule",
      appointmentId: offer.id,
      at: late
    });
    const active = reopened.family?.appointments.at(-1);
    expect(active?.status).toBe("offered");
    expect(active?.scheduledFor).toBeUndefined();
    expect(active?.reminderAcks).toEqual([]);
    expect(active?.offeredSlots).toEqual(buildDemoSlotOffers(new Date(late)));
    expect(active?.offeredSlots.every((slot) => new Date(slot).valueOf() > new Date(late).valueOf())).toBe(true);
    expect(active?.offeredSlots).not.toEqual(offer.offeredSlots);
  });

  it("misses only an overdue visit and a fresh offer recovers it", () => {
    const { state, offer } = stateWithOffer();
    const booked = bookFirstOffer(state, offer);
    const missedAt = new Date(new Date(offer.offeredSlots[0]).valueOf() + DAY_MS).toISOString();
    const missed = healthReducer(booked, {
      type: "missFamilyAppointment",
      appointmentId: offer.id,
      at: missedAt
    });
    const rebooked = healthReducer(missed, {
      type: "offerFamilyAppointment",
      appointment: createFamilyAppointmentOffer(new Date(missedAt))
    });
    expect(rebooked.family?.appointments).toHaveLength(2);
    expect(rebooked.family?.appointments.at(-1)?.status).toBe("offered");
  });

  it("rejects every target mutation after an appointment is terminal", () => {
    const { state, offer } = stateWithOffer();
    const booked = bookFirstOffer(state, offer);
    const overdueAt = new Date(new Date(offer.offeredSlots[0]).valueOf() + DAY_MS).toISOString();
    const completed = healthReducer(booked, {
      type: "completeFamilyAppointment",
      appointmentId: offer.id,
      at: overdueAt
    });
    const actions: HealthAction[] = [
      {
        type: "bookFamilyAppointment",
        appointmentId: offer.id,
        slot: offer.offeredSlots[1],
        at: NOW
      },
      {
        type: "recordFamilyAppointmentBarriers",
        appointmentId: offer.id,
        barriers: ["ride"],
        at: overdueAt
      },
      {
        type: "acknowledgeFamilyAppointmentReminder",
        appointmentId: offer.id,
        offset: "t1",
        at: overdueAt
      },
      { type: "requestFamilyAppointmentReschedule", appointmentId: offer.id, at: overdueAt },
      { type: "completeFamilyAppointment", appointmentId: offer.id, at: overdueAt },
      { type: "missFamilyAppointment", appointmentId: offer.id, at: overdueAt },
      {
        type: "setFamilyAppointmentCountdown",
        appointmentId: offer.id,
        daysUntil: 1,
        now: overdueAt
      }
    ];

    for (const action of actions) {
      const rejected = healthReducer(completed, action);
      expect(rejected, action.type).toBe(completed);
      expect(rejected.auditEvents, action.type).toBe(completed.auditEvents);
    }
  });

  it.each([
    ["duplicate slots", (offer: ReturnType<typeof createFamilyAppointmentOffer>) => ({
      ...offer,
      offeredSlots: [offer.offeredSlots[0], offer.offeredSlots[0]]
    })],
    ["scheduled offered state", (offer: ReturnType<typeof createFamilyAppointmentOffer>) => ({
      ...offer,
      scheduledFor: offer.offeredSlots[0]
    })],
    ["past slots", (offer: ReturnType<typeof createFamilyAppointmentOffer>) => ({
      ...offer,
      offeredSlots: ["2026-07-20T12:00:00.000Z"]
    })]
  ])("rejects an invalid appointment offer with %s", (_, mutate) => {
    const referred = stateWithReferral();
    const offer = mutate(createFamilyAppointmentOffer(new Date(NOW)));
    const rejected = healthReducer(referred, { type: "offerFamilyAppointment", appointment: offer });

    expect(rejected).toBe(referred);
    expect(rejected.auditEvents).toBe(referred.auditEvents);
  });

  it("countdown moves the scheduled date relative to now", () => {
    const { state, offer } = stateWithOffer();
    const booked = bookFirstOffer(state, offer);
    const moved = healthReducer(booked, {
      type: "setFamilyAppointmentCountdown",
      appointmentId: offer.id,
      daysUntil: 1,
      now: NOW
    });

    expect(moved.family?.appointments.at(-1)?.scheduledFor).toBe("2026-07-25T12:00:00.000Z");
  });

  it("joins and leaves the earlier-visit list, refusing incoherent constraint sets", () => {
    const { state } = stateWithOffer();
    const invalid: FamilySoonerList[] = [
      { optedInAt: NOW, constraints: [] },
      { optedInAt: NOW, constraints: ["weekday_mornings", "weekday_mornings"] },
      { optedInAt: NOW, constraints: ["saturday_mornings" as never] },
      { optedInAt: "2026-07-24", constraints: ["any_weekday"] }
    ];
    for (const soonerList of invalid) {
      const rejected = healthReducer(state, { type: "setFamilySoonerList", soonerList });
      expect(rejected, JSON.stringify(soonerList)).toBe(state);
      expect(rejected.auditEvents, JSON.stringify(soonerList)).toBe(state.auditEvents);
    }
    expect(healthReducer(state, { type: "clearFamilySoonerList" })).toBe(state);

    const soonerList: FamilySoonerList = {
      optedInAt: NOW,
      constraints: ["weekday_mornings", "needs_notice"]
    };
    const joined = healthReducer(state, { type: "setFamilySoonerList", soonerList });
    expect(joined.family?.soonerList).toEqual(soonerList);
    expect(joined.auditEvents.at(-1)?.label).toBe("Family earlier-visit list joined");

    const left = healthReducer(joined, { type: "clearFamilySoonerList" });
    expect(left.family?.soonerList).toBeNull();
    expect(left.auditEvents.at(-1)?.label).toBe("Family earlier-visit list left");
    expect(healthReducer(left, { type: "clearFamilySoonerList" })).toBe(left);
  });

  it("never lists a family that has no referral", () => {
    const base: AppState = { ...demoState, family: schoolAgeFamilyState };
    expect(base.family?.referral).toBeNull();
    expect(
      healthReducer(base, {
        type: "setFamilySoonerList",
        soonerList: { optedInAt: NOW, constraints: ["any_weekday"] }
      })
    ).toBe(base);
    expect(
      healthReducer(
        { ...demoState, family: null },
        { type: "setFamilySoonerList", soonerList: { optedInAt: NOW, constraints: ["any_weekday"] } }
      ).family
    ).toBeNull();
  });

  it("backfills an earlier offer over a live booking only for a listed family", () => {
    const { state, offer } = stateWithOffer();
    const booked = bookFirstOffer(state, offer);
    const sooner = createSoonerAppointmentOffer(new Date(NOW), ["weekday_mornings"]);

    expect(healthReducer(booked, { type: "offerFamilyAppointment", appointment: sooner })).toBe(booked);

    const listed = healthReducer(booked, {
      type: "setFamilySoonerList",
      soonerList: { optedInAt: NOW, constraints: ["weekday_mornings"] }
    });
    const offered = healthReducer(listed, { type: "offerFamilyAppointment", appointment: sooner });
    expect(offered.family?.appointments).toHaveLength(2);
    expect(offered.family?.appointments.at(-1)?.id).toBe(sooner.id);
    expect(offered.family?.appointments.at(-1)?.offeredSlots).toHaveLength(1);

    const rebooked = healthReducer(offered, {
      type: "bookFamilyAppointment",
      appointmentId: sooner.id,
      slot: sooner.offeredSlots[0],
      at: NOW
    });
    expect(rebooked.family?.appointments.at(-1)?.status).toBe("booked");
    expect(rebooked.family?.appointments.at(-1)?.scheduledFor).toBe(sooner.offeredSlots[0]);
    expect(new Date(sooner.offeredSlots[0]).valueOf()).toBeLessThan(
      new Date(offer.offeredSlots[0]).valueOf()
    );
  });

  it("withdraws only an unbooked offer, handing the prior booking back untouched", () => {
    const { state, offer } = stateWithOffer();
    const booked = bookFirstOffer(state, offer);
    const listed = healthReducer(booked, {
      type: "setFamilySoonerList",
      soonerList: { optedInAt: NOW, constraints: ["weekday_mornings"] }
    });
    const sooner = createSoonerAppointmentOffer(new Date(NOW), ["weekday_mornings"]);
    const offered = healthReducer(listed, { type: "offerFamilyAppointment", appointment: sooner });

    const refused: HealthAction[] = [
      { type: "withdrawFamilyAppointmentOffer", appointmentId: offer.id, at: NOW },
      { type: "withdrawFamilyAppointmentOffer", appointmentId: "missing", at: NOW },
      { type: "withdrawFamilyAppointmentOffer", appointmentId: sooner.id, at: "2026-07-24" },
      {
        type: "withdrawFamilyAppointmentOffer",
        appointmentId: sooner.id,
        at: new Date(new Date(NOW).valueOf() - DAY_MS).toISOString()
      }
    ];
    for (const action of refused) {
      const rejected = healthReducer(offered, action);
      expect(rejected, JSON.stringify(action)).toBe(offered);
      expect(rejected.auditEvents, JSON.stringify(action)).toBe(offered.auditEvents);
    }

    const withdrawn = healthReducer(offered, {
      type: "withdrawFamilyAppointmentOffer",
      appointmentId: sooner.id,
      at: NOW
    });
    expect(withdrawn.family?.appointments).toHaveLength(1);
    const active = withdrawn.family?.appointments.at(-1);
    expect(active?.id).toBe(offer.id);
    expect(active?.status).toBe("booked");
    expect(active?.scheduledFor).toBe(offer.offeredSlots[0]);
    expect(withdrawn.family?.soonerList?.constraints).toEqual(["weekday_mornings"]);
    expect(withdrawn.auditEvents.at(-1)?.label).toBe("Earlier-visit offer declined (demo)");
  });
});
