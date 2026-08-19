import type { AssessmentEvent } from "./assessment";

export type EvidenceStatus = "confirmed" | "patient_reported" | "imported" | "inferred" | "needs_review";
export type ThresholdSource = "clinician_authored" | "standard_education";

export type AccessibilityPreference =
  | "read_aloud"
  | "large_text"
  | "screen_reader"
  | "high_contrast"
  | "keyboard_navigation";

export type PatientProfile = {
  id: string;
  name: string;
  preferredName: string;
  language: "en" | "es";
  primaryClinicName: string;
  primaryClinicPhone: string;
  county?: string;
  accessibilityPreferences?: AccessibilityPreference[];
};

export type CareGoal = {
  id: string;
  label: string;
  reason: string;
};

export type Condition = "hypertension" | "diabetes" | "obesity";

export type CarePlan = {
  id: string;
  patientId: string;
  condition: Condition;
  conditions?: Condition[];
  plainLanguageSummary: string;
  goals: CareGoal[];
  dailyActions: string[];
  callThresholdSystolic: number | null;
  callThresholdDiastolic: number | null;
  callThresholdGlucoseLow?: number | null;
  callThresholdGlucoseHigh?: number | null;
  thresholdSource: ThresholdSource;
  warningSymptoms: string[];
  nextVisitReason: string;
};

export type MedicationBarrier =
  | "forgot"
  | "ran_out"
  | "cost"
  | "side_effects"
  | "confused"
  | "scared"
  | "pharmacy_issue"
  | "does_not_feel_necessary";

export type Medication = {
  id: string;
  patientId: string;
  name: string;
  dose: string;
  schedule: string;
  purpose: string;
  preventionBenefit: string;
  safetyNote: string;
  source: EvidenceStatus;
  activeBarriers: MedicationBarrier[];
};

export type MeasurementContext = "morning" | "evening" | "before_medicine" | "after_medicine" | "after_coffee" | "after_resting" | "during_symptoms";

export type HomeReading = {
  id: string;
  patientId: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  measuredAt: string;
  contexts: MeasurementContext[];
  note: string;
};

export type GlucoseReading = {
  id: string;
  patientId: string;
  valueMgDl: number;
  measuredAt: string;
  contexts: MeasurementContext[];
  note: string;
};

export type TaskItem = {
  id: string;
  title: string;
  body: string;
  href: string;
  priority: 1 | 2 | 3;
  kind: "reading" | "medicine" | "visit" | "intake" | "privacy" | "checkin";
  status: "confirmed" | "inferred" | "needs_review";
};

export type CareContextItem = {
  id: string;
  patientId: string;
  title: string;
  rawText: string;
  sourceLabel: string;
  createdAt: string;
};

export type ExtractedFact = {
  id: string;
  contextItemId: string;
  label: string;
  value: string;
  confidence: "high" | "medium" | "low";
  status: EvidenceStatus;
  sourceSnippet: string;
};

export type AiMode = "explain" | "today" | "why" | "ask" | "trouble" | "visit" | "summarize" | "food";

export type AiMessageAction =
  | "call_clinic"
  | "draft_message"
  | "crisis_call_988"
  | "crisis_text_988"
  | "call_emergency"
  | "safety_plan";

export type SafetyLevel = "allowed" | "escalate" | "blocked" | "crisis";

export type AiMessage = {
  id: string;
  mode: AiMode;
  role: "patient" | "assistant";
  content: string;
  createdAt: string;
  safety: SafetyLevel;
  sources: string[];
  banner?: string;
  actions?: AiMessageAction[];
  acknowledged?: boolean;
};

export type HealthBrief = {
  id: string;
  patientId: string;
  generatedAt: string;
  sections: Array<{
    title: string;
    items: string[];
    status: EvidenceStatus;
  }>;
};

export type AuditEvent = {
  id: string;
  patientId: string;
  action:
    | "created"
    | "updated"
    | "ai_generated"
    | "shared"
    | "exported"
    | "deleted"
    | "crisis_escalated"
    | "assessment_recorded"
    | "screening_scheduled"
    | "screening_result_confirmed"
    | "referral_placed"
    | "referral_escalated"
    | "recall_scheduled"
    | "referral_booked"
    | "voice_consent_granted"
    | "voice_session_started"
    | "family_ai_send_attempted";
  label: string;
  createdAt: string;
};

// Numeric basis of the amounts below. Sources disagree: OpenFoodFacts and the demo
// seed report per declared serving, USDA FDC reports per 100 g. Anything derived per
// 100 kcal (nutrient ratios, %-energy gates) is basis-invariant, but calorie density
// is not -- it needs either basis "per_100g" or a known servingGrams.
export type NutritionBasis = "per_serving" | "per_100g";

