import { summarizeGlucoseTrend } from "./adherence";
import { activeConditions, selectLenses } from "./condition-lens";
import { summarizeFoodGlucoseLink, summarizeScoreGlucoseLink } from "./glucose-correlation";
import { summarizeFoodWindow } from "./food-week";
import { computeTimeInRange } from "./glucose-range";
import { getPdcToDate } from "./medication-fills";
import { screeningLens, screeningLensLine } from "./screening-status";
import { dueInstruments } from "./instruments/due";
import { getInstrument, INSTRUMENTS } from "./instruments/registry";
import type { AppState, EvidenceStatus, HealthBrief } from "./types";

type HealthBriefBuildOptions = {
  generatedAt?: string;
};

type BriefSection = HealthBrief["sections"][number];

function humanizeBarrier(barrier: string): string {
  return barrier.replace(/_/g, " ");
}

// The recent blood-sugar picture: latest value, time-in-range over the trailing
// window, and the plain-language trend. Omitted entirely when there are no
// glucose readings so a hypertension-only brief is unchanged.
function bloodSugarSection(state: AppState): BriefSection | null {
  const readings = state.glucoseReadings;
  if (readings.length === 0) {
    return null;
  }
  const latest = readings[readings.length - 1];
  const items = [`Latest: ${latest.valueMgDl} mg/dL on ${latest.measuredAt.slice(0, 10)}.`];
  const timeInRange = computeTimeInRange(readings);
  if (timeInRange) {
    items.push(
      `${timeInRange.inRange} of your last ${timeInRange.total} blood-sugar readings were in the ${timeInRange.low}–${timeInRange.high} range (${timeInRange.percentInRange}%). This is general education, not a diagnosis.`
    );
  }
  const trend = summarizeGlucoseTrend(readings);
  if (trend) {
    items.push(trend.message);
  }
  return { title: "Recent blood sugar", items, status: "patient_reported" };
}

// The deterministic food<->glucose observation, when the patient's own logs
// carry enough paired data. Omitted when null (below the sample or delta floor).
function foodPatternSection(state: AppState): BriefSection | null {
  const lens = selectLenses(activeConditions(state.carePlan));
  const carbInsight = summarizeFoodGlucoseLink(state.mealLog, state.glucoseReadings, lens);
  const scoreInsight = summarizeScoreGlucoseLink(state.mealLog, state.glucoseReadings, {
    language: state.patient.language
  });
  if (!carbInsight && !scoreInsight) {
    return null;
  }
  return {
    title: "Food & blood-sugar pattern",
    items: [carbInsight?.message, scoreInsight?.message].filter((item): item is string => Boolean(item)),
    status: "inferred"
  };
}

export function whatIveBeenEatingSection(state: AppState, asOf: Date): BriefSection | null {
  const summary = summarizeFoodWindow(state.mealLog, asOf, 14);
  if (summary.meals < 5) {
    return null;
  }

  const items = [`Meals logged: ${summary.meals} grouped meals in the last 14 days.`];
  if (summary.avgFcs !== null) {
    items.push(
      `Average Food Compass score across ${summary.scoredItems} scored items: ${summary.avgFcs} (T1 published: ${summary.tierCounts.T1}; T2 label estimates: ${summary.tierCounts.T2}). Grouped-meal band mix: encourage ${summary.bandCounts.encourage}, moderate ${summary.bandCounts.moderate}, minimize ${summary.bandCounts.minimize}.`
    );
  }
  if (summary.mostRepeatedMinimize) {
    items.push(
      `Most repeated minimize-band food: ${summary.mostRepeatedMinimize.text} (${summary.mostRepeatedMinimize.count} logged items).`
    );
  }
  if (summary.topFlags.length > 0) {
    items.push(
      `Most common food flags: ${summary.topFlags
        .slice(0, 3)
        .map((flag) => `${flag.text} (${flag.count}x)`)
        .join("; ")}.`
    );
  }
  return { title: "What I've been eating", items, status: "inferred" };
}

