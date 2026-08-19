import { createRealtimeVoiceMetricsRecorder } from "./realtime-voice-metrics";
import { createOutputTranscriptGuard } from "./output-guard";
import type { VoiceGateDecision } from "./voice-gate";
import type {
  LiveSessionEvent,
  LiveSessionHandle,
  LiveSessionStatus
} from "./types";

export type RealtimeServerEvent = { type: string; [key: string]: unknown };

// Load-bearing: create_response is FALSE so the model never speaks on its own.
// Every turn waits for an explicit response.create that we send only after the
// transcript clears the safety gate. With auto-response on, classify-before-
// respond would be impossible.
export const REALTIME_SESSION_CONFIG = {
  type: "realtime",
  audio: {
    input: {
      transcription: { model: "gpt-4o-mini-transcribe" },
      turn_detection: { type: "server_vad", create_response: false, interrupt_response: true }
    }
  }
} as const;

// A final transcript that never arrives must fail closed: after this window with
// no transcription.completed we never create a response for that turn.
const TRANSCRIPT_FAIL_CLOSED_MS = 4000;

// Turns a gate decision into realtime control messages. On pass we create the
// response; on intercept we cancel any in-flight response, clear buffered output
// audio, and surface the intercept instead of a spoken answer.
export function applyTranscriptGate(
  decision: VoiceGateDecision,
  send: (payload: unknown) => void,
  onEvent: (event: LiveSessionEvent) => void
): void {
  if (decision.kind === "pass") {
    send({ type: "response.create" });
    return;
  }

  send({ type: "response.cancel" });
  send({ type: "output_audio_buffer.clear" });
  onEvent({
    type: "safetyIntercept",
    safety: decision.safety,
    content: decision.content,
    banner: decision.banner,
    actions: decision.actions
  });
}

// A safety intercept is terminal for one realtime connection. Requiring a new
// connection before another response can be created prevents a later benign
// transcript (or a queued event) from reopening a session whose audio was just
// cancelled for safety.
export function createTranscriptGateLatch(
  send: (payload: unknown) => void,
  onEvent: (event: LiveSessionEvent) => void
): {
  apply: (decision: VoiceGateDecision) => void;
  latch: () => void;
  isLatched: () => boolean;
} {
  let latched = false;

  return {
    apply(decision): void {
      if (latched) return;
      if (decision.kind === "intercept") latched = true;
      applyTranscriptGate(decision, send, onEvent);
    },
    latch(): void {
      latched = true;
    },
    isLatched(): boolean {
      return latched;
    }
  };
}

export type RealtimeReduction = {
  status: LiveSessionStatus;
  emits: LiveSessionEvent[];
  actions: Array<"injectContext">;
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function reduceRealtimeEvent(status: LiveSessionStatus, event: RealtimeServerEvent): RealtimeReduction {
  switch (event.type) {
    case "session.updated":
      if (status === "connecting") {
        return { status: "listening", emits: [{ type: "status", status: "listening" }], actions: [] };
      }
      return { status, emits: [], actions: [] };
    case "input_audio_buffer.speech_started":
      return { status: "listening", emits: [{ type: "status", status: "listening" }], actions: ["injectContext"] };
    case "input_audio_buffer.speech_stopped":
      return { status: "thinking", emits: [{ type: "status", status: "thinking" }], actions: [] };
    case "conversation.item.input_audio_transcription.completed":
      return {
        status,
        emits: [{ type: "userTranscript", text: str(event.transcript), final: true }],
        actions: []
      };
    case "response.created":
      return {
        status: "thinking",
        emits: status === "thinking" ? [] : [{ type: "status", status: "thinking" }],
        actions: []
      };
    case "output_audio_buffer.started":
      return { status: "speaking", emits: [{ type: "status", status: "speaking" }], actions: [] };
    case "response.output_audio_transcript.delta":
      return {
        status: "speaking",
        emits: [{ type: "assistantTranscript", text: str(event.delta), final: false }],
        actions: []
      };
    case "response.output_audio_transcript.done":
      return {
        status,
        emits: [{ type: "assistantTranscript", text: str(event.transcript), final: true }],
        actions: []
      };
    case "response.done":
    case "output_audio_buffer.stopped":
      return { status: "listening", emits: [{ type: "status", status: "listening" }], actions: [] };
    case "error": {
      const error = event.error;
      const message = error && typeof error === "object" && "message" in error ? str((error as { message: unknown }).message) : "Realtime error";
      return { status, emits: [{ type: "error", message, fatal: false }], actions: [] };
    }
    default:
      return { status, emits: [], actions: [] };
  }
}

/**
 * A function the model may call mid-turn. The handler runs locally and returns
 * deterministic data; the model is never asked to compute anything, only to ask for a
 * number it does not have. Whatever it then says still passes the output guard.
 */
export type RealtimeTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
};

