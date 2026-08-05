"use client";

import { ExternalLink } from "lucide-react";
import React, { useId } from "react";
import type { FamilyGuide } from "@/domain/family-guides";
import { familyResourcePhones, familyResourceTel } from "@/domain/family-resource-contact";
import { sourceContentLang } from "@/components/family-source-language-notice";
import { CONTROL_FOCUS, NOTICE_INFO } from "@/components/family-theme";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

export type FamilyGuideCardProps = {
  guide: FamilyGuide;
  language: Language;
};

/**
 * A guide is catalog content, never model prose — so the card always shows the
 * source it came from and the date that source was checked, exactly like the
 * resource cards above it. Guide text stays in the source language; the strip
 * carries the same es source-language notice the resources section already uses.
 */
export function FamilyGuideCard({ guide, language }: FamilyGuideCardProps) {
  const titleId = `${useId()}-title`;
  const [guidePhone] = familyResourcePhones(guide.contact ?? "");
  const sourceLang = sourceContentLang(language);

  return (
    <article
      aria-labelledby={titleId}
      data-testid="family-guide-card"
      data-guide-id={guide.id}
      className="min-w-0 rounded-control border border-ink/10 bg-white p-4"
    >
      {/* F6b. Guide content is English in both languages (a named non-goal),
          so it says so while the page around it is Spanish. */}
      <h4 id={titleId} lang={sourceLang} className="min-w-0 break-words font-semibold">
        {guide.title}
      </h4>
      <p lang={sourceLang} className="mt-1 break-words leading-relaxed text-ink/80">
        {guide.plainSummary}
      </p>

      <ul lang={sourceLang} className="mt-3 grid list-disc gap-1 pl-5 leading-relaxed">
        {guide.steps.map((step) => (
          <li key={step} className="min-w-0 break-words">
            {step}
          </li>
        ))}
      </ul>

      {/* F5e. Tappable, and drawn from the guide's own verified contact line —
          never from a number written into a step's prose (FR-1). */}
      {guidePhone ? (
        <p className="mt-3">
          <a
            href={familyResourceTel(guidePhone)}
            data-testid="family-guide-call"
            className={`inline-flex min-h-12 min-w-0 items-center break-words rounded-control bg-care px-4 py-2 text-sm font-semibold text-white ${CONTROL_FOCUS}`}
          >
            {tFamily(language, "resourceCallNumber", { number: guidePhone })}
          </a>
        </p>
      ) : null}

      <p data-testid="family-guide-source" className="mt-3 break-words text-sm text-ink/70">
        {tFamily(language, "resourceSource")}: <span lang={sourceLang}>{guide.sourceName} </span>·{" "}
        {tFamily(language, "resourceVerified", { date: guide.verifiedAt })}
      </p>

      <a
        href={guide.sourceUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`${tFamily(language, "resourceOpenSource")}: ${guide.title}`}
        className={`mt-3 inline-flex min-h-12 min-w-0 items-center gap-2 break-words rounded-control border border-care/40 px-3 py-2 text-sm font-semibold text-care ${CONTROL_FOCUS}`}
      >
        <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />
        {tFamily(language, "resourceOpenSource")}
      </a>

      {guide.humanVerify ? (
        <p className={`mt-3 text-sm font-medium text-ink ${NOTICE_INFO}`}>
          {tFamily(language, "resourceHumanVerify")}
        </p>
      ) : null}
    </article>
  );
}
