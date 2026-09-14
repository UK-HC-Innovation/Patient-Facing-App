import { createOutputTranscriptGuard } from "./output-guard";
import { liveLine } from "./live-strings";
import type { VoiceGateDecision } from "./voice-gate";
import type { LiveSessionEvent, LiveSessionHandle, LiveSessionStatus } from "./types";

/**
 * GPT-Live-1 behind the handle the food doors already use.
 *
 * What is different from Realtime, and why this file looks the way it does:
 *
 * - GPT-Live decides when to speak. There is no `create_response: false`, no `response.create`,
 *   no `response.cancel` and no `output_audio_buffer.clear`, so nothing can hold a reply until
 *   the safety gate has read the transcript. The owner chose speed over a playback hold on
 *   2026-09-13. The input gate and the output guard run as a kill switch instead: they read the
 *   transcript as it streams and, on a trip, mute the audio element, close the session and show
 *   the refusal or crisis card. Part of an answer can be heard before the cut.
 * - Transcripts arrive as fragments with no turn-completed event, so turns are grouped here.
 * - No images. The camera frame stays with the identify route; GPT-Live gets text facts.
 * - Client delegation. A question about a food or a score comes back to the app, which answers
 *   from the deterministic lookups.
 * - Billing runs per second while the session is open, silence included, so the session closes
 *   itself after a minute with nobody talking, and after five minutes regardless.
 */

export type LiveServerEvent = { type: string; [key: string]: unknown };

type SafetyIntercept = Extract<LiveSessionEvent, { type: "safetyIntercept" }>;
type GateIntercept = Extract<VoiceGateDecision, { kind: "intercept" }>;
type TimerHandle = ReturnType<typeof setTimeout>;

/** Input fragments further apart than this on the session timeline start a new turn. */
export const TURN_GAP_MS = 1500;
/**
 * How long a tripping partial transcript must stand before it cuts the voice.
 *
 * The gate reads partial sentences, because GPT-Live never says a turn is finished. "what's
 * the point" trips the crisis gate on its own and passes once "of the carb count on this
 * label" arrives. Waiting this long for the next fragment keeps every pass line in the corpus
 * passing. The model starting to answer ends the wait at once.
 */
export const INTERCEPT_SETTLE_MS = 500;
/**
 * Output that starts this long after the person's last fragment is the model taking a turn.
 * Sooner than that it is talking over them, and a pending intercept keeps waiting.
 */
export const TURN_TAKING_QUIET_MS = 300;
/** An assistant turn with no new fragment for this long is finished. */
export const ASSISTANT_QUIET_MS = 1200;
/** Nobody has spoken for a minute: close, because GPT-Live bills the silence. */
export const IDLE_CLOSE_MS = 60_000;
/** Hard ceiling per session, about $0.25 at $0.05 a minute. */
export const MAX_SESSION_MS = 5 * 60_000;
/** An append is capped at 500 tokens. This stays well under it for any tokenizer. */
export const MAX_APPEND_CHARS = 1500;
const CONNECT_TIMEOUT_MS = 10_000;
const CLOSE_GRACE_MS = 2_000;
const TICK_MS = 1_000;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Cuts at the last sentence that fits, so a cut never ends mid-number. */
export function fitAppendContent(text: string, max = MAX_APPEND_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const boundary = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"));
  return (boundary > max / 2 ? cut.slice(0, boundary + 1) : cut).trim();
}

export type StreamingInputGate = {
  /** Feed the whole current turn each time a fragment lands. */
  observe(turnText: string): void;
  /** The model started a turn of its own: a pending intercept fires now. */
  flush(): void;
  /** A finished turn, checked once and fired at once. True when it intercepted. */
  check(turnText: string): boolean;
  dispose(): void;
};

