import { defaultDemoState } from "@/domain/fixtures";
import { stripLadderSimulationState } from "@/domain/ladder-sim";
import { clearAllFamilyDrafts } from "@/state/family-draft-storage";
import {
  decodeAppStateRecord,
  encodeAppStateRecord
} from "@/state/persistence-envelope";
import { DEFAULT_DOSE_REMINDER, isDoseReminderPreference } from "@/domain/reminders";
import type { AssessmentEvent } from "@/domain/assessment";
import { getInstrument } from "@/domain/instruments/registry";
import { conditionMatches } from "@/domain/instruments/conditions";
import { isValidMultiChoiceMask } from "@/domain/instruments/multi-choice-mask";
import type { InstrumentItem, ScreeningInstrument } from "@/domain/instruments/types";
import type {
  AccessibilityPreference,
  AppState,
  AiMessage,
  AiMessageAction,
  AuditEvent,
  CareContextItem,
  CarePlan,
  DoseEvent,
  EvidenceStatus,
  ExtractedFact,
  FamilyAppointment,
  FamilyAppointmentBarrier,
  FamilyCheckinProbeAnswer,
  FamilyEvidenceStatus,
  FamilyFact,
  FamilyFlag,
  FamilyInterview,
  FamilyNavigatorState,
  FamilyProfile,
  FamilyPulse,
  FamilyRecommendationItem,
  FamilyRecommendationSet,
  FamilyReferral,
  FamilyReminderOffset,
  FamilyResourceStep,
  FamilySafetyEvent,
  FamilyScreenAnswer,
  FamilySoonerConstraint,
  FamilySoonerList,
  FamilyStepStatus,
  FoodSource,
  GlucoseReading,
  HomeReading,
  IdentifiedFood,
  MealLogEntry,
  Medication,
  MedicationBarrier,
  MedicationFill,
  NutritionFacts,
  PatientProfile,
  MeasurementContext,
  RecallReminder,
  Referral,
  ReferralStageEntry,
  SavedFamilyResource,
  ScreeningGap,
  ScreeningResult,
  TaskItem,
  AiMode
} from "@/domain/types";
import {
  DEFAULT_FAMILY_RESOURCE_PREFERENCES,
  isFamilyResourcePreferences
} from "@/domain/family-resource-preferences";

const STORAGE_KEY = "home-health-ai-ownership-state";
const DELETION_FENCE_KEY = `${STORAGE_KEY}.deletion-fence`;
const DOSE_REMINDER_NOTIFICATION_PREFIX = "dose-reminder-notified:";
const FAMILY_CHECKIN_REMINDER_KEY = "ladder-checkin-reminder";
/**
 * Single slot holding the last payload we refused to load.
 *
 * F3c. Everything a family has written lives in one localStorage key, and a
 * payload this file cannot validate — a schema drift, a half-written save, a
 * corrupted string — was simply removed, silently, and the app came back as the
 * demo with months of notes gone. A state we cannot trust must not drive the
 * app, but its raw text is stashed here before deletion. If that copy fails, the
 * primary remains in place and automatic writes stay disabled.
 * One slot, overwritten each time: this is a developer's escape hatch, not a
 * backup, and it deliberately has no UI.
 */
const RECOVERY_KEY = `${STORAGE_KEY}.recovery`;

function stashRejectedPayload(raw: string, reason: string): boolean {
  const stashed = safeSetItem(RECOVERY_KEY, raw);
  if (typeof console !== "undefined") {
    console.warn(stashed
      ? `[storage] Refused a stored payload (${reason}). ` +
          `The raw payload was copied to "${RECOVERY_KEY}" so it can be recovered by hand.`
      : `[storage] Refused a stored payload (${reason}), but the recovery copy could not be written. ` +
          `The original payload was left at "${STORAGE_KEY}" and automatic writes are disabled.`);
  }
  return stashed;
}

type StorageReadResult =
  | { status: "ok"; value: string | null }
  | { status: "unavailable" };

function readStorageItem(key: string): StorageReadResult {
  if (typeof window === "undefined") {
    return { status: "unavailable" };
  }

  try {
    return { status: "ok", value: window.localStorage.getItem(key) };
  } catch {
    return { status: "unavailable" };
  }
}

function safeGetItem(key: string): string | null {
  const result = readStorageItem(key);
  return result.status === "ok" ? result.value : null;
}

function safeSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(key: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export type StoredDeletionFenceRead =
  | { status: "ok"; value: number }
  | { status: "unavailable" };

/**
 * A non-user-data generation that survives data deletion. Repositories capture
 * it when they load and must see the same value immediately before a write.
 */
export function readStoredDeletionFence(): StoredDeletionFenceRead {
  const read = readStorageItem(DELETION_FENCE_KEY);
  if (read.status === "unavailable") return read;
  if (read.value === null) return { status: "ok", value: 0 };

  const value = Number(read.value);
  return Number.isSafeInteger(value) && value >= 0
    ? { status: "ok", value }
    : { status: "unavailable" };
}

function advanceStoredDeletionFence(): number | null {
  const current = readStoredDeletionFence();
  if (current.status === "unavailable" || current.value === Number.MAX_SAFE_INTEGER) {
    return null;
  }
  const next = current.value + 1;
  return safeSetItem(DELETION_FENCE_KEY, String(next)) ? next : null;
}

function getKnownSourceIds(state: AppState): Set<string> {
  const sourceIds = new Set<string>();

  sourceIds.add(state.carePlan.id);
  state.carePlan.goals.forEach((goal) => {
    sourceIds.add(goal.id);
  });
  state.medications.forEach((medication) => {
    sourceIds.add(medication.id);
  });
  state.readings.forEach((reading) => {
    sourceIds.add(reading.id);
  });
  state.glucoseReadings.forEach((reading) => {
    sourceIds.add(reading.id);
  });
  state.contextItems.forEach((contextItem) => {
    sourceIds.add(contextItem.id);
  });
  state.extractedFacts.forEach((fact) => {
    sourceIds.add(fact.id);
  });
  // The screening arrays are sanitized after this relationship check runs, so
  // they are read defensively here: a corrupt field must degrade, not throw a
  // new reset-to-demo vector into hasValidRelationships.
  if (Array.isArray(state.screeningGaps)) {
    state.screeningGaps.forEach((gap) => {
      if (isScreeningGap(gap)) {
        sourceIds.add(gap.id);
      }
    });
  }
  if (Array.isArray(state.screeningResults)) {
    state.screeningResults.forEach((result) => {
      if (isScreeningResult(result)) {
        sourceIds.add(result.id);
      }
    });
  }
  if (Array.isArray(state.referrals)) {
    state.referrals.forEach((referral) => {
      if (isReferral(referral)) {
        sourceIds.add(referral.id);
      }
    });
  }

  return sourceIds;
}

function hasValidRelationships(state: AppState): boolean {
  const patientId = state.patient.id;

  if (state.carePlan.patientId !== patientId) {
    return false;
  }

  if (state.medications.some((medication) => medication.patientId !== patientId)) {
    return false;
  }

  if (state.readings.some((reading) => reading.patientId !== patientId)) {
    return false;
  }

  if (state.contextItems.some((item) => item.patientId !== patientId)) {
    return false;
  }

  if (state.auditEvents.some((event) => event.patientId !== patientId)) {
    return false;
  }

  const contextItemIds = new Set(state.contextItems.map((item) => item.id));
  if (state.extractedFacts.some((fact) => !contextItemIds.has(fact.contextItemId))) {
    return false;
  }

  const sourceIds = getKnownSourceIds(state);
  if (
    state.aiMessages.some((message) =>
      message.sources.some((sourceId) => sourceId.length > 0 && !sourceIds.has(sourceId))
    )
  ) {
    return false;
  }

  return true;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasString<K extends string>(value: unknown, key: K): value is Record<K, string> & Record<string, unknown> {
  return isObject(value) && typeof value[key] === "string";
}

function hasNumber<K extends string>(value: unknown, key: K): value is Record<K, number> & Record<string, unknown> {
  return isObject(value) && typeof value[key] === "number" && Number.isFinite(value[key]);
}

function isArrayOfStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isArrayOfObjects<T>(value: unknown, itemGuard: (value: unknown) => value is T): value is T[] {
  return Array.isArray(value) && value.every(itemGuard);
}

function isEvidenceStatus(value: unknown): value is EvidenceStatus {
  return value === "confirmed" || value === "patient_reported" || value === "imported" || value === "inferred" || value === "needs_review";
}

function isTaskStatus(value: unknown): value is TaskItem["status"] {
  return value === "confirmed" || value === "inferred" || value === "needs_review";
}

function isMedicationBarrier(value: unknown): value is MedicationBarrier {
  return (
    value === "forgot" ||
    value === "ran_out" ||
    value === "cost" ||
    value === "side_effects" ||
    value === "confused" ||
    value === "scared" ||
    value === "pharmacy_issue" ||
    value === "does_not_feel_necessary"
  );
}

function isMeasurementContext(value: unknown): value is MeasurementContext {
  return (
    value === "morning" ||
    value === "evening" ||
    value === "before_medicine" ||
    value === "after_medicine" ||
    value === "after_coffee" ||
    value === "after_resting" ||
    value === "during_symptoms"
  );
}

function isMeasurementContextArray(value: unknown): value is MeasurementContext[] {
  return Array.isArray(value) && value.every((item) => isMeasurementContext(item));
}

export function isLanguage(value: unknown): value is PatientProfile["language"] {
  return value === "en" || value === "es";
}

function isAccessibilityPreference(value: unknown): value is AccessibilityPreference {
  return (
    value === "read_aloud" ||
    value === "large_text" ||
    value === "screen_reader" ||
    value === "high_contrast" ||
    value === "keyboard_navigation"
  );
}

function isThresholdSource(value: unknown): value is CarePlan["thresholdSource"] {
  return value === "clinician_authored" || value === "standard_education";
}

function isAiMode(value: unknown): value is AiMode {
  return (
    value === "explain" ||
    value === "today" ||
    value === "why" ||
    value === "ask" ||
    value === "trouble" ||
    value === "visit" ||
    value === "summarize" ||
    value === "food"
  );
}

function hasNumberOrNull<K extends string>(value: Record<string, unknown>, key: K): boolean {
  const field = value[key];
  return field === null || (typeof field === "number" && Number.isFinite(field));
}

function isNutritionFacts(value: unknown): value is NutritionFacts {
  return (
    isObject(value) &&
    hasString(value, "servingSize") &&
    hasNumberOrNull(value, "calories") &&
    hasNumberOrNull(value, "sodiumMg") &&
    hasNumberOrNull(value, "potassiumMg") &&
    hasNumberOrNull(value, "totalSugarsG") &&
    hasNumberOrNull(value, "addedSugarsG") &&
    hasNumberOrNull(value, "saturatedFatG") &&
    hasNumberOrNull(value, "fiberG") &&
    hasNumberOrNull(value, "proteinG") &&
    hasNumberOrNull(value, "carbsG")
  );
}

function isFoodSource(value: unknown): value is FoodSource {
  return value === "barcode_off" || value === "barcode_fdc" || value === "barcode_seed" || value === "vision_estimate";
}

function isIdentifiedFood(value: unknown): value is IdentifiedFood {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    (value.barcode === null || typeof value.barcode === "string") &&
    hasString(value, "name") &&
    (value.brand === null || typeof value.brand === "string") &&
    (value.category === null || typeof value.category === "string") &&
    (value.nutrition === null || isNutritionFacts(value.nutrition)) &&
    isFoodSource(value.source)
  );
}

function isMealLogEntry(value: unknown): value is MealLogEntry {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "patientId") &&
    hasString(value, "loggedAt") &&
    isIdentifiedFood(value.food) &&
    isArrayOfStrings(value.flags) &&
    hasString(value, "assistantSummary")
  );
}

function isDoseEvent(value: unknown): value is DoseEvent {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "patientId") &&
    hasString(value, "medicationId") &&
    hasString(value, "date") &&
    (value.status === "taken" || value.status === "skipped") &&
    (value.barrier === null || isMedicationBarrier(value.barrier)) &&
    hasString(value, "recordedAt")
  );
}

function isInstrumentResponse(
  value: number,
  item: InstrumentItem,
  responses: number[],
  instrument: ScreeningInstrument
): boolean {
  const condition = item.conditionalOn;
  const conditionItemIndex = condition
    ? instrument.items.findIndex((candidate) => candidate.id === condition.itemId)
    : -1;
  const conditionMet =
    !condition || (conditionItemIndex >= 0 && conditionMatches(condition, responses[conditionItemIndex]));

  if (!conditionMet) {
    return item.notApplicableValue !== undefined && value === item.notApplicableValue;
  }
  if (item.kind === "choice") {
    return (item.options ?? instrument.defaultOptions ?? []).some((option) => option.value === value);
  }
  if (item.kind === "multi_choice") {
    return isValidMultiChoiceMask(
      value,
      (item.options ?? []).map((option) => option.value),
      item.allowEmpty === true
    );
  }
  if (item.notApplicableValue !== undefined && value === item.notApplicableValue) {
    return false;
  }
  return (
    Number.isFinite(value) &&
    (item.min === undefined || value >= item.min) &&
    (item.max === undefined || value <= item.max) &&
    (item.integer !== true || Number.isInteger(value))
  );
}

function isAssessmentEvent(value: unknown): value is AssessmentEvent {
  if (!isObject(value) || !hasString(value, "instrumentId")) {
    return false;
  }
  const instrument = getInstrument(value.instrumentId);
  if (!instrument || !Array.isArray(value.itemResponses) || value.itemResponses.length !== instrument.items.length) {
    return false;
  }
  const responses = value.itemResponses;
  return (
    hasString(value, "id") &&
    hasString(value, "patientId") &&
    responses.every(
      (response, index): response is number =>
        typeof response === "number" && isInstrumentResponse(response, instrument.items[index], responses, instrument)
    ) &&
    hasNumber(value, "totalScore") &&
    typeof value.severityBand === "string" &&
    instrument.bands.includes(value.severityBand) &&
    value.status === "patient_reported" &&
    hasString(value, "recordedAt")
  );
}

function isMedicationFill(value: unknown): value is MedicationFill {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "patientId") &&
    hasString(value, "medicationId") &&
    hasString(value, "medicationName") &&
    hasString(value, "dateOfService") &&
    hasNumber(value, "daysSupply") &&
    isEvidenceStatus(value.source)
  );
}

function isDrGrade(value: unknown): value is NonNullable<ScreeningResult["grade"]> {
  return (
    value === "no_dr" ||
    value === "mild_npdr" ||
    value === "moderate_npdr" ||
    value === "severe_npdr" ||
    value === "pdr"
  );
}

