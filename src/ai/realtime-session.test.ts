import { describe, expect, it, vi } from "vitest";
import {
  IDLE_TURN_STATE,
  REALTIME_SESSION_CONFIG,
  reduceTurnRecovery,
  applyTranscriptGate,
  contextResponsePayloads,
  createTranscriptGateLatch,
  reduceRealtimeEvent,
  waitForTranscriptPreparation
} from "./realtime-session";
import type { LiveSessionEvent } from "./types";
import type { VoiceGateDecision } from "./voice-gate";

describe("reduceRealtimeEvent", () => {
  it("moves from connecting to listening on session.updated", () => {
    const result = reduceRealtimeEvent("connecting", { type: "session.updated" });
    expect(result.status).toBe("listening");
    expect(result.emits).toContainEqual({ type: "status", status: "listening" });
  });

  it("injects context on speech start and stays listening", () => {
    const result = reduceRealtimeEvent("listening", { type: "input_audio_buffer.speech_started" });
    expect(result.status).toBe("listening");
    expect(result.actions).toContain("injectContext");
  });

  it("injects context on barge-in while speaking", () => {
    const result = reduceRealtimeEvent("speaking", { type: "input_audio_buffer.speech_started" });
    expect(result.status).toBe("listening");
    expect(result.actions).toContain("injectContext");
  });

  it("moves to thinking on speech stop", () => {
    const result = reduceRealtimeEvent("listening", { type: "input_audio_buffer.speech_stopped" });
    expect(result.status).toBe("thinking");
  });

  it("emits a final user transcript", () => {
    const result = reduceRealtimeEvent("thinking", {
      type: "conversation.item.input_audio_transcription.completed",
      transcript: "Can I eat this?"
    });
    expect(result.emits).toContainEqual({ type: "userTranscript", text: "Can I eat this?", final: true });
  });

  it("moves to speaking when audio output starts", () => {
    const result = reduceRealtimeEvent("thinking", { type: "output_audio_buffer.started" });
    expect(result.status).toBe("speaking");
  });

  it("emits partial then final assistant transcripts", () => {
    const partial = reduceRealtimeEvent("speaking", { type: "response.output_audio_transcript.delta", delta: "That soup" });
    expect(partial.emits).toContainEqual({ type: "assistantTranscript", text: "That soup", final: false });

    const done = reduceRealtimeEvent("speaking", { type: "response.output_audio_transcript.done", transcript: "That soup is salty." });
    expect(done.emits).toContainEqual({ type: "assistantTranscript", text: "That soup is salty.", final: true });
  });

  it("returns to listening when the response is done", () => {
    expect(reduceRealtimeEvent("speaking", { type: "response.done" }).status).toBe("listening");
    expect(reduceRealtimeEvent("speaking", { type: "output_audio_buffer.stopped" }).status).toBe("listening");
  });

  it("emits a non-fatal error", () => {
    const result = reduceRealtimeEvent("listening", { type: "error", error: { message: "rate limited" } });
    expect(result.emits).toContainEqual({ type: "error", message: "rate limited", fatal: false });
  });

  it("ignores unknown events", () => {
    const result = reduceRealtimeEvent("listening", { type: "something.else" });
    expect(result).toEqual({ status: "listening", emits: [], actions: [] });
  });
});

describe("REALTIME_SESSION_CONFIG", () => {
  it("pins server VAD auto-response OFF so classify-before-respond is possible", () => {
    expect(REALTIME_SESSION_CONFIG.audio.input.turn_detection.create_response).toBe(false);
    expect(REALTIME_SESSION_CONFIG.audio.input.turn_detection.type).toBe("server_vad");
  });
});

describe("contextResponsePayloads", () => {
  it("injects camera context before requesting the proactive assistant response", () => {
    expect(
      contextResponsePayloads({ text: "[camera context] Banana, raw · score 83", imageDataUrl: "data:image/jpeg;base64,abc" })
    ).toEqual([
      {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            { type: "input_image", image_url: "data:image/jpeg;base64,abc" },
            { type: "input_text", text: "[camera context] Banana, raw · score 83" }
          ]
        }
      },
      { type: "response.create" }
    ]);
  });

  it("does not ask the assistant to speak without camera context", () => {
    expect(contextResponsePayloads(null)).toEqual([]);
  });
});

