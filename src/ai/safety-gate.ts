import { classifyCrisis, classifySafety, screenChildIngestion } from "@/domain/safety";
import { crisisTierForDomain, type CrisisDomain } from "@/domain/crisis-red-flags";
import { screenSocialEmergency } from "@/domain/social-screen";
import { verifyGrounding } from "@/domain/grounding";
import { findRecentClinicalReading, findRecentGlucoseReading } from "@/domain/recent-clinical-reading";
import { tSafety, type Language } from "@/i18n/strings";
import { collectSourceFacts } from "./grounding-facts";
import { answerEducationQuestion, isEducationQuestion } from "@/domain/retinopathy-education";
import { inferAiMode } from "./intent";
import type { HealthAiProvider, HealthAiRequest, HealthAiResponse } from "./types";
import type { AiMessageAction, HomeReading, Medication } from "@/domain/types";

export const CARE_TEAM_ACTIONS: AiMessageAction[] = ["call_clinic", "draft_message"];
export const CRISIS_ACTIONS: AiMessageAction[] = [
  "crisis_call_988",
  "crisis_text_988",
  "call_emergency",
  "safety_plan"
];
export const EMERGENCY_ACTIONS: AiMessageAction[] = ["call_emergency", "call_clinic", "draft_message"];
// Spec 29 P1: a child who ate or swallowed something needs 911 or Poison
// Control, and nothing else on the card competes with those two numbers.
export const POISON_CONTROL_ACTIONS: AiMessageAction[] = ["call_emergency", "call_poison_control"];
const ABUSE_ACTIONS: AiMessageAction[] = [...CRISIS_ACTIONS, ...CARE_TEAM_ACTIONS];

type EscalationTier = "emergency" | "care_team" | "poison_control";

type SafetyDecision =
  | { kind: "crisis_escalate"; domain: CrisisDomain }
  | { kind: "hard_escalate"; tier: EscalationTier; message: string; sources: string[] }
  | { kind: "soft_escalate"; message: string; sources: string[] }
  | { kind: "soft_block"; message: string; sources: string[] }
  | { kind: "allowed" };

function getLatestReading(readings: HomeReading[]): HomeReading | undefined {
  if (readings.length === 0) {
    return undefined;
  }

  return [...readings].sort((a, b) => new Date(b.measuredAt).valueOf() - new Date(a.measuredAt).valueOf())[0];
}

function findMedicationWithSideEffects(medications: Medication[]): Medication | undefined {
  return medications.find((medication) => medication.activeBarriers.includes("side_effects"));
}

function mentionsSideEffectConcern(input: string): boolean {
  return /side effect|dizz|lightheaded|faint|swelling|rash|nausea|cough|made me feel|felt worse/i.test(input);
}

function dedupe(sources: string[]): string[] {
  return [...new Set(sources)];
}

