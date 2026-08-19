"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OpenAiVisionProvider } from "@/ai/vision-provider";
import { MockHealthAiProvider } from "@/ai/mock-provider";
import { openLocalCoachSession } from "@/ai/local-coach-session";
import { buildCompassContext, buildFoodLensInstructions } from "@/ai/food-instructions";
import { connectRealtimeSession, type RealtimeTool } from "@/ai/realtime-session";
import { evaluateVoiceTranscript } from "@/ai/voice-gate";
import { activeConditions, selectLenses } from "@/domain/condition-lens";
import { hasUnacknowledgedCrisis } from "@/state/selectors";
import { aiDataModeForVoiceTransport, type AiDataMode } from "@/domain/privacy-disclosure";
import type { AiMessageAction, AppState } from "@/domain/types";
import type { LiveSessionContext, LiveSessionEvent, LiveSessionHandle, LiveSessionStatus } from "@/ai/types";

export type VoiceSafetyIntercept = {
  safety: "crisis" | "escalate" | "blocked";
  content: string;
  banner?: string;
  actions: AiMessageAction[];
};

export type VoiceMode = "unknown" | "live" | "mock";

const IDLE_TIMEOUT_MS = 180000;

type TokenResponse =
  | { mode: "live"; clientSecret: string; model: string; expiresAt: number | null }
  | { mode: "mock"; reason: string }
  | { mode: "error"; message: string };

