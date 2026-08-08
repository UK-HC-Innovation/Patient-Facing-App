"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch
} from "react";
import { FamilyAiConsentCard } from "@/components/family-ai-consent-card";
import { FamilyAppointmentCard } from "@/components/family-appointment-card";
import { FamilyCheckin, type CheckinPart } from "@/components/family-checkin";
import { FamilyCheckinReminder } from "@/components/family-checkin-reminder";
import { FamilyClockHandoff } from "@/components/family-clock-handoff";
import { FamilyClockNotice, familyClockLine } from "@/components/family-clock-notice";
import { FamilyGlossSurface } from "@/components/family-gloss";
import {
  LadderPanel,
  LadderShell,
  useLadderAnchorSurface,
  type LadderSurface
} from "@/components/ladder-shell";
import { FamilyClinicNowCard } from "@/components/family-clinic-now-card";
import { FamilyCrisisBanner } from "@/components/family-crisis-banner";
import { FamilyUrgentHelpControl } from "@/components/family-urgent-help-control";
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
import { FamilySourceLanguageNotice } from "@/components/family-source-language-notice";
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
import { ladderSimEnabled } from "@/domain/ladder-sim";
import {
  canSendFamilyTextOffDevice,
  familyAiUseMode,
  shouldOfferFamilyAiChoice,
  type FamilyAiConsent
} from "@/domain/family-ai-consent";
import {
  createFamilySafetyEvent,
  domainsAfterSafety,
  pendingFamilySafetyEvent,
  type FamilySafetyScreen
} from "@/domain/family-safety";
import type { FamilyDiagnosisBackdateMonths } from "@/domain/family-stages";
import { resolveFamilyClinicNowTarget } from "@/domain/family-clinic-now";
import { firstStepsClock, firstStepsWindowClosed, hasEnrolledFirstSteps } from "@/domain/family-clocks";
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
import { Mic } from "lucide-react";
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
  H2_SECTION
} from "@/components/family-theme";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { HealthAction } from "@/state/store";

export type FamilyExperienceProps = {
  state: AppState;
  dispatch: Dispatch<HealthAction>;
  passcode?: string;
  /**
   * F1b test seam. Production never passes this — `/ladder` mounts the default
   * "unset", which sends nothing until the caregiver answers the disclosure. It
   * exists so a test can start from an already-consented session without driving
   * the two-turn interaction, and it defaults to the private direction so
   * forgetting it can only ever under-send.
   */
  initialAiConsent?: FamilyAiConsent;
};

type ReviewDetails = {
  domains: SanitizedFamilyInterviewResult["domains"];
};

const AI_USE_TITLE_KEYS = {
  none: "aiUseNoneTitle",
  on_device: "aiUseOnDeviceTitle",
  online: "aiUseOnlineTitle"
} as const satisfies Record<string, FamilyStringKey>;

const AI_USE_BODY_KEYS = {
  none: "aiUseNoneBody",
  on_device: "aiUseOnDeviceBody",
  online: "aiUseOnlineBody"
} as const satisfies Record<string, FamilyStringKey>;

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

