"use client";

import React, { useEffect, useRef, type ReactNode } from "react";
import { t, type FoodLensStringKey, type Language } from "@/i18n/strings";
import { tSafety } from "@/i18n/strings";
import type { CompassBand, CompassScore, NotScoreableReason } from "@/domain/food-compass";
import type { LiveCandidate } from "@/hooks/use-live-food-score";
import { CompassDomainList, carveOutStringKey, compassBandStringKey, type CompassBreakdown } from "./compass-score";
import { useViewfinderVisible } from "./food-lens-shell";

const VERDICT_SENTENCE: Record<CompassBand, FoodLensStringKey> = {
  encourage: "verdictEncourage",
  moderate: "verdictModerate",
  minimize: "verdictMinimize"
};

const VERDICT_CHIP: Record<CompassBand, string> = {
  encourage: "bg-emerald-100 text-emerald-900",
  moderate: "bg-amber-100 text-amber-900",
  minimize: "bg-pulse/10 text-pulse"
};

const VERDICT_FIGURE: Record<CompassBand, string> = {
  encourage: "text-emerald-700",
  moderate: "text-amber-800",
  minimize: "text-pulse"
};

/**
 * Band chip, sentence, number -- the answer, said once, on the first screen.
 *
 * A carve-out takes this position and this type size with no number slot at all. The 50px
 * figure is absent rather than zeroed or greyed, because a dimmed dash reads as a bad score.
 */
