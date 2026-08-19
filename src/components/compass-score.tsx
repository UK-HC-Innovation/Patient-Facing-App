"use client";

import React from "react";
import { t, type FoodLensStringKey, type Language } from "@/i18n/strings";
import type {
  CalorieDensityBand,
  CompassAlternative,
  CompassBand,
  CompassScore,
  NotScoreableReason
} from "@/domain/food-compass";

// Measured, not asserted: the packaged-group mean absolute error from the T2 simulation in
// docs/qa/2026-08-18-fcs-validation.md. Re-run scripts/fcs-validate.mjs if the engine changes.
export const T2_MEASURED_MAE = 14;

const BAND_LABEL: Record<CompassBand, FoodLensStringKey> = {
  encourage: "compassBandEncourage",
  moderate: "compassBandModerate",
  minimize: "compassBandMinimize"
};

const BAND_RING: Record<CompassBand, string> = {
  encourage: "text-emerald-600",
  moderate: "text-amber-500",
  minimize: "text-pulse"
};

const BAND_CHIP: Record<CompassBand, string> = {
  encourage: "bg-emerald-50 text-emerald-700",
  moderate: "bg-amber-100 text-amber-800",
  minimize: "bg-pulse/10 text-pulse"
};

const DENSITY_LABEL: Record<CalorieDensityBand, FoodLensStringKey> = {
  very_low: "compassDensityVeryLow",
  low: "compassDensityLow",
  medium: "compassDensityMedium",
  high: "compassDensityHigh",
  unknown: "compassDensityUnknown"
};

const CARVE_OUT_COPY: Record<NotScoreableReason, FoodLensStringKey> = {
  zero_calorie: "compassCarveOutZeroCalorie",
  below_5kcal: "compassCarveOutBelow5",
  alcohol: "compassCarveOutAlcohol",
  infant: "compassCarveOutInfant",
  specialized: "compassCarveOutSpecialized"
};

const DIAL_RADIUS = 22;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

/** The number, ringed by how far along the 1-100 scale it sits. */
export function CompassDial({ fcs, band, size = 56 }: { fcs: number; band: CompassBand; size?: number }) {
  const filled = (Math.max(1, Math.min(100, fcs)) / 100) * DIAL_CIRCUMFERENCE;
  return (
    <svg aria-hidden="true" className={BAND_RING[band]} height={size} viewBox="0 0 56 56" width={size}>
      <circle cx="28" cy="28" fill="none" r={DIAL_RADIUS} stroke="currentColor" strokeOpacity="0.18" strokeWidth="5" />
      <circle
        cx="28"
        cy="28"
        fill="none"
        r={DIAL_RADIUS}
        stroke="currentColor"
        strokeDasharray={`${filled} ${DIAL_CIRCUMFERENCE}`}
        strokeLinecap="round"
        strokeWidth="5"
        transform="rotate(-90 28 28)"
      />
      <text
        className="fill-current text-lg font-semibold"
        dominantBaseline="central"
        textAnchor="middle"
        x="28"
        y="29"
      >
        {fcs}
      </text>
    </svg>
  );
}

export function CompassCarveOut({ reason, language }: { reason: NotScoreableReason; language: Language }) {
  return (
    <div className="rounded-control bg-calm px-3 py-3 text-sm font-medium text-care">
      {t(language, CARVE_OUT_COPY[reason])}
    </div>
  );
}

