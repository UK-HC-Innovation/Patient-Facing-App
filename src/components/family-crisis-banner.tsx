"use client";

import React from "react";
import { UrgentHelp } from "@/components/urgent-help";
import type { FamilySafetyEvent } from "@/domain/types";
import { tSafety, type Language } from "@/i18n/strings";

export type FamilyCrisisBannerProps = {
  event: FamilySafetyEvent;
  language: Language;
  onAcknowledge: (eventId: string) => void;
};

// Which fixed copy a family disclosure gets. Same strings the coach uses — the
// family surface never authors its own crisis words.
function safetyCopyKey(event: FamilySafetyEvent) {
  if (event.domain === "abuse") return "abuseResponse" as const;
  if (event.domain === "harm_to_others") return "harmToOthersResponse" as const;
  if (event.domain === "social") return "socialEmergencyResponse" as const;
  if (event.tier === "emergency") return "emergencyResponseSuffix" as const;
  return "crisisResponse" as const;
}

/**
 * Shown inline in the thread when a caregiver's words trip a safety rule. It does
 * not end the conversation: the navigator keeps working underneath it, because a
 * caregiver describing a child in crisis is exactly who this tool is for.
 */
export function FamilyCrisisBanner({ event, language, onAcknowledge }: FamilyCrisisBannerProps) {
  const acknowledged = event.acknowledgedAt !== undefined;

  return (
    <section
      role="alert"
      data-testid="family-crisis-banner"
      data-safety-domain={event.domain}
      aria-labelledby={`family-safety-${event.id}`}
      className="rounded-control border-2 border-l-8 border-rose-400 bg-rose-50 p-4"
    >
      <h2 id={`family-safety-${event.id}`} className="sr-only">
        {tSafety(language, "urgentHelpSummary")}
      </h2>
      <p className="break-words font-medium leading-relaxed text-ink">{tSafety(language, safetyCopyKey(event))}</p>
      <div className="mt-3">
        <UrgentHelp language={language} />
      </div>
      {!acknowledged ? (
        <button
          type="button"
          onClick={() => onAcknowledge(event.id)}
          className="mt-3 min-h-12 min-w-0 break-words rounded-control bg-rose-700 px-4 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care"
        >
          {tSafety(language, "crisisAcknowledge")}
        </button>
      ) : null}
    </section>
  );
}
