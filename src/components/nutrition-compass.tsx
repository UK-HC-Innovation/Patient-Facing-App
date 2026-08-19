import React from "react";
import type { CalorieDensityBand, CompassBand, CompassScore } from "@/domain/food-compass";

const DENSITY_SEGMENTS = [
  { min: 0, max: 60, start: 0, end: 25 },
  { min: 60, max: 150, start: 25, end: 50 },
  { min: 150, max: 400, start: 50, end: 75 },
  { min: 400, max: 900, start: 75, end: 100 }
] as const;

const DENSITY_LABELS = ["Very low", "Low", "Medium", "High"] as const;
const MARKER_EDGE_INSET = 5;

const MARKER_COLOR: Record<CompassBand, string> = {
  encourage: "bg-emerald-700",
  moderate: "bg-amber-800",
  minimize: "bg-pulse"
};

const BAND_LABEL: Record<CompassBand, string> = {
  encourage: "Encourage",
  moderate: "Moderate",
  minimize: "Minimize"
};

const DENSITY_BAND_LABEL: Record<CalorieDensityBand, string> = {
  very_low: "Very low",
  low: "Low",
  medium: "Medium",
  high: "High",
  unknown: "Unknown"
};

type NutritionCompassState = "idle" | "pending" | "no_match" | "carve_out";