export type ConnectArgs = {
  clientSecret: string;
  model: string;
  instructions: string;
  language: "en" | "es";
  buildContextMessage: () => { text: string; imageDataUrl?: string | null } | null;
  onEvent: (event: LiveSessionEvent) => void;
  gateTranscript: (transcript: string) => VoiceGateDecision;
  tools?: RealtimeTool[];
};

/**
 * Runs one tool call and returns the two realtime events that answer it: the output item
 * and the response.create that lets the model speak the result. Pure enough to test
 * without a peer connection.
 */
export async function runRealtimeToolCall(
  tools: RealtimeTool[],
  event: RealtimeServerEvent
): Promise<Array<Record<string, unknown>>> {
  const name = str(event.name);
  const callId = str(event.call_id);
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool || callId.length === 0) {
    return [];
  }

  let parsed: Record<string, unknown> = {};
  try {
    const raw = JSON.parse(str(event.arguments) || "{}") as unknown;
    if (raw && typeof raw === "object") {
      parsed = raw as Record<string, unknown>;
    }
  } catch {
    parsed = {};
  }

  let output: unknown;
  try {
    output = await tool.handler(parsed);
  } catch {
    // The model must never fill the gap with an invented number.
    output = { error: "lookup_failed" };
  }

  return [
    {
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: callId, output: JSON.stringify(output) }
    },
    { type: "response.create" }
  ];
}

