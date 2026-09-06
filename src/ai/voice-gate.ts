import { classifyCrisis, classifySafety, screenChildIngestion } from "@/domain/safety";
import { crisisTierForDomain } from "@/domain/crisis-red-flags";
import { tSafety, type Language } from "@/i18n/strings";
import { CARE_TEAM_ACTIONS, CRISIS_ACTIONS, EMERGENCY_ACTIONS, POISON_CONTROL_ACTIONS } from "./safety-gate";
import type { AiMessageAction, AppState } from "@/domain/types";

export type VoiceGateDecision =
  | { kind: "pass" }
  | {
      kind: "intercept";
      safety: "crisis" | "escalate" | "blocked";
      content: string;
      banner?: string;
      actions: AiMessageAction[];
    };

// Pure, synchronous gate run on a final voice (or typed-live) transcript BEFORE
// any spoken answer. Self-harm intercepts to the crisis tier with the fixed
// human-authored constant; sudden vision / acute danger and dangerous vitals
// intercept to the emergency tier; medication-change requests are soft-blocked.
export function evaluateVoiceTranscript(
  transcript: string,
  _state: AppState,
  language: Language
): VoiceGateDecision {
  const crisis = classifyCrisis(transcript);
  if (crisis.matched) {
    const tier = crisisTierForDomain(crisis.domain);
    if (tier === "crisis") {
      return {
        kind: "intercept",
        safety: "crisis",
        content: tSafety(language, "crisisResponse"),
        actions: CRISIS_ACTIONS
      };
    }
    if (tier === "emergency") {
      return {
        kind: "intercept",
        safety: "escalate",
        content: `Some signs need urgent medical attention. ${tSafety(language, "emergencyResponseSuffix")}`,
        banner: tSafety(language, "voiceInterceptNotice"),
        actions: EMERGENCY_ACTIONS
      };
    }
  }

  // A child who ate or swallowed something outranks everything below. The
  // answer is Poison Control and the package in hand, not a food score
  // (critique H4).
  if (screenChildIngestion(transcript)) {
    return {
      kind: "intercept",
      safety: "escalate",
      content: tSafety(language, "childIngestionResponse"),
      banner: tSafety(language, "voiceInterceptNotice"),
      actions: POISON_CONTROL_ACTIONS
    };
  }

  const safety = classifySafety(transcript);
  if (safety.level === "escalate") {
    return {
      kind: "intercept",
      safety: "escalate",
      content: safety.response,
      banner: tSafety(language, "voiceInterceptNotice"),
      actions: EMERGENCY_ACTIONS
    };
  }
  if (safety.level === "blocked") {
    return {
      kind: "intercept",
      safety: "blocked",
      content: safety.response,
      banner: tSafety(language, "voiceInterceptNotice"),
      actions: CARE_TEAM_ACTIONS
    };
  }

  return { kind: "pass" };
}