// Provider-legible adherence: refill-based diabetes coverage (the honest PDC
// estimate the app already computes) plus what the patient logged. Omitted when
// there is neither refill history nor a logged dose.
function adherenceSection(state: AppState, asOf: Date): BriefSection | null {
  const items: string[] = [];
  const pdc = getPdcToDate(state, asOf);
  if (pdc && pdc.eligible) {
    items.push(
      `Diabetes medicine coverage: about ${pdc.pdcPercent}% of days covered so far this year (goal ${pdc.thresholdPercent}%+). Estimated from the refills you logged.`
    );
  }
  const doseEvents = state.doseEvents;
  if (doseEvents.length > 0) {
    const taken = doseEvents.filter((event) => event.status === "taken").length;
    items.push(`From the doses you logged, ${taken} of ${doseEvents.length} were marked taken.`);
    const barriers = [
      ...new Set(
        doseEvents
          .filter((event) => event.status === "skipped" && event.barrier !== null)
          .map((event) => humanizeBarrier(event.barrier as string))
      )
    ];
    if (barriers.length > 0) {
      items.push(`Reasons noted for missed doses: ${barriers.join(", ")}.`);
    }
  }
  if (items.length === 0) {
    return null;
  }
  return { title: "Taking my medicines", items, status: "patient_reported" };
}

// One honest line on where the diabetic eye-screening loop stands, reusing the
// condition-lens helper (grounding-safe, en/es). Null when diabetes is not
// active or there is nothing to say.
function eyeScreeningSection(state: AppState, asOf: Date): BriefSection | null {
  const lens = screeningLens(state, asOf);
  if (!lens) {
    return null;
  }
  return { title: "Eye screening", items: [screeningLensLine(lens, state.patient.language)], status: "inferred" };
}

export function screeningsSection(state: AppState, asOf: Date): BriefSection | null {
  const asOfMs = asOf.valueOf();
  if (Number.isNaN(asOfMs)) {
    return null;
  }
  const latestByInstrument = new Map<string, { event: AppState["assessmentEvents"][number]; recordedAtMs: number }>();
  for (const event of state.assessmentEvents) {
    const instrument = getInstrument(event.instrumentId);
    const recordedAtMs = new Date(event.recordedAt).valueOf();
    if (
      !instrument ||
      instrument.licenseStatus !== "clear" ||
      Number.isNaN(recordedAtMs) ||
      recordedAtMs > asOfMs ||
      !Number.isFinite(event.totalScore) ||
      !instrument.bands.includes(event.severityBand)
    ) {
      continue;
    }
    const current = latestByInstrument.get(event.instrumentId);
    if (!current || recordedAtMs > current.recordedAtMs) {
      latestByInstrument.set(event.instrumentId, { event, recordedAtMs });
    }
  }
  if (latestByInstrument.size === 0) {
    return null;
  }

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
  const items = Object.values(INSTRUMENTS).flatMap((instrument) => {
    const latest = latestByInstrument.get(instrument.id);
    if (!latest) {
      return [];
    }
    const label = instrument.briefLabel?.en ?? instrument.title.en;
    const band = latest.event.severityBand.replaceAll("_", " ");
    return [
      `${label}: ${latest.event.totalScore} — ${band} — ${dateFormatter.format(new Date(latest.recordedAtMs))}, patient-reported.`
    ];
  });
  const dueCount = dueInstruments(state, asOf).length;
  items.push(`App-derived due summary: ${dueCount} check-in${dueCount === 1 ? "" : "s"} due.`);

  return { title: "Check-ins and screenings", items, status: "patient_reported" };
}

