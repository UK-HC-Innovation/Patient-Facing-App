"use client";

import React from "react";
import { t, type FoodLensStringKey, type Language } from "@/i18n/strings";
import type { FoodFlag, FoodFlagSeverity } from "@/domain/food-flags";
import type { IdentifiedFood, NutritionFacts } from "@/domain/types";
import type { CompassAlternative, CompassScore, NotScoreableReason, ScoreDomainBreakdown } from "@/domain/food-compass";
import type { SpokenFoodSize } from "@/domain/food-order-intent";
import type { DayTotal } from "@/domain/day-totals";
import type { LiveCandidate } from "@/hooks/use-live-food-score";
import { CompassAlternatives, CompassCarveOut, CompassScoreRow } from "./compass-score";
import { FoodGuidanceSource } from "./food-guidance-source";

const severityClass: Record<FoodFlagSeverity, string> = {
  warning: "bg-pulse/10 text-pulse",
  caution: "bg-amber-100 text-amber-800",
  info: "bg-calm text-care"
};

const sizeLabelKey: Record<SpokenFoodSize, FoodLensStringKey> = {
  personal: "sizePersonal",
  small: "sizeSmall",
  medium: "sizeMedium",
  regular: "sizeRegular",
  large: "sizeLarge",
  "extra large": "sizeExtraLarge",
  family: "sizeFamily"
};

const dayTotalLabelKey: Partial<Record<DayTotal["nutrient"], FoodLensStringKey>> = {
  sodiumMg: "nutritionSodium",
  carbsG: "nutritionCarbs",
  addedSugarsG: "nutritionAddedSugars",
  saturatedFatG: "nutritionSaturatedFat"
};

export function dayTotalBarTone(percent: number): "default" | "amber" | "red" {
  if (percent >= 100) {
    return "red";
  }
  return percent >= 80 ? "amber" : "default";
}

const dayTotalBarClass: Record<ReturnType<typeof dayTotalBarTone>, string> = {
  default: "bg-care",
  amber: "bg-amber-500",
  red: "bg-pulse"
};

type NutritionRow = {
  labelKey: FoodLensStringKey;
  value: number | null;
  unit: "" | "mg" | "g";
};

function formatServingCount(servings: number): string {
  return Number.isInteger(servings) ? String(servings) : String(Math.round(servings * 10) / 10);
}

function previousServing(servings: number): number {
  if (servings <= 0.5) {
    return 0.5;
  }
  if (servings <= 1) {
    return 0.5;
  }
  return servings - 1;
}

function nextServing(servings: number): number {
  return servings < 1 ? 1 : servings + 1;
}

function buildNutritionRows(nutrition: NutritionFacts): NutritionRow[] {
  return [
    { labelKey: "nutritionCalories", value: nutrition.calories, unit: "" },
    { labelKey: "nutritionSodium", value: nutrition.sodiumMg, unit: "mg" },
    { labelKey: "nutritionCarbs", value: nutrition.carbsG, unit: "g" },
    { labelKey: "nutritionAddedSugars", value: nutrition.addedSugarsG, unit: "g" }
  ];
}

export function foodTitle(food: IdentifiedFood | null, language: Language): string {
  if (!food) {
    return t(language, "unknownFood");
  }
  return food.brand ? `${food.brand} ${food.name}` : food.name;
}

/**
 * The per-serving panel and the portion stepper.
 *
 * Servings change nutrition and day totals only -- never the score, which is a property of
 * the food. The panel says so once, here, rather than leaving it to be inferred.
 */
