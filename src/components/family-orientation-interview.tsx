"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { requestFamilyInterview } from "@/ai/family-interview-provider";
import { extractFamilyInterviewMock, type FamilyFollowUp, type FamilyInterviewResult } from "@/domain/family-interview";
import { screenFamilySafety, type FamilySafetyScreen } from "@/domain/family-safety";
import type { FamilyProfile } from "@/domain/types";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";
import type { VoiceEntryContext } from "@/voice/voice-consent";
import { CONTROL_FOCUS } from "@/components/family-theme";
import {
  FamilyFollowUpTurn,
  FAMILY_FOLLOW_UP_ANSWER_MAX
} from "./family-follow-up-turn";
import {
  FAMILY_INTERVIEW_MAX_CHARS,
  FamilyInterview,
  sanitizeResult,
  type FamilyInterviewSubmissionMeta,
  type SanitizedFamilyInterviewResult
} from "./family-interview";

export { FAMILY_FOLLOW_UP_ANSWER_MAX };
export const FAMILY_ORIENTATION_MAX_ROUNDS = 2;

// Lets the interview run before any basics are saved; birthYear 0 marks the basics as unknown.
export const EMPTY_FAMILY_INTERVIEW_PROFILE: FamilyProfile = {
  birthYear: 0,
  schoolStage: "not_school_age",
  county: "",
  diagnoses: []
};

function isEmptyProfile(profile: FamilyProfile): boolean {
  return profile.county === "" && profile.birthYear === 0;
}

type OrientationRound = {
  question: FamilyFollowUp;
  answer?: string;
  source?: "typed" | "voice";
};

type OrientationState = {
  openingText: string;
  openingSource: "typed" | "voice" | "mixed";
  rounds: OrientationRound[];
  pendingFollowUps: FamilyFollowUp[];
  /**
   * Monotonic for this thread. A later denial or correction can make the safety
   * classifier return `null` for a cumulative transcript even though that same
   * transcript still contains an earlier disclosure. Once true, no version of
   * this conversation may be sent or filed.
   */
  containsSafetyDisclosure: boolean;
  status: "idle" | "active" | "submitting" | "complete";
};

export type FamilyOrientationInterviewProps = {
  profile: FamilyProfile;
  draft: string;
  /** F1a. See FamilyInterviewProps.liveAllowed — same gate, same safe default. */
  liveAllowed?: boolean;
  /** Signed memory-only server capability. `liveAllowed` alone is a legacy test seam. */
  consentCapability?: string;
  /** Fired immediately before the browser starts a request, whatever the reply. */
  onLiveSend?: () => void;
  language: Language;
  voiceEntryContext?: VoiceEntryContext;
  /** Rendered between the transcript and the current follow-up turn — the tool's own replies. */
  interlude?: React.ReactNode;
  /** Hide the next follow-up question while something else (like the basics turns) is being asked. */
  holdTurn?: boolean;
  /**
   * "That is enough to get you started" is worth saying when the thread is all
   * the caregiver got. With resource cards already on screen it is just noise,
   * so the caller turns it off.
   */
  showComplete?: boolean;
  /** Dictation stays closed while an unacknowledged safety banner is on screen. */
  voiceLocked?: boolean;
  /**
   * Placeholder for the free-text box once the orientation conversation is done
   * and every further submission is a journal note. Absent on the first visit.
   */
  completePlaceholder?: string;
  onDraftChange: (draft: string) => void;
  /**
   * `meta.rawText` is the whole conversation so far, re-extracted every round.
   * `newText` is only what the caregiver just wrote, for anything that must fire
   * once per sentence rather than once per round.
   */
  onInterviewExtracted: (
    result: SanitizedFamilyInterviewResult,
    meta: FamilyInterviewSubmissionMeta,
    context: { round: number; newText: string }
  ) => void;
  onSafetyEscalation: (screen: FamilySafetyScreen) => void;
  /**
   * Fires once the caregiver has started a conversation here, so the page can
   * keep its one-ask rule: nothing else may ask while this thread owns the ask.
   * Reported for the whole conversation rather than per question — a signal that
   * blinked off between rounds would let a second question in for a frame.
   */
  onThreadActiveChange?: (active: boolean) => void;
};

const FOLLOW_UP_TRANSCRIPT_RESERVE = 200 + FAMILY_FOLLOW_UP_ANSWER_MAX + 8;

