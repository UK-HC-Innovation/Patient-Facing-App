"use client";

import React, { useEffect, useRef } from "react";
import type { BarcodeReviewController } from "@/hooks/use-barcode-review";
import { t, type Language } from "@/i18n/strings";

export function FoodBarcodeReview({
  controller,
  language
}: {
  controller: BarcodeReviewController;
  language: Language;
}) {
  const { state } = controller;
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (state.active) headingRef.current?.focus();
  }, [state.active, state.code, state.status]);

  if (!state.active) return null;

  const foodName = state.food
    ? [state.food.brand, state.food.name].filter(Boolean).join(" ")
    : null;

  return (
    <section
      aria-label={t(language, "packageScanRegion")}
      className="grid gap-3 rounded-xl border border-care/20 bg-calm/40 p-3.5"
      data-testid="food-barcode-review"
    >
      <div>
        <h2 className="text-[15px] font-semibold outline-none" ref={headingRef} tabIndex={-1}>
          {t(language, "packageScanRegion")}
        </h2>
        {state.status === "looking_up" ? (
          <p aria-live="polite" className="mt-1 text-sm text-ink/75">
            {t(language, "packageBarcodeLooking", { barcode: state.code })}
          </p>
        ) : state.status === "review" ? (
          <p className="mt-1 text-[18px] font-semibold leading-tight">
            {t(language, "packageBarcodeFound", { food: foodName ?? state.food.name })}
          </p>
        ) : state.status === "confirmed" ? (
          <p className="mt-1 text-[18px] font-semibold leading-tight">
            {t(language, "packageConfirmed", { food: foodName ?? state.food.name })}
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink/75" role={state.status === "error" ? "alert" : undefined}>
            {t(language, state.status === "miss" ? "barcodeReviewMiss" : "packageBarcodeError")}
          </p>
        )}
        <p className="mt-1 break-all text-xs text-ink/60">{state.code}</p>
      </div>

      {state.status === "review" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            className="min-h-11 rounded-control bg-care px-4 py-2 text-sm font-semibold text-white"
            onClick={controller.confirm}
            type="button"
          >
            {t(language, "packageBarcodeUse")}
          </button>
          <button
            className="min-h-11 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care"
            onClick={controller.reject}
            type="button"
          >
            {t(language, "packageBarcodeReject")}
          </button>
        </div>
      ) : state.status === "error" || state.status === "miss" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            className="min-h-11 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care"
            onClick={() => void controller.retry()}
            type="button"
          >
            {t(language, "retry")}
          </button>
          <button
            className="min-h-11 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care"
            onClick={controller.cancel}
            type="button"
          >
            {t(language, "packageDisclosureNotNow")}
          </button>
        </div>
      ) : (
        <button
          className="min-h-11 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care"
          onClick={controller.cancel}
          type="button"
        >
          {state.status === "confirmed"
            ? t(language, "packageScanAnother")
            : t(language, "packageDisclosureNotNow")}
        </button>
      )}
    </section>
  );
}