export function createStreamingInputGate(args: {
  gate: (text: string) => VoiceGateDecision;
  onIntercept: (decision: GateIntercept) => void;
  settleMs?: number;
}): StreamingInputGate {
  const settleMs = args.settleMs ?? INTERCEPT_SETTLE_MS;
  let pending: GateIntercept | null = null;
  let timer: TimerHandle | null = null;
  let fired = false;

  const disarm = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const fire = () => {
    if (fired || !pending) return;
    fired = true;
    disarm();
    const decision = pending;
    pending = null;
    args.onIntercept(decision);
  };

  return {
    observe(turnText) {
      if (fired) return;
      const decision = args.gate(turnText);
      disarm();
      if (decision.kind === "pass") {
        pending = null;
        return;
      }
      pending = decision;
      timer = setTimeout(fire, settleMs);
    },
    flush() {
      fire();
    },
    check(turnText) {
      if (fired) return true;
      const decision = args.gate(turnText);
      if (decision.kind === "pass") return false;
      pending = decision;
      fire();
      return true;
    },
    dispose() {
      disarm();
      pending = null;
    }
  };
}

export type TranscriptFragment = { delta: string; startMs: number | null; endMs: number | null; at: number };

export type TurnTracker = {
  /** Adds a fragment. `closed` is the turn this fragment ended by starting a new one. */
  add(fragment: TranscriptFragment): { text: string; closed: string | null };
  /** The model took a turn, so the person's next fragment starts a new one. */
  breakTurn(): void;
  current(): string;
  lastAt(): number | null;
};

export function createTurnTracker(gapMs = TURN_GAP_MS): TurnTracker {
  let text = "";
  let lastEnd: number | null = null;
  let lastAt: number | null = null;
  let broken = false;

  return {
    add(fragment) {
      const gap =
        fragment.startMs !== null && lastEnd !== null
          ? fragment.startMs - lastEnd
          : lastAt !== null
            ? fragment.at - lastAt
            : 0;
      const closed = text.length > 0 && (broken || gap > gapMs) ? text : null;
      text = closed !== null ? fragment.delta : text + fragment.delta;
      broken = false;
      lastEnd = fragment.endMs ?? fragment.startMs ?? lastEnd;
      lastAt = fragment.at;
      return { text, closed };
    },
    breakTurn() {
      broken = true;
    },
    current: () => text,
    lastAt: () => lastAt
  };
}

export type LiveDeps = {
  getUserMedia: () => Promise<MediaStream>;
  createPeerConnection: () => RTCPeerConnection;
  createAudioElement: () => HTMLAudioElement;
  fetch: typeof fetch;
  now: () => number;
};

export type LiveConnectArgs = {
  instructions: string;
  language: "en" | "es";
  patientId: string;
  passcode?: string;
  nonce: string;
  /** The current food facts, as quiet context. Sent again whenever they change. */
  buildFacts: () => string | null;
  /** What to say when the camera names a food before the person has spoken. */
  buildOpeningLine: () => string | null;
  /** The app's answer to a delegated turn. It does not reject; it falls back to a fixed line. */
  answerDelegation: (turnText: string) => Promise<string>;
  gateTranscript: (transcript: string) => VoiceGateDecision;
  onEvent: (event: LiveSessionEvent) => void;
  deps?: Partial<LiveDeps>;
};

function defaultDeps(): LiveDeps {
  return {
    getUserMedia: () => navigator.mediaDevices.getUserMedia({ audio: true }),
    createPeerConnection: () => new RTCPeerConnection(),
    createAudioElement: () => {
      const element = document.createElement("audio");
      element.autoplay = true;
      return element;
    },
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now()
  };
}

