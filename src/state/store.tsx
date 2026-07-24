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
import { mergeFamilyDomains } from "@/domain/family-screen";
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
  DoseEvent,
  DoseReminderPreference,
  DrReportExtraction,
  ExtractedFact,
  FamilyFact,
  FamilyInterview,
  FamilyNavigatorState,
  FamilyProfile,
  FamilyRecommendationSet,
  FamilySafetyEvent,
  FamilyScreenAnswer,
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
  | { type: "saveFamilyProfile"; profile: FamilyProfile }
  | {
      type: "backdateFamilyDiagnoses";
      monthsAgo: FamilyDiagnosisBackdateMonths;
      now: string;
    }
  | { type: "setFamilyInterviewDraft"; draft: string }
  | { type: "submitFamilyScreen"; answers: FamilyScreenAnswer[]; facts: FamilyFact[] }
  | { type: "addFamilyInterview"; interview: FamilyInterview; facts: FamilyFact[]; domains: FamilyNavigatorState["activeDomains"] }
  | { type: "confirmFamilyFact"; factId: string }
  | { type: "recordFamilySafetyEvent"; event: FamilySafetyEvent }
  | { type: "acknowledgeFamilySafetyEvent"; eventId: string; at: string }
  | { type: "setFamilyRecommendations"; recommendations: FamilyRecommendationSet | null }
  | { type: "saveFamilyResource"; resource: SavedFamilyResource }
  | { type: "toggleFamilyEnrollment"; resourceId: string }
  | { type: "resetDemo"; patient?: "jordan" | "brent" }
  | { type: "deleteDemoData" };

function emptyFamilyState(profile: FamilyProfile | null): FamilyNavigatorState {
  return {
    profile,
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
    alreadyEnrolled: []
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
    case "saveFamilyProfile":
      return {
        ...state,
        family: state.family ? { ...state.family, profile: action.profile } : emptyFamilyState(action.profile)
      };
    case "backdateFamilyDiagnoses": {
      const family = state.family;
      const profile = family?.profile;
      const now = new Date(action.now);
      if (!profile || profile.diagnoses.length === 0 || Number.isNaN(now.valueOf())) {
        return state;
      }

      const diagnosedAt = backdatedDiagnosisMonth(now, action.monthsAgo);
      const timingLabel =
        action.monthsAgo === 0
          ? "this month"
          : `${action.monthsAgo} month${action.monthsAgo === 1 ? "" : "s"} ago`;
      return {
        ...state,
        family: {
          ...family,
          profile: {
            ...profile,
            diagnoses: profile.diagnoses.map((diagnosis) => ({ ...diagnosis, diagnosedAt }))
          }
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
      return {
        ...state,
        family: {
          ...family,
          screenAnswers: action.answers,
          facts: [
            ...interviewFacts,
            ...action.facts.map(({ id, label, value, status, sourceSnippet }) => ({
              id,
              label,
              value,
              status,
              sourceSnippet
            }))
          ],
          activeDomains: mergeFamilyDomains(action.answers, family.latestInterviewDomains)
        }
      };
    }
    case "addFamilyInterview": {
      const family = state.family ?? emptyFamilyState(null);
      const latestInterviewDomains = [...new Set(action.domains)];
      return {
        ...state,
        family: {
          ...family,
          interviewDraft: "",
          interviews: [...family.interviews, action.interview],
          facts: [
            ...family.facts,
            ...action.facts.map((fact) => ({ ...fact, interviewId: action.interview.id }))
          ],
          // A new interview invalidates any ranking built from the old one.
          recommendations: null,
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
    case "setFamilyRecommendations": {
      if (!state.family) {
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
    case "saveFamilyResource":
      if (!state.family || state.family.saved.some(({ resourceId }) => resourceId === action.resource.resourceId)) {
        return state;
      }
      return {
        ...state,
        family: { ...state.family, saved: [...state.family.saved, action.resource] }
      };
    case "toggleFamilyEnrollment":
      if (!state.family) {
        return state;
      }
      return {
        ...state,
        family: {
          ...state.family,
          alreadyEnrolled: state.family.alreadyEnrolled.includes(action.resourceId)
            ? state.family.alreadyEnrolled.filter((resourceId) => resourceId !== action.resourceId)
            : [...state.family.alreadyEnrolled, action.resourceId]
        }
      };
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
