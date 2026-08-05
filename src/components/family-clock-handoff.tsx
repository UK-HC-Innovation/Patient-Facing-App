"use client";

import React from "react";
import { getFamilyResourceById } from "@/domain/family-resources";
import { CONTROL_FOCUS, NOTICE_INFO } from "@/components/family-theme";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

/**
 * F7c. What replaces the countdown when the countdown ends.
 *
 * Past the First Steps cutoff `firstStepsClock` returns null, and until now that
 * meant the one dated thing on a family's page simply disappeared — no line, no
 * reason, and no word about the route that continues. A closed window is not the
 * end of the path; it is the point where the school district becomes the door.
 * Calm and one line, never a siren: nothing here is late, and nothing is lost.
 */
const SCHOOL_ROUTE_ID = "kde_evaluation_request";

export type FamilyClockHandoffProps = {
  language: Language;
  childName: string;
};

export function FamilyClockHandoff({ language, childName }: FamilyClockHandoffProps) {
  // Copy-only when the catalog no longer carries the entry — the sentence is
  // true either way, and a dead link would be worse than no link.
  const route = getFamilyResourceById(SCHOOL_ROUTE_ID);

  return (
    <section
      id="family-clock-handoff"
      data-testid="family-clock-handoff"
      aria-label={tFamily(language, "clockHandoffLink")}
      className={NOTICE_INFO}
    >
      <p className="break-words text-sm leading-6">
        {tFamily(language, "clockHandoff", { name: childName })}
      </p>
      {route ? (
        <a
          href={route.sourceUrl}
          target="_blank"
          rel="noreferrer"
          data-testid="family-clock-handoff-link"
          className={`mt-2 inline-flex min-h-12 min-w-0 items-center break-words text-sm font-semibold text-care underline underline-offset-4 ${CONTROL_FOCUS}`}
        >
          {tFamily(language, "clockHandoffLink")}
        </a>
      ) : null}
    </section>
  );
}
