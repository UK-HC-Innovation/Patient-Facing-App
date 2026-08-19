import type { FoodLensStringKey } from "@/i18n/strings";
import type { CarePlan, Condition, NutritionFacts } from "./types";

export type NumericNutrient = Exclude<keyof NutritionFacts, "servingSize" | "basis">;

export type NutrientRule = {
  nutrient: NumericNutrient;
  dailyLimit: number;
  unit: "mg" | "g" | "kcal";
  direction: "limit" | "encourage";
  cautionAtPercent: number;
  warningAtPercent: number | null;
  encourageAtPercent: number | null;
  flagKey: FoodLensStringKey;
};

export type MedDietRule = {
  id: string;
  medicationNames: string[];
  productPattern: RegExp | null;
  nutrientTrigger: { nutrient: NumericNutrient; atLeast: number } | null;
  patternFlagKey: FoodLensStringKey;
  nutrientFlagKey: FoodLensStringKey;
  modelGuidance: string;
  suppressEncourage?: NumericNutrient;
};

export type ConditionLens = {
  condition: Condition;
  personaFocus: string;
  nutrientRules: NutrientRule[];
  medDietRules: MedDietRule[];
  betterOptionGuidance: string;
};

export const hypertensionLens: ConditionLens = {
  condition: "hypertension",
  personaFocus:
    "Focus on sodium first. Use a DASH-style lens: lower sodium, more vegetables and fruit, and small consistent swaps rather than big changes. When it helps, connect your advice to the patient's own blood-pressure readings and their trend.",
  nutrientRules: [
    {
      nutrient: "sodiumMg",
      dailyLimit: 1500,
      unit: "mg",
      direction: "limit",
      cautionAtPercent: 15,
      warningAtPercent: 30,
      encourageAtPercent: null,
      flagKey: "flagSodium"
    },
    {
      nutrient: "saturatedFatG",
      dailyLimit: 13,
      unit: "g",
      direction: "limit",
      cautionAtPercent: 25,
      warningAtPercent: 50,
      encourageAtPercent: null,
      flagKey: "flagSaturatedFat"
    },
    {
      nutrient: "addedSugarsG",
      dailyLimit: 25,
      unit: "g",
      direction: "limit",
      cautionAtPercent: 30,
      warningAtPercent: 60,
      encourageAtPercent: null,
      flagKey: "flagAddedSugars"
    },
    {
      nutrient: "potassiumMg",
      dailyLimit: 3500,
      unit: "mg",
      direction: "encourage",
      cautionAtPercent: 0,
      warningAtPercent: null,
      encourageAtPercent: 10,
      flagKey: "flagPotassiumGood"
    },
    {
      nutrient: "fiberG",
      dailyLimit: 28,
      unit: "g",
      direction: "encourage",
      cautionAtPercent: 0,
      warningAtPercent: null,
      encourageAtPercent: 10,
      flagKey: "flagFiberGood"
    }
  ],
  medDietRules: [
    {
      id: "ace_arb_potassium",
      medicationNames: [
        "lisinopril",
        "enalapril",
        "ramipril",
        "benazepril",
        "losartan",
        "valsartan",
        "olmesartan",
        "spironolactone",
        "eplerenone",
        "amiloride",
        "triamterene"
      ],
      productPattern: /salt substitute|lite salt|potassium chloride|no.?salt/i,
      nutrientTrigger: { nutrient: "potassiumMg", atLeast: 400 },
      patternFlagKey: "flagSaltSubstituteMed",
      nutrientFlagKey: "flagPotassiumMed",
      modelGuidance:
        "The patient takes an ACE inhibitor or related medicine. Never recommend salt substitutes or push high-potassium foods. If the product is a salt substitute or high in potassium, tell the patient to check with their care team first.",
      suppressEncourage: "potassiumMg"
    }
  ],
  betterOptionGuidance:
    "When you suggest a better option, keep it the same kind of food, keep it generic (a food category or common product type), and never name a specific store or say where to buy it."
};