function isScreeningGapStatus(value: unknown): value is ScreeningGap["status"] {
  return (
    value === "overdue" ||
    value === "engaged" ||
    value === "scheduled" ||
    value === "completed" ||
    value === "closed" ||
    value === "referral" ||
    value === "repeat"
  );
}

function isScreeningGap(value: unknown): value is ScreeningGap {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    value.condition === "diabetes" &&
    isScreeningGapStatus(value.status) &&
    (value.lastScreeningDate === null || typeof value.lastScreeningDate === "string") &&
    (value.scheduledSiteId === undefined || typeof value.scheduledSiteId === "string") &&
    (value.scheduledFor === undefined || typeof value.scheduledFor === "string")
  );
}

function isScreeningResult(value: unknown): value is ScreeningResult {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "gapId") &&
    (value.outcome === "normal" || value.outcome === "abnormal" || value.outcome === "ungradable") &&
    (value.grade === null || isDrGrade(value.grade)) &&
    (value.dmePresent === null || typeof value.dmePresent === "boolean") &&
    (value.source === "photo_report" || value.source === "typed_entry") &&
    hasString(value, "reportRef") &&
    hasString(value, "confirmedAt")
  );
}

function isReferralStageEntry(value: unknown): value is ReferralStageEntry {
  return (
    isObject(value) &&
    (value.stage === "drafted" ||
      value.stage === "sent" ||
      value.stage === "clinic_confirmed" ||
      value.stage === "scheduled" ||
      value.stage === "completed" ||
      value.stage === "stalled") &&
    hasString(value, "at") &&
    hasString(value, "note")
  );
}

function isReferral(value: unknown): value is Referral {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "resultId") &&
    (value.tier === "none" || value.tier === "optometry_routine" || value.tier === "retina_urgent") &&
    hasString(value, "destinationId") &&
    isArrayOfObjects(value.stageHistory, isReferralStageEntry) &&
    hasString(value, "sentAt") &&
    (value.scheduledFor === undefined || typeof value.scheduledFor === "string")
  );
}

function isRecallReminder(value: unknown): value is RecallReminder {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "dueAt") &&
    (value.reason === "annual_rescreen" || value.reason === "annual_rescreen_mild")
  );
}

function isMedication(value: unknown): value is Medication {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "patientId") &&
    hasString(value, "name") &&
    hasString(value, "dose") &&
    hasString(value, "schedule") &&
    hasString(value, "purpose") &&
    hasString(value, "preventionBenefit") &&
    hasString(value, "safetyNote") &&
    isEvidenceStatus(value.source) &&
    isArrayOfStrings(value.activeBarriers) &&
    value.activeBarriers.every(isMedicationBarrier)
  );
}

function isReading(value: unknown): value is HomeReading {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "patientId") &&
    hasNumber(value, "systolic") &&
    hasNumber(value, "diastolic") &&
    (value.pulse === null || hasNumber(value, "pulse")) &&
    hasString(value, "measuredAt") &&
    hasString(value, "note") &&
    isMeasurementContextArray(value.contexts)
  );
}

function isGlucoseReading(value: unknown): value is GlucoseReading {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "patientId") &&
    hasNumber(value, "valueMgDl") &&
    hasString(value, "measuredAt") &&
    hasString(value, "note") &&
    isMeasurementContextArray(value.contexts)
  );
}

function isTask(value: unknown): value is TaskItem {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "title") &&
    hasString(value, "body") &&
    hasString(value, "href") &&
    (value.priority === 1 || value.priority === 2 || value.priority === 3) &&
    (value.kind === "reading" ||
      value.kind === "medicine" ||
      value.kind === "visit" ||
      value.kind === "intake" ||
      value.kind === "privacy" ||
      value.kind === "checkin") &&
    isTaskStatus(value.status)
  );
}

function isContextItem(value: unknown): value is CareContextItem {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "patientId") &&
    hasString(value, "title") &&
    hasString(value, "rawText") &&
    hasString(value, "sourceLabel") &&
    hasString(value, "createdAt")
  );
}

function isExtractedFact(value: unknown): value is ExtractedFact {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "contextItemId") &&
    hasString(value, "label") &&
    hasString(value, "value") &&
    (value.confidence === "high" || value.confidence === "medium" || value.confidence === "low") &&
    isEvidenceStatus(value.status) &&
    hasString(value, "sourceSnippet")
  );
}

function isAiMessage(value: unknown): value is AiMessage {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    isAiMode(value.mode) &&
    (value.role === "patient" || value.role === "assistant") &&
    hasString(value, "content") &&
    hasString(value, "createdAt") &&
    (value.safety === "allowed" ||
      value.safety === "escalate" ||
      value.safety === "blocked" ||
      value.safety === "crisis") &&
    isArrayOfStrings(value.sources)
  );
}

function isAiMessageAction(value: unknown): value is AiMessageAction {
  return (
    value === "call_clinic" ||
    value === "draft_message" ||
    value === "crisis_call_988" ||
    value === "crisis_text_988" ||
    value === "call_emergency" ||
    value === "safety_plan"
  );
}

// Actions are not part of the isAiMessage guard (they were never validated), so
// rather than introduce a new rejection vector we lenient-filter unknown action
// strings out of persisted messages. A rolled-back build that wrote a newer
// action value therefore loads cleanly instead of resetting to the default demo.
function sanitizeAiMessageActions(messages: AiMessage[]): AiMessage[] {
  return messages.map((message) => {
    if (!Array.isArray(message.actions)) {
      return message;
    }
    const filtered = message.actions.filter(isAiMessageAction);
    if (filtered.length === message.actions.length) {
      return message;
    }
    return { ...message, actions: filtered };
  });
}

function isAuditEvent(value: unknown): value is AuditEvent {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "patientId") &&
    hasString(value, "label") &&
    (value.action === "created" ||
      value.action === "updated" ||
      value.action === "ai_generated" ||
      value.action === "shared" ||
      value.action === "exported" ||
      value.action === "deleted" ||
      value.action === "crisis_escalated" ||
      value.action === "assessment_recorded" ||
      value.action === "screening_scheduled" ||
      value.action === "screening_result_confirmed" ||
      value.action === "referral_placed" ||
      value.action === "referral_escalated" ||
      value.action === "recall_scheduled" ||
      value.action === "referral_booked" ||
      value.action === "voice_consent_granted" ||
      value.action === "voice_session_started" ||
      value.action === "family_ai_send_attempted") &&
    hasString(value, "createdAt")
  );
}

function isCareGoal(value: unknown): value is CarePlan["goals"][number] {
  return isObject(value) && hasString(value, "id") && hasString(value, "label") && hasString(value, "reason");
}

function isCarePlan(value: unknown): value is CarePlan {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "patientId") &&
    hasString(value, "condition") &&
    (value.condition === "hypertension" || value.condition === "diabetes" || value.condition === "obesity") &&
    (value.conditions === undefined ||
      (Array.isArray(value.conditions) &&
        value.conditions.every(
          (condition) => condition === "hypertension" || condition === "diabetes" || condition === "obesity"
        ))) &&
    hasString(value, "plainLanguageSummary") &&
    isArrayOfObjects(value.goals, isCareGoal) &&
    isArrayOfStrings(value.dailyActions) &&
    (value.callThresholdSystolic === null || Number.isFinite(value.callThresholdSystolic)) &&
    (value.callThresholdDiastolic === null || Number.isFinite(value.callThresholdDiastolic)) &&
    (value.callThresholdGlucoseLow === undefined ||
      value.callThresholdGlucoseLow === null ||
      Number.isFinite(value.callThresholdGlucoseLow)) &&
    (value.callThresholdGlucoseHigh === undefined ||
      value.callThresholdGlucoseHigh === null ||
      Number.isFinite(value.callThresholdGlucoseHigh)) &&
    isThresholdSource(value.thresholdSource) &&
    isArrayOfStrings(value.warningSymptoms) &&
    hasString(value, "nextVisitReason")
  );
}