describe("waitForTranscriptPreparation", () => {
  it("lets a completed deterministic refinement proceed", async () => {
    const prepare = vi.fn().mockResolvedValue(undefined);
    await expect(waitForTranscriptPreparation(prepare, "pepperoni", 100)).resolves.toBe("ready");
    expect(prepare).toHaveBeenCalledWith("pepperoni");
  });

  it("bounds a hung refinement so the voice turn can recover", async () => {
    vi.useFakeTimers();
    try {
      const result = waitForTranscriptPreparation(() => new Promise<void>(() => undefined), "Papa John's", 100);
      await vi.advanceTimersByTimeAsync(100);
      await expect(result).resolves.toBe("unavailable");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("applyTranscriptGate", () => {
  function harness() {
    const sends: unknown[] = [];
    const events: LiveSessionEvent[] = [];
    return {
      sends,
      events,
      send: (payload: unknown) => sends.push(payload),
      onEvent: (event: LiveSessionEvent) => events.push(event)
    };
  }

  it("creates a response when the gate passes", () => {
    const { sends, events, send, onEvent } = harness();

    applyTranscriptGate({ kind: "pass" }, send, onEvent);

    expect(sends).toEqual([{ type: "response.create" }]);
    expect(events).toEqual([]);
  });

  it("cancels, clears audio, and emits an intercept on a crisis gate — never creating a response", () => {
    const { sends, events, send, onEvent } = harness();
    const decision: VoiceGateDecision = {
      kind: "intercept",
      safety: "crisis",
      content: "Please reach out now.",
      actions: ["crisis_call_988"]
    };

    applyTranscriptGate(decision, send, onEvent);

    expect(sends).toEqual([{ type: "response.cancel" }, { type: "output_audio_buffer.clear" }]);
    expect(sends).not.toContainEqual({ type: "response.create" });
    expect(events).toContainEqual({
      type: "safetyIntercept",
      safety: "crisis",
      content: "Please reach out now.",
      banner: undefined,
      actions: ["crisis_call_988"]
    });
  });

  it("fails closed: an intercepted turn produces no spoken-answer trigger", () => {
    const { sends, send, onEvent } = harness();
    // Without a passing decision there is never a response.create, so no answer
    // is ever spoken for that turn — the same guarantee the fail-closed timer
    // enforces when a transcript never arrives.
    applyTranscriptGate(
      { kind: "intercept", safety: "blocked", content: "x", actions: [], banner: "b" },
      send,
      onEvent
    );

    expect(sends).not.toContainEqual({ type: "response.create" });
  });
});

describe("createTranscriptGateLatch", () => {
  it("never creates another response after an intercept on the same connection", () => {
    const sends: unknown[] = [];
    const events: LiveSessionEvent[] = [];
    const gate = createTranscriptGateLatch(
      (payload) => sends.push(payload),
      (event) => events.push(event)
    );

    gate.apply({ kind: "intercept", safety: "blocked", content: "Stop.", actions: [] });
    gate.apply({ kind: "pass" });

    expect(gate.isLatched()).toBe(true);
    expect(sends).toEqual([{ type: "response.cancel" }, { type: "output_audio_buffer.clear" }]);
    expect(sends).not.toContainEqual({ type: "response.create" });
    expect(events).toHaveLength(1);
  });

  it("can be latched by an output intercept before another input turn", () => {
    const sends: unknown[] = [];
    const gate = createTranscriptGateLatch(
      (payload) => sends.push(payload),
      () => undefined
    );

    gate.latch();
    gate.apply({ kind: "pass" });

    expect(sends).toEqual([]);
  });
});

describe("reduceTurnRecovery", () => {
  // The critique's H2: three turns in, every persona got half a sentence and a
  // permanent "Thinking...". Server VAD interrupts the answer, the transcription of
  // that noise is empty, and no response is ever created for the turn.
  const streaming = () => {
    let state = IDLE_TURN_STATE;
    state = reduceTurnRecovery(state, { type: "response.created" }).state;
    state = reduceTurnRecovery(state, {
      type: "response.output_audio_transcript.delta",
      delta: "I can't confirm 45 grams of carbs for"
    }).state;
    return state;
  };

  it("hands the turn back when the transcription is empty", () => {
    const result = reduceTurnRecovery(streaming(), {
      type: "conversation.item.input_audio_transcription.completed",
      transcript: "   "
    });

    expect(result.emits).toContainEqual({ type: "assistantTranscript", text: "", final: true, truncated: true });
    expect(result.emits).toContainEqual({ type: "status", status: "listening" });
    expect(result.state).toEqual(IDLE_TURN_STATE);
  });

  it("leaves a real transcription alone", () => {
    const state = streaming();
    const result = reduceTurnRecovery(state, {
      type: "conversation.item.input_audio_transcription.completed",
      transcript: "is 45 carbs right"
    });

    expect(result.emits).toEqual([]);
    expect(result.state).toEqual(state);
  });

  it("labels an answer a barge-in cut off", () => {
    const result = reduceTurnRecovery(streaming(), { type: "input_audio_buffer.speech_started" });
    expect(result.emits).toEqual([{ type: "assistantTranscript", text: "", final: true, truncated: true }]);
  });

  it("labels a cancelled response", () => {
    const result = reduceTurnRecovery(streaming(), { type: "response.done", response: { status: "cancelled" } });
    expect(result.emits).toEqual([{ type: "assistantTranscript", text: "", final: true, truncated: true }]);
  });

  it("says nothing about a response that finished", () => {
    const state = reduceTurnRecovery(streaming(), { type: "response.output_audio_transcript.done" }).state;
    expect(reduceTurnRecovery(state, { type: "response.done", response: { status: "completed" } }).emits).toEqual([]);
  });

  it("does not invent a partial for a turn that never spoke", () => {
    const state = reduceTurnRecovery(IDLE_TURN_STATE, { type: "response.created" }).state;
    expect(reduceTurnRecovery(state, { type: "input_audio_buffer.speech_started" }).emits).toEqual([]);
  });
});