export function buildHealthBrief(state: AppState, options: HealthBriefBuildOptions = {}): HealthBrief {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const asOf = options.generatedAt ? new Date(options.generatedAt) : new Date();
  const recentReadings = state.readings.slice(-7).map(
    (reading) =>
      `${reading.systolic}/${reading.diastolic}${reading.pulse ? ` pulse ${reading.pulse}` : ""}`
  );
  const medicationItems = state.medications.map((medication) => {
    const barrierText =
      medication.activeBarriers.length > 0 ? ` Barriers: ${medication.activeBarriers.join(", ")}.` : " No barriers marked.";
    return `${medication.name} ${medication.dose} ${medication.schedule}.${barrierText}`;
  });
  const hasMedicines = medicationItems.length > 0;
  const medicineItems = hasMedicines
    ? medicationItems
    : ["No medicines are listed yet. Add them so your care team can review everything you take."];
  const confirmedInstructions = state.extractedFacts.filter((fact) => fact.status === "confirmed").map((fact) => fact.value);
  const { carePlan } = state;
  const callThresholdParts = [
    carePlan.callThresholdSystolic !== null ? `${carePlan.callThresholdSystolic} systolic` : null,
    carePlan.callThresholdDiastolic !== null ? `${carePlan.callThresholdDiastolic} diastolic` : null
  ].filter(Boolean) as string[];
  const hasCarePlanThresholds = callThresholdParts.length > 0;
  const glucoseLow = carePlan.callThresholdGlucoseLow ?? null;
  const glucoseHigh = carePlan.callThresholdGlucoseHigh ?? null;
  const glucoseThresholdParts = [
    glucoseLow !== null ? `at or below ${glucoseLow}` : null,
    glucoseHigh !== null ? `at or above ${glucoseHigh}` : null
  ].filter(Boolean) as string[];
  const hasGlucoseThresholds = glucoseThresholdParts.length > 0;
  const hasWarningSymptoms = carePlan.warningSymptoms.length > 0;
  const hasUrgentGuidance = hasCarePlanThresholds || hasGlucoseThresholds || hasWarningSymptoms;
  const urgencySectionStatus: EvidenceStatus = hasUrgentGuidance
    ? carePlan.thresholdSource === "clinician_authored"
      ? "confirmed"
      : "inferred"
    : "needs_review";
  const urgencySourceText =
    carePlan.thresholdSource === "clinician_authored"
      ? "Clinician-confirmed care-plan guidance."
      : "Standard education guidance for urgent threshold planning.";
  const urgencyItems = hasUrgentGuidance
    ? [
        urgencySourceText,
        ...(
          hasCarePlanThresholds
            ? [`Call the team if your blood pressure reaches ${callThresholdParts.join(" or ")} mmHg.`]
            : []
        ),
        ...(
          hasGlucoseThresholds
            ? [`Call the team if your blood sugar is ${glucoseThresholdParts.join(" or ")} mg/dL.`]
            : []
        ),
        ...(
          hasWarningSymptoms ? [`Seek urgent care right away for: ${carePlan.warningSymptoms.join(", ")}.`] : []
        )
      ]
    : [
        "No clinician call thresholds or warning symptoms are currently listed yet.",
        "Please review these urgent thresholds with your care team."
      ];

  const sections: Array<BriefSection | null> = [
    {
      title: "What I am working on",
      items: [state.carePlan.plainLanguageSummary],
      status: "confirmed"
    },
    {
      title: "Recent home readings",
      items: recentReadings.length > 0 ? recentReadings : ["No home readings logged yet."],
      status: recentReadings.length > 0 ? "patient_reported" : "needs_review"
    },
    bloodSugarSection(state),
    foodPatternSection(state),
    whatIveBeenEatingSection(state, asOf),
    {
      title: "When to call my care team",
      items: urgencyItems,
      status: urgencySectionStatus
    },
    {
      title: "Medicines and barriers",
      items: medicineItems,
      status: hasMedicines ? "patient_reported" : "needs_review"
    },
    adherenceSection(state, asOf),
    eyeScreeningSection(state, asOf),
    screeningsSection(state, asOf),
    {
      title: "Confirmed instructions",
      items: confirmedInstructions.length > 0 ? confirmedInstructions : ["No uploaded instructions confirmed yet."],
      status: confirmedInstructions.length > 0 ? "confirmed" : "needs_review"
    },
    {
      title: "Questions for my care team",
      items: [
        "What should I do if readings stay above my call threshold?",
        "Are any medicine side effects expected or concerning?",
        "What number pattern should make me call sooner?"
      ],
      status: "inferred"
    }
  ];

  return {
    id: "brief-current",
    patientId: state.patient.id,
    generatedAt,
    sections: sections.filter((section): section is BriefSection => section !== null)
  };
}