function isPatient(value: unknown): value is PatientProfile {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "name") &&
    hasString(value, "preferredName") &&
    isLanguage(value.language) &&
    hasString(value, "primaryClinicName") &&
    hasString(value, "primaryClinicPhone") &&
    (value.county === undefined || typeof value.county === "string") &&
    (value.accessibilityPreferences === undefined ||
      (Array.isArray(value.accessibilityPreferences) &&
        value.accessibilityPreferences.every(isAccessibilityPreference)))
  );
}

function isDevDiagnosis(value: unknown): value is FamilyProfile["diagnoses"][number]["label"] {
  return (
    value === "autism" ||
    value === "adhd" ||
    value === "dyslexia" ||
    value === "speech_language" ||
    value === "developmental_delay" ||
    value === "intellectual_disability" ||
    value === "down_syndrome" ||
    value === "other"
  );
}

function isDevNeedDomain(value: unknown): value is FamilyScreenAnswer["domain"] {
  return (
    value === "early_intervention" ||
    value === "therapies" ||
    value === "school_iep" ||
    value === "waivers_financial" ||
    value === "respite" ||
    value === "parent_support" ||
    value === "sibling_support" ||
    value === "transportation" ||
    value === "future_planning" ||
    value === "diagnosis_education" ||
    value === "recreation"
  );
}

function isSchoolStage(value: unknown): value is FamilyProfile["schoolStage"] {
  return (
    value === "not_school_age" ||
    value === "preschool" ||
    value === "elementary" ||
    value === "middle" ||
    value === "high" ||
    value === "post_high"
  );
}

function isChildDiagnosis(value: unknown): value is FamilyProfile["diagnoses"][number] {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    isDevDiagnosis(value.label) &&
    (value.otherLabel === undefined || typeof value.otherLabel === "string") &&
    (value.diagnosedAt === undefined || typeof value.diagnosedAt === "string")
  );
}

function sanitizeFamilyProfile(value: unknown): FamilyProfile | null | undefined {
  if (value === null) {
    return null;
  }
  if (
    !isObject(value) ||
    (value.childFirstName !== undefined && typeof value.childFirstName !== "string") ||
    !hasNumber(value, "birthYear") ||
    !Number.isInteger(value.birthYear) ||
    (value.birthMonth !== undefined &&
      (typeof value.birthMonth !== "number" ||
        !Number.isInteger(value.birthMonth) ||
        value.birthMonth < 1 ||
        value.birthMonth > 12)) ||
    !isSchoolStage(value.schoolStage) ||
    !hasString(value, "county") ||
    !Array.isArray(value.diagnoses)
  ) {
    return undefined;
  }

  return {
    ...(typeof value.childFirstName === "string" ? { childFirstName: value.childFirstName } : {}),
    birthYear: value.birthYear,
    ...(typeof value.birthMonth === "number" ? { birthMonth: value.birthMonth } : {}),
    schoolStage: value.schoolStage,
    county: value.county,
    diagnoses: value.diagnoses.filter(isChildDiagnosis)
  };
}

function isFamilyRecommendationItem(value: unknown): value is FamilyRecommendationItem {
  return (
    isObject(value) &&
    hasString(value, "resourceId") &&
    (value.why === undefined || typeof value.why === "string") &&
    (value.becauseYouSaid === undefined || typeof value.becauseYouSaid === "string") &&
    (value.urgency === "act_now" || value.urgency === "soon" || value.urgency === "when_ready")
  );
}

function sanitizeFamilyRecommendations(value: unknown): FamilyRecommendationSet | null {
  if (!isObject(value)) {
    return null;
  }
  if (
    !hasString(value, "interviewId") ||
    !hasString(value, "createdAt") ||
    !hasString(value, "heard") ||
    !isDevNeedDomain(value.lead) ||
    (value.extraction !== "live" && value.extraction !== "mock") ||
    !Array.isArray(value.items)
  ) {
    return null;
  }
  return {
    interviewId: value.interviewId,
    createdAt: value.createdAt,
    extraction: value.extraction,
    heard: value.heard,
    lead: value.lead,
    items: value.items.filter(isFamilyRecommendationItem)
  };
}

function isFamilySafetyEvent(value: unknown): value is FamilySafetyEvent {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    (value.tier === "crisis" || value.tier === "emergency" || value.tier === "blocked") &&
    hasString(value, "domain") &&
    (value.guidance === undefined ||
      value.guidance === "missing_child" ||
      value.guidance === "medication_access" ||
      value.guidance === "basic_needs" ||
      value.guidance === "basic_needs_and_medication_access") &&
    hasString(value, "createdAt") &&
    (value.acknowledgedAt === undefined || typeof value.acknowledgedAt === "string")
  );
}

function isFamilyScreenAnswer(value: unknown): value is FamilyScreenAnswer {
  return (
    isObject(value) &&
    hasString(value, "questionId") &&
    isDevNeedDomain(value.domain) &&
    (value.response === "yes" || value.response === "no" || value.response === "declined")
  );
}

const familyInterviewKinds = ["orientation", "note", "checkin"] as const;

function isFamilyInterview(value: unknown): value is Omit<FamilyInterview, "kind"> & {
  kind?: FamilyInterview["kind"];
} {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "rawText") &&
    (value.source === "typed" || value.source === "voice" || value.source === "mixed") &&
    hasString(value, "createdAt") &&
    (value.extraction === "live" || value.extraction === "mock") &&
    // Optional in storage on purpose: saves written before spec 13 backfill to
    // "orientation" in the sanitizer rather than resetting the family slice.
    (value.kind === undefined || familyInterviewKinds.some((kind) => kind === value.kind))
  );
}

function isFamilyEvidenceStatus(value: unknown): value is FamilyEvidenceStatus {
  return (
    value === "patient_reported" ||
    value === "inferred" ||
    value === "confirmed" ||
    // Additive: saves written before "you misheard me" existed carry one of the
    // three above and hydrate unchanged.
    value === "rejected"
  );
}

function isFamilyFact(value: unknown): value is FamilyFact {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    (value.interviewId === undefined || typeof value.interviewId === "string") &&
    hasString(value, "label") &&
    hasString(value, "value") &&
    isFamilyEvidenceStatus(value.status) &&
    hasString(value, "sourceSnippet") &&
    (value.includeInSummary === undefined || typeof value.includeInSummary === "boolean")
  );
}

function isSavedFamilyResource(value: unknown): value is SavedFamilyResource {
  return (
    isObject(value) &&
    hasString(value, "resourceId") &&
    hasString(value, "savedAt") &&
    isDevNeedDomain(value.domain)
  );
}

const familyAppointmentBarriers: FamilyAppointmentBarrier[] = ["ride", "sibling_care", "work_schedule", "none"];
const familyReminderOffsets: FamilyReminderOffset[] = ["t14", "t3", "t1"];
const familyAppointmentStatuses: FamilyAppointment["status"][] = [
  "offered",
  "booked",
  "confirmed",
  "completed",
  "missed",
  "replaced"
];

function isNonblankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isExactIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.valueOf()) && timestamp.toISOString() === value;
}

