import { describe, expect, it } from "vitest";
import {
  REALTIME_SESSION_CONFIG,
  applyTranscriptGate,
  createTranscriptGateLatch,
  reduceRealtimeEvent
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
