"use client";

import React from "react";
import type { FamilyClinicNowTarget } from "@/domain/family-clinic-now";
import type { FamilyFlag } from "@/domain/types";
import { BTN_SECONDARY, CONTROL_FOCUS } from "@/components/family-theme";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

export type FamilyClinicNowCardProps = {
  flag: FamilyFlag;
  language: Language;
  /**
   * Who to call, already resolved from the family's own record. Never a default
   * clinic: the card may only name a relationship the family actually has.
   */
  target: FamilyClinicNowTarget;
  onAcknowledge: (flagId: string) => void;
};

const BODY_KEYS: Record<FamilyClinicNowTarget["kind"], FamilyStringKey> = {
  referral: "clinicNowBody",
  first_steps: "clinicNowBodyFirstSteps",
  generic: "clinicNowBodyGeneric"
};

/**
 * The clinic-now tier — deliberately NOT the crisis tier. Losing skills is worth
 * a phone call today, so this card says so and names who to call. It does not
 * interrupt, does not lock voice or the page, does not claim a condition, and
 * does not promise the family will be seen sooner: a plain region a caregiver
 * can read, act on, and dismiss.
 *
 * It also never invents a contact. The name comes from the family's referral or
 * from their county's First Steps point of entry; the number, when there is one,
 * comes out of the verified catalog verbatim (FR-1).
 */
export function FamilyClinicNowCard({ flag, language, target, onAcknowledge }: FamilyClinicNowCardProps) {
  const titleId = `family-clinic-now-${flag.id}`;
  const phone = target.kind === "generic" ? undefined : target;

  return (
    <section
      id="family-clinic-now"
      data-testid="family-clinic-now-card"
      data-flag-source={flag.source}
      data-clinic-now-target={target.kind}
      aria-labelledby={titleId}
      className="rounded-control border border-l-8 border-pulse/40 border-l-pulse bg-white p-4 scroll-mt-4"
    >
      <h2 id={titleId} className="break-words text-lg font-semibold text-pulse">
        {tFamily(language, "clinicNowTitle")}
      </h2>
      <p className="mt-2 break-words leading-relaxed text-ink">
        {tFamily(language, BODY_KEYS[target.kind], {
          clinic: target.kind === "referral" ? target.clinic : "",
          office: target.kind === "first_steps" ? target.office : ""
        })}
      </p>
      {phone?.number && phone.tel ? (
        <p className="mt-3">
          <a
            href={phone.tel}
            data-testid="family-clinic-now-call"
            className={`inline-flex min-h-12 items-center break-words rounded-control bg-care px-4 py-2 font-semibold text-white ${CONTROL_FOCUS}`}
          >
            {tFamily(language, "resourceCallNumber", { number: phone.number })}
          </a>
        </p>
      ) : null}
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
