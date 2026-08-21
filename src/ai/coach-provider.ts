import { MockHealthAiProvider } from "./mock-provider";
import { coachCitations } from "./grounding-facts";
import { healthAiSystemPrompt } from "./prompts";
import { activeConditions } from "@/domain/condition-lens";
import { buildMealDigest } from "@/domain/food-week";
import type { AppState } from "@/domain/types";
import type { HealthAiProvider, HealthAiRequest, HealthAiResponse } from "./types";

type CoachRouteResponse =
  | { mode: "answer"; content: string }
  | { mode: "unconfigured" }
  | { mode: "locked" }
  | { mode: "error"; message?: string };

function coachContext(state: AppState): string {
  const conditions = activeConditions(state.carePlan).join(" + ");
  const meds =
    state.medications.length > 0
      ? state.medications.map((med) => `${med.name} ${med.dose} (${med.schedule})`).join("; ")
      : "none recorded";
  const latestBp = [...state.readings].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)).at(-1);
  const latestGlucose = [...state.glucoseReadings].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)).at(-1);

  return [
    `Patient: ${state.patient.preferredName}, speaks ${state.patient.language === "es" ? "Spanish" : "English"}.`,
    `Conditions: ${conditions}.`,
    `Medications: ${meds}.`,
    latestBp ? `Latest blood pressure: ${latestBp.systolic}/${latestBp.diastolic}.` : "No blood-pressure readings yet.",
    latestGlucose ? `Latest blood sugar: ${latestGlucose.valueMgDl} mg/dL.` : "No blood-sugar readings yet.",
    `Care team: ${state.patient.primaryClinicName}, ${state.patient.primaryClinicPhone}.`
  ].join("\n");
}

// The coach system prompt reuses the shared coach persona, adds the patient's own
// context (conditions, medicines, latest readings), and the same grounding-safe
// guards the food path uses: never state a specific number, never a med change,
// never a diagnosis — so a compliant answer clears verifyGrounding.
export function buildCoachSystemPrompt(state: AppState): string {
  const digest = buildMealDigest(state);
  const sections = [
    healthAiSystemPrompt,
    `Speak ${state.patient.language === "es" ? "Spanish" : "English"} in plain, sixth-grade language. Keep answers to about four short sentences unless asked for more.`,
    "Do not state a specific blood-pressure, A1C, or blood-sugar number — speak generally about the pattern or trend. Never tell the patient to stop, start, or change a medicine or dose. Never tell the patient they 'have' a condition; refer to their care plan instead.",
    `Patient context:\n${coachContext(state)}`,
    digest
      ? `Food-log facts:\n${digest}\nThe food-log numbers below are safe to state exactly; the earlier rule about blood-pressure/A1C/blood-sugar numbers still applies. Use the numbers above exactly; do not recompute them.`
      : ""
  ];
  return sections.filter(Boolean).join("\n\n");
}

// Live text-Coach for the typed chat path. respond() calls the server route that
// holds the API key; every answer still flows back through createSafeAiResponse
// (crisis short-circuit + grounding) at the call site, exactly like the mock
// provider. When the route reports the model is unconfigured, the demo is locked,
// or the request errors, it degrades to the on-device mock coach so the chat never
// hard-fails.
export class OpenAiCoachProvider implements HealthAiProvider {
  private readonly passcode?: string;
  private readonly fallback = new MockHealthAiProvider();

  constructor(options: { passcode?: string } = {}) {
    this.passcode = options.passcode;
  }

  async respond(request: HealthAiRequest): Promise<HealthAiResponse> {
    const { state } = request;

    let route: CoachRouteResponse;
    try {
      const response = await fetch("/api/coach/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: state.patient.id,
          passcode: this.passcode,
          question: request.patientInput,
          system: buildCoachSystemPrompt(state)
        })
      });
      route = (await response.json()) as CoachRouteResponse;
    } catch {
      route = { mode: "error", message: "fetch_failed" };
    }

    if (route.mode === "answer") {
      return {
        content: route.content,
        safety: "allowed",
        sources: coachCitations(state)
      };
    }

    // unconfigured | locked | error → on-device mock coach.
    return this.fallback.respond(request);
  }
}
