import { activeMedDietRules, type FoodFlag } from "@/domain/food-flags";
import type { CompassContext } from "@/domain/compass-context";
import { activeConditions, type ConditionLens } from "@/domain/condition-lens";
import { buildMealDigest } from "@/domain/food-week";
import type { AppState, HomeReading, IdentifiedFood } from "@/domain/types";

export const FOOD_LENS_PROMPT_VERSION = "food-lens-v0.1-2026-07-05";

function trendDirection(readings: HomeReading[]): string {
  if (readings.length < 2) {
    return "not enough readings yet";
  }
  const sorted = [...readings].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const net = sorted[sorted.length - 1].systolic - sorted[0].systolic;
  if (net >= 8) {
    return "trending up";
  }
  if (net <= -8) {
    return "trending down";
  }
  return "roughly steady";
}

function nutrientLimitLines(lens: ConditionLens): string {
  return lens.nutrientRules
    .map((rule) => {
      const aim = rule.direction === "limit" ? "keep under" : "encourage";
      return `- ${rule.nutrient}: ${aim} (${rule.dailyLimit} ${rule.unit}/day reference)`;
    })
    .join("\n");
}

function patientCard(state: AppState): string {
  const { patient, carePlan, medications, readings, glucoseReadings } = state;
  const latest = [...readings].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)).at(-1);
  const latestGlucose = [...glucoseReadings].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)).at(-1);
  const latestGlucoseText = latestGlucose ? `${latestGlucose.valueMgDl} mg/dL` : "none recorded";
  const goals = carePlan.goals.map((goal) => goal.label).join("; ") || "none recorded";
  const meds =
    medications.length > 0
      ? medications.map((med) => `${med.name} ${med.dose} (${med.schedule}) — ${med.purpose}`).join("; ")
      : "none recorded";
  const latestReading = latest ? `${latest.systolic}/${latest.diastolic}` : "none recorded";

  return [
    `Patient: ${patient.preferredName}, speaks ${patient.language === "es" ? "Spanish" : "English"}.`,
    `Condition: ${activeConditions(carePlan).join(" + ")}.`,
    `Goals: ${goals}.`,
    `Medications: ${meds}.`,
    `Latest blood pressure: ${latestReading}; trend: ${trendDirection(readings)}.`,
    `Call the care team if blood pressure is at or above ${carePlan.callThresholdSystolic ?? "?"}/${carePlan.callThresholdDiastolic ?? "?"}.`,
    `Latest blood sugar: ${latestGlucoseText}.`,
    `Care team: ${patient.primaryClinicName}, ${patient.primaryClinicPhone}.`
  ].join("\n");
}

export function buildFoodLensInstructions(state: AppState, lens: ConditionLens): string {
  const language = state.patient.language === "es" ? "Spanish" : "English";
  const medGuidance = activeMedDietRules(state.medications, lens.medDietRules)
    .map((rule) => `- ${rule.modelGuidance}`)
    .join("\n");

  const digest = buildMealDigest(state);
  const sections = [
    "You are a warm, knowledgeable food coach speaking out loud with a patient who is holding food up to their phone camera.",
    "Keep each spoken answer to about three short sentences unless the patient asks for more. Use plain, sixth-grade language. Never diagnose or prescribe or tell the patient to change a medicine. Say numbers plainly.",
    `Speak ${language} by default. If the patient speaks another language, mirror it.`,
    "Some user messages are marked [camera context]. Those describe what the camera sees plus any label data — they are NOT the patient speaking. If there is no label data, estimate from the image and say clearly that it is an estimate.",
    `Condition focus:\n${lens.personaFocus}\nNutrient targets:\n${nutrientLimitLines(lens)}`,
    medGuidance ? `Medication-diet rules to follow:\n${medGuidance}` : "",
    `Better options: ${lens.betterOptionGuidance}`,
    "Carb numbers read from a photo are rough estimates. Never help work out an insulin dose, a bolus, or a carb ratio, and never do that arithmetic out loud. Point to the plan the patient's care team gave them.",
    "Never say a food is safe for an allergy, an intolerance, or a child. You cannot read an ingredient list from a photo. Say to check the label on the package and ask their care team.",
    `Patient card:\n${patientCard(state)}`,
    digest
      ? `Food-log facts available at session start:\n${digest}\nThe food-log numbers below are safe to state exactly; the earlier rule about blood-pressure/A1C/blood-sugar numbers still applies. Use the numbers above exactly; do not recompute them.`
      : ""
  ];

  return sections.filter((section) => section.length > 0).join("\n\n");
}

// Phrasing guards shared by every food answer that passes through the grounding
// verifier. Each shape below trips a verifier rule — command-shaped medication
// advice, diagnosis-shaped statements, or an unverifiable BP/A1C number — so the
// model is steered away from them while the substance of the advice stays identical.
export const GROUNDING_SAFE_PHRASING = [
  'Give advice as gentle suggestions, never commands. Never begin advice with "You should stop / start / change / lower / raise / increase / decrease". Instead say things like "a lower-sodium version would be a better pick", "try a smaller portion", or "going easy on the salt helps here".',
  'Never tell the patient they "have" a condition. Refer to their care plan instead — say "for your blood-pressure plan" or "since lower sodium matters for you", not "you have high blood pressure" or "because you have hypertension".',
  "Never state a specific blood-pressure, A1C, or blood-sugar number — talk about the food.",
  "Carb numbers read from a photo are rough estimates. Never help work out an insulin dose, a bolus, or a carb ratio, and never do that arithmetic out loud. Point to the plan the patient's care team gave them.",
  "Never say a food is safe for an allergy, an intolerance, or a child. You cannot read an ingredient list from a photo. Say to check the label on the package and ask their care team."
];

