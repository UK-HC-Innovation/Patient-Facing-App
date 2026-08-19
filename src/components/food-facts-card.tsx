"use client";

import React from "react";
import { t, type FoodLensStringKey, type Language } from "@/i18n/strings";
import type { FoodFlag, FoodFlagSeverity } from "@/domain/food-flags";
import type { IdentifiedFood, NutritionFacts } from "@/domain/types";
import type { CompassAlternative, CompassScore, NotScoreableReason } from "@/domain/food-compass";
import { CompassAlternatives, CompassCarveOut, CompassScoreRow } from "./compass-score";

const severityClass: Record<FoodFlagSeverity, string> = {
  warning: "bg-pulse/10 text-pulse",
  caution: "bg-amber-100 text-amber-800",
  info: "bg-calm text-care"
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

export function FoodFactsCard({
  food,
  flags,
  logged,
  canLog,
  onLog,
  language,
  portionServings,
  onPortionChange,
  compassScore = null,
  compassCarveOut = null,
  compassAlternatives = []
}: {
  food: IdentifiedFood | null;
  flags: FoodFlag[];
  logged: boolean;
  canLog: boolean;
  onLog: () => void;
  language: Language;
  portionServings: number;
  onPortionChange: (servings: number) => void;
  compassScore?: CompassScore | null;
  compassCarveOut?: NotScoreableReason | null;
  compassAlternatives?: CompassAlternative[];
}) {
  const title = food ? (food.brand ? `${food.brand} ${food.name}` : food.name) : t(language, "unknownFood");
  const portionLabel = formatServingCount(portionServings);
  const nutritionRows = food?.nutrition ? buildNutritionRows(food.nutrition).filter((row) => row.value !== null) : [];

  return (
    <section className="rounded-control border border-ink/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {food?.nutrition ? <p className="text-sm text-ink/65">{food.nutrition.servingSize}</p> : null}
        </div>
        {food && food.source === "vision_estimate" ? (
          <span className="rounded-control bg-calm px-2 py-1 text-xs font-semibold text-care">{t(language, "visionEstimateBadge")}</span>
        ) : null}
      </div>

      {food?.nutrition ? (
        <div className="mt-3 grid gap-3 rounded-control bg-calm/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink/75">
              {t(language, "portionAssuming", { servings: portionLabel })}
            </p>
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
      ) : null}

      {compassCarveOut ? (
        <div className="mt-3">
          <CompassCarveOut language={language} reason={compassCarveOut} />
        </div>
      ) : null}

      {compassScore ? (
        <div className="mt-3 grid gap-2">
          <CompassScoreRow language={language} score={compassScore} />
          <details className="rounded-control border border-ink/10 bg-white p-3">
            <summary className="cursor-pointer text-sm font-semibold text-care">
              {t(language, "compassBetterOptions")}
            </summary>
            <div className="mt-2">
              <CompassAlternatives alternatives={compassAlternatives} language={language} />
            </div>
          </details>
        </div>
      ) : null}

      {flags.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {flags.map((flag) => (
            <li key={flag.id} className={`rounded-control px-3 py-2 text-sm font-medium ${severityClass[flag.severity]}`}>
              {flag.text}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4">
        {logged ? (
          <p className="text-sm font-semibold text-care">{t(language, "loggedConfirmation")}</p>
        ) : (
          <button
            className="min-h-14 w-full rounded-control bg-care px-4 py-2 font-semibold text-white disabled:opacity-40"
            disabled={!canLog}
            onClick={onLog}
            type="button"
          >
            {t(language, "logThis")}
          </button>
        )}
      </div>
    </section>
  );
}
