import React from "react";
import type { CompassScore } from "@/domain/food-compass";
import { t, type FoodLensStringKey, type Language } from "@/i18n/strings";

const FCS_QUADRANT_THRESHOLD = 70;
const DENSITY_QUADRANT_THRESHOLD_KCAL_PER_G = 2.5;
const DENSITY_PLOT_MAX_KCAL_PER_G = 9;
const MARKER_EDGE_INSET = 4;
const LOWER_QUADRANT_HEIGHT =
  (DENSITY_QUADRANT_THRESHOLD_KCAL_PER_G / DENSITY_PLOT_MAX_KCAL_PER_G) * 100;

export type NutritionQuadrant = "limit" | "moderate" | "be_mindful" | "choose_often";

const QUADRANT_LABEL: Record<NutritionQuadrant, FoodLensStringKey> = {
  limit: "nutritionCompassQuadrantLimit",
  moderate: "nutritionCompassQuadrantModerate",
  be_mindful: "nutritionCompassQuadrantMindful",
  choose_often: "nutritionCompassQuadrantOften"
};

const MARKER_COLOR: Record<NutritionQuadrant, string> = {
  limit: "bg-rose-700",
  moderate: "bg-amber-700",
  be_mindful: "bg-orange-700",
  choose_often: "bg-emerald-700"
};

type NutritionCompassState = "idle" | "pending" | "no_match" | "carve_out";

