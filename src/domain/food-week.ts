import { toDateKey } from "./adherence";
import { bandForScore, type CompassBand } from "./food-compass";
import type { MealLogEntry } from "./types";

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

function foodName(entry: MealLogEntry): string {
  return entry.food.brand ? `${entry.food.brand} ${entry.food.name}` : entry.food.name;
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
    best: { name: foodName(best), fcs: best.compassScore.fcs },
    worst: { name: foodName(worst), fcs: worst.compassScore.fcs }
  };
}
