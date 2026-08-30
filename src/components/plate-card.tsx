"use client";

import React from "react";
import type { FoodFlag, FoodFlagSeverity } from "@/domain/food-flags";
import type { CompassBand } from "@/domain/food-compass";
import type { PlateItem, PlateSummary } from "@/domain/plate";
import type { PlateCandidate } from "@/domain/plate-scan";
import { t, type FoodLensStringKey, type Language } from "@/i18n/strings";
import { FoodGuidanceSource } from "./food-guidance-source";

const bandClass: Record<CompassBand, string> = {
  encourage: "bg-emerald-50 text-emerald-700",
  moderate: "bg-amber-100 text-amber-800",
  minimize: "bg-pulse/10 text-pulse"
};

const bandLabel: Record<CompassBand, FoodLensStringKey> = {
  encourage: "compassBandEncourage",
  moderate: "compassBandModerate",
  minimize: "compassBandMinimize"
};

const severityClass: Record<FoodFlagSeverity, string> = {
  warning: "bg-pulse/10 text-pulse",
  caution: "bg-amber-100 text-amber-800",
  info: "bg-calm text-care"
};

function formatServings(servings: number): string {
  return Number.isInteger(servings) ? String(servings) : String(Math.round(servings * 10) / 10);
}

function previousServing(servings: number): number {
  return servings <= 1 ? 0.5 : servings - 1;
}

function nextServing(servings: number): number {
  return servings < 1 ? 1 : servings + 1;
}

export function PlateCard({
  items,
  summary,
  flags,
  language,
  onServingsChange,
  onRemove,
  onLog,
  candidates,
  onSelectCandidate
}: {
  items: PlateItem[];
  summary: PlateSummary;
  flags: FoodFlag[];
  language: Language;
  onServingsChange: (index: number, servings: number) => void;
  onRemove: (index: number) => void;
  onLog: () => void;
  /** Ledger rows a scanned item could also have been, keyed by plate-item id. */
  candidates?: Record<string, PlateCandidate[]>;
  onSelectCandidate?: (itemId: string, foodId: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  const nutritionRows = summary.nutrition
    ? [
        { key: "nutritionCalories" as const, value: summary.nutrition.calories, unit: "" },
        { key: "nutritionSodium" as const, value: summary.nutrition.sodiumMg, unit: "mg" },
        { key: "nutritionCarbs" as const, value: summary.nutrition.carbsG, unit: "g" },
        { key: "nutritionAddedSugars" as const, value: summary.nutrition.addedSugarsG, unit: "g" }
      ].filter((row) => row.value !== null)
    : [];

  return (
    <section className="rounded-control border border-care/25 bg-calm/40 p-4" data-testid="plate-card">
      <h2 className="text-lg font-semibold">{t(language, "plateTitle")}</h2>
      <ul className="mt-3 grid gap-3">
        {items.map((item, index) => {
          const name = item.food.brand ? `${item.food.brand} ${item.food.name}` : item.food.name;
          const itemId = item.id;
          // A scanned item keeps its swap chips until the patient either picks one or
          // corrects the portion; a hand-built plate item never had any.
          const itemCandidates = itemId ? (candidates?.[itemId] ?? []) : [];
          const selectCandidate =
            itemId && onSelectCandidate ? (foodId: string) => onSelectCandidate(itemId, foodId) : null;
          return (
            <li className="rounded-control border border-ink/10 bg-white p-3" data-testid="plate-item" key={item.id ?? `${item.food.id}-${index}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{name}</p>
                  {item.compassScore ? (
                    <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className={`rounded-full px-2 py-1 ${bandClass[item.compassScore.band]}`}>
                        {t(language, "plateItemScore", { score: item.compassScore.fcs })}
                      </span>
                      <span className="rounded-full bg-ink/5 px-2 py-1 text-ink/70">
                        {t(language, bandLabel[item.compassScore.band])}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-ink/60">{t(language, "plateNoScore")}</p>
                  )}
                  {item.portion?.basis ? (
                    <p className="mt-1 text-xs text-ink/65">
                      {t(language, "platePortionBasis", { basis: item.portion.basis })}
                    </p>
                  ) : null}
                </div>
                <button
                  aria-label={t(language, "plateRemove", { food: name })}
                  className="min-h-10 rounded-control border border-ink/15 px-3 text-xs font-semibold text-ink/70"
                  onClick={() => onRemove(index)}
                  type="button"
                >
                  {t(language, "plateRemove", { food: name })}
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  aria-label={t(language, "plateDecrease", { food: name })}
                  className="min-h-10 min-w-10 rounded-control border border-ink/15 bg-white font-semibold disabled:opacity-40"
                  disabled={item.servings <= 0.5}
                  onClick={() => onServingsChange(index, previousServing(item.servings))}
                  type="button"
                >
                  -
                </button>
                <span className="min-w-24 text-center text-xs font-semibold">
                  {t(language, "plateServings", { count: formatServings(item.servings) })}
                </span>
                <button
                  aria-label={t(language, "plateIncrease", { food: name })}
                  className="min-h-10 min-w-10 rounded-control border border-ink/15 bg-white font-semibold"
                  onClick={() => onServingsChange(index, nextServing(item.servings))}
                  type="button"
                >
                  +
                </button>
              </div>
              {itemCandidates.length > 0 && selectCandidate ? (
                <div className="mt-2 flex flex-wrap gap-2" data-testid="plate-item-candidates">
                  {itemCandidates.slice(0, 3).map((candidate) => (
                    <button
                      className="min-h-11 max-w-full break-words rounded-full border border-care/25 bg-white px-3 py-1 text-left text-sm font-medium text-care"
                      key={candidate.code}
                      onClick={() => selectCandidate(candidate.code)}
                      type="button"
                    >
                      {candidate.description}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* A plate of one is not an average. Below two items the headline is still the
          published score with its band; averaging language over a single published number
          under-claims a real value, and the reverse over-claims a computed one. */}
      {summary.plateAverage && items.length >= 2 ? (
        <div className="mt-3 rounded-control border border-care/20 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-ink/65">
                {t(language, "plateAverageEyebrow", { count: items.length })}
              </p>
              <p className="text-2xl font-semibold">{summary.plateAverage.fcs}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${bandClass[summary.plateAverage.band]}`}>
              {t(language, bandLabel[summary.plateAverage.band])}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-ink/65">{t(language, "plateAverageNote")}</p>
        </div>
      ) : null}

      {nutritionRows.length > 0 ? (
        <div className="mt-3 rounded-control bg-white p-3">
          <h3 className="text-sm font-semibold">{t(language, "plateNutritionTitle")}</h3>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            {nutritionRows.map((row) => (
              <div className="rounded-control bg-calm/60 px-3 py-2" key={row.key}>
                <dt className="text-xs text-ink/60">{t(language, row.key)}</dt>
                <dd className="font-semibold">
                  {row.value}
                  {row.unit ? ` ${row.unit}` : ""}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {summary.incomplete ? <p className="mt-2 text-xs text-ink/65">{t(language, "plateIncomplete")}</p> : null}

      {flags.length > 0 ? (
        <div className="mt-3 grid gap-2">
          <FoodGuidanceSource kind="personalized" language={language} />
          <ul className="grid gap-2">
            {flags.map((flag) => (
              <li className={`rounded-control px-3 py-2 text-sm font-medium ${severityClass[flag.severity]}`} key={flag.id}>
                {flag.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        className="mt-4 min-h-14 w-full rounded-control bg-care px-4 py-2 font-semibold text-white"
        onClick={onLog}
        type="button"
      >
        {t(language, "plateLog")}
      </button>
    </section>
  );
}