function initialOrientationState(): OrientationState {
  return {
    openingText: "",
    openingSource: "typed",
    rounds: [],
    pendingFollowUps: [],
    containsSafetyDisclosure: false,
    status: "idle"
  };
}

function orientationContextKey(profile: FamilyProfile, language: Language): string {
  return JSON.stringify({ profile, language });
}

function uniqueUnaskedFollowUps(followUps: readonly FamilyFollowUp[], askedQuestions: readonly string[]): FamilyFollowUp[] {
  const seen = new Set(askedQuestions);
  return followUps.filter(({ question }) => {
    if (seen.has(question)) return false;
    seen.add(question);
    return true;
  });
}

function fullTranscript(openingText: string, rounds: readonly OrientationRound[]): string {
  return rounds.reduce(
    (transcript, { question, answer }) =>
      answer === undefined ? transcript : `${transcript}\nQ: ${question.question}\nA: ${answer}`,
    openingText
  );
}

function familyOnlyTranscript(openingText: string, rounds: readonly OrientationRound[]): string {
  const answers = rounds.flatMap(({ answer }) => (answer === undefined ? [] : [answer]));
  return [openingText, ...answers].join("\n");
}

function hasFollowUpHeadroom(transcript: string): boolean {
  return FAMILY_INTERVIEW_MAX_CHARS - transcript.length - FOLLOW_UP_TRANSCRIPT_RESERVE >= 0;
}

function combinedSource(sources: readonly ("typed" | "voice" | "mixed" | undefined)[]): "typed" | "voice" | "mixed" {
  const present = sources.filter((source): source is "typed" | "voice" | "mixed" => source !== undefined);
  if (present.includes("mixed") || (present.includes("typed") && present.includes("voice"))) return "mixed";
  return present.includes("voice") ? "voice" : "typed";
}