export function useFoodVoiceSession(args: {
  language: "en" | "es";
  getState: () => AppState;
  getContext: () => LiveSessionContext;
  onFinalTranscript: (role: "patient" | "assistant", text: string) => void;
  onSafetyIntercept: (intercept: VoiceSafetyIntercept) => void;
  // Optional overrides so a surface with no patient (/compass) can reuse the whole voice
  // stack — token, safety gate, output guard — with its own persona and context. Omitted,
  // /food behaves exactly as before.
  buildInstructions?: (state: AppState) => string;
  buildContext?: (context: LiveSessionContext) => string;
  tools?: RealtimeTool[];
}): {
  mode: VoiceMode;
  dataMode: AiDataMode;
  status: LiveSessionStatus;
  partialAssistantText: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  sendUserText: (text: string) => void;
} {
  const { language, getState, getContext, onFinalTranscript, onSafetyIntercept } = args;
  // Held in refs, not read from the closure: /compass rebuilds these every render (its
  // context closes over whichever food is on screen), and start() is a useCallback. Read
  // straight from args and a session started once would keep answering with the first
  // render's food forever.
  const overridesRef = useRef({
    buildInstructions: args.buildInstructions,
    buildContext: args.buildContext,
    tools: args.tools
  });
  overridesRef.current = {
    buildInstructions: args.buildInstructions,
    buildContext: args.buildContext,
    tools: args.tools
  };
  const onInterceptRef = useRef(onSafetyIntercept);
  onInterceptRef.current = onSafetyIntercept;
  const [mode, setMode] = useState<VoiceMode>("unknown");
  const [dataMode, setDataMode] = useState<AiDataMode>("checking");
  const [status, setStatus] = useState<LiveSessionStatus>("idle");
  const [partialAssistantText, setPartialAssistantText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<LiveSessionHandle | null>(null);
  const safetyLatchedRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinalRef = useRef(onFinalTranscript);
  onFinalRef.current = onFinalTranscript;
  const partialRef = useRef("");

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearIdleTimer();
    handleRef.current?.close();
    handleRef.current = null;
    partialRef.current = "";
    setPartialAssistantText("");
    setStatus("closed");
  }, [clearIdleTimer]);

  const armIdleTimer = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      stop();
      setStatus("closed");
    }, IDLE_TIMEOUT_MS);
  }, [clearIdleTimer, stop]);

  const handleEvent = useCallback(
    (event: LiveSessionEvent) => {
      if (safetyLatchedRef.current) return;
      armIdleTimer();
      switch (event.type) {
        case "status":
          setStatus(event.status);
          break;
        case "userTranscript":
          if (event.final && event.text.trim().length > 0) {
            onFinalRef.current("patient", event.text);
          }
          break;
        case "assistantTranscript":
          if (event.final) {
            const text = event.text.trim().length > 0 ? event.text : partialRef.current;
            if (text.trim().length > 0) {
              onFinalRef.current("assistant", text);
            }
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
          if (event.fatal) {
            setStatus("error");
          }
          break;
      }
    },
    [armIdleTimer, stop]
  );

  const gateTranscript = useCallback(
    (text: string) => evaluateVoiceTranscript(text, getState(), language),
    [getState, language]
  );

  const start = useCallback(async () => {
    setError(null);
    safetyLatchedRef.current = false;

    const stateBeforeStart = getState();
    // Refuse to open a routine voice session while an unacknowledged crisis is on
    // screen — the crisis resources must stay the focus.
    if (hasUnacknowledgedCrisis(stateBeforeStart)) {
      setStatus("idle");
      return;
    }

    setStatus("connecting");
    const passcode =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("k") ?? undefined
        : undefined;
    let token: TokenResponse;
    try {
      const response = await fetch("/api/realtime/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: stateBeforeStart.patient.id, crisisOpen: false, passcode })
      });
      token = (await response.json()) as TokenResponse;
    } catch {
      token = { mode: "mock", reason: "fetch_failed" };
    }

    const state = getState();

    if (token.mode === "live") {
      setMode("live");
      setDataMode(aiDataModeForVoiceTransport(token));
      let lastInjectedFoodId: string | null = null;
      const buildContextMessage = (): { text: string; imageDataUrl: string | null } => {
        const context = getContext();
        const override = overridesRef.current.buildContext;
        if (override) {
          return { imageDataUrl: context.frameDataUrl, text: override(context) };
        }
        const includeFood = context.identifiedFood && context.identifiedFood.id !== lastInjectedFoodId;
        if (context.identifiedFood) {
          lastInjectedFoodId = context.identifiedFood.id;
        }
        const foodJson = includeFood ? JSON.stringify(context.identifiedFood) : '{"foodData":"unchanged"}';
        const flags = context.flagTexts.length > 0 ? context.flagTexts.join("; ") : "none";
        const compass = buildCompassContext(context.compass ?? null);
        return {
          imageDataUrl: context.frameDataUrl,
          text: [
            `[camera context — not spoken by the patient] Food data: ${foodJson}. Precomputed flags: ${flags}.`,
            ...(compass ? [compass] : []),
            "Use the numbers above exactly; do not recompute them."
          ].join(" ")
        };
      };
      try {
        const handle = await connectRealtimeSession({
          clientSecret: token.clientSecret,
          model: token.model,
          instructions: overridesRef.current.buildInstructions
            ? overridesRef.current.buildInstructions(state)
            : buildFoodLensInstructions(state, selectLenses(activeConditions(state.carePlan))),
          tools: overridesRef.current.tools,
          language,
          buildContextMessage,
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
      return;
    }

    // Non-realtime fallback: typed questions still get a real image answer from the
    // HTTP vision provider when transport resolution failed. A resolved mock or
    // locked configuration stays fully on-device and never submits the frame.
    setMode("mock");
    const resolvedDataMode = aiDataModeForVoiceTransport(token);
    setDataMode(resolvedDataMode);
    const handle = await openLocalCoachSession(
      { language, getState, getContext, onEvent: handleEvent },
      resolvedDataMode === "on_device"
        ? new MockHealthAiProvider()
        : new OpenAiVisionProvider({ passcode })
    );
    if (safetyLatchedRef.current) {
      handle.close();
    } else {
      handleRef.current = handle;
      armIdleTimer();
    }
  }, [armIdleTimer, gateTranscript, getContext, getState, handleEvent, language]);

  const sendUserText = useCallback((text: string) => {
    handleRef.current?.sendUserText(text);
  }, []);

  useEffect(() => {
    return () => {
      clearIdleTimer();
      handleRef.current?.close();
      handleRef.current = null;
    };
  }, [clearIdleTimer]);

  return { mode, dataMode, status, partialAssistantText, error, start, stop, sendUserText };
}