function isFamilyReferral(value: unknown): value is FamilyReferral {
  return (
    isObject(value) &&
    isNonblankString(value.clinic) &&
    isExactIsoTimestamp(value.referredAt)
  );
}

function isFamilyAppointment(value: unknown): value is FamilyAppointment {
  if (
    !isObject(value) ||
    !isNonblankString(value.id) ||
    !isNonblankString(value.clinic) ||
    !isExactIsoTimestamp(value.createdAt) ||
    !Array.isArray(value.offeredSlots) ||
    value.offeredSlots.length === 0 ||
    !value.offeredSlots.every(isExactIsoTimestamp) ||
    new Set(value.offeredSlots).size !== value.offeredSlots.length ||
    typeof value.status !== "string" ||
    !familyAppointmentStatuses.some((status) => status === value.status) ||
    typeof value.barriersAsked !== "boolean" ||
    !Array.isArray(value.barriers) ||
    !Array.isArray(value.reminderAcks) ||
    // A backfill names the booking it would replace, never itself.
    (value.supersedesId !== undefined &&
      (!isNonblankString(value.supersedesId) || value.supersedesId === value.id))
  ) {
    return false;
  }

  const createdAt = new Date(value.createdAt).valueOf();
  if (value.offeredSlots.some((slot) => new Date(slot).valueOf() <= createdAt)) {
    return false;
  }

  const scheduledFor = value.scheduledFor;
  if (
    (value.status === "offered" && scheduledFor !== undefined) ||
    (value.status !== "offered" && !isExactIsoTimestamp(scheduledFor))
  ) {
    return false;
  }

  const barriers = value.barriers;
  if (
    !barriers.every(
      (barrier): barrier is FamilyAppointmentBarrier =>
        familyAppointmentBarriers.some((known) => known === barrier)
    ) ||
    new Set(barriers).size !== barriers.length ||
    (!value.barriersAsked && barriers.length > 0) ||
    (value.barriersAsked && barriers.length === 0) ||
    (barriers.includes("none") && barriers.length !== 1)
  ) {
    return false;
  }

  const reminderAcks = value.reminderAcks;
  if (
    !reminderAcks.every(
      (ack) =>
        isObject(ack) &&
        isExactIsoTimestamp(ack.acknowledgedAt) &&
        new Date(ack.acknowledgedAt).valueOf() >= createdAt &&
        familyReminderOffsets.some((offset) => offset === ack.offset)
    )
  ) {
    return false;
  }
  const reminderOffsets = reminderAcks.map((ack) => (ack as { offset: FamilyReminderOffset }).offset);
  if (
    new Set(reminderOffsets).size !== reminderOffsets.length ||
    ((value.status === "offered" || value.status === "booked") && reminderAcks.length > 0) ||
    (value.status === "confirmed" && reminderAcks.length === 0)
  ) {
    return false;
  }

  return true;
}

const familyStepStatuses: FamilyStepStatus[] = ["planned", "tried", "in_touch", "enrolled", "not_for_us"];
const familySoonerConstraints: FamilySoonerConstraint[] = [
  "weekday_mornings",
  "weekday_afternoons",
  "any_weekday",
  "needs_notice"
];

function isFamilyResourceStep(value: unknown): value is FamilyResourceStep {
  return (
    isObject(value) &&
    isNonblankString(value.id) &&
    isNonblankString(value.resourceId) &&
    isDevNeedDomain(value.domain) &&
    typeof value.status === "string" &&
    familyStepStatuses.some((status) => status === value.status) &&
    isExactIsoTimestamp(value.plannedAt) &&
    isExactIsoTimestamp(value.updatedAt) &&
    new Date(value.updatedAt).valueOf() >= new Date(value.plannedAt).valueOf()
  );
}

function isFamilyPulse(value: unknown): value is FamilyPulse {
  return (
    isObject(value) &&
    isExactIsoTimestamp(value.at) &&
    typeof value.score === "number" &&
    Number.isInteger(value.score) &&
    value.score >= 1 &&
    value.score <= 5
  );
}

function isFamilyCheckinProbeAnswer(value: unknown): value is FamilyCheckinProbeAnswer {
  return (
    isObject(value) &&
    isExactIsoTimestamp(value.at) &&
    (value.answer === "no" || value.answer === "yes" || value.answer === "unsure")
  );
}

function isFamilyFlag(value: unknown): value is FamilyFlag {
  return (
    isObject(value) &&
    isNonblankString(value.id) &&
    value.type === "regression" &&
    (value.source === "probe" || value.source === "text") &&
    isExactIsoTimestamp(value.raisedAt) &&
    (value.interviewId === undefined || typeof value.interviewId === "string") &&
    (value.acknowledgedAt === undefined ||
      (isExactIsoTimestamp(value.acknowledgedAt) &&
        new Date(value.acknowledgedAt).valueOf() >= new Date(value.raisedAt).valueOf()))
  );
}

function isFamilySoonerList(value: unknown): value is FamilySoonerList {
  return (
    isObject(value) &&
    isExactIsoTimestamp(value.optedInAt) &&
    Array.isArray(value.constraints) &&
    value.constraints.length > 0 &&
    value.constraints.every((entry) => familySoonerConstraints.some((known) => known === entry)) &&
    new Set(value.constraints).size === value.constraints.length
  );
}

function uniqueStrings<T extends string>(values: T[]): T[] {
  return [...new Set(values)];
}

function uniqueSavedFamilyResources(resources: SavedFamilyResource[]): SavedFamilyResource[] {
  const seen = new Set<string>();
  return resources.filter(({ resourceId }) => {
    if (seen.has(resourceId)) {
      return false;
    }
    seen.add(resourceId);
    return true;
  });
}

