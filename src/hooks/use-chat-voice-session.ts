"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildCoachVoiceInstructions } from "@/ai/coach-voice-instructions";
import { connectRealtimeSession } from "@/ai/realtime-session";
import type { LiveSessionEvent, LiveSessionHandle, LiveSessionStatus } from "@/ai/types";
import { evaluateVoiceTranscript } from "@/ai/voice-gate";
import type { AppState } from "@/domain/types";
import { hasUnacknowledgedCrisis } from "@/state/selectors";
import type { VoiceSafetyIntercept } from "./use-food-voice-session";

export type ChatVoiceMode = "unknown" | "live" | "mock";

type TokenResponse =
  | { mode: "live"; clientSecret: string; model: string; expiresAt: number | null }
  | { mode: "mock"; reason: string }
  | { mode: "blocked"; reason: string }
  | { mode: "error"; message: string };

const IDLE_TIMEOUT_MS = 180000;

export function useChatVoiceSession(args: {
  language: "en" | "es";
  getState: () => AppState;
  onFinalTranscript: (role: "patient" | "assistant", text: string) => void;
  onSafetyIntercept: (intercept: VoiceSafetyIntercept) => void;
}): {
  mode: ChatVoiceMode;
  status: LiveSessionStatus;
  partialAssistantText: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
} {
  const { language, getState, onFinalTranscript, onSafetyIntercept } = args;
  const [mode, setMode] = useState<ChatVoiceMode>("unknown");
  const [status, setStatus] = useState<LiveSessionStatus>("idle");
  const [partialAssistantText, setPartialAssistantText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<LiveSessionHandle | null>(null);
  const safetyLatchedRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partialRef = useRef("");
  const onFinalRef = useRef(onFinalTranscript);
  const onInterceptRef = useRef(onSafetyIntercept);
  onFinalRef.current = onFinalTranscript;
  onInterceptRef.current = onSafetyIntercept;

  const clearIdleTimer = useCallback((): void => {
    if (!idleTimerRef.current) return;
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  }, []);

  const stop = useCallback((): void => {
    clearIdleTimer();
    handleRef.current?.close();
    handleRef.current = null;
    partialRef.current = "";
    setPartialAssistantText("");
    setStatus("closed");
  }, [clearIdleTimer]);

  const armIdleTimer = useCallback((): void => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(stop, IDLE_TIMEOUT_MS);
  }, [clearIdleTimer, stop]);

  const handleEvent = useCallback((event: LiveSessionEvent): void => {
    if (safetyLatchedRef.current) return;
    armIdleTimer();
    switch (event.type) {
      case "status":
        setStatus(event.status);
        break;
      case "userTranscript":
        if (event.final && event.text.trim()) onFinalRef.current("patient", event.text.trim());
        break;
      case "assistantTranscript":
        if (event.final) {
          const text = event.text.trim() || partialRef.current.trim();
          if (text) onFinalRef.current("assistant", text);
          partialRef.current = "";
          setPartialAssistantText("");
        } else {
          partialRef.current += event.text;
          setPartialAssistantText(partialRef.current);
        }
        break;
      case "safetyIntercept":
        safetyLatchedRef.current = true;
        partialRef.current = "";
        setPartialAssistantText("");
        onInterceptRef.current({
          safety: event.safety,
          content: event.content,
          banner: event.banner,
          actions: event.actions
        });
        stop();
        break;
      case "error":
        setError(event.message);
        if (event.fatal) setStatus("error");
        break;
    }
  }, [armIdleTimer, stop]);

  const gateTranscript = useCallback(
    (text: string) => evaluateVoiceTranscript(text, getState(), language),
    [getState, language]
  );

  const start = useCallback(async (): Promise<void> => {
    setError(null);
    safetyLatchedRef.current = false;
    const state = getState();
    if (hasUnacknowledgedCrisis(state)) {
      setStatus("idle");
      return;
    }

    setStatus("connecting");
    const passcode = typeof window === "undefined"
      ? undefined
      : new URLSearchParams(window.location.search).get("k") ?? undefined;
    let token: TokenResponse;
    try {
      const response = await fetch("/api/realtime/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: state.patient.id, crisisOpen: false, passcode })
      });
      token = (await response.json()) as TokenResponse;
    } catch {
      token = { mode: "mock", reason: "fetch_failed" };
    }

    if (token.mode !== "live") {
      setMode("mock");
      setStatus("idle");
      if (token.mode === "error") setError("Could not start the voice session.");
      return;
    }

    setMode("live");
    try {
      const handle = await connectRealtimeSession({
        clientSecret: token.clientSecret,
        model: token.model,
        instructions: buildCoachVoiceInstructions(getState()),
        language,
        buildContextMessage: () => null,
        onEvent: handleEvent,
        gateTranscript
      });
      if (safetyLatchedRef.current) {
        handle.close();
      } else {
        handleRef.current = handle;
        armIdleTimer();
      }
    } catch {
      setError("Could not start the voice session.");
      setStatus("error");
    }
  }, [armIdleTimer, gateTranscript, getState, handleEvent, language]);

  useEffect(() => () => {
    clearIdleTimer();
    handleRef.current?.close();
    handleRef.current = null;
  }, [clearIdleTimer]);

  return { mode, status, partialAssistantText, error, start, stop };
}