// System prompt for the single-turn HTTP vision fallback (typed questions and the
// on-device coach). Reuses the live-voice persona so answers match, then adds the
// grounding-safe phrasing guards so a good answer is not degraded by the verifier.
export function buildFoodVisionSystemPrompt(state: AppState, lens: ConditionLens): string {
  return [
    buildFoodLensInstructions(state, lens),
    "You are answering a single question about the photo. If you reference the patient's readings or their trend, keep it general.",
    ...GROUNDING_SAFE_PHRASING,
    "If the photo does not clearly show food, say so plainly and ask them to point the camera at what they want to ask about."
  ].join("\n\n");
}

// System prompt for the pantry-recipe scan. Same coach persona and grounding-safe
// phrasing, but the task is to read a whole pantry/fridge and return structured
// JSON recipes tailored to the patient's plan.
export function buildPantryPrompt(state: AppState, lens: ConditionLens): string {
  return [
    buildFoodLensInstructions(state, lens),
    "The photo shows the inside of the patient's pantry, fridge, or a group of grocery items. First identify the individual food items you can see. Then suggest up to three simple recipes they could make mostly from those items that fit the plan above — favor the lower-sodium, plan-friendly options.",
    ...GROUNDING_SAFE_PHRASING,
    'Respond with ONLY a JSON object, no prose, matching exactly this shape: {"detectedItems": string[], "recipes": [{"title": string, "whyItFits": string, "haveItems": string[], "buyItems": string[], "watchOut": string | null}]}. "haveItems" are ingredients visible in the photo; "buyItems" are the few extra ingredients they would still need; "watchOut" is one short plan-relevant caution or null. Keep every string short and in the patient\'s language.',
    'If the photo does not show food, return {"detectedItems": [], "recipes": []}.'
  ].join("\n\n");
}

// The Food Compass block handed to the model. It is a fact sheet, never a request to
// compute: the score comes from the published table or the deterministic engine, and the
// closing line is the same instruction every other numeric context in this app carries.
export function buildCompassContext(compass: CompassContext | null): string | null {
  if (!compass) {
    return null;
  }
  if (compass.kind === "carve_out") {
    return `Food Compass: this food is outside the score's range (${compass.reason}). Say so plainly and do not give it a number.`;
  }

  const lines = [
    `Food Compass score: ${compass.fcs} out of 100 (${compass.band}${compass.tier === "T2" ? ", estimated from the label" : ""}).`
  ];
  if (compass.calorieDensityKcalPer100g !== null) {
    lines.push(`Calorie density: ${compass.calorieDensityKcalPer100g} kcal per 100 g.`);
  }
  if (compass.alternatives.length > 0) {
    lines.push(
      `Better options in the same food group: ${compass.alternatives
        .map((alternative) => `${alternative.description} (${alternative.fcs})`)
        .join("; ")}.`
    );
  }
  if (compass.domainBreakdown) {
    const domainNames = {
      D1: "nutrient ratios",
      D2: "vitamins",
      D3: "minerals",
      D4: "food ingredients",
      D5: "additives",
      D6: "processing",
      D7: "specific fats",
      D8: "fiber and protein",
      D9: "phytochemicals"
    } as const;
    const signed = (value: number): string => {
      const rounded = Math.round(value * 10) / 10;
      return `${rounded >= 0 ? "+" : ""}${rounded}`;
    };
    lines.push(
      `${compass.tier === "T1" ? "Estimated drivers (the published score stands)" : "Estimated label drivers"}: ${compass.domainBreakdown.domains
        .map((domain) => `${domainNames[domain.key]} ${signed(domain.value)}`)
        .join("; ")}.`
    );
    if (compass.domainBreakdown.coverage.missing.length > 0) {
      lines.push(
        `Not assessable: ${compass.domainBreakdown.coverage.missing.map((key) => domainNames[key]).join(", ")}.`
      );
    }
    if (compass.domainBreakdown.coverage.partial.length > 0) {
      lines.push(
        `Only partly assessable: ${compass.domainBreakdown.coverage.partial.map((key) => domainNames[key]).join(", ")}.`
      );
    }
  }
  return lines.join("\n");
}

export function buildPerAskContext(
  food: IdentifiedFood | null,
  flags: FoodFlag[],
  compass: CompassContext | null = null,
  dayTotalsLine: string | null = null
): string {
  const foodData = food
    ? JSON.stringify({
        name: food.name,
        brand: food.brand,
        category: food.category,
        source: food.source,
        nutrition: food.nutrition
      })
    : JSON.stringify({ foodData: "none" });

  const flagLines = flags.length > 0 ? flags.map((flag) => `- ${flag.text}`).join("\n") : "- none";
  const compassBlock = buildCompassContext(compass);

  return [
    `Food data: ${foodData}`,
    ...(compassBlock ? [compassBlock] : []),
    ...(dayTotalsLine ? [dayTotalsLine] : []),
    `Precomputed flags:\n${flagLines}`,
    "Weave at most the top two flags into a natural spoken answer. Use the numbers above exactly; do not recompute them."
  ].join("\n");
}
