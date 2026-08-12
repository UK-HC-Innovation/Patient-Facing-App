"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Language } from "@/i18n/strings";

type SpeechRecognitionResultLike = ArrayLike<{ transcript: string }> & { isFinal?: boolean };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: {
    results: ArrayLike<SpeechRecognitionResultLike>;
    resultIndex?: number;
  }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type RecognitionConstructor = new () => SpeechRecognitionLike;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function useDictation(options: {
  language: Language;
  onFinalTranscript: (text: string) => void;
  onError?: () => void;
  /** A hard lifecycle gate, used for safety locks and submitting states. */
  enabled?: boolean;
}): {
  supported: boolean;
  listening: boolean;
  start: () => void;
  stop: () => void;
} {
  const callbackRef = useRef(options.onFinalTranscript);
  const errorRef = useRef(options.onError);
  const enabledRef = useRef(options.enabled ?? true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const generationRef = useRef(0);
  const acceptedResultsRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  callbackRef.current = options.onFinalTranscript;
  errorRef.current = options.onError;
  enabledRef.current = options.enabled ?? true;

  const cleanup = useCallback((target = recognitionRef.current, stop = true, updateState = true): void => {
    if (!target) {
      if (updateState && mountedRef.current) setListening(false);
      return;
    }
    target.onresult = null;
    target.onerror = null;
    target.onend = null;
    if (recognitionRef.current === target) {
      recognitionRef.current = null;
      generationRef.current += 1;
      if (updateState && mountedRef.current) setListening(false);
    }
    if (stop) {
      try {
        target.stop();
      } catch {
        // Browsers can throw when recognition has already ended.
      }
    }
  }, []);

  const stop = useCallback((): void => cleanup(), [cleanup]);

  const start = useCallback((): void => {
    if (
      recognitionRef.current ||
      !enabledRef.current ||
      (typeof document !== "undefined" && document.visibilityState !== "visible")
    ) {
      return;
    }
    const Recognition = recognitionConstructor();
    if (!Recognition) return;

    const recognition = new Recognition();
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    acceptedResultsRef.current.clear();
    recognition.lang = options.language === "es" ? "es-US" : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      if (
        !enabledRef.current ||
        recognitionRef.current !== recognition ||
        generationRef.current !== generation
      ) return;
      const startIndex = event.resultIndex ?? 0;
      for (let index = startIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript.trim() ?? "";
        if (result?.isFinal !== true || !transcript) continue;
        const key = `${index}:${transcript}`;
        if (acceptedResultsRef.current.has(key)) continue;
        acceptedResultsRef.current.add(key);
        callbackRef.current(transcript);
      }
    };
    recognition.onerror = () => {
      cleanup(recognition, false);
      errorRef.current?.();
    };
    recognition.onend = () => cleanup(recognition, false);
    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      cleanup(recognition, false);
      errorRef.current?.();
    }
  }, [cleanup, options.language]);

  useEffect(() => {
    mountedRef.current = true;
    setSupported(recognitionConstructor() !== null);
    return () => {
      mountedRef.current = false;
      cleanup(recognitionRef.current, true, false);
    };
  }, [cleanup]);

  useEffect(() => {
    // An active recognizer keeps the locale it was created with. Treat a locale
    // switch or a safety/submission lock as a new session requiring another tap.
    stop();
  }, [options.language, options.enabled, stop]);

  useEffect(() => {
    const stopWhenHidden = (): void => {
      if (document.visibilityState !== "visible") stop();
    };
    const stopOnPageHide = (): void => stop();
    document.addEventListener("visibilitychange", stopWhenHidden);
    window.addEventListener("pagehide", stopOnPageHide);
    return () => {
      document.removeEventListener("visibilitychange", stopWhenHidden);
      window.removeEventListener("pagehide", stopOnPageHide);
    };
  }, [stop]);

  return { supported, listening, start, stop };
}
