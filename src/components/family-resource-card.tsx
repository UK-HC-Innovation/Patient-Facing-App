"use client";

import { Bookmark, ExternalLink, Share2 } from "lucide-react";
import React, { useId, useRef, useState } from "react";
import type { FamilyResource } from "@/domain/family-resources";
import type { DevNeedDomain, FamilyResourceStep, FamilyStepStatus } from "@/domain/types";
import {
  BTN_SECONDARY,
  BTN_QUIET,
  CONTROL_FOCUS,
  NOTICE_DEADLINE,
  NOTICE_INFO
} from "@/components/family-theme";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

export type FamilyResourceCardProps = {
  resource: FamilyResource;
  domain: DevNeedDomain;
  language: Language;
  /** The tracked next step for this resource, once the family has committed to one. */
  step?: FamilyResourceStep;
  onPlanStep?: (resource: FamilyResource, domain: DevNeedDomain) => void;
  /** Dated deadline line for this resource, already localized. Calm, never a siren. */
  clockLine?: string;
  /** Grounded "why this, for you" line. Absent falls back to the catalog summary alone. */
  why?: string;
  /** Verbatim caregiver words, already checked against the transcript. */
  becauseYouSaid?: string;
  urgency?: "act_now" | "soon" | "when_ready";
  isSaved: boolean;
  isEnrolled: boolean;
  onSave: (resource: FamilyResource, domain: DevNeedDomain) => void;
  onShare: (resource: FamilyResource) => void;
  onToggleEnrollment: (resourceId: string) => void;
};

const REFERRAL_KEYS: Record<FamilyResource["referralMode"], FamilyStringKey> = {
  self_serve: "referralSelfServe",
  call: "referralCall",
  provider_referral: "referralProvider",
  school_contact: "referralSchool",
  navigator_referral: "referralNavigator"
};

const URGENCY_KEYS: Record<"act_now" | "soon" | "when_ready", FamilyStringKey> = {
  act_now: "rankUrgencyActNow",
  soon: "rankUrgencySoon",
  when_ready: "rankUrgencyWhenReady"
};

// Semantic urgency: act-now wears the deadline color, everything milder stays calm.
const URGENCY_CHIPS: Record<"act_now" | "soon" | "when_ready", string> = {
  act_now: "border border-pulse/40 bg-pulse/10 text-pulse",
  soon: "bg-note/40 text-ink",
  when_ready: "bg-calm text-care"
};

const STEP_STATUS_KEYS: Record<FamilyStepStatus, FamilyStringKey> = {
  planned: "stepStatusPlanned",
  tried: "stepStatusTried",
  in_touch: "stepStatusInTouch",
  enrolled: "stepStatusEnrolled",
  not_for_us: "stepStatusNotForUs"
};

// Status plus the month it last moved — the family's own history of this step,
// which is also what the follow-up turn counts from.
function stepStatusLine(step: FamilyResourceStep, language: Language): string {
  const when = new Date(step.updatedAt).toLocaleDateString(language === "es" ? "es" : "en-US", {
    month: "long",
    year: "numeric"
  });
  return `${tFamily(language, STEP_STATUS_KEYS[step.status])} · ${when}`;
}

function ageBand(resource: FamilyResource, language: Language): string {
  const format = new Intl.NumberFormat(language === "es" ? "es-US" : "en-US", {
    maximumFractionDigits: 2
  });
  const min = resource.ages?.min;
  const max = resource.ages?.max;
  if (min === undefined && max === undefined) {
    return tFamily(language, "resourceAllAges");
  }
  if (min !== undefined && max === undefined) {
    return tFamily(language, "resourceAgeFrom", { min: format.format(min) });
  }
  if (min === undefined && max !== undefined) {
    return tFamily(language, "resourceAgeThrough", { max: format.format(max) });
  }
  return tFamily(language, "resourceAgeBetween", {
    min: format.format(min!),
    max: format.format(max!)
  });
}

