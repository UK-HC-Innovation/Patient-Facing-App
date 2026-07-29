"use client";

import React from "react";
import type { FamilyFlag } from "@/domain/types";
import { BTN_SECONDARY } from "@/components/family-theme";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

export type FamilyClinicNowCardProps = {
  flag: FamilyFlag;
  language: Language;
  /** Clinic the family is waiting on — the number they already have. */
  clinic: string;
  onAcknowledge: (flagId: string) => void;
};

/**
 * The clinic-now tier — deliberately NOT the crisis tier. Losing skills is worth
 * a phone call today, so this card says so and names the clinic. It does not
 * interrupt, does not lock voice or the page, does not claim a condition, and
 * does not promise the family will be seen sooner: a plain region a caregiver
 * can read, act on, and dismiss.
 */
export function FamilyClinicNowCard({ flag, language, clinic, onAcknowledge }: FamilyClinicNowCardProps) {
  const titleId = `family-clinic-now-${flag.id}`;

  return (
    <section
      id="family-clinic-now"
      data-testid="family-clinic-now-card"
      data-flag-source={flag.source}
      aria-labelledby={titleId}
      className="rounded-control border border-l-8 border-pulse/40 border-l-pulse bg-white p-4 scroll-mt-4"
    >
      <h2 id={titleId} className="break-words text-lg font-semibold text-pulse">
        {tFamily(language, "clinicNowTitle")}
      </h2>
      <p className="mt-2 break-words leading-relaxed text-ink">
        {tFamily(language, "clinicNowBody", { clinic })}
      </p>
      <button
        type="button"
        onClick={() => onAcknowledge(flag.id)}
        className={`mt-3 ${BTN_SECONDARY}`}
      >
        {tFamily(language, "clinicNowAck")}
      </button>
    </section>
  );
}
