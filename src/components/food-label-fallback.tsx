"use client";

import React from "react";
import { t, type Language } from "@/i18n/strings";

export type LabelFallbackState = "idle" | "reading" | "error";

export function FoodLabelFallback({
  language,
  state,
  onRead
}: {
  language: Language;
  state: LabelFallbackState;
  onRead: () => void;
}) {
  return (
    <section
      aria-label={t(language, "labelPhotoRegion")}
      aria-live="polite"
      className="rounded-control border border-care/20 bg-calm/40 p-3"
    >
      {state === "idle" ? (
        <button
          className="min-h-12 w-full rounded-control border border-care bg-white px-4 py-2 font-semibold text-care"
          onClick={onRead}
          type="button"
        >
          {t(language, "labelScoreFromPhoto")}
        </button>
      ) : state === "reading" ? (
        <p className="text-sm font-semibold text-care">{t(language, "labelReadingPhoto")}</p>
      ) : (
        <p className="text-sm font-medium text-ink/75" role="alert">
          {t(language, "labelReadFailure")}
        </p>
      )}
    </section>
  );
}