export function FamilyExperience({
  state,
  dispatch,
  passcode,
  initialAiConsent = "unset"
}: FamilyExperienceProps) {
  const language = state.patient.language;
  const family = state.family;
  const [reviewDetails, setReviewDetails] = useState<ReviewDetails | null>(null);
  const safetyEvents = family?.safetyEvents ?? [];
  const pendingSafetyEvent = pendingFamilySafetyEvent(safetyEvents);
  const [needsScreenOpen, setNeedsScreenOpen] = useState(false);
  // Drives the strip's disclosure. Held here rather than left to the native
  // <details> so the profile editor inside it can be mounted only while open.
  const [stripOpen, setStripOpen] = useState(false);
  // Reported up by the thread so the page's other asks can stand down for the
  // rest of the visit once a conversation is underway.
  const [threadActive, setThreadActive] = useState(false);
  // F1b. Session-scoped on purpose: never persisted, so a shared phone does not
  // inherit the last caregiver's answer and no storage migration can revive it.
  // "unset" is the resting state, and the resting state sends nothing.
  const [aiConsent, setAiConsent] = useState<FamilyAiConsent>(initialAiConsent);
  // Recomputed every render rather than memoised: `passcode` arrives a tick after
  // mount (the ladder page reads ?k= in an effect), so anything that latches on
  // its first value would pin the gate shut and look like it was working.
  // F3a. One switch for the whole simulation, read once per render so every
  // affordance answers to the same posture and none can drift on its own.
  const simEnabled = ladderSimEnabled();
  const liveAllowed = canSendFamilyTextOffDevice({ passcode, consent: aiConsent });
  const offerAiChoice = shouldOfferFamilyAiChoice({ passcode, consent: aiConsent });
  const aiUseMode = familyAiUseMode({
    liveSends: (family?.interviews ?? []).filter(({ extraction }) => extraction === "live").length,
    turnsTaken: family?.interviews.length ?? 0
  });
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
  // Which of the four surfaces is showing. Every panel stays mounted, so a tab
  // is a change of view, never a loss of what the caregiver had open.
  const [surface, setSurface] = useState<LadderSurface>("home");
  const [visitNoticeOpen, setVisitNoticeOpen] = useState(false);
  // The composer collapses to a one-tap row on a return visit; opening it is
  // what the front-door CTA and the check-in's "Add a note" both do.
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerFocusTick, setComposerFocusTick] = useState(0);
  const reviewRef = useRef<HTMLElement>(null);
  const pendingReviewFocusRef = useRef(false);
  const safetyTurnRef = useRef(false);
  // Set by a turn that owns the next submission (the monthly check-in); otherwise
  // the first interview is the orientation and everything after it is a note.
  const interviewKindRef = useRef<"note" | "checkin" | null>(null);
  // Set in the click handler, before the render that sees the new interview, so
  // a note written now is never mistaken for history the caregiver arrived with.
  const wroteThisSessionRef = useRef(false);
  const latestInterview = family?.interviews.at(-1);
  const latestInterviewId = latestInterview?.id;
  const reviewFacts = family?.facts.filter(({ interviewId }) => interviewId === latestInterviewId) ?? [];
  const profileDiagnosisVersion =
    family?.profile?.diagnoses.map(({ id, diagnosedAt }) => `${id}:${diagnosedAt ?? ""}`).join("|") ?? "none";

  // Doorway rows, the wait-header rung link, and "See all" all point at sections
  // that may be folded; this opens whichever one they land on.
  useFamilyFoldAnchors();
  // …and may now live on another surface, so the tab has to change first or the
  // anchor lands on a hidden panel.
  useLadderAnchorSurface(setSurface);

  useEffect(() => {
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = language;
    return () => {
      document.documentElement.lang = previousLanguage;
    };
  }, [language]);

  useEffect(() => {
    const referral = family?.referral;
    if (!referral) {
      setVisitNoticeOpen(false);
      return;
    }
    const key = `ladder-visit-notice:${state.patient.id}:${referral.referredAt}`;
    try {
      setVisitNoticeOpen(window.localStorage.getItem(key) !== "seen");
    } catch {
      // Storage can be unavailable in a private or locked-down browser. The
      // notice remains useful for this visit and dismissal still works in memory.
      setVisitNoticeOpen(true);
    }
  }, [family?.referral, state.patient.id]);

  function dismissVisitNotice(): void {
    const referral = family?.referral;
    setVisitNoticeOpen(false);
    if (!referral) return;
    try {
      window.localStorage.setItem(
        `ladder-visit-notice:${state.patient.id}:${referral.referredAt}`,
        "seen"
      );
    } catch {
      // Dismissal still holds for this mounted session when storage is blocked.
    }
  }

  useEffect(() => {
    if (pendingReviewFocusRef.current && latestInterviewId) {
      reviewRef.current?.focus();
      pendingReviewFocusRef.current = false;
    }
  }, [latestInterviewId]);

  useEffect(() => {
    if (composerFocusTick === 0) return;
    const box = document.getElementById("family-interview-text");
    if (box instanceof HTMLElement) box.focus();
  }, [composerFocusTick]);

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
    // F1a/F1e. This is an effect, not a submit handler: a returning visitor with
    // a stored interview and no stored ranking would POST their narrative on page
    // load, with no action of their own. Gating only the composers would have
    // left this path wide open, and the caregiver would never have seen the ask.
    if (!liveAllowed) {
      dispatch({
        type: "setFamilyRecommendations",
        recommendations: rankFamilyResourcesMock(
          rankCandidates,
          family.activeDomains,
          latestInterview.rawText,
          language,
          latestInterview.id
        ),
        context: {
          interviewId: latestInterview.id,
          activeDomains: [...family.activeDomains],
          profile: family.profile,
          candidateIds: rankCandidates.map(({ resource }) => resource.id),
          language
        }
      });
      return;
    }

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
    liveAllowed,
    passcode,
    pendingSafetyEvent,
    rankCandidates,
    rankedSet
  ]);

  // One reading per render, so every First Steps card in the list counts down to
  // the same dated cutoff. Declared above the interlude because the inline cards
  // read it during that eagerly-evaluated JSX.
  const followupNow = new Date();
  const clock = family?.profile
    ? firstStepsClock(family.profile, followupNow, hasEnrolledFirstSteps(family))
    : null;
  // F7b. The clock rung links #family-resources because the countdown lives on
  // the First Steps card — but the section shows the model-ranked top eight, and
  // nothing kept that card inside the cut. A caregiver could tap "17 weeks left
  // to start First Steps" and land on a list with no First Steps card on it.
  const pinFirstSteps =
    clock !== null && (family?.activeDomains.includes("early_intervention") ?? false);
  // F7c: the clock did not just stop showing — the window actually closed.
  const clockWindowClosed =
    family?.profile !== undefined &&
    family?.profile !== null &&
    firstStepsWindowClosed(family.profile, followupNow, hasEnrolledFirstSteps(family));

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
    const unenrolled = ordered.filter(({ match }) => !enrolled.has(match.resource.id));
    // F7b: pin first, then fill by rank. Ranking still decides which First Steps
    // entry leads (the county POE outranks the statewide line) and the order of
    // everything else — the pin only guarantees the card the clock points at is
    // one of the eight.
    const pinned =
      pinFirstSteps && !unenrolled.slice(0, unenrolledSlots).some(({ match }) => isFirstStepsResource(match.resource.id))
        ? unenrolled.filter(({ match }) => isFirstStepsResource(match.resource.id)).slice(0, 1)
        : [];
    const pinnedIds = new Set(pinned.map(({ match }) => match.resource.id));
    return [
      ...pinned,
      ...unenrolled
        .filter(({ match }) => !pinnedIds.has(match.resource.id))
        .slice(0, Math.max(0, unenrolledSlots - pinned.length)),
      ...enrolledItems
    ];
  }, [
    family?.alreadyEnrolled,
    matchResult.isFallback,
    matchResult.resources,
    pinFirstSteps,
    rankCandidates,
    rankedSet
  ]);

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
    // F2b. A crisis turn routes, but it is not recorded and it is not presented
    // as an interpretation. Before this, the disclosure ran the whole pipeline:
    // facts were made from it, the raw words were persisted (so they sat in the
    // Journal on a shared phone and printed in the clinician packet), the
    // regression scanner read the same sentence, and `parent_support` was
    // injected — filing "my son says he wants to die" as an ordinary resource
    // category, which is the dismissiveness the review named.
    //
    // Routing deliberately survives. Spec 11's motivating case (the Breathitt
    // vignette: school exclusion plus harm to an animal) trips safety AND must
    // still reach school-discipline help; suppressing everything would answer a
    // caregiver's hardest message with nothing at all.
    if (safetyTurnRef.current) {
      safetyTurnRef.current = false;
      interviewKindRef.current = null;
      setReviewDetails(null);
      dispatch({
        type: "recordFamilySafetyTurn",
        // Routing keeps its existing floor: whatever this turn named, else what
        // was already established, else caregiver support — because retrieval
        // with no domains returns nothing, and a blank page is not an answer to
        // a crisis. What changed is that none of this is presented back as an
        // interpretation, and none of it is written down.
        domains: domainsAfterSafety(
          result.domains.map(({ domain }) => domain),
          family?.activeDomains ?? []
        )
      });
      return;
    }
    pendingReviewFocusRef.current = round === 0;
    wroteThisSessionRef.current = true;
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
    // A follow-up round continues the conversation it belongs to, so it files
    // under that conversation's kind: the orientation's rounds stay orientation
    // and never inflate the journal's note count, and a check-in's rounds stay
    // check-in.
    const kind: FamilyInterview["kind"] =
      interviewKindRef.current ??
      (round > 0 ? latestInterview?.kind : undefined) ??
      ((family?.interviews.length ?? 0) === 0 ? "orientation" : "note");
    interviewKindRef.current = null;

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
      domains: extractedDomains
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
      // The interview is carried so the caregiver can retract the sentence that
      // raised the flag — and with it the packet's "possible loss of skills" line.
      dispatch({ type: "raiseFamilyRegressionFlag", source: "text", at: createdAt, interviewId });
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
    // F8.5. The same card can be on screen twice (thread and library) and each
    // keeps its own consent, so one share is one audit line — but "ever" was
    // the wrong window: a genuine second share months later was silently never
    // recorded. Deduped per label per day.
    const label = `Shared family resource: ${resource.name}`;
    const today = new Date().toISOString().slice(0, 10);
    if (
      state.auditEvents.some(
        (event) => event.label === label && event.createdAt.slice(0, 10) === today
      )
    ) {
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

  /**
   * The one composer, reached from anywhere. No surface adds a second free-text
   * field: every "add a note" and "tell us more" comes here, which is also what
   * keeps a single crisis gate over everything a caregiver writes.
   */
  function openComposer(kind: "note" | "checkin"): void {
    interviewKindRef.current = kind === "checkin" ? "checkin" : null;
    setSurface("home");
    setComposerOpen(true);
    // The box may not be mounted yet on a return visit, so focus waits for the
    // render that puts it there.
    setComposerFocusTick((tick) => tick + 1);
  }

  // The check-in never opens a second writing surface: it hands the caregiver
  // the same interview box, tagged so the note files as a check-in.
  function openCheckinNote(): void {
    setCheckinStarted(true);
    openComposer("checkin");
  }

  function answerCheckinProbe(answer: "no" | "yes" | "unsure"): void {
    setCheckinStarted(true);
    const at = new Date().toISOString();
    // Every answer is kept, including "not sure" — the one tap in the check-in
    // that used to leave no trace at all (F8.3).
    dispatch({ type: "recordFamilyCheckinProbe", answer, at });
    if (answer === "yes") {
      dispatch({ type: "raiseFamilyRegressionFlag", source: "probe", at });
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

  // The demo's way onto a waitlist, and with it the Visit surface — which does
  // not exist for a family with no referral. Stay on Home so the one-time
  // notice can explain the new tab; its "See it" action performs the switch.
  function seedReferral(): void {
    const now = new Date();
    dispatch({
      type: "setFamilyReferral",
      referral: { clinic: FAMILY_APPOINTMENT_CLINIC, referredAt: now.toISOString() }
    });
    dispatch({ type: "offerFamilyAppointment", appointment: createFamilyAppointmentOffer(now) });
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

  // The child's own name wherever the copy addresses them, with the language's
  // stand-in when the caregiver has not given one.
  const childName =
    family?.profile?.childFirstName?.trim() || tFamily(language, "heardStripChildFallback");
  const firstStepsClockLine =
    clock === null ? undefined : familyClockLine(clock, language, childName);

  // The repair for a year-only clock: one month, saved as stated, and every
  // clock on the page reads a real date from the next render on.
  function addBirthMonth(birthMonth: number): void {
    if (!family?.profile) return;
    saveProfile({ ...family.profile, birthMonth }, "stated");
  }
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
            {/* F3b. What Ladder does not do, next to what it does with your
                words — the two questions a caregiver is weighing at the same
                moment. True in both postures: the simulation changes what is on
                screen, never what the app can actually reach. */}
            <p data-testid="family-service-status" className="break-words text-sm leading-6 text-ink/70">
              {tFamily(language, "serviceStatusLine")}
            </p>
            {/* F8.4. Both composers catch the API error and fall through to the
                on-device reader with no notice at all, so a caregiver could not
                tell a model's reading from a regex's. Quiet, non-blocking, and
                true in the zero-key demo as well as after a failure. */}
            {latestInterview?.extraction === "mock" ? (
              <p
                data-testid="family-extraction-on-device"
                className="break-words text-sm leading-6 text-ink/70"
              >
                {tFamily(language, "extractionOnDevice")}
              </p>
            ) : null}
            {/* F1d. Generated from the record, not asserted: `aiUseMode` counts
                the interviews whose extraction actually completed live. The old
                Privacy line derived "AI data use: not active" from the live-voice
                transport probe, which knew nothing about this surface at all. */}
            <p
              data-testid="family-ai-use"
              data-ai-use-mode={aiUseMode}
              className="break-words text-sm leading-6 text-ink/70"
            >
              <span className="font-semibold">{tFamily(language, AI_USE_TITLE_KEYS[aiUseMode])}</span>{" "}
              {tFamily(language, AI_USE_BODY_KEYS[aiUseMode])}
            </p>
          </div>
        </details>
      </section>
    ) : null;

  // F2b. The banner leads until the caregiver acknowledges it, then stands down:
  // the event stays in the record for the audit trail, the crisis routes stay on
  // the page, and only the presentation de-escalates. It was reading the *latest*
  // event with no acknowledged filter, so one disclosure pinned the 988/911
  // banner above every surface on every future visit. A new disclosure produces a
  // new pending event and raises it again.
  const safetyTurn = pendingSafetyEvent ? (
    <FamilyCrisisBanner
      key={pendingSafetyEvent.id}
      event={pendingSafetyEvent}
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
      // Resolved from the family's own record — never the demo clinic (F2a).
      target={resolveFamilyClinicNowTarget(family, followupNow)}
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

  // The safety banner and the clinic-now card have left the thread: they are
  // layer 0 now, above the header of whatever surface is open, so switching tabs
  // cannot put them below anything (1i).
  // F1b. Offered only once a turn has been answered, and never over a crisis
  // banner: a caregiver reading 988 numbers is not being asked to make a data
  // choice. Declining is remembered for the session, so this asks at most once.
  const aiConsentTurn =
    offerAiChoice && reviewTurn !== null && pendingSafetyEvent === undefined ? (
      <FamilyAiConsentCard
        language={language}
        onAccept={() => setAiConsent("granted")}
        onDecline={() => setAiConsent("declined")}
      />
    ) : null;

  const aiDeclinedNotice =
    aiConsent === "declined" && reviewTurn !== null ? (
      <p
        data-testid="family-ai-declined"
        className="break-words text-sm leading-6 text-ink/70"
      >
        {tFamily(language, "aiConsentDeclinedNotice")}
      </p>
    ) : null;

  const interlude =
    reviewTurn ||
    needsBasics ||
    threadResources.length > 0 ||
    showFallbackInThread ||
    aiConsentTurn ? (
      <>
        {reviewTurn}
        {aiConsentTurn}
        {aiDeclinedNotice}
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
            {/* F6a. These are the first cards a Spanish reader meets, and until
                now the only surface that said "this is in English" was the
                Programs library, two taps away. */}
            <FamilySourceLanguageNotice language={language} testId="thread-source-language-notice" />
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

  /**
   * Did the caregiver arrive with history? Storage hydrates after the first
   * client render, so this follows the current family record instead of
   * latching the empty demo state that rendered before hydration. The session
   * ref keeps the first answer from turning its own first-run thread into a
   * return visit halfway through.
   */
  const returning = !wroteThisSessionRef.current && (family?.interviews.length ?? 0) > 0;
  // On a return visit the composer is one tap away rather than open — but it is
  // the same box, and nothing else on any surface can write.
  const composerCollapsed = returning && family?.profile != null && !composerOpen;

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

  // The Programs surface *is* the disclosure now, so the library inside it does
  // not fold as well. The summary line still names what it holds.
  const librarySize = matchResult.isFallback ? matchResult.resources.length : displayResources.length;
  const librarySummaryLine = [
    tFamily(language, librarySize === 1 ? "foldResourcesSummaryOne" : "foldResourcesSummary", {
      count: librarySize
    }),
    ...(guides.length > 0 ? [tFamily(language, "guidesTitle")] : [])
  ].join(" · ");

  // Which surfaces exist for this family. Programs needs matched needs; Visit
  // exists only once a referral fits this child, so a family with no waitlist
  // never gets an appointment companion (1h).
  const hasPrograms = !!family?.profile && family.activeDomains.length > 0;
  const hasNotes = !!family && (family.profile !== null || family.facts.length > 0);
  const hasVisit = !!family?.profile && family.referral !== null;
  const surfaces: LadderSurface[] = [
    "home",
    ...(hasPrograms ? (["programs"] as const) : []),
    ...(hasNotes ? (["notes"] as const) : []),
    ...(hasVisit ? (["visit"] as const) : [])
  ];
  // The first session stays a single thread until there is an answer: Programs
  // only exists once a need has been matched, Notes once something is written.
  // The bar appears with the second surface, so no panel is ever unreachable.
  const showTabs = surfaces.length > 1;
  // A tab that stopped existing must not leave the caregiver on a blank panel.
  const activeSurface = surfaces.includes(surface) ? surface : "home";

  const homePanel = (
    <>
      {family?.profile ? (
        // Same instant and same check-in visibility the sections below are
        // built from, so the rung can never name a section this render omits.
        <FamilyWaitHeader
          family={family}
          language={language}
          now={followupNow}
          checkinOpen={checkinVisible}
          threadActive={threadActive}
          returning={returning}
          programsCount={hasPrograms ? librarySize : undefined}
        />
      ) : null}

      {visitNoticeOpen && family?.referral ? (
        <section
          data-testid="family-visit-tab-notice"
          role="status"
          className="rounded-control border border-care/30 bg-calm/60 p-4"
        >
          <h2 className="text-lg font-semibold text-care">
            {tFamily(language, "visitTabNoticeTitle")}
          </h2>
          <p className="mt-1 break-words leading-relaxed text-ink/85">
            {tFamily(language, "visitTabNoticeBody", {
              name: childName,
              clinic: family.referral.clinic
            })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                dismissVisitNotice();
                setSurface("visit");
              }}
              className={BTN_PRIMARY}
            >
              {tFamily(language, "visitTabNoticeOpen")}
            </button>
            <button type="button" onClick={dismissVisitNotice} className={BTN_SECONDARY}>
              {tFamily(language, "visitTabNoticeDismiss")}
            </button>
          </div>
        </section>
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

      {/* The only thing in Ladder that ever brings a family back. Placed on the
          front door because it is about the visit after this one. */}
      {family?.profile ? (
        <FamilyCheckinReminder family={family} language={language} now={followupNow} />
      ) : null}

      {simEnabled && family?.profile && !checkinVisible ? (
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

      {/* P5, on the front door: the deadline in the shape the profile can
          actually support, with the one tap that turns a window into a date. */}
      {returning && clock && family?.profile ? (
        <FamilyClockNotice
          clock={clock}
          language={language}
          childName={childName}
          withHeadline
          onAddBirthMonth={addBirthMonth}
        />
      ) : null}

      {/* F7c: and when the countdown ends, the page says where the route goes
          instead of going quiet. */}
      {clock === null && clockWindowClosed ? (
        <FamilyClockHandoff language={language} childName={childName} />
      ) : null}

      <section className={CARD_SECTION} aria-labelledby="family-interview-title">
        {composerCollapsed ? (
          <>
            {/* P3: the composer never vanishes on a return visit — it collapses
                to one tap, and the target of that tap is the same box. */}
            <h2 id="family-interview-title" tabIndex={-1} className="sr-only scroll-mt-4">
              {tFamily(language, "interviewTitle")}
            </h2>
            <button
              type="button"
              data-testid="family-composer-open"
              onClick={() => openComposer("note")}
              className={`flex w-full min-h-[52px] items-center justify-center gap-2 break-words rounded-control bg-care px-4 py-2 text-base font-bold text-white ${CONTROL_FOCUS}`}
            >
              <Mic aria-hidden="true" className="h-5 w-5 shrink-0" />
              {tFamily(language, "homeComposerCtaNamed", { name: childName })}
            </button>
            <p className="mt-2 break-words text-sm leading-6 text-ink/70">
              {tFamily(language, "homeTrustLine")} {tFamily(language, "serviceStatusLine")}
            </p>
          </>
        ) : (
          <>
        <h2 id="family-interview-title" tabIndex={-1} className="text-xl font-semibold scroll-mt-4">
          {tFamily(language, "interviewTitle")}
        </h2>
        {/* The draft-translation caveat that used to sit here now lives in the
            shell header, next to the language control and on every surface —
            here it was invisible to a returning reader whose composer is
            collapsed, and saying it twice on one screen is noise (F6d). */}
        <p className="mt-2 leading-relaxed text-ink/90">{tFamily(language, "interviewIntro")}</p>
        {/* F3b. On the front door, before the caregiver types anything: what
            Ladder is not. The simulation can make this app look operational —
            a waitlist, a date picker — and this is the sentence that has to be
            true in both postures. */}
        <p
          data-testid="family-service-status-door"
          className="mt-2 break-words text-sm leading-6 text-ink/70"
        >
          {tFamily(language, "serviceStatusLine")}
        </p>
        <div className="mt-4">
          <FamilyOrientationInterview
            key="family-orientation"
            profile={family?.profile ?? EMPTY_FAMILY_INTERVIEW_PROFILE}
            draft={family?.interviewDraft ?? ""}
            passcode={passcode}
            liveAllowed={liveAllowed}
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
          </>
        )}
      </section>

      {followupAnswered ? (
        <section id="family-followup" data-testid="family-followup" className={CARD_SECTION}>
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

      {/* Utility furniture, quiet and last: the details that fine-tune what the
          other surfaces show. */}
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

      {/* The demo's way onto a waitlist. It lives here rather than on the Visit
          surface because that surface does not exist until a referral does. */}
      {simEnabled && family?.profile && family.referral === null ? (
        <section data-testid="family-referral-demo" className={DEMO_BLOCK}>
          <p className="break-words text-sm leading-6 text-ink/75">
            {tFamily(language, "apptJoinDemoBody")}
          </p>
          <button
            type="button"
            disabled={pendingSafetyEvent !== undefined}
            onClick={seedReferral}
            className={`mt-3 ${BTN_PRIMARY}`}
          >
            {tFamily(language, "apptJoinDemoCta")}
          </button>
        </section>
      ) : null}

      {/* The plan for the wait. It belongs to Home rather than to the Visit
          companion because a family with no referral has no Visit surface —
          and still has a wait, and still deserves the plan. */}
      {family?.profile ? (
        <FamilyStageTimeline
          family={family}
          language={language}
          nudgeFirstName={state.patient.preferredName}
          onBackdateDiagnoses={backdateFamilyDiagnoses}
        />
      ) : null}
    </>
  );

  const visitPanel = (
    <>
      {family?.profile && family.referral !== null ? (
        <FamilyAppointmentCard
          family={family}
          language={language}
          locked={pendingSafetyEvent !== undefined}
          onSeedReferral={seedReferral}
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
    </>
  );

  const programsPanel = (
    <>
      {family && family.profile && family.activeDomains.length > 0 ? (
            <FamilyFoldSection
              id="family-resources"
              testId="family-resources"
              title={tFamily(language, "resourcesTitle")}
              titleId="family-resources-title"
              summaryLine={librarySummaryLine}
              // The tab is the disclosure now; the library inside it is the
              // surface, not a fold under a thread.
              defaultOpen
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
              <div className="mt-2">
                <FamilySourceLanguageNotice
                  language={language}
                  testId="library-source-language-notice"
                />
              </div>
              {matchResult.isFallback ? (
                <section
                  aria-label={tFamily(language, "emptyFallbackTitle")}
                  className="mt-4 rounded-control border border-note bg-note/20 p-3"
                >
                  <h3 className="font-semibold">{tFamily(language, "emptyFallbackTitle")}</h3>
                  <p className="mt-1 leading-relaxed">{tFamily(language, "emptyFallbackBody")}</p>
                  <p className="mt-1 leading-relaxed">{tFamily(language, "emptyNavigatorHonesty")}</p>
                  <div className="mt-3">
                    <FamilySourceLanguageNotice
                      language={language}
                      testId="fallback-source-language-notice"
                    />
                  </div>
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
                <>
                  {/* F8.6. The section shows eight; the retrieval often found
                      more, and the list gave no sign of it. */}
                  {matchResult.resources.length > displayResources.length ? (
                    <p
                      data-testid="family-resources-cap"
                      className="mt-3 break-words text-sm text-ink/70"
                    >
                      {tFamily(language, "programsCapped", {
                        shown: displayResources.length,
                        count: matchResult.resources.length
                      })}
                    </p>
                  ) : null}
                  <div data-testid="matched-family-resources" className="mt-4 grid gap-3">
                    {displayResources.map((item) => resourceCard(item, "matched"))}
                  </div>
                </>
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
                  <div className="mt-2">
                    <FamilySourceLanguageNotice
                      language={language}
                      testId="guides-source-language-notice"
                    />
                  </div>
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
                  /* F8.1: the anchor map sends #family-experience to Home, so
                     this link silently switched tabs. It points at the top of
                     the surface it is on. */
                  href="#family-resources-title"
                  className={`inline-flex min-h-12 min-w-0 items-center text-sm font-semibold text-ink/70 underline underline-offset-4 ${CONTROL_FOCUS}`}
                >
                  {tFamily(language, "backToTop")}
                </a>
              </p>
            </FamilyFoldSection>
          ) : null}

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
    </>
  );

  const notesPanel = (
    <>
      {/* F8.7. Notes unlocks on a profile while the journal needs facts, so a
          profile-only family met a near-empty tab with a live Print button and
          no explanation. The exits stay — an empty packet still carries the
          child's basics — but the emptiness is named. */}
      {family?.profile && family.facts.length === 0 ? (
        <section data-testid="family-notes-empty" className={CARD_SECTION_PAPER}>
          <h2 className="break-words text-lg font-semibold">
            {tFamily(language, "notesEmptyTitle")}
          </h2>
          <p className="mt-1 break-words leading-relaxed text-ink/80">
            {tFamily(language, "notesEmptyBody", { name: childName })}
          </p>
          <button
            type="button"
            data-testid="family-notes-add"
            onClick={() => openComposer("note")}
            className={`mt-4 inline-flex items-center gap-2 ${BTN_PRIMARY}`}
          >
            <Mic aria-hidden="true" className="h-5 w-5 shrink-0" />
            {tFamily(language, "notesEmptyCta")}
          </button>
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
          onReject={(factId) => dispatch({ type: "rejectFamilyFact", factId })}
        />
      ) : null}

      {/* Same composer, reached from the surface that keeps its output. */}
      {family?.profile && family.facts.length > 0 ? (
        <p>
          <button
            type="button"
            data-testid="family-notes-add"
            onClick={() => openComposer("note")}
            className={BTN_SECONDARY}
          >
            {tFamily(language, "homeComposerCtaNamed", { name: childName })}
          </button>
        </p>
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
    </>
  );

  return (
    <LadderShell
      language={language}
      onLanguageChange={(next) => dispatch({ type: "setLanguage", language: next })}
      subtitle={
        family?.profile
          ? [childName, family.profile.county ? `${family.profile.county} County` : null]
              .filter((part): part is string => part !== null)
              .join(" · ")
          : tFamily(language, "shellHeaderSubtitle")
      }
      // Layer 0. Safety words lead whatever surface is open; the clinic-now card
      // sits directly under them and, like them, is never behind a tab.
      crisis={
        safetyTurn || clinicNowTurn ? (
          <div className="mx-auto grid w-full max-w-2xl gap-3">
            {safetyTurn}
            {clinicNowTurn}
          </div>
        ) : null
      }
      // F2c. Present once this family has ever disclosed — including on later
      // visits, since the events persist. Acknowledging the banner stands the
      // presentation down; it no longer takes the phone numbers with it.
      urgentHelp={
        safetyEvents.length > 0 ? <FamilyUrgentHelpControl language={language} /> : undefined
      }
      surfaces={surfaces}
      surface={activeSurface}
      onSurfaceChange={setSurface}
      showTabs={showTabs}
    >
      <div
        id="family-experience"
        lang={language}
        data-testid="family-experience"
        className="grid w-full min-w-0 gap-4 scroll-mt-4"
      >
        {/* One glossary registry per surface — each screen is read on its own —
            and one provider per panel, so switching tabs never remounts a panel
            and loses what the caregiver had open in it.

            A panel exists only for a surface that has a tab: a `tabpanel` whose
            `aria-labelledby` points at an id no tab has rendered is a broken
            reference, and on first run three of the four were exactly that.
            Unlocked panels still stay mounted across tab switches, so drafts,
            open cards, and scroll position survive. */}
        <LadderPanel surface="home" active={activeSurface === "home"}>
          <FamilyGlossSurface>{homePanel}</FamilyGlossSurface>
        </LadderPanel>
        {hasPrograms ? (
          <LadderPanel surface="programs" active={activeSurface === "programs"}>
            <FamilyGlossSurface>{programsPanel}</FamilyGlossSurface>
          </LadderPanel>
        ) : null}
        {hasNotes ? (
          <LadderPanel surface="notes" active={activeSurface === "notes"}>
            <FamilyGlossSurface>{notesPanel}</FamilyGlossSurface>
          </LadderPanel>
        ) : null}
        {hasVisit ? (
          <LadderPanel surface="visit" active={activeSurface === "visit"}>
            <FamilyGlossSurface>{visitPanel}</FamilyGlossSurface>
          </LadderPanel>
        ) : null}
      </div>
    </LadderShell>
  );
}