type NutritionCompassProps = {
  foodName?: string | null;
  onRequestFood?: () => void;
  requestLabel?: string;
  score?: CompassScore | null;
  state?: NutritionCompassState;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundPosition(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Maps the four published calorie-density bands to equal visual widths, while
 * retaining the food's position inside its band. The visible band labels make
 * the categorical scale explicit instead of implying equal numeric intervals.
 */
export function calorieDensityPlotPosition(kcalPer100g: number): number {
  const density = clamp(kcalPer100g, DENSITY_SEGMENTS[0].min, DENSITY_SEGMENTS.at(-1)?.max ?? 900);
  const segment = DENSITY_SEGMENTS.find(({ max }) => density <= max) ?? DENSITY_SEGMENTS.at(-1);
  if (!segment) {
    return 50;
  }
  const progress = (density - segment.min) / (segment.max - segment.min);
  const rawPosition = segment.start + progress * (segment.end - segment.start);
  return roundPosition(clamp(rawPosition, MARKER_EDGE_INSET, 100 - MARKER_EDGE_INSET));
}

export function nutritionScorePlotPosition(fcs: number): number {
  const normalized = ((clamp(fcs, 1, 100) - 1) / 99) * 100;
  return roundPosition(clamp(normalized, MARKER_EDGE_INSET, 100 - MARKER_EDGE_INSET));
}

function stateMessage(state: NutritionCompassState): string {
  if (state === "pending") {
    return "Finding this food's place on the compass…";
  }
  if (state === "no_match") {
    return "No published match to plot yet. Try a simpler food name.";
  }
  if (state === "carve_out") {
    return "This food is outside the Food Compass scoring range, so it is not plotted.";
  }
  return "Point at a food or type one to place it on the compass.";
}

function plotStateMessage(state: NutritionCompassState): string {
  if (state === "pending") {
    return "Finding its place…";
  }
  if (state === "no_match") {
    return "No point to plot yet";
  }
  if (state === "carve_out") {
    return "Outside score range";
  }
  return "Waiting for a food";
}

export function NutritionCompass({
  foodName,
  onRequestFood,
  requestLabel = "Describe a food",
  score,
  state = "idle"
}: NutritionCompassProps) {
  const density = score?.calorieDensity.kcalPer100g ?? null;
  const hasPlotPoint = Boolean(score && density !== null);
  const position = score && density !== null
    ? {
        x: calorieDensityPlotPosition(density),
        y: nutritionScorePlotPosition(score.fcs)
      }
    : null;

  const summary = score
    ? density === null
      ? `${foodName ?? "This food"}: ${score.fcs} / 100 nutrition score · calorie density unavailable.`
      : `${foodName ?? "This food"}: ${score.fcs} / 100 nutrition score · ${BAND_LABEL[score.band]} · ${DENSITY_BAND_LABEL[score.calorieDensity.band]} calorie density · ${density} kcal / 100 g.`
    : stateMessage(state);

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
            Nutrition compass
          </h2>
          <p className="text-xs text-ink/75">X: calorie density · Y: Food Compass nutrition score</p>
        </div>
        {score ? (
          <span className="shrink-0 rounded-control bg-calm px-2 py-1 text-xs font-semibold text-care">
            {score.fcs} / 100
          </span>
        ) : null}
      </div>

      <figure className="mt-3">
        <p aria-hidden="true" className="mb-1 pl-7 text-[11px] font-semibold uppercase tracking-wide text-ink/75">
          Higher nutrition score ↑
        </p>
        <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-1">
          <div aria-hidden="true" className="flex h-36 flex-col justify-between py-0.5 text-right text-[11px] font-medium text-ink/75">
            <span>100</span>
            <span>50</span>
            <span>1</span>
          </div>

          <div className="relative h-36 overflow-hidden rounded-control border border-ink/15 bg-white" data-testid="nutrition-compass-plot">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[30%] bg-emerald-50/80" />
            <div aria-hidden="true" className="absolute inset-x-0 top-[30%] h-[40%] bg-amber-50/80" />
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[30%] bg-pulse/5" />

            <div aria-hidden="true" className="absolute inset-y-0 left-1/4 border-l border-dashed border-ink/15" />
            <div aria-hidden="true" className="absolute inset-y-0 left-1/2 border-l border-ink/20" />
            <div aria-hidden="true" className="absolute inset-y-0 left-3/4 border-l border-dashed border-ink/15" />
            <div aria-hidden="true" className="absolute inset-x-0 top-[30%] border-t border-dashed border-ink/15" />
            <div aria-hidden="true" className="absolute inset-x-0 top-[70%] border-t border-dashed border-ink/15" />

            <span aria-hidden="true" className="absolute right-2 top-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
              Encourage
            </span>
            <span aria-hidden="true" className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
              Moderate
            </span>
            <span aria-hidden="true" className="absolute bottom-1 right-2 text-[10px] font-semibold uppercase tracking-wide text-pulse">
              Minimize
            </span>

            {position ? (
              <span
                aria-hidden="true"
                className={`absolute z-10 grid h-8 w-8 -translate-x-1/2 translate-y-1/2 place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-md ${MARKER_COLOR[score?.band ?? "moderate"]}`}
                data-testid="nutrition-compass-marker"
                data-x-percent={position.x}
                data-y-percent={position.y}
                style={{ left: `${position.x}%`, bottom: `${position.y}%` }}
              >
                {score?.fcs}
              </span>
            ) : onRequestFood && !score && (state === "idle" || state === "no_match") ? (
              <button
                className="absolute left-1/2 top-1/2 min-h-12 max-w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-control border-2 border-care/35 bg-white px-4 py-2 text-center text-sm font-semibold text-care shadow-sm transition hover:bg-calm active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care"
                onClick={onRequestFood}
                type="button"
              >
                {requestLabel}
              </button>
            ) : (
              <span className="absolute left-1/2 top-1/2 max-w-[75%] -translate-x-1/2 -translate-y-1/2 rounded-control border border-dashed border-ink/30 bg-white px-3 py-2 text-center text-xs font-semibold text-ink/75">
                {score && !hasPlotPoint ? "Calorie density unavailable" : plotStateMessage(state)}
              </span>
            )}
          </div>

          <span aria-hidden="true" />
          <div aria-hidden="true" className="grid grid-cols-4 text-center text-[10px] font-medium text-ink/75">
            {DENSITY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>

        <div aria-hidden="true" className="ml-7 mt-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-ink/75">
          <span>Lower</span>
          <span>Calorie density →</span>
          <span>Higher</span>
        </div>
        <figcaption aria-live="polite" className="mt-2 text-xs font-medium text-ink/70">
          {summary}
        </figcaption>
      </figure>
    </section>
  );
}
