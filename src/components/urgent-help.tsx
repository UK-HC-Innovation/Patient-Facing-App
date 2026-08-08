"use client";

import { MessageCircle, Phone, ShieldAlert } from "lucide-react";
import React from "react";
import { tSafety, type Language } from "@/i18n/strings";

// A persistent, always-reachable crisis affordance. It never touches an LLM and
// never depends on a stored clinic number: the links are the same offline-safe
// tel:/sms: crisis deep links the safety gate hands out (988/911), so a patient
// who cannot compose a sentence still has one tap to help.
export function UrgentHelp({
  language = "en",
  // F2a. The default summary — "Feeling unsafe right now?" — speaks to the
  // reader as the person at risk, which is right in the coach and wrong on the
  // family surface, where the caregiver is usually reporting about their child.
  // The links are identical either way; only the sentence over them changes.
  summary
}: {
  language?: Language;
  summary?: string;
}) {
  const heading = summary ?? tSafety(language, "urgentHelpSummary");
  return (
    <section aria-label={heading} className="rounded-control border border-rose-300 bg-rose-50 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-rose-800">
        <ShieldAlert aria-hidden="true" className="h-4 w-4" />
        {heading}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a className="inline-flex min-h-12 items-center gap-2 rounded-control bg-rose-600 px-4 py-2 text-sm font-semibold text-white" href="tel:988">
          <Phone aria-hidden="true" className="h-4 w-4" />
          {tSafety(language, "crisisCall988")}
        </a>
        <a className="inline-flex min-h-12 items-center gap-2 rounded-control border border-rose-500 px-4 py-2 text-sm font-semibold text-rose-700" href="sms:988">
          <MessageCircle aria-hidden="true" className="h-4 w-4" />
          {tSafety(language, "crisisText988")}
        </a>
        <a className="inline-flex min-h-12 items-center gap-2 rounded-control bg-rose-700 px-4 py-2 text-sm font-semibold text-white" href="tel:911">
          <ShieldAlert aria-hidden="true" className="h-4 w-4" />
          {tSafety(language, "callEmergency")}
        </a>
      </div>
    </section>
  );
}