export function FoodNutrientsBlock({
  food,
  language,
  portionServings,
  spokenSize = null,
  onPortionChange
}: {
  food: IdentifiedFood;
  language: Language;
  portionServings: number;
  spokenSize?: SpokenFoodSize | null;
  onPortionChange: (servings: number) => void;
}) {
  if (!food.nutrition) {
    return null;
  }
  const portionLabel = formatServingCount(portionServings);
  const portionAssumption = spokenSize
    ? t(language, "portionSizeAssumption", { size: t(language, sizeLabelKey[spokenSize]), servings: portionLabel })
    : t(language, "portionAssuming", { servings: portionLabel });
  const nutritionRows = buildNutritionRows(food.nutrition).filter((row) => row.value !== null);

  return (
    <div className="grid gap-3 rounded-control bg-calm/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink/75">{portionAssumption}</p>
        <div className="flex items-center gap-2">
          <button
            aria-label={t(language, "portionDecrease")}
            className="min-h-12 min-w-12 rounded-control border border-ink/15 bg-white px-3 text-lg font-semibold text-ink disabled:opacity-40"
            disabled={portionServings <= 0.5}
            onClick={() => onPortionChange(previousServing(portionServings))}
            type="button"
          >
            -
          </button>
          <span aria-label={t(language, "portionLabel")} className="min-w-10 text-center text-sm font-semibold">
            {portionLabel}
          </span>
          <button
            aria-label={t(language, "portionIncrease")}
            className="min-h-12 min-w-12 rounded-control border border-ink/15 bg-white px-3 text-lg font-semibold text-ink"
            onClick={() => onPortionChange(nextServing(portionServings))}
            type="button"
          >
            +
          </button>
        </div>
      </div>
      {food.source === "label_vision" ? (
        <p className="text-xs font-medium text-ink/70">{t(language, "labelPhotoCheck")}</p>
      ) : null}
      {nutritionRows.length > 0 ? (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {nutritionRows.map((row) => (
            <div key={row.labelKey} className="rounded-control bg-white px-3 py-2">
              <dt className="text-xs font-medium text-ink/60">{t(language, row.labelKey)}</dt>
              <dd className="font-semibold">
                {row.value}
                {row.unit ? ` ${row.unit}` : ""}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

export function FoodHistoryBlock({
  history,
  showGlucoseHistory,
  language
}: {
  history: { date: string; postMealReading: number | null };
  showGlucoseHistory: boolean;
  language: Language;
}) {
  return (
    <div className="rounded-control border border-care/20 bg-calm px-3 py-2 text-sm leading-6">
      <p>{t(language, "foodHistoryLogged", { date: history.date })}</p>
      {showGlucoseHistory && history.postMealReading !== null ? (
        <p>{t(language, "foodHistoryReading", { value: history.postMealReading })}</p>
      ) : null}
    </div>
  );
}

/** F10's running day totals. */
export function FoodTotalsBlock({ dayTotals, language }: { dayTotals: DayTotal[]; language: Language }) {
  if (dayTotals.length === 0) {
    return null;
  }
  return (
    <div className="rounded-control border border-ink/10 bg-white p-3">
      <h3 className="text-sm font-semibold">{t(language, "todaySoFar")}</h3>
      <div className="mt-2 grid gap-3">
        {dayTotals.map((total) => {
          const labelKey = dayTotalLabelKey[total.nutrient] ?? total.flagKey;
          const label = t(language, labelKey);
          const line = t(language, "todayTotalLine", {
            total: total.total,
            limit: total.dailyLimit,
            unit: total.unit,
            percent: total.percent
          });
          const tone = dayTotalBarTone(total.percent);
          return (
            <div key={total.nutrient}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium">{label}</span>
                <span className="text-ink/65">{line}</span>
              </div>
              <div
                aria-label={`${label}: ${line}`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.min(total.percent, 100)}
                className="mt-1 h-2 overflow-hidden rounded-full bg-ink/10"
                role="progressbar"
              >
                <div
                  className={`h-full rounded-full ${dayTotalBarClass[tone]}`}
                  data-tone={tone}
                  style={{ width: `${Math.min(Math.max(total.percent, 0), 100)}%` }}
                />
              </div>
              {total.incomplete ? <p className="mt-1 text-xs text-ink/60">{t(language, "todayTotalIncomplete")}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The interpretation read-back's closer-category picker, on the personalized mount. */
export function FoodCorrectionChips({
  candidates,
  language,
  onCorrection
}: {
  candidates: LiveCandidate[];
  language: Language;
  onCorrection: (foodId: string) => void;
}) {
  if (candidates.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-ink/70">{t(language, "foodNotThis")}</span>
      {candidates.map((candidate) => (
        <button
          className="min-h-11 rounded-full border border-care/25 bg-white px-3 py-1 text-sm font-medium text-care"
          key={candidate.code}
          onClick={() => onCorrection(candidate.code)}
          type="button"
        >
          {candidate.description}
        </button>
      ))}
    </div>
  );
}

/** Personalized warnings. /food only -- the public mount has no profile to warn from. */
export function FoodFlagsBlock({ flags, language }: { flags: FoodFlag[]; language: Language }) {
  if (flags.length === 0) {
    return null;
  }
  return (
    <div className="grid gap-2">
      <FoodGuidanceSource kind="personalized" language={language} />
      <ul className="grid gap-2">
        {flags.map((flag) => (
          <li key={flag.id} className={`rounded-control px-3 py-2 text-sm font-medium ${severityClass[flag.severity]}`}>
            {flag.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FoodFavoriteButton({
  favorite,
  title,
  language,
  onToggle
}: {
  favorite: boolean;
  title: string;
  language: Language;
  onToggle: () => void;
}) {
  return (
    <button
      aria-label={t(language, favorite ? "favoriteRemove" : "favoriteAdd", { food: title })}
      className="min-h-11 rounded-control border border-care/25 bg-white px-3 py-2 text-sm font-semibold text-care"
      onClick={onToggle}
      type="button"
    >
      {favorite ? "★" : "☆"} {t(language, favorite ? "favoriteRemoveShort" : "favoriteAddShort")}
    </button>
  );
}

/** Log, add to plate, and whatever secondary rows the mount wants beneath them. */
export function FoodActionsBlock({
  logged,
  canLog,
  onLog,
  onAddToPlate,
  logLabelKey = "logThis",
  language,
  children
}: {
  logged: boolean;
  canLog: boolean;
  onLog: () => void;
  onAddToPlate?: () => void;
  /** A carve-out still wants the diary entry, under its own words. */
  logLabelKey?: FoodLensStringKey;
  language: Language;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      {logged ? (
        <p className="text-sm font-semibold text-care">{t(language, "loggedConfirmation")}</p>
      ) : (
        <>
          <button
            className="min-h-14 w-full rounded-control bg-care px-4 py-2 font-semibold text-white disabled:opacity-40"
            disabled={!canLog}
            onClick={onLog}
            type="button"
          >
            {t(language, logLabelKey)}
          </button>
          {onAddToPlate ? (
            <button
              className="min-h-14 w-full rounded-control border border-care bg-white px-4 py-2 font-semibold text-care"
              onClick={onAddToPlate}
              type="button"
            >
              {t(language, "addToPlate")}
            </button>
          ) : null}
        </>
      )}
      {children}
    </div>
  );
}

/**
 * The pre-shell facts card: one stack of every block above.
 *
 * The scroll shell renders the same blocks into named slots instead. This composition is
 * kept so the blocks have a single-surface home and their contract stays covered.
 */
export function FoodFactsCard({
  food,
  flags,
  logged,
  canLog,
  onLog,
  onAddToPlate,
  language,
  portionServings,
  spokenSize = null,
  onPortionChange,
  correctionCandidates = [],
  onCorrection,
  compassScore = null,
  estimatedDomains = null,
  compassCarveOut = null,
  compassAlternatives = [],
  history = null,
  showGlucoseHistory = false,
  dayTotals = [],
  favorite = false,
  onToggleFavorite
}: {
  food: IdentifiedFood | null;
  flags: FoodFlag[];
  logged: boolean;
  canLog: boolean;
  onLog: () => void;
  onAddToPlate?: () => void;
  language: Language;
  portionServings: number;
  spokenSize?: SpokenFoodSize | null;
  onPortionChange: (servings: number) => void;
  correctionCandidates?: LiveCandidate[];
  onCorrection?: (foodId: string) => void;
  compassScore?: CompassScore | null;
  estimatedDomains?: ScoreDomainBreakdown | null;
  compassCarveOut?: NotScoreableReason | null;
  compassAlternatives?: CompassAlternative[];
  history?: { date: string; postMealReading: number | null } | null;
  showGlucoseHistory?: boolean;
  dayTotals?: DayTotal[];
  favorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const title = foodTitle(food, language);

  return (
    <section className="rounded-control border border-ink/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {food?.nutrition ? <p className="text-sm text-ink/65">{food.nutrition.servingSize}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          {food && (food.source === "vision_estimate" || food.source === "label_vision") ? (
            <span className="rounded-control bg-calm px-2 py-1 text-xs font-semibold text-care">
              {t(language, food.source === "label_vision" ? "labelPhotoEstimateBadge" : "visionEstimateBadge")}
            </span>
          ) : null}
          {compassScore?.tier === "T1" && onToggleFavorite ? (
            <FoodFavoriteButton favorite={favorite} language={language} onToggle={onToggleFavorite} title={title} />
          ) : null}
        </div>
      </div>

      {food?.nutrition ? (
        <div className="mt-3">
          <FoodNutrientsBlock
            food={food}
            language={language}
            onPortionChange={onPortionChange}
            portionServings={portionServings}
            spokenSize={spokenSize}
          />
        </div>
      ) : null}

      {history ? (
        <div className="mt-3">
          <FoodHistoryBlock history={history} language={language} showGlucoseHistory={showGlucoseHistory} />
        </div>
      ) : null}

      {dayTotals.length > 0 ? (
        <div className="mt-3">
          <FoodTotalsBlock dayTotals={dayTotals} language={language} />
        </div>
      ) : null}

      {compassCarveOut || compassScore ? (
        <div className="mt-3">
          <FoodGuidanceSource kind="general" language={language} />
        </div>
      ) : null}

      {compassCarveOut ? (
        <div className="mt-3">
          <CompassCarveOut language={language} reason={compassCarveOut} />
        </div>
      ) : null}

      {compassScore ? (
        <div className="mt-3 grid gap-2">
          <CompassScoreRow estimatedDomains={estimatedDomains} language={language} score={compassScore} />
          <details className="rounded-control border border-ink/10 bg-white p-3">
            <summary className="cursor-pointer text-sm font-semibold text-care">
              {t(language, "compassBetterOptions")}
            </summary>
            <div className="mt-2">
              <CompassAlternatives alternatives={compassAlternatives} currentFcs={compassScore.fcs} language={language} />
            </div>
          </details>
        </div>
      ) : null}

      {food?.source === "fndds_lookup" && correctionCandidates.length > 0 && onCorrection ? (
        <div className="mt-3">
          <FoodCorrectionChips candidates={correctionCandidates} language={language} onCorrection={onCorrection} />
        </div>
      ) : null}

      {flags.length > 0 ? (
        <div className="mt-3">
          <FoodFlagsBlock flags={flags} language={language} />
        </div>
      ) : null}

      <div className="mt-4">
        <FoodActionsBlock
          canLog={canLog}
          language={language}
          logged={logged}
          onAddToPlate={food && onAddToPlate ? onAddToPlate : undefined}
          onLog={onLog}
        />
      </div>
    </section>
  );
}
