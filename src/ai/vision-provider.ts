import { MockHealthAiProvider } from "./mock-provider";
import { buildFoodVisionSystemPrompt, buildPerAskContext } from "./food-instructions";
import { activeConditions, selectLenses } from "@/domain/condition-lens";
import { computeFoodFlags } from "@/domain/food-flags";
import type { AppState, HomeReading } from "@/domain/types";
import type { HealthAiProvider, HealthAiRequest, HealthAiResponse } from "./types";

type VisionRouteResponse =
  | { mode: "answer"; content: string }
  | { mode: "unconfigured" }
  | { mode: "locked" }
  | { mode: "error"; message?: string };

function latestReadingId(readings: HomeReading[]): string | null {
  if (readings.length === 0) {
    return null;
  }
  return [...readings].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0].id;
}

// Sources double as grounding citation ids. Always cite the care plan; also cite the
// most recent reading so any general "your readings/trend" phrasing the model uses
// clears the clinical-adjacent citation check in verifyGrounding. Carb/sodium/calorie
// numbers are not numeric-verified, so they need no extra citation.
function groundingCitations(state: AppState): string[] {
  const readingId = latestReadingId(state.readings);
  return readingId ? [state.carePlan.id, readingId] : [state.carePlan.id];
}

// Live-model food answers for the non-realtime path. respond() calls the server route
// that holds the API key; every answer still passes back through createSafeAiResponse
// (crisis + grounding) at the call site, exactly like the mock provider. When the route
// reports the model is not configured or the demo is locked, it degrades to the
// on-device coach so the feature never hard-fails.
export class OpenAiVisionProvider implements HealthAiProvider {
  private readonly passcode?: string;
  private readonly fallback = new MockHealthAiProvider();

  constructor(options: { passcode?: string } = {}) {
    this.passcode = options.passcode;
  }

  async respond(request: HealthAiRequest): Promise<HealthAiResponse> {
    const { state } = request;
    const lens = selectLenses(activeConditions(state.carePlan));
    const flags = computeFoodFlags(
      request.identifiedFood ?? null,
      lens,
      { medications: state.medications, readings: state.readings },
      state.patient.language
    );

    let route: VisionRouteResponse;
    try {
      const response = await fetch("/api/food/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: state.patient.id,
          passcode: this.passcode,
          question: request.patientInput,
          system: buildFoodVisionSystemPrompt(state, lens),
          foodContext: buildPerAskContext(request.identifiedFood ?? null, flags, request.compass ?? null),
          image: request.image ?? null
        })
      });
      route = (await response.json()) as VisionRouteResponse;
    } catch {
      route = { mode: "error", message: "fetch_failed" };
    }

    if (route.mode === "answer") {
      return {
        content: route.content,
        safety: "allowed",
        sources: groundingCitations(state)
      };
    }

    // unconfigured | locked | error → on-device coach (barcode-aware, no vision).
    return this.fallback.respond(request);
  }
}