// Decides the highest-priority safety outcome for a request. The priority order is
// preserved from the original gate: urgent symptoms and dangerous vitals are "hard"
// (the escalation is the whole answer); clinic-threshold readings and dose-change
// requests are "soft" (still answer the question, but attach a prominent banner).
function decideSafety(request: HealthAiRequest): SafetyDecision {
  const language = request.state.patient.language;

  // The literal first statement of the gate: crisis-tier disclosures short-circuit
  // before the provider; sudden vision loss or acute danger escalates to the
  // emergency tier. Running this before the stored-reading block is what stops
  // "my face is drooping" from being buried under a threshold reading.
  const crisis = classifyCrisis(request.patientInput);
  if (crisis.matched) {
    const tier = crisisTierForDomain(crisis.domain);
    if (tier === "crisis" && crisis.domain) {
      return { kind: "crisis_escalate", domain: crisis.domain };
    }
    if (tier === "emergency") {
      return {
        kind: "hard_escalate",
        tier: "emergency",
        message: `Some signs need urgent medical attention. ${tSafety(language, "emergencyResponseSuffix")}`,
        sources: []
      };
    }
  }

  // A child who ate or swallowed something is answered with Poison Control, not
  // with a nutrition score or a "check the package label" line (critique H4).
  // It sits under crisis and above everything else.
  if (screenChildIngestion(request.patientInput)) {
    return {
      kind: "hard_escalate",
      tier: "poison_control",
      message: tSafety(language, "childIngestionResponse"),
      sources: []
    };
  }

  // A material emergency (no food today, hungry children, out of insulin) escalates
  // to the emergency tier with explicit 911 + 211 guidance, right after crisis.
  if (screenSocialEmergency(request.patientInput)) {
    return {
      kind: "hard_escalate",
      tier: "emergency",
      message: tSafety(language, "socialEmergencyResponse"),
      sources: []
    };
  }

  // A logged severe-low (or care-plan threshold) blood-sugar reading is checked
  // here, right after crisis + social, so a co-occurring blood-pressure reading
  // in the same window can never bury it. The severe tier is a full emergency.
  const recentGlucoseReading = findRecentGlucoseReading(request.state.glucoseReadings, request.state.carePlan);
  if (recentGlucoseReading && recentGlucoseReading.severity === "severe") {
    return {
      kind: "hard_escalate",
      tier: "emergency",
      message: `A recent blood-sugar reading of ${recentGlucoseReading.reading.valueMgDl} mg/dL is very low and can be dangerous. If you feel shaky, sweaty, or confused, treat a low now and seek urgent help if you do not improve.`,
      sources: [recentGlucoseReading.reading.id]
    };
  }

  const inputSafety = classifySafety(request.patientInput);
  const latestReading = getLatestReading(request.state.readings);
  const medicationWithSideEffects = findMedicationWithSideEffects(request.state.medications);
  const recentClinicalReading = findRecentClinicalReading(request.state.readings, request.state.carePlan, {
    includeBlockedNotes: true
  });
  let softBlock: SafetyDecision | undefined;

  if (recentClinicalReading) {
    const { reading, bloodPressureInsight, noteSafety, numericSafety } = recentClinicalReading;

    if (noteSafety.level === "escalate") {
      return { kind: "hard_escalate", tier: "emergency", message: noteSafety.response, sources: [reading.id] };
    }

    if (bloodPressureInsight.escalation === "clinic") {
      return {
        kind: "soft_escalate",
        message: `${bloodPressureInsight.message} This can happen even when you feel fine. If you are feeling worse, seek urgent care now.`,
        sources: [reading.id, request.state.carePlan.id]
      };
    }

    if (numericSafety.level === "escalate") {
      return { kind: "hard_escalate", tier: "emergency", message: numericSafety.response, sources: [reading.id] };
    }

    if (noteSafety.level === "blocked") {
      softBlock = { kind: "soft_block", message: noteSafety.response, sources: [reading.id] };
    }
  }

  // A stored glucose reading that breached the care-plan threshold (but is not a
  // severe low) is a soft clinic escalation, mirroring the blood-pressure
  // clinic-threshold path: still answer the question, but carry the guidance.
  if (recentGlucoseReading && recentGlucoseReading.severity === "clinic_threshold") {
    return {
      kind: "soft_escalate",
      message: `${recentGlucoseReading.glucoseInsight.message} This can happen even when you feel fine. If you are feeling worse, seek urgent care now.`,
      sources: [recentGlucoseReading.reading.id, request.state.carePlan.id]
    };
  }

  if (latestReading) {
    const noteSafety = classifySafety(latestReading.note);

    if (noteSafety.level === "escalate") {
      return { kind: "hard_escalate", tier: "emergency", message: noteSafety.response, sources: [latestReading.id] };
    }

    if (noteSafety.level === "blocked") {
      softBlock = { kind: "soft_block", message: noteSafety.response, sources: [latestReading.id] };
    }
  }

  if (inputSafety.level === "escalate") {
    return { kind: "hard_escalate", tier: "emergency", message: inputSafety.response, sources: [] };
  }

  if (medicationWithSideEffects && mentionsSideEffectConcern(request.patientInput)) {
    return {
      kind: "hard_escalate",
      tier: "care_team",
      message: `${medicationWithSideEffects.name} is marked with active side effects. I cannot diagnose the cause, but I can help you contact your care team and share this symptom pattern with the latest readings.`,
      sources: [medicationWithSideEffects.id]
    };
  }

  if (softBlock) {
    return softBlock;
  }

  if (inputSafety.level === "blocked") {
    return { kind: "soft_block", message: inputSafety.response, sources: [] };
  }

  return { kind: "allowed" };
}

