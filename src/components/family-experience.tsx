"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch
} from "react";
import { FamilyAppointmentCard } from "@/components/family-appointment-card";
import { FamilyCrisisBanner } from "@/components/family-crisis-banner";
import { FamilyFactCard } from "@/components/family-fact-card";
import type { FamilyInterviewSubmissionMeta, SanitizedFamilyInterviewResult } from "@/components/family-interview";
import { FamilyJournal } from "@/components/family-journal";
import { FamilyNeedsScreen } from "@/components/family-needs-screen";
import {
  EMPTY_FAMILY_INTERVIEW_PROFILE,
  FamilyOrientationInterview
} from "@/components/family-orientation-interview";
import { FamilyProfileForm } from "@/components/family-profile-form";
import { FamilyResourceCard } from "@/components/family-resource-card";
import { FamilyStageTimeline } from "@/components/family-stage-timeline";
import { FamilyVisitPacket } from "@/components/family-visit-packet";
import { FamilyWaitHeader } from "@/components/family-wait-header";
import { recordAuditEvent } from "@/domain/audit";
import {
  createFamilyAppointmentOffer,
  FAMILY_APPOINTMENT_CLINIC,
  type FamilyAppointmentCountdownDays
} from "@/domain/family-appointments";
import {
  createFamilySafetyEvent,
  domainsAfterSafety,
  pendingFamilySafetyEvent,
  type FamilySafetyScreen
} from "@/domain/family-safety";
import type { FamilyDiagnosisBackdateMonths } from "@/domain/family-stages";
import { checkInDue, oldestStaleStep } from "@/domain/family-journey";
import { familyFactStatus } from "@/domain/family-interview";
import {
  extractFamilyBasics,
  hasFamilyBasicsHints,
  type FamilyBasicsHints
} from "@/domain/family-basics-extract";
import { KY_COUNTIES, getFamilyResourceById, type FamilyResource } from "@/domain/family-resources";
import {
  buildNearbyTherapeuticRecreation,
  buildRankCandidates,
  buildResourceMatches,
  type MatchedResource
} from "@/domain/family-matching";
import { coerceLead, rankFamilyResourcesMock, validateHeard, validateRankedItems } from "@/domain/family-rank";
import { requestFamilyRecommendations } from "@/ai/family-recommend-provider";
import type { Language } from "@/i18n/strings";
import type {
  AppState,
  DevNeedDomain,
  FamilyAppointmentBarrier,
  FamilyFact,
  FamilyProfile,
  FamilyReminderOffset,
  FamilyResourceStep,
  FamilyScreenAnswer,
  FamilyStepStatus
} from "@/domain/types";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { HealthAction } from "@/state/store";

export type FamilyExperienceProps = {
  state: AppState;
  dispatch: Dispatch<HealthAction>;
  passcode?: string;
};

type ReviewDetails = {
  domains: SanitizedFamilyInterviewResult["domains"];
};

const DOMAIN_KEYS: Record<DevNeedDomain, FamilyStringKey> = {
  early_intervention: "domainEarlyIntervention",
  therapies: "domainTherapies",
  school_iep: "domainSchoolIep",
  waivers_financial: "domainWaiversFinancial",
  respite: "domainRespite",
  parent_support: "domainParentSupport",
  sibling_support: "domainSiblingSupport",
  transportation: "domainTransportation",
  future_planning: "domainFuturePlanning",
  diagnosis_education: "domainDiagnosisEducation",
  recreation: "domainRecreation"
};

const CONTROL_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care";

// Four fixed answers, no free text: the follow-up turn moves a step's status, it
// never opens a new place to write.
const FOLLOWUP_OPTIONS: ReadonlyArray<{ status: FamilyStepStatus; key: FamilyStringKey }> = [
  { status: "in_touch", key: "followupGotThrough" },
  { status: "tried", key: "followupLeftMessage" },
  { status: "planned", key: "followupNotYet" },
  { status: "not_for_us", key: "followupNotForUs" }
];

const BASICS_SCHOOL_OPTIONS: ReadonlyArray<{ value: FamilyProfile["schoolStage"]; key: FamilyStringKey }> = [
  { value: "not_school_age", key: "schoolNotSchoolAge" },
  { value: "preschool", key: "schoolPreschool" },
  { value: "elementary", key: "schoolElementary" },
  { value: "middle", key: "schoolMiddle" },
  { value: "high", key: "schoolHigh" },
  { value: "post_high", key: "schoolPostHigh" }
];

type FamilyBasicsAnswers = Pick<FamilyProfile, "county" | "birthYear" | "schoolStage">;

const SCHOOL_STAGE_KEYS: Record<FamilyProfile["schoolStage"], FamilyStringKey> = Object.fromEntries(
  BASICS_SCHOOL_OPTIONS.map(({ value, key }) => [value, key])
) as Record<FamilyProfile["schoolStage"], FamilyStringKey>;

