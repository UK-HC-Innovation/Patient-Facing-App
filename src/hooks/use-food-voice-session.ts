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
import { readPasscode } from "@/hooks/use-passcode";
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
  // Optional overrides so a surface with no patient (/food/demo) can reuse the whole voice
  // stack — token, safety gate, output guard — with its own persona and context. Omitted,
  // /food behaves exactly as before.
  buildInstructions?: (state: AppState) => string;
  buildContext?: (context: LiveSessionContext) => string;
  beforePatientResponse?: (text: string) => Promise<void>;
  tools?: RealtimeTool[];
  /**
   * Resolve `mode` on mount instead of waiting for the first start().
   *
   * A surface that only renders its voice control when mode === "live" deadlocks
   * otherwise: mode leaves "unknown" only inside start(), and start() can only be
   * reached through the control that is not being rendered. The probe uses the token
   * route's `probe` flag, which answers from environment alone and never mints an
   * OpenAI session, so this costs nothing.
   */
  probeOnMount?: boolean;
}): {
  mode: VoiceMode;
  dataMode: AiDataMode;
  status: LiveSessionStatus;
  partialAssistantText: string;
  error: string | null;
  start: () => Promise<void>;
  startWithContextResponse: () => Promise<void>;
  stop: () => void;
  sendUserText: (text: string) => void;
  requestContextResponse: () => void;
} {
  const { language, getState, getContext, onFinalTranscript, onSafetyIntercept } = args;
  // Held in refs, not read from the closure: /food/demo rebuilds these every render (its
  // context closes over whichever food is on screen), and start() is a useCallback. Read
  // straight from args and a session started once would keep answering with the first
  // render's food forever.
  const overridesRef = useRef({
    buildInstructions: args.buildInstructions,
    buildContext: args.buildContext,
    beforePatientResponse: args.beforePatientResponse,
    tools: args.tools
  });
  overridesRef.current = {
    buildInstructions: args.buildInstructions,
    buildContext: args.buildContext,
    beforePatientResponse: args.beforePatientResponse,
    tools: args.tools
  };
  const onInterceptRef = useRef(onSafetyIntercept);
  onInterceptRef.current = onSafetyIntercept;
  const [mode, setMode] = useState<VoiceMode>("unknown");
  const probeOnMount = args.probeOnMount === true;
  const [dataMode, setDataMode] = useState<AiDataMode>("checking");
  const [status, setStatus] = useState<LiveSessionStatus>("idle");
  const [partialAssistantText, setPartialAssistantText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<LiveSessionHandle | null>(null);
  const sessionStartRef = useRef<Promise<void> | null>(null);
  const startGenerationRef = useRef(0);
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
    startGenerationRef.current += 1;
    sessionStartRef.current = null;
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

  const startSession = useCallback(async (requestContextResponse: boolean) => {
    const generation = ++startGenerationRef.current;
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
    const passcode = readPasscode();
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

    if (generation !== startGenerationRef.current) {
      return;
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
            ...(context.historyLine ? [context.historyLine] : []),
            ...(context.dayTotalsLine ? [context.dayTotalsLine] : []),
            ...(context.plateLine ? [context.plateLine] : []),
            "Use the numbers above exactly; do not recompute them."
          ].join(" ")
        };
      };
      try {
        const hasBeforePatientResponse = Boolean(overridesRef.current.beforePatientResponse);
        const handle = await connectRealtimeSession({
          clientSecret: token.clientSecret,
          model: token.model,
          instructions: overridesRef.current.buildInstructions
            ? overridesRef.current.buildInstructions(state)
            : buildFoodLensInstructions(state, selectLenses(activeConditions(state.carePlan))),
          tools: overridesRef.current.tools,
          language,
          buildContextMessage,
          onEvent: (event) => {
            if (generation === startGenerationRef.current) {
              handleEvent(event);
            }
          },
          gateTranscript,
          ...(hasBeforePatientResponse
            ? {
                beforeRespondToTranscript: (text: string) =>
                  overridesRef.current.beforePatientResponse?.(text) ?? Promise.resolve()
              }
            : {})
        });
        if (generation !== startGenerationRef.current || safetyLatchedRef.current) {
          handle.close();
        } else {
          handleRef.current = handle;
          if (requestContextResponse) {
            handle.requestContextResponse?.();
          }
          armIdleTimer();
        }
      } catch {
        if (generation === startGenerationRef.current) {
          setError("Could not start the voice session.");
          setStatus("error");
        }
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
      {
        language,
        getState,
        getContext,
        onEvent: (event) => {
          if (generation === startGenerationRef.current) {
            handleEvent(event);
          }
        }
      },
      resolvedDataMode === "on_device"
        ? new MockHealthAiProvider()
        : new OpenAiVisionProvider({ passcode })
    );
    if (generation !== startGenerationRef.current || safetyLatchedRef.current) {
      handle.close();
    } else {
      handleRef.current = handle;
      if (requestContextResponse) {
        handle.requestContextResponse?.();
      }
      armIdleTimer();
    }
  }, [armIdleTimer, gateTranscript, getContext, getState, handleEvent, language]);

  const start = useCallback(() => {
    if (handleRef.current) {
      return Promise.resolve();
    }
    if (sessionStartRef.current) {
      return sessionStartRef.current;
    }

    const pending = startSession(false);
    sessionStartRef.current = pending;
    const clearPending = () => {
      if (sessionStartRef.current === pending) {
        sessionStartRef.current = null;
      }
    };
    void pending.then(clearPending, clearPending);
    return pending;
  }, [startSession]);
  const startWithContextResponse = useCallback(() => startSession(true), [startSession]);

  useEffect(() => {
    if (!probeOnMount) {
      return;
    }
    let cancelled = false;
    const passcode = readPasscode();
    void fetch("/api/realtime/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ probe: true, crisisOpen: false, passcode })
    })
      .then((response) => response.json() as Promise<TokenResponse>)
      .then((token) => {
        if (!cancelled) {
          setMode(token.mode === "live" ? "live" : "mock");
          setDataMode(aiDataModeForVoiceTransport(token));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMode("mock");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [probeOnMount]);

  const sendUserText = useCallback((text: string) => {
    const handle = handleRef.current;
    if (handle) {
      handle.sendUserText(text);
      return;
    }

    // probeOnMount resolves the transport so the typed form can render without
    // spending on a session. Open that session only when the person actually asks.
    const pending = start();
    const generation = startGenerationRef.current;
    void pending.then(
      () => {
        if (generation === startGenerationRef.current) {
          handleRef.current?.sendUserText(text);
        }
      },
      () => undefined
    );
  }, [start]);

  const requestContextResponse = useCallback(() => {
    handleRef.current?.requestContextResponse?.();
  }, []);

  useEffect(() => {
    return () => {
      startGenerationRef.current += 1;
      sessionStartRef.current = null;
      clearIdleTimer();
      handleRef.current?.close();
      handleRef.current = null;
    };
  }, [clearIdleTimer]);

  return {
    mode,
    dataMode,
    status,
    partialAssistantText,
    error,
    start,
    startWithContextResponse,
    stop,
    sendUserText,
    requestContextResponse
  };
}
