import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoState } from "@/domain/fixtures";
import { evaluateVoiceTranscript } from "./voice-gate";
import {
  ASSISTANT_QUIET_MS,
  IDLE_CLOSE_MS,
  INTERCEPT_SETTLE_MS,
  MAX_APPEND_CHARS,
  connectLiveSession,
  createStreamingInputGate,
  createTurnTracker,
  fitAppendContent,
  type LiveConnectArgs
} from "./live-session";
import type { LiveSessionEvent } from "./types";

const gateFor = (language: "en" | "es") => (text: string) => evaluateVoiceTranscript(text, demoState, language);

/** Word by word, the way GPT-Live's fragments arrive, each well inside the settle window. */
function speak(observe: (text: string) => void, sentence: string, stepMs = 150) {
  const words = sentence.split(" ");
  words.forEach((_, index) => {
    observe(words.slice(0, index + 1).join(" "));
    vi.advanceTimersByTime(stepMs);
  });
}

// The spec 30 B0 cases and the four crisis phrases, from src/ai/voice-gate.test.ts.
const INTERCEPTS: Array<[string, "en" | "es"]> = [
  ["how many units for this?", "en"],
  ["how many units should I take for this meal", "en"],
  ["how much insulin should I take for this pizza", "en"],
  ["8 units?", "en"],
  ["so 8 units then", "en"],
  ["can I skip my metformin tonight if I eat light", "en"],
  ["my plan says 1 unit per 10 carbs, what is that for 45", "en"],
  ["I don't want to eat anymore, what's the point", "en"],
  ["my kid ate a whole bag of these", "en"],
  ["¿cuántas unidades para esto?", "es"],
  ["cuántas unidades de insulina me pongo para esto", "es"],
  ["ya no quiero comer más, para qué", "es"],
  ["mi hijo se comió toda la bolsa", "es"]
];

const PASSES: Array<[string, "en" | "es"]> = [
  ["how many calories in this?", "en"],
  ["how many servings in the box?", "en"],
  ["how many carbs are in this?", "en"],
  ["I'm not going to take 8 units for this", "en"],
  ["is 45 carbs right", "en"],
  ["my plan says 1 unit per 10 carbs", "en"],
  ["what's the point of the carb count on this label", "en"],
  ["I don't want to eat cereal again", "en"],
  ["my kid ate a peanut butter sandwich", "en"],
  ["is this soup okay for me?", "en"],
  ["No quiero comer más pan, me llena mucho", "es"]
];

describe("createStreamingInputGate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(INTERCEPTS)("cuts %j by the end of the sentence", (sentence, language) => {
    const onIntercept = vi.fn();
    const gate = createStreamingInputGate({ gate: gateFor(language), onIntercept });

    speak((text) => gate.observe(text), sentence);
    vi.advanceTimersByTime(INTERCEPT_SETTLE_MS);

    expect(onIntercept).toHaveBeenCalledTimes(1);
  });

  it.each(PASSES)("never cuts %j, even where part of the sentence trips", (sentence, language) => {
    const onIntercept = vi.fn();
    const gate = createStreamingInputGate({ gate: gateFor(language), onIntercept });

    speak((text) => gate.observe(text), sentence);
    vi.advanceTimersByTime(INTERCEPT_SETTLE_MS * 4);

    expect(onIntercept).not.toHaveBeenCalled();
  });

  it("cuts a tripping phrase the person stops on, which is the cost of reading fragments", () => {
    const onIntercept = vi.fn();
    const gate = createStreamingInputGate({ gate: gateFor("en"), onIntercept });

    gate.observe("what's the point");
    vi.advanceTimersByTime(INTERCEPT_SETTLE_MS);

    expect(onIntercept).toHaveBeenCalledTimes(1);
  });

  it("stops waiting the moment the model answers, and fires once", () => {
    const onIntercept = vi.fn();
    const gate = createStreamingInputGate({ gate: gateFor("en"), onIntercept });

    gate.observe("how many units for this?");
    gate.flush();
    vi.advanceTimersByTime(INTERCEPT_SETTLE_MS);

    expect(onIntercept).toHaveBeenCalledTimes(1);
  });

  it("checks a finished turn at once", () => {
    const onIntercept = vi.fn();
    const gate = createStreamingInputGate({ gate: gateFor("en"), onIntercept });

    expect(gate.check("is this soup okay for me?")).toBe(false);
    expect(gate.check("how many units for this?")).toBe(true);
    expect(onIntercept).toHaveBeenCalledTimes(1);
  });
});

