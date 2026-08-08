"use client";

import { Mic } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { requestFamilyInterview } from "@/ai/family-interview-provider";
import {
  extractFamilyInterviewMock,
  familyInterviewInputSchema,
  reconcileFamilyInterviewResult,
  type FamilyInterviewResult
} from "@/domain/family-interview";
import { filterUnsupportedDiagnosisFacts, stripUnsafeFamilyRationales } from "@/domain/family-diagnosis-lint";
import { sanitizeFamilyFollowUps } from "@/domain/family-follow-up-lint";
import { screenFamilySafety, type FamilySafetyScreen } from "@/domain/family-safety";
import type { FamilyProfile } from "@/domain/types";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

export const FAMILY_INTERVIEW_MAX_CHARS = 5000;
// Leave 50 characters of deterministic headroom so a final speech result can be
// accepted whole; speech is disabled at this point and is never silently cut off.
export const FAMILY_INTERVIEW_MIC_DISABLE_AT = 4950;

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: {
    results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
    resultIndex?: number;
  }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type RecordingStatus = "idle" | "listening" | "reconnecting" | "finished" | "stopped";

export type SanitizedFamilyInterviewResult = Omit<FamilyInterviewResult, "domains"> & {
  domains: Array<{ domain: FamilyInterviewResult["domains"][number]["domain"]; rationale?: string }>;
};

export type FamilyInterviewSubmissionMeta = {
  extraction: "live" | "mock";
  source: "typed" | "voice" | "mixed";
  rawText: string;
};

export type FamilyInterviewProps = {
  profile: FamilyProfile;
  draft: string;
  passcode?: string;
  /**
   * F1a. Whether this turn may use the network at all. Defaults to false so a
   * caller that forgets to thread it keeps the words on the device rather than
   * silently sending them — the safe direction for a missing prop.
   */
  liveAllowed?: boolean;
  language: Language;
  /** Overrides the opening prompt once the box is collecting journal notes. */
  placeholder?: string;
  onDraftChange: (draft: string) => void;
  onExtracted: (result: SanitizedFamilyInterviewResult, meta: FamilyInterviewSubmissionMeta) => void;
  onSafetyEscalation?: (screen: FamilySafetyScreen) => void;
};

function speechRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function sanitizeResult(
  result: FamilyInterviewResult,
  profile: FamilyProfile,
  rawText: string,
  language: Language,
  now = new Date()
): SanitizedFamilyInterviewResult {
  const reconciled = reconcileFamilyInterviewResult(result, {
    profile,
    rawText,
    language,
    now
  });

  return {
    ...reconciled,
    facts: filterUnsupportedDiagnosisFacts(
      reconciled.facts,
      rawText,
      profile
    ),
    domains: stripUnsafeFamilyRationales(
      reconciled.domains,
      profile.childFirstName
    ),
    followUps: sanitizeFamilyFollowUps(
      reconciled.followUps,
      profile.childFirstName
    )
  };
}

function familyContextKey(profile: FamilyProfile, draft: string, language: Language): string {
  return JSON.stringify({ profile, draft, language });
}

