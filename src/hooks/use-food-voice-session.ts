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
import { readRealtimeNonce } from "@/hooks/realtime-nonce-client";
import { aiDataModeForVoiceTransport, type AiDataMode } from "@/domain/privacy-disclosure";
import { t } from "@/i18n/strings";
import type { AiMessageAction, AppState } from "@/domain/types";
import type {
  HealthAiProvider,
  LiveSessionContext,
  LiveSessionEvent,
  LiveSessionHandle,
  LiveSessionStatus
} from "@/ai/types";

export type VoiceSafetyIntercept = {
  safety: "crisis" | "escalate" | "blocked";
  content: string;
  banner?: string;
  actions: AiMessageAction[];
};

export type VoiceMode = "unknown" | "live" | "mock";

const IDLE_TIMEOUT_MS = 180000;
/**
 * A turn that has been "thinking" this long is not thinking. Belt and braces over the
 * root-cause fix in realtime-session.ts: whatever else goes wrong upstream, the person
 * gets a finished sentence and a working ask box back (critique H2, G10).
 *
 * The cost is a slow but healthy answer that lands after the bound is dropped. That
 * trade is deliberate. A patient holding an insulin pen is better served by "ask again"
 * at 8 seconds than by 37 seconds of silence, and after spec 29 P3 a typed food scores
 * deterministically without a session at all.
 */
const THINKING_WATCHDOG_MS = 8000;

/**
 * Package ingredient text is raw OCR evidence. It may inform the confirmed in-memory
 * score, but it is not needed by voice and must not cross either voice transport.
 */
export function sanitizeFoodVoiceContext(context: LiveSessionContext): LiveSessionContext {
  const food = context.identifiedFood;
  if (!food || food.source !== "label_vision" || food.ingredientText === null) {
    return context;
  }
  return {
    ...context,
    identifiedFood: { ...food, ingredientText: null }
  };
}

type VoiceEngine = "realtime" | "live";

type TokenResponse =
  | { mode: "live"; engine?: VoiceEngine; model: string; clientSecret?: string; expiresAt?: number | null }
  | { mode: "mock"; reason: string }
  | { mode: "error"; message: string };

/**
 * Which kind of session the handle is. On GPT-Live the mic and the typed box use different
 * sessions: a typed line never enters a Live session, and the mic cannot ride the text path.
 */
type HandleKind = "realtime" | "live" | "local";

