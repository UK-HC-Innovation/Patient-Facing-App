import { GROUNDING_SAFE_PHRASING } from "./food-instructions";
import type { CompassContext } from "@/domain/compass-context";
import type { FoodMatchProvenance } from "@/domain/food-order-intent";
import { buildCompassContext } from "./food-instructions";

export const COMPASS_PROMPT_VERSION = "compass-v0.2-2026-08-19";

/**
 * The /compass voice persona.
 *
 * Deliberately not the food-lens persona: there is no patient here, no care plan to speak
 * of and no medications, so anything that reads a patient's history would be inventing
 * one. What survives from the food lens is the part that matters — the grounding-safe
 * phrasing guards, and the rule that every number is handed to the model, never computed
 * by it.
 */
export function buildCompassInstructions(): string {
  return [
    "You are a friendly food-choice assistant for a public preview of the Food Compass 2.0 scoring system.",
    "You know nothing about the person you are talking to: no medical history, no medications, no test results. Never imply otherwise and never ask for them.",
    "Every score you mention is handed to you — from the camera context, or from the lookup_food_score tool. You never calculate, estimate, adjust or average a score yourself.",
    "If you are asked about a food you have no number for, call lookup_food_score with what they said. If that returns nothing, say you need to see it or have it typed in — never state a number you were not given.",
    "If the tool says a result is a closest published match, call it that. State that restaurant, brand, size, or topping details listed as unmatched are not represented in the score; never present it as brand-specific nutrition.",
    "Scores run 1 to 100: 70 and above is a food to encourage, 31 to 69 is moderate, 30 and below is one to minimize.",
    "Some foods are outside the system's range by design — water and anything under 5 calories per 100 g, alcohol, infant formula, baby foods and specialized dietary foods. For those, say plainly that there is no score rather than inventing one.",
    "Keep answers to one or two short spoken sentences. Suggest a better option in the same food group when you have one.",
    "You are not a clinician and this is not medical advice. If someone asks what a food means for a health condition of theirs, say that is a conversation for their own care team.",
    ...GROUNDING_SAFE_PHRASING
  ].join("\n\n");
}

/** The camera context for /compass: the deterministic score, and nothing about a patient. */
export function buildCompassVoiceContext(
  compass: CompassContext | null,
  foodName: string | null,
  provenance?: FoodMatchProvenance
): string {
  const compassBlock = buildCompassContext(compass);
  return [
    `[camera context — not spoken by the user] Food in view: ${foodName ?? "none identified yet"}.`,
    ...(compassBlock ? [compassBlock] : []),
    ...(provenance
      ? [
          `Match provenance: closest published category "${provenance.matchedAs}". ${provenance.note} Unmatched details: ${
            provenance.unmatchedDetails.join(", ") || "none"
          }.`
        ]
      : []),
    "Use the numbers above exactly; do not recompute them."
  ].join(" ");
}

/**
 * F7b. The tool that turns "what about peanut butter?" into a real published number
 * instead of a plausible-sounding guess. The handler is a deterministic table lookup.
 */
export const LOOKUP_FOOD_SCORE_TOOL = {
  name: "lookup_food_score",
  description:
    "Look up the published Food Compass 2.0 score for a food by name. Use this whenever you are asked about a food whose score you were not given. Returns the score, the band, and better options in the same food group.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The food to look up, in plain English, for example \"peanut butter\" or \"whole wheat bread\"."
      }
    },
    required: ["query"],
    additionalProperties: false
  }
} as const;

export type CompassToolResult =
  | { found: false; reason: "no_match" }
  | { found: false; reason: "not_scoreable"; explanation: string }
  | {
      found: true;
      food: string;
      fcs: number;
      band: string;
      betterOptions: { description: string; fcs: number }[];
      closestMatch?: { matchedAs: string; unmatchedDetails: string[]; note: string };
    };

const CARVE_OUT_EXPLANATION: Record<string, string> = {
  zero_calorie: "outside the score's range — it provides essentially no calories",
  below_5kcal: "outside the score's range — under 5 calories per 100 g",
  alcohol: "outside the score's range — alcohol is excluded by the scoring system",
  infant: "outside the score's range — infant and baby foods are excluded",
  specialized: "outside the score's range — specialized dietary foods are excluded"
};

/** Runs the lookup against the identify route. The route owns the table; this owns the shape. */
export async function lookupFoodScore(query: string, passcode?: string): Promise<CompassToolResult> {
  const response = await fetch("/api/food/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: query, passcode })
  });
  const json = (await response.json()) as {
    mode: string;
    reason?: string;
    match?: {
      food: { description: string };
      score: { fcs: number; band: string };
      alternatives: { description: string; fcs: number }[];
      provenance?: { matchedAs: string; unmatchedDetails: string[]; note: string };
    };
  };

  if (json.mode === "carve_out") {
    return {
      found: false,
      reason: "not_scoreable",
      explanation: CARVE_OUT_EXPLANATION[json.reason ?? ""] ?? "outside the score's range"
    };
  }
  if (json.mode !== "match" || !json.match) {
    return { found: false, reason: "no_match" };
  }
  return {
    found: true,
    food: json.match.food.description,
    fcs: json.match.score.fcs,
    band: json.match.score.band,
    betterOptions: json.match.alternatives
      .slice(0, 3)
      .map((alternative) => ({ description: alternative.description, fcs: alternative.fcs })),
    ...(json.match.provenance
      ? {
          closestMatch: {
            matchedAs: json.match.provenance.matchedAs,
            unmatchedDetails: json.match.provenance.unmatchedDetails,
            note: json.match.provenance.note
          }
        }
      : {})
  };
}
