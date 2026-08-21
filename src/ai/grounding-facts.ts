import { activeConditions } from "@/domain/condition-lens";
import { gradeStringKey } from "@/domain/dr-triage";
import { buildMealDigest, MEAL_DIGEST_SOURCE_ID } from "@/domain/food-week";
import type { SourceFact } from "@/domain/grounding";
import { tScreening } from "@/i18n/strings";
import type { AppState } from "@/domain/types";

// Builds the grounding source-fact set from on-device state. Every fact id is an
// existing app source id (the same id set as storage's getKnownSourceIds), so a
// provider response's `sources` array doubles as the grounding `citationIds`.
export function collectSourceFacts(state: AppState): SourceFact[] {
  const facts: SourceFact[] = [];
  const plan = state.carePlan;
  const clinicName = state.patient.primaryClinicName;

  const thresholdText =
    plan.callThresholdSystolic !== null && plan.callThresholdDiastolic !== null
      ? ` Call threshold ${plan.callThresholdSystolic}/${plan.callThresholdDiastolic}.`
      : "";

  facts.push({
    id: plan.id,
    label: "Care plan",
    value: `${plan.plainLanguageSummary}${thresholdText} Condition: ${activeConditions(plan).join(" + ")}.`,
    sourceKind: "care_plan",
    sourceName: clinicName,
    confidence: plan.thresholdSource === "clinician_authored" ? "confirmed" : "inferred",
    patientConfirmed: false,
    effectiveDate: ""
  });

  plan.goals.forEach((goal) => {
    facts.push({
      id: goal.id,
      label: goal.label,
      value: `${goal.label}. ${goal.reason}`,
      sourceKind: "goal",
      sourceName: clinicName,
      confidence: "inferred",
      patientConfirmed: false,
      effectiveDate: ""
    });
  });

  state.medications.forEach((medication) => {
    facts.push({
      id: medication.id,
      label: medication.name,
      value: `${medication.name} ${medication.dose} ${medication.schedule}. ${medication.purpose}`,
      sourceKind: "medication",
      sourceName: clinicName,
      confidence: medication.source,
      patientConfirmed: medication.source === "confirmed",
      effectiveDate: ""
    });
  });

  state.readings.forEach((reading) => {
    facts.push({
      id: reading.id,
      label: "Home reading",
      value: `${reading.systolic}/${reading.diastolic}`,
      sourceKind: "reading",
      sourceName: "Home monitor",
      confidence: "patient_reported",
      patientConfirmed: true,
      effectiveDate: reading.measuredAt
    });
  });

  state.glucoseReadings.forEach((reading) => {
    facts.push({
      id: reading.id,
      label: "Home glucose",
      value: `${reading.valueMgDl} mg/dL`,
      sourceKind: "reading",
      sourceName: "Home monitor",
      confidence: "patient_reported",
      patientConfirmed: true,
      effectiveDate: reading.measuredAt
    });
  });

  state.contextItems.forEach((item) => {
    facts.push({
      id: item.id,
      label: item.title,
      value: item.rawText,
      sourceKind: "context_item",
      sourceName: item.sourceLabel,
      confidence: "imported",
      patientConfirmed: false,
      effectiveDate: item.createdAt
    });
  });

  state.extractedFacts.forEach((fact) => {
    facts.push({
      id: fact.id,
      label: fact.label,
      value: fact.value,
      sourceKind: "extracted_fact",
      sourceName: "Extracted from care context",
      confidence: fact.status,
      patientConfirmed: fact.status === "confirmed",
      effectiveDate: ""
    });
  });

  const mealDigest = buildMealDigest(state);
  if (mealDigest) {
    facts.push({
      id: MEAL_DIGEST_SOURCE_ID,
      label: "Recent meal log",
      value: mealDigest,
      sourceKind: "meal_log",
      sourceName: "Patient food log",
      confidence: "inferred",
      patientConfirmed: true,
      effectiveDate: ""
    });
  }

  // Confirmed screening results ground "what did my eye report say?" — the
  // fact value is the LOCKED plain-language copy, so the coach can only ever
  // repeat what the report said, never re-grade it.
  state.screeningResults.forEach((result) => {
    const gradeCopy = tScreening(
      state.patient.language,
      gradeStringKey({ grade: result.grade, dmePresent: result.dmePresent, ungradable: result.outcome === "ungradable" })
    );
    facts.push({
      id: result.id,
      label: "Eye screening report",
      value: gradeCopy,
      sourceKind: "screening_result",
      sourceName: "Screening report — confirmed by you",
      confidence: "confirmed",
      patientConfirmed: true,
      effectiveDate: result.confirmedAt
    });
  });

  return facts;
}

// Citation ids a text Coach answer may lean on: the care plan plus the most
// recent glucose reading, blood-pressure reading, and confirmed screening
// result. A live provider returns these as its `sources`, which the safety
// gate passes to verifyGrounding as citationIds, so a grounded blood-sugar or
// eye-report answer can name a real record.
export function coachCitations(state: AppState): string[] {
  const latest = <T extends { measuredAt: string; id: string }>(items: T[]): string | null =>
    items.length === 0 ? null : [...items].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)).at(-1)!.id;
  const latestScreening = state.screeningResults.at(-1)?.id ?? null;
  const mealDigestId = buildMealDigest(state) ? MEAL_DIGEST_SOURCE_ID : null;
  return [state.carePlan.id, latest(state.glucoseReadings), latest(state.readings), latestScreening, mealDigestId].filter(
    (id): id is string => id !== null
  );
}
