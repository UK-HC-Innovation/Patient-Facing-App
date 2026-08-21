import type { ConditionLens } from "./condition-lens";
import type { GlucoseReading, MealLogEntry } from "./types";
import { t, type Language } from "@/i18n/strings";

const DEFAULT_POST_MEAL_WINDOW_HOURS = 3;
const DEFAULT_MIN_SAMPLES = 3;
const DEFAULT_DELTA_FLOOR = 15;
const FALLBACK_CARB_LINE_G = 40;
const HOUR_MS = 60 * 60 * 1000;

export type GlucoseFoodInsight = {
  higherCarbMeanMgDl: number;
  otherMeanMgDl: number;
  deltaMgDl: number;
  higherCarbSamples: number;
  otherSamples: number;
  message: string;
};

export type GlucoseScoreInsight = {
  minimizeMeanMgDl: number;
  otherMeanMgDl: number;
  deltaMgDl: number;
  minimizeSamples: number;
  otherSamples: number;
  message: string;
};

export type FoodHistory = {
  loggedAt: string;
  postMealReading: number | null;
};

export type TimedReading = { time: number; value: number };

type GroupedMeal = {
  loggedAt: number;
  entries: MealLogEntry[];
};

type CorrelationOptions = {
  postMealWindowHours?: number;
  minSamplesPerBucket?: number;
  deltaFloorMgDl?: number;
  language?: Language;
};

/** Newest unpaired meal between one and three hours ago. Later array order wins exact ties. */
export function postMealCheckDue(
  mealLog: MealLogEntry[],
  glucoseReadings: GlucoseReading[],
  now: Date
): MealLogEntry | null {
  const nowMs = now.valueOf();
  if (!Number.isFinite(nowMs)) {
    return null;
  }
  const readingTimes = glucoseReadings
    .map((reading) => new Date(reading.measuredAt).valueOf())
    .filter(Number.isFinite);
  let best: { entry: MealLogEntry; time: number; index: number } | null = null;

  for (let index = 0; index < mealLog.length; index += 1) {
    const entry = mealLog[index];
    const mealTime = new Date(entry.loggedAt).valueOf();
    const age = nowMs - mealTime;
    if (!Number.isFinite(mealTime) || age < HOUR_MS || age > DEFAULT_POST_MEAL_WINDOW_HOURS * HOUR_MS) {
      continue;
    }
    const alreadyChecked = readingTimes.some((readingTime) => {
      const afterMeal = readingTime - mealTime;
      return afterMeal > 0 && afterMeal <= DEFAULT_POST_MEAL_WINDOW_HOURS * HOUR_MS && readingTime <= nowMs;
    });
    if (alreadyChecked) {
      continue;
    }
    if (!best || mealTime > best.time || (mealTime === best.time && index > best.index)) {
      best = { entry, time: mealTime, index };
    }
  }

  return best?.entry ?? null;
}

// The lens's own carb caution line (diabetesLens: 200 g * 20% = 40 g), so the
// "higher-carb" cut matches what the food lens already shows the patient.
function carbLineFor(lens: ConditionLens): number {
  const rule = lens.nutrientRules.find((candidate) => candidate.nutrient === "carbsG");
  if (!rule) {
    return FALLBACK_CARB_LINE_G;
  }
  return Math.round((rule.dailyLimit * rule.cautionAtPercent) / 100);
}

export function nearestPostMealReading(loggedAt: number, windowMs: number, readings: TimedReading[]): number | null {
  let best: TimedReading | null = null;
  for (const reading of readings) {
    const delta = reading.time - loggedAt;
    if (delta > 0 && delta <= windowMs && (best === null || reading.time < best.time)) {
      best = reading;
    }
  }
  return best ? best.value : null;
}

// Plate siblings are one meal for correlation. Older single-food rows retain
// their own entry id as the grouping key, so this is migration-safe.
function groupMeals(meals: MealLogEntry[]): GroupedMeal[] {
  const groups = new Map<string, GroupedMeal>();
  for (const meal of meals) {
    const key = meal.mealId ?? meal.id;
    const existing = groups.get(key);
    if (existing) {
      existing.entries.push(meal);
      continue;
    }
    groups.set(key, {
      loggedAt: new Date(meal.loggedAt).valueOf(),
      entries: [meal]
    });
  }
  return [...groups.values()];
}