export function FamilyInterview({
  profile,
  draft,
  passcode,
  liveAllowed = false,
  language,
  placeholder,
  onDraftChange,
  onExtracted,
  onSafetyEscalation
}: FamilyInterviewProps) {
  const copy = {
    label: tFamily(language, "interviewLabel"),
    placeholder: placeholder ?? tFamily(language, "interviewPlaceholder"),
    submit: tFamily(language, "interviewSubmit"),
    speak: tFamily(language, "interviewMicStart"),
    done: tFamily(language, "interviewMicDone"),
    listening: tFamily(language, "interviewListening"),
    reconnecting: tFamily(language, "interviewReconnecting"),
    finished: tFamily(language, "interviewFinished"),
    stopped: tFamily(language, "interviewStopped"),
    tooLong: tFamily(language, "interviewErrorTooLong"),
    tooShort: tFamily(language, "interviewErrorTooShort"),
    working: tFamily(language, "interviewWorking")
  };
  const [text, setText] = useState(draft);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(draft.length > FAMILY_INTERVIEW_MAX_CHARS ? copy.tooLong : null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionGenerationRef = useRef(0);
  const acceptedSpeechResultsRef = useRef(new Set<string>());
  const keepListeningRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputSourceRef = useRef<"typed" | "voice" | "mixed">("typed");
  const lastLocalDraftRef = useRef(draft);
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);
  const latestContextKeyRef = useRef(familyContextKey(profile, draft, language));
  latestContextKeyRef.current = familyContextKey(profile, draft, language);

  const clearRestartTimer = useCallback((): void => {
    if (restartTimerRef.current === null) return;
    clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
  }, []);

  const cleanupRecognition = useCallback(
    (target = recognitionRef.current, stop = true, updateState = true): void => {
      clearRestartTimer();
      if (!target) {
        if (updateState && mountedRef.current) setListening(false);
        return;
      }
      target.onresult = null;
      target.onerror = null;
      target.onend = null;
      if (recognitionRef.current === target) {
        recognitionRef.current = null;
        recognitionGenerationRef.current += 1;
        if (updateState && mountedRef.current) setListening(false);
      }
      if (stop) {
        try {
          target.stop();
        } catch {
          // The engine may already be stopped; handlers are detached either way.
        }
      }
    },
    [clearRestartTimer]
  );

  const finishRecording = useCallback(
    (status: Extract<RecordingStatus, "finished" | "stopped">): void => {
      keepListeningRef.current = false;
      cleanupRecognition();
      if (mountedRef.current) setRecordingStatus(status);
    },
    [cleanupRecognition]
  );

  useEffect(() => {
    setVoiceSupported(speechRecognitionConstructor() !== null);
  }, []);

  useEffect(() => {
    if (submitting) return;
    // An empty incoming draft must never wipe words already in the box. Stored
    // state hydrates a tick after mount, so a caregiver who starts typing
    // immediately would otherwise watch their first sentence disappear — and on
    // a slow phone that window is wide enough to hit in normal use.
    if (draft.length === 0 && lastLocalDraftRef.current.length > 0) return;
    setText(draft);
    setError(draft.length > FAMILY_INTERVIEW_MAX_CHARS ? copy.tooLong : null);
    if (draft !== lastLocalDraftRef.current) {
      inputSourceRef.current = "typed";
      lastLocalDraftRef.current = draft;
    }
  }, [copy.tooLong, draft, submitting]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      keepListeningRef.current = false;
      cleanupRecognition(recognitionRef.current, true, false);
    };
  }, [cleanupRecognition]);

  function updateText(next: string): void {
    if (submittingRef.current) return;
    inputSourceRef.current = inputSourceRef.current === "voice" || inputSourceRef.current === "mixed" ? "mixed" : "typed";
    lastLocalDraftRef.current = next;
    setText(next);
    onDraftChange(next);
    setError(next.length > FAMILY_INTERVIEW_MAX_CHARS ? copy.tooLong : null);
    if (keepListeningRef.current && next.length >= FAMILY_INTERVIEW_MIC_DISABLE_AT) {
      finishRecording("stopped");
    }
  }

  function appendTranscript(transcript: string): void {
    if (submittingRef.current) return;
    const spoken = transcript.trim();
    if (!spoken) return;
    const current = lastLocalDraftRef.current;
    const next = current.length > 0 ? `${current} ${spoken}` : spoken;
    if (next.length > FAMILY_INTERVIEW_MAX_CHARS) {
      setError(copy.tooLong);
      finishRecording("stopped");
      return;
    }
    inputSourceRef.current = current.length === 0 && inputSourceRef.current === "typed" ? "voice" : inputSourceRef.current === "voice" ? "voice" : "mixed";
    lastLocalDraftRef.current = next;
    setText(next);
    setError(null);
    onDraftChange(next);
    if (next.length >= FAMILY_INTERVIEW_MIC_DISABLE_AT) {
      finishRecording("stopped");
    }
  }

  function toggleVoice(): void {
    if (submittingRef.current) return;
    if (keepListeningRef.current) {
      finishRecording("finished");
      return;
    }
    const Recognition = speechRecognitionConstructor();
    if (!Recognition || text.length >= FAMILY_INTERVIEW_MIC_DISABLE_AT) return;
    const recognition = new Recognition();
    acceptedSpeechResultsRef.current.clear();
    recognition.lang = language === "es" ? "es-US" : "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    const generation = recognitionGenerationRef.current + 1;
    recognitionGenerationRef.current = generation;
    recognition.onresult = (event) => {
      if (
        submittingRef.current ||
        recognitionRef.current !== recognition ||
        recognitionGenerationRef.current !== generation
      ) {
        return;
      }
      const start = event.resultIndex ?? 0;
      for (let index = start; index < event.results.length; index += 1) {
        const result = event.results[index];
        const first = result?.[0];
        if (first && result.isFinal === true) {
          const resultKey = `${index}:${first.transcript.trim()}`;
          if (acceptedSpeechResultsRef.current.has(resultKey)) continue;
          acceptedSpeechResultsRef.current.add(resultKey);
          appendTranscript(first.transcript);
        }
      }
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" && keepListeningRef.current) return;
      keepListeningRef.current = false;
      cleanupRecognition(recognition, false);
      if (mountedRef.current) setRecordingStatus("stopped");
    };
    recognition.onend = () => {
      if (
        recognitionRef.current !== recognition ||
        recognitionGenerationRef.current !== generation
      ) {
        return;
      }
      setListening(false);
      if (!keepListeningRef.current) {
        cleanupRecognition(recognition, false);
        return;
      }
      setRecordingStatus("reconnecting");
      clearRestartTimer();
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        if (
          !keepListeningRef.current ||
          recognitionRef.current !== recognition ||
          recognitionGenerationRef.current !== generation
        ) {
          return;
        }
        try {
          acceptedSpeechResultsRef.current.clear();
          recognition.start();
          setListening(true);
          setRecordingStatus("listening");
        } catch {
          keepListeningRef.current = false;
          cleanupRecognition(recognition, false);
          if (mountedRef.current) setRecordingStatus("stopped");
        }
      }, 250);
    };
    recognitionRef.current = recognition;
    keepListeningRef.current = true;
    setListening(true);
    setRecordingStatus("listening");
    try {
      recognition.start();
    } catch {
      keepListeningRef.current = false;
      cleanupRecognition(recognition, false);
      setRecordingStatus("stopped");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    const snapshot = {
      rawText: text,
      profile: {
        ...profile,
        diagnoses: profile.diagnoses.map((diagnosis) => ({ ...diagnosis }))
      },
      source: inputSourceRef.current,
      passcode,
      language,
      contextKey: latestContextKeyRef.current
    } as const;
    keepListeningRef.current = false;
    cleanupRecognition();
    setRecordingStatus("idle");
    let pending = false;
    try {
      if (!familyInterviewInputSchema.safeParse(snapshot.rawText).success) {
        setError(snapshot.rawText.length > FAMILY_INTERVIEW_MAX_CHARS ? copy.tooLong : copy.tooShort);
        return;
      }
      // A safety disclosure raises the banner and keeps the thread alive. The
      // tripping text is never sent anywhere: extraction falls to the on-device
      // path for this turn, and later clean turns resume the live route.
      const safety = screenFamilySafety(snapshot.rawText);
      if (safety) {
        onSafetyEscalation?.(safety);
      }

      pending = true;
      setSubmitting(true);
      let live: FamilyInterviewResult | null = null;
      // F1a. Two independent holds on the network, and the second one is new:
      // a safety turn never leaves the device, and neither does an ordinary turn
      // until the caregiver has been told what the online helper sends and said
      // yes. The route's own `unconfigured`/`locked` answers arrive after the
      // body does, so this is the only gate that actually keeps words at home.
      if (!safety && liveAllowed) {
        try {
          live = await requestFamilyInterview({
            text: snapshot.rawText,
            profile: snapshot.profile,
            passcode: snapshot.passcode,
            language: snapshot.language
          });
        } catch {
          live = null;
        }
      }
      if (!mountedRef.current || latestContextKeyRef.current !== snapshot.contextKey) return;
      const extraction = live ? "live" : "mock";
      const now = new Date();
      const result =
        live ??
        extractFamilyInterviewMock(
          snapshot.rawText,
          snapshot.profile,
          now,
          snapshot.language
        );
      if (mountedRef.current) {
        onExtracted(
          sanitizeResult(
            result,
            snapshot.profile,
            snapshot.rawText,
            snapshot.language,
            now
          ),
          {
            extraction,
            source: snapshot.source,
            rawText: snapshot.rawText
          }
        );
      }
    } finally {
      submittingRef.current = false;
      if (pending && mountedRef.current) setSubmitting(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(event) => void submit(event)}>
      <label className="block font-semibold" htmlFor="family-interview-text">
        {copy.label}
      </label>
      <textarea
        id="family-interview-text"
        aria-describedby="family-interview-count family-interview-status"
        aria-invalid={error !== null}
        className="min-h-36 w-full rounded-control border border-ink/20 bg-white p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care"
        disabled={submitting}
        value={text}
        placeholder={copy.placeholder}
        onChange={(event) => updateText(event.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        <p id="family-interview-count" className="text-sm text-ink/65" aria-live="polite">
          {tFamily(language, "interviewCount", { count: text.length, max: FAMILY_INTERVIEW_MAX_CHARS })}
        </p>
        <div className="flex items-center gap-2">
          {voiceSupported ? (
            <button
              type="button"
              aria-label={keepListeningRef.current ? copy.done : copy.speak}
              aria-pressed={keepListeningRef.current}
              disabled={submitting || (!keepListeningRef.current && text.length >= FAMILY_INTERVIEW_MIC_DISABLE_AT)}
              onClick={toggleVoice}
              className="inline-flex min-h-12 items-center gap-2 rounded-control bg-calm px-3 py-2 font-semibold text-care focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mic aria-hidden="true" className={listening ? "h-5 w-5 animate-pulse" : "h-5 w-5"} />
              <span>{keepListeningRef.current ? copy.done : copy.speak}</span>
            </button>
          ) : null}
          <button
            type="submit"
            disabled={submitting || !familyInterviewInputSchema.safeParse(text).success}
            className="min-w-0 break-words rounded-control bg-care px-4 py-3 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.submit}
          </button>
        </div>
      </div>
      <div id="family-interview-status" aria-live="polite">
        {error ? <p role="alert" className="text-sm font-medium text-rose-700">{error}</p> : null}
        {recordingStatus !== "idle" ? (
          <p role="status" className="text-sm font-medium text-care">
            {recordingStatus === "listening"
              ? copy.listening
              : recordingStatus === "reconnecting"
                ? copy.reconnecting
                : recordingStatus === "finished"
                  ? copy.finished
                  : copy.stopped}
          </p>
        ) : null}
        {submitting ? <p role="status" className="text-sm text-ink/70">{copy.working}</p> : null}
      </div>
    </form>
  );
}