// null means "the source did not report this", never zero. The single documented
// exception is `(transFatG ?? 0)` inside the unsaturated-fat subtraction fallback in
// the Food Compass engine, where a missing trans figure is negligible by construction.
export type NutritionFacts = {
  servingSize: string;
  servingGrams: number | null;
  basis: NutritionBasis;
  calories: number | null;
  sodiumMg: number | null;
  potassiumMg: number | null;
  totalSugarsG: number | null;
  addedSugarsG: number | null;
  saturatedFatG: number | null;
  fiberG: number | null;
  proteinG: number | null;
  carbsG: number | null;
  totalFatG: number | null;
  monoFatG: number | null;
  polyFatG: number | null;
  transFatG: number | null;
  cholesterolMg: number | null;
  calciumMg: number | null;
  ironMg: number | null;
};

export type FoodSource = "barcode_off" | "barcode_fdc" | "barcode_seed" | "vision_estimate" | "fndds_lookup";

export type IdentifiedFood = {
  id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  nutrition: NutritionFacts | null;
  source: FoodSource;
  ingredientText: string | null;
};

export type MealLogEntry = {
  id: string;
  patientId: string;
  loggedAt: string;
  food: IdentifiedFood;
  flags: string[];
  assistantSummary: string;
  // Added by spec 23. Optional and migration-safe: absent on every entry logged before it.
  compassScore?: {
    fcs: number;
    band: "encourage" | "moderate" | "minimize";
    tier: "T1" | "T2";
  };
};

// A condition-tailored recipe suggested from what the camera sees in the pantry.
export type PantryRecipe = {
  title: string;
  whyItFits: string;
  haveItems: string[];
  buyItems: string[];
  watchOut: string | null;
};

export type PantryResult = {
  detectedItems: string[];
  recipes: PantryRecipe[];
};

export type DoseStatus = "taken" | "skipped";

export type DoseEvent = {
  id: string;
  patientId: string;
  medicationId: string;
  date: string;
  status: DoseStatus;
  barrier: MedicationBarrier | null;
  recordedAt: string;
};

export type ReminderPermission = "default" | "granted" | "denied" | "unsupported";

export type DoseReminderPreference = {
  enabled: boolean;
  timeLocal: string;
  weekends: boolean;
  permission: ReminderPermission;
};

export type MedicationFill = {
  id: string;
  patientId: string;
  medicationId: string;
  medicationName: string;
  dateOfService: string;
  daysSupply: number;
  source: EvidenceStatus;
};

export type DrGrade = "no_dr" | "mild_npdr" | "moderate_npdr" | "severe_npdr" | "pdr";
export type ReferralTier = "none" | "optometry_routine" | "retina_urgent";
export type ReferralStage = "drafted" | "sent" | "clinic_confirmed" | "scheduled" | "completed" | "stalled";
export type ScreeningGapStatus = "overdue" | "engaged" | "scheduled" | "completed" | "closed" | "referral" | "repeat";
export type ScreeningOutcome = "normal" | "abnormal" | "ungradable";
export type ResultCaptureSource = "photo_report" | "typed_entry";
export type ExtractionRefusal = "not_a_report" | "retinal_photograph" | "unreadable";

export type ScreeningVenueType = "fqhc" | "mobile_clinic" | "community_camera" | "eye_clinic" | "kroger" | "pharmacy" | "primary_care";

export type ScreeningSite = {
  id: string; name: string; type: ScreeningVenueType; zip: string; city: string;
  lat: number; lng: number; nextAvailable: string; nextAvailableHours: number;
  rideSupport: boolean; lowCost: boolean;
};

export type ReferralDestination = {
  id: string; name: string; kind: "optometry" | "retina"; city: string; distanceMiles: number;
  phone: string; nextSlots: string[]; coverageNote: string;
};

export type DrReportExtraction = {
  grade: DrGrade | null; dmePresent: boolean | null; ungradable: boolean;
  confidence: "high" | "medium" | "low"; fieldsRead: string[]; refusal?: ExtractionRefusal;
};

export type ScreeningGap = {
  id: string; condition: "diabetes"; status: ScreeningGapStatus;
  lastScreeningDate: string | null; scheduledSiteId?: string; scheduledFor?: string;
};

export type ScreeningResult = {
  id: string; gapId: string; outcome: ScreeningOutcome; grade: DrGrade | null;
  dmePresent: boolean | null; source: ResultCaptureSource; reportRef: string;
  confirmedAt: string;
};

export type ReferralStageEntry = { stage: ReferralStage; at: string; note: string };

export type Referral = {
  id: string; resultId: string; tier: ReferralTier; destinationId: string;
  stageHistory: ReferralStageEntry[]; sentAt: string; scheduledFor?: string;
};

export type RecallReminder = {
  id: string; dueAt: string; reason: "annual_rescreen" | "annual_rescreen_mild";
};

