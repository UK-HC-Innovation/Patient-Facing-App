import { defaultDemoState } from "@/domain/fixtures";
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
  FamilyEvidenceStatus,
  FamilyFact,
  FamilyInterview,
  FamilyNavigatorState,
  FamilyProfile,
  FamilyRecommendationItem,
  FamilyRecommendationSet,
  FamilyReferral,
  FamilyReminderOffset,
  FamilySafetyEvent,
  FamilyScreenAnswer,
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

const STORAGE_KEY = "home-health-ai-ownership-state";

function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
  }
}

function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
  }
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
      value.action === "referral_booked") &&
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
    (value.tier === "crisis" || value.tier === "emergency") &&
    hasString(value, "domain") &&
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

function isFamilyInterview(value: unknown): value is FamilyInterview {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "rawText") &&
    (value.source === "typed" || value.source === "voice" || value.source === "mixed") &&
    hasString(value, "createdAt") &&
    (value.extraction === "live" || value.extraction === "mock")
  );
}

function isFamilyEvidenceStatus(value: unknown): value is FamilyEvidenceStatus {
  return value === "patient_reported" || value === "inferred" || value === "confirmed";
}

function isFamilyFact(value: unknown): value is FamilyFact {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    (value.interviewId === undefined || typeof value.interviewId === "string") &&
    hasString(value, "label") &&
    hasString(value, "value") &&
    isFamilyEvidenceStatus(value.status) &&
    hasString(value, "sourceSnippet")
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
  "missed"
];

function isFamilyReferral(value: unknown): value is FamilyReferral {
  return isObject(value) && typeof value.clinic === "string" && typeof value.referredAt === "string";
}

function isFamilyAppointment(value: unknown): value is FamilyAppointment {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.clinic === "string" &&
    isArrayOfStrings(value.offeredSlots) &&
    (value.scheduledFor === undefined || typeof value.scheduledFor === "string") &&
    typeof value.status === "string" &&
    familyAppointmentStatuses.some((status) => status === value.status) &&
    Array.isArray(value.barriers) &&
    value.barriers.every((barrier) => familyAppointmentBarriers.some((known) => known === barrier)) &&
    typeof value.barriersAsked === "boolean" &&
    Array.isArray(value.reminderAcks) &&
    value.reminderAcks.every(
      (ack) =>
        isObject(ack) &&
        typeof ack.acknowledgedAt === "string" &&
        familyReminderOffsets.some((offset) => offset === ack.offset)
    ) &&
    typeof value.createdAt === "string"
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

function isFamilyNavigatorState(value: unknown): value is FamilyNavigatorState {
  // safetyEvents is optional here on purpose: a save written before it existed
  // must still validate, or an existing family slice would reset to the demo.
  // The sanitizer backfills it.
  return (
    isObject(value) &&
    (value.profile === null || sanitizeFamilyProfile(value.profile) !== undefined) &&
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
    isArrayOfObjects(value.saved, isSavedFamilyResource) &&
    isArrayOfStrings(value.alreadyEnrolled)
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
    referral: isFamilyReferral(value.referral) ? value.referral : null,
    appointments: Array.isArray(value.appointments) ? value.appointments.filter(isFamilyAppointment) : [],
    safetyEvents: Array.isArray(value.safetyEvents) ? value.safetyEvents.filter(isFamilySafetyEvent) : [],
    recommendations: sanitizeFamilyRecommendations(value.recommendations),
    interviewDraft: typeof value.interviewDraft === "string" ? value.interviewDraft : "",
    screenAnswers: value.screenAnswers.filter(isFamilyScreenAnswer),
    interviews: value.interviews.filter(isFamilyInterview),
    facts: value.facts.filter(isFamilyFact),
    latestInterviewDomains: uniqueStrings(latestInterviewDomains),
    activeDomains: uniqueStrings(value.activeDomains.filter(isDevNeedDomain)),
    saved: uniqueSavedFamilyResources(value.saved.filter(isSavedFamilyResource)),
    alreadyEnrolled: uniqueStrings(value.alreadyEnrolled.filter((entry): entry is string => typeof entry === "string"))
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

export function loadStoredState(): AppState {
  if (typeof window === "undefined") {
    return defaultDemoState;
  }

  const raw = safeGetItem(STORAGE_KEY);
  if (!raw) {
    return defaultDemoState;
  }

  try {
    const parsed = JSON.parse(raw);
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
      const sanitizedState: AppState = {
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
      };

      if (!isValidAppState(sanitizedState)) {
        safeRemoveItem(STORAGE_KEY);
        return defaultDemoState;
      }

      if (
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
        JSON.stringify(parsed.family) !== JSON.stringify(sanitizedState.family)
      ) {
        safeSetItem(STORAGE_KEY, JSON.stringify(sanitizedState));
      }

      return sanitizedState;
    }

    safeRemoveItem(STORAGE_KEY);
    return defaultDemoState;
  } catch {
    safeRemoveItem(STORAGE_KEY);
    return defaultDemoState;
  }
}

export function saveStoredState(state: AppState): void {
  if (typeof window === "undefined") {
    return;
  }

  safeSetItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearStoredState(): void {
  if (typeof window === "undefined") {
    return;
  }

  safeRemoveItem(STORAGE_KEY);
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