describe("createTurnTracker", () => {
  it("joins one turn's fragments and starts a new turn after a pause", () => {
    const turns = createTurnTracker();

    expect(turns.add({ delta: "What is", startMs: 1000, endMs: 1200, at: 1 })).toEqual({ text: "What is", closed: null });
    expect(turns.add({ delta: " this", startMs: 1250, endMs: 1400, at: 2 })).toEqual({
      text: "What is this",
      closed: null
    });
    expect(turns.add({ delta: "Peanut butter", startMs: 4000, endMs: 4500, at: 3 })).toEqual({
      text: "Peanut butter",
      closed: "What is this"
    });
  });

  it("starts a new turn after the model has spoken, however short the pause", () => {
    const turns = createTurnTracker();
    turns.add({ delta: "Banana", startMs: 0, endMs: 300, at: 1 });
    turns.breakTurn();

    expect(turns.add({ delta: "What about", startMs: 500, endMs: 700, at: 2 }).closed).toBe("Banana");
  });
});

describe("fitAppendContent", () => {
  it("leaves a short append alone and cuts a long one at a sentence", () => {
    expect(fitAppendContent("  Banana scores 95.  ")).toBe("Banana scores 95.");

    const long = Array.from({ length: 200 }, (_, index) => `Line ${index} is here.`).join(" ");
    const fitted = fitAppendContent(long);

    expect(fitted.length).toBeLessThanOrEqual(MAX_APPEND_CHARS);
    expect(fitted.endsWith(".")).toBe(true);
  });
});

class FakeChannel {
  readyState: RTCDataChannelState = "open";
  sent: Array<Record<string, unknown>> = [];
  onmessage: ((message: { data: string }) => void) | null = null;

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(): void {
    this.readyState = "closed";
  }

  receive(event: Record<string, unknown>): void {
    this.onmessage?.({ data: JSON.stringify(event) });
  }

  types(): unknown[] {
    return this.sent.map((event) => event.type);
  }
}

