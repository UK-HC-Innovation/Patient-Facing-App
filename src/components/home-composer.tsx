"use client";

import { Mic, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { classifyRouteRemote } from "@/ai/route-classifier-client";
import { decideFrontDoor } from "@/domain/front-door";
import { classifyCrisis } from "@/domain/safety";
import { usageOutcomeFromHref, usageSignature } from "@/domain/usage-event";
import { recordUsage } from "@/telemetry/recorder";
import { CLASSIFIER_HREFS } from "@/domain/route-classifier";
import { tHome, type HomeStringKey } from "@/i18n/home-strings";
import type { Language } from "@/i18n/strings";
import { tVoice } from "@/i18n/voice-strings";
import { useHealthState } from "@/state/store";
import { isSpeaking, speak, stopSpeaking, subscribeSpeaking } from "@/voice/tts";
import { useDictation } from "@/voice/use-dictation";
import { useVoiceEntry } from "@/voice/voice-consent";
import { VoiceConsentSheet } from "@/voice/voice-consent-sheet";
import { VoiceIndicator } from "@/voice/voice-indicator";
import { MENU_GROUPS } from "./menu-grid";

export const NAV_CONFIRM_MS = 1500;
const CLARIFY_TIMEOUT_MS = 6000;

type PendingNavigation = { href: string; label: string; utterance: string };
type ClarifyOption = { href: string; label: string };
type Clarification = { options: ClarifyOption[]; utterance: string; voiceInitiated: boolean };
type VoiceMode = "route" | "cancel" | "clarify";

const ROUTE_LABEL_KEYS = new Map<string, HomeStringKey>(
  MENU_GROUPS.flatMap(({ items }) => items.map(({ href, labelKey }) => [href, labelKey] as const))
);

const CANCEL_GRAMMAR: Record<Language, ReadonlySet<string>> = {
  en: new Set(["no", "stop", "cancel", "wait"]),
  es: new Set(["no", "para", "cancela", "espera"])
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

function routeLabel(href: string, language: Language): string {
  const key = ROUTE_LABEL_KEYS.get(href);
  return key ? tHome(language, key) : href;
}

function spokenOptions(options: readonly ClarifyOption[], language: Language): string {
  const labels = options.map(({ label }) => label);
  const conjunction = language === "es" ? "o" : "or";
  if (labels.length === 2) return `${labels[0]} ${conjunction} ${labels[1]}`;
  if (labels.length > 2) return `${labels.slice(0, -1).join(", ")}, ${conjunction} ${labels.at(-1)}`;
  return labels[0] ?? "";
}

function matchClarification(
  transcript: string,
  options: readonly ClarifyOption[],
  language: Language
): ClarifyOption | null {
  const normalized = normalizeSpoken(transcript);
  const label = options.find((option) => normalizeSpoken(option.label) === normalized);
  if (label) return label;
  const index = ORDINALS[language].findIndex((phrases) => phrases.includes(normalized));
  return index >= 0 ? options[index] ?? null : null;
}

export function HomeComposer() {
  const router = useRouter();
  const { state, dispatch } = useHealthState();
  const language = state.patient.language;
  const [input, setInput] = useState("");
  const [showConsent, setShowConsent] = useState(false);
  const [speaking, setSpeaking] = useState(() => isSpeaking());
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [clarification, setClarification] = useState<Clarification | null>(null);
  const modeRef = useRef<VoiceMode>("route");
  const pendingNavigationRef = useRef<PendingNavigation | null>(null);
  const clarificationRef = useRef<Clarification | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeRef = useRef<(utterance: string, voiceInitiated: boolean) => Promise<void>>(async () => undefined);
  const dictationControlsRef = useRef<{ start: () => void; stop: () => void }>({
    start: () => undefined,
    stop: () => undefined
  });
  const voiceEntry = useVoiceEntry({ patientId: state.patient.id, dispatch });

  const clearTimer = useCallback((): void => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const clearInteractiveState = useCallback((): void => {
    clearTimer();
    pendingNavigationRef.current = null;
    clarificationRef.current = null;
    modeRef.current = "route";
    setPendingNavigation(null);
    setClarification(null);
    dictationControlsRef.current.stop();
  }, [clearTimer]);

  const fallbackToCoach = useCallback(
    (utterance: string): void => {
      clearInteractiveState();
      router.push(`/chat?ask=${encodeURIComponent(utterance)}`);
    },
    [clearInteractiveState, router]
  );

  const chooseClarification = useCallback(
    (option: ClarifyOption): void => {
      clearInteractiveState();
      stopSpeaking();
      router.push(option.href);
    },
    [clearInteractiveState, router]
  );

  const onFinalTranscript = useCallback(
    (transcript: string): void => {
      const mode = modeRef.current;
      if (mode === "cancel") {
        if (CANCEL_GRAMMAR[language].has(normalizeSpoken(transcript))) {
          clearInteractiveState();
          stopSpeaking();
        }
        return;
      }
      if (mode === "clarify") {
        const pending = clarificationRef.current;
        if (!pending) return;
        const match = matchClarification(transcript, pending.options, language);
        if (match) {
          chooseClarification(match);
        } else {
          fallbackToCoach(pending.utterance);
        }
        return;
      }
      setInput(transcript);
      void routeRef.current(transcript, true);
    },
    [chooseClarification, clearInteractiveState, fallbackToCoach, language]
  );

  const dictation = useDictation({ language, onFinalTranscript });
  const stopDictation = dictation.stop;
  dictationControlsRef.current = { start: dictation.start, stop: dictation.stop };

  useEffect(() => subscribeSpeaking(setSpeaking), []);

  useEffect(
    () => () => {
      clearTimer();
      stopDictation();
      stopSpeaking();
    },
    [clearTimer, stopDictation]
  );

  async function confirmNavigation(pending: PendingNavigation): Promise<void> {
    clearInteractiveState();
    pendingNavigationRef.current = pending;
    modeRef.current = "cancel";
    setPendingNavigation(pending);
    await speak(tVoice(language, "takingYouTo", { label: pending.label }), { language });
    if (pendingNavigationRef.current !== pending) return;
    dictationControlsRef.current.start();
    timerRef.current = setTimeout(() => {
      if (pendingNavigationRef.current !== pending) return;
      clearInteractiveState();
      router.push(pending.href);
    }, NAV_CONFIRM_MS);
  }

  async function offerClarification(next: Clarification): Promise<void> {
    clearInteractiveState();
    clarificationRef.current = next;
    modeRef.current = "clarify";
    setClarification(next);
    await speak(
      tVoice(language, "didYouMean", { options: spokenOptions(next.options, language) }),
      { language }
    );
    if (clarificationRef.current !== next) return;
    if (next.voiceInitiated) dictationControlsRef.current.start();
    timerRef.current = setTimeout(() => {
      if (clarificationRef.current === next) fallbackToCoach(next.utterance);
    }, CLARIFY_TIMEOUT_MS);
  }

  async function route(utterance: string, voiceInitiated: boolean): Promise<void> {
    const trimmed = utterance.trim();
    if (!trimmed) return;

    // One signature per submission, shared by every event this utterance produces, so the
    // report can line up "the gate cleared it" with "and then it routed here".
    const signature = usageSignature(trimmed.toLowerCase());
    const startedAt = performance.now();
    const decision = decideFrontDoor(trimmed, state);
    const decidedIn = Math.round(performance.now() - startedAt);

    // Re-run the crisis screen purely to report WHICH rule fired. `decideFrontDoor`
    // collapses crisis, urgent-symptom and social-emergency into one `safety` reason, and
    // "something escalated" is not auditable -- "self_harm_wake_up escalated" is. The screen
    // is pure and already ran once this submission, so this costs a second regex pass.
    // Recorded on a clear utterance too: a gate that failed to fire is the failure that
    // matters, and it is invisible if only the fires are logged.
    const crisis = classifyCrisis(trimmed);
    recordUsage({
      kind: "decision",
      decision: "crisis_gate",
      outcome: crisis.matched ? "matched" : "clear",
      source: crisis.source === "model_backstop" ? "model" : "deterministic",
      tags: crisis.ruleIds.slice(0, 8),
      inputSignature: signature
    });

    recordUsage({
      kind: "decision",
      decision: "route_classify",
      outcome:
        decision.kind === "navigate"
          ? usageOutcomeFromHref(decision.href)
          : `coach.${decision.reason}`,
      source: "deterministic",
      inputSignature: signature,
      latencyMs: decidedIn
    });

    if (decision.kind === "navigate") {
      if (voiceInitiated) {
        await confirmNavigation({ href: decision.href, label: decision.label, utterance: trimmed });
      } else {
        clearInteractiveState();
        router.push(decision.href);
      }
      return;
    }
    if (decision.reason === "safety") {
      clearInteractiveState();
      router.push(`/chat?ask=${encodeURIComponent(trimmed)}`);
      return;
    }

    const askedAt = performance.now();
    const llm = await classifyRouteRemote(trimmed, CLASSIFIER_HREFS);
    recordUsage({
      kind: "decision",
      decision: "route_classify",
      outcome: llm.kind === "navigate" ? usageOutcomeFromHref(llm.href ?? "") : `stage.${llm.kind}`,
      source: "model",
      inputSignature: signature,
      confidence: typeof llm.confidence === "number" ? Math.min(1, Math.max(0, llm.confidence)) : undefined,
      latencyMs: Math.round(performance.now() - askedAt)
    });
    if (
      llm.kind === "navigate" &&
      typeof llm.href === "string" &&
      CLASSIFIER_HREFS.includes(llm.href) &&
      llm.confidence >= 0.75
    ) {
      if (voiceInitiated) {
        await confirmNavigation({ href: llm.href, label: routeLabel(llm.href, language), utterance: trimmed });
      } else {
        clearInteractiveState();
        router.push(llm.href);
      }
      return;
    }
    if (llm.kind === "clarify") {
      const options = llm.candidates
        .filter((href) => CLASSIFIER_HREFS.includes(href))
        .slice(0, 3)
        .map((href) => ({ href, label: routeLabel(href, language) }));
      if (options.length > 0) {
        await offerClarification({ options, utterance: trimmed, voiceInitiated });
        return;
      }
    }
    fallbackToCoach(trimmed);
  }
  routeRef.current = route;

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    void route(input, false);
  }

  function beginDictation(): void {
    clearInteractiveState();
    stopSpeaking();
    voiceEntry.onSessionStart("front door");
    dictation.start();
  }

  function toggleVoice(): void {
    if (dictation.listening) {
      dictation.stop();
      return;
    }
    if (voiceEntry.consentRequired) {
      setShowConsent(true);
      return;
    }
    beginDictation();
  }

  return (
    <div className="space-y-2">
      <form onSubmit={submit} className="flex items-center gap-2 rounded-control border border-ink/15 bg-white p-2">
        <label className="sr-only" htmlFor="home-composer-input">
          {tHome(language, "composerLabel")}
        </label>
        <input
          id="home-composer-input"
          className="min-h-11 flex-1 rounded-control px-3 py-2 text-sm"
          placeholder={tHome(language, "composerPlaceholder")}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        {dictation.supported ? (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={dictation.listening ? tHome(language, "composerStop") : tHome(language, "composerSpeak")}
            aria-pressed={dictation.listening}
            className={`inline-flex h-11 w-11 flex-none items-center justify-center rounded-full ${dictation.listening ? "bg-pulse text-white" : "bg-calm text-care"}`}
          >
            <Mic aria-hidden="true" className="h-5 w-5" />
          </button>
        ) : null}
        <button type="submit" aria-label={tHome(language, "composerSend")} className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full bg-care text-white">
          <Send aria-hidden="true" className="h-5 w-5" />
        </button>
      </form>

      {pendingNavigation ? (
        <button
          type="button"
          onClick={() => {
            clearInteractiveState();
            stopSpeaking();
          }}
          className="min-h-12 rounded-control border border-care bg-white px-4 py-2 text-sm font-semibold text-care"
        >
          {tVoice(language, "goingToCancel", { label: pendingNavigation.label })}
        </button>
      ) : null}

      {clarification ? (
        <div role="group" aria-label={tVoice(language, "didYouMean", { options: "" })} className="flex flex-wrap gap-2">
          {clarification.options.map((option) => (
            <button
              key={option.href}
              type="button"
              onClick={() => chooseClarification(option)}
              className="min-h-12 rounded-control border border-care bg-white px-4 py-2 font-semibold text-care"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      <VoiceIndicator
        listening={dictation.listening}
        speaking={speaking}
        onStop={() => {
          clearInteractiveState();
          stopSpeaking();
        }}
      />

      {showConsent ? (
        <VoiceConsentSheet
          language={language}
          onAccept={() => {
            voiceEntry.grantConsent();
            setShowConsent(false);
            beginDictation();
          }}
          onCancel={() => setShowConsent(false)}
        />
      ) : null}
    </div>
  );
}