function timedReadings(glucoseReadings: GlucoseReading[]): TimedReading[] {
  return glucoseReadings
    .map((reading) => ({
      time: new Date(reading.measuredAt).valueOf(),
      value: reading.valueMgDl
    }))
    .filter((reading) => Number.isFinite(reading.time));
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Deterministic and observational: pairs each meal that has a known carb count
// with the nearest glucose reading in (0, window] after it, buckets by the lens
// carb line, and reports the mean post-meal difference — only when both buckets
// clear the sample floor and higher-carb meals run at least deltaFloor higher.
// Meals without nutrition are skipped (never guessed). Never a causal claim.
export function summarizeFoodGlucoseLink(
  meals: MealLogEntry[],
  glucoseReadings: GlucoseReading[],
  lens: ConditionLens,
  options: CorrelationOptions = {}
): GlucoseFoodInsight | null {
  const windowMs = (options.postMealWindowHours ?? DEFAULT_POST_MEAL_WINDOW_HOURS) * HOUR_MS;
  const minSamples = options.minSamplesPerBucket ?? DEFAULT_MIN_SAMPLES;
  const deltaFloor = options.deltaFloorMgDl ?? DEFAULT_DELTA_FLOOR;
  const carbLine = carbLineFor(lens);

  const readings = timedReadings(glucoseReadings);

  const higherCarb: number[] = [];
  const other: number[] = [];

  for (const meal of groupMeals(meals)) {
    const carbs = meal.entries.map((entry) => entry.food.nutrition?.carbsG);
    // Unknown is not zero: a plate with any unknown component cannot be put in
    // a carb bucket honestly.
    if (carbs.some((value) => value === null || value === undefined)) {
      continue;
    }
    const mealCarbs = (carbs as number[]).reduce((sum, value) => sum + value, 0);
    const postMeal = nearestPostMealReading(meal.loggedAt, windowMs, readings);
    if (postMeal === null) {
      continue;
    }
    if (mealCarbs >= carbLine) {
      higherCarb.push(postMeal);
    } else {
      other.push(postMeal);
    }
  }

  if (higherCarb.length < minSamples || other.length < minSamples) {
    return null;
  }

  const higherCarbMeanMgDl = Math.round(mean(higherCarb));
  const otherMeanMgDl = Math.round(mean(other));
  const deltaMgDl = higherCarbMeanMgDl - otherMeanMgDl;

  if (deltaMgDl < deltaFloor) {
    return null;
  }

  return {
    higherCarbMeanMgDl,
    otherMeanMgDl,
    deltaMgDl,
    higherCarbSamples: higherCarb.length,
    otherSamples: other.length,
    message: `We noticed your blood-sugar readings after higher-carb meals averaged about ${deltaMgDl} mg/dL higher than after your other logged meals. This is an observation from your own logs, not a diagnosis — a good thing to mention to your care team.`
  };
}

// Deterministic and observational: plate siblings are grouped before pairing,
// and a plate enters the minimize bucket when any scored component is minimize.
// Unscored groups are skipped rather than guessed.
export function summarizeScoreGlucoseLink(
  meals: MealLogEntry[],
  glucoseReadings: GlucoseReading[],
  options: CorrelationOptions = {}
): GlucoseScoreInsight | null {
  const windowMs = (options.postMealWindowHours ?? DEFAULT_POST_MEAL_WINDOW_HOURS) * HOUR_MS;
  const minSamples = options.minSamplesPerBucket ?? DEFAULT_MIN_SAMPLES;
  const deltaFloor = options.deltaFloorMgDl ?? DEFAULT_DELTA_FLOOR;
  const readings = timedReadings(glucoseReadings);
  const minimize: number[] = [];
  const other: number[] = [];

  for (const meal of groupMeals(meals)) {
    const scores = meal.entries.flatMap((entry) => (entry.compassScore ? [entry.compassScore] : []));
    if (scores.length === 0) {
      continue;
    }
    const postMeal = nearestPostMealReading(meal.loggedAt, windowMs, readings);
    if (postMeal === null) {
      continue;
    }
    if (scores.some((score) => score.band === "minimize")) {
      minimize.push(postMeal);
    } else {
      other.push(postMeal);
    }
  }

  if (minimize.length < minSamples || other.length < minSamples) {
    return null;
  }

  const minimizeMeanMgDl = Math.round(mean(minimize));
  const otherMeanMgDl = Math.round(mean(other));
  const deltaMgDl = minimizeMeanMgDl - otherMeanMgDl;
  if (deltaMgDl < deltaFloor) {
    return null;
  }

  return {
    minimizeMeanMgDl,
    otherMeanMgDl,
    deltaMgDl,
    minimizeSamples: minimize.length,
    otherSamples: other.length,
    message: t(options.language ?? "en", "scoreGlucosePattern", { delta: deltaMgDl })
  };
}

/** Most recent prior log with the same complete food id, plus its nearest reading. */
export function lastTimeYouAte(
  foodId: string,
  mealLog: MealLogEntry[],
  glucoseReadings: GlucoseReading[]
): FoodHistory | null {
  let latest: { entry: MealLogEntry; time: number; index: number } | null = null;
  for (let index = 0; index < mealLog.length; index += 1) {
    const entry = mealLog[index];
    const time = new Date(entry.loggedAt).valueOf();
    if (entry.food.id !== foodId || !Number.isFinite(time)) {
      continue;
    }
    if (!latest || time > latest.time || (time === latest.time && index > latest.index)) {
      latest = { entry, time, index };
    }
  }
  if (!latest) {
    return null;
  }
  return {
    loggedAt: latest.entry.loggedAt,
    postMealReading: nearestPostMealReading(
      latest.time,
      DEFAULT_POST_MEAL_WINDOW_HOURS * HOUR_MS,
      timedReadings(glucoseReadings)
    )
  };
}

export function foodHistoryVoiceLine(history: FoodHistory, formattedDate: string): string {
  return history.postMealReading === null
    ? `The patient has logged this same food before (${formattedDate}).`
    : `The patient has logged this same food before (${formattedDate}); a glucose reading followed within the usual window — the number is on their screen.`;
}
