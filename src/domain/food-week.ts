import { toDateKey } from "./adherence";
import { activeConditions, selectLenses } from "./condition-lens";
import { formatDayTotalsContext, selectFoodLensDayTotals, summarizeDayTotals } from "./day-totals";
import { bandForScore, type CompassBand } from "./food-compass";
import type { AppState, MealLogEntry } from "./types";

export const MEAL_DIGEST_SOURCE_ID = "meal-digest";

export type WeekInFoodSummary = {
  meals: number;
  scoredMeals: number;
  avgFcs: number;
  bandCounts: Record<CompassBand, number>;
  best: { name: string; fcs: number };
  worst: { name: string; fcs: number };
};

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - days);
}

export function mealLogFoodName(entry: MealLogEntry): string {
  return entry.food.brand ? `${entry.food.brand} ${entry.food.name}` : entry.food.name;
}

type CountedText = { text: string; count: number };

export type FoodWindowSummary = {
  meals: number;
  scoredItems: number;
  avgFcs: number | null;
  bandCounts: Record<CompassBand, number>;
  tierCounts: { T1: number; T2: number };
  mostRepeatedMinimize: CountedText | null;
  topFlags: CountedText[];
};

function compareCountedText(a: CountedText, b: CountedText): number {
  return b.count - a.count || a.text.localeCompare(b.text, "en");
}

function countTexts(texts: string[]): CountedText[] {
  const counts = new Map<string, number>();
  for (const text of texts.map((value) => value.trim()).filter(Boolean)) {
    counts.set(text, (counts.get(text) ?? 0) + 1);
  }
  return [...counts].map(([text, count]) => ({ text, count })).sort(compareCountedText);
}

function entriesInWindow(mealLog: MealLogEntry[], now: Date, days: number): MealLogEntry[] {
  const lastDayKey = toDateKey(now);
  const firstDayKey = toDateKey(daysBefore(now, days - 1));
  return mealLog.filter((entry) => {
    const loggedAt = new Date(entry.loggedAt);
    if (!Number.isFinite(loggedAt.valueOf())) {
      return false;
    }
    const key = toDateKey(loggedAt);
    return key >= firstDayKey && key <= lastDayKey;
  });
}

