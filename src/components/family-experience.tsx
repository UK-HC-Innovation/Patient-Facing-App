"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch
} from "react";
import { FamilyAppointmentCard } from "@/components/family-appointment-card";
import { FamilyCheckin, type CheckinPart } from "@/components/family-checkin";
import { FamilyClinicNowCard } from "@/components/family-clinic-now-card";
import { FamilyCrisisBanner } from "@/components/family-crisis-banner";
import { FamilyFactCard } from "@/components/family-fact-card";
import { FamilyGuideCard } from "@/components/family-guide-card";
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
  createSoonerAppointmentOffer,
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
import { firstStepsClock, hasEnrolledFirstSteps } from "@/domain/family-clocks";
import { matchFamilyGuides } from "@/domain/family-guides";
import { answerableStaleStep, checkInDue } from "@/domain/family-journey";
import {
  extractFamilyInterviewMock,
  familyFactStatus,
  shouldRaiseFamilyRegressionFlag
} from "@/domain/family-interview";
import {
  extractFamilyBasics,
  hasFamilyBasicsHints,
  type FamilyBasicsHints
} from "@/domain/family-basics-extract";
import {
  KY_COUNTIES,
  getFamilyResourceById,
  isFirstStepsResource,
  type FamilyResource
} from "@/domain/family-resources";
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
  FamilyInterview,
  FamilyProfile,
  FamilyPulse,
  FamilyReminderOffset,
  FamilyResourceStep,
  FamilyScreenAnswer,
  FamilySoonerConstraint,
  FamilyStepStatus
} from "@/domain/types";
import {
  ASK_EYEBROW,
  BTN_CHOICE,
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD_ASK,
  CARD_SECTION,
  CARD_SECTION_PAPER,
  CARD_SUBDUED,
  CONTROL_FOCUS,
  DEMO_BLOCK,
  H2_SECTION,
  NOTICE_INFO
} from "@/components/family-theme";
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
            <button type="button" onClick={acceptPrefill} className={BTN_PRIMARY}>
              {tFamily(language, "basicsPrefillConfirm")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingPrefill(false)}
              className={BTN_SECONDARY}
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
              className={BTN_PRIMARY}
            >
              {tFamily(language, "basicsTurnNext")}
            </button>
          </div>
        </div>
      ) : (
        <div className="ml-auto max-w-[90%] rounded-control bg-calm/60 p-3">
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
              <button type="button" onClick={commitYear} className={BTN_PRIMARY}>
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
        <div className="ml-auto max-w-[90%] rounded-control bg-calm/60 p-3">
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
                className={BTN_CHOICE}
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
  // The check-in's own parts stamp touches, which would close the card halfway
  // through; started keeps it open for this visit, skipped closes it for good.
  const [checkinStarted, setCheckinStarted] = useState(false);
  const [checkinSkipped, setCheckinSkipped] = useState(false);
  // The sequence position lives here, not in the card, because a probe yes
  // raises a flag and the clinic-now card takes the page — unmounting the card
  // mid-sequence. Holding the position out here means acknowledging that card
  // hands the caregiver back the part they had not answered (the pulse) instead
  // of restarting at the note invite and re-asking the probe.
  const [checkinPart, setCheckinPart] = useState<CheckinPart>("note");
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
    const deterministicDomains = latestInterview
      ? extractFamilyInterviewMock(latestInterview.rawText, profile, new Date(), language).domains.map(({ domain }) => domain)
      : undefined;
    dispatch({ type: "saveFamilyProfile", profile, deterministicDomains });
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
    { round, newText }: { round: number; newText: string }
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
    // A follow-up round continues the conversation it belongs to, so it files
    // under that conversation's kind: the orientation's rounds stay orientation
    // and never inflate the journal's note count, and a check-in's rounds stay
    // check-in.
    const kind: FamilyInterview["kind"] =
      interviewKindRef.current ??
      (round > 0 ? latestInterview?.kind : undefined) ??
      ((family?.interviews.length ?? 0) === 0 ? "orientation" : "note");
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
    // Loss of an acquired skill is a "call the clinic" signal, not a crisis. The
    // reducer keeps it to one open flag, so a note that says it twice asks once.
    // Only the words just written are read: `meta.rawText` carries the whole
    // conversation, so scanning it every round would re-raise the same sentence
    // each time the caregiver acknowledged the card and answered on.
    if (
      shouldRaiseFamilyRegressionFlag(
        newText,
        family?.profile ?? EMPTY_FAMILY_INTERVIEW_PROFILE,
        language
      )
    ) {
      dispatch({ type: "raiseFamilyRegressionFlag", source: "text", at: createdAt });
    }
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

  function acknowledgeClinicNow(flagId: string): void {
    dispatch({ type: "acknowledgeFamilyRegressionFlag", flagId, at: new Date().toISOString() });
  }

  // The check-in never opens a second writing surface: it hands the caregiver
  // the same interview box, tagged so the note files as a check-in.
  function openCheckinNote(): void {
    setCheckinStarted(true);
    interviewKindRef.current = "checkin";
    const box = document.getElementById("family-interview-text");
    if (box instanceof HTMLElement) {
      box.focus();
    }
  }

  function answerCheckinProbe(answer: "no" | "yes"): void {
    setCheckinStarted(true);
    if (answer === "yes") {
      dispatch({ type: "raiseFamilyRegressionFlag", source: "probe", at: new Date().toISOString() });
    }
  }

  function recordCheckinPulse(score: FamilyPulse["score"]): void {
    setCheckinStarted(true);
    dispatch({ type: "recordFamilyPulse", pulse: { at: new Date().toISOString(), score } });
  }

  function skipCheckin(): void {
    setCheckinSkipped(true);
    dispatch({ type: "skipFamilyCheckin", at: new Date().toISOString() });
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
        className="grid gap-3 rounded-control border border-ink/10 bg-paper p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care"
      >
        <h2 id="family-facts-title" className={H2_SECTION}>
          {tFamily(language, "factsTitle")}
        </h2>
        <p className="leading-relaxed text-ink/80">{tFamily(language, "factsIntro")}</p>
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

  // Directly under the safety slot, and never styled like it: informational,
  // dismissible, and the page keeps working around it.
  const openFlag = family?.flags.find(({ acknowledgedAt }) => acknowledgedAt === undefined);
  const clinicNowTurn = openFlag ? (
    <FamilyClinicNowCard
      key={openFlag.id}
      flag={openFlag}
      language={language}
      clinic={family?.referral?.clinic ?? FAMILY_APPOINTMENT_CLINIC}
      onAcknowledge={acknowledgeClinicNow}
    />
  ) : null;

  const interlude =
    safetyTurn || clinicNowTurn || reviewTurn || needsBasics || matchResult.resources.length > 0 ? (
      <>
        {safetyTurn}
        {clinicNowTurn}
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
          <p className="mr-auto max-w-[90%] rounded-control border border-ink/10 bg-white p-3 font-medium leading-relaxed">
            {tFamily(
              language,
              matchResult.resources.length === 1 ? "resourcesFoundBelowOne" : "resourcesFoundBelow",
              { count: matchResult.resources.length }
            )}{" "}
            <a href="#family-resources" className={`font-semibold text-care underline underline-offset-4 ${CONTROL_FOCUS}`}>
              {tFamily(language, "navResources")}
            </a>
          </p>
        ) : null}
      </>
    ) : null;

  // One follow-up per page visit, and never while the safety message, the
  // clinic-now card, or the monthly check-in owns the page's single ask.
  const followupNow = new Date();
  // The check-in is the page's one ask while it is up, and it yields to both the
  // safety banner and the clinic-now card above it.
  const checkinVisible =
    family !== null &&
    family.profile !== null &&
    pendingSafetyEvent === undefined &&
    openFlag === undefined &&
    !checkinSkipped &&
    (checkinStarted || checkInDue(family, followupNow));
  const followupStep =
    family &&
    !followupAnswered &&
    pendingSafetyEvent === undefined &&
    openFlag === undefined &&
    !checkinVisible
      ? answerableStaleStep(family.steps, followupNow)
      : undefined;
  const followupResource = followupStep ? getFamilyResourceById(followupStep.resourceId) : undefined;

  // One reading per render, so every First Steps card in the list counts down to
  // the same dated cutoff.
  const clock = family?.profile
    ? firstStepsClock(family.profile, followupNow, hasEnrolledFirstSteps(family))
    : null;
  const firstStepsClockLine =
    clock === null
      ? undefined
      : tFamily(language, clock.yearOnly ? "clockFirstStepsYearOnly" : "clockFirstSteps", {
          weeks: clock.weeksLeft
        });
  const clockLineFor = (resource: FamilyResource): string | undefined =>
    isFirstStepsResource(resource.id) ? firstStepsClockLine : undefined;

  // Catalog content, matched on the same lead domain the resources use — the
  // ranker's lead when it produced one, the deterministic first domain otherwise.
  const guides =
    family?.profile && family.activeDomains.length > 0
      ? matchFamilyGuides(family.profile, rankedSet?.lead ?? family.activeDomains[0], followupNow)
      : [];

  return (
    <div
      id="family-experience"
      lang={language}
      data-testid="family-experience"
      className="mx-auto grid w-full min-w-0 max-w-2xl gap-4 pb-8 scroll-mt-4"
    >
      {family?.profile ? (
        // Same instant and same check-in visibility the sections below are
        // built from, so the rung can never name a section this render omits.
        <FamilyWaitHeader
          family={family}
          language={language}
          now={followupNow}
          checkinOpen={checkinVisible}
        />
      ) : null}

      {family && checkinVisible ? (
        <FamilyCheckin
          family={family}
          language={language}
          part={checkinPart}
          onPartChange={setCheckinPart}
          resuming={checkinStarted}
          onOpenNote={openCheckinNote}
          onProbeAnswer={answerCheckinProbe}
          onPulse={recordCheckinPulse}
          onSkip={skipCheckin}
        />
      ) : null}

      {family?.profile && !checkinVisible ? (
        <section data-testid="family-checkin-demo" className={DEMO_BLOCK}>
          <button
            type="button"
            onClick={() =>
              dispatch({ type: "backdateFamilyTouches", days: 31, now: new Date().toISOString() })
            }
            className={`min-h-12 min-w-0 break-words rounded-control border border-ink/25 bg-white px-4 py-2 text-sm font-semibold text-ink/70 ${CONTROL_FOCUS}`}
          >
            {tFamily(language, "checkinDemoControl")}
          </button>
        </section>
      ) : null}

      <section className={CARD_SECTION} aria-labelledby="family-interview-title">
        <p className="inline-flex rounded-full border border-ink/20 px-3 py-1 text-xs font-medium text-ink/70">
          {tFamily(language, "demoBadge")}
        </p>
        <h2 id="family-interview-title" tabIndex={-1} className="mt-3 text-xl font-semibold scroll-mt-4">
          {tFamily(language, "interviewTitle")}
        </h2>
        <p className="mt-2 leading-relaxed text-ink/90">{tFamily(language, "interviewIntro")}</p>
        <details className="mt-2">
          <summary
            className={`min-h-12 min-w-0 cursor-pointer list-item break-words rounded-control py-2 text-sm font-semibold text-care ${CONTROL_FOCUS}`}
          >
            {tFamily(language, "introDisclosureTitle")}
          </summary>
          <p className="mt-1 text-sm leading-6 text-ink/70">{tFamily(language, "intro")}</p>
        </details>
        {language === "es" ? (
          <p className={`mt-3 text-sm font-medium ${NOTICE_INFO}`}>
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
          onJoinSoonerList={(constraints: FamilySoonerConstraint[]) =>
            dispatch({
              type: "setFamilySoonerList",
              soonerList: { optedInAt: new Date().toISOString(), constraints }
            })
          }
          onLeaveSoonerList={() => dispatch({ type: "clearFamilySoonerList" })}
          onSoonerOffer={(supersedesId) => {
            const soonerList = family.soonerList;
            if (soonerList === null) {
              return;
            }
            dispatch({
              type: "offerFamilyAppointment",
              appointment: createSoonerAppointmentOffer(
                new Date(),
                soonerList.constraints,
                supersedesId
              )
            });
          }}
          onDeclineSoonerOffer={(appointmentId) =>
            dispatch({
              type: "withdrawFamilyAppointmentOffer",
              appointmentId,
              at: new Date().toISOString()
            })
          }
        />
      ) : null}

      {followupAnswered ? (
        <section
          id="family-followup"
          data-testid="family-followup"
          className={CARD_SECTION}
        >
          <p role="status" className="break-words leading-relaxed">
            {tFamily(language, "followupThanks")}
          </p>
        </section>
      ) : followupStep && followupResource ? (
        <section
          id="family-followup"
          data-testid="family-followup"
          aria-labelledby="family-followup-question"
          className={CARD_ASK}
        >
          <p className={ASK_EYEBROW}>{tFamily(language, "askEyebrow")}</p>
          <p id="family-followup-question" className="mt-2 break-words text-xl font-semibold">
            {tFamily(language, "followupQuestion", { name: followupResource.name })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {FOLLOWUP_OPTIONS.map(({ status, key }) => (
              <button
                key={status}
                type="button"
                onClick={() => answerFollowup(followupStep, status)}
                className={BTN_CHOICE}
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
              className={CARD_SECTION_PAPER}
              aria-labelledby="family-resources-title"
            >
              <h2 id="family-resources-title" className={H2_SECTION}>
                {tFamily(language, "resourcesTitle")}
              </h2>
              {rankedSet ? (
                <div data-testid="family-heard" className="mt-2 rounded-control bg-white p-3">
                  <h3 className="break-words font-semibold">{tFamily(language, "rankHeardTitle")}</h3>
                  <p className="mt-1 break-words leading-relaxed text-ink/90">{rankedSet.heard}</p>
                </div>
              ) : (
                <p className="mt-1 leading-relaxed text-ink/80">{tFamily(language, "resourcesIntro")}</p>
              )}
              {language === "es" ? (
                <p className={`mt-2 text-sm text-ink/80 ${NOTICE_INFO}`}>
                  {tFamily(language, "resourceSourceLanguageNotice")}
                </p>
              ) : null}
              {matchResult.isFallback ? (
                <section
                  aria-label={tFamily(language, "emptyFallbackTitle")}
                  className="mt-4 rounded-control border border-note bg-note/20 p-3"
                >
                  <h3 className="font-semibold">{tFamily(language, "emptyFallbackTitle")}</h3>
                  <p className="mt-1 leading-relaxed">{tFamily(language, "emptyFallbackBody")}</p>
                  <p className="mt-1 leading-relaxed">{tFamily(language, "emptyNavigatorHonesty")}</p>
                  <div data-testid="matched-family-resources" className="mt-4 grid gap-3">
                    {matchResult.resources.map(({ resource, domain }) => (
                      <FamilyResourceCard
                        key={`fallback-${resource.id}`}
                        resource={resource}
                        domain={domain}
                        language={language}
                        step={family.steps.find(({ resourceId }) => resourceId === resource.id)}
                        onPlanStep={planStep}
                        clockLine={clockLineFor(resource)}
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
                      clockLine={clockLineFor(resource)}
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
              {guides.length > 0 ? (
                <section
                  id="family-guides"
                  data-testid="family-guides"
                  role="region"
                  aria-label={tFamily(language, "guidesTitle")}
                  className="mt-5 border-t border-ink/10 pt-4 scroll-mt-4"
                >
                  <h3 className="text-lg font-semibold">{tFamily(language, "guidesTitle")}</h3>
                  <p className="mt-1 leading-relaxed text-ink/80">{tFamily(language, "guidesIntro")}</p>
                  <div className="mt-3 grid gap-3">
                    {guides.map((guide) => (
                      <FamilyGuideCard key={guide.id} guide={guide} language={language} />
                    ))}
                  </div>
                </section>
              ) : null}
              {nearbyTherapeuticRecreation.length > 0 ? (
                <section
                  role="region"
                  aria-label={tFamily(language, "nearbyTherapeuticRecreationTitle")}
                  className="mt-5 border-t border-ink/10 pt-4"
                >
                  <h3 className="text-lg font-semibold">
                    {tFamily(language, "nearbyTherapeuticRecreationTitle")}
                  </h3>
                  <p className="mt-1 leading-relaxed text-ink/80">
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
                        clockLine={clockLineFor(resource)}
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
              <p className="mt-5 border-t border-ink/10 pt-3">
                <a
                  href="#family-experience"
                  className={`inline-flex min-h-12 min-w-0 items-center text-sm font-semibold text-ink/70 underline underline-offset-4 ${CONTROL_FOCUS}`}
                >
                  {tFamily(language, "backToTop")}
                </a>
              </p>
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

      <section className={CARD_SUBDUED}>
        <button
          type="button"
          aria-expanded={basicsOpen}
          aria-controls="family-basics-panel"
          onClick={() => setBasicsToggled(!basicsOpen)}
          className={`min-h-12 w-full min-w-0 rounded-control text-left ${CONTROL_FOCUS}`}
        >
          <span className="block break-words font-semibold text-ink/90">
            {tFamily(language, "setupTitle")}
          </span>
          <span className="mt-1 block break-words text-sm leading-6 text-ink/70">
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
          className={CARD_SUBDUED}
        >
          <h2 className="font-semibold text-ink/90">{tFamily(language, "savedResourcesTitle")}</h2>
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