export function FamilyOrientationInterview({
  profile,
  draft,
  liveAllowed = false,
  consentCapability,
  onLiveSend,
  language,
  voiceEntryContext,
  interlude,
  holdTurn = false,
  showComplete = true,
  voiceLocked = false,
  completePlaceholder,
  onDraftChange,
  onInterviewExtracted,
  onSafetyEscalation,
  onThreadActiveChange
}: FamilyOrientationInterviewProps) {
  const sendCapability = consentCapability ?? (liveAllowed ? "legacy-test-capability" : undefined);
  const [thread, setThread] = useState<OrientationState>(initialOrientationState);
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);
  const activeLiveRequestRef = useRef<AbortController | null>(null);
  const threadGenerationRef = useRef(0);
  const contextKey = orientationContextKey(profile, language);
  const previousContextRef = useRef({ contextKey, profileWasEmpty: isEmptyProfile(profile), language });
  const latestContextKeyRef = useRef(contextKey);
  latestContextKeyRef.current = contextKey;

  const abortLiveRequest = useCallback((): void => {
    activeLiveRequestRef.current?.abort();
    activeLiveRequestRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortLiveRequest();
    };
  }, [abortLiveRequest]);

  useEffect(() => {
    if (!liveAllowed) abortLiveRequest();
  }, [abortLiveRequest, liveAllowed]);

  useEffect(() => {
    const stopOnPageHide = (): void => abortLiveRequest();
    window.addEventListener("pagehide", stopOnPageHide);
    return () => window.removeEventListener("pagehide", stopOnPageHide);
  }, [abortLiveRequest]);

  // Monotonic within a visit: idle -> active -> complete, never back. A per-question
  // signal would drop to false between rounds and let another surface ask.
  const threadActive = thread.status !== "idle";
  useEffect(() => {
    onThreadActiveChange?.(threadActive);
  }, [onThreadActiveChange, threadActive]);

  // Only a language switch is a different conversation. Editing the child's
  // details mid-thread — from the basics turns, the setup panel, or the strip's
  // own editor — must never throw the thread away: doing so would drop a pending
  // follow-up and, if a safety banner were up, move it out from the top of the
  // page and under the composer.
  useEffect(() => {
    const previous = previousContextRef.current;
    if (previous.contextKey === contextKey) return;
    const languageChanged = previous.language !== language;
    previousContextRef.current = { contextKey, profileWasEmpty: isEmptyProfile(profile), language };
    threadGenerationRef.current += 1;
    abortLiveRequest();
    submittingRef.current = false;
    if (languageChanged) {
      setThread(initialOrientationState());
      return;
    }
    // The answer is already visible by the time its extraction starts. A
    // profile correction invalidates that old-profile extraction, but it must
    // not erase the caregiver's answered transcript. End this short thread in
    // a stable state; they can start another pass with the corrected details.
    setThread((current) =>
      current.status === "submitting"
        ? { ...current, pendingFollowUps: [], status: "complete" }
        : current
    );
  }, [abortLiveRequest, contextKey, language, profile]);

  function resetThread(): void {
    threadGenerationRef.current += 1;
    abortLiveRequest();
    submittingRef.current = false;
    setThread(initialOrientationState());
  }

  function receiveOpening(result: SanitizedFamilyInterviewResult, meta: FamilyInterviewSubmissionMeta): void {
    onInterviewExtracted(result, meta, { round: 0, newText: meta.rawText });
    const candidates = uniqueUnaskedFollowUps(result.followUps, []);
    const canAsk = candidates.length > 0 && hasFollowUpHeadroom(meta.rawText);
    setThread({
      openingText: meta.rawText,
      openingSource: meta.source,
      rounds: canAsk ? [{ question: candidates[0] }] : [],
      pendingFollowUps: canAsk ? candidates.slice(1) : [],
      containsSafetyDisclosure: meta.containsSafetyDisclosure,
      status: canAsk ? "active" : "complete"
    });
  }

  async function answerFollowUp(text: string, via: "chip" | "typed" | "voice"): Promise<void> {
    if (submittingRef.current || thread.status !== "active") return;
    const currentRound = thread.rounds[thread.rounds.length - 1];
    if (!currentRound || currentRound.answer !== undefined) return;
    const answer = text.trim();
    if (!answer) return;

    submittingRef.current = true;
    // A safety disclosure raises the banner and stays on-device: this answer is
    // extracted locally and the thread continues rather than dead-ending.
    const safety = screenFamilySafety(answer);
    if (safety) {
      onSafetyEscalation(safety);
    }

    const answeredRounds = [
      ...thread.rounds.slice(0, -1),
      { ...currentRound, answer, source: via === "voice" ? "voice" as const : "typed" as const }
    ];
    const liveTranscript = fullTranscript(thread.openingText, answeredRounds);
    const caregiverTranscript = familyOnlyTranscript(thread.openingText, answeredRounds);
    if (liveTranscript.length > FAMILY_INTERVIEW_MAX_CHARS) {
      submittingRef.current = false;
      setThread({ ...thread, rounds: answeredRounds, pendingFollowUps: [], status: "complete" });
      return;
    }

    const snapshot = {
      profile: {
        ...profile,
        diagnoses: profile.diagnoses.map((diagnosis) => ({ ...diagnosis }))
      },
      language,
      contextKey: latestContextKeyRef.current,
      generation: threadGenerationRef.current
    } as const;
    setThread({ ...thread, rounds: answeredRounds, status: "submitting" });

    // Screened over the whole conversation, not just this answer, and latched
    // across rounds. The classifier deliberately understands negation, so it is
    // not monotonic: a later correction can make a cumulative transcript return
    // to `null` while the original crisis sentence is still literally inside the
    // payload. Reclassification alone therefore re-opened both the send and the
    // record. Once this thread has disclosed, it stays local and unfiled.
    const transcriptDiscloses =
      thread.containsSafetyDisclosure ||
      safety !== null ||
      screenFamilySafety(caregiverTranscript) !== null;

    try {
      let live: FamilyInterviewResult | null = null;
      // F1a. This composer re-sends the whole conversation every round, so an
      // ungated round here leaks every earlier turn as well — the gate matters
      // more on this path, not less.
      if (!transcriptDiscloses && liveAllowed && sendCapability) {
        onLiveSend?.();
        const controller = new AbortController();
        activeLiveRequestRef.current?.abort();
        activeLiveRequestRef.current = controller;
        try {
          live = await requestFamilyInterview(
            {
              text: liveTranscript,
              profile: snapshot.profile,
              language: snapshot.language
            },
            { signal: controller.signal, consentCapability: sendCapability }
          );
        } catch {
          live = null;
        } finally {
          if (activeLiveRequestRef.current === controller) {
            activeLiveRequestRef.current = null;
          }
        }
      }
      if (
        !mountedRef.current ||
        latestContextKeyRef.current !== snapshot.contextKey ||
        threadGenerationRef.current !== snapshot.generation
      ) return;

      const extraction = live ? "live" : "mock";
      const now = new Date();
      const extracted =
        live ??
        extractFamilyInterviewMock(
          caregiverTranscript,
          snapshot.profile,
          now,
          snapshot.language
        );
      const sanitized = sanitizeResult(
        extracted,
        snapshot.profile,
        caregiverTranscript,
        snapshot.language,
        now
      );
      const round = answeredRounds.length;
      onInterviewExtracted(
        sanitized,
        {
          extraction,
          source: combinedSource([thread.openingSource, ...answeredRounds.map(({ source }) => source)]),
          rawText: caregiverTranscript,
          containsSafetyDisclosure: transcriptDiscloses
        },
        { round, newText: answer }
      );

      const candidates = uniqueUnaskedFollowUps(
        sanitized.followUps,
        answeredRounds.map(({ question }) => question.question)
      );
      const canContinue =
        round < FAMILY_ORIENTATION_MAX_ROUNDS &&
        candidates.length > 0 &&
        hasFollowUpHeadroom(liveTranscript);
      setThread({
        openingText: thread.openingText,
        openingSource: thread.openingSource,
        rounds: canContinue ? [...answeredRounds, { question: candidates[0] }] : answeredRounds,
        pendingFollowUps: canContinue ? candidates.slice(1) : [],
        containsSafetyDisclosure: transcriptDiscloses,
        status: canContinue ? "active" : "complete"
      });
    } finally {
      submittingRef.current = false;
    }
  }

  if (thread.status === "idle") {
    return (
      <div className="space-y-4">
        <FamilyInterview
          profile={profile}
          draft={draft}
          liveAllowed={liveAllowed}
          consentCapability={sendCapability}
          onLiveSend={onLiveSend}
          language={language}
          voiceEntryContext={voiceEntryContext}
          voiceLocked={voiceLocked}
          placeholder={completePlaceholder}
          onDraftChange={onDraftChange}
          onExtracted={receiveOpening}
          onSafetyEscalation={onSafetyEscalation}
        />
        {interlude}
      </div>
    );
  }

  const currentRound = thread.status === "active" ? thread.rounds[thread.rounds.length - 1] : undefined;

  return (
    <div className="space-y-4">
      {/* The opening description is not echoed back: the strip is the
          acknowledgement, and the raw text is kept, dated, in the journal. */}
      <div className="space-y-3" role="log" aria-relevant="additions text" aria-atomic="false">
        {thread.rounds.map(({ question, answer }, index) =>
          answer === undefined ? null : (
            <React.Fragment key={`${index}-${question.question}`}>
              <div className="mr-auto max-w-[90%] rounded-control border border-ink/10 bg-white p-3">
                <p className="break-words font-semibold leading-relaxed">{question.question}</p>
              </div>
              <div className="ml-auto max-w-[90%] rounded-control bg-calm/60 p-3">
                <p className="break-words whitespace-pre-wrap leading-relaxed">{answer}</p>
              </div>
            </React.Fragment>
          )
        )}
      </div>

      {interlude}

      {!holdTurn && currentRound ? (
        <FamilyFollowUpTurn
          key={currentRound.question.question}
          question={currentRound.question}
          round={thread.rounds.length}
          roundCap={FAMILY_ORIENTATION_MAX_ROUNDS}
          language={language}
          submitting={false}
          voiceEntryContext={voiceEntryContext}
          voiceLocked={voiceLocked}
          onAnswer={(answer, via) => void answerFollowUp(answer, via)}
        />
      ) : null}

      {thread.status === "submitting" ? (
        <p role="status" aria-live="polite" className="text-sm font-semibold text-care">
          {tFamily(language, "interviewWorking")}
        </p>
      ) : null}

      {showComplete && !holdTurn && thread.status === "complete" ? (
        <div role="status" tabIndex={-1} className="rounded-control bg-calm/60 p-4 font-semibold text-ink/80">
          <p className="min-w-0">{tFamily(language, "orientationComplete")}</p>
        </div>
      ) : null}

      <button
        type="button"
        disabled={thread.status === "submitting"}
        onClick={resetThread}
        className={`min-h-12 min-w-0 break-words rounded-control px-2 py-2 text-sm font-semibold text-ink/70 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50 ${CONTROL_FOCUS}`}
      >
        {tFamily(language, "orientationStartOver")}
      </button>
    </div>
  );
}
