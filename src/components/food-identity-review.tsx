"use client";

import React, { useEffect, useRef } from "react";
import type { LiveIdentityCandidate } from "@/hooks/use-live-food-score";
import { t, type Language } from "@/i18n/strings";

export function FoodIdentityReview({
  candidate,
  language,
  onConfirm,
  onReject
}: {
  candidate: LiveIdentityCandidate;
  language: Language;
  onConfirm: (foodId: string) => void;
  onReject: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => headingRef.current?.focus(), [candidate.food.code]);

  return (
    <section aria-labelledby="food-identity-review-title" className="grid gap-3" data-testid="food-identity-review">
      <div>
        <h2 className="text-[15px] font-semibold outline-none" id="food-identity-review-title" ref={headingRef} tabIndex={-1}>
          {t(language, "identityReviewLabel")}
        </h2>
        <p className="mt-1 text-[21px] font-semibold leading-tight tracking-tight">
          {t(language, "identityReviewRead", { food: candidate.food.description })}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          className="min-h-11 rounded-control bg-care px-4 py-2 text-sm font-semibold text-white"
          onClick={() => onConfirm(candidate.food.code)}
          type="button"
        >
          {t(language, "identityReviewConfirm")}
        </button>
        <button
          className="min-h-11 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care"
          onClick={onReject}
          type="button"
        >
          {t(language, "identityReviewReject")}
        </button>
      </div>
    </section>
  );
}

export function FoodPackageAbstention({
  language,
  onScanAgain
}: {
  language: Language;
  onScanAgain?: () => void;
}) {
  return (
    <section aria-label={t(language, "packageDetectedTitle")} className="grid gap-2" data-testid="food-package-abstention">
      <p className="text-[21px] font-semibold leading-tight tracking-tight">{t(language, "packageDetectedTitle")}</p>
      <p className="text-[15px] leading-normal text-ink/75">{t(language, "packageDetectedBody")}</p>
      {onScanAgain ? (
        <button
          className="min-h-11 justify-self-start rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care"
          onClick={onScanAgain}
          type="button"
        >
          {t(language, "scanAgain")}
        </button>
      ) : null}
    </section>
  );
}