export async function connectLiveSession(args: LiveConnectArgs): Promise<LiveSessionHandle> {
  const deps: LiveDeps = { ...defaultDeps(), ...args.deps };

  let status: LiveSessionStatus = "connecting";
  let started = false;
  let startedAt = 0;
  let lastActivityAt = deps.now();
  let closing = false;
  let finished = false;
  let latched = false;
  let openingPending = false;
  let lastFacts: string | null = null;
  let eventCount = 0;
  let errorShown = false;
  let openDelegations = 0;
  let userTurnShown = false;
  let assistantOpen = false;
  let assistantText = "";

  let micStream: MediaStream | null = null;
  let peer: RTCPeerConnection | null = null;
  let channel: RTCDataChannel | null = null;
  let audioEl: HTMLAudioElement | null = null;

  let startTimer: TimerHandle | null = null;
  let closeTimer: TimerHandle | null = null;
  let quietTimer: TimerHandle | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  const emit = (event: LiveSessionEvent) => {
    if (!finished) args.onEvent(event);
  };

  const setStatus = (next: LiveSessionStatus) => {
    if (status === next || finished) return;
    status = next;
    args.onEvent({ type: "status", status: next });
  };

  const send = (payload: Record<string, unknown>) => {
    if (!channel || channel.readyState !== "open") return;
    eventCount += 1;
    channel.send(JSON.stringify({ event_id: `pc_${eventCount}`, ...payload }));
  };

  const silence = () => {
    if (audioEl) audioEl.muted = true;
  };

  const clearTimers = () => {
    for (const timer of [startTimer, closeTimer, quietTimer]) {
      if (timer !== null) clearTimeout(timer);
    }
    startTimer = null;
    closeTimer = null;
    quietTimer = null;
    if (tickTimer !== null) clearInterval(tickTimer);
    tickTimer = null;
  };

  /** Tears everything down. `announce` is false after a fatal error, which says it already. */
  const finish = (announce: boolean) => {
    if (finished) return;
    clearTimers();
    inputGate.dispose();
    micStream?.getTracks().forEach((track) => track.stop());
    try {
      channel?.close();
    } catch {
      // ignore
    }
    try {
      peer?.close();
    } catch {
      // ignore
    }
    if (audioEl) {
      audioEl.muted = true;
      try {
        audioEl.pause();
      } catch {
        // ignore
      }
      audioEl.srcObject = null;
    }
    status = "closed";
    if (announce) args.onEvent({ type: "status", status: "closed" });
    finished = true;
  };

  const fail = (message: string) => {
    if (finished) return;
    emit({ type: "error", message, fatal: true });
    finish(false);
  };

  /** Ends the session as OpenAI asks: `session.close`, then wait for `session.closed`. */
  const requestClose = () => {
    if (closing || finished) return;
    closing = true;
    silence();
    micStream?.getTracks().forEach((track) => track.stop());
    if (!started) {
      finish(true);
      return;
    }
    send({ type: "session.close" });
    closeTimer = setTimeout(() => finish(true), CLOSE_GRACE_MS);
  };

  /** The kill switch. Mute first, because that is the one step that takes effect at once. */
  const trip = (event: SafetyIntercept) => {
    if (latched || finished) return;
    latched = true;
    silence();
    if (quietTimer !== null) {
      clearTimeout(quietTimer);
      quietTimer = null;
    }
    emit(event);
    requestClose();
  };

  const inputGate = createStreamingInputGate({
    gate: args.gateTranscript,
    onIntercept: (decision) =>
      trip({
        type: "safetyIntercept",
        safety: decision.safety,
        content: decision.content,
        banner: decision.banner,
        actions: decision.actions
      })
  });

  const outputGuard = createOutputTranscriptGuard({
    language: args.language,
    // GPT-Live accepts no cancel and no buffer clear, so nothing is sent; the remedy mutes.
    send: () => undefined,
    remedy: silence,
    onEvent: (event) => {
      if (event.type === "safetyIntercept") trip(event);
    }
  });

  const turns = createTurnTracker();

  const refreshFacts = () => {
    if (!started || latched || closing || finished) return;
    const facts = args.buildFacts();
    if (!facts) return;
    const fitted = fitAppendContent(facts);
    if (fitted.length === 0 || fitted === lastFacts) return;
    lastFacts = fitted;
    send({ type: "session.thinking.append", delegation_id: null, content: fitted });
  };

  const flushOpening = () => {
    if (!openingPending || !started || latched || closing || finished) return;
    openingPending = false;
    refreshFacts();
    const line = args.buildOpeningLine();
    if (line) {
      send({ type: "session.commentary.append", delegation_id: null, content: fitAppendContent(line) });
    }
  };

  const showUserTurn = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length > 0) emit({ type: "userTranscript", text: trimmed, final: true });
  };

  const closeUserTurn = () => {
    const current = turns.current();
    if (userTurnShown || current.trim().length === 0) return;
    userTurnShown = true;
    showUserTurn(current);
  };

  const endAssistantTurn = () => {
    quietTimer = null;
    if (!assistantOpen || latched || finished) return;
    assistantOpen = false;
    emit({ type: "assistantTranscript", text: assistantText, final: true });
    assistantText = "";
    outputGuard.reset();
    setStatus(openDelegations > 0 ? "thinking" : "listening");
  };

  const onStarted = () => {
    if (started) return;
    started = true;
    startedAt = deps.now();
    lastActivityAt = startedAt;
    if (startTimer !== null) {
      clearTimeout(startTimer);
      startTimer = null;
    }
    setStatus("listening");
    refreshFacts();
    flushOpening();
    tickTimer = setInterval(() => {
      if (closing || finished) return;
      const now = deps.now();
      if (now - startedAt >= MAX_SESSION_MS || now - lastActivityAt >= IDLE_CLOSE_MS) {
        requestClose();
        return;
      }
      refreshFacts();
    }, TICK_MS);
  };

  const onInputDelta = (event: LiveServerEvent) => {
    const delta = str(event.delta);
    if (delta.length === 0) return;
    const now = deps.now();
    lastActivityAt = now;
    const { text, closed } = turns.add({
      delta,
      startMs: num(event.start_ms),
      endMs: num(event.end_ms),
      at: now
    });
    if (closed !== null) {
      if (!userTurnShown) showUserTurn(closed);
      userTurnShown = false;
    }
    inputGate.observe(text);
  };

  const onOutputDelta = (event: LiveServerEvent) => {
    const delta = str(event.delta);
    if (delta.length === 0) return;
    const now = deps.now();
    lastActivityAt = now;
    const lastInputAt = turns.lastAt();
    if (lastInputAt === null || now - lastInputAt >= TURN_TAKING_QUIET_MS) {
      // The model is taking a turn of its own. A pending intercept stops waiting, and what the
      // person said is finished enough to show.
      inputGate.flush();
      if (latched) return;
      closeUserTurn();
      turns.breakTurn();
    }
    outputGuard.observeDelta(delta);
    // A fragment that tripped the guard never reaches the screen.
    if (latched) return;
    if (!assistantOpen) {
      assistantOpen = true;
      assistantText = "";
    }
    assistantText += delta;
    setStatus("speaking");
    emit({ type: "assistantTranscript", text: delta, final: false });
    if (quietTimer !== null) clearTimeout(quietTimer);
    quietTimer = setTimeout(endAssistantTurn, ASSISTANT_QUIET_MS);
  };

  const onDelegation = (event: LiveServerEvent) => {
    const delegation = event.delegation;
    const id =
      delegation && typeof delegation === "object" && "id" in delegation
        ? str((delegation as { id: unknown }).id)
        : "";
    if (id.length === 0) return;
    lastActivityAt = deps.now();
    const turnText = turns.current();
    closeUserTurn();
    // The words that led here are read once more, whole, before anything answers them.
    if (inputGate.check(turnText)) return;
    openDelegations += 1;
    if (!assistantOpen) setStatus("thinking");
    refreshFacts();
    void args
      .answerDelegation(turnText)
      .catch(() => liveLine(args.language, "couldNotCheck"))
      .then((answer) => {
        openDelegations = Math.max(0, openDelegations - 1);
        if (latched || closing || finished) return;
        // A refinement can change the food on screen. The facts go first, then the answer.
        refreshFacts();
        send({ type: "session.commentary.append", delegation_id: id, content: fitAppendContent(answer) });
        if (!assistantOpen && openDelegations === 0) setStatus("listening");
      });
  };

  const onServerError = (event: LiveServerEvent) => {
    if (errorShown) return;
    errorShown = true;
    const error = event.error;
    const message =
      error && typeof error === "object" && "message" in error ? str((error as { message: unknown }).message) : "";
    emit({ type: "error", message: message || "Voice error", fatal: false });
  };

  const onMessage = (raw: unknown) => {
    if (finished) return;
    let event: LiveServerEvent;
    try {
      event = JSON.parse(str(raw)) as LiveServerEvent;
    } catch {
      return;
    }
    if (!event || typeof event.type !== "string") return;
    if (event.type === "session.closed") {
      // Closed from OpenAI's side: expired, a content stop, or a dropped line.
      if (!closing && !latched) {
        emit({ type: "error", message: "The voice session ended.", fatal: false });
      }
      finish(true);
      return;
    }
    if (latched) return;
    switch (event.type) {
      case "session.started":
        onStarted();
        break;
      case "session.input_transcript.delta":
        onInputDelta(event);
        break;
      case "session.output_transcript.delta":
        onOutputDelta(event);
        break;
      case "session.delegation.created":
        onDelegation(event);
        break;
      case "error":
        onServerError(event);
        break;
      default:
        break;
    }
  };

  emit({ type: "status", status: "connecting" });

  const stream = await deps.getUserMedia();
  micStream = stream;
  const connection = deps.createPeerConnection();
  peer = connection;
  audioEl = deps.createAudioElement();

  connection.ontrack = (event) => {
    if (audioEl) audioEl.srcObject = event.streams[0] ?? null;
  };
  connection.onconnectionstatechange = () => {
    if (connection.connectionState === "failed" || connection.connectionState === "disconnected") {
      if (closing || latched) {
        finish(true);
      } else {
        fail("The voice connection dropped.");
      }
    }
  };
  stream.getTracks().forEach((track) => connection.addTrack(track, stream));
  const events = connection.createDataChannel("oai-events");
  channel = events;
  events.onmessage = (message) => onMessage(message.data);

  const offer = await connection.createOffer();
  await connection.setLocalDescription(offer);

  const abort = new AbortController();
  const abortTimer = setTimeout(() => abort.abort(), CONNECT_TIMEOUT_MS);
  const response = await deps
    .fetch("/api/live/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-realtime-nonce": args.nonce },
      body: JSON.stringify({
        sdp: offer.sdp,
        instructions: args.instructions,
        language: args.language,
        patientId: args.patientId,
        crisisOpen: false,
        passcode: args.passcode
      }),
      signal: abort.signal
    })
    .catch(() => null);
  const answer =
    response && response.ok
      ? ((await response.json().catch(() => null)) as { mode?: unknown; sdp?: unknown } | null)
      : null;
  clearTimeout(abortTimer);

  if (!answer || answer.mode !== "live" || typeof answer.sdp !== "string") {
    fail("Could not start the voice session.");
    throw new Error("live_connect_failed");
  }

  await connection.setRemoteDescription({ type: "answer", sdp: answer.sdp });
  startTimer = setTimeout(() => {
    startTimer = null;
    if (!started) fail("Could not start the voice session.");
  }, CONNECT_TIMEOUT_MS);

  return {
    sendUserText: () => {
      // Typed lines never enter a GPT-Live session. Client delegation has no documented event
      // for a typed user turn, and the hook sends typed questions down the text path, which runs
      // the full safety and grounding chain.
    },
    requestContextResponse: () => {
      if (latched || closing || finished) return;
      openingPending = true;
      flushOpening();
    },
    updateInstructions: (instructions: string) => {
      if (!started || latched || closing || finished) return;
      // Instructions are fixed once a GPT-Live session starts. Appending is the only way in.
      send({ type: "session.instructions.append", delegation_id: null, content: fitAppendContent(instructions) });
    },
    close: () => requestClose(),
    getStatus: () => status
  };
}
