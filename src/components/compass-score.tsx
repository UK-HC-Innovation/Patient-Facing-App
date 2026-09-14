"use client";

import React, { useState } from "react";
import { t, type FoodLensStringKey, type Language } from "@/i18n/strings";
import type {
  CalorieDensity,
  CalorieDensityBand,
  CompassAlternative,
  CompassBand,
  CompassScore,
  DomainKey,
  NoScoreSwapId,
  ScoreDomainBreakdown,
  NotScoreableReason,
  SwapAction,
  SwapState
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
  encourage: "text-emerald-700",
  moderate: "text-amber-800",
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

const DOMAIN_LABEL: Record<DomainKey, FoodLensStringKey> = {
  D1: "compassDomainD1",
  D2: "compassDomainD2",
  D3: "compassDomainD3",
  D4: "compassDomainD4",
  D5: "compassDomainD5",
  D6: "compassDomainD6",
  D7: "compassDomainD7",
  D8: "compassDomainD8",
  D9: "compassDomainD9"
};

function signedContribution(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded >= 0 ? "+" : ""}${rounded}`;
}

/** The shipped carve-out sentence for a food outside the score's range. */
export function carveOutStringKey(reason: NotScoreableReason): FoodLensStringKey {
  return CARVE_OUT_COPY[reason];
}

export function compassBandStringKey(band: CompassBand): FoodLensStringKey {
  return BAND_LABEL[band];
}

export type CompassBreakdown = { domains: ScoreDomainBreakdown["domains"]; coverage: ScoreDomainBreakdown["coverage"] };

/** A published score carries no `partial` list; an estimate does. */
export function resolveDomainBreakdown(
  score: CompassScore | null,
  estimatedDomains: ScoreDomainBreakdown | null
): CompassBreakdown | null {
  if (estimatedDomains) {
    return estimatedDomains;
  }
  if (score?.domains && score.coverage) {
    return { domains: score.domains, coverage: { ...score.coverage, partial: [] } };
  }
  return null;
}

/** F9's domain breakdown, unchanged whether it is disclosed inline or hoisted into a slot. */
export function CompassDomainList({
  breakdown,
  tier,
  language
}: {
  breakdown: CompassBreakdown;
  tier: CompassScore["tier"];
  language: Language;
}) {
  return (
    <div className="grid gap-2 text-xs text-ink/70">
      {/* A published score's drivers are derived here, not published. Without this the
          per-domain figures read as Food Compass data they are not. */}
      {tier === "T1" ? <p>{t(language, "estimatedDrivers")}</p> : null}
      <ul className="grid gap-1">
        {breakdown.domains.map((domain) => (
          <li className="flex justify-between gap-3" key={domain.key}>
            <span>{t(language, DOMAIN_LABEL[domain.key])}</span>
            <span className="font-semibold text-ink">{signedContribution(domain.value)}</span>
          </li>
        ))}
      </ul>
      {breakdown.coverage.missing.length > 0 ? (
        <p>
          {t(language, "compassNotAssessable", {
            domains: breakdown.coverage.missing.map((key) => t(language, DOMAIN_LABEL[key])).join(", ")
          })}
        </p>
      ) : null}
      {breakdown.coverage.partial.length > 0 ? (
        <p>
          {t(language, "compassPartlyAssessable", {
            domains: breakdown.coverage.partial.map((key) => t(language, DOMAIN_LABEL[key])).join(", ")
          })}
        </p>
      ) : null}
    </div>
  );
}

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
  estimatedDomains = null,
  compact = false
}: {
  score: CompassScore;
  language: Language;
  estimatedDomains?: ScoreDomainBreakdown | null;
  compact?: boolean;
}) {
  const density = score.calorieDensity;
  const breakdown = resolveDomainBreakdown(score, estimatedDomains);

  return (
    <div className="grid gap-2 rounded-control bg-calm/60 p-3">
      <div className="flex items-center gap-3">
        <CompassDial band={score.band} fcs={score.fcs} size={compact ? 48 : 56} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink/70">
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
        {density.estimate ? `${t(language, "compassDensityEstimated")} ` : ""}
        <span className="font-semibold">{t(language, DENSITY_LABEL[density.band])}</span>
        {density.kcalPer100g !== null
          ? ` · ${t(language, "compassKcalPer100g", { calories: density.kcalPer100g })}`
          : ""}
      </p>

      {score.ambiguous && score.range ? (
        <p className="text-xs text-ink/65">
          {t(language, "compassAmbiguous", { low: score.range[0], high: score.range[1] })}
        </p>
      ) : null}

      {score.tier === "T2" ? (
        <p className="text-xs text-ink/65">{t(language, "compassEstimateNote", { mae: T2_MEASURED_MAE })}</p>
      ) : null}

      {breakdown ? (
        <details className="rounded-control border border-ink/10 bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold text-care">{t(language, "compassWhyScore")}</summary>
          <div className="mt-2">
            <CompassDomainList breakdown={breakdown} language={language} tier={score.tier} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

const ACTION_LABEL: Record<SwapAction, FoodLensStringKey> = {
  bake: "actionBake",
  skin_off: "actionSkinOff",
  no_added_fat: "actionNoAddedFat",
  whole_grain: "actionWholeGrain",
  lower_sodium: "actionLowerSodium",
  unsweetened: "actionUnsweetened"
};

const STATE_LINE: Record<"affirm" | "similar" | "none_higher", FoodLensStringKey> = {
  affirm: "swapAffirm",
  similar: "swapSimilar",
  none_higher: "compassNoCloseMatch"
};

const NO_SCORE_NAME: Record<NoScoreSwapId, FoodLensStringKey> = {
  water_or_unsweetened_tea: "swapWaterOrTea",
  black_coffee: "swapBlackCoffee"
};

/** What "Use this instead" hands back to the door: a row to confirm, or a no-score swap. */
export type SwapChoice =
  | { kind: "published"; code: string; description: string }
  | { kind: "no_score"; id: NoScoreSwapId };

export type SwapSide = {
  name: string;
  fcs: number | null;
  band: CompassBand | null;
  calorieDensity: CalorieDensity | null;
};

function sideLine(side: SwapSide, language: Language): string {
  return [
    side.name,
    side.fcs === null ? t(language, "notScored") : `${side.fcs} ${t(language, "compassOutOf100")}`,
    side.band ? t(language, BAND_LABEL[side.band]) : null,
    side.calorieDensity?.kcalPer100g != null
      ? t(language, "compassKcalPer100g", { calories: side.calorieDensity.kcalPer100g })
      : null
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

/**
 * The swap slot (spec 31 R5, R6): one swap with "More swaps" on request, or one line.
 *
 * Replaces the "Better options" heading, its three cards and the public door's sort control.
 * A tap on a swap opens the comparison in place; "Use this instead" makes it the current
 * choice through the door's own path. Opening the comparison logs and stores nothing.
 */
export function CompassSwaps({
  state,
  noScoreSwap,
  alternatives,
  current,
  language,
  onUse
}: {
  state: SwapState;
  noScoreSwap: NoScoreSwapId | null;
  alternatives: CompassAlternative[];
  current: SwapSide;
  language: Language;
  onUse?: (choice: SwapChoice) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  if (state === "affirm" || state === "similar" || state === "none_higher") {
    return (
      <p className="text-sm text-ink/75" data-swap-state={state} data-testid="food-alternatives">
        {t(language, STATE_LINE[state])}
      </p>
    );
  }

  const noScore = state === "no_score_swap" ? noScoreSwap ?? "water_or_unsweetened_tea" : null;
  const [first, ...rest] = alternatives;
  if (!noScore && !first) {
    return null;
  }
  const more = noScore ? alternatives : rest;

  const row = (
    key: string,
    lead: string,
    detail: string | null,
    side: SwapSide,
    choice: SwapChoice,
    recipeQuery: string | null
  ) => {
    const expanded = openKey === key;
    return (
      <li className="rounded-control border border-ink/10 bg-white p-3" key={key}>
        <button
          aria-expanded={expanded}
          className="flex min-h-11 w-full items-start gap-3 text-left"
          onClick={() => setOpenKey(expanded ? null : key)}
          type="button"
        >
          {side.fcs !== null && side.band ? <CompassDial band={side.band} fcs={side.fcs} size={40} /> : null}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">{lead}</span>
            {detail ? <span className="block text-xs text-ink/70">{detail}</span> : null}
          </span>
        </button>
        {recipeQuery ? (
          <a
            className="mt-2 inline-block text-xs font-semibold text-care underline"
            href={`https://www.google.com/search?q=${encodeURIComponent(recipeQuery)}`}
            rel="noreferrer noopener"
            target="_blank"
          >
            {t(language, "recipeSearch")}
          </a>
        ) : null}
        {expanded ? (
          <div className="mt-2 grid gap-2">
            <div className="grid gap-1 rounded-control bg-calm/60 px-3 py-2 text-xs text-ink/75">
              <p>{sideLine(current, language)}</p>
              <p className="font-semibold text-ink">{sideLine({ ...side, name: lead }, language)}</p>
            </div>
            {onUse ? (
              <button
                className="min-h-11 justify-self-start rounded-control bg-care px-4 py-2 text-sm font-semibold text-white"
                onClick={() => onUse(choice)}
                type="button"
              >
                {t(language, "swapUse")}
              </button>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  };

  const published = (alternative: CompassAlternative, isDefault: boolean) => {
    const lead = alternative.action
      ? t(language, ACTION_LABEL[alternative.action])
      : alternative.displayName?.[language] ?? alternative.description;
    return row(
      alternative.code,
      lead,
      lead === alternative.description ? null : t(language, "identityReviewScoredAs", { row: alternative.description }),
      { name: lead, fcs: alternative.fcs, band: alternative.band, calorieDensity: alternative.calorieDensity },
      { kind: "published", code: alternative.code, description: alternative.description },
      isDefault ? alternative.recipeQuery?.[language] ?? null : null
    );
  };

  return (
    <section aria-label={t(language, "swapLead")} className="grid gap-2" data-swap-state={state} data-testid="food-alternatives">
      <p className="text-sm font-semibold text-ink/75">{t(language, "swapLead")}</p>
      <ul className="grid gap-2">
        {noScore
          ? row(
              `no-score-${noScore}`,
              t(language, NO_SCORE_NAME[noScore]),
              t(language, "compassCarveOutBelow5"),
              { name: t(language, NO_SCORE_NAME[noScore]), fcs: null, band: null, calorieDensity: null },
              { kind: "no_score", id: noScore },
              null
            )
          : published(first, true)}
        {showMore ? more.map((alternative) => published(alternative, false)) : null}
      </ul>
      {more.length > 0 && !showMore ? (
        <button
          aria-expanded={false}
          className="min-h-11 justify-self-start text-sm font-semibold text-care underline"
          onClick={() => setShowMore(true)}
          type="button"
        >
          {t(language, "swapMore", { count: more.length })}
        </button>
      ) : null}
    </section>
  );
}

/**
 * The viewfinder overlay, top-right. Six states, and the ones that matter are the three
 * that show no number: "hidden" when the loop is off or locked, and the carve-out chip
 * for a food outside the score's range, plus an actionable idle-recovery chip.
 */
export function CompassViewfinderBadge({
  badge,
  fcs,
  band,
  tier,
  name,
  language,
  onTap,
  placement = "top-right"
}: {
  badge: "hidden" | "idle" | "pending" | "score" | "carve_out" | "scan_again";
  fcs?: number;
  band?: CompassBand;
  tier?: "T1" | "T2";
  name?: string;
  language: Language;
  onTap?: () => void;
  /** The shell puts the trust pill top-right, so the badge moves out of its way. */
  placement?: "top-right" | "bottom-right";
}) {
  if (badge === "hidden") {
    return null;
  }

  const shell = `absolute right-3 ${
    placement === "bottom-right" ? "bottom-3" : "top-3"
  } max-w-[55%] rounded-control bg-white/92 px-3 py-2 shadow-sm`;

  if (badge === "scan_again") {
    return onTap ? (
      <button className={`${shell} min-h-11 text-xs font-semibold text-care`} onClick={onTap} type="button">
        {t(language, "scanAgain")}
      </button>
    ) : (
      <div className={`${shell} text-xs font-semibold text-care`}>{t(language, "scanAgain")}</div>
    );
  }

  if (badge === "idle") {
    return (
      <div className={`${shell} text-xs font-medium text-ink/70`}>{t(language, "compassPointAtFood")}</div>
    );
  }

  if (badge === "pending") {
    return (
      <div className={`${shell} text-xs font-medium text-ink/70`} role="status">
        <span className="animate-pulse">{t(language, "compassScoring")}</span>
      </div>
    );
  }

  if (badge === "carve_out") {
    // The badge reports the state; the carve-out sentence belongs to the verdict, which is
    // the one place the product says it.
    return <div className={`${shell} text-xs font-semibold text-care`}>{t(language, "notScored")}</div>;
  }

  if (fcs === undefined || band === undefined) {
    return null;
  }

  const content = (
    <>
      <CompassDial band={band} fcs={fcs} size={40} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-ink">{name ?? ""}</span>
        <span className="block text-[11px] font-medium text-ink/70">
          {t(language, BAND_LABEL[band])}
          {tier === "T2" ? ` · ${t(language, "compassEstimateBadge")}` : ""}
        </span>
      </span>
    </>
  );

  return onTap ? (
    <button
      aria-label={t(language, "compassScoreDetails", {
        food: name ?? t(language, "compassIdentifiedFood")
      })}
      className={`${shell} flex items-center gap-2 text-left`}
      onClick={onTap}
      type="button"
    >
      {content}
    </button>
  ) : (
    <div className={`${shell} flex items-center gap-2 text-left`}>{content}</div>
  );
}
