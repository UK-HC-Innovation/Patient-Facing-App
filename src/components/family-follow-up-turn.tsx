"use client";

import { Mic } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { FamilyFollowUp } from "@/domain/family-interview";
import { classifyCrisis, classifySafety } from "@/domain/safety";
import { screenSocialEmergency } from "@/domain/social-screen";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";
import { tVoice } from "@/i18n/voice-strings";
import { useDictation } from "@/voice/use-dictation";
import { useVoiceEntry, type VoiceEntryContext } from "@/voice/voice-consent";
import { VoiceConsentSheet } from "@/voice/voice-consent-sheet";
import { VoiceIndicator } from "@/voice/voice-indicator";
import { BTN_CHOICE, BTN_PRIMARY, CONTROL_FOCUS } from "@/components/family-theme";

export const FAMILY_FOLLOW_UP_ANSWER_MAX = 500;

export type FamilyFollowUpTurnProps = {
  question: FamilyFollowUp;
  round: number;
  roundCap: number;
  language: Language;
  submitting: boolean;
  voiceEntryContext?: VoiceEntryContext;
  /** Dictation stays closed while an unacknowledged safety banner is on screen. */
  voiceLocked?: boolean;
  onAnswer: (text: string, via: "chip" | "typed" | "voice") => void;
};

const ORDINALS: Record<Language, string[][]> = {
  en: [
    ["one", "first", "the first one", "option one"],
    ["two", "second", "the second one", "option two"],
    ["three", "third", "the third one", "option three"]
  ],
  es: [
    ["uno", "una", "primero", "primera", "el primero", "la primera", "opcion uno"],
    ["dos", "segundo", "segunda", "el segundo", "la segunda", "opcion dos"],
    ["tres", "tercero", "tercera", "el tercero", "la tercera", "opcion tres"]
  ]
};

function normalizeSpoken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchSpokenOption(text: string, options: readonly string[], language: Language): string | null {
  const normalized = normalizeSpoken(text);
  const labelMatch = options.find((option) => normalizeSpoken(option) === normalized);
  if (labelMatch) return labelMatch;
  const ordinalIndex = ORDINALS[language].findIndex((phrases) => phrases.includes(normalized));
  return ordinalIndex >= 0 ? options[ordinalIndex] ?? null : null;
}

export function FamilyFollowUpTurn({
  question,
  round,
  roundCap,
  language,
  submitting,
  voiceEntryContext,
  voiceLocked = false,
  onAnswer
}: FamilyFollowUpTurnProps) {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const { consentRequired, grantConsent, onSessionStart } = useVoiceEntry(voiceEntryContext);

  const onFinalTranscript = useCallback(
    (transcript: string): void => {
      if (
        classifyCrisis(transcript).matched ||
        classifySafety(transcript).level !== "allowed" ||
        screenSocialEmergency(transcript)
      ) {
        onAnswer(transcript, "voice");
        return;
      }
      const matched = matchSpokenOption(transcript, question.options, language);
      if (matched) {
        onAnswer(matched, "voice");
        return;
      }
      setAnswer(transcript.slice(0, FAMILY_FOLLOW_UP_ANSWER_MAX));
      setError(false);
    },
    [language, onAnswer, question.options]
  );
  const dictation = useDictation({
    language,
    onFinalTranscript,
    enabled: !voiceLocked && !submitting
  });
  const stopDictation = dictation.stop;

  useEffect(() => {
    setAnswer("");
    setError(false);
    if (round > 1) {
      questionRef.current?.focus();
    }
  }, [question.question, round]);

  useEffect(
    () => () => {
      stopDictation();
    },
    [stopDictation]
  );

  useEffect(() => {
    if (voiceLocked || submitting) setShowConsent(false);
  }, [submitting, voiceLocked]);

  function beginVoice(): void {
    onSessionStart("family follow-up");
    dictation.start();
  }

  function toggleVoice(): void {
    if (dictation.listening) {
      dictation.stop();
      return;
    }
    if (voiceLocked) {
      return;
    }
    if (consentRequired) {
      setShowConsent(true);
      return;
    }
    beginVoice();
  }

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = answer.trim();
    if (!trimmed) {
      setError(true);
      return;
    }
    onAnswer(trimmed, "typed");
  }

  return (
    <section className="rounded-control border border-care/30 bg-white p-4" aria-labelledby="family-follow-up-question">
      <p className="text-xs font-semibold uppercase tracking-wide text-care">
        {tFamily(language, "orientationRoundCount", { round, max: roundCap })}
      </p>
      {/* Help is already on screen above this; answering only sharpens it. */}
      <p className="mt-1 break-words text-sm font-medium text-ink/75">
        {tFamily(language, "followUpOptional")}
      </p>
      <h3
        id="family-follow-up-question"
        ref={questionRef}
        tabIndex={-1}
        className="mt-2 break-words text-lg font-semibold"
      >
        {question.question}
      </h3>
      {question.options.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={tFamily(language, "followUpChipsLabel")}>
          {question.options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={submitting}
              onClick={() => onAnswer(option, "chip")}
              className={BTN_CHOICE}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
      <form className="mt-4 grid gap-2" onSubmit={submit}>
        <label className="text-sm font-semibold" htmlFor={`family-follow-up-answer-${round}`}>
          {tFamily(language, "followUpAnswerLabel")}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={`family-follow-up-answer-${round}`}
            type="text"
            value={answer}
            maxLength={FAMILY_FOLLOW_UP_ANSWER_MAX}
            disabled={submitting}
            aria-invalid={error}
            aria-describedby={error ? `family-follow-up-error-${round}` : undefined}
            placeholder={tFamily(language, "followUpAnswerPlaceholder")}
            onChange={(event) => {
              setAnswer(event.target.value);
              if (error) setError(false);
            }}
            className={`min-h-12 min-w-0 flex-1 rounded-control border border-ink/20 bg-white px-3 py-2 ${CONTROL_FOCUS}`}
          />
          {dictation.supported ? (
            <button
              type="button"
              aria-label={dictation.listening ? tVoice(language, "stopVoice") : tVoice(language, "answerByVoice")}
              aria-pressed={dictation.listening}
              disabled={submitting}
              onClick={toggleVoice}
              className={`min-h-12 rounded-control border border-care px-3 text-care disabled:opacity-50 ${CONTROL_FOCUS}`}
            >
              <Mic aria-hidden="true" className="h-5 w-5" />
            </button>
          ) : null}
          <button type="submit" disabled={submitting} className={BTN_PRIMARY}>
            {tFamily(language, "followUpAnswerSubmit")}
          </button>
        </div>
        {error ? (
          <p id={`family-follow-up-error-${round}`} role="alert" className="text-sm font-medium text-red-700">
            {tFamily(language, "followUpAnswerError")}
          </p>
        ) : null}
        <VoiceIndicator
          listening={dictation.listening}
          speaking={false}
          onStop={() => dictation.stop()}
        />
      </form>
      {showConsent ? (
        <div className="mt-4">
          <VoiceConsentSheet
            language={language}
            onAccept={() => {
              grantConsent();
              setShowConsent(false);
              beginVoice();
            }}
            onCancel={() => setShowConsent(false)}
          />
        </div>
      ) : null}
    </section>
  );
}
