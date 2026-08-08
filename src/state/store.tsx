"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode
} from "react";
import { brentState, defaultDemoState, deletedDemoState, demoState } from "@/domain/fixtures";
import {
  backdatedDiagnosisMonth,
  type FamilyDiagnosisBackdateMonths
} from "@/domain/family-stages";
import { getFamilyResourceById } from "@/domain/family-resources";
import {
  applyFamilyScreenRetractions,
  mergeFamilyDomains
} from "@/domain/family-screen";
import { buildRankCandidates, buildStructuredResourceMatches } from "@/domain/family-matching";
import { PACKET_QUESTIONS } from "@/domain/family-visit-packet";
import {
  BARRIER_DOMAINS,
  FAMILY_APPOINTMENT_COUNTDOWNS,
  buildDemoSlotOffers,
  dueFamilyReminder,
  overdueFamilyAppointment,
  type FamilyAppointmentCountdownDays
} from "@/domain/family-appointments";
import { recordAuditEvent } from "@/domain/audit";
import { activeConditions } from "@/domain/condition-lens";
import { canTransition, outcomeToStatus, transition } from "@/domain/screening-gap";
import { outcomeForGrade, recallDateFrom, recallReasonFor, tierForResult } from "@/domain/dr-triage";
import { backdatedSentAt, escalationDue } from "@/domain/referral-followup";
import { getDestinationById, nearestDestinationOfKind } from "@/domain/screening-sites";
import { tScreening, type Language } from "@/i18n/strings";
import type { AssessmentEvent } from "@/domain/assessment";
import { getInstrument } from "@/domain/instruments/registry";
import type {
  AccessibilityPreference,
  AiMessage,
  AppState,
  AuditEvent,
  CareContextItem,
  Condition,
  DevNeedDomain,
  DoseEvent,
  DoseReminderPreference,
  DrReportExtraction,
  ExtractedFact,
  FamilyAppointment,
  FamilyAppointmentBarrier,
  FamilyCheckinProbeAnswer,
  FamilyFact,
  FamilyInterview,
  FamilyNavigatorState,
  FamilyProfile,
  FamilyProfileProvenance,
  FamilyPulse,
  FamilyReferral,
  FamilyRecommendationSet,
  FamilyReminderOffset,
  FamilyResourceStep,
  FamilySafetyEvent,
  FamilyScreenAnswer,
  FamilySoonerConstraint,
  FamilySoonerList,
  FamilyStepStatus,
  GlucoseReading,
  HomeReading,
  MealLogEntry,
  MedicationBarrier,
  MedicationFill,
  ResultCaptureSource,
  SavedFamilyResource,
  ScreeningResult
} from "@/domain/types";
import { isLanguage, loadStoredState, saveStoredState } from "./storage";

export type FamilyRecommendationRequestContext = {
  interviewId: string;
  activeDomains: DevNeedDomain[];
  profile: FamilyProfile;
  candidateIds: string[];
  language: Language;
};

export type HealthAction =
  | { type: "hydrateStoredState"; state: AppState }
  | { type: "addReading"; reading: HomeReading }
  | { type: "addGlucoseReading"; reading: GlucoseReading }
  | { type: "setMedicationBarriers"; medicationId: string; barriers: MedicationBarrier[] }
  | { type: "addContextItem"; item: CareContextItem; facts: ExtractedFact[] }
  | { type: "removeContextItem"; contextItemId: string }
  | { type: "confirmFact"; factId: string }
  | { type: "addAiMessage"; message: AiMessage }
  | { type: "acknowledgeCrisis"; messageId: string }
  | { type: "addAuditEvent"; event: AuditEvent }
  | { type: "addMealLogEntry"; entry: MealLogEntry }
  | { type: "logDose"; event: DoseEvent }
  | { type: "undoDose"; medicationId: string; date: string }
  | { type: "setDoseReminder"; preference: DoseReminderPreference }
  | { type: "logMedicationFill"; fill: MedicationFill }
  | { type: "addAssessmentEvent"; event: AssessmentEvent }
  | { type: "updateAccessibilityPreferences"; preferences: AccessibilityPreference[] }
  | { type: "setLanguage"; language: Language }
  | { type: "completeOnboarding"; conditions: Condition[] }
  | { type: "bookScreening"; gapId: string; siteId: string; siteName: string; when: string }
  | {
      type: "screeningResultConfirmed";
      extraction: Pick<DrReportExtraction, "grade" | "dmePresent" | "ungradable" | "refusal">;
      source: ResultCaptureSource;
      reportRef: string;
    }
  | { type: "checkReferralFollowup" }
  | { type: "backdateReferral"; referralId: string; days: number }
  | { type: "markClinicConfirmed"; referralId: string }
  | { type: "bookReferralSlot"; referralId: string; slot: string }
  | { type: "markReferralCompleted"; referralId: string }
  | {
      type: "saveFamilyProfile";
      profile: FamilyProfile;
      deterministicDomains?: DevNeedDomain[];
      /** Omitted means a person typed it. "extracted" is only for the silent round-0 auto-apply. */
      provenance?: FamilyProfileProvenance;
    }
  | {
      type: "backdateFamilyDiagnoses";
      monthsAgo: FamilyDiagnosisBackdateMonths;
      now: string;
    }
  | { type: "setFamilyInterviewDraft"; draft: string }
  | { type: "submitFamilyScreen"; answers: FamilyScreenAnswer[]; facts: FamilyFact[] }
  | { type: "addFamilyInterview"; interview: FamilyInterview; facts: FamilyFact[]; domains: FamilyNavigatorState["activeDomains"] }
  | { type: "recordFamilySafetyTurn"; domains: FamilyNavigatorState["activeDomains"] }
  | { type: "confirmFamilyFact"; factId: string }
  | { type: "setFamilyFactInclusion"; factId: string; include: boolean }
  | { type: "rejectFamilyFact"; factId: string }
  | { type: "toggleFamilyPacketQuestion"; questionId: string }
  | { type: "recordFamilySafetyEvent"; event: FamilySafetyEvent }
  | { type: "acknowledgeFamilySafetyEvent"; eventId: string; at: string }
  | { type: "raiseFamilyRegressionFlag"; source: "probe" | "text"; at: string; interviewId?: string }
  | { type: "recordFamilyCheckinProbe"; answer: FamilyCheckinProbeAnswer["answer"]; at: string }
  | { type: "acknowledgeFamilyRegressionFlag"; flagId: string; at: string }
  | {
      type: "setFamilyRecommendations";
      recommendations: FamilyRecommendationSet | null;
      context: FamilyRecommendationRequestContext;
    }
  | { type: "saveFamilyResource"; resource: SavedFamilyResource }
  | { type: "toggleFamilyEnrollment"; resourceId: string }
  | { type: "planFamilyStep"; resourceId: string; domain: DevNeedDomain; at: string }
  | { type: "updateFamilyStep"; stepId: string; status: FamilyStepStatus; at: string }
  | { type: "recordFamilyPulse"; pulse: FamilyPulse }
  | { type: "skipFamilyCheckin"; at: string }
  | { type: "backdateFamilyTouches"; days: number; now: string }
  | { type: "setFamilySoonerList"; soonerList: FamilySoonerList }
  | { type: "clearFamilySoonerList" }
  | { type: "setFamilyReferral"; referral: FamilyReferral }
  | { type: "offerFamilyAppointment"; appointment: FamilyAppointment }
  | { type: "withdrawFamilyAppointmentOffer"; appointmentId: string; at: string }
  | { type: "bookFamilyAppointment"; appointmentId: string; slot: string; at: string }
  | {
      type: "recordFamilyAppointmentBarriers";
      appointmentId: string;
      barriers: FamilyAppointmentBarrier[];
      at: string;
    }
  | {
      type: "acknowledgeFamilyAppointmentReminder";
      appointmentId: string;
      offset: FamilyReminderOffset;
      at: string;
    }
  | { type: "requestFamilyAppointmentReschedule"; appointmentId: string; at: string }
  | { type: "completeFamilyAppointment"; appointmentId: string; at: string }
  | { type: "missFamilyAppointment"; appointmentId: string; at: string }
  | {
      type: "setFamilyAppointmentCountdown";
      appointmentId: string;
      daysUntil: FamilyAppointmentCountdownDays;
      now: string;
    }
  | { type: "resetDemo"; patient?: "jordan" | "brent" }
  | { type: "deleteDemoData" };