export const diabetesLens: ConditionLens = {
  condition: "diabetes",
  personaFocus:
    "Focus on carbohydrates and added sugars first, watch portion size, and encourage fiber. Prefer whole foods and small consistent swaps rather than big changes. Keep guidance practical and plain.",
  nutrientRules: [
    {
      nutrient: "carbsG",
      dailyLimit: 200,
      unit: "g",
      direction: "limit",
      cautionAtPercent: 20,
      warningAtPercent: 40,
      encourageAtPercent: null,
      flagKey: "flagCarbs"
    },
    {
      nutrient: "addedSugarsG",
      dailyLimit: 25,
      unit: "g",
      direction: "limit",
      cautionAtPercent: 30,
      warningAtPercent: 60,
      encourageAtPercent: null,
      flagKey: "flagAddedSugars"
    },
    {
      nutrient: "saturatedFatG",
      dailyLimit: 13,
      unit: "g",
      direction: "limit",
      cautionAtPercent: 25,
      warningAtPercent: 50,
      encourageAtPercent: null,
      flagKey: "flagSaturatedFat"
    },
    {
      nutrient: "fiberG",
      dailyLimit: 28,
      unit: "g",
      direction: "encourage",
      cautionAtPercent: 0,
      warningAtPercent: null,
      encourageAtPercent: 10,
      flagKey: "flagFiberGood"
    }
  ],
  medDietRules: [
    {
      id: "metformin_gi",
      medicationNames: ["metformin", "glucophage"],
      productPattern: /alcohol|beer|wine|liquor|whisk(?:e)?y|vodka/i,
      nutrientTrigger: null,
      patternFlagKey: "flagMetforminAlcohol",
      nutrientFlagKey: "flagMetforminAlcohol",
      modelGuidance:
        "The patient takes metformin. Remind them to take it with food to reduce stomach upset, and to limit alcohol. Do not tell them to change their dose."
    }
  ],
  betterOptionGuidance: hypertensionLens.betterOptionGuidance
};

export const obesityLens: ConditionLens = {
  condition: "obesity",
  personaFocus:
    "Focus on calories, portion size, protein quality, and satiety. Keep guidance encouraging and non-judgmental.",
  nutrientRules: [],
  medDietRules: [],
  betterOptionGuidance: hypertensionLens.betterOptionGuidance
};

export function selectLens(condition: Condition): ConditionLens {
  switch (condition) {
    case "diabetes":
      return diabetesLens;
    case "obesity":
      return obesityLens;
    case "hypertension":
    default:
      return hypertensionLens;
  }
}

// Canonical order so a patient's active conditions (and the merged lens) are
// deterministic regardless of how they were entered. `condition` stays the
// single "primary"; `conditions` is the optional full set. When conditions is
// absent everything derives from the primary, so existing single-condition
// patients see identical behavior.
const CONDITION_ORDER: Condition[] = ["hypertension", "diabetes", "obesity"];

export function activeConditions(plan: Pick<CarePlan, "condition" | "conditions">): Condition[] {
  const raw = plan.conditions && plan.conditions.length > 0 ? plan.conditions : [plan.condition];
  return CONDITION_ORDER.filter((condition) => raw.includes(condition));
}

// Returns the exact single lens reference for one active condition (so existing
// callers and the selectLens identity contract are preserved), otherwise a
// merged lens.
export function selectLenses(conditions: Condition[]): ConditionLens {
  const lenses = conditions.map(selectLens);
  if (lenses.length <= 1) {
    return lenses[0] ?? hypertensionLens;
  }
  return mergeLenses(lenses);
}

function resolveNutrientConflict(existing: NutrientRule, incoming: NutrientRule): NutrientRule {
  // Never encourage a nutrient another active condition limits.
  if (existing.direction !== incoming.direction) {
    return existing.direction === "limit" ? existing : incoming;
  }
  // Two limits on the same nutrient: keep the stricter (lower) daily limit.
  if (existing.direction === "limit") {
    return incoming.dailyLimit < existing.dailyLimit ? incoming : existing;
  }
  return existing;
}

function mergeLenses(lenses: ConditionLens[]): ConditionLens {
  const byNutrient = new Map<NumericNutrient, NutrientRule>();
  for (const lens of lenses) {
    for (const rule of lens.nutrientRules) {
      const existing = byNutrient.get(rule.nutrient);
      byNutrient.set(rule.nutrient, existing ? resolveNutrientConflict(existing, rule) : rule);
    }
  }

  const seenMedRuleIds = new Set<string>();
  const medDietRules: MedDietRule[] = [];
  for (const lens of lenses) {
    for (const rule of lens.medDietRules) {
      if (!seenMedRuleIds.has(rule.id)) {
        seenMedRuleIds.add(rule.id);
        medDietRules.push(rule);
      }
    }
  }

  return {
    condition: lenses[0].condition,
    personaFocus: lenses.map((lens) => lens.personaFocus).join(" "),
    nutrientRules: [...byNutrient.values()],
    medDietRules,
    betterOptionGuidance: lenses[0].betterOptionGuidance
  };
}
