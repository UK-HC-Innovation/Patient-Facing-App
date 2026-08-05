"use client";

import React from "react";
import { NOTICE_INFO } from "@/components/family-theme";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

/**
 * "Some of this is still in English", said where it happens.
 *
 * F6a. Every catalog entry and every guide is English in both languages — that
 * is a named non-goal, because translating them needs native-speaker review
 * (spec 09 FR-17). What was not honest was saying so on one surface out of four:
 * the Programs library carried this notice while the in-thread answer cards, the
 * fallback cards, and the guide strip — the surfaces a Spanish reader actually
 * meets first — said nothing at all.
 *
 * One notice per group of English content, never per card.
 */
export function FamilySourceLanguageNotice({
  language,
  testId
}: {
  language: Language;
  testId: string;
}) {
  if (language !== "es") return null;
  return (
    <p data-testid={testId} className={`text-sm text-ink/80 ${NOTICE_INFO}`}>
      {tFamily(language, "resourceSourceLanguageNotice")}
    </p>
  );
}

/**
 * F6b. The `lang` for catalog-derived text while the app is in Spanish.
 *
 * `lang={language}` wraps the whole page, so a Spanish screen-reader voice was
 * reading English program names, summaries and steps with Spanish phonetics —
 * "Michelle P. Waiver" pronounced as if it were Spanish. Marking the English
 * nodes switches the voice back for exactly those nodes.
 */
export function sourceContentLang(language: Language): "en" | undefined {
  return language === "es" ? "en" : undefined;
}