function emptyFamilyState(
  profile: FamilyProfile | null,
  provenance: FamilyProfileProvenance = "stated"
): FamilyNavigatorState {
  return {
    profile,
    profileProvenance: provenance,
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
}

const FAMILY_APPOINTMENT_BARRIERS: FamilyAppointmentBarrier[] = [
  "ride",
  "sibling_care",
  "work_schedule",
  "none"
];

const FAMILY_SOONER_CONSTRAINTS: FamilySoonerConstraint[] = [
  "weekday_mornings",
  "weekday_afternoons",
  "any_weekday",
  "needs_notice"
];

function isNonblank(value: string): boolean {
  return value.trim().length > 0;
}

function isExactIsoTimestamp(value: string): boolean {
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.valueOf()) && timestamp.toISOString() === value;
}

function sameOrderedValues<T>(
  left: readonly T[],
  right: readonly T[]
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function recommendationProfileIdentity(
  profile: FamilyProfile | null
): string {
  if (!profile) return "none";
  const diagnoses = profile.diagnoses
    .map(({ label, otherLabel, diagnosedAt }) =>
      [
        label,
        otherLabel?.trim().toLocaleLowerCase() ?? "",
        diagnosedAt ?? ""
      ].join("\u0000")
    )
    .sort();
  return JSON.stringify({
    childFirstName: profile.childFirstName?.trim() ?? "",
    birthYear: profile.birthYear,
    birthMonth: profile.birthMonth ?? null,
    schoolStage: profile.schoolStage,
    county: profile.county.trim().toLocaleLowerCase(),
    diagnoses
  });
}

function recommendationRequestMatches(
  state: AppState,
  context: FamilyRecommendationRequestContext
): boolean {
  const family = state.family;
  if (
    !family ||
    !family.profile ||
    state.patient.language !== context.language ||
    family.interviews.at(-1)?.id !== context.interviewId ||
    !sameOrderedValues(family.activeDomains, context.activeDomains) ||
    recommendationProfileIdentity(family.profile) !==
      recommendationProfileIdentity(context.profile)
  ) {
    return false;
  }

  const rawText = family.interviews.at(-1)?.rawText;
  const currentCandidateIds = (
    rawText
      ? buildStructuredResourceMatches(
          family.profile,
          family.activeDomains,
          family.alreadyEnrolled,
          rawText
        )
      : buildRankCandidates(family.profile, family.activeDomains, family.alreadyEnrolled)
  ).resources.map(({ resource }) => resource.id);
  return sameOrderedValues(currentCandidateIds, context.candidateIds);
}

function withStepStatus(
  steps: FamilyResourceStep[],
  stepId: string,
  status: FamilyStepStatus,
  at: string
): FamilyResourceStep[] {
  return steps.map((step) => (step.id === stepId ? { ...step, status, updatedAt: at } : step));
}

// `alreadyEnrolled` and an `enrolled` step are one fact seen from two places —
// the matching exclusion and the tracker — so either surface moving syncs both.
function syncEnrollment(alreadyEnrolled: string[], resourceId: string, enrolled: boolean): string[] {
  if (!enrolled) {
    return alreadyEnrolled.filter((entry) => entry !== resourceId);
  }
  return alreadyEnrolled.includes(resourceId) ? alreadyEnrolled : [...alreadyEnrolled, resourceId];
}

// Toggling the old enrollment checkbox upserts the step it stands for. A resource
// the catalog no longer knows gets no invented step — the toggle alone still works.
function stepsAfterEnrollmentToggle(
  family: FamilyNavigatorState,
  resourceId: string,
  enrolling: boolean,
  at: string
): FamilyResourceStep[] {
  const existing = family.steps.find((step) => step.resourceId === resourceId);
  if (!enrolling) {
    return existing?.status === "enrolled"
      ? withStepStatus(family.steps, existing.id, "in_touch", at)
      : family.steps;
  }
  if (existing) {
    return withStepStatus(family.steps, existing.id, "enrolled", at);
  }
  const domain = getFamilyResourceById(resourceId)?.domains[0];
  return domain === undefined
    ? family.steps
    : [
        ...family.steps,
        {
          id: crypto.randomUUID(),
          resourceId,
          domain,
          status: "enrolled",
          plannedAt: at,
          updatedAt: at
        }
      ];
}

const DAY_MS = 24 * 60 * 60 * 1000;

// The demo control moves the family's own history back, never the clock. Every
// stamp shifts by the same amount, so pairs that storage checks for coherence
// (a step's plan/update, a flag's raise/acknowledge) stay in the same order.
function movedBack(stamp: string, days: number): string {
  const at = new Date(stamp);
  return Number.isNaN(at.valueOf()) ? stamp : new Date(at.valueOf() - days * DAY_MS).toISOString();
}

function backdatedFamilyTouches(family: FamilyNavigatorState, days: number): FamilyNavigatorState {
  const back = (stamp: string): string => movedBack(stamp, days);
  return {
    ...family,
    interviews: family.interviews.map((interview) => ({
      ...interview,
      createdAt: back(interview.createdAt)
    })),
    steps: family.steps.map((step) => ({
      ...step,
      plannedAt: back(step.plannedAt),
      updatedAt: back(step.updatedAt)
    })),
    pulses: family.pulses.map((pulse) => ({ ...pulse, at: back(pulse.at) })),
    flags: family.flags.map((flag) => ({
      ...flag,
      raisedAt: back(flag.raisedAt),
      acknowledgedAt: flag.acknowledgedAt === undefined ? undefined : back(flag.acknowledgedAt)
    })),
    saved: family.saved.map((saved) => ({ ...saved, savedAt: back(saved.savedAt) })),
    appointments: family.appointments.map((appointment) => ({
      ...appointment,
      createdAt: back(appointment.createdAt),
      reminderAcks: appointment.reminderAcks.map((ack) => ({
        ...ack,
        acknowledgedAt: back(ack.acknowledgedAt)
      }))
    })),
    checkinTouchedAt: family.checkinTouchedAt === null ? null : back(family.checkinTouchedAt)
  };
}

function isCoherentBarrierAnswer(barriers: FamilyAppointmentBarrier[]): boolean {
  if (
    barriers.length === 0 ||
    new Set(barriers).size !== barriers.length ||
    barriers.some((barrier) => !FAMILY_APPOINTMENT_BARRIERS.includes(barrier))
  ) {
    return false;
  }
  return !barriers.includes("none") || barriers.length === 1;
}

function isCoherentSoonerList(soonerList: FamilySoonerList): boolean {
  const { constraints } = soonerList;
  return (
    isExactIsoTimestamp(soonerList.optedInAt) &&
    constraints.length > 0 &&
    new Set(constraints).size === constraints.length &&
    constraints.every((constraint) => FAMILY_SOONER_CONSTRAINTS.includes(constraint))
  );
}

// A new offer normally only follows a visit that is over. The earlier-visit list
// is the one exception: a cancellation backfill is offered *over* a live booking,
// and declining it (withdrawFamilyAppointmentOffer) hands that booking back.
//
// The backfill has to say which booking it replaces, and that booking has to be
// the live one — array position is not evidence of either.
function acceptsNewOffer(family: FamilyNavigatorState, offer: FamilyAppointment): boolean {
  const latest = family.appointments.at(-1);
  if (offer.supersedesId === undefined) {
    return latest === undefined || latest.status === "missed" || latest.status === "replaced";
  }
  return (
    family.soonerList !== null &&
    latest !== undefined &&
    latest.id === offer.supersedesId &&
    (latest.status === "booked" || latest.status === "confirmed") &&
    latest.scheduledFor !== undefined
  );
}

function isValidActionTime(appointment: FamilyAppointment, at: string): boolean {
  return (
    isExactIsoTimestamp(at) &&
    isExactIsoTimestamp(appointment.createdAt) &&
    new Date(at).valueOf() >= new Date(appointment.createdAt).valueOf()
  );
}

function hasValidOfferSlots(appointment: FamilyAppointment): boolean {
  return (
    appointment.offeredSlots.length > 0 &&
    new Set(appointment.offeredSlots).size === appointment.offeredSlots.length &&
    appointment.offeredSlots.every(isExactIsoTimestamp)
  );
}

function isValidNewAppointmentOffer(appointment: FamilyAppointment): boolean {
  if (
    !isNonblank(appointment.id) ||
    !isNonblank(appointment.clinic) ||
    !isExactIsoTimestamp(appointment.createdAt) ||
    appointment.status !== "offered" ||
    appointment.scheduledFor !== undefined ||
    appointment.barriersAsked ||
    appointment.barriers.length > 0 ||
    appointment.reminderAcks.length > 0 ||
    !hasValidOfferSlots(appointment)
  ) {
    return false;
  }
  const createdAt = new Date(appointment.createdAt).valueOf();
  return appointment.offeredSlots.every((slot) => new Date(slot).valueOf() > createdAt);
}

function sameFamilyAppointment(left: FamilyAppointment, right: FamilyAppointment): boolean {
  return (
    left.id === right.id &&
    left.clinic === right.clinic &&
    left.scheduledFor === right.scheduledFor &&
    left.status === right.status &&
    left.barriersAsked === right.barriersAsked &&
    left.createdAt === right.createdAt &&
    left.supersedesId === right.supersedesId &&
    left.offeredSlots.length === right.offeredSlots.length &&
    left.offeredSlots.every((slot, index) => slot === right.offeredSlots[index]) &&
    left.barriers.length === right.barriers.length &&
    left.barriers.every((barrier, index) => barrier === right.barriers[index]) &&
    left.reminderAcks.length === right.reminderAcks.length &&
    left.reminderAcks.every(
      (ack, index) =>
        ack.offset === right.reminderAcks[index]?.offset &&
        ack.acknowledgedAt === right.reminderAcks[index]?.acknowledgedAt
    )
  );
}

// Two facts are the same observation when the same label was drawn from the same
// caregiver words. Case and edge whitespace vary between a live extraction and
// the on-device one, so they are normalized away before comparing.
function familyFactIdentity({ label, sourceSnippet }: Pick<FamilyFact, "label" | "sourceSnippet">): string {
  return `${label.trim().toLowerCase()} ${sourceSnippet.trim().toLowerCase()}`;
}

// Screen rows are rewritten wholesale on every save, so a row is the same row
// when it still records the same answer to the same question. The value is part
// of the identity on purpose: changing an answer is a new statement, not an edit
// to the old one.
function familyScreenFactIdentity(
  fact: Pick<FamilyFact, "label" | "value" | "sourceSnippet">
): string {
  return `${familyFactIdentity(fact)} ${fact.value.trim().toLowerCase()}`;
}

function updateFamilyAppointment(
  state: AppState,
  appointmentId: string,
  update: (appointment: FamilyAppointment) => FamilyAppointment,
  auditMessage: string
): AppState {
  if (!state.family) {
    return state;
  }
  const appointmentIndex = state.family.appointments.findIndex(({ id }) => id === appointmentId);
  if (appointmentIndex < 0) {
    return state;
  }
  const appointment = state.family.appointments[appointmentIndex];
  const updatedAppointment = update(appointment);
  if (sameFamilyAppointment(appointment, updatedAppointment)) {
    return state;
  }
  const appointments = [...state.family.appointments];
  appointments[appointmentIndex] = updatedAppointment;
  return {
    ...state,
    family: {
      ...state.family,
      appointments
    },
    auditEvents: [...state.auditEvents, recordAuditEvent(state.patient.id, "updated", auditMessage)]
  };
}

export function healthReducer(state: AppState, action: HealthAction): AppState {
  switch (action.type) {
    case "hydrateStoredState":
      return action.state;
    case "addReading": {
      return {
        ...state,
        readings: [...state.readings, action.reading],
        auditEvents: [...state.auditEvents, recordAuditEvent(state.patient.id, "created", "Blood pressure reading added")]
      };
    }
    case "addGlucoseReading": {
      return {
        ...state,
        glucoseReadings: [...state.glucoseReadings, action.reading],
        auditEvents: [...state.auditEvents, recordAuditEvent(state.patient.id, "created", "Blood sugar reading added")]
      };
    }
    case "setMedicationBarriers": {
      return {
        ...state,
        medications: state.medications.map((medication) =>
          medication.id === action.medicationId ? { ...medication, activeBarriers: action.barriers } : medication
        ),
        auditEvents: [...state.auditEvents, recordAuditEvent(state.patient.id, "updated", "Medication barrier updated")]
      };
    }
    case "addContextItem": {
      return {
        ...state,
        contextItems: [...state.contextItems, action.item],
        extractedFacts: [...state.extractedFacts, ...action.facts],
        auditEvents: [...state.auditEvents, recordAuditEvent(state.patient.id, "created", "Care instructions added")]
      };
    }
    case "removeContextItem": {
      if (!state.contextItems.some((item) => item.id === action.contextItemId)) return state;
      return {
        ...state,
        contextItems: state.contextItems.filter((item) => item.id !== action.contextItemId),
        extractedFacts: state.extractedFacts.filter((fact) => fact.contextItemId !== action.contextItemId),
        auditEvents: [...state.auditEvents, recordAuditEvent(state.patient.id, "deleted", "Care note removed")]
      };
    }
    case "confirmFact": {
      return {
        ...state,
        extractedFacts: state.extractedFacts.map((fact) =>
          fact.id === action.factId ? { ...fact, status: "confirmed" } : fact
        ),
        auditEvents: [...state.auditEvents, recordAuditEvent(state.patient.id, "updated", "Extracted fact confirmed")]
      };
    }
    case "addAiMessage": {
      const isCrisis = action.message.role === "assistant" && action.message.safety === "crisis";
      // A crisis message cannot persist without its audit record, so it audits as
      // "crisis_escalated" rather than the generic ai_generated event.
      const auditEvent = isCrisis
        ? recordAuditEvent(state.patient.id, "crisis_escalated", "Crisis resources shown")
        : recordAuditEvent(state.patient.id, "ai_generated", "AI response generated");
      return {
        ...state,
        aiMessages: [...state.aiMessages, action.message],
        auditEvents: [...state.auditEvents, auditEvent]
      };
    }
    case "acknowledgeCrisis": {
      return {
        ...state,
        aiMessages: state.aiMessages.map((message) =>
          message.id === action.messageId ? { ...message, acknowledged: true } : message
        ),
        auditEvents: [...state.auditEvents, recordAuditEvent(state.patient.id, "updated", "Crisis resources acknowledged")]
      };
    }
    case "addAuditEvent": {
      return {
        ...state,
        auditEvents: [...state.auditEvents, action.event]
      };
    }
    case "addMealLogEntry": {
      return {
        ...state,
        mealLog: [...state.mealLog, action.entry],
        auditEvents: [...state.auditEvents, recordAuditEvent(state.patient.id, "created", "Meal logged from Food Lens")]
      };
    }
    case "logDose": {
      const { event } = action;
      const doseEvents = [
        ...state.doseEvents.filter(
          (existing) => !(existing.medicationId === event.medicationId && existing.date === event.date)
        ),
        event
      ];
      const barrier = event.barrier;
      const medications =
        barrier === null
          ? state.medications
          : state.medications.map((medication) =>
              medication.id === event.medicationId && !medication.activeBarriers.includes(barrier)
                ? { ...medication, activeBarriers: [...medication.activeBarriers, barrier] }
                : medication
            );
      return {
        ...state,
        doseEvents,
        medications,
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(
            state.patient.id,
            "updated",
            event.status === "taken" ? "Medication marked taken" : "Medication marked skipped"
          )
        ]
      };
    }
    case "undoDose": {
      return {
        ...state,
        doseEvents: state.doseEvents.filter(
          (event) => !(event.medicationId === action.medicationId && event.date === action.date)
        ),
        auditEvents: [...state.auditEvents, recordAuditEvent(state.patient.id, "updated", "Medication dose entry removed")]
      };
    }
    case "setDoseReminder": {
      return {
        ...state,
        doseReminder: action.preference,
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "updated", "Dose reminder preference updated")
        ]
      };
    }
    case "logMedicationFill": {
      return {
        ...state,
        medicationFills: [...state.medicationFills, action.fill],
        auditEvents: [...state.auditEvents, recordAuditEvent(state.patient.id, "created", "Medication refill logged")]
      };
    }
    case "addAssessmentEvent": {
      const instrumentTitle = getInstrument(action.event.instrumentId)?.title.en;
      return {
        ...state,
        assessmentEvents: [...state.assessmentEvents, action.event],
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(
            state.patient.id,
            "assessment_recorded",
            instrumentTitle ? `${instrumentTitle} recorded` : "Check-in recorded"
          )
        ]
      };
    }
    case "updateAccessibilityPreferences": {
      return {
        ...state,
        patient: { ...state.patient, accessibilityPreferences: action.preferences },
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "updated", "Display and access preferences updated")
        ]
      };
    }
    case "setLanguage": {
      // Guarded by the same isLanguage check storage applies on load: a value
      // outside en/es would fail isPatient there and reset the whole state to
      // the default demo, so it must never be persisted.
      if (!isLanguage(action.language) || action.language === state.patient.language) {
        return state;
      }
      return {
        ...state,
        patient: { ...state.patient, language: action.language },
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "updated", "Language preference updated")
        ]
      };
    }
    case "completeOnboarding": {
      const ordered = activeConditions({ condition: action.conditions[0], conditions: action.conditions });
      const primary = ordered[0] ?? state.carePlan.condition;
      return {
        ...state,
        carePlan: { ...state.carePlan, condition: primary, conditions: ordered },
        auditEvents: [...state.auditEvents, recordAuditEvent(state.patient.id, "updated", "Onboarding completed")]
      };
    }
    case "bookScreening": {
      const gap = state.screeningGaps.find((candidate) => candidate.id === action.gapId);
      if (!gap) {
        return state;
      }
      // Walk the legal edges: an overdue gap engages first, then schedules; a
      // repeat gap schedules directly. Anything else has no legal path here.
      const engaged = gap.status === "overdue" ? transition(gap, "engaged") : gap;
      if (!canTransition(engaged.status, "scheduled")) {
        return state;
      }
      const scheduled = {
        ...transition(engaged, "scheduled"),
        scheduledSiteId: action.siteId,
        scheduledFor: action.when
      };
      return {
        ...state,
        screeningGaps: state.screeningGaps.map((candidate) => (candidate.id === scheduled.id ? scheduled : candidate)),
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(
            state.patient.id,
            "screening_scheduled",
            `Eye screening booked — ${action.siteName}, ${action.when}`
          )
        ]
      };
    }
    case "screeningResultConfirmed": {
      const gap = state.screeningGaps.find((candidate) => candidate.status === "scheduled");
      if (!gap || action.extraction.refusal !== undefined) {
        return state;
      }
      const outcome = outcomeForGrade(action.extraction);
      const confirmedAt = new Date().toISOString();
      const result: ScreeningResult = {
        id: crypto.randomUUID(),
        gapId: gap.id,
        outcome,
        grade: action.extraction.grade,
        dmePresent: action.extraction.dmePresent,
        source: action.source,
        reportRef: action.reportRef,
        confirmedAt
      };
      const finalGap = transition(transition(gap, "completed"), outcomeToStatus(outcome));
      const auditEvents = [
        ...state.auditEvents,
        recordAuditEvent(
          state.patient.id,
          "screening_result_confirmed",
          `Screening result confirmed from your report (${outcome})`
        )
      ];

      // An abnormal confirm places the referral in the same dispatch: correct
      // tier, nearest destination of the required kind, drafted+sent history.
      const referrals = [...state.referrals];
      const tier = tierForResult(result);
      if (outcome === "abnormal" && tier !== "none") {
        const destination = nearestDestinationOfKind(tier === "retina_urgent" ? "retina" : "optometry");
        const language = state.patient.language;
        referrals.push({
          id: crypto.randomUUID(),
          resultId: result.id,
          tier,
          destinationId: destination.id,
          stageHistory: [
            { stage: "drafted", at: confirmedAt, note: tScreening(language, "stageNoteDrafted") },
            { stage: "sent", at: confirmedAt, note: tScreening(language, "stageNoteSent", { name: destination.name }) }
          ],
          sentAt: confirmedAt
        });
        auditEvents.push(
          recordAuditEvent(state.patient.id, "referral_placed", `Referral placed — ${destination.name} (${tier})`)
        );
      }

      // A normal confirm schedules the annual recall (mild keeps its
      // chronic-care emphasis via the reason).
      const recallReminders = [...state.recallReminders];
      const recallReason = outcome === "normal" ? recallReasonFor(result.grade) : null;
      if (recallReason) {
        recallReminders.push({ id: crypto.randomUUID(), dueAt: recallDateFrom(confirmedAt), reason: recallReason });
        auditEvents.push(recordAuditEvent(state.patient.id, "recall_scheduled", "Annual eye-screening recall scheduled"));
      }

      return {
        ...state,
        screeningGaps: state.screeningGaps.map((candidate) => (candidate.id === finalGap.id ? finalGap : candidate)),
        screeningResults: [...state.screeningResults, result],
        referrals,
        recallReminders,
        auditEvents
      };
    }
    case "checkReferralFollowup": {
      const now = new Date();
      const dueIds = new Set(
        state.referrals.filter((referral) => escalationDue(referral, now)).map((referral) => referral.id)
      );
      if (dueIds.size === 0) {
        return state;
      }
      const language = state.patient.language;
      return {
        ...state,
        referrals: state.referrals.map((referral) =>
          dueIds.has(referral.id)
            ? {
                ...referral,
                stageHistory: [
                  ...referral.stageHistory,
                  { stage: "stalled", at: now.toISOString(), note: tScreening(language, "stageNoteStalled") }
                ]
              }
            : referral
        ),
        auditEvents: [
          ...state.auditEvents,
          ...[...dueIds].map(() =>
            recordAuditEvent(state.patient.id, "referral_escalated", "Referral silence escalated to your care team")
          )
        ]
      };
    }
    case "backdateReferral": {
      const referral = state.referrals.find((candidate) => candidate.id === action.referralId);
      if (!referral) {
        return state;
      }
      return {
        ...state,
        referrals: state.referrals.map((candidate) =>
          candidate.id === action.referralId
            ? { ...candidate, sentAt: backdatedSentAt(candidate.sentAt, action.days) }
            : candidate
        ),
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "updated", `Demo control: referral backdated ${action.days} days`)
        ]
      };
    }
    case "markClinicConfirmed": {
      const referral = state.referrals.find((candidate) => candidate.id === action.referralId);
      if (!referral || referral.stageHistory.some((entry) => entry.stage === "clinic_confirmed")) {
        return state;
      }
      const language = state.patient.language;
      return {
        ...state,
        referrals: state.referrals.map((candidate) =>
          candidate.id === action.referralId
            ? {
                ...candidate,
                stageHistory: [
                  ...candidate.stageHistory,
                  { stage: "clinic_confirmed", at: new Date().toISOString(), note: tScreening(language, "stageNoteConfirmed") }
                ]
              }
            : candidate
        ),
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "updated", "Referral confirmed — the clinic called")
        ]
      };
    }
    case "bookReferralSlot": {
      const referral = state.referrals.find((candidate) => candidate.id === action.referralId);
      if (!referral || referral.stageHistory.some((entry) => entry.stage === "scheduled")) {
        return state;
      }
      const destination = getDestinationById(referral.destinationId);
      if (!destination || !destination.nextSlots.includes(action.slot)) {
        return state;
      }
      const language = state.patient.language;
      return {
        ...state,
        referrals: state.referrals.map((candidate) =>
          candidate.id === action.referralId
            ? {
                ...candidate,
                scheduledFor: action.slot,
                stageHistory: [
                  ...candidate.stageHistory,
                  {
                    stage: "scheduled",
                    at: new Date().toISOString(),
                    note: tScreening(language, "slotBookedNote", { when: action.slot, name: destination.name })
                  }
                ]
              }
            : candidate
        ),
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "referral_booked", `Referral booked — ${action.slot} at ${destination.name}`)
        ]
      };
    }
    case "markReferralCompleted": {
      const referral = state.referrals.find((candidate) => candidate.id === action.referralId);
      if (!referral || referral.stageHistory.some((entry) => entry.stage === "completed")) {
        return state;
      }
      const language = state.patient.language;
      return {
        ...state,
        referrals: state.referrals.map((candidate) =>
          candidate.id === action.referralId
            ? {
                ...candidate,
                stageHistory: [
                  ...candidate.stageHistory,
                  { stage: "completed", at: new Date().toISOString(), note: tScreening(language, "completedNote") }
                ]
              }
            : candidate
        ),
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "updated", "Referral visit completed (self-reported)")
        ]
      };
    }
    case "saveFamilyProfile": {
      const family = state.family;
      const profileProvenance = action.provenance ?? "stated";
      if (!family || !action.deterministicDomains) {
        return {
          ...state,
          family: family
            ? { ...family, profile: action.profile, profileProvenance }
            : emptyFamilyState(action.profile, profileProvenance)
        };
      }
      const deterministicDomains = applyFamilyScreenRetractions(
        family.screenAnswers,
        action.deterministicDomains
      );
      const latestInterviewDomains = [
        ...new Set([
          ...deterministicDomains,
          ...family.latestInterviewDomains
        ])
      ];
      const activeDomains = mergeFamilyDomains(
        family.screenAnswers,
        latestInterviewDomains
      );
      const profileUnchanged =
        recommendationProfileIdentity(family.profile) ===
        recommendationProfileIdentity(action.profile);
      const recommendations =
        sameOrderedValues(family.activeDomains, activeDomains) &&
        profileUnchanged
          ? family.recommendations
          : null;
      return {
        ...state,
        family: {
          ...family,
          profile: action.profile,
          profileProvenance,
          recommendations,
          latestInterviewDomains,
          activeDomains
        }
      };
    }
    // Deliberately leaves profileProvenance alone: this rewrites diagnosis dates
    // only, never the basics, and it is a demo control — flipping provenance here
    // would clear the "read from your description" marker with a demo button.
    case "backdateFamilyDiagnoses": {
      const family = state.family;
      const profile = family?.profile;
      const now = new Date(action.now);
      if (!profile || profile.diagnoses.length === 0 || Number.isNaN(now.valueOf())) {
        return state;
      }

      const diagnosedAt = backdatedDiagnosisMonth(now, action.monthsAgo);
      const nextProfile: FamilyProfile = {
        ...profile,
        diagnoses: profile.diagnoses.map((diagnosis) => ({
          ...diagnosis,
          diagnosedAt
        }))
      };
      const recommendations =
        recommendationProfileIdentity(profile) ===
        recommendationProfileIdentity(nextProfile)
          ? family.recommendations
          : null;
      const timingLabel =
        action.monthsAgo === 0
          ? "this month"
          : `${action.monthsAgo} month${action.monthsAgo === 1 ? "" : "s"} ago`;
      return {
        ...state,
        family: {
          ...family,
          profile: nextProfile,
          recommendations
        },
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(
            state.patient.id,
            "updated",
            `Demo control: family diagnosis dates set to ${timingLabel}`
          )
        ]
      };
    }
    case "setFamilyInterviewDraft": {
      const family = state.family ?? emptyFamilyState(null);
      return { ...state, family: { ...family, interviewDraft: action.draft } };
    }
    case "submitFamilyScreen": {
      const family = state.family ?? emptyFamilyState(null);
      const interviewFacts = family.facts.filter((fact) => fact.interviewId !== undefined);
      // The family curates screen rows in the journal — taking one out of the
      // packet, or confirming it. Saving the screen again rewrites those rows, so
      // a row still saying the same thing keeps the decisions already made about
      // it instead of quietly walking back into the packet.
      const priorScreenFacts = new Map(
        family.facts
          .filter((fact) => fact.interviewId === undefined)
          .map((fact) => [familyScreenFactIdentity(fact), fact])
      );
      const latestInterviewDomains = applyFamilyScreenRetractions(
        action.answers,
        family.latestInterviewDomains
      );
      const activeDomains = mergeFamilyDomains(
        action.answers,
        latestInterviewDomains
      );
      const recommendations = sameOrderedValues(
        family.activeDomains,
        activeDomains
      )
        ? family.recommendations
        : null;
      return {
        ...state,
        family: {
          ...family,
          screenAnswers: action.answers,
          latestInterviewDomains,
          facts: [
            ...interviewFacts,
            ...action.facts.map(({ id, label, value, status, sourceSnippet }) => {
              const prior = priorScreenFacts.get(
                familyScreenFactIdentity({ label, value, sourceSnippet })
              );
              return {
                id,
                label,
                value,
                status: prior?.status ?? status,
                sourceSnippet,
                includeInSummary: prior?.includeInSummary
              };
            })
          ],
          activeDomains,
          recommendations
        }
      };
    }
    case "addFamilyInterview": {
      const family = state.family ?? emptyFamilyState(null);
      const latestInterviewDomains =
        action.interview.kind === "checkin"
          ? [
              ...new Set([
                ...family.latestInterviewDomains,
                ...action.domains
              ])
            ]
          : [...new Set(action.domains)];
      // Every follow-up round re-extracts from the whole conversation, so the
      // observations from earlier rounds arrive again word for word. The first
      // copy is kept and the rest dropped, so the journal and the visit packet
      // say a thing once instead of once per round.
      const known = new Set(family.facts.map(familyFactIdentity));
      const newFacts = action.facts.flatMap((fact) => {
        const identity = familyFactIdentity(fact);
        if (known.has(identity)) {
          return [];
        }
        known.add(identity);
        return [{ ...fact, interviewId: action.interview.id }];
      });
      return {
        ...state,
        family: {
          ...family,
          interviewDraft: "",
          interviews: [...family.interviews, action.interview],
          facts: [...family.facts, ...newFacts],
          // A new interview invalidates any ranking built from the old one.
          recommendations: null,
          latestInterviewDomains,
          activeDomains: mergeFamilyDomains(family.screenAnswers, latestInterviewDomains)
        }
      };
    }
    // F2b. A crisis turn routes, but it is never recorded. The words are not
    // kept, no facts are made from them, and nothing from the turn can reach the
    // Journal, the Notes tab, or the printable packet a clinician reads — which
    // is what `addFamilyInterview` was quietly doing with "my son says he wants
    // to die". Only the routing signal survives, so a disclosure that also names
    // a school or speech concern still reaches the right programs.
    case "recordFamilySafetyTurn": {
      const family = state.family ?? emptyFamilyState(null);
      const latestInterviewDomains = [
        ...new Set([...family.latestInterviewDomains, ...action.domains])
      ];
      return {
        ...state,
        family: {
          ...family,
          interviewDraft: "",
          latestInterviewDomains,
          activeDomains: mergeFamilyDomains(family.screenAnswers, latestInterviewDomains)
        }
      };
    }
    case "confirmFamilyFact":
      if (!state.family) {
        return state;
      }
      return {
        ...state,
        family: {
          ...state.family,
          facts: state.family.facts.map((fact) =>
            fact.id === action.factId ? { ...fact, status: "confirmed" } : fact
          )
        }
      };
    // Curation for the visit packet only — the journal keeps every fact it ever
    // recorded, so an excluded fact is hidden from the packet, never deleted.
    case "setFamilyFactInclusion":
      if (!state.family || !state.family.facts.some(({ id }) => id === action.factId)) {
        return state;
      }
      return {
        ...state,
        family: {
          ...state.family,
          facts: state.family.facts.map((fact) =>
            fact.id === action.factId ? { ...fact, includeInSummary: action.include } : fact
          )
        }
      };
    // "You misheard me" — a correction of the record, not a curation choice, and
    // not a deletion: the fact keeps its words, its quote, and its place in the
    // journal, and only stops counting as something the family said (FR-3).
    case "rejectFamilyFact": {
      const target = state.family?.facts.find(({ id }) => id === action.factId);
      if (!state.family || !target || target.status === "rejected") {
        return state;
      }
      return {
        ...state,
        family: {
          ...state.family,
          facts: state.family.facts.map((fact) =>
            fact.id === action.factId ? { ...fact, status: "rejected" } : fact
          )
        },
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "updated", "Family fact marked wrong by caregiver")
        ]
      };
    }
    // Only catalog ids reach storage: the picker offers a fixed list, so anything
    // else is a stale save or a bad payload and is dropped rather than printed.
    case "toggleFamilyPacketQuestion": {
      if (!state.family || !PACKET_QUESTIONS.some(({ id }) => id === action.questionId)) {
        return state;
      }
      const picked = state.family.packetQuestionIds.includes(action.questionId);
      return {
        ...state,
        family: {
          ...state.family,
          packetQuestionIds: picked
            ? state.family.packetQuestionIds.filter((id) => id !== action.questionId)
            : [...state.family.packetQuestionIds, action.questionId]
        }
      };
    }
    case "setFamilyRecommendations": {
      if (
        !state.family ||
        !recommendationRequestMatches(state, action.context) ||
        (action.recommendations !== null &&
          action.recommendations.interviewId !== action.context.interviewId)
      ) {
        return state;
      }
      return { ...state, family: { ...state.family, recommendations: action.recommendations } };
    }
    case "recordFamilySafetyEvent": {
      const family = state.family ?? emptyFamilyState(null);
      return {
        ...state,
        family: { ...family, safetyEvents: [...family.safetyEvents, action.event] },
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "crisis_escalated", "Family safety resources shown")
        ]
      };
    }
    case "acknowledgeFamilySafetyEvent": {
      if (!state.family) {
        return state;
      }
      const target = state.family.safetyEvents.find(({ id }) => id === action.eventId);
      if (!target || target.acknowledgedAt !== undefined) {
        return state;
      }
      return {
        ...state,
        family: {
          ...state.family,
          safetyEvents: state.family.safetyEvents.map((event) =>
            event.id === action.eventId ? { ...event, acknowledgedAt: action.at } : event
          )
        },
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "updated", "Family safety resources acknowledged")
        ]
      };
    }
    // The clinic-now tier. One open flag at a time: the probe and the text
    // lexicon describe the same worry, and a family should be asked to call the
    // clinic once, not once per sentence.
    // F8.3. Every probe answer is kept, including "not sure" — which used to be
    // the one tap in the check-in that left no trace. It raises no flag and
    // prints no packet line; it is a record that the question was asked and
    // honestly answered.
    case "recordFamilyCheckinProbe": {
      const family = state.family;
      if (!family || !isExactIsoTimestamp(action.at)) {
        return state;
      }
      return {
        ...state,
        family: {
          ...family,
          probeAnswers: [...(family.probeAnswers ?? []), { at: action.at, answer: action.answer }]
        }
      };
    }
    case "raiseFamilyRegressionFlag": {
      const family = state.family ?? emptyFamilyState(null);
      if (
        !isExactIsoTimestamp(action.at) ||
        family.flags.some(({ type, acknowledgedAt }) => type === "regression" && acknowledgedAt === undefined)
      ) {
        return state;
      }
      return {
        ...state,
        family: {
          ...family,
          flags: [
            ...family.flags,
            {
              id: crypto.randomUUID(),
              type: "regression",
              source: action.source,
              raisedAt: action.at,
              // Kept so a caregiver can retract the sentence that raised it.
              ...(action.interviewId === undefined ? {} : { interviewId: action.interviewId })
            }
          ]
        },
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "created", "Family regression flag raised")
        ]
      };
    }
    case "acknowledgeFamilyRegressionFlag": {
      if (!state.family || !isExactIsoTimestamp(action.at)) {
        return state;
      }
      const target = state.family.flags.find(({ id }) => id === action.flagId);
      if (
        !target ||
        target.acknowledgedAt !== undefined ||
        new Date(action.at).valueOf() < new Date(target.raisedAt).valueOf()
      ) {
        return state;
      }
      return {
        ...state,
        family: {
          ...state.family,
          flags: state.family.flags.map((flag) =>
            flag.id === action.flagId ? { ...flag, acknowledgedAt: action.at } : flag
          )
        },
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "updated", "Family regression flag acknowledged")
        ]
      };
    }
    case "saveFamilyResource":
      if (!state.family || state.family.saved.some(({ resourceId }) => resourceId === action.resource.resourceId)) {
        return state;
      }
      return {
        ...state,
        family: { ...state.family, saved: [...state.family.saved, action.resource] }
      };
    case "toggleFamilyEnrollment": {
      if (!state.family) {
        return state;
      }
      const enrolling = !state.family.alreadyEnrolled.includes(action.resourceId);
      const at = new Date().toISOString();
      return {
        ...state,
        family: {
          ...state.family,
          steps: stepsAfterEnrollmentToggle(state.family, action.resourceId, enrolling, at),
          alreadyEnrolled: syncEnrollment(state.family.alreadyEnrolled, action.resourceId, enrolling)
        }
      };
    }
    // One step per resource: a second "I'll do this" is the same commitment, not a
    // new one, so it keeps the original planned date instead of restarting it.
    case "planFamilyStep": {
      if (
        !state.family ||
        !isExactIsoTimestamp(action.at) ||
        state.family.steps.some(({ resourceId }) => resourceId === action.resourceId)
      ) {
        return state;
      }
      return {
        ...state,
        family: {
          ...state.family,
          steps: [
            ...state.family.steps,
            {
              id: crypto.randomUUID(),
              resourceId: action.resourceId,
              domain: action.domain,
              status: "planned",
              plannedAt: action.at,
              updatedAt: action.at
            }
          ]
        },
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "created", "Family step planned")
        ]
      };
    }
    // An update older than the plan itself is impossible history — storage would
    // drop the row on reload, so it is refused here instead.
    case "updateFamilyStep": {
      if (!state.family || !isExactIsoTimestamp(action.at)) {
        return state;
      }
      const target = state.family.steps.find(({ id }) => id === action.stepId);
      if (!target || new Date(action.at).valueOf() < new Date(target.plannedAt).valueOf()) {
        return state;
      }
      return {
        ...state,
        family: {
          ...state.family,
          steps: withStepStatus(state.family.steps, target.id, action.status, action.at),
          alreadyEnrolled: syncEnrollment(
            state.family.alreadyEnrolled,
            target.resourceId,
            action.status === "enrolled"
          )
        },
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "updated", "Family step updated")
        ]
      };
    }
    // One question, never a gate. An out-of-range score is a bad payload, not a
    // feeling to store — storage would drop it on reload either way.
    case "recordFamilyPulse": {
      const { at, score } = action.pulse;
      if (
        !state.family ||
        !isExactIsoTimestamp(at) ||
        !Number.isInteger(score) ||
        score < 1 ||
        score > 5
      ) {
        return state;
      }
      return {
        ...state,
        family: {
          ...state.family,
          pulses: [...state.family.pulses, action.pulse],
          checkinTouchedAt: at
        },
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "created", "Family pulse recorded")
        ]
      };
    }
    // Skipping is a real answer: it records nothing about the child and still
    // resets due-ness, so the caregiver is not asked again tomorrow.
    case "skipFamilyCheckin": {
      if (!state.family || !isExactIsoTimestamp(action.at)) {
        return state;
      }
      return {
        ...state,
        family: { ...state.family, checkinTouchedAt: action.at },
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "updated", "Family check-in skipped")
        ]
      };
    }
    case "backdateFamilyTouches": {
      const family = state.family;
      if (
        !family ||
        !isExactIsoTimestamp(action.now) ||
        !Number.isInteger(action.days) ||
        action.days <= 0
      ) {
        return state;
      }
      return {
        ...state,
        family: backdatedFamilyTouches(family, action.days),
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(
            state.patient.id,
            "updated",
            `Demo control: family activity moved ${action.days} days back`
          )
        ]
      };
    }
    case "setFamilySoonerList": {
      const family = state.family;
      if (!family || family.referral === null || !isCoherentSoonerList(action.soonerList)) {
        return state;
      }
      return {
        ...state,
        family: { ...family, soonerList: action.soonerList },
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "created", "Family earlier-visit list joined")
        ]
      };
    }
    case "clearFamilySoonerList": {
      const family = state.family;
      if (!family || family.soonerList === null) {
        return state;
      }
      return {
        ...state,
        family: { ...family, soonerList: null },
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "updated", "Family earlier-visit list left")
        ]
      };
    }
    case "setFamilyReferral": {
      const family = state.family ?? emptyFamilyState(null);
      if (
        family.referral !== null ||
        !isNonblank(action.referral.clinic) ||
        !isExactIsoTimestamp(action.referral.referredAt)
      ) {
        return state;
      }
      return {
        ...state,
        family: { ...family, referral: action.referral },
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "created", "Family referral recorded (demo)")
        ]
      };
    }
    case "offerFamilyAppointment": {
      const family = state.family ?? emptyFamilyState(null);
      if (
        family.referral === null ||
        action.appointment.clinic !== family.referral.clinic ||
        !isValidNewAppointmentOffer(action.appointment) ||
        family.appointments.some(({ id }) => id === action.appointment.id) ||
        !acceptsNewOffer(family, action.appointment)
      ) {
        return state;
      }
      return {
        ...state,
        family: { ...family, appointments: [...family.appointments, action.appointment] },
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "created", "Evaluation slots offered (demo)")
        ]
      };
    }
    case "withdrawFamilyAppointmentOffer": {
      const family = state.family;
      if (!family) {
        return state;
      }
      const appointment = family.appointments.find(({ id }) => id === action.appointmentId);
      if (
        appointment === undefined ||
        appointment.status !== "offered" ||
        appointment.scheduledFor !== undefined ||
        !isValidActionTime(appointment, action.at)
      ) {
        return state;
      }
      return {
        ...state,
        family: {
          ...family,
          appointments: family.appointments.filter(({ id }) => id !== action.appointmentId)
        },
        auditEvents: [
          ...state.auditEvents,
          recordAuditEvent(state.patient.id, "updated", "Earlier-visit offer declined (demo)")
        ]
      };
    }
    case "bookFamilyAppointment": {
      const booked = updateFamilyAppointment(
        state,
        action.appointmentId,
        (appointment) => {
          const slotTime = new Date(action.slot).valueOf();
          if (
            appointment.status !== "offered" ||
            appointment.scheduledFor !== undefined ||
            appointment.reminderAcks.length > 0 ||
            !hasValidOfferSlots(appointment) ||
            !isValidActionTime(appointment, action.at) ||
            !appointment.offeredSlots.includes(action.slot) ||
            !Number.isFinite(slotTime) ||
            slotTime <= new Date(action.at).valueOf()
          ) {
            return appointment;
          }
          return { ...appointment, scheduledFor: action.slot, status: "booked" };
        },
        "Evaluation visit booked"
      );
      // Taking the earlier opening hands the old time back to the clinic. It is
      // retired in the same step as the booking, so the family is never holding
      // two visits and a later reschedule cannot offer the stale one back.
      const supersedesId = booked.family?.appointments.find(
        ({ id }) => id === action.appointmentId
      )?.supersedesId;
      if (booked === state || !booked.family || supersedesId === undefined) {
        return booked;
      }
      return {
        ...booked,
        family: {
          ...booked.family,
          appointments: booked.family.appointments.map((appointment): FamilyAppointment =>
            appointment.id === supersedesId &&
            (appointment.status === "booked" || appointment.status === "confirmed")
              ? { ...appointment, status: "replaced" }
              : appointment
          )
        },
        auditEvents: [
          ...booked.auditEvents,
          recordAuditEvent(state.patient.id, "updated", "Earlier visit replaced the prior booking")
        ]
      };
    }
    case "recordFamilyAppointmentBarriers": {
      const withBarriers = updateFamilyAppointment(
        state,
        action.appointmentId,
        (appointment) => {
          if (
            (appointment.status !== "booked" && appointment.status !== "confirmed") ||
            appointment.barriersAsked ||
            appointment.scheduledFor === undefined ||
            !isValidActionTime(appointment, action.at) ||
            !isCoherentBarrierAnswer(action.barriers)
          ) {
            return appointment;
          }
          return { ...appointment, barriers: action.barriers, barriersAsked: true };
        },
        "Visit barriers recorded"
      );
      if (withBarriers === state || !withBarriers.family) {
        return withBarriers;
      }
      const mappedDomains = action.barriers.flatMap((barrier) =>
        barrier === "none" ? [] : [BARRIER_DOMAINS[barrier]]
      );
      return {
        ...withBarriers,
        family: {
          ...withBarriers.family,
          activeDomains: Array.from(new Set([...withBarriers.family.activeDomains, ...mappedDomains]))
        }
      };
    }
    case "acknowledgeFamilyAppointmentReminder":
      return updateFamilyAppointment(
        state,
        action.appointmentId,
        (appointment) => {
          if (
            !isValidActionTime(appointment, action.at) ||
            dueFamilyReminder(appointment, new Date(action.at)) !== action.offset
          ) {
            return appointment;
          }
          return {
            ...appointment,
            status: "confirmed",
            reminderAcks: [...appointment.reminderAcks, { offset: action.offset, acknowledgedAt: action.at }]
          };
        },
        "Evaluation visit confirmed"
      );
    case "requestFamilyAppointmentReschedule":
      return updateFamilyAppointment(
        state,
        action.appointmentId,
        (appointment) => {
          if (
            (appointment.status !== "booked" && appointment.status !== "confirmed") ||
            appointment.scheduledFor === undefined ||
            !isValidActionTime(appointment, action.at)
          ) {
            return appointment;
          }
          return {
            ...appointment,
            offeredSlots: buildDemoSlotOffers(new Date(action.at)),
            status: "offered",
            scheduledFor: undefined,
            reminderAcks: [],
            supersedesId: undefined
          };
        },
        "Evaluation visit reschedule requested"
      );
    case "completeFamilyAppointment":
      return updateFamilyAppointment(
        state,
        action.appointmentId,
        (appointment) =>
          isValidActionTime(appointment, action.at) &&
          overdueFamilyAppointment(appointment, new Date(action.at))
            ? { ...appointment, status: "completed" }
            : appointment,
        "Evaluation visit completed (self-reported)"
      );
    case "missFamilyAppointment":
      return updateFamilyAppointment(
        state,
        action.appointmentId,
        (appointment) =>
          isValidActionTime(appointment, action.at) &&
          overdueFamilyAppointment(appointment, new Date(action.at))
            ? { ...appointment, status: "missed" }
            : appointment,
        "Evaluation visit missed (self-reported)"
      );
    case "setFamilyAppointmentCountdown":
      return updateFamilyAppointment(
        state,
        action.appointmentId,
        (appointment) => {
          if (
            (appointment.status !== "booked" && appointment.status !== "confirmed") ||
            appointment.scheduledFor === undefined ||
            !isExactIsoTimestamp(appointment.scheduledFor) ||
            !isValidActionTime(appointment, action.now) ||
            !FAMILY_APPOINTMENT_COUNTDOWNS.includes(action.daysUntil)
          ) {
            return appointment;
          }
          const scheduledFor = new Date(
            new Date(action.now).valueOf() + action.daysUntil * 24 * 60 * 60 * 1000
          ).toISOString();
          return scheduledFor === appointment.scheduledFor
            ? appointment
            : { ...appointment, scheduledFor };
        },
        "Demo control: evaluation visit moved"
      );
    case "resetDemo":
      if (action.patient === "jordan") {
        return demoState;
      }
      if (action.patient === "brent") {
        return brentState;
      }
      return defaultDemoState;
    case "deleteDemoData":
      return {
        ...deletedDemoState,
        auditEvents: [recordAuditEvent(deletedDemoState.patient.id, "deleted", "Demo data deleted")]
      };
    default:
      return state;
  }
}

type HealthStateContextValue = {
  state: AppState;
  dispatch: Dispatch<HealthAction>;
};

const HealthStateContext = createContext<HealthStateContextValue | null>(null);

export function HealthStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(healthReducer, defaultDemoState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    dispatch({ type: "hydrateStoredState", state: loadStoredState() });
    dispatch({ type: "checkReferralFollowup" });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    saveStoredState(state);
  }, [hydrated, state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <HealthStateContext.Provider value={value}>{children}</HealthStateContext.Provider>;
}

export function useHealthState(): HealthStateContextValue {
  const value = useOptionalHealthState();

  if (!value) {
    throw new Error("useHealthState must be used inside HealthStateProvider");
  }

  return value;
}

export function useOptionalHealthState(): HealthStateContextValue | null {
  return useContext(HealthStateContext);
}
