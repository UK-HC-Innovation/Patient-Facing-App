"use client";

import React, { useEffect, useRef } from "react";
import { UrgentHelp } from "@/components/urgent-help";
import type { FamilySafetyEvent } from "@/domain/types";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import { type Language } from "@/i18n/strings";

export type FamilyCrisisBannerProps = {
  event: FamilySafetyEvent;
  language: Language;
  onAcknowledge: (eventId: string) => void;
};

/**
 * F2a. Which of Ladder's own safety strings a disclosure gets.
 *
 * This used to resolve into the coach's `tSafety` copy, which is written in the
 * first person to an adult describing their own crisis. A caregiver writing that
 * their child wants to die was answered with "you may be going through something
 * painful" and told to move things they could hurt *themselves* with out of
 * reach. The detector reports a domain and never a subject, so the replacement
 * copy is household-neutral by design rather than by guess.
 */
function safetyCopyKey(event: FamilySafetyEvent): FamilyStringKey {
  if (event.domain === "abuse") return "safetyAbuse";
  if (event.domain === "harm_to_others") return "safetyHarmToOthers";
  if (event.domain === "social") return "safetySocial";
  if (event.tier === "emergency") return "safetyEmergency";
  return "safetyCrisis";
}

/**
 * Shown inline in the thread when a caregiver's words trip a safety rule. It does
 * not end the conversation: the navigator keeps working underneath it, because a
 * caregiver describing a child in crisis is exactly who this tool is for. What it
 * does stop is interpretation — see F2b in family-experience.
 */
export function FamilyCrisisBanner({ event, language, onAcknowledge }: FamilyCrisisBannerProps) {
  const acknowledged = event.acknowledgedAt !== undefined;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // F2d. role="alert" gets it announced, but a sighted keyboard or magnifier
  // user could still be scrolled well below it — the banner led the page and the
  // caret did not. Focus moves once, on the event that raised it.
  useEffect(() => {
    const heading = headingRef.current;
    if (!heading) return;
    heading.focus();
    // Focus is the part that must not fail; scrolling is the nicety. jsdom has
    // no scrollIntoView at all, and guarding it here keeps a missing browser API
    // from throwing inside the one banner that must always render.
    if (typeof heading.scrollIntoView !== "function") return;
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  }, [event.id]);

  return (
    <section
      role="alert"
      data-testid="family-crisis-banner"
      data-safety-domain={event.domain}
      aria-labelledby={`family-safety-${event.id}`}
      className="rounded-control border-2 border-l-8 border-rose-400 bg-rose-50 p-4"
    >
      <h2
        ref={headingRef}
        id={`family-safety-${event.id}`}
        tabIndex={-1}
        className="break-words font-bold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care"
      >
        {tFamily(language, "safetyHeading")}
      </h2>
      <p className="mt-1 break-words font-medium leading-relaxed text-ink">
        {tFamily(language, safetyCopyKey(event))}
      </p>
      <div className="mt-3">
        <UrgentHelp language={language} summary={tFamily(language, "safetyHeading")} />
      </div>
      {/* F2b, said out loud: the caregiver can see that this turn was not filed
          and not sorted, rather than being left to wonder where it went. */}
      <p data-testid="family-safety-no-interpretation" className="mt-3 break-words text-sm leading-6 text-ink/80">
        {tFamily(language, "safetyNoInterpretation")}
      </p>
      {/* Means restriction belongs to a self-harm disclosure and nowhere else.
          It was printing under every domain, so a family who said they had no
          food was told to lock up medicines, and a medical emergency got advice
          about firearms. Both read as not having been listened to. */}
      {safetyCopyKey(event) === "safetyCrisis" ? (
        <p data-testid="family-safety-steps" className="mt-2 break-words text-sm leading-6 text-ink/80">
          {tFamily(language, "safetySteps")}
        </p>
      ) : null}
      {!acknowledged ? (
        <>
          <button
            type="button"
            onClick={() => onAcknowledge(event.id)}
            className="mt-3 min-h-12 min-w-0 break-words rounded-control bg-rose-700 px-4 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care"
          >
            {tFamily(language, "safetyAcknowledge")}
          </button>
          {/* The old label was "I've seen this — continue", and tapping it took
              every 988/911 route off the page with nothing saying they could be
              got back. F2c adds the way back; this says so before the tap. */}
          <p className="mt-2 break-words text-sm leading-6 text-ink/80">
            {tFamily(language, "safetyReopenHint")}
          </p>
        </>
      ) : null}
    </section>
  );
}