function engineOf(token: TokenResponse): VoiceEngine | null {
  if (token.mode !== "live") return null;
  return token.engine === "live" ? "live" : "realtime";
}

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
  /** The food's name as the door shows it, for spoken GPT-Live answers. Defaults to the identified food. */
  currentFoodName?: () => string | null;
  /** The line GPT-Live says when the camera names a food first. Defaults to the food's score. */
  buildOpeningLine?: () => string | null;
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
    tools: args.tools,
    currentFoodName: args.currentFoodName,
    buildOpeningLine: args.buildOpeningLine
  });
  overridesRef.current = {
    buildInstructions: args.buildInstructions,
    buildContext: args.buildContext,
    beforePatientResponse: args.beforePatientResponse,
    tools: args.tools,
    currentFoodName: args.currentFoodName,
    buildOpeningLine: args.buildOpeningLine
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
  const handleKindRef = useRef<HandleKind | null>(null);
  /** The engine the token route last named for this door. The route decides; this remembers. */
  const engineRef = useRef<VoiceEngine | null>(null);
  const sessionStartRef = useRef<Promise<void> | null>(null);
  const startGenerationRef = useRef(0);
  const safetyLatchedRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const languageRef = useRef(language);
  languageRef.current = language;
  const onFinalRef = useRef(onFinalTranscript);
  onFinalRef.current = onFinalTranscript;
  const partialRef = useRef("");

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const clearThinkingTimer = useCallback(() => {
    if (thinkingTimerRef.current) {
      clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearThinkingTimer();
    startGenerationRef.current += 1;
    sessionStartRef.current = null;
    clearIdleTimer();
    handleRef.current?.close();
    handleRef.current = null;
    handleKindRef.current = null;
    partialRef.current = "";
    setPartialAssistantText("");
    setStatus("closed");
  }, [clearIdleTimer, clearThinkingTimer]);

  const armIdleTimer = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      stop();
      setStatus("closed");
    }, IDLE_TIMEOUT_MS);
  }, [clearIdleTimer, stop]);

  const armThinkingTimer = useCallback(() => {
    clearThinkingTimer();
    thinkingTimerRef.current = setTimeout(() => {
      thinkingTimerRef.current = null;
      const partial = partialRef.current;
      const lost = t(languageRef.current, "voiceLost");
      stop();
      // idle, not closed: the typed form and the mic both have to come back.
      setStatus("idle");
      onFinalRef.current(
        "assistant",
        partial.trim().length > 0 ? `${partial.trimEnd()} …\n${lost}` : lost
      );
    }, THINKING_WATCHDOG_MS);
  }, [clearThinkingTimer, stop]);

  /** A session that ended on its own is gone: the mic must be able to start another. */
  const forgetHandle = useCallback(() => {
    handleRef.current = null;
    handleKindRef.current = null;
    sessionStartRef.current = null;
  }, []);

  const handleEvent = useCallback(
    (event: LiveSessionEvent) => {
      if (safetyLatchedRef.current) return;
      armIdleTimer();
      switch (event.type) {
        case "status":
          setStatus(event.status);
          if (event.status === "thinking") {
            armThinkingTimer();
          } else {
            clearThinkingTimer();
          }
          if (event.status === "closed") {
            // Only a session that closes itself reaches here: stop() moves the generation on
            // first, so its own close is never delivered. GPT-Live closes itself when idle.
            clearIdleTimer();
            forgetHandle();
          }
          break;
        case "userTranscript":
          if (event.final && event.text.trim().length > 0) {
            onFinalRef.current("patient", event.text);
          }
          break;
        case "assistantTranscript":
          clearThinkingTimer();
          if (event.final) {
            const base = event.text.trim().length > 0 ? event.text : partialRef.current;
            if (base.trim().length > 0) {
              // Never leave half a sentence as the last thing on screen.
              onFinalRef.current(
                "assistant",
                event.truncated ? `${base.trimEnd()} …\n${t(languageRef.current, "voiceLost")}` : base
              );
            }
            partialRef.current = "";
            setPartialAssistantText("");
          } else {
            partialRef.current += event.text;
            setPartialAssistantText(partialRef.current);
          }
          break;
        case "safetyIntercept":
          clearThinkingTimer();
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
            clearThinkingTimer();
            setStatus("error");
            // A failed transport has already let go of everything; keeping its handle would
            // leave Retry calling start() on a session that no longer exists.
            forgetHandle();
          }
          break;
      }
    },
    [armIdleTimer, armThinkingTimer, clearIdleTimer, clearThinkingTimer, forgetHandle, stop]
  );

  const gateTranscript = useCallback(
    (text: string) => evaluateVoiceTranscript(text, getState(), language),
    [getState, language]
  );

  const startSession = useCallback(async (requestContextResponse: boolean, purpose: "voice" | "text" = "voice") => {
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
        headers: { "Content-Type": "application/json", "x-realtime-nonce": readRealtimeNonce() },
        body: JSON.stringify({
          patientId: stateBeforeStart.patient.id,
          crisisOpen: false,
          passcode,
          surface: "food",
          language
        })
      });
      token = (await response.json()) as TokenResponse;
    } catch {
      token = { mode: "mock", reason: "fetch_failed" };
    }

    if (generation !== startGenerationRef.current) {
      return;
    }

    const state = getState();
    const getSafeContext = () => sanitizeFoodVoiceContext(getContext());
    const onEvent = (event: LiveSessionEvent) => {
      if (generation === startGenerationRef.current) {
        handleEvent(event);
      }
    };
    const adopt = (handle: LiveSessionHandle, kind: HandleKind) => {
      if (generation !== startGenerationRef.current || safetyLatchedRef.current) {
        handle.close();
        return;
      }
      handleRef.current = handle;
      handleKindRef.current = kind;
      if (requestContextResponse) {
        handle.requestContextResponse?.();
      }
      armIdleTimer();
    };
    const openLocal = async (provider: HealthAiProvider) => {
      adopt(await openLocalCoachSession({ language, getState, getContext: getSafeContext, onEvent }, provider), "local");
    };
    const instructions = overridesRef.current.buildInstructions
      ? overridesRef.current.buildInstructions(state)
      : buildFoodLensInstructions(state, selectLenses(activeConditions(state.carePlan)));

    const engine = engineOf(token);
    if (engine) {
      engineRef.current = engine;
      setMode("live");
      setDataMode(aiDataModeForVoiceTransport(token));
    }

    if (engine === "live") {
      if (purpose === "text") {
        // A typed line never enters a GPT-Live session. It takes the text path, which runs the
        // full safety and grounding chain and needs no microphone.
        await openLocal(new OpenAiVisionProvider({ passcode }));
        return;
      }
      try {
        // Loaded on a mic tap, so neither door's first load carries GPT-Live.
        const { startLiveVoice } = await import("@/ai/live-voice");
        if (generation !== startGenerationRef.current) {
          return;
        }
        adopt(
          await startLiveVoice({
            instructions,
            language,
            patientId: state.patient.id,
            passcode,
            nonce: readRealtimeNonce(),
            getContext: getSafeContext,
            overrides: () => overridesRef.current,
            gateTranscript,
            onEvent
          }),
          "live"
        );
      } catch {
        if (generation === startGenerationRef.current) {
          setError("Could not start the voice session.");
          setStatus("error");
        }
      }
      return;
    }

    if (token.mode === "live") {
      if (typeof token.clientSecret !== "string") {
        setError("Could not start the voice session.");
        setStatus("error");
        return;
      }
      let lastInjectedFoodId: string | null = null;
      const buildContextMessage = (): { text: string; imageDataUrl: string | null } => {
        const context = getSafeContext();
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
          instructions,
          tools: overridesRef.current.tools,
          language,
          buildContextMessage,
          onEvent,
          gateTranscript,
          ...(hasBeforePatientResponse
            ? {
                beforeRespondToTranscript: (text: string) =>
                  overridesRef.current.beforePatientResponse?.(text) ?? Promise.resolve()
              }
            : {})
        });
        adopt(handle, "realtime");
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
    await openLocal(
      resolvedDataMode === "on_device" ? new MockHealthAiProvider() : new OpenAiVisionProvider({ passcode })
    );
  }, [armIdleTimer, gateTranscript, getContext, getState, handleEvent, language]);

  const begin = useCallback((purpose: "voice" | "text") => {
    if (handleRef.current) {
      const wrongKind =
        engineRef.current === "live" &&
        (purpose === "voice" ? handleKindRef.current !== "live" : handleKindRef.current === "live");
      if (!wrongKind) {
        return Promise.resolve();
      }
      stop();
    }
    if (sessionStartRef.current) {
      return sessionStartRef.current;
    }

    const pending = startSession(false, purpose);
    sessionStartRef.current = pending;
    const clearPending = () => {
      if (sessionStartRef.current === pending) {
        sessionStartRef.current = null;
      }
    };
    void pending.then(clearPending, clearPending);
    return pending;
  }, [startSession, stop]);

  const start = useCallback(() => begin("voice"), [begin]);
  const startWithContextResponse = useCallback(() => {
    // Replace, never stack: a second session beside the first would keep a GPT-Live meter
    // running with no screen attached to it.
    if (handleRef.current) {
      stop();
    }
    return startSession(true, "voice");
  }, [startSession, stop]);

  useEffect(() => {
    if (!probeOnMount) {
      return;
    }
    let cancelled = false;
    const passcode = readPasscode();
    void fetch("/api/realtime/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ probe: true, crisisOpen: false, passcode, surface: "food", language })
    })
      .then((response) => response.json() as Promise<TokenResponse>)
      .then((token) => {
        if (!cancelled) {
          setMode(token.mode === "live" ? "live" : "mock");
          setDataMode(aiDataModeForVoiceTransport(token));
          engineRef.current = engineOf(token);
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
  }, [language, probeOnMount]);

  const sendUserText = useCallback((text: string) => {
    const handle = handleRef.current;
    if (handle && !(engineRef.current === "live" && handleKindRef.current === "live")) {
      handle.sendUserText(text);
      return;
    }

    // probeOnMount resolves the transport so the typed form can render without
    // spending on a session. Open that session only when the person actually asks. On
    // GPT-Live that is the text path, and an open Live session closes first.
    const pending = begin("text");
    const generation = startGenerationRef.current;
    void pending.then(
      () => {
        if (generation !== startGenerationRef.current) {
          return;
        }
        if (engineRef.current === "live" && handleKindRef.current === "live") {
          // A mic start was already in flight when the line was typed. The line still takes
          // the text path; a typed question is never dropped.
          const retry = begin("text");
          const retryGeneration = startGenerationRef.current;
          void retry.then(
            () => {
              if (retryGeneration === startGenerationRef.current) {
                handleRef.current?.sendUserText(text);
              }
            },
            () => undefined
          );
          return;
        }
        handleRef.current?.sendUserText(text);
      },
      () => undefined
    );
  }, [begin]);

  const requestContextResponse = useCallback(() => {
    handleRef.current?.requestContextResponse?.();
  }, []);

  useEffect(() => {
    return () => {
      startGenerationRef.current += 1;
      sessionStartRef.current = null;
      clearIdleTimer();
      clearThinkingTimer();
      handleRef.current?.close();
      handleRef.current = null;
      handleKindRef.current = null;
    };
  }, [clearIdleTimer, clearThinkingTimer]);

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