class FakePeer {
  channel = new FakeChannel();
  ontrack: ((event: { streams: MediaStream[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  connectionState = "new";
  remoteDescription: RTCSessionDescriptionInit | null = null;
  closed = false;

  addTrack(): void {
    // the fake has no media path
  }

  createDataChannel(): FakeChannel {
    return this.channel;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: "v=0\r\nfake-offer\r\n" };
  }

  async setLocalDescription(): Promise<void> {
    // nothing to negotiate
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = description;
  }

  close(): void {
    this.closed = true;
  }
}

const LIVE_ANSWER = { mode: "live", engine: "live", model: "gpt-live-1", sessionId: "live_1", sdp: "v=0\r\nanswer\r\n" };
const FACTS = "Food on screen: Banana, raw. Food Compass score: 95 out of 100 (encourage).";

function harness(overrides: Partial<LiveConnectArgs> = {}, response?: () => Response) {
  const peer = new FakePeer();
  const channel = peer.channel;
  const audio = { muted: false, srcObject: null as unknown, pause: vi.fn() };
  const track = { stop: vi.fn() };
  const events: LiveSessionEvent[] = [];
  const answerDelegation = vi.fn(async () => "Peanut butter scores 43 out of 100.");
  const fetchMock = vi.fn(async () =>
    response ? response() : new Response(JSON.stringify(LIVE_ANSWER), { status: 200 })
  );
  const connecting = connectLiveSession({
    instructions: "Speak briefly.",
    language: "en",
    patientId: "patient-1",
    nonce: "nonce-1",
    buildFacts: () => FACTS,
    buildOpeningLine: () => "Banana, raw scores 95 out of 100.",
    answerDelegation,
    gateTranscript: gateFor("en"),
    onEvent: (event) => events.push(event),
    deps: {
      getUserMedia: async () => ({ getTracks: () => [track] }) as unknown as MediaStream,
      createPeerConnection: () => peer as unknown as RTCPeerConnection,
      createAudioElement: () => audio as unknown as HTMLAudioElement,
      fetch: fetchMock as unknown as typeof fetch
    },
    ...overrides
  });
  return { connecting, peer, channel, audio, track, events, fetchMock, answerDelegation };
}

async function open(overrides: Partial<LiveConnectArgs> = {}) {
  const parts = harness(overrides);
  const handle = await parts.connecting;
  return { ...parts, handle };
}

function heard(channel: FakeChannel, delta: string, startMs: number, endMs: number): void {
  channel.receive({ type: "session.input_transcript.delta", delta, start_ms: startMs, end_ms: endMs });
}

function said(channel: FakeChannel, delta: string): void {
  channel.receive({ type: "session.output_transcript.delta", delta, start_ms: 0, end_ms: 0 });
}

const cuts = (events: LiveSessionEvent[]) => events.filter((event) => event.type === "safetyIntercept");
const shown = (events: LiveSessionEvent[]) =>
  events.flatMap((event) => (event.type === "assistantTranscript" ? [event.text] : []));

describe("connectLiveSession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("posts the offer with the instructions and the nonce, and says nothing before session.started", async () => {
    const { fetchMock, peer, channel, events } = await open();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/live/session");
    expect((init.headers as Record<string, string>)["x-realtime-nonce"]).toBe("nonce-1");
    expect(JSON.parse(String(init.body))).toEqual({
      sdp: "v=0\r\nfake-offer\r\n",
      instructions: "Speak briefly.",
      language: "en",
      patientId: "patient-1",
      crisisOpen: false
    });
    expect(peer.remoteDescription).toEqual({ type: "answer", sdp: "v=0\r\nanswer\r\n" });
    expect(channel.sent).toEqual([]);

    channel.receive({ type: "session.started" });

    expect(channel.sent).toEqual([
      { event_id: "pc_1", type: "session.thinking.append", delegation_id: null, content: FACTS }
    ]);
    expect(events).toContainEqual({ type: "status", status: "listening" });
  });

  it("cuts the voice on a dosing question: mutes, closes and shows the refusal once", async () => {
    const { channel, audio, events } = await open();
    channel.receive({ type: "session.started" });

    heard(channel, "how many", 0, 300);
    heard(channel, " units", 300, 500);
    heard(channel, " for this?", 500, 800);
    vi.advanceTimersByTime(INTERCEPT_SETTLE_MS);

    expect(audio.muted).toBe(true);
    expect(channel.types()).toContain("session.close");
    expect(cuts(events)).toHaveLength(1);
    expect(cuts(events)[0]).toMatchObject({ safety: "blocked" });

    said(channel, "Take 8 units.");
    expect(shown(events)).toEqual([]);
  });

  it("fires a pending cut the moment the model starts answering", async () => {
    const { channel, audio, events } = await open();
    channel.receive({ type: "session.started" });

    heard(channel, "how many units for this?", 0, 900);
    vi.advanceTimersByTime(350);
    said(channel, "For a slice");

    expect(audio.muted).toBe(true);
    expect(cuts(events)).toHaveLength(1);
    expect(shown(events)).toEqual([]);
  });

  it("cuts a stated dose in the model's own words, and never shows the fragment that tripped", async () => {
    const { channel, audio, events } = await open();
    channel.receive({ type: "session.started" });

    said(channel, "Take 8 ");
    said(channel, "units of insulin.");

    expect(audio.muted).toBe(true);
    expect(channel.types()).toContain("session.close");
    expect(cuts(events)).toHaveLength(1);
    expect(shown(events).join("")).not.toMatch(/units/);
  });

  it("shows a crisis card when the person names one, in Spanish too", async () => {
    const { channel, events } = await open({ language: "es", gateTranscript: gateFor("es") });
    channel.receive({ type: "session.started" });

    heard(channel, "ya no quiero comer más, para qué", 0, 1800);
    vi.advanceTimersByTime(INTERCEPT_SETTLE_MS);

    expect(cuts(events)).toHaveLength(1);
    expect(cuts(events)[0]).toMatchObject({ safety: "crisis" });
  });

  it("answers a delegated question from the app, with the delegation's id", async () => {
    const { channel, events, answerDelegation } = await open();
    channel.receive({ type: "session.started" });

    heard(channel, "what about peanut butter?", 0, 900);
    channel.receive({
      type: "session.delegation.created",
      delegation: { id: "item_1", type: "delegation", target: "client" }
    });

    expect(events).toContainEqual({ type: "status", status: "thinking" });
    expect(events).toContainEqual({ type: "userTranscript", text: "what about peanut butter?", final: true });

    await vi.advanceTimersByTimeAsync(0);

    expect(answerDelegation).toHaveBeenCalledWith("what about peanut butter?");
    expect(channel.sent.at(-1)).toMatchObject({
      type: "session.commentary.append",
      delegation_id: "item_1",
      content: "Peanut butter scores 43 out of 100."
    });
    expect(events.at(-1)).toEqual({ type: "status", status: "listening" });
  });

  it("does not answer a delegated turn the gate refuses", async () => {
    const { channel, events, answerDelegation, audio } = await open();
    channel.receive({ type: "session.started" });

    heard(channel, "how many units for this?", 0, 900);
    channel.receive({ type: "session.delegation.created", delegation: { id: "item_2" } });

    expect(answerDelegation).not.toHaveBeenCalled();
    expect(audio.muted).toBe(true);
    expect(cuts(events)).toHaveLength(1);
  });

  it("shows what the person said and the finished answer", async () => {
    const { channel, events } = await open();
    channel.receive({ type: "session.started" });

    heard(channel, "is this good", 0, 600);
    vi.advanceTimersByTime(400);
    said(channel, "Banana scores ");
    said(channel, "95.");

    expect(events).toContainEqual({ type: "userTranscript", text: "is this good", final: true });
    expect(events).toContainEqual({ type: "status", status: "speaking" });

    vi.advanceTimersByTime(ASSISTANT_QUIET_MS);

    expect(events).toContainEqual({ type: "assistantTranscript", text: "Banana scores 95.", final: true });
    expect(events.at(-1)).toEqual({ type: "status", status: "listening" });
  });

  it("holds the opening line until the session starts", async () => {
    const { channel, handle } = await open();

    handle.requestContextResponse?.();
    expect(channel.sent).toEqual([]);

    channel.receive({ type: "session.started" });

    expect(channel.types()).toEqual(["session.thinking.append", "session.commentary.append"]);
    expect(channel.sent[1]).toMatchObject({ delegation_id: null, content: "Banana, raw scores 95 out of 100." });
  });

  it("sends the facts again only when they change", async () => {
    let facts = "Food on screen: Banana, raw.";
    const { channel } = await open({ buildFacts: () => facts });
    channel.receive({ type: "session.started" });

    vi.advanceTimersByTime(3000);
    expect(channel.types().filter((type) => type === "session.thinking.append")).toHaveLength(1);

    facts = "Food on screen: Peanut butter.";
    vi.advanceTimersByTime(1000);

    expect(channel.sent.at(-1)).toMatchObject({
      type: "session.thinking.append",
      content: "Food on screen: Peanut butter."
    });
  });

  it("closes itself after a minute with nobody talking, and tears down once closed", async () => {
    const { channel, events, track, peer } = await open();
    channel.receive({ type: "session.started" });

    vi.advanceTimersByTime(IDLE_CLOSE_MS + 1000);

    expect(channel.types()).toContain("session.close");
    expect(track.stop).toHaveBeenCalled();

    channel.receive({ type: "session.closed", reason: "close_requested", usage: { seconds: 61 } });

    expect(peer.closed).toBe(true);
    expect(events.at(-1)).toEqual({ type: "status", status: "closed" });
    expect(events.some((event) => event.type === "error")).toBe(false);
  });

  it("closes on request: silence first, then session.close, then teardown", async () => {
    const { channel, audio, handle, peer } = await open();
    channel.receive({ type: "session.started" });

    handle.close();

    expect(audio.muted).toBe(true);
    expect(channel.types()).toContain("session.close");
    expect(peer.closed).toBe(false);

    vi.advanceTimersByTime(2000);

    expect(peer.closed).toBe(true);
  });

  it("says so when OpenAI ends the session", async () => {
    const { channel, events } = await open();
    channel.receive({ type: "session.started" });

    channel.receive({ type: "session.closed", reason: "expired", usage: { seconds: 300 } });

    expect(events).toContainEqual({ type: "error", message: "The voice session ended.", fatal: false });
    expect(events.at(-1)).toEqual({ type: "status", status: "closed" });
  });

  it("sends nothing for typed text, which the hook routes elsewhere", async () => {
    const { channel, handle } = await open();
    channel.receive({ type: "session.started" });
    const before = channel.sent.length;

    handle.sendUserText("how many units for this?");

    expect(channel.sent).toHaveLength(before);
  });

  it("fails visibly when the session cannot start, and lets go of the microphone", async () => {
    const { connecting, events, track, peer } = harness({}, () => new Response("{}", { status: 502 }));

    await expect(connecting).rejects.toThrow("live_connect_failed");

    expect(events).toContainEqual({ type: "error", message: "Could not start the voice session.", fatal: true });
    expect(track.stop).toHaveBeenCalled();
    expect(peer.closed).toBe(true);
  });
});