export type DevDiagnosis =
  | "autism"
  | "adhd"
  | "dyslexia"
  | "speech_language"
  | "developmental_delay"
  | "intellectual_disability"
  | "down_syndrome"
  | "other";

export type DevNeedDomain =
  | "early_intervention"
  | "therapies"
  | "school_iep"
  | "waivers_financial"
  | "respite"
  | "parent_support"
  | "sibling_support"
  | "transportation"
  | "future_planning"
  | "diagnosis_education"
  | "recreation";

export type ChildDiagnosis = {
  id: string;
  label: DevDiagnosis;
  otherLabel?: string;
  diagnosedAt?: string;
};

export type FamilyProfile = {
  childFirstName?: string;
  birthYear: number;
  birthMonth?: number;
  schoolStage: "not_school_age" | "preschool" | "elementary" | "middle" | "high" | "post_high";
  county: string;
  diagnoses: ChildDiagnosis[];
};

/**
 * Where the child basics came from. "extracted" means the app read them out of
 * the caregiver's own description and applied them without asking — so the
 * surfaces that quote those basics say so until a person confirms them.
 */
export type FamilyProfileProvenance = "stated" | "extracted";

export type FamilyScreenAnswer = {
  questionId: string;
  domain: DevNeedDomain;
  response: "yes" | "no" | "declined";
};

export type FamilyInterview = {
  id: string;
  rawText: string;
  source: "typed" | "voice" | "mixed";
  createdAt: string;
  extraction: "live" | "mock";
  /** Journal grouping + engagement metrics. Saves written before this existed backfill to "orientation". */
  kind: "orientation" | "note" | "checkin";
};

/**
 * "rejected" is the caregiver saying "you misheard me" — a different act from
 * unticking the packet checkbox, which says "don't send this". It is family-only
 * and additive: a fact saved before it existed hydrates unchanged, and nothing
 * about it deletes the family's words (FR-3).
 */
export type FamilyEvidenceStatus =
  | Extract<EvidenceStatus, "patient_reported" | "inferred" | "confirmed">
  | "rejected";

export type FamilyFact = {
  id: string;
  interviewId?: string;
  label: string;
  value: string;
  status: FamilyEvidenceStatus;
  sourceSnippet: string;
  /** Non-destructive curation for the visit packet. Absent means included. */
  includeInSummary?: boolean;
};

export type SavedFamilyResource = {
  resourceId: string;
  savedAt: string;
  domain: DevNeedDomain;
};

export type FamilyReferral = {
  clinic: string;
  referredAt: string;
};

export type FamilyAppointmentBarrier = "ride" | "sibling_care" | "work_schedule" | "none";

export type FamilyReminderOffset = "t14" | "t3" | "t1";

export type FamilyAppointmentReminderAck = {
  offset: FamilyReminderOffset;
  acknowledgedAt: string;
};

// `replaced` is the earlier-visit outcome: the family took a cancellation
// backfill, so the time they were holding went back to the clinic.
export type FamilyAppointmentStatus =
  | "offered"
  | "booked"
  | "confirmed"
  | "completed"
  | "missed"
  | "replaced";

// One evaluation visit at the developmental-peds clinic. Missed visits are
// terminal; recovery appends a fresh appointment rather than mutating history.
export type FamilyAppointment = {
  id: string;
  clinic: string;
  offeredSlots: string[];
  scheduledFor?: string;
  status: FamilyAppointmentStatus;
  barriers: FamilyAppointmentBarrier[];
  barriersAsked: boolean;
  reminderAcks: FamilyAppointmentReminderAck[];
  createdAt: string;
  /**
   * Set only on a cancellation backfill: the booking this offer would replace.
   * Booking it retires that appointment in the same step, so there is never a
   * second live booking to mis-render as a time the family still holds.
   * Declining leaves the named booking exactly where it was.
   */
  supersedesId?: string;
};

// A safety disclosure inside the family thread. The navigator shows the standard
// crisis resources and keeps helping — this record is what holds the banner open
// (and every voice mic closed) until the caregiver acknowledges it.
export type FamilySafetyGuidance =
  | "missing_child"
  | "medication_access"
  | "basic_needs"
  | "basic_needs_and_medication_access";

export type FamilySafetyEvent = {
  id: string;
  tier: "crisis" | "emergency" | "blocked";
  domain: string;
  guidance?: FamilySafetyGuidance;
  createdAt: string;
  acknowledgedAt?: string;
};

export type FamilyRecommendationItem = {
  resourceId: string;
  /** Grounded "why this, for you" line. Absent when the model's failed the lint. */
  why?: string;
  /** Verbatim caregiver words, re-checked against the transcript at render. */
  becauseYouSaid?: string;
  urgency: "act_now" | "soon" | "when_ready";
};