export function FamilyResourceCard({
  resource,
  domain,
  language,
  step,
  onPlanStep,
  clockLine,
  why,
  becauseYouSaid,
  urgency,
  isSaved,
  isEnrolled,
  onSave,
  onShare,
  onToggleEnrollment
}: FamilyResourceCardProps) {
  const instanceId = useId();
  const titleId = `${instanceId}-title`;
  const consentId = `${instanceId}-share-consent`;
  const [consented, setConsented] = useState(false);
  const [shared, setShared] = useState(false);
  const [saveRequested, setSaveRequested] = useState(false);
  const saveRequestedRef = useRef(false);
  const sharedRef = useRef(false);
  const saved = isSaved || saveRequested;
  const saveLabel = saved ? tFamily(language, "resourceSaved") : tFamily(language, "resourceSave");
  const enrollmentLabel = isEnrolled
    ? tFamily(language, "resourceUnmarkEnrolled")
    : tFamily(language, "resourceMarkEnrolled");

  function save(): void {
    if (saved || saveRequestedRef.current) return;
    saveRequestedRef.current = true;
    setSaveRequested(true);
    onSave(resource, domain);
  }

  function share(): void {
    if (!consented || sharedRef.current) return;
    sharedRef.current = true;
    setShared(true);
    onShare(resource);
  }

  return (
    <article
      aria-labelledby={titleId}
      data-testid="family-resource-card"
      data-family-resource-card=""
      data-resource-id={resource.id}
      className="min-w-0 rounded-control border border-ink/10 bg-white p-4"
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <h3 id={titleId} className="min-w-0 break-words text-lg font-semibold">
          {resource.name}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {urgency && !isEnrolled ? (
            <span
              data-testid="family-resource-urgency"
              className={`rounded-full px-2 py-1 text-xs font-semibold ${URGENCY_CHIPS[urgency]}`}
            >
              {tFamily(language, URGENCY_KEYS[urgency])}
            </span>
          ) : null}
          {isEnrolled ? (
            <span className="rounded-full bg-calm px-2 py-1 text-xs font-semibold text-care">
              {tFamily(language, "resourceAlreadyEnrolled")}
            </span>
          ) : null}
        </div>
      </div>
      {why ? (
        <p data-testid="family-resource-why" className="mt-2 break-words font-medium leading-relaxed">
          {why}
        </p>
      ) : null}
      {becauseYouSaid ? (
        <blockquote
          data-testid="family-resource-quote"
          className="mt-2 break-words border-l-4 border-care/30 pl-3 text-sm leading-6 text-ink/70"
        >
          {tFamily(language, "rankQuotePrefix")}: {becauseYouSaid}
        </blockquote>
      ) : null}
      <p className="mt-2 break-words leading-relaxed text-ink/80">{resource.summary}</p>

      {!isEnrolled && resource.actNow ? (
        <div className={`mt-3 ${NOTICE_DEADLINE}`}>
          <h4 className="text-sm font-semibold text-pulse">{tFamily(language, "resourceActNow")}</h4>
          <p className="mt-1 break-words text-sm leading-6">{resource.actNow}</p>
        </div>
      ) : null}

      {clockLine ? (
        <p
          data-testid="family-resource-clock"
          className={`mt-3 break-words text-sm font-medium ${NOTICE_DEADLINE}`}
        >
          {clockLine}
        </p>
      ) : null}

      {resource.humanVerify ? (
        <p className={`mt-3 break-words text-sm font-medium text-ink ${NOTICE_INFO}`}>
          {tFamily(language, "resourceHumanVerify")}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {step ? (
          <p
            data-testid="family-step-status"
            data-step-status={step.status}
            className="inline-flex min-w-0 break-words rounded-control bg-calm px-3 py-2 text-sm font-semibold text-care"
          >
            {stepStatusLine(step, language)}
          </p>
        ) : onPlanStep ? (
          <button
            type="button"
            data-testid="family-step-plan"
            aria-label={`${tFamily(language, "stepPlanCta")}: ${resource.name}`}
            onClick={() => onPlanStep(resource, domain)}
            className={BTN_SECONDARY}
          >
            {tFamily(language, "stepPlanCta")}
          </button>
        ) : null}
        <button
          type="button"
          disabled={saved}
          aria-label={`${saveLabel}: ${resource.name}`}
          onClick={save}
          className={BTN_QUIET}
        >
          <Bookmark aria-hidden="true" className="h-4 w-4 shrink-0" />
          {saveLabel}
        </button>
        <button
          type="button"
          aria-pressed={isEnrolled}
          aria-label={`${enrollmentLabel}: ${resource.name}`}
          onClick={() => onToggleEnrollment(resource.id)}
          className={BTN_QUIET}
        >
          {enrollmentLabel}
        </button>
      </div>

      {/* Trust furniture, one tap away: who runs this, ages, how to get in, and
          when we last checked. Everything stays in the document for print and
          find-in-page; it just is not first-read content. */}
      <details className="mt-3 rounded-control border border-ink/10">
        <summary
          className={`min-h-12 min-w-0 cursor-pointer break-words rounded-control p-3 text-sm font-semibold text-care ${CONTROL_FOCUS}`}
        >
          {tFamily(language, "resourceDetailsToggle")}
        </summary>
        <div className="border-t border-ink/10 p-3">
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="font-semibold">{tFamily(language, "resourceContact")}</dt>
              <dd className="break-words text-ink/75">{resource.contact}</dd>
            </div>
            <div>
              <dt className="font-semibold">{tFamily(language, "resourceAgeBand")}</dt>
              <dd className="text-ink/75">{ageBand(resource, language)}</dd>
            </div>
            <div>
              <dt className="font-semibold">{tFamily(language, "resourceReferralMode")}</dt>
              <dd className="text-ink/75">{tFamily(language, REFERRAL_KEYS[resource.referralMode])}</dd>
            </div>
            <div>
              <dt className="font-semibold">{tFamily(language, "resourceSource")}</dt>
              <dd className="break-words text-ink/75">
                {resource.sourceName} · {tFamily(language, "resourceVerified", { date: resource.verifiedAt })}
              </dd>
            </div>
          </dl>
          <a
            href={resource.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`${tFamily(language, "resourceOpenSource")}: ${resource.name}`}
            className={`mt-3 inline-flex min-h-12 min-w-0 items-center gap-2 break-words rounded-control border border-care/40 px-3 py-2 text-sm font-semibold text-care ${CONTROL_FOCUS}`}
          >
            <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />
            {tFamily(language, "resourceOpenSource")}
          </a>
        </div>
      </details>

      <div className="mt-4 border-t border-ink/10 pt-3">
        <label htmlFor={consentId} className="flex min-h-12 min-w-0 items-center gap-2 text-sm">
          <input
            id={consentId}
            type="checkbox"
            checked={consented}
            disabled={shared}
            aria-label={`${tFamily(language, "resourceShareConsent")} ${resource.name}`}
            onChange={(event) => setConsented(event.target.checked)}
            className={CONTROL_FOCUS}
          />
          <span className="min-w-0 break-words">{tFamily(language, "resourceShareConsent")}</span>
        </label>
        {!consented && !shared ? (
          <p className="text-xs text-ink/65">{tFamily(language, "resourceShareConsentRequired")}</p>
        ) : null}
        <button
          type="button"
          disabled={!consented || shared}
          aria-label={`${tFamily(language, "resourceShare")}: ${resource.name}`}
          onClick={share}
          className={BTN_QUIET}
        >
          <Share2 aria-hidden="true" className="h-4 w-4 shrink-0" />
          {tFamily(language, "resourceShare")}
        </button>
        <p role="status" aria-live="polite" className="mt-2 text-sm font-medium text-care">
          {shared
            ? tFamily(language, "resourceShareComplete")
            : saveRequested
              ? tFamily(language, "resourceSaved")
              : ""}
        </p>
      </div>
    </article>
  );
}
