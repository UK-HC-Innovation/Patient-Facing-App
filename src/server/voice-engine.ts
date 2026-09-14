/**
 * Which voice engine a food-door request gets.
 *
 * GPT-Live-1 runs on its own API (`POST /v1/live/sessions`) and decides for itself when to
 * speak: nothing like Realtime's `create_response: false` can hold a reply until the safety
 * gate has read the transcript. So it is opt-in per language, and only the food doors ask for
 * it. `/chat` sends no surface and stays on Realtime.
 */
export type VoiceEngine = "realtime" | "live";

export const DEFAULT_LIVE_MODEL = "gpt-live-1";

export function liveModel(): string {
  return process.env.HEALTH_AI_LIVE_MODEL?.trim() || DEFAULT_LIVE_MODEL;
}

/**
 * `HEALTH_AI_LIVE_LANGUAGES=en`, or `en,es`. Empty, the default, keeps Realtime everywhere, so
 * a deployment moves to GPT-Live only when someone sets it.
 */
function liveLanguages(): Set<"en" | "es"> {
  const languages = new Set<"en" | "es">();
  for (const value of (process.env.HEALTH_AI_LIVE_LANGUAGES ?? "").split(",")) {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "en" || trimmed === "es") {
      languages.add(trimmed);
    }
  }
  return languages;
}

export function voiceEngineFor(language: unknown): VoiceEngine {
  return liveLanguages().has(language === "es" ? "es" : "en") ? "live" : "realtime";
}