const CONNECT_TIMEOUT_MS = 10000;
const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export async function connectRealtimeSession(args: ConnectArgs): Promise<LiveSessionHandle> {
  let status: LiveSessionStatus = "connecting";
  let closed = false;
  const metrics = createRealtimeVoiceMetricsRecorder();
  let failClosedTimer: ReturnType<typeof setTimeout> | null = null;
  let outputIntercepted = false;

  const clearFailClosedTimer = () => {
    if (failClosedTimer) {
      clearTimeout(failClosedTimer);
      failClosedTimer = null;
    }
  };

  args.onEvent({ type: "status", status: "connecting" });

  const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const pc = new RTCPeerConnection();
  const audioEl = document.createElement("audio");
  audioEl.autoplay = true;

  const cleanup = () => {
    micStream.getTracks().forEach((track) => track.stop());
    try {
      pc.close();
    } catch {
      // ignore
    }
    audioEl.pause();
    audioEl.srcObject = null;
  };

  const fail = (message: string) => {
    if (closed) {
      return;
    }
    closed = true;
    status = "error";
    cleanup();
    args.onEvent({ type: "error", message, fatal: true });
  };

  pc.ontrack = (event) => {
    audioEl.srcObject = event.streams[0];
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
      fail("The voice connection dropped.");
    }
  };

  micStream.getTracks().forEach((track) => pc.addTrack(track, micStream));
  const channel = pc.createDataChannel("oai-events");

  const send = (payload: unknown) => {
    if (channel.readyState === "open") {
      channel.send(JSON.stringify(payload));
    }
  };

  const transcriptGate = createTranscriptGateLatch(send, args.onEvent);

  const outputGuard = createOutputTranscriptGuard({
    language: args.language,
    send: (event) => send(event),
    onEvent: (event) => {
      outputIntercepted = true;
      transcriptGate.latch();
      args.onEvent(event);
    }
  });

  const injectContext = () => {
    const context = args.buildContextMessage();
    if (!context) return;
    const content: Array<Record<string, unknown>> = [];
    if (context.imageDataUrl) {
      content.push({ type: "input_image", image_url: context.imageDataUrl });
    }
    content.push({ type: "input_text", text: context.text });
    send({ type: "conversation.item.create", item: { type: "message", role: "user", content } });
  };

  channel.onmessage = (message) => {
    metrics.observeServerEvent(message.data);

    if (closed) return;

    let event: RealtimeServerEvent;
    try {
      event = JSON.parse(message.data) as RealtimeServerEvent;
    } catch {
      return;
    }
    if (transcriptGate.isLatched()) return;
    if (event.type === "response.created") {
      outputGuard.reset();
      outputIntercepted = false;
    }
    // Observe generated text before publishing the same delta. If this delta
    // trips the output guard, none of it reaches the consuming hook.
    if (event.type === "response.output_audio_transcript.delta") {
      outputGuard.observeDelta(str(event.delta));
      if (transcriptGate.isLatched()) return;
    }
    const reduction = reduceRealtimeEvent(status, event);
    status = reduction.status;
    reduction.emits.forEach((emitted) => {
      if (!(outputIntercepted && emitted.type === "assistantTranscript")) {
        args.onEvent(emitted);
      }
    });
    if (reduction.actions.includes("injectContext")) {
      injectContext();
    }

    if (event.type === "input_audio_buffer.speech_stopped") {
      // Arm the fail-closed watchdog: if no final transcript lands, this turn
      // never gets a response.create.
      clearFailClosedTimer();
      failClosedTimer = setTimeout(() => {
        failClosedTimer = null;
        if (!closed) {
          args.onEvent({ type: "error", message: "I didn't catch that — please try again.", fatal: false });
        }
      }, TRANSCRIPT_FAIL_CLOSED_MS);
    }

    if (event.type === "conversation.item.input_audio_transcription.completed") {
      clearFailClosedTimer();
      const transcript = str(event.transcript);
      if (transcript.trim().length > 0) {
        transcriptGate.apply(args.gateTranscript(transcript));
      }
    }
    if (event.type === "response.function_call_arguments.done" && (args.tools ?? []).length > 0) {
      void runRealtimeToolCall(args.tools ?? [], event).then((payloads) => {
        if (closed || transcriptGate.isLatched()) {
          return;
        }
        payloads.forEach(send);
      });
    }

    if (event.type === "response.done") {
      outputGuard.reset();
      outputIntercepted = false;
    }
  };

  channel.onopen = () => {
    const tools = (args.tools ?? []).map((tool) => ({
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
    send({
      type: "session.update",
      session: {
        ...REALTIME_SESSION_CONFIG,
        instructions: args.instructions,
        ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {})
      }
    });
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const response = await fetch(`${REALTIME_CALLS_URL}?model=${encodeURIComponent(args.model)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.clientSecret}`,
      "Content-Type": "application/sdp"
    },
    body: offer.sdp,
    signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS)
  }).catch(() => null);

  if (!response || !response.ok) {
    fail("Could not start the voice session.");
    throw new Error("realtime_connect_failed");
  }

  const answer = await response.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answer });

  return {
    sendUserText: (text: string) => {
      if (closed || transcriptGate.isLatched()) return;
      const decision = args.gateTranscript(text);
      if (decision.kind === "intercept") {
        transcriptGate.apply(decision);
        return;
      }
      // Attach the current camera frame + food context first, so a typed live turn
      // sees the image just like a spoken one does.
      injectContext();
      send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
      // Typed live turns run the same gate as spoken turns before any answer.
      transcriptGate.apply(decision);
    },
    updateInstructions: (instructions: string) => {
      if (closed || transcriptGate.isLatched()) return;
      send({ type: "session.update", session: { type: "realtime", instructions } });
    },
    close: () => {
      if (closed) {
        return;
      }
      closed = true;
      status = "closed";
      clearFailClosedTimer();
      try {
        channel.close();
      } catch {
        // ignore
      }
      cleanup();
      args.onEvent({ type: "status", status: "closed" });
    },
    getStatus: () => status,
    getMetricsReport: () => metrics.report()
  };
}
