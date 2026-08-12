"use client";

import React, { useId, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { FamilySafetyContacts } from "@/components/family-safety-contacts";
import { CONTROL_FOCUS } from "@/components/family-theme";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

export type FamilyUrgentHelpControlProps = {
  language: Language;
};

/**
 * F2c. A compact, always-reachable way back to the urgent contacts, shown on
 * every Ladder surface once a caregiver has disclosed at least once.
 *
 * The acknowledge button on the crisis banner used to be the end of the road:
 * it said "I've seen this — continue" and took every 988/911 route off the page,
 * with nothing anywhere telling a caregiver how to get them back. Standing the
 * banner down is right; making the numbers unfindable is not.
 *
 * It is not styled as an alarm. A permanent red control at the top of a
 * developmental-resources app is its own kind of harm — the point is that the
 * route exists, not that the page keeps shouting.
 */
export function FamilyUrgentHelpControl({ language }: FamilyUrgentHelpControlProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="family-urgent-help-control"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex min-h-12 min-w-0 items-center gap-1.5 break-words rounded-control border border-rose-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-rose-800 ${CONTROL_FOCUS}`}
      >
        <LifeBuoy aria-hidden="true" className="h-4 w-4" />
        {tFamily(language, "safetyReopen")}
      </button>
      {open ? (
        <div
          id={panelId}
          data-testid="family-urgent-help-panel"
          role="group"
          aria-label={tFamily(language, "safetyReopen")}
          className="absolute right-0 z-10 mt-2 w-72 max-w-[80vw] rounded-control border-2 border-rose-300 bg-white p-3 shadow-lg"
        >
          <FamilySafetyContacts
            events={[]}
            language={language}
            summary={tFamily(language, "safetyHeading")}
            directory
          />
        </div>
      ) : null}
    </div>
  );
}
