import { t, type FoodLensStringKey, type Language } from "@/i18n/strings";
import type { ConditionLens, MedDietRule, NutrientRule, NumericNutrient } from "./condition-lens";
import type { DayTotal } from "./day-totals";
import type { HomeReading, IdentifiedFood, Medication, NutritionFacts } from "./types";

export type FoodFlagSeverity = "info" | "caution" | "warning";

export type FoodFlag = {
  id: string;
  severity: FoodFlagSeverity;
  text: string;
};

const SEVERITY_ORDER: Record<FoodFlagSeverity, number> = { warning: 0, caution: 1, info: 2 };

const dayTotalFlagKey: Partial<Record<NumericNutrient, FoodLensStringKey>> = {
  sodiumMg: "flagDayTotalSodium",
  carbsG: "flagDayTotalCarbs",
  addedSugarsG: "flagDayTotalAddedSugars",
  saturatedFatG: "flagDayTotalSaturatedFat"
};

export function percentOfDailyLimit(amount: number, dailyLimit: number): number {
  if (dailyLimit <= 0) {
    return 0;
  }
  return Math.round((amount / dailyLimit) * 100);
}

export function nutrientRuleFlag(nutrition: NutritionFacts, rule: NutrientRule, language: Language): FoodFlag | null {
  const amount = nutrition[rule.nutrient];
  if (amount === null) {
    return null;
  }

  const percent = percentOfDailyLimit(amount, rule.dailyLimit);

  if (rule.direction === "limit") {
    let severity: FoodFlagSeverity | null = null;
    if (rule.warningAtPercent !== null && percent >= rule.warningAtPercent) {
      severity = "warning";
    } else if (percent >= rule.cautionAtPercent) {
      severity = "caution";
    }
    if (!severity) {
      return null;
    }
    return {
      id: `nutrient-${rule.nutrient}`,
      severity,
      text: t(language, rule.flagKey, { amount, percent, limit: rule.dailyLimit })
    };
  }

  if (rule.encourageAtPercent !== null && percent >= rule.encourageAtPercent) {
    return {
      id: `nutrient-${rule.nutrient}`,
      severity: "info",
      text: t(language, rule.flagKey, { amount, percent, limit: rule.dailyLimit })
    };
  }

  return null;
}

function matchMedication(medications: Medication[], rule: MedDietRule): Medication | null {
  return (
    medications.find((medication) =>
      rule.medicationNames.some((name) => medication.name.toLowerCase().includes(name.toLowerCase()))
    ) ?? null
  );
}

export function activeMedDietRules(medications: Medication[], rules: MedDietRule[]): MedDietRule[] {
  return rules.filter((rule) => matchMedication(medications, rule) !== null);
}

export function medDietFlags(
  food: IdentifiedFood,
  medications: Medication[],
  rules: MedDietRule[],
  language: Language
): FoodFlag[] {
  const flags: FoodFlag[] = [];

  for (const rule of rules) {
    const medication = matchMedication(medications, rule);
    if (!medication) {
      continue;
    }

    const haystack = `${food.name} ${food.brand ?? ""} ${food.category ?? ""}`;
    if (rule.productPattern && rule.productPattern.test(haystack)) {
      flags.push({
        id: `med-${rule.id}-pattern`,
        severity: "caution",
        text: t(language, rule.patternFlagKey, { med: medication.name })
      });
      continue;
    }

    if (rule.nutrientTrigger && food.nutrition) {
      const value = food.nutrition[rule.nutrientTrigger.nutrient];
      if (value !== null && value >= rule.nutrientTrigger.atLeast) {
        flags.push({
          id: `med-${rule.id}-nutrient`,
          severity: "caution",
          text: t(language, rule.nutrientFlagKey, { med: medication.name })
        });
      }
    }
  }

  return flags;
}

export function bpTrendFlag(readings: HomeReading[], language: Language): FoodFlag | null {
  if (readings.length === 0) {
    return null;
  }

  const sorted = [...readings].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const recent = sorted.slice(-3);
  const latest = recent[recent.length - 1];

  let rising = recent.length >= 2;
  for (let index = 1; index < recent.length; index += 1) {
    if (recent[index].systolic <= recent[index - 1].systolic) {
      rising = false;
      break;
    }
  }
  const netRise = latest.systolic - recent[0].systolic;

  if ((rising && netRise >= 10) || latest.systolic >= 140) {
    return { id: "bp-trend", severity: "info", text: t(language, "flagBpTrend") };
  }

  return null;
}

export function computeFoodFlags(
  food: IdentifiedFood | null,
  lens: ConditionLens,
  state: Pick<AppStateSlice, "medications" | "readings">,
  language: Language,
  dayTotals: DayTotal[] = []
): FoodFlag[] {
  const flags: FoodFlag[] = [];
  const activeRules = activeMedDietRules(state.medications, lens.medDietRules);
  const suppressed = new Set(activeRules.map((rule) => rule.suppressEncourage).filter(Boolean));

  if (food?.nutrition) {
    for (const rule of lens.nutrientRules) {
      if (rule.direction === "encourage" && suppressed.has(rule.nutrient)) {
        continue;
      }
      const flag = nutrientRuleFlag(food.nutrition, rule, language);
      if (flag) {
        flags.push(flag);
      }

      if (rule.direction === "limit") {
        const today = dayTotals.find((total) => total.nutrient === rule.nutrient);
        const amount = food.nutrition[rule.nutrient];
        const cumulativeKey = dayTotalFlagKey[rule.nutrient];
        if (
          today &&
          !today.incomplete &&
          amount !== null &&
          cumulativeKey &&
          today.total <= rule.dailyLimit &&
          today.total + amount > rule.dailyLimit
        ) {
          flags.push({
            id: `day-total-${rule.nutrient}`,
            severity: "warning",
            text: t(language, cumulativeKey)
          });
        }
      }
    }
  }

  if (food) {
    flags.push(...medDietFlags(food, state.medications, lens.medDietRules, language));
  }

  if (food) {
    const trend = bpTrendFlag(state.readings, language);
    if (trend) {
      flags.push(trend);
    }
  }

  return flags.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

type AppStateSlice = {
  medications: Medication[];
  readings: HomeReading[];
};