function uniqueFamilyAppointments(appointments: FamilyAppointment[]): FamilyAppointment[] {
  const seen = new Set<string>();
  return appointments.filter(({ id }) => {
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function hasCoherentFamilyAppointmentSupersession(
  parent: FamilyAppointment,
  child: FamilyAppointment
): boolean {
  if (child.status === "offered") {
    return parent.status === "booked" || parent.status === "confirmed";
  }
  return parent.status === "replaced";
}

function sanitizeFamilyAppointmentSupersedes(appointments: FamilyAppointment[]): FamilyAppointment[] {
  const earlierAppointments = new Map<string, FamilyAppointment>();
  return appointments.map((appointment) => {
    const parent = appointment.supersedesId === undefined ? undefined : earlierAppointments.get(appointment.supersedesId);
    earlierAppointments.set(appointment.id, appointment);
    return appointment.supersedesId === undefined ||
      (parent !== undefined && hasCoherentFamilyAppointmentSupersession(parent, appointment))
      ? appointment
      : { ...appointment, supersedesId: undefined };
  });
}

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter(({ id }) => {
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function isFamilyNavigatorState(value: unknown): value is FamilyNavigatorState {
  // safetyEvents is optional here on purpose: a save written before it existed
  // must still validate, or an existing family slice would reset to the demo.
  // The sanitizer backfills it.
  return (
    isObject(value) &&
    (value.profile === null || sanitizeFamilyProfile(value.profile) !== undefined) &&
    (value.profileProvenance === undefined ||
      value.profileProvenance === "stated" ||
      value.profileProvenance === "extracted") &&
    (value.referral === undefined || value.referral === null || isFamilyReferral(value.referral)) &&
    (value.appointments === undefined || isArrayOfObjects(value.appointments, isFamilyAppointment)) &&
    (value.safetyEvents === undefined || isArrayOfObjects(value.safetyEvents, isFamilySafetyEvent)) &&
    (value.recommendations === undefined ||
      value.recommendations === null ||
      isObject(value.recommendations)) &&
    typeof value.interviewDraft === "string" &&
    isArrayOfObjects(value.screenAnswers, isFamilyScreenAnswer) &&
    isArrayOfObjects(value.interviews, isFamilyInterview) &&
    isArrayOfObjects(value.facts, isFamilyFact) &&
    Array.isArray(value.latestInterviewDomains) &&
    value.latestInterviewDomains.every(isDevNeedDomain) &&
    Array.isArray(value.activeDomains) &&
    value.activeDomains.every(isDevNeedDomain) &&
    (value.resourcePreferences === undefined ||
      isFamilyResourcePreferences(value.resourcePreferences)) &&
    isArrayOfObjects(value.saved, isSavedFamilyResource) &&
    isArrayOfStrings(value.alreadyEnrolled) &&
    (value.steps === undefined || isArrayOfObjects(value.steps, isFamilyResourceStep)) &&
    (value.pulses === undefined || isArrayOfObjects(value.pulses, isFamilyPulse)) &&
    (value.flags === undefined || isArrayOfObjects(value.flags, isFamilyFlag)) &&
    (value.probeAnswers === undefined ||
      isArrayOfObjects(value.probeAnswers, isFamilyCheckinProbeAnswer)) &&
    (value.soonerList === undefined ||
      value.soonerList === null ||
      isFamilySoonerList(value.soonerList)) &&
    (value.packetQuestionIds === undefined || isArrayOfStrings(value.packetQuestionIds)) &&
    (value.checkinTouchedAt === undefined ||
      value.checkinTouchedAt === null ||
      isExactIsoTimestamp(value.checkinTouchedAt))
  );
}

function sanitizeFamilyNavigatorState(value: unknown): FamilyNavigatorState | null {
  if (!isObject(value)) {
    return null;
  }
  const profile = sanitizeFamilyProfile(value.profile);
  if (
    profile === undefined ||
    !Array.isArray(value.screenAnswers) ||
    !Array.isArray(value.interviews) ||
    !Array.isArray(value.facts) ||
    !Array.isArray(value.activeDomains) ||
    !Array.isArray(value.saved) ||
    !Array.isArray(value.alreadyEnrolled)
  ) {
    return null;
  }

  const latestInterviewDomains = Array.isArray(value.latestInterviewDomains)
    ? value.latestInterviewDomains.filter(isDevNeedDomain)
    : [];

  return {
    profile,
    // Closed coercion, never a pass-through: an unrecognized stored value that
    // survived to here would fail isFamilyNavigatorState after sanitize and wipe
    // the whole app back to the demo, not just this slice.
    profileProvenance: value.profileProvenance === "extracted" ? "extracted" : "stated",
    referral: isFamilyReferral(value.referral) ? value.referral : null,
    appointments: Array.isArray(value.appointments)
      ? sanitizeFamilyAppointmentSupersedes(uniqueFamilyAppointments(value.appointments.filter(isFamilyAppointment)))
      : [],
    safetyEvents: Array.isArray(value.safetyEvents) ? value.safetyEvents.filter(isFamilySafetyEvent) : [],
    recommendations: sanitizeFamilyRecommendations(value.recommendations),
    interviewDraft: typeof value.interviewDraft === "string" ? value.interviewDraft : "",
    screenAnswers: value.screenAnswers.filter(isFamilyScreenAnswer),
    interviews: value.interviews
      .filter(isFamilyInterview)
      .map((interview) => ({ ...interview, kind: interview.kind ?? "orientation" })),
    facts: value.facts.filter(isFamilyFact),
    latestInterviewDomains: uniqueStrings(latestInterviewDomains),
    activeDomains: uniqueStrings(value.activeDomains.filter(isDevNeedDomain)),
    resourcePreferences: isFamilyResourcePreferences(value.resourcePreferences)
      ? value.resourcePreferences
      : DEFAULT_FAMILY_RESOURCE_PREFERENCES,
    saved: uniqueSavedFamilyResources(value.saved.filter(isSavedFamilyResource)),
    alreadyEnrolled: uniqueStrings(value.alreadyEnrolled.filter((entry): entry is string => typeof entry === "string")),
    steps: Array.isArray(value.steps) ? uniqueById(value.steps.filter(isFamilyResourceStep)) : [],
    pulses: Array.isArray(value.pulses) ? value.pulses.filter(isFamilyPulse) : [],
    probeAnswers: Array.isArray(value.probeAnswers)
      ? value.probeAnswers.filter(isFamilyCheckinProbeAnswer)
      : [],
    flags: Array.isArray(value.flags) ? uniqueById(value.flags.filter(isFamilyFlag)) : [],
    soonerList: isFamilySoonerList(value.soonerList) ? value.soonerList : null,
    packetQuestionIds: Array.isArray(value.packetQuestionIds)
      ? uniqueStrings(value.packetQuestionIds.filter((entry): entry is string => typeof entry === "string"))
      : [],
    checkinTouchedAt: isExactIsoTimestamp(value.checkinTouchedAt) ? value.checkinTouchedAt : null
  };
}

type PersistedAppState = Omit<
  AppState,
  | "tasks"
  | "mealLog"
  | "doseEvents"
  | "medicationFills"
  | "assessmentEvents"
  | "glucoseReadings"
  | "screeningGaps"
  | "screeningResults"
  | "referrals"
  | "recallReminders"
  | "family"
> & {
  tasks: unknown;
  mealLog: unknown;
  doseEvents: unknown;
  medicationFills: unknown;
  assessmentEvents: unknown;
  glucoseReadings: unknown;
  screeningGaps: unknown;
  screeningResults: unknown;
  referrals: unknown;
  recallReminders: unknown;
  family: unknown;
};

function sanitizeTasks(tasks: unknown): TaskItem[] {
  if (!Array.isArray(tasks)) {
    return [];
  }

  return tasks.filter(isTask);
}

function sanitizeMealLog(mealLog: unknown, patientId: string): MealLogEntry[] {
  if (!Array.isArray(mealLog)) {
    return [];
  }

  return mealLog.filter((entry): entry is MealLogEntry => isMealLogEntry(entry) && entry.patientId === patientId);
}

function sanitizeGlucoseReadings(glucoseReadings: unknown, patientId: string): GlucoseReading[] {
  if (!Array.isArray(glucoseReadings)) {
    return [];
  }

  return glucoseReadings.filter(
    (entry): entry is GlucoseReading => isGlucoseReading(entry) && entry.patientId === patientId
  );
}

function sanitizeDoseEvents(doseEvents: unknown, patientId: string, medicationIds: Set<string>): DoseEvent[] {
  if (!Array.isArray(doseEvents)) {
    return [];
  }

  return doseEvents.filter(
    (entry): entry is DoseEvent =>
      isDoseEvent(entry) && entry.patientId === patientId && medicationIds.has(entry.medicationId)
  );
}

function sanitizeMedicationFills(fills: unknown, patientId: string, medicationIds: Set<string>): MedicationFill[] {
  if (!Array.isArray(fills)) {
    return [];
  }

  return fills.filter(
    (entry): entry is MedicationFill =>
      isMedicationFill(entry) && entry.patientId === patientId && medicationIds.has(entry.medicationId)
  );
}

function sanitizeAssessmentEvents(events: unknown, patientId: string): AssessmentEvent[] {
  if (!Array.isArray(events)) {
    return [];
  }

  return events.filter(
    (entry): entry is AssessmentEvent => isAssessmentEvent(entry) && entry.patientId === patientId
  );
}

function sanitizeScreeningGaps(gaps: unknown): ScreeningGap[] {
  if (!Array.isArray(gaps)) {
    return [];
  }

  return gaps.filter(isScreeningGap);
}

function sanitizeScreeningResults(results: unknown, gapIds: Set<string>): ScreeningResult[] {
  if (!Array.isArray(results)) {
    return [];
  }

  return results.filter((entry): entry is ScreeningResult => isScreeningResult(entry) && gapIds.has(entry.gapId));
}

function sanitizeReferrals(referrals: unknown, resultIds: Set<string>): Referral[] {
  if (!Array.isArray(referrals)) {
    return [];
  }

  return referrals.filter((entry): entry is Referral => isReferral(entry) && resultIds.has(entry.resultId));
}

function sanitizeRecallReminders(reminders: unknown): RecallReminder[] {
  if (!Array.isArray(reminders)) {
    return [];
  }

  return reminders.filter(isRecallReminder);
}

function isValidCoreAppState(value: unknown): value is PersistedAppState {
  if (!isObject(value)) {
    return false;
  }

  if (!isPatient(value.patient)) {
    return false;
  }

  if (!isCarePlan(value.carePlan)) {
    return false;
  }

  if (!isDoseReminderPreference(value.doseReminder)) {
    return false;
  }

  if (
    !isArrayOfObjects(value.medications, isMedication) ||
    !isArrayOfObjects(value.readings, isReading) ||
    !isArrayOfObjects(value.contextItems, isContextItem) ||
    !isArrayOfObjects(value.extractedFacts, isExtractedFact) ||
    !isArrayOfObjects(value.aiMessages, isAiMessage) ||
    !isArrayOfObjects(value.auditEvents, isAuditEvent)
  ) {
    return false;
  }

  return hasValidRelationships(value as AppState);
}

function isValidAppState(value: unknown): value is AppState {
  if (!isValidCoreAppState(value)) {
    return false;
  }

  if (!Array.isArray(value.tasks) || !value.tasks.every(isTask)) {
    return false;
  }

  if (!Array.isArray(value.mealLog) || !value.mealLog.every(isMealLogEntry)) {
    return false;
  }

  if (!Array.isArray(value.glucoseReadings) || !value.glucoseReadings.every(isGlucoseReading)) {
    return false;
  }

  if (!Array.isArray(value.doseEvents) || !value.doseEvents.every(isDoseEvent)) {
    return false;
  }

  if (!Array.isArray(value.medicationFills) || !value.medicationFills.every(isMedicationFill)) {
    return false;
  }

  if (!Array.isArray(value.assessmentEvents) || !value.assessmentEvents.every(isAssessmentEvent)) {
    return false;
  }

  if (!Array.isArray(value.screeningGaps) || !value.screeningGaps.every(isScreeningGap)) {
    return false;
  }

  if (!Array.isArray(value.screeningResults) || !value.screeningResults.every(isScreeningResult)) {
    return false;
  }

  if (!Array.isArray(value.referrals) || !value.referrals.every(isReferral)) {
    return false;
  }

  return (
    Array.isArray(value.recallReminders) &&
    value.recallReminders.every(isRecallReminder) &&
    (value.family === null || isFamilyNavigatorState(value.family))
  );
}

export type StoredStateLoad = {
  state: AppState;
  status: "empty" | "loaded" | "migrated" | "recovered" | "unavailable" | "future_version";
  writable: boolean;
};

function recoverRejectedState(raw: string, reason: string): StoredStateLoad {
  if (!stashRejectedPayload(raw, reason)) {
    return { state: defaultDemoState, status: "unavailable", writable: false };
  }

  // A refused primary is deleted only after the byte-for-byte recovery copy is
  // durable. If deletion itself is blocked, keep both copies and disable
  // automatic writes so the original cannot be overwritten on hydration.
  const removed = safeRemoveItem(STORAGE_KEY);
  return { state: defaultDemoState, status: "recovered", writable: removed };
}

function encodedState(state: AppState): string {
  const durable = stripLadderSimulationState(state);
  return JSON.stringify(encodeAppStateRecord(durable as unknown as Record<string, unknown>));
}

export function loadStoredStateResult(): StoredStateLoad {
  if (typeof window === "undefined") {
    return { state: defaultDemoState, status: "unavailable", writable: false };
  }

  const read = readStorageItem(STORAGE_KEY);
  if (read.status === "unavailable") {
    return { state: defaultDemoState, status: "unavailable", writable: false };
  }
  const raw = read.value;
  if (!raw) {
    return { state: defaultDemoState, status: "empty", writable: true };
  }

  try {
    const decoded = decodeAppStateRecord(JSON.parse(raw) as unknown);
    if (decoded.status === "future_version") {
      stashRejectedPayload(raw, `unsupported storage schema ${decoded.schemaVersion}`);
      return { state: defaultDemoState, status: "future_version", writable: false };
    }
    if (decoded.status === "invalid_envelope") {
      return recoverRejectedState(raw, decoded.reason);
    }
    const parsed = decoded.state;
    if (isObject(parsed) && parsed.mealLog === undefined) {
      parsed.mealLog = [];
    }
    if (isObject(parsed) && parsed.doseEvents === undefined) {
      parsed.doseEvents = [];
    }
    if (isObject(parsed) && !isDoseReminderPreference(parsed.doseReminder)) {
      parsed.doseReminder = { ...DEFAULT_DOSE_REMINDER };
    }
    if (isObject(parsed) && parsed.medicationFills === undefined) {
      parsed.medicationFills = [];
    }
    if (isObject(parsed) && parsed.assessmentEvents === undefined) {
      parsed.assessmentEvents = [];
    }
    if (isObject(parsed) && parsed.glucoseReadings === undefined) {
      parsed.glucoseReadings = [];
    }
    if (isObject(parsed) && parsed.screeningGaps === undefined) {
      parsed.screeningGaps = [];
    }
    if (isObject(parsed) && parsed.screeningResults === undefined) {
      parsed.screeningResults = [];
    }
    if (isObject(parsed) && parsed.referrals === undefined) {
      parsed.referrals = [];
    }
    if (isObject(parsed) && parsed.recallReminders === undefined) {
      parsed.recallReminders = [];
    }
    if (isValidCoreAppState(parsed)) {
      const sanitizedTasks = sanitizeTasks(parsed.tasks);
      const sanitizedMealLog = sanitizeMealLog(parsed.mealLog, parsed.patient.id);
      const sanitizedGlucoseReadings = sanitizeGlucoseReadings(parsed.glucoseReadings, parsed.patient.id);
      const medicationIds = new Set(parsed.medications.map((medication) => medication.id));
      const sanitizedDoseEvents = sanitizeDoseEvents(parsed.doseEvents, parsed.patient.id, medicationIds);
      const sanitizedMedicationFills = sanitizeMedicationFills(parsed.medicationFills, parsed.patient.id, medicationIds);
      const sanitizedAssessmentEvents = sanitizeAssessmentEvents(parsed.assessmentEvents, parsed.patient.id);
      const sanitizedAiMessages = sanitizeAiMessageActions(parsed.aiMessages);
      const sanitizedScreeningGaps = sanitizeScreeningGaps(parsed.screeningGaps);
      const gapIds = new Set(sanitizedScreeningGaps.map((gap) => gap.id));
      const sanitizedScreeningResults = sanitizeScreeningResults(parsed.screeningResults, gapIds);
      const resultIds = new Set(sanitizedScreeningResults.map((result) => result.id));
      const sanitizedReferrals = sanitizeReferrals(parsed.referrals, resultIds);
      const sanitizedRecallReminders = sanitizeRecallReminders(parsed.recallReminders);
      const sanitizedFamily = sanitizeFamilyNavigatorState(parsed.family);
      const sanitizedState = stripLadderSimulationState({
        ...parsed,
        tasks: sanitizedTasks,
        mealLog: sanitizedMealLog,
        glucoseReadings: sanitizedGlucoseReadings,
        doseEvents: sanitizedDoseEvents,
        medicationFills: sanitizedMedicationFills,
        assessmentEvents: sanitizedAssessmentEvents,
        aiMessages: sanitizedAiMessages,
        screeningGaps: sanitizedScreeningGaps,
        screeningResults: sanitizedScreeningResults,
        referrals: sanitizedReferrals,
        recallReminders: sanitizedRecallReminders,
        family: sanitizedFamily
      } as AppState);

      if (!isValidAppState(sanitizedState)) {
        return recoverRejectedState(raw, "sanitized state still did not validate");
      }

      const changed =
        JSON.stringify(parsed.tasks) !== JSON.stringify(sanitizedState.tasks) ||
        JSON.stringify(parsed.mealLog) !== JSON.stringify(sanitizedState.mealLog) ||
        JSON.stringify(parsed.glucoseReadings) !== JSON.stringify(sanitizedState.glucoseReadings) ||
        JSON.stringify(parsed.doseEvents) !== JSON.stringify(sanitizedState.doseEvents) ||
        JSON.stringify(parsed.medicationFills) !== JSON.stringify(sanitizedState.medicationFills) ||
        JSON.stringify(parsed.assessmentEvents) !== JSON.stringify(sanitizedState.assessmentEvents) ||
        JSON.stringify(parsed.aiMessages) !== JSON.stringify(sanitizedState.aiMessages) ||
        JSON.stringify(parsed.screeningGaps) !== JSON.stringify(sanitizedState.screeningGaps) ||
        JSON.stringify(parsed.screeningResults) !== JSON.stringify(sanitizedState.screeningResults) ||
        JSON.stringify(parsed.referrals) !== JSON.stringify(sanitizedState.referrals) ||
        JSON.stringify(parsed.recallReminders) !== JSON.stringify(sanitizedState.recallReminders) ||
        JSON.stringify(parsed.family) !== JSON.stringify(sanitizedState.family);
      if (decoded.status === "legacy" || changed) {
        safeSetItem(STORAGE_KEY, encodedState(sanitizedState));
      }

      return {
        state: sanitizedState,
        status: decoded.status === "legacy" ? "migrated" : "loaded",
        writable: true
      };
    }

    return recoverRejectedState(raw, "not a recognizable app state");
  } catch {
    return recoverRejectedState(raw, "unparseable");
  }
}

export function loadStoredState(): AppState {
  return loadStoredStateResult().state;
}

export function saveStoredState(state: AppState, expectedDeletionFence?: number): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const encoded = encodedState(state);
  if (expectedDeletionFence !== undefined) {
    const before = readStoredDeletionFence();
    if (before.status === "unavailable" || before.value !== expectedDeletionFence) {
      return false;
    }
  }
  if (!safeSetItem(STORAGE_KEY, encoded)) return false;
  if (expectedDeletionFence === undefined) return true;

  // localStorage cannot provide a multi-key transaction. A post-write check
  // closes the only damaging interleaving: another tab clearing between our
  // generation check and state write. Deletion wins, so discard the write.
  const after = readStoredDeletionFence();
  if (after.status === "ok" && after.value === expectedDeletionFence) return true;
  safeRemoveItem(STORAGE_KEY);
  return false;
}

export type StoredStateClearResult =
  | { status: "cleared"; failedScopes: []; deletionFence?: number }
  | { status: "partial"; failedScopes: string[]; deletionFence?: number }
  | { status: "unavailable"; failedScopes: ["storage"]; deletionFence?: undefined };

export function clearStoredStateResult(): StoredStateClearResult {
  if (typeof window === "undefined") {
    return { status: "unavailable", failedScopes: ["storage"] };
  }

  const failedScopes: string[] = [];
  // Establish the cross-tab barrier before deleting anything. A tab that
  // loaded an older generation will refuse to write its stale snapshot back.
  const deletionFence = advanceStoredDeletionFence();
  if (deletionFence === null) failedScopes.push("deletion_fence");
  if (!safeRemoveItem(STORAGE_KEY)) failedScopes.push("app_state");
  // "Clear my data" has to mean it: a stashed payload is still the family's
  // record, so it goes with the rest.
  if (!safeRemoveItem(RECOVERY_KEY)) failedScopes.push("recovery");
  if (!clearAllFamilyDrafts()) failedScopes.push("family_drafts");
  try {
    const auxiliaryKeys = Array.from(
      { length: window.localStorage.length },
      (_, index) => window.localStorage.key(index)
    ).filter((key): key is string => key !== null);
    for (const key of auxiliaryKeys) {
      if (key.startsWith("ladder-visit-notice:") && !safeRemoveItem(key)) {
        failedScopes.push("visit_notices");
      }
      if (key.startsWith(DOSE_REMINDER_NOTIFICATION_PREFIX) && !safeRemoveItem(key)) {
        failedScopes.push("dose_reminder_notifications");
      }
    }
    if (!safeRemoveItem(FAMILY_CHECKIN_REMINDER_KEY)) {
      failedScopes.push("family_checkin_reminder");
    }
    if (!safeRemoveItem("home-health-voice-consent")) failedScopes.push("voice_consent");
  } catch {
    // Without enumeration, per-visit and per-medication keys cannot be proven
    // gone. Exact singleton keys below are still removed directly.
    failedScopes.push("visit_notices", "dose_reminder_notifications");
    if (!safeRemoveItem(FAMILY_CHECKIN_REMINDER_KEY)) {
      failedScopes.push("family_checkin_reminder");
    }
    if (!safeRemoveItem("home-health-voice-consent")) failedScopes.push("voice_consent");
  }
  try {
    const voiceConsentKeys = Array.from(
      { length: window.sessionStorage.length },
      (_, index) => window.sessionStorage.key(index)
    ).filter((key): key is string => key?.startsWith("home-health-voice-consent:v2:") === true);
    for (const key of voiceConsentKeys) window.sessionStorage.removeItem(key);
  } catch {
    // Session storage may be unavailable; current mounted controls still reset.
    failedScopes.push("session_voice_consent");
  }
  const uniqueFailures = [...new Set(failedScopes)];
  return uniqueFailures.length === 0
    ? { status: "cleared", failedScopes: [], deletionFence: deletionFence ?? undefined }
    : { status: "partial", failedScopes: uniqueFailures, deletionFence: deletionFence ?? undefined };
}

export function clearStoredState(): void {
  clearStoredStateResult();
}

// The first-run onboarding marker lives outside AppState (its own localStorage
// key), so it never participates in the reset-to-demo validation and a returning
// user is never bounced back into onboarding.
const ONBOARDING_COMPLETED_KEY = "home-health-onboarding-completed";

export function isOnboardingComplete(): boolean {
  return safeGetItem(ONBOARDING_COMPLETED_KEY) === "true";
}

export function markOnboardingComplete(): void {
  safeSetItem(ONBOARDING_COMPLETED_KEY, "true");
}
