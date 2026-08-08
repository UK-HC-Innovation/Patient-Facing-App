"use client";

import React from "react";
import { CONTROL_FOCUS } from "@/components/family-theme";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

export type FamilyAiConsentCardProps = {
  language: Language;
  onAccept: () => void;
  onDecline: () => void;
};

/**
 * F1b. The just-in-time ask, shown only after a turn has already been answered
 * on the device — so the caregiver reads it holding their answer, not standing
 * in front of it. That ordering is deliberate: the front door stays one box and
 * one button (specs 18/19), and the network stays shut until this is answered.
 *
 * It is not styled as a warning. Declining is a first-class outcome, listed
 * second only because "keep everything here" is what already happened.
 */
export function FamilyAiConsentCard({ language, onAccept, onDecline }: FamilyAiConsentCardProps) {
  return (
    <section
      data-testid="family-ai-consent"
      aria-labelledby="family-ai-consent-title"
      className="rounded-control border border-care/25 bg-white p-4"
    >
      <h2 id="family-ai-consent-title" className="break-words font-semibold text-care">
        {tFamily(language, "aiConsentTitle")}
      </h2>
      <p className="mt-1 break-words text-sm leading-6 text-ink/80">
        {tFamily(language, "aiConsentBody")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="family-ai-consent-accept"
          onClick={onAccept}
          className={`min-h-12 min-w-0 break-words rounded-control bg-care px-4 py-2 font-semibold text-white ${CONTROL_FOCUS}`}
        >
          {tFamily(language, "aiConsentAccept")}
        </button>
        <button
          type="button"
          data-testid="family-ai-consent-decline"
          onClick={onDecline}
          className={`min-h-12 min-w-0 break-words rounded-control border border-care/30 bg-white px-4 py-2 font-semibold text-care ${CONTROL_FOCUS}`}
        >
          {tFamily(language, "aiConsentDecline")}
        </button>
      </div>
    </section>
  );
}