/** Shared grouped-meal window for the digest and provider brief. */
export function summarizeFoodWindow(mealLog: MealLogEntry[], now: Date, days: number): FoodWindowSummary {
  const entries = entriesInWindow(mealLog, now, days);
  const groups = new Map<string, MealLogEntry[]>();
  for (const entry of entries) {
    const key = entry.mealId ?? entry.id;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const scoredEntries = entries.filter(
    (entry): entry is MealLogEntry & { compassScore: NonNullable<MealLogEntry["compassScore"]> } =>
      entry.compassScore !== undefined
  );
  const scoredGroups = [...groups.values()].filter((group) =>
    group.some((entry) => entry.compassScore !== undefined)
  );
  const bandCounts: Record<CompassBand, number> = { encourage: 0, moderate: 0, minimize: 0 };
  for (const group of scoredGroups) {
    const scores = group.flatMap((entry) => (entry.compassScore ? [entry.compassScore.fcs] : []));
    bandCounts[bandForScore(scores.reduce((sum, score) => sum + score, 0) / scores.length)] += 1;
  }

  const minimizeFoods = countTexts(
    scoredEntries
      .filter((entry) => entry.compassScore.band === "minimize")
      .map(mealLogFoodName)
  );
  const total = scoredEntries.reduce((sum, entry) => sum + entry.compassScore.fcs, 0);

  return {
    meals: groups.size,
    scoredItems: scoredEntries.length,
    avgFcs: scoredEntries.length > 0 ? Math.round(total / scoredEntries.length) : null,
    bandCounts,
    tierCounts: {
      T1: scoredEntries.filter((entry) => entry.compassScore.tier === "T1").length,
      T2: scoredEntries.filter((entry) => entry.compassScore.tier === "T2").length
    },
    mostRepeatedMinimize: minimizeFoods[0] ?? null,
    topFlags: countTexts(entries.flatMap((entry) => entry.flags))
  };
}

const PROHIBITED_DIGEST_WORDING =
  /\b(?:glucose|blood[\s-]+sugar|blood[\s-]+pressure|a1[\s-]?c|bp|readings?)\b|mg\s*\/?\s*dL/i;

function digestSafe(value: string): boolean {
  return !PROHIBITED_DIGEST_WORDING.test(value);
}

/**
 * Food-only, deterministic facts that are safe to cite in Coach responses. Clinical
 * reading language is excluded even when an old snapshotted flag happened to contain it.
 */
export function buildMealDigest(state: AppState, now: Date = new Date()): string | null {
  const week = summarizeWeekInFood(state.mealLog, now);
  if (!week) {
    return null;
  }

  const window = summarizeFoodWindow(state.mealLog, now, 7);
  const conditions = activeConditions(state.carePlan);
  const lens = selectLenses(conditions);
  const dayTotals = selectFoodLensDayTotals(summarizeDayTotals(state.mealLog, lens, now), conditions);
  const dayTotalsLine = formatDayTotalsContext(dayTotals);
  const lines = [
    "Meal log digest for the last 7 local calendar days:",
    `- Meals logged: ${week.meals} grouped meals; ${week.scoredMeals} had a Food Compass score.`,
    `- Scored-food average: ${week.avgFcs}; grouped-meal band mix: encourage ${week.bandCounts.encourage}, moderate ${week.bandCounts.moderate}, minimize ${week.bandCounts.minimize}.`
  ];
  if (dayTotalsLine) {
    lines.push(`- ${dayTotalsLine}`);
  }
  if (window.mostRepeatedMinimize && digestSafe(window.mostRepeatedMinimize.text)) {
    lines.push(
      `- Most repeated minimize-band food: ${window.mostRepeatedMinimize.text} (${window.mostRepeatedMinimize.count} logged item${window.mostRepeatedMinimize.count === 1 ? "" : "s"}).`
    );
  }
  const safeFlags = window.topFlags.filter((flag) => digestSafe(flag.text)).slice(0, 3);
  if (safeFlags.length > 0) {
    lines.push(`- Most common food flags: ${safeFlags.map((flag) => `${flag.text} (${flag.count}x)`).join("; ")}.`);
  }
  return lines.join("\n");
}

/**
 * Seven local calendar days ending on `now`.
 *
 * A plate is one meal for counts, the three-meal floor, and band mix. The overall
 * average deliberately remains a mean of the published per-item scores: those are
 * the real FCS values, while a plate-level number is only a separately labeled display
 * derivation. For the one band-mix slot a grouped meal needs, we band its item-score mean
 * without exposing that intermediate as a Food Compass score.
 */
export function summarizeWeekInFood(mealLog: MealLogEntry[], now: Date): WeekInFoodSummary | null {
  const todayKey = toDateKey(now);
  const firstDayKey = toDateKey(daysBefore(now, 6));
  const entries = mealLog.filter((entry) => {
    const loggedAt = new Date(entry.loggedAt);
    if (!Number.isFinite(loggedAt.valueOf())) {
      return false;
    }
    const key = toDateKey(loggedAt);
    return key >= firstDayKey && key <= todayKey;
  });

  const groups = new Map<string, MealLogEntry[]>();
  for (const entry of entries) {
    const key = entry.mealId ?? entry.id;
    const grouped = groups.get(key) ?? [];
    grouped.push(entry);
    groups.set(key, grouped);
  }

  const scoredGroups = [...groups.values()].filter((group) =>
    group.some((entry) => entry.compassScore !== undefined)
  );
  if (scoredGroups.length < 3) {
    return null;
  }

  const scoredEntries = entries.filter(
    (entry): entry is MealLogEntry & { compassScore: NonNullable<MealLogEntry["compassScore"]> } =>
      entry.compassScore !== undefined
  );
  const bandCounts: Record<CompassBand, number> = { encourage: 0, moderate: 0, minimize: 0 };
  for (const group of scoredGroups) {
    const itemScores = group.flatMap((entry) => (entry.compassScore ? [entry.compassScore.fcs] : []));
    const groupMean = itemScores.reduce((sum, score) => sum + score, 0) / itemScores.length;
    bandCounts[bandForScore(groupMean)] += 1;
  }

  const byScore = [...scoredEntries].sort((a, b) => a.compassScore.fcs - b.compassScore.fcs);
  const total = scoredEntries.reduce((sum, entry) => sum + entry.compassScore.fcs, 0);
  const worst = byScore[0];
  const best = byScore.at(-1) ?? worst;

  return {
    meals: groups.size,
    scoredMeals: scoredGroups.length,
    avgFcs: Math.round(total / scoredEntries.length),
    bandCounts,
    best: { name: mealLogFoodName(best), fcs: best.compassScore.fcs },
    worst: { name: mealLogFoodName(worst), fcs: worst.compassScore.fcs }
  };
}
