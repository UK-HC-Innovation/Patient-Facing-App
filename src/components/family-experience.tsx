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
import { FamilyFoldSection, useFamilyFoldAnchors } from "@/components/family-fold-section";
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
import { extractFamilyBasics, type FamilyBasicsHints } from "@/domain/family-basics-extract";
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
  buildStructuredResourceMatches,
  MAX_DISPLAY_RESOURCES,
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
  FamilyProfileProvenance,
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

// A stated or inferred hint wins; failing that, a child too young for school
// does not need to be asked about school. Every extracted birth year is
// approximate, so approximate-ness is not what makes a hint usable here.
function resolveSchoolStage(
  hints: FamilyBasicsHints,
  birthYear: number | null,
  now: Date
): FamilyProfile["schoolStage"] | null {
  if (hints.schoolStage) return hints.schoolStage.value;
  if (birthYear === null) return null;
  return now.getFullYear() - birthYear <= 4 ? "not_school_age" : null;
}

// Conversational county → birth year → school stage turns, asked in the thread
// once the first description lands and no profile exists yet. Anything the
// caregiver already wrote is committed on sight and never asked about — only the
// genuinely missing field gets a turn.
function FamilyBasicsTurns({
  language,
  hints,
  onComplete
}: {
  language: Language;
  hints: FamilyBasicsHints;
  onComplete: (basics: FamilyBasicsAnswers) => void;
}) {
  const [county, setCounty] = useState(hints.county?.value ?? "");
  const [committedCounty, setCommittedCounty] = useState<string | null>(hints.county?.value ?? null);
  const [year, setYear] = useState(hints.birthYear ? String(hints.birthYear.value) : "");
  const [committedYear, setCommittedYear] = useState<number | null>(hints.birthYear?.value ?? null);
  const [committedStage, setCommittedStage] = useState<FamilyProfile["schoolStage"] | null>(
    resolveSchoolStage(hints, hints.birthYear?.value ?? null, new Date())
  );
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
  // own words and whichever they answered as turns. Answering the year can settle
  // the stage on its own — a two-year-old is not asked about school.
  function finish(
    nextCounty: string | null,
    nextYear: number | null,
    nextStage: FamilyProfile["schoolStage"] | null
  ): void {
    const stage = nextStage ?? resolveSchoolStage(hints, nextYear, new Date());
    setCommittedCounty(nextCounty);
    setCommittedYear(nextYear);
    setCommittedStage(stage);
    if (nextCounty !== null && nextYear !== null && stage !== null) {
      onComplete({ county: nextCounty, birthYear: nextYear, schoolStage: stage });
    }
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
  // Drives the strip's disclosure. Held here rather than left to the native
  // <details> so the profile editor inside it can be mounted only while open.
  const [stripOpen, setStripOpen] = useState(false);
  // Reported up by the thread so the page's other asks can stand down for the
  // rest of the visit once a conversation is underway.
  const [threadActive, setThreadActive] = useState(false);
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

  // Nav chips, the wait-header rung link, and "See all" all point at sections
  // that may be folded; this opens whichever one they land on.
  useFamilyFoldAnchors();

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
    if (latestInterview) {
      return buildStructuredResourceMatches(
        family.profile,
        family.activeDomains,
        family.alreadyEnrolled,
        latestInterview.rawText
      );
    }
    return buildResourceMatches(family.profile, family.activeDomains, family.alreadyEnrolled);
  }, [family?.activeDomains, family?.alreadyEnrolled, family?.profile, latestInterview]);

  // The candidate set the ranker scores — the same deterministic retrieval, minus
  // the display truncation. Ranking may reorder and explain it; never add to it.
  const rankCandidates = useMemo<MatchedResource[]>(() => {
    if (!family?.profile || family.activeDomains.length === 0) return [];
    if (latestInterview) return matchResult.resources;
    return buildRankCandidates(family.profile, family.activeDomains, family.alreadyEnrolled).resources;
  }, [family?.activeDomains, family?.alreadyEnrolled, family?.profile, latestInterview, matchResult.resources]);

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
    const context = {
      interviewId,
      activeDomains: [...domains],
      profile,
      candidateIds: [...candidateIds],
      language
    };

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
        dispatch({
          type: "setFamilyRecommendations",
          recommendations: fallback,
          context
        });
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
              },
        context
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
    let ordered: Array<{
      match: MatchedResource;
      why: string | undefined;
      quote: string | undefined;
      urgency: "act_now" | "soon" | "when_ready" | undefined;
    }>;
    if (!rankedSet || matchResult.isFallback) {
      ordered = matched.map((match) => ({
        match,
        why: undefined,
        quote: undefined,
        urgency: undefined
      }));
    } else {
      const byId = new Map(rankCandidates.map((candidate) => [candidate.resource.id, candidate]));
      const ranked = rankedSet.items.flatMap((item) => {
        const match = byId.get(item.resourceId);
        return match
          ? [{ match, why: item.why, quote: item.becauseYouSaid, urgency: item.urgency }]
          : [];
      });
      const rankedIds = new Set(ranked.map(({ match }) => match.resource.id));
      ordered = [
        ...ranked,
        ...matched
          .filter(({ resource }) => !rankedIds.has(resource.id))
          .map((match) => ({ match, why: undefined, quote: undefined, urgency: undefined }))
      ];
    }

    // Enrollment sinks a card without making the family's just-recorded action
    // disappear beyond the eight-card surface.
    const enrolled = new Set(family?.alreadyEnrolled ?? []);
    const enrolledItems = ordered
      .filter(({ match }) => enrolled.has(match.resource.id))
      .slice(0, MAX_DISPLAY_RESOURCES);
    const unenrolledSlots = MAX_DISPLAY_RESOURCES - enrolledItems.length;
    return [
      ...ordered.filter(({ match }) => !enrolled.has(match.resource.id)).slice(0, unenrolledSlots),
      ...enrolledItems
    ];
  }, [family?.alreadyEnrolled, matchResult.isFallback, matchResult.resources, rankCandidates, rankedSet]);

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

  // The single dispatch site for the profile, which is what makes "any manual
  // save is stated" true by construction — only the silent auto-apply passes
  // "extracted".
  function saveProfile(profile: FamilyProfile, provenance?: FamilyProfileProvenance): void {
    const deterministicDomains = latestInterview
      ? extractFamilyInterviewMock(latestInterview.rawText, profile, new Date(), language).domains.map(({ domain }) => domain)
      : undefined;
    dispatch({ type: "saveFamilyProfile", profile, deterministicDomains, provenance });
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
    // The same resource can be on screen twice — once in the thread, once in the
    // library — and each card keeps its own consent checkbox. One share is one
    // audit line either way.
    const label = `Shared family resource: ${resource.name}`;
    if (state.auditEvents.some((event) => event.label === label)) {
      return;
    }
    dispatch({ type: "addAuditEvent", event: recordAuditEvent(state.patient.id, "shared", label) });
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

  // County and birth year are what matching needs; the stage follows from a hint
  // or, for a child too young for school, from the age itself. Anything short of
  // all three falls through to a turn rather than guessing.
  const autoBasics = useMemo<FamilyBasicsAnswers | null>(() => {
    const county = basicsHints.county?.value;
    const birthYear = basicsHints.birthYear?.value;
    if (county === undefined || birthYear === undefined) return null;
    const schoolStage = resolveSchoolStage(basicsHints, birthYear, new Date());
    return schoolStage === null ? null : { county, birthYear, schoolStage };
  }, [basicsHints]);

  // Applied without asking, and marked "extracted" so the strip and the visit
  // packet both keep saying these came from the description until someone checks
  // them. Latched per interview rather than per mount: StrictMode double-invokes
  // effects, and the same description must not re-apply over a later manual edit.
  // Not scoped to the first interview — a caregiver who starts over and then
  // writes a complete description would otherwise land in a profile-less state
  // that no turn can finish.
  const autoAppliedForRef = useRef<string | undefined>(undefined);
  const canAutoApply = !!family && !family.profile && autoBasics !== null;
  useEffect(() => {
    if (!canAutoApply || autoBasics === null) return;
    if (autoAppliedForRef.current === latestInterviewId) return;
    autoAppliedForRef.current = latestInterviewId;
    saveProfile({ ...autoBasics, diagnoses: [] }, "extracted");
    // saveProfile is re-created every render and only reads current props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAutoApply, autoBasics, latestInterviewId]);

  const basicsOpen = basicsToggled ?? false;
  const needsBasics =
    !!family &&
    !family.profile &&
    (family.interviews.length > 0 || family.activeDomains.length > 0);

  // One reading per render, so every First Steps card in the list counts down to
  // the same dated cutoff. Declared above the interlude because the inline cards
  // read it during that eagerly-evaluated JSX.
  const followupNow = new Date();
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

  // One card renderer, two places: the head of this list is what the thread
  // shows and the whole list is what the section shows, so a reorder from
  // ranking or an enrollment sink moves both.
  function resourceCard(
    item: (typeof displayResources)[number],
    keyPrefix: string,
    variant?: "full" | "compact"
  ): React.ReactNode {
    if (!family) return null;
    const {
      match: { resource, domain },
      why,
      quote,
      urgency
    } = item;
    return (
      <FamilyResourceCard
        key={`${keyPrefix}-${resource.id}`}
        resource={resource}
        domain={domain}
        variant={variant}
        language={language}
        county={family.profile?.county}
        matchNeed={tFamily(language, DOMAIN_KEYS[domain])}
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
        onToggleEnrollment={(resourceId) => dispatch({ type: "toggleFamilyEnrollment", resourceId })}
      />
    );
  }

  // The verification, in one sentence. Pieces we do not know are left out rather
  // than printed as empty placeholders, so this is assembled here and handed to
  // the template whole — tFamily renders an unmatched {token} literally.
  const heardParts: string[] = [];
  if (family?.profile?.county) {
    heardParts.push(tFamily(language, "heardStripCounty", { county: family.profile.county }));
  }
  if (family?.profile?.birthYear) {
    // Ladder's youngest families are the common case, and "about 1 years old" is
    // exactly the phrasing that reads as machine output. Each form is written out.
    const age = followupNow.getFullYear() - family.profile.birthYear;
    const child =
      family.profile.childFirstName?.trim() || tFamily(language, "heardStripChildFallback");
    const ageKey =
      age <= 0 ? "heardStripChildUnderOne" : age === 1 ? "heardStripChildOne" : "heardStripChild";
    heardParts.push(tFamily(language, ageKey, { child, age }));
  }
  const heardLead = rankedSet?.lead ?? family?.activeDomains[0];
  if (heardLead) {
    heardParts.push(tFamily(language, DOMAIN_KEYS[heardLead]));
  }
  // A validated live sentence replaces the deterministic one in place; both are
  // one line, so the swap does not move anything below it. Only a live one: the
  // deterministic ranker's `heard` is the generic catalog caveat, which says
  // less about this family than the sentence assembled above.
  const heardSentence =
    (rankedSet?.extraction === "live" ? rankedSet.heard : undefined) ??
    (heardParts.length > 0
      ? tFamily(language, "heardStripPrefix", { parts: heardParts.join(" · ") })
      : "");
  const hasUncheckedGuess =
    reviewFacts.some(({ status }) => status === "inferred") ||
    family?.profileProvenance === "extracted";

  const reviewTurn =
    reviewFacts.length > 0 || reviewDetails ? (
      <section
        ref={reviewRef}
        tabIndex={-1}
        aria-live="polite"
        aria-labelledby="family-facts-title"
        data-testid="family-heard-strip"
        className="rounded-control border border-ink/10 bg-paper p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care"
      >
        {heardSentence ? (
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <p
              data-testid="family-heard"
              className="min-w-0 break-words font-medium leading-relaxed text-ink"
            >
              {heardSentence}
            </p>
            {hasUncheckedGuess ? (
              <span
                data-testid="family-heard-guess-chip"
                className="rounded-full bg-note/40 px-2 py-1 text-xs font-semibold text-ink"
              >
                {tFamily(language, "stripGuessesChip")}
              </span>
            ) : null}
          </div>
        ) : null}
        <details open={stripOpen} className="mt-2">
          <summary
            onClick={(event) => {
              event.preventDefault();
              setStripOpen((open) => {
                // Two copies of the profile form on screen would each hold their
                // own draft, and whichever saved last would quietly undo the other.
                if (!open) setBasicsToggled(false);
                return !open;
              });
            }}
            className={`min-h-12 min-w-0 cursor-pointer list-item break-words rounded-control py-2 text-sm font-semibold text-care ${CONTROL_FOCUS}`}
          >
            {tFamily(language, "stripDisclosureSummary")}
          </summary>
          <div className="grid gap-3 pt-2">
            <h2 id="family-facts-title" className={H2_SECTION}>
              {tFamily(language, "factsTitle")}
            </h2>
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
            {/* Mounted only while open: a second copy of this form on the page
                would give every label two targets. */}
            {stripOpen ? (
              <div data-testid="family-heard-strip-editor">
                {family?.profileProvenance === "extracted" ? (
                  <p className="mb-2 break-words text-sm font-medium text-ink/75">
                    {tFamily(language, "stripExtractedNote")}
                  </p>
                ) : null}
                <FamilyProfileForm
                  key={`strip-profile-${profileDiagnosisVersion}`}
                  language={language}
                  initialProfile={family?.profile ?? null}
                  defaultCounty={state.patient.county}
                  onSave={saveProfile}
                />
              </div>
            ) : null}
            <p className="break-words text-sm leading-6 text-ink/70">
              {tFamily(language, "stripTrustLine")}
            </p>
          </div>
        </details>
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

  // The thread carries the head of the ranked list — the first answer — while the
  // section below stays the whole library. Tied to the strip: these cards are an
  // answer to something the caregiver just said, so without the strip above them
  // they would be three cards floating under the composer with no question.
  const threadAnswers = reviewTurn !== null;
  const threadResources =
    threadAnswers && !matchResult.isFallback ? displayResources.slice(0, 3) : [];
  const showFallbackInThread =
    threadAnswers && matchResult.isFallback && matchResult.resources.length > 0;

  const interlude =
    safetyTurn ||
    clinicNowTurn ||
    reviewTurn ||
    needsBasics ||
    threadResources.length > 0 ||
    showFallbackInThread ? (
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
        {threadResources.length > 0 ? (
          <div
            role="region"
            aria-label={tFamily(language, "threadResourcesTitle")}
            data-testid="thread-family-resources"
            className="grid gap-3"
          >
            {threadResources.map((item) => resourceCard(item, "thread", "compact"))}
            <p>
              <a
                href="#family-resources"
                className={`inline-flex min-h-12 min-w-0 items-center break-words font-semibold text-care underline underline-offset-4 ${CONTROL_FOCUS}`}
              >
                {/* The count names what the section actually renders — the
                    display-capped list — not the wider retrieval set. */}
                {tFamily(
                  language,
                  displayResources.length === 1 ? "seeAllResourcesOne" : "seeAllResources",
                  { count: displayResources.length }
                )}
              </a>
            </p>
          </div>
        ) : showFallbackInThread ? (
          <p className="mr-auto max-w-[90%] rounded-control border border-ink/10 bg-white p-3 font-medium leading-relaxed">
            {tFamily(language, "fallbackInThread")}{" "}
            <a href="#family-resources" className={`font-semibold text-care underline underline-offset-4 ${CONTROL_FOCUS}`}>
              {tFamily(language, "navResources")}
            </a>
          </p>
        ) : null}
      </>
    ) : null;

  // The check-in is the page's one ask while it is up, and it yields to both the
  // safety banner and the clinic-now card above it.
  const checkinVisible =
    family !== null &&
    family.profile !== null &&
    pendingSafetyEvent === undefined &&
    openFlag === undefined &&
    !checkinSkipped &&
    (checkinStarted || checkInDue(family, followupNow));
  // One ask at a time: the stale-step question also yields to an open thread turn,
  // which owns the ask for the rest of this visit.
  const followupStep =
    family &&
    !followupAnswered &&
    pendingSafetyEvent === undefined &&
    openFlag === undefined &&
    !checkinVisible &&
    !threadActive
      ? answerableStaleStep(family.steps, followupNow)
      : undefined;
  const followupResource = followupStep ? getFamilyResourceById(followupStep.resourceId) : undefined;

  // Catalog content follows the resource lead, then fills the small strip from
  // additive needs. This lets a direct therapy route stay first while a neutral
  // evaluation-education ask still receives checked, non-diagnostic material.
  const rankedGuideDomains = rankedSet?.lead
    ? [
        rankedSet.lead,
        ...(family?.activeDomains ?? []).filter(
          (domain) => domain !== rankedSet.lead
        )
      ]
    : family?.activeDomains ?? [];
  const guideDomains = rankedGuideDomains.includes("diagnosis_education")
    ? [
        ...rankedGuideDomains.filter(
          (domain) => domain !== "diagnosis_education"
        ),
        "diagnosis_education" as const
      ]
    : rankedGuideDomains;
  const guides =
    family?.profile && family.activeDomains.length > 0
      ? matchFamilyGuides(
          family.profile,
          guideDomains,
          followupNow
        )
      : [];

  // The library folds only once the thread is carrying the answer. On the
  // screen-only and fallback paths this section *is* the answer, so it stays open.
  const librarySize = matchResult.isFallback ? matchResult.resources.length : displayResources.length;
  const librarySummaryLine = [
    tFamily(language, librarySize === 1 ? "foldResourcesSummaryOne" : "foldResourcesSummary", {
      count: librarySize
    }),
    ...(guides.length > 0 ? [tFamily(language, "guidesTitle")] : [])
  ].join(" · ");

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
        <h2 id="family-interview-title" tabIndex={-1} className="text-xl font-semibold scroll-mt-4">
          {tFamily(language, "interviewTitle")}
        </h2>
        <p className="mt-2 leading-relaxed text-ink/90">{tFamily(language, "interviewIntro")}</p>
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
            showComplete={threadResources.length === 0}
            voiceLocked={pendingSafetyEvent !== undefined}
            completePlaceholder={
              (family?.interviews.length ?? 0) > 0
                ? tFamily(language, "journalNotePlaceholder")
                : undefined
            }
            onDraftChange={(draft) => dispatch({ type: "setFamilyInterviewDraft", draft })}
            onInterviewExtracted={addInterview}
            onSafetyEscalation={recordSafety}
            onThreadActiveChange={setThreadActive}
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
            <FamilyFoldSection
              id="family-resources"
              testId="family-resources"
              title={tFamily(language, "resourcesTitle")}
              titleId="family-resources-title"
              summaryLine={librarySummaryLine}
              defaultOpen={threadResources.length === 0}
              className={CARD_SECTION_PAPER}
            >
              {/* The "here is what we heard" line lives in the thread's strip now,
                  but this paragraph also carries the eligibility caveat — every
                  program's own rules are the ones that count. It stands down only
                  when a grounded model sentence is on screen, which is exactly
                  when it stood down before. */}
              {rankedSet?.extraction === "live" ? null : (
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
                        county={family.profile?.county}
                        matchNeed={tFamily(language, DOMAIN_KEYS[domain])}
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
                  {displayResources.map((item) => resourceCard(item, "matched"))}
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
                        county={family.profile?.county}
                        matchNeed={tFamily(language, DOMAIN_KEYS[domain])}
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
            </FamilyFoldSection>
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
          onClick={() => {
            // Mirrors the strip's disclosure: one profile editor open at a time.
            if (!basicsOpen) setStripOpen(false);
            setBasicsToggled(!basicsOpen);
          }}
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