type NutritionCompassProps = {
  foodName?: string | null;
  language?: Language;
  score?: CompassScore | null;
  state?: NutritionCompassState;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundPosition(value: number): number {
  return Math.round(value * 10) / 10;
}

export function calorieDensityKcalPerGram(kcalPer100g: number): number {
  return kcalPer100g / 100;
}

/** Plot 0–9 kcal/g linearly, matching the prototype reference. Values above 9 remain factual in the caption. */
export function calorieDensityPlotPosition(kcalPer100g: number): number {
  const densityPerGram = clamp(calorieDensityKcalPerGram(kcalPer100g), 0, DENSITY_PLOT_MAX_KCAL_PER_G);
  const normalized = (densityPerGram / DENSITY_PLOT_MAX_KCAL_PER_G) * 100;
  return roundPosition(clamp(normalized, MARKER_EDGE_INSET, 100 - MARKER_EDGE_INSET));
}

export function nutritionScorePlotPosition(fcs: number): number {
  const normalized = (clamp(fcs, 0, 100) / 100) * 100;
  return roundPosition(clamp(normalized, MARKER_EDGE_INSET, 100 - MARKER_EDGE_INSET));
}

export function nutritionQuadrant(fcs: number, kcalPer100g: number): NutritionQuadrant {
  const higherScore = fcs >= FCS_QUADRANT_THRESHOLD;
  const lowerDensity = calorieDensityKcalPerGram(kcalPer100g) < DENSITY_QUADRANT_THRESHOLD_KCAL_PER_G;
  if (higherScore && lowerDensity) return "choose_often";
  if (higherScore) return "moderate";
  if (lowerDensity) return "be_mindful";
  return "limit";
}

function stateMessage(language: Language, state: NutritionCompassState): string {
  if (state === "pending") return t(language, "nutritionCompassStatePending");
  if (state === "no_match") return t(language, "nutritionCompassStateNoMatch");
  if (state === "carve_out") return t(language, "nutritionCompassStateCarveOut");
  return t(language, "nutritionCompassStateIdle");
}

function plotStateMessage(language: Language, state: NutritionCompassState): string {
  if (state === "pending") return t(language, "nutritionCompassPlotPending");
  if (state === "no_match") return t(language, "nutritionCompassPlotNoMatch");
  if (state === "carve_out") return t(language, "nutritionCompassPlotCarveOut");
  return t(language, "nutritionCompassPlotIdle");
}

export function NutritionCompass({ foodName, language = "en", score, state = "idle" }: NutritionCompassProps) {
  const densityPer100g = score?.calorieDensity.kcalPer100g ?? null;
  const densityPerGram = densityPer100g === null ? null : calorieDensityKcalPerGram(densityPer100g);
  const quadrant = score && densityPer100g !== null ? nutritionQuadrant(score.fcs, densityPer100g) : null;
  const position = score && densityPer100g !== null
    ? {
        x: nutritionScorePlotPosition(score.fcs),
        y: calorieDensityPlotPosition(densityPer100g)
      }
    : null;

  const summary = score
    ? densityPer100g === null || densityPerGram === null || quadrant === null
      ? t(language, "nutritionCompassSummaryNoDensity", {
          food: foodName ?? t(language, "unknownFood"),
          score: score.fcs
        })
      : t(language, "nutritionCompassSummary", {
          food: foodName ?? t(language, "unknownFood"),
          score: score.fcs,
          density: densityPerGram.toFixed(2),
          per100g: densityPer100g,
          quadrant: t(language, QUADRANT_LABEL[quadrant])
        })
    : stateMessage(language, state);

  return (
    <section
      aria-busy={state === "pending"}
      aria-labelledby="nutrition-compass-title"
      className="rounded-control border border-ink/10 bg-white p-3 shadow-sm"
      data-testid="nutrition-compass"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" id="nutrition-compass-title">
            {t(language, "nutritionCompassTitle")}
          </h2>
          <p className="text-xs text-ink/75">{t(language, "nutritionCompassAxes")}</p>
        </div>
        {score ? (
          <span className="shrink-0 rounded-control bg-calm px-2 py-1 text-xs font-semibold text-care">
            {score.fcs} / 100
          </span>
        ) : null}
      </div>

      <figure className="mt-3">
        <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-1">
          <div
            aria-hidden="true"
            className="flex h-64 flex-col justify-between py-0.5 text-right text-[11px] font-medium text-ink/75 sm:h-80"
          >
            <span>9</span>
            <span>6</span>
            <span>3</span>
            <span>0</span>
          </div>

          <div
            className="relative h-64 overflow-hidden rounded-control border border-ink/25 bg-white sm:h-80"
            data-testid="nutrition-compass-plot"
          >
            <div
              aria-hidden="true"
              className="absolute left-0 top-0 w-[70%] bg-rose-100"
              style={{ height: `${100 - LOWER_QUADRANT_HEIGHT}%` }}
            />
            <div
              aria-hidden="true"
              className="absolute right-0 top-0 w-[30%] bg-amber-100"
              style={{ height: `${100 - LOWER_QUADRANT_HEIGHT}%` }}
            />
            <div
              aria-hidden="true"
              className="absolute bottom-0 left-0 w-[70%] bg-orange-100"
              style={{ height: `${LOWER_QUADRANT_HEIGHT}%` }}
            />
            <div
              aria-hidden="true"
              className="absolute bottom-0 right-0 w-[30%] bg-emerald-100"
              style={{ height: `${LOWER_QUADRANT_HEIGHT}%` }}
            />

            <div aria-hidden="true" className="absolute inset-y-0 left-[70%] border-l border-ink/25" />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-ink/25"
              style={{ bottom: `${LOWER_QUADRANT_HEIGHT}%` }}
            />
            <div aria-hidden="true" className="absolute inset-x-0 top-1/3 border-t border-dashed border-ink/15" />
            <div aria-hidden="true" className="absolute inset-x-0 top-2/3 border-t border-dashed border-ink/15" />

            <span aria-hidden="true" className="absolute left-2 top-2 text-[10px] font-bold uppercase tracking-wide text-rose-800">
              {t(language, "nutritionCompassQuadrantLimit")}
            </span>
            <span aria-hidden="true" className="absolute right-2 top-2 text-[10px] font-bold uppercase tracking-wide text-amber-900">
              {t(language, "nutritionCompassQuadrantModerate")}
            </span>
            <span aria-hidden="true" className="absolute bottom-[22%] left-2 text-[10px] font-bold uppercase tracking-wide text-orange-900">
              {t(language, "nutritionCompassQuadrantMindful")}
            </span>
            <span aria-hidden="true" className="absolute bottom-[22%] right-2 text-[10px] font-bold uppercase tracking-wide text-emerald-900">
              {t(language, "nutritionCompassQuadrantOften")}
            </span>

            {position && quadrant ? (
              <span
                aria-hidden="true"
                className={`absolute z-10 grid h-8 w-8 -translate-x-1/2 translate-y-1/2 place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-md ${MARKER_COLOR[quadrant]}`}
                data-quadrant={quadrant}
                data-testid="nutrition-compass-marker"
                data-x-percent={position.x}
                data-y-percent={position.y}
                style={{ left: `${position.x}%`, bottom: `${position.y}%` }}
              >
                {score?.fcs}
              </span>
            ) : (
              <span className="absolute left-1/2 top-1/2 max-w-[75%] -translate-x-1/2 -translate-y-1/2 rounded-control border border-dashed border-ink/30 bg-white/95 px-3 py-2 text-center text-xs font-semibold text-ink/75">
                {score ? t(language, "nutritionCompassDensityUnavailable") : plotStateMessage(language, state)}
              </span>
            )}
          </div>

          <span aria-hidden="true" />
          <div aria-hidden="true" className="relative h-5 text-[11px] font-medium text-ink/75">
            <span className="absolute left-0">0</span>
            <span className="absolute left-[70%] -translate-x-1/2">70</span>
            <span className="absolute right-0">100</span>
          </div>
        </div>

        <div aria-hidden="true" className="ml-7 mt-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-ink/75">
          <span>{t(language, "nutritionCompassLower")}</span>
          <span>{t(language, "nutritionCompassScoreAxis")}</span>
          <span>{t(language, "nutritionCompassHigher")}</span>
        </div>
        <p aria-hidden="true" className="mt-1 text-center text-[11px] font-semibold text-ink/75">
          {t(language, "nutritionCompassHigherDensity")}
        </p>
        <figcaption aria-live="polite" className="mt-2 text-xs font-medium text-ink/70">
          {summary}
        </figcaption>
        <p className="mt-1 text-[11px] text-ink/70">
          {t(language, "nutritionCompassExplanation")}
        </p>
      </figure>
    </section>
  );
}