export type FamilyRecommendationSet = {
  /** Stale once a newer interview lands; the deterministic order renders instead. */
  interviewId: string;
  createdAt: string;
  extraction: "live" | "mock";
  heard: string;
  lead: DevNeedDomain;
  items: FamilyRecommendationItem[];
};

export type FamilyStepStatus = "planned" | "tried" | "in_touch" | "enrolled" | "not_for_us";

// A resource the caregiver committed to. `enrolled` is kept in sync with
// `alreadyEnrolled` so matching exclusion keeps working from either entry path.
export type FamilyResourceStep = {
  id: string;
  resourceId: string;
  domain: DevNeedDomain;
  status: FamilyStepStatus;
  plannedAt: string;
  updatedAt: string;
};

/** One-question experience pulse taken at check-in. Never gates anything. */
export type FamilyPulse = { at: string; score: 1 | 2 | 3 | 4 | 5 };

// The clinic-now tier: informational, acknowledge-to-dismiss, never a crisis lock.
/**
 * F8.3. The skill-loss probe's third answer. "Not sure" used to record nothing
 * at all — it swapped in the CDC examples, and a Skip after it stamped a touch
 * that reset the 30-day clock with no signal kept. A "no" was also unrecorded.
 * Optional so every save written before it hydrates unchanged.
 */
export type FamilyCheckinProbeAnswer = {
  at: string;
  answer: "no" | "yes" | "unsure";
};

export type FamilyFlag = {
  id: string;
  type: "regression";
  source: "probe" | "text";
  raisedAt: string;
  acknowledgedAt?: string;
  /**
   * The submission whose words raised it, when words did. Rejecting every fact
   * that submission produced withdraws the packet line this flag prints — the
   * caregiver's only way back out of "possible loss of skills". Absent on probe
   * flags (nobody wrote anything) and on flags saved before this existed.
   */
  interviewId?: string;
};

export type FamilySoonerConstraint =
  | "weekday_mornings"
  | "weekday_afternoons"
  | "any_weekday"
  | "needs_notice";

export type FamilySoonerList = { optedInAt: string; constraints: FamilySoonerConstraint[] };

export type FamilyResourcePreferences = {
  scope: "no_preference" | "local_first" | "statewide_first";
  contact: "no_preference" | "self_serve_first" | "call_first" | "school_or_provider_first";
};

export type FamilyNavigatorState = {
  profile: FamilyProfile | null;
  /**
   * Where `profile` came from. Saves written before this existed backfill to
   * "stated". Lives on the slice, not on FamilyProfile, so a provenance flip
   * never perturbs `recommendationProfileIdentity` and re-runs ranking.
   */
  profileProvenance: FamilyProfileProvenance;
  referral: FamilyReferral | null;
  appointments: FamilyAppointment[];
  safetyEvents: FamilySafetyEvent[];
  recommendations: FamilyRecommendationSet | null;
  interviewDraft: string;
  screenAnswers: FamilyScreenAnswer[];
  interviews: FamilyInterview[];
  facts: FamilyFact[];
  latestInterviewDomains: DevNeedDomain[];
  activeDomains: DevNeedDomain[];
  /** Optional local-only soft ordering; never sent to the recommendation API. */
  resourcePreferences: FamilyResourcePreferences;
  saved: SavedFamilyResource[];
  alreadyEnrolled: string[];
  steps: FamilyResourceStep[];
  pulses: FamilyPulse[];
  flags: FamilyFlag[];
  soonerList: FamilySoonerList | null;
  /** Every answer to the monthly check-in's skill-loss probe, including "not sure". */
  probeAnswers?: FamilyCheckinProbeAnswer[];
  /** Starter-question ids picked for the visit packet. */
  packetQuestionIds: string[];
  /**
   * Last time the monthly check-in was answered or skipped. A skip has nothing
   * honest to store as data, but due-ness still has to reset — so it stamps here
   * instead of inventing a pulse or a note.
   */
  checkinTouchedAt: string | null;
};

export type AppState = {
  patient: PatientProfile;
  carePlan: CarePlan;
  medications: Medication[];
  readings: HomeReading[];
  glucoseReadings: GlucoseReading[];
  tasks: TaskItem[];
  contextItems: CareContextItem[];
  extractedFacts: ExtractedFact[];
  aiMessages: AiMessage[];
  auditEvents: AuditEvent[];
  mealLog: MealLogEntry[];
  doseEvents: DoseEvent[];
  doseReminder: DoseReminderPreference;
  medicationFills: MedicationFill[];
  assessmentEvents: AssessmentEvent[];
  screeningGaps: ScreeningGap[];
  screeningResults: ScreeningResult[];
  referrals: Referral[];
  recallReminders: RecallReminder[];
  family: FamilyNavigatorState | null;
};
