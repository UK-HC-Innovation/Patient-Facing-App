"use client";

import { ExternalLink } from "lucide-react";
import React, { useId } from "react";
import type { FamilyGuide } from "@/domain/family-guides";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

export type FamilyGuideCardProps = {
  guide: FamilyGuide;
  language: Language;
};

const CONTROL_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care";

/**
 * A guide is catalog content, never model prose — so the card always shows the
 * source it came from and the date that source was checked, exactly like the
 * resource cards above it. Guide text stays in the source language; the strip
 * carries the same es source-language notice the resources section already uses.
 */
export function FamilyGuideCard({ guide, language }: FamilyGuideCardProps) {
  const titleId = `${useId()}-title`;

  return (
    <article
      aria-labelledby={titleId}
      data-testid="family-guide-card"
      data-guide-id={guide.id}
      className="min-w-0 rounded-control border border-ink/10 bg-white p-4"
    >
      <h4 id={titleId} className="min-w-0 break-words font-semibold">
        {guide.title}
      </h4>
      <p className="mt-1 break-words text-sm leading-6 text-ink/80">{guide.plainSummary}</p>

      <ul className="mt-3 grid list-disc gap-1 pl-5 text-sm leading-6">
        {guide.steps.map((step) => (
          <li key={step} className="min-w-0 break-words">
            {step}
          </li>
        ))}
      </ul>

      <p data-testid="family-guide-source" className="mt-3 break-words text-sm text-ink/75">
        {tFamily(language, "resourceSource")}: {guide.sourceName} ·{" "}
        {tFamily(language, "resourceVerified", { date: guide.verifiedAt })}
      </p>

      <a
        href={guide.sourceUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`${tFamily(language, "resourceOpenSource")}: ${guide.title}`}
        className={`mt-3 inline-flex min-h-12 min-w-0 items-center gap-2 break-words rounded-control border border-care px-3 py-2 text-sm font-semibold text-care ${CONTROL_FOCUS}`}
      >
        <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />
        {tFamily(language, "resourceOpenSource")}
      </a>

      {guide.humanVerify ? (
        <p className="mt-3 rounded-control bg-note p-3 text-sm font-medium text-ink">
          {tFamily(language, "resourceHumanVerify")}
        </p>
      ) : null}
    </article>
  );
}
