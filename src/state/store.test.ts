import { describe, expect, it } from "vitest";
import { brentState, demoState } from "@/domain/fixtures";
import { schoolAgeFamilyState } from "@/domain/family-fixtures";
import { createFamilyAppointmentOffer } from "@/domain/family-appointments";
import { recordAuditEvent } from "@/domain/audit";
import { healthReducer } from "./store";
import type {
  AppState,
  FamilyFact,
  FamilyInterview,
  FamilyScreenAnswer,
  GlucoseReading,
  SavedFamilyResource
} from "@/domain/types";

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
      extraction: "mock"
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

  function stateWithOffer() {
    const base: AppState = { ...demoState, family: schoolAgeFamilyState };
    const seeded = healthReducer(base, {
      type: "setFamilyReferral",
      referral: { clinic: "UK Developmental Pediatrics", referredAt: NOW }
    });
    const offer = createFamilyAppointmentOffer(new Date(NOW));
    return { state: healthReducer(seeded, { type: "offerFamilyAppointment", appointment: offer }), offer };
  }

  it("seeds a referral and an offer", () => {
    const { state, offer } = stateWithOffer();

    expect(state.family?.referral?.clinic).toBe("UK Developmental Pediatrics");
    expect(state.family?.appointments.at(-1)?.id).toBe(offer.id);
  });

  it("books a slot and confirms via a reminder ack", () => {
    const { state, offer } = stateWithOffer();
    const slot = offer.offeredSlots[0];
    const booked = healthReducer(state, {
      type: "bookFamilyAppointment",
      appointmentId: offer.id,
      slot,
      at: NOW
    });
    expect(booked.family?.appointments.at(-1)?.status).toBe("booked");
    expect(booked.family?.appointments.at(-1)?.scheduledFor).toBe(slot);

    const confirmed = healthReducer(booked, {
      type: "acknowledgeFamilyAppointmentReminder",
      appointmentId: offer.id,
      offset: "t1",
      at: NOW
    });
    expect(confirmed.family?.appointments.at(-1)?.status).toBe("confirmed");
    expect(confirmed.family?.appointments.at(-1)?.reminderAcks).toEqual([
      { offset: "t1", acknowledgedAt: NOW }
    ]);
  });

  it("merges barrier domains into activeDomains without duplicates", () => {
    const { state, offer } = stateWithOffer();
    const withBarrier = healthReducer(state, {
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
    const count = again.family?.activeDomains.filter((domain) => domain === "transportation").length;
    expect(count).toBe(1);
  });

  it("reschedule clears the booking; miss + new offer recovers", () => {
    const { state, offer } = stateWithOffer();
    const booked = healthReducer(state, {
      type: "bookFamilyAppointment",
      appointmentId: offer.id,
      slot: offer.offeredSlots[0],
      at: NOW
    });
    const reopened = healthReducer(booked, {
      type: "requestFamilyAppointmentReschedule",
      appointmentId: offer.id,
      at: NOW
    });
    const active = reopened.family?.appointments.at(-1);
    expect(active?.status).toBe("offered");
    expect(active?.scheduledFor).toBeUndefined();
    expect(active?.reminderAcks).toEqual([]);

    const missed = healthReducer(booked, {
      type: "missFamilyAppointment",
      appointmentId: offer.id,
      at: NOW
    });
    const rebooked = healthReducer(missed, {
      type: "offerFamilyAppointment",
      appointment: createFamilyAppointmentOffer(new Date(NOW))
    });
    expect(rebooked.family?.appointments).toHaveLength(2);
    expect(rebooked.family?.appointments.at(-1)?.status).toBe("offered");
  });

  it("countdown moves the scheduled date relative to now", () => {
    const { state, offer } = stateWithOffer();
    const booked = healthReducer(state, {
      type: "bookFamilyAppointment",
      appointmentId: offer.id,
      slot: offer.offeredSlots[0],
      at: NOW
    });
    const moved = healthReducer(booked, {
      type: "setFamilyAppointmentCountdown",
      appointmentId: offer.id,
      daysUntil: 1,
      now: NOW
    });

    expect(moved.family?.appointments.at(-1)?.scheduledFor).toBe("2026-07-25T12:00:00.000Z");
  });
});
