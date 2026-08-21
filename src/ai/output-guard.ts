import { containsFamilyDiagnosisClaim } from "@/domain/family-diagnosis-lint";
import { classifyCrisis, classifySafety } from "@/domain/safety";
import { tSafety, type Language } from "@/i18n/strings";
import { tVoice } from "@/i18n/voice-strings";
import { CARE_TEAM_ACTIONS, CRISIS_ACTIONS } from "./safety-gate";
import type { LiveSessionEvent } from "./types";

const directConditionClaim = new RegExp(
  String.raw`\b(?:you|your child|your son|your daughter|usted|tu hijo|tu hija)\s+(?:have|has|tiene|tienes)\s+(?:a\s+)?(?:hypertension|high blood pressure|diabetes|obesity|asthma|depression|anxiety|autism|autism spectrum disorder|adhd|dyslexia|developmental delay|intellectual disability|down syndrome|hipertensi[oó]n|presi[oó]n alta|diabetes|obesidad|asma|depresi[oó]n|ansiedad|autismo|tdah|dislexia|retraso del desarrollo|discapacidad intelectual|s[ií]ndrome de down)\b`,
  "iu"
);

export const specificNumberAssertions = [
  /\b(?:your|su|tu)\s+(?:blood pressure|bp|presi[oó]n arterial)\s+(?:is|was|reads?|reading is|es|fue|marca)\s+\d{2,3}\s*(?:\/|over|sobre)\s*\d{2,3}\b/iu,
  /\b(?:your|su|tu)\s+a1c\s+(?:is|was|es|fue)\s+\d{1,2}(?:\.\d+)?\s*%?/iu,
  /\b(?:your|su|tu)\s+(?:blood sugar|glucose|az[uú]car en sangre|glucosa)\s+(?:is|was|reads?|reading is|es|fue|marca)\s+\d{2,4}(?:\s*mg\s*\/?\s*dL)?\b/iu
];

function hasBlockedClaim(text: string): boolean {
  return (
    classifySafety(text).level === "blocked" ||
    directConditionClaim.test(text) ||
    containsFamilyDiagnosisClaim(text) ||
    specificNumberAssertions.some((pattern) => pattern.test(text))
  );
}

export function createOutputTranscriptGuard(args: {
  language: Language;
  send: (event: object) => void;
  onEvent: (event: LiveSessionEvent) => void;
}): { observeDelta: (delta: string) => void; reset: () => void } {
  let accumulated = "";
  let tripped = false;

  function intercept(event: Extract<LiveSessionEvent, { type: "safetyIntercept" }>): void {
    args.send({ type: "response.cancel" });
    args.send({ type: "output_audio_buffer.clear" });
    args.onEvent(event);
    tripped = true;
  }

  return {
    observeDelta(delta: string): void {
      if (tripped) return;
      accumulated += delta;
      if (classifyCrisis(accumulated).matched) {
        intercept({
          type: "safetyIntercept",
          safety: "crisis",
          content: tSafety(args.language, "crisisResponse"),
          actions: CRISIS_ACTIONS
        });
        return;
      }
      if (hasBlockedClaim(accumulated)) {
        intercept({
          type: "safetyIntercept",
          safety: "blocked",
          content: tVoice(args.language, "outputBlockedCopy"),
          actions: CARE_TEAM_ACTIONS
        });
      }
    },
    reset(): void {
      accumulated = "";
      tripped = false;
    }
  };
}