export async function createSafeAiResponse(
  request: HealthAiRequest,
  provider: HealthAiProvider
): Promise<HealthAiResponse> {
  const decision = decideSafety(request);
  const language: Language = request.state.patient.language;

  // A crisis short-circuits above everything else: the provider is never called,
  // and the reply uses fixed human-authored copy plus existing human-contact actions.
  if (decision.kind === "crisis_escalate") {
    if (decision.domain === "abuse") {
      return {
        content: tSafety(language, "abuseResponse"),
        safety: "crisis",
        sources: [],
        actions: ABUSE_ACTIONS
      };
    }

    if (decision.domain === "harm_to_others") {
      return {
        content: tSafety(language, "harmToOthersResponse"),
        safety: "crisis",
        sources: [],
        actions: ABUSE_ACTIONS
      };
    }

    return {
      content: tSafety(language, "crisisResponse"),
      safety: "crisis",
      sources: [],
      actions: CRISIS_ACTIONS
    };
  }

  // Hard escalations are emergencies: the escalation is the whole answer and the
  // provider is never called, so we cannot generate a normal reply alongside it.
  if (decision.kind === "hard_escalate") {
    return {
      content: decision.message,
      safety: "escalate",
      sources: decision.sources,
      actions:
        decision.tier === "emergency"
          ? EMERGENCY_ACTIONS
          : decision.tier === "poison_control"
            ? POISON_CONTROL_ACTIONS
            : CARE_TEAM_ACTIONS
    };
  }

  // A confident diabetic-retinopathy education question is answered from the
  // curated, cited knowledge base instead of the model. This runs only after the
  // crisis/emergency short-circuits above, so an acute vision symptom always
  // escalates first. It is English-gated (Spanish free-text falls through to the
  // provider) and skips grounding because the answer is pre-vetted education, not
  // a model claim about the patient's own records.
  if (decision.kind === "allowed" && language === "en" && isEducationQuestion(request.patientInput)) {
    const education = answerEducationQuestion(request.patientInput);
    if (education.kind === "answer") {
      return {
        content: `${education.text}\n\n${education.source}`,
        safety: "allowed",
        sources: [],
        grounding: { allowed: true, blockedReasons: [] }
      };
    }
  }

  const effectiveRequest: HealthAiRequest = {
    ...request,
    mode: inferAiMode(request.patientInput, request.mode)
  };
  const providerResponse = await provider.respond(effectiveRequest);

  // Grounding runs on every model answer that would reach the patient (allowed AND
  // soft paths). An answer we cannot confirm against the patient's own records
  // degrades to "contact your care team" — never silence, never an ungrounded claim.
  const grounding = verifyGrounding({
    answer: providerResponse.content,
    sourceFacts: collectSourceFacts(request.state),
    citationIds: providerResponse.sources
  });

  if (!grounding.allowed) {
    return {
      content: tSafety(language, "groundingFallback"),
      safety: "blocked",
      sources: [],
      banner: tSafety(language, "groundingFallbackBanner"),
      actions: CARE_TEAM_ACTIONS,
      grounding: { allowed: false, blockedReasons: grounding.blockedReasons }
    };
  }

  const groundingField = { allowed: true, blockedReasons: [] as string[] };

  // Soft cases still answer the question, but carry the safety guidance as a prominent
  // banner plus actionable ways to reach the care team.
  if (decision.kind === "soft_escalate" || decision.kind === "soft_block") {
    return {
      content: providerResponse.content,
      safety: decision.kind === "soft_escalate" ? "escalate" : "blocked",
      sources: dedupe([...decision.sources, ...providerResponse.sources]),
      banner: decision.message,
      actions: CARE_TEAM_ACTIONS,
      grounding: groundingField
    };
  }

  if (providerResponse.safety === "blocked" || providerResponse.safety === "escalate") {
    return { ...providerResponse, grounding: groundingField };
  }

  return { ...providerResponse, safety: "allowed", grounding: groundingField };
}