// Conversational county → birth year → school stage turns, asked in the thread
// once the first description lands and no profile exists yet. Anything the
// caregiver already wrote is offered back for a single yes instead of re-asked.
function FamilyBasicsTurns({
  language,
  hints,
  onComplete
}: {
  language: Language;
  hints: FamilyBasicsHints;
  onComplete: (basics: FamilyBasicsAnswers) => void;
}) {
  const prefilled = hasFamilyBasicsHints(hints);
  const [confirmingPrefill, setConfirmingPrefill] = useState(prefilled);
  const [county, setCounty] = useState(hints.county?.value ?? "");
  const [committedCounty, setCommittedCounty] = useState<string | null>(null);
  const [year, setYear] = useState(hints.birthYear ? String(hints.birthYear.value) : "");
  const [committedYear, setCommittedYear] = useState<number | null>(null);
  const [committedStage, setCommittedStage] = useState<FamilyProfile["schoolStage"] | null>(null);
  const [yearError, setYearError] = useState(false);

  const countyQuestion = tFamily(language, "basicsCountyQuestion");
  const yearQuestion = tFamily(language, "basicsYearQuestion");

  function commitYear(): void {
    const parsed = Number(year);
    const currentYear = new Date().getFullYear();
    if (!/^\d{4}$/.test(year) || parsed < 1900 || parsed > currentYear) {
      setYearError(true);
      return;
    }
    finish(committedCounty, parsed, committedStage);
  }

  // Saves as soon as all three are known, whichever mix came from the caregiver's
  // own words and whichever they answered as turns.
  function finish(
    nextCounty: string | null,
    nextYear: number | null,
    nextStage: FamilyProfile["schoolStage"] | null
  ): void {
    setCommittedCounty(nextCounty);
    setCommittedYear(nextYear);
    setCommittedStage(nextStage);
    if (nextCounty !== null && nextYear !== null && nextStage !== null) {
      onComplete({ county: nextCounty, birthYear: nextYear, schoolStage: nextStage });
    }
  }

  function acceptPrefill(): void {
    setConfirmingPrefill(false);
    finish(
      hints.county?.value ?? null,
      hints.birthYear?.value ?? null,
      hints.schoolStage?.value ?? null
    );
  }

  if (confirmingPrefill) {
    const rows: Array<{ key: string; label: string; value: string; snippet: string }> = [];
    if (hints.county) {
      rows.push({
        key: "county",
        label: tFamily(language, "profileCountyLabel"),
        value: hints.county.value,
        snippet: hints.county.sourceSnippet
      });
    }
    if (hints.birthYear) {
      rows.push({
        key: "birthYear",
        label: tFamily(language, "profileBirthYearLabel"),
        value: hints.birthYear.approximate
          ? tFamily(language, "basicsPrefillApproxYear", { year: hints.birthYear.value })
          : String(hints.birthYear.value),
        snippet: hints.birthYear.sourceSnippet
      });
    }
    if (hints.schoolStage) {
      rows.push({
        key: "schoolStage",
        label: tFamily(language, "profileSchoolStageLabel"),
        value: tFamily(language, SCHOOL_STAGE_KEYS[hints.schoolStage.value]),
        snippet: hints.schoolStage.sourceSnippet
      });
    }

    return (
      <div className="space-y-3" data-testid="family-basics-turns">
        <div
          data-testid="family-basics-prefill"
          className="mr-auto max-w-[90%] rounded-control border border-ink/10 bg-white p-3"
        >
          <p className="break-words font-semibold">{tFamily(language, "basicsPrefillTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-ink/75">{tFamily(language, "basicsPrefillIntro")}</p>
          <ul className="mt-3 grid gap-2">
            {rows.map((row) => (
              <li key={row.key} className="rounded-control bg-paper p-3">
                <p className="break-words text-sm text-ink/70">{row.label}</p>
                <p className="break-words font-semibold">{row.value}</p>
                {row.snippet ? (
                  <blockquote className="mt-2 break-words border-l-4 border-care/30 pl-3 text-sm text-ink/70">
                    {row.snippet}
                  </blockquote>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={acceptPrefill}
              className={`min-h-12 min-w-0 break-words rounded-control bg-care px-4 py-2 font-semibold text-white ${CONTROL_FOCUS}`}
            >
              {tFamily(language, "basicsPrefillConfirm")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingPrefill(false)}
              className={`min-h-12 min-w-0 break-words rounded-control border border-care/30 px-4 py-2 font-semibold text-care ${CONTROL_FOCUS}`}
            >
              {tFamily(language, "basicsPrefillChange")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="family-basics-turns">
      {committedCounty === null ? (
        <div className="mr-auto max-w-[90%] rounded-control border border-ink/10 bg-white p-3">
          <p className="break-words font-semibold">{countyQuestion}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select
              aria-label={countyQuestion}
              value={county}
              onChange={(event) => setCounty(event.target.value)}
              className={`min-h-12 min-w-0 flex-1 rounded-control border border-ink/20 bg-white px-3 py-2 ${CONTROL_FOCUS}`}
            >
              <option value="">{tFamily(language, "profileCountyPlaceholder")}</option>
              {KY_COUNTIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={county.length === 0}
              onClick={() => finish(county, committedYear, committedStage)}
              className={`min-h-12 rounded-control bg-care px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${CONTROL_FOCUS}`}
            >
              {tFamily(language, "basicsTurnNext")}
            </button>
          </div>
        </div>
      ) : (
        <div className="ml-auto max-w-[90%] rounded-control bg-care/10 p-3">
          <p className="break-words">{committedCounty}</p>
        </div>
      )}

      {committedCounty !== null && committedYear === null ? (
        <div className="mr-auto max-w-[90%] rounded-control border border-ink/10 bg-white p-3">
          <p className="break-words font-semibold">{yearQuestion}</p>
          <div className="mt-3 grid gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                aria-label={yearQuestion}
                inputMode="numeric"
                value={year}
                aria-invalid={yearError}
                placeholder={tFamily(language, "profileBirthYearPlaceholder")}
                onChange={(event) => {
                  setYearError(false);
                  setYear(event.target.value);
                }}
                className={`min-h-12 min-w-0 flex-1 rounded-control border border-ink/20 px-3 py-2 ${CONTROL_FOCUS}`}
              />
              <button
                type="button"
                onClick={commitYear}
                className={`min-h-12 rounded-control bg-care px-4 py-2 font-semibold text-white ${CONTROL_FOCUS}`}
              >
                {tFamily(language, "basicsTurnNext")}
              </button>
            </div>
            {yearError ? (
              <p role="alert" className="text-sm font-medium text-rose-700">
                {tFamily(language, "profileBirthYearError")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {committedCounty !== null && committedYear !== null ? (
        <div className="ml-auto max-w-[90%] rounded-control bg-care/10 p-3">
          <p className="break-words">{committedYear}</p>
        </div>
      ) : null}

      {committedCounty !== null && committedYear !== null && committedStage === null ? (
        <div className="mr-auto max-w-[90%] rounded-control border border-ink/10 bg-white p-3">
          <p className="break-words font-semibold">{tFamily(language, "basicsStageQuestion")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {BASICS_SCHOOL_OPTIONS.map(({ value, key }) => (
              <button
                key={value}
                type="button"
                onClick={() => finish(committedCounty, committedYear, value)}
                className={`min-h-12 min-w-0 break-words rounded-control border border-care/30 bg-care/5 px-4 py-2 text-left font-semibold text-care ${CONTROL_FOCUS}`}
              >
                {tFamily(language, key)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function FamilyExperience({ state, dispatch, passcode }: FamilyExperienceProps) {
  const language = state.patient.language;
  const family = state.family;
  const [reviewDetails, setReviewDetails] = useState<ReviewDetails | null>(null);
  const safetyEvents = family?.safetyEvents ?? [];
  const pendingSafetyEvent = pendingFamilySafetyEvent(safetyEvents);
  const latestSafetyEvent = safetyEvents[safetyEvents.length - 1];
  const [needsScreenOpen, setNeedsScreenOpen] = useState(false);
  const [basicsToggled, setBasicsToggled] = useState<boolean | null>(null);
  const [followupAnswered, setFollowupAnswered] = useState(false);
  const reviewRef = useRef<HTMLElement>(null);
  const pendingReviewFocusRef = useRef(false);
  const safetyTurnRef = useRef(false);
  // Set by a turn that owns the next submission (the monthly check-in); otherwise
  // the first interview is the orientation and everything after it is a note.
  const interviewKindRef = useRef<"note" | "checkin" | null>(null);
  const latestInterview = family?.interviews.at(-1);
  const latestInterviewId = latestInterview?.id;
  const reviewFacts = family?.facts.filter(({ interviewId }) => interviewId === latestInterviewId) ?? [];
  const profileDiagnosisVersion =
    family?.profile?.diagnoses.map(({ id, diagnosedAt }) => `${id}:${diagnosedAt ?? ""}`).join("|") ?? "none";

  useEffect(() => {
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = language;
    return () => {
      document.documentElement.lang = previousLanguage;
    };
  }, [language]);

  useEffect(() => {
    if (pendingReviewFocusRef.current && latestInterviewId) {
      reviewRef.current?.focus();
      pendingReviewFocusRef.current = false;
    }
  }, [latestInterviewId]);

  const matchResult = useMemo(() => {
    if (!family?.profile) {
      return { resources: [], isFallback: false };
    }
    return buildResourceMatches(family.profile, family.activeDomains, family.alreadyEnrolled);
  }, [family?.activeDomains, family?.alreadyEnrolled, family?.profile]);

  // The candidate set the ranker scores — the same deterministic retrieval, minus
  // the display truncation. Ranking may reorder and explain it; never add to it.
  const rankCandidates = useMemo<MatchedResource[]>(() => {
    if (!family?.profile || family.activeDomains.length === 0) return [];
    return buildRankCandidates(family.profile, family.activeDomains, family.alreadyEnrolled).resources;
  }, [family?.activeDomains, family?.alreadyEnrolled, family?.profile]);

  const storedRecommendations = family?.recommendations ?? null;
  const rankedSet =
    storedRecommendations && storedRecommendations.interviewId === latestInterviewId
      ? storedRecommendations
      : null;

  useEffect(() => {
    // Screen-only users have no caregiver text to rank from, so the deterministic
    // order stands. A pending safety banner also holds ranking: that turn's text
    // never leaves the device.
    if (!family?.profile || !latestInterview || rankedSet || rankCandidates.length === 0) return;
    if (pendingSafetyEvent !== undefined) return;

    let cancelled = false;
    const profile = family.profile;
    const rawText = latestInterview.rawText;
    const candidateIds = rankCandidates.map(({ resource }) => resource.id);
    const domains = family.activeDomains;
    const interviewId = latestInterview.id;

    void (async () => {
      const live = await requestFamilyRecommendations({
        text: rawText,
        profile,
        passcode,
        language,
        candidateIds
      }).catch(() => null);
      if (cancelled) return;

      const fallback = rankFamilyResourcesMock(rankCandidates, domains, rawText, language, interviewId);
      if (!live) {
        dispatch({ type: "setFamilyRecommendations", recommendations: fallback });
        return;
      }

      const items = validateRankedItems(live.recommendations, {
        candidateIds,
        rawText,
        language,
        childFirstName: profile.childFirstName
      });
      dispatch({
        type: "setFamilyRecommendations",
        recommendations:
          items.length === 0
            ? fallback
            : {
                interviewId,
                createdAt: new Date().toISOString(),
                extraction: "live",
                heard: validateHeard(live.heard, language, profile.childFirstName),
                lead: coerceLead(live.lead, domains),
                items
              }
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    dispatch,
    family?.activeDomains,
    family?.profile,
    language,
    latestInterview,
    passcode,
    pendingSafetyEvent,
    rankCandidates,
    rankedSet
  ]);

  // What actually renders. A valid ranking reorders and annotates the matched set;
  // with no ranking (screen-only, stale, or every item dropped by the lint) the
  // deterministic order stands unchanged.
  const displayResources = useMemo(() => {
    const matched = matchResult.resources;
    if (!rankedSet || matchResult.isFallback) {
      return matched.map((match) => ({ match, why: undefined, quote: undefined, urgency: undefined }));
    }
    const byId = new Map(rankCandidates.map((candidate) => [candidate.resource.id, candidate]));
    const ranked = rankedSet.items.flatMap((item) => {
      const match = byId.get(item.resourceId);
      return match
        ? [{ match, why: item.why, quote: item.becauseYouSaid, urgency: item.urgency }]
        : [];
    });
    if (ranked.length === 0) {
      return matched.map((match) => ({ match, why: undefined, quote: undefined, urgency: undefined }));
    }
    const rankedIds = new Set(ranked.map(({ match }) => match.resource.id));
    return [
      ...ranked,
      ...matched
        .filter(({ resource }) => !rankedIds.has(resource.id))
        .map((match) => ({ match, why: undefined, quote: undefined, urgency: undefined }))
    ];
  }, [matchResult.isFallback, matchResult.resources, rankCandidates, rankedSet]);

  const nearbyTherapeuticRecreation = useMemo(() => {
    if (!family?.profile || family.activeDomains.length === 0) {
      return [];
    }
    return buildNearbyTherapeuticRecreation(
      family.profile,
      new Set(matchResult.resources.map(({ resource }) => resource.id)),
      family.alreadyEnrolled
    );
  }, [family?.activeDomains, family?.alreadyEnrolled, family?.profile, matchResult.resources]);

  const savedResources = useMemo(
    () =>
      family?.saved.flatMap((saved) => {
        const resource = getFamilyResourceById(saved.resourceId);
        return resource ? [{ resource, domain: saved.domain }] : [];
      }) ?? [],
    [family?.saved]
  );

  function saveProfile(profile: FamilyProfile): void {
    dispatch({ type: "saveFamilyProfile", profile });
  }

  function backdateFamilyDiagnoses(monthsAgo: FamilyDiagnosisBackdateMonths, now: Date): void {
    dispatch({
      type: "backdateFamilyDiagnoses",
      monthsAgo,
      now: now.toISOString()
    });
  }

  function submitScreen(answers: FamilyScreenAnswer[], facts: FamilyFact[]): void {
    dispatch({ type: "submitFamilyScreen", answers, facts });
  }

  function addInterview(
    result: SanitizedFamilyInterviewResult,
    meta: FamilyInterviewSubmissionMeta,
    { round }: { round: number }
  ): void {
    pendingReviewFocusRef.current = round === 0;
    const interviewId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const facts: FamilyFact[] = result.facts.map((fact) => ({
      id: crypto.randomUUID(),
      interviewId,
      label: fact.label,
      value: fact.value,
      status: familyFactStatus(fact.sourceSnippet, meta.rawText),
      sourceSnippet: fact.sourceSnippet
    }));
    const extractedDomains = result.domains.map(({ domain }) => domain);
    const wasSafetyTurn = safetyTurnRef.current;
    safetyTurnRef.current = false;
    const kind =
      interviewKindRef.current ?? ((family?.interviews.length ?? 0) === 0 ? "orientation" : "note");
    interviewKindRef.current = null;
    const domains = wasSafetyTurn
      ? domainsAfterSafety(extractedDomains, family?.activeDomains ?? [])
      : extractedDomains;

    setReviewDetails({ domains: result.domains });
    dispatch({
      type: "addFamilyInterview",
      interview: {
        id: interviewId,
        rawText: meta.rawText,
        source: meta.source,
        createdAt,
        extraction: meta.extraction,
        kind
      },
      facts,
      domains
    });
  }

  function saveResource(resource: FamilyResource, domain: DevNeedDomain): void {
    dispatch({
      type: "saveFamilyResource",
      resource: { resourceId: resource.id, savedAt: new Date().toISOString(), domain }
    });
  }

  function planStep(resource: FamilyResource, domain: DevNeedDomain): void {
    dispatch({
      type: "planFamilyStep",
      resourceId: resource.id,
      domain,
      at: new Date().toISOString()
    });
  }

  function answerFollowup(step: FamilyResourceStep, status: FamilyStepStatus): void {
    setFollowupAnswered(true);
    dispatch({ type: "updateFamilyStep", stepId: step.id, status, at: new Date().toISOString() });
  }

  function shareResource(resource: FamilyResource): void {
    dispatch({
      type: "addAuditEvent",
      event: recordAuditEvent(state.patient.id, "shared", `Shared family resource: ${resource.name}`)
    });
  }

  // The navigator shows the standard crisis resources and keeps working. The
  // thread, the review card, and any matched resources all survive.
  function recordSafety(screen: FamilySafetyScreen): void {
    safetyTurnRef.current = true;
    dispatch({ type: "recordFamilySafetyEvent", event: createFamilySafetyEvent(screen) });
  }

  function acknowledgeSafety(eventId: string): void {
    dispatch({ type: "acknowledgeFamilySafetyEvent", eventId, at: new Date().toISOString() });
  }

  // Everything the caregiver has already typed, so the basics turns can skip
  // whatever they told us instead of asking for it again.
  const basicsHints: FamilyBasicsHints = useMemo(() => {
    const described = family?.interviews.map(({ rawText }) => rawText).join("\n") ?? "";
    return described.length > 0 ? extractFamilyBasics(described, new Date(), language) : {};
  }, [family?.interviews, language]);

  const basicsOpen = basicsToggled ?? false;
  const needsBasics =
    !!family &&
    !family.profile &&
    (family.interviews.length > 0 || family.activeDomains.length > 0);

  const reviewTurn =
    reviewFacts.length > 0 || reviewDetails ? (
      <section
        ref={reviewRef}
        tabIndex={-1}
        aria-live="polite"
        aria-labelledby="family-facts-title"
        className="grid gap-3 rounded-control border border-care/20 bg-paper p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care"
      >
        <h2 id="family-facts-title" className="text-xl font-semibold">
          {tFamily(language, "factsTitle")}
        </h2>
        <p className="text-sm leading-6 text-ink/75">{tFamily(language, "factsIntro")}</p>
        {reviewFacts.map((fact) => (
          <FamilyFactCard
            key={fact.id}
            fact={fact}
            language={language}
            onConfirm={(factId) => dispatch({ type: "confirmFamilyFact", factId })}
          />
        ))}
        {reviewDetails?.domains.length ? (
          <div>
            <h3 className="font-semibold">{tFamily(language, "domainRationaleTitle")}</h3>
            <ul className="mt-2 grid gap-2">
              {reviewDetails.domains.map(({ domain, rationale }) => (
                <li key={domain} className="rounded-control bg-white p-3 text-sm">
                  <span className="font-semibold">{tFamily(language, DOMAIN_KEYS[domain])}</span>
                  {rationale ? <p className="mt-1 break-words text-ink/75">{rationale}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    ) : null;

  // The banner leads the interlude and stays until acknowledged, but nothing
  // below it is withheld — safety words first, help still on the page.
  const safetyTurn = latestSafetyEvent ? (
    <FamilyCrisisBanner
      key={latestSafetyEvent.id}
      event={latestSafetyEvent}
      language={language}
      onAcknowledge={acknowledgeSafety}
    />
  ) : null;

  const interlude =
    safetyTurn || reviewTurn || needsBasics || matchResult.resources.length > 0 ? (
      <>
        {safetyTurn}
        {reviewTurn}
        {needsBasics ? (
          <FamilyBasicsTurns
            language={language}
            hints={basicsHints}
            onComplete={({ county, birthYear, schoolStage }) =>
              saveProfile({
                county,
                birthYear,
                schoolStage,
                diagnoses: family?.profile?.diagnoses ?? []
              })
            }
          />
        ) : null}
        {matchResult.resources.length > 0 ? (
          <p className="mr-auto max-w-[90%] rounded-control border border-ink/10 bg-white p-3 font-medium">
            {tFamily(language, "resourcesFoundBelow", { count: matchResult.resources.length })}
          </p>
        ) : null}
      </>
    ) : null;

  // One follow-up per page visit, and never while the safety message or the
  // monthly check-in owns the page's single ask.
  const followupNow = new Date();
  const followupStep =
    family && !followupAnswered && pendingSafetyEvent === undefined && !checkInDue(family, followupNow)
      ? oldestStaleStep(family.steps, followupNow)
      : undefined;
  const followupResource = followupStep ? getFamilyResourceById(followupStep.resourceId) : undefined;

  return (
    <div
      id="family-experience"
      lang={language}
      data-testid="family-experience"
      className="grid min-w-0 gap-5 pb-8"
    >
      {family?.profile ? <FamilyWaitHeader family={family} language={language} /> : null}

      <section className="rounded-control border border-care/20 bg-white p-4" aria-labelledby="family-interview-title">
        <p className="inline-flex rounded-full bg-calm px-3 py-1 text-xs font-semibold text-care">
          {tFamily(language, "demoBadge")}
        </p>
        <h2 id="family-interview-title" tabIndex={-1} className="mt-3 text-2xl font-semibold">
          {tFamily(language, "interviewTitle")}
        </h2>
        <p className="mt-1 text-sm leading-6 text-ink/75">{tFamily(language, "interviewIntro")}</p>
        <p className="mt-2 text-sm leading-6 text-ink/60">{tFamily(language, "intro")}</p>
        {language === "es" ? (
          <p className="mt-3 rounded-control bg-note p-3 text-sm font-medium">
            {tFamily(language, "spanishReviewNotice")}
          </p>
        ) : null}
        <div className="mt-4">
          <FamilyOrientationInterview
            key="family-orientation"
            profile={family?.profile ?? EMPTY_FAMILY_INTERVIEW_PROFILE}
            draft={family?.interviewDraft ?? ""}
            passcode={passcode}
            language={language}
            voiceEntryContext={{ patientId: state.patient.id, dispatch }}
            interlude={interlude}
            holdTurn={needsBasics}
            voiceLocked={pendingSafetyEvent !== undefined}
            completePlaceholder={
              (family?.interviews.length ?? 0) > 0
                ? tFamily(language, "journalNotePlaceholder")
                : undefined
            }
            onDraftChange={(draft) => dispatch({ type: "setFamilyInterviewDraft", draft })}
            onInterviewExtracted={addInterview}
            onSafetyEscalation={recordSafety}
          />
        </div>
        <div className="mt-4 border-t border-care/10 pt-4">
          <button
            type="button"
            aria-expanded={needsScreenOpen}
            aria-controls="family-needs-screen-panel"
            onClick={() => setNeedsScreenOpen((current) => !current)}
            className={`min-h-12 w-full min-w-0 rounded-control text-left ${CONTROL_FOCUS}`}
          >
            <span className="block break-words font-semibold">
              {tFamily(language, "needsScreenDisclosureTitle")}
            </span>
            <span className="mt-1 block break-words text-sm leading-6 text-ink/75">
              {tFamily(language, "needsScreenDisclosureBody")}
            </span>
          </button>
          {needsScreenOpen ? (
            <div id="family-needs-screen-panel" className="mt-4">
              <FamilyNeedsScreen
                key="family-screen"
                language={language}
                initialAnswers={family?.screenAnswers ?? []}
                onSubmit={submitScreen}
              />
            </div>
          ) : null}
        </div>
      </section>

      {family?.profile ? (
        <FamilyAppointmentCard
          family={family}
          language={language}
          locked={pendingSafetyEvent !== undefined}
          onSeedReferral={() => {
            const now = new Date();
            dispatch({
              type: "setFamilyReferral",
              referral: { clinic: FAMILY_APPOINTMENT_CLINIC, referredAt: now.toISOString() }
            });
            dispatch({ type: "offerFamilyAppointment", appointment: createFamilyAppointmentOffer(now) });
          }}
          onBook={(appointmentId, slot) =>
            dispatch({ type: "bookFamilyAppointment", appointmentId, slot, at: new Date().toISOString() })
          }
          onBarriers={(appointmentId, barriers: FamilyAppointmentBarrier[]) =>
            dispatch({
              type: "recordFamilyAppointmentBarriers",
              appointmentId,
              barriers,
              at: new Date().toISOString()
            })
          }
          onAckReminder={(appointmentId, offset: FamilyReminderOffset) =>
            dispatch({
              type: "acknowledgeFamilyAppointmentReminder",
              appointmentId,
              offset,
              at: new Date().toISOString()
            })
          }
          onReschedule={(appointmentId) =>
            dispatch({ type: "requestFamilyAppointmentReschedule", appointmentId, at: new Date().toISOString() })
          }
          onComplete={(appointmentId) =>
            dispatch({ type: "completeFamilyAppointment", appointmentId, at: new Date().toISOString() })
          }
          onMiss={(appointmentId) =>
            dispatch({ type: "missFamilyAppointment", appointmentId, at: new Date().toISOString() })
          }
          onRebook={() =>
            dispatch({ type: "offerFamilyAppointment", appointment: createFamilyAppointmentOffer(new Date()) })
          }
          onCountdown={(appointmentId, daysUntil: FamilyAppointmentCountdownDays) =>
            dispatch({
              type: "setFamilyAppointmentCountdown",
              appointmentId,
              daysUntil,
              now: new Date().toISOString()
            })
          }
        />
      ) : null}

      {followupAnswered ? (
        <section
          id="family-followup"
          data-testid="family-followup"
          className="rounded-control border border-care/20 bg-white p-4"
        >
          <p role="status" className="break-words text-sm leading-6">
            {tFamily(language, "followupThanks")}
          </p>
        </section>
      ) : followupStep && followupResource ? (
        <section
          id="family-followup"
          data-testid="family-followup"
          aria-labelledby="family-followup-question"
          className="rounded-control border border-care/20 bg-white p-4"
        >
          <p id="family-followup-question" className="break-words font-semibold">
            {tFamily(language, "followupQuestion", { name: followupResource.name })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {FOLLOWUP_OPTIONS.map(({ status, key }) => (
              <button
                key={status}
                type="button"
                onClick={() => answerFollowup(followupStep, status)}
                className={`min-h-12 min-w-0 break-words rounded-control border border-care/30 bg-care/5 px-4 py-2 text-left font-semibold text-care ${CONTROL_FOCUS}`}
              >
                {tFamily(language, key)}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {family && family.profile && family.activeDomains.length > 0 ? (
            <section
              id="family-resources"
              className="rounded-control border border-care/20 bg-paper p-4"
              aria-labelledby="family-resources-title"
            >
              <h2 id="family-resources-title" className="text-xl font-semibold">
                {tFamily(language, "resourcesTitle")}
              </h2>
              {rankedSet ? (
                <div data-testid="family-heard" className="mt-2 rounded-control bg-white p-3">
                  <h3 className="break-words font-semibold">{tFamily(language, "rankHeardTitle")}</h3>
                  <p className="mt-1 break-words text-sm leading-6 text-ink/80">{rankedSet.heard}</p>
                </div>
              ) : (
                <p className="mt-1 text-sm leading-6 text-ink/75">{tFamily(language, "resourcesIntro")}</p>
              )}
              {language === "es" ? (
                <p className="mt-2 rounded-control bg-note/30 p-3 text-sm leading-6 text-ink/75">
                  {tFamily(language, "resourceSourceLanguageNotice")}
                </p>
              ) : null}
              {matchResult.isFallback ? (
                <section
                  aria-label={tFamily(language, "emptyFallbackTitle")}
                  className="mt-4 rounded-control border border-note bg-note/20 p-3"
                >
                  <h3 className="font-semibold">{tFamily(language, "emptyFallbackTitle")}</h3>
                  <p className="mt-1 text-sm leading-6">{tFamily(language, "emptyFallbackBody")}</p>
                  <p className="mt-1 text-sm leading-6">{tFamily(language, "emptyNavigatorHonesty")}</p>
                  <div data-testid="matched-family-resources" className="mt-4 grid gap-3">
                    {matchResult.resources.map(({ resource, domain }) => (
                      <FamilyResourceCard
                        key={`fallback-${resource.id}`}
                        resource={resource}
                        domain={domain}
                        language={language}
                        step={family.steps.find(({ resourceId }) => resourceId === resource.id)}
                        onPlanStep={planStep}
                        isSaved={family.saved.some(({ resourceId }) => resourceId === resource.id)}
                        isEnrolled={family.alreadyEnrolled.includes(resource.id)}
                        onSave={saveResource}
                        onShare={shareResource}
                        onToggleEnrollment={(resourceId) =>
                          dispatch({ type: "toggleFamilyEnrollment", resourceId })
                        }
                      />
                    ))}
                  </div>
                </section>
              ) : (
                <div data-testid="matched-family-resources" className="mt-4 grid gap-3">
                  {displayResources.map(({ match: { resource, domain }, why, quote, urgency }) => (
                    <FamilyResourceCard
                      key={`matched-${resource.id}`}
                      resource={resource}
                      domain={domain}
                      language={language}
                      step={family.steps.find(({ resourceId }) => resourceId === resource.id)}
                      onPlanStep={planStep}
                      why={why}
                      becauseYouSaid={quote}
                      urgency={urgency}
                      isSaved={family.saved.some(({ resourceId }) => resourceId === resource.id)}
                      isEnrolled={family.alreadyEnrolled.includes(resource.id)}
                      onSave={saveResource}
                      onShare={shareResource}
                      onToggleEnrollment={(resourceId) =>
                        dispatch({ type: "toggleFamilyEnrollment", resourceId })
                      }
                    />
                  ))}
                </div>
              )}
              {nearbyTherapeuticRecreation.length > 0 ? (
                <section
                  role="region"
                  aria-label={tFamily(language, "nearbyTherapeuticRecreationTitle")}
                  className="mt-5 border-t border-care/20 pt-4"
                >
                  <h3 className="text-lg font-semibold">
                    {tFamily(language, "nearbyTherapeuticRecreationTitle")}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-ink/75">
                    {tFamily(language, "nearbyTherapeuticRecreationIntro")}
                  </p>
                  <div className="mt-3 grid gap-3">
                    {nearbyTherapeuticRecreation.map(({ resource, domain }) => (
                      <FamilyResourceCard
                        key={`nearby-recreation-${resource.id}`}
                        resource={resource}
                        domain={domain}
                        language={language}
                        step={family.steps.find(({ resourceId }) => resourceId === resource.id)}
                        onPlanStep={planStep}
                        isSaved={family.saved.some(({ resourceId }) => resourceId === resource.id)}
                        isEnrolled={family.alreadyEnrolled.includes(resource.id)}
                        onSave={saveResource}
                        onShare={shareResource}
                        onToggleEnrollment={(resourceId) =>
                          dispatch({ type: "toggleFamilyEnrollment", resourceId })
                        }
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </section>
          ) : null}

      {family && family.facts.length > 0 ? (
        <FamilyJournal
          family={family}
          language={language}
          onConfirm={(factId) => dispatch({ type: "confirmFamilyFact", factId })}
          onToggleInclude={(factId, include) =>
            dispatch({ type: "setFamilyFactInclusion", factId, include })
          }
        />
      ) : null}

      {family?.profile ? (
        <FamilyVisitPacket
          family={family}
          language={language}
          onToggleQuestion={(questionId) =>
            dispatch({ type: "toggleFamilyPacketQuestion", questionId })
          }
          onExport={(verb) =>
            dispatch({
              type: "addAuditEvent",
              event: recordAuditEvent(state.patient.id, "shared", `Family visit packet ${verb}`)
            })
          }
        />
      ) : null}

      <section className="rounded-control border border-care/20 bg-white p-4">
        <button
          type="button"
          aria-expanded={basicsOpen}
          aria-controls="family-basics-panel"
          onClick={() => setBasicsToggled(!basicsOpen)}
          className={`min-h-12 w-full min-w-0 rounded-control text-left ${CONTROL_FOCUS}`}
        >
          <span className="block break-words text-lg font-semibold">
            {tFamily(language, "setupTitle")}
          </span>
          <span className="mt-1 block break-words text-sm leading-6 text-ink/75">
            {tFamily(language, "setupIntro")}
          </span>
        </button>
        {basicsOpen ? (
          <div id="family-basics-panel" className="mt-4">
            <FamilyProfileForm
              key={`family-profile-${profileDiagnosisVersion}`}
              language={language}
              initialProfile={family?.profile ?? null}
              defaultCounty={state.patient.county}
              onSave={saveProfile}
            />
          </div>
        ) : null}
      </section>

      {savedResources.length > 0 ? (
        <section
          role="region"
          aria-label={tFamily(language, "savedResourcesTitle")}
          className="rounded-control border border-care/20 bg-paper p-4"
        >
          <h2 className="text-xl font-semibold">{tFamily(language, "savedResourcesTitle")}</h2>
          <ul className="mt-4 grid gap-3">
            {savedResources.map(({ resource, domain }) => (
              <li
                key={`saved-${resource.id}`}
                data-testid="saved-family-resource-summary"
                className="rounded-control border border-ink/10 bg-white p-4"
              >
                <h3 className="break-words text-lg font-semibold">{resource.name}</h3>
                <p className="mt-1 text-sm text-ink/70">
                  {tFamily(language, DOMAIN_KEYS[domain])}
                </p>
                <a
                  href={resource.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${tFamily(language, "resourceOpenSource")}: ${resource.name}`}
                  className={`mt-3 inline-flex min-h-12 min-w-0 items-center rounded-control border border-care px-3 py-2 text-sm font-semibold text-care ${CONTROL_FOCUS}`}
                >
                  {tFamily(language, "resourceOpenSource")}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {family?.profile ? (
        <FamilyStageTimeline
          family={family}
          language={language}
          nudgeFirstName={state.patient.preferredName}
          onBackdateDiagnoses={backdateFamilyDiagnoses}
        />
      ) : null}
    </div>
  );
}
