"use client";

import React from "react";
import clsx from "clsx";
import type { Language } from "@/i18n/strings";

// Labels are proper names, so they stay untranslated and self-describing in
// either language; the surrounding label is bilingual for the same reason.
const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" }
];

// The header control: both labels always visible, each its own ≥44px target,
// and the inactive one a real word rather than a flag. "EN" is short enough to
// keep the pair on one line at 375px without shrinking either target.
const SEGMENTED_LABELS: Record<Language, string> = { en: "EN", es: "Español" };

type LanguageToggleProps = {
  language: Language;
  onChange: (language: Language) => void;
  compact?: boolean;
  /** Joined pair for a page header, instead of two free-standing buttons. */
  variant?: "buttons" | "segmented";
};

export function LanguageToggle({
  language,
  onChange,
  compact = false,
  variant = "buttons"
}: LanguageToggleProps) {
  if (variant === "segmented") {
    return (
      <div
        className="flex shrink-0 overflow-hidden rounded-control border border-care/40"
        role="group"
        aria-label="Language / Idioma"
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            lang={option.value}
            aria-pressed={language === option.value}
            onClick={() => onChange(option.value)}
            className={clsx(
              "min-h-12 min-w-[48px] px-3 text-sm",
              language === option.value
                ? "bg-care font-bold text-white"
                : "bg-white font-semibold text-care"
            )}
          >
            {SEGMENTED_LABELS[option.value]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={clsx(!compact && "grid gap-2")}>
      {!compact ? <p className="text-sm font-medium">Language / Idioma</p> : null}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Language / Idioma">
        {LANGUAGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            aria-pressed={language === option.value}
            lang={option.value}
            className={clsx(
              "min-h-12 rounded-control border px-4 py-2 text-sm font-semibold",
              language === option.value
                ? "border-care bg-calm text-care"
                : "border-ink/10 bg-white text-ink/70 hover:border-care"
            )}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      {!compact && language === "es" ? (
        <p className="text-sm leading-6 text-ink/70" lang="es">
          El español de esta demo está pendiente de revisión por una persona hablante nativa, y algunas páginas siguen
          solo en inglés.
        </p>
      ) : null}
    </div>
  );
}