export function FoodVerdict({
  language,
  score,
  foodName,
  carveOutReason
}: {
  language: Language;
  score: CompassScore | null;
  foodName: string | null;
  carveOutReason: NotScoreableReason | null;
}) {
  // The sticky strip prints the food's name once the viewfinder is gone, so the verdict
  // stops printing it: the name appears exactly once on any screenful.
  const viewfinderVisible = useViewfinderVisible();

  if (carveOutReason) {
    return (
      <section aria-label={t(language, "notScored")} className="grid gap-2">
        <p className="text-[21px] font-semibold leading-tight tracking-tight">
          {t(language, carveOutStringKey(carveOutReason))}
        </p>
      </section>
    );
  }

  if (!score) {
    return null;
  }

  const density = score.calorieDensity.kcalPer100g;
  const subline = [
    viewfinderVisible && foodName ? foodName : null,
    density !== null ? `${(density / 100).toFixed(1)} kcal/g` : null
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  return (
    <section className="flex items-start gap-4" data-testid="food-verdict">
      <div className="min-w-0 flex-1">
        <span
          className={`inline-block rounded-md px-2 py-0.5 text-[13px] font-bold uppercase tracking-wide ${VERDICT_CHIP[score.band]}`}
        >
          {t(language, compassBandStringKey(score.band))}
        </span>
        <p className="mt-2 text-[21px] font-semibold leading-tight tracking-tight">
          {t(language, VERDICT_SENTENCE[score.band])}
        </p>
        {subline ? <p className="mt-1.5 text-[15px] leading-normal text-ink/70">{subline}</p> : null}
        {score.ambiguous && score.range ? (
          <p className="mt-1 text-xs text-ink/65">
            {t(language, "compassAmbiguous", { low: score.range[0], high: score.range[1] })}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-[50px] font-semibold leading-none tracking-tighter ${VERDICT_FIGURE[score.band]}`}>
          {score.fcs}
        </p>
        <p className="mt-0.5 text-[13px] font-semibold text-ink/55">{t(language, "verdictOutOf100")}</p>
        <p className="mt-0.5 text-[11px] font-medium text-ink/60">{t(language, "compassScoreLabel")}</p>
        {score.tier === "T2" ? (
          <span className="mt-1 inline-block rounded-control bg-calm px-2 py-1 text-[11px] font-semibold text-care">
            {t(language, "compassEstimateBadge")}
          </span>
        ) : null}
      </div>
    </section>
  );
}

/**
 * F9's domain breakdown, hoisted out of the score row into its own slot so the chart marker
 * can open it. Opening moves focus to the heading and brings the panel with it; closing
 * hands focus back to the marker that opened it.
 */
export function FoodWhyScore({
  open,
  breakdown,
  tier,
  language,
  onClose
}: {
  open: boolean;
  breakdown: CompassBreakdown | null;
  tier: CompassScore["tier"];
  language: Language;
  onClose: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    // Focus and scroll have to arrive together, and they have to arrive clear of the
    // sticky strip above and the pinned voice bar below -- so the panel is centred rather
    // than left at whichever edge focus() would have parked it against.
    headingRef.current?.focus({ preventScroll: true });
    const reduced =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    panelRef.current?.scrollIntoView?.({ block: "center", behavior: reduced ? "auto" : "smooth" });
  }, [open]);

  if (!open || !breakdown) {
    return null;
  }

  return (
    <section
      aria-label={t(language, "compassWhyScore")}
      className="scroll-mt-16 rounded-xl border border-ink/12 bg-calm/50 p-3.5"
      data-testid="why-score"
      ref={panelRef}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[15px] font-semibold outline-none" ref={headingRef} tabIndex={-1}>
          {t(language, "compassWhyScore")}
        </h2>
        <button
          className="min-h-11 shrink-0 rounded-md border border-ink/15 bg-white px-3 text-sm font-semibold text-care"
          onClick={onClose}
          type="button"
        >
          {t(language, "whyScoreClose")}
        </button>
      </div>
      <div className="mt-2">
        <CompassDomainList breakdown={breakdown} language={language} tier={tier} />
      </div>
    </section>
  );
}

/**
 * No published score for what the lens saw. The three candidates are FNDDS names read
 * straight from the table, so they carry no translation of their own.
 */
export function FoodNoMatch({
  candidates,
  language,
  onSelect
}: {
  candidates: LiveCandidate[];
  language: Language;
  onSelect?: (foodId: string) => void;
}) {
  const shown = candidates.slice(0, 3);
  return (
    <section aria-label={t(language, "noMatchLabel")} className="grid gap-2" data-testid="food-no-match">
      <p className="text-[15px] leading-normal text-ink/75">{t(language, "compassNoPublishedScore")}</p>
      {shown.length > 0 && onSelect ? (
        <>
          <p className="text-[13px] font-semibold text-ink/70">{t(language, "sayOneOfThese")}</p>
          <div className="flex flex-wrap gap-2">
            {shown.map((candidate) => (
              <button
                className="min-h-11 max-w-full break-words rounded-md border border-care/25 bg-white px-3 text-left text-sm font-medium text-care"
                key={candidate.code}
                onClick={() => onSelect(candidate.code)}
                type="button"
              >
                {candidate.description}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

/** Nothing identified yet. F14's real job is giving this screen an action. */
export function FoodEmptyState({
  language,
  offersSavedPicks = true,
  children
}: {
  language: Language;
  /**
   * The standard body offers a food you have had before. A store-free mount cannot, so it
   * says nothing rather than promising an action that is not there.
   */
  offersSavedPicks?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="grid gap-2" data-testid="food-empty">
      <p className="text-[21px] font-semibold leading-tight tracking-tight">{t(language, "nothingInView")}</p>
      {offersSavedPicks ? (
        <p className="text-[15px] leading-normal text-ink/70">{t(language, "nothingInViewBody")}</p>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Always last, always present.
 *
 * The gate's claim leads: "frames go out only while the viewfinder is on your screen" is a
 * sentence a patient can verify with their own thumb, which is more than the rest of this
 * copy can offer. Whether it may replace the repeated inline guidance sentences instead of
 * joining them is spec 9's open compliance question, so for now it joins them.
 */
export function FoodAttribution({ language, children }: { language: Language; children?: ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-ink/10 pt-3" data-testid="food-attribution">
      <div className="rounded-xl border border-care/20 bg-calm/40 p-3.5">
        <p className="text-[13px] font-bold uppercase tracking-wider text-care">{t(language, "cameraPrivacyLabel")}</p>
        <p className="mt-1.5 text-[15px] leading-normal text-ink/80">{t(language, "gatePrivacyClaim")}</p>
      </div>
      {children}
      <p className="text-[13px] leading-normal text-ink/55">{t(language, "attributionLine")}</p>
    </section>
  );
}

/**
 * The shell must be able to stop being the shell: camera unmounted, loop explicitly
 * disarmed, mic and keyboard dead until the crisis response is acknowledged.
 */
export function FoodCrisisLock({ language, children }: { language: Language; children: ReactNode }) {
  return (
    <section aria-label={tSafety(language, "voicePausedForSafety")} className="grid gap-3 p-4" data-testid="food-crisis-lock">
      <p className="text-[21px] font-semibold leading-tight tracking-tight">
        {tSafety(language, "voicePausedForSafety")}
      </p>
      {children}
      <p className="rounded-xl border border-ink/15 bg-calm px-3 py-3 text-[15px] leading-normal text-ink/80">
        {tSafety(language, "crisisLockNote")}
      </p>
    </section>
  );
}