export function CompassScoreRow({
  score,
  language,
  compact = false
}: {
  score: CompassScore;
  language: Language;
  compact?: boolean;
}) {
  const density = score.calorieDensity;
  const missing = score.coverage?.missing ?? [];

  return (
    <div className="grid gap-2 rounded-control bg-calm/60 p-3">
      <div className="flex items-center gap-3">
        <CompassDial band={score.band} fcs={score.fcs} size={compact ? 48 : 56} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink/60">
            {t(language, "compassScoreLabel")} · {t(language, "compassOutOf100")}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded-control px-2 py-1 text-xs font-semibold ${BAND_CHIP[score.band]}`}>
              {t(language, BAND_LABEL[score.band])}
            </span>
            {score.tier === "T2" ? (
              <span className="rounded-control bg-white px-2 py-1 text-xs font-semibold text-ink/70">
                {t(language, "compassEstimateBadge")}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <p className="text-xs text-ink/65">
        {t(language, "compassCalorieDensity")}:{" "}
        <span className="font-semibold">{t(language, DENSITY_LABEL[density.band])}</span>
        {density.kcalPer100g !== null ? ` · ${density.kcalPer100g} kcal / 100 g` : ""}
      </p>

      {score.ambiguous && score.range ? (
        <p className="text-xs text-ink/65">
          {t(language, "compassAmbiguous", { low: score.range[0], high: score.range[1] })}
        </p>
      ) : null}

      {score.tier === "T2" ? (
        <p className="text-xs text-ink/65">{t(language, "compassEstimateNote", { mae: T2_MEASURED_MAE })}</p>
      ) : null}

      {missing.length > 0 ? (
        <p className="text-xs text-ink/55">{t(language, "compassMissingDomains", { domains: missing.join(", ") })}</p>
      ) : null}
    </div>
  );
}

export function CompassAlternatives({
  alternatives,
  language
}: {
  alternatives: CompassAlternative[];
  language: Language;
}) {
  if (alternatives.length === 0) {
    return <p className="text-sm text-ink/65">{t(language, "compassAlreadyBest")}</p>;
  }

  return (
    <ul className="grid gap-2">
      {alternatives.map((alternative) => (
        <li className="rounded-control border border-ink/10 bg-white p-3" key={alternative.code}>
          <div className="flex items-start gap-3">
            <CompassDial band={alternative.band} fcs={alternative.fcs} size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{alternative.description}</p>
              {alternative.calorieDensity.kcalPer100g !== null ? (
                <p className="text-xs text-ink/60">{alternative.calorieDensity.kcalPer100g} kcal / 100 g</p>
              ) : null}
              <a
                className="mt-1 inline-block text-xs font-semibold text-care underline"
                href={alternative.recipeSearchUrl}
                rel="noreferrer noopener"
                target="_blank"
              >
                {t(language, "compassRecipeLink")}
              </a>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * The viewfinder overlay, top-right. Five states, and the ones that matter are the two
 * that show no number: "hidden" when the loop is off or locked, and the carve-out chip
 * for a food outside the score's range.
 */
export function CompassViewfinderBadge({
  badge,
  fcs,
  band,
  tier,
  name,
  language,
  onTap
}: {
  badge: "hidden" | "idle" | "pending" | "score" | "carve_out";
  fcs?: number;
  band?: CompassBand;
  tier?: "T1" | "T2";
  name?: string;
  language: Language;
  onTap?: () => void;
}) {
  if (badge === "hidden") {
    return null;
  }

  const shell = "absolute right-3 top-3 max-w-[55%] rounded-control bg-white/92 px-3 py-2 shadow-sm";

  if (badge === "idle") {
    return (
      <div className={`${shell} text-xs font-medium text-ink/60`}>{t(language, "compassPointAtFood")}</div>
    );
  }

  if (badge === "pending") {
    return (
      <div className={`${shell} text-xs font-medium text-ink/60`} role="status">
        <span className="animate-pulse">{t(language, "compassScoring")}</span>
      </div>
    );
  }

  if (badge === "carve_out") {
    return <div className={`${shell} text-xs font-semibold text-care`}>{t(language, "compassCarveOutZeroCalorie")}</div>;
  }

  if (fcs === undefined || band === undefined) {
    return null;
  }

  return (
    <button className={`${shell} flex items-center gap-2 text-left`} onClick={onTap} type="button">
      <CompassDial band={band} fcs={fcs} size={40} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-ink">{name ?? ""}</span>
        <span className="block text-[11px] font-medium text-ink/60">
          {t(language, BAND_LABEL[band])}
          {tier === "T2" ? ` · ${t(language, "compassEstimateBadge")}` : ""}
        </span>
      </span>
    </button>
  );
}
