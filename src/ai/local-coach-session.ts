import { createSafeAiResponse } from "./safety-gate";
import type { HealthAiProvider, LiveSessionHandle, LiveSessionInit, LiveSessionStatus } from "./types";

// The on-device fallback "live" session: no WebRTC, no mic. A typed question runs
// through the full safety gate (crisis + grounding) against the given provider and
// the answer is read aloud with the browser's speech synthesis. This is the same
// loop the mock provider used; it is parameterized by provider so the non-realtime
// path can be backed by the real HTTP vision provider instead of canned text.
export async function openLocalCoachSession(
  init: LiveSessionInit,
  provider: HealthAiProvider
): Promise<LiveSessionHandle> {
  let status: LiveSessionStatus = "listening";
  let closed = false;

  const emit = init.onEvent;
  emit({ type: "status", status: "listening" });

  const speak = (text: string) => {
    if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") {
      return;
    }
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = init.language === "es" ? "es-ES" : "en-US";
      window.speechSynthesis.speak(utterance);
    } catch {
      // speech synthesis is best-effort in the fallback session
    }
  };

  return {
    sendUserText: (text: string) => {
      if (closed) {
        return;
      }
      status = "thinking";
      emit({ type: "userTranscript", text, final: true });
      emit({ type: "status", status: "thinking" });

      const context = init.getContext();
      void createSafeAiResponse(
        {
          mode: "food",
          patientInput: text,
          state: init.getState(),
          identifiedFood: context.identifiedFood ?? undefined,
          compass: context.compass ?? null,
          image: context.frameDataUrl ?? undefined
        },
        provider
      ).then((response) => {
        if (closed) {
          return;
        }
        if (response.safety !== "allowed") {
          emit({
            type: "safetyIntercept",
            safety: response.safety,
            content: response.content,
            banner: response.banner,
            actions: response.actions ?? []
          });
          status = "listening";
          emit({ type: "status", status: "listening" });
          return;
        }
        status = "speaking";
        emit({ type: "assistantTranscript", text: response.content, final: true });
        emit({ type: "status", status: "speaking" });
        speak(response.content);
        status = "listening";
        emit({ type: "status", status: "listening" });
      });
    },
    updateInstructions: () => {
      // no-op in the fallback session
    },
    close: () => {
      if (closed) {
        return;
      }
      closed = true;
      status = "closed";
      if (typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined") {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
      emit({ type: "status", status: "closed" });
    },
    getStatus: () => status
  };
}
