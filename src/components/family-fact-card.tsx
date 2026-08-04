"use client";

import React, { useId } from "react";
import type { FamilyFact } from "@/domain/types";
import { BTN_ROW, BTN_ROW_ON, BTN_SECONDARY, CONTROL_FOCUS } from "@/components/family-theme";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

export type FamilyFactCardProps = {
  fact: FamilyFact;
  language: Language;
  onConfirm: (factId: string) => void;
  /**
   * Journal-only packet curation. Absent in the in-thread review turn, where the
   * question is still "did we hear you right", not "what goes to the clinic".
   */
  includeToggle?: { included: boolean; onToggle: (include: boolean) => void };
  /**
   * "row" is the journal's checklist line: the fact in the family's own words
   * with a yes/no beside it. Everything the card shows — the label, the
   * provenance badge, the quote, the packet toggle — is one tap in. The review
   * turn keeps the full card, where the quote is the whole point.
   */
  variant?: "card" | "row";
};

const STATUS_KEYS: Record<FamilyFact["status"], FamilyStringKey> = {
  patient_reported: "evidencePatientReported",
  inferred: "evidenceInferred",
  confirmed: "evidenceConfirmed"
};

export function FamilyFactCard({
  fact,
  language,
  onConfirm,
  includeToggle,
  variant = "card"
}: FamilyFactCardProps) {
  const titleId = useId();
  const includeId = useId();
  const confirmed = fact.status === "confirmed";
  // "No" is the only durable way to say "do not use this": it pulls the fact out
  // of the clinician's packet without deleting the family's own words.
  const excluded = includeToggle ? !includeToggle.included : false;

  if (variant === "row") {
    return (
      <li
        data-testid="family-fact-row"
        data-fact-status={fact.status}
        className="min-w-0 border-b border-ink/10 py-2 last:border-b-0"
      >
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <p id={titleId} className="min-w-0 flex-1 break-words leading-snug">
            {fact.value}
          </p>
          <div aria-live="polite" className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={confirmed}
              aria-pressed={confirmed}
              aria-label={`${tFamily(language, "factConfirm")}: ${fact.label}`}
              onClick={() => onConfirm(fact.id)}
              className={confirmed ? BTN_ROW_ON : BTN_ROW}
            >
              {tFamily(language, "factRowYes")}
            </button>
            {includeToggle ? (
              <button
                type="button"
                aria-pressed={excluded}
                aria-label={`${tFamily(language, "factNotRight")}: ${fact.label}`}
                onClick={() => includeToggle.onToggle(excluded)}
                className={excluded ? BTN_ROW_ON : BTN_ROW}
              >
                {tFamily(language, "factRowNo")}
              </button>
            ) : null}
          </div>
        </div>
        <details className="mt-1">
          <summary
            className={`min-h-12 min-w-0 cursor-pointer break-words rounded-control py-1 text-xs font-semibold text-care ${CONTROL_FOCUS}`}
          >
            {tFamily(language, "factRowDetails")}
          </summary>
          <div className="pb-2 pl-1 text-sm">
            <p className="break-words font-semibold text-ink/80">{fact.label}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink/70">
              {tFamily(language, STATUS_KEYS[fact.status])} · {tFamily(language, "factSource")}
            </p>
            <blockquote className="mt-1 break-words border-l-4 border-care/30 pl-3 text-ink/70">
              {fact.sourceSnippet}
            </blockquote>
            {includeToggle ? (
              <label htmlFor={includeId} className="mt-2 flex min-h-12 min-w-0 items-center gap-2">
                <input
                  id={includeId}
                  type="checkbox"
                  checked={includeToggle.included}
                  aria-label={`${tFamily(language, "journalIncludeLabel")}: ${fact.label}`}
                  onChange={(event) => includeToggle.onToggle(event.target.checked)}
                  className={CONTROL_FOCUS}
                />
                <span className="min-w-0 break-words">{tFamily(language, "journalIncludeLabel")}</span>
              </label>
            ) : null}
          </div>
        </details>
      </li>
    );
  }

  return (
    <article className="rounded-control border border-ink/10 bg-white p-4" aria-labelledby={titleId}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={titleId} className="break-words font-semibold">
            {fact.label}
          </h3>
          <p className="mt-1 break-words leading-relaxed text-ink/80">{fact.value}</p>
        </div>
        <span className="rounded-full bg-calm px-2 py-1 text-xs font-semibold text-ink/80">
          {tFamily(language, STATUS_KEYS[fact.status])}
        </span>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink/70">
        {tFamily(language, "factSource")}
      </p>
      <blockquote className="mt-1 break-words border-l-4 border-care/30 pl-3 text-sm text-ink/70">
        {fact.sourceSnippet}
      </blockquote>
      <div aria-live="polite">
        <button
          type="button"
          disabled={confirmed}
          aria-label={`${confirmed ? tFamily(language, "factConfirmed") : tFamily(language, "factConfirm")}: ${fact.label}`}
          onClick={() => onConfirm(fact.id)}
          className={`mt-4 ${BTN_SECONDARY}`}
        >
          {confirmed ? tFamily(language, "factConfirmed") : tFamily(language, "factConfirm")}
        </button>
      </div>
      {includeToggle ? (
        <div className="mt-4 border-t border-ink/10 pt-3">
          <label htmlFor={includeId} className="flex min-h-12 min-w-0 items-center gap-2 text-sm">
            <input
              id={includeId}
              type="checkbox"
              checked={includeToggle.included}
              aria-label={`${tFamily(language, "journalIncludeLabel")}: ${fact.label}`}
              onChange={(event) => includeToggle.onToggle(event.target.checked)}
              className={CONTROL_FOCUS}
            />
            <span className="min-w-0 break-words">{tFamily(language, "journalIncludeLabel")}</span>
          </label>
          {includeToggle.included ? null : (
            <p className="mt-1 break-words text-xs font-semibold uppercase tracking-wide text-ink/70">
              {tFamily(language, "journalExcludedBadge")}
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}
