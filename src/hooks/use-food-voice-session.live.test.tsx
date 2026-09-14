import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoState } from "@/domain/fixtures";
import type { IdentifiedFood } from "@/domain/types";
import type { LiveConnectArgs } from "@/ai/live-session";
import { LIVE_VOICE_POLICY } from "@/ai/live-delegation";
import type { LiveSessionContext } from "@/ai/types";
import { useFoodVoiceSession } from "./use-food-voice-session";

const mocks = vi.hoisted(() => ({
  connectRealtime: vi.fn(),
  connectLive: vi.fn(),
  openLocal: vi.fn()
}));

vi.mock("@/ai/realtime-session", () => ({ connectRealtimeSession: mocks.connectRealtime }));
vi.mock("@/ai/live-session", () => ({ connectLiveSession: mocks.connectLive }));
vi.mock("@/ai/local-coach-session", () => ({ openLocalCoachSession: mocks.openLocal }));
vi.mock("@/telemetry/recorder", () => ({ recordUsage: vi.fn() }));

function fakeHandle() {
  return {
    sendUserText: vi.fn(),
    requestContextResponse: vi.fn(),
    updateInstructions: vi.fn(),
    close: vi.fn(),
    getStatus: () => "listening" as const
  };
}

const soup: IdentifiedFood = {
  id: "food-1",
  barcode: "12345678",
  name: "Soup",
  brand: "Demo",
  category: "soup",
  nutrition: null,
  source: "barcode_seed",
  ingredientText: null
};

const onScreen = (): LiveSessionContext => ({
  frameDataUrl: null,
  identifiedFood: soup,
  flagTexts: [],
  compass: {
    kind: "score",
    fcs: 24,
    band: "minimize",
    tier: "T1",
    calorieDensityKcalPer100g: 60,
    alternatives: [{ description: "Oats", fcs: 82 }]
  }
});

const LIVE_ENGINE = { mode: "live", engine: "live", model: "gpt-live-1" };

function answerTokens(body: Record<string, unknown>) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function render(overrides: Partial<Parameters<typeof useFoodVoiceSession>[0]> = {}) {
  return renderHook(() =>
    useFoodVoiceSession({
      language: "en",
      getState: () => demoState,
      getContext: onScreen,
      onFinalTranscript: vi.fn(),
      onSafetyIntercept: vi.fn(),
      ...overrides
    })
  );
}

describe("useFoodVoiceSession on GPT-Live", () => {
  let live: ReturnType<typeof fakeHandle>;
  let local: ReturnType<typeof fakeHandle>;

  beforeEach(() => {
    live = fakeHandle();
    local = fakeHandle();
    mocks.connectLive.mockReset();
    mocks.connectLive.mockResolvedValue(live);
    mocks.connectRealtime.mockReset();
    mocks.openLocal.mockReset();
    mocks.openLocal.mockResolvedValue(local);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts GPT-Live when the token route says so, with the door's instructions and the voice rules", async () => {
    const fetchMock = answerTokens(LIVE_ENGINE);
    const { result } = render({ buildInstructions: () => "You are a friendly food-choice assistant." });

    await act(async () => result.current.start());

    expect(mocks.connectRealtime).not.toHaveBeenCalled();
    const args = mocks.connectLive.mock.calls[0][0] as LiveConnectArgs;
    expect(args.instructions.startsWith("You are a friendly food-choice assistant.")).toBe(true);
    expect(args.instructions.endsWith(LIVE_VOICE_POLICY)).toBe(true);
    expect(args.language).toBe("en");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ surface: "food", language: "en", crisisOpen: false });
    expect(result.current.mode).toBe("live");
  });

  it("answers a delegation and opens a conversation from the food on screen", async () => {
    answerTokens(LIVE_ENGINE);
    const { result } = render();
    await act(async () => result.current.start());
    const args = mocks.connectLive.mock.calls[0][0] as LiveConnectArgs;
    const sentence = "Demo Soup scores 24 out of 100. That's one to minimize. Oats scores higher, at 82.";

    await expect(args.answerDelegation("is this a good choice?")).resolves.toBe(sentence);
    expect(args.buildOpeningLine()).toBe(sentence);
    expect(args.buildFacts()).toContain("Food on screen: Demo Soup.");
  });

  it("uses the door's own opening line and food name when it has them", async () => {
    answerTokens(LIVE_ENGINE);
    const { result } = render({
      currentFoodName: () => "Pizza, cheese",
      buildOpeningLine: () => "I see pizza. Where's it from?"
    });
    await act(async () => result.current.start());
    const args = mocks.connectLive.mock.calls[0][0] as LiveConnectArgs;

    expect(args.buildOpeningLine()).toBe("I see pizza. Where's it from?");
    await expect(args.answerDelegation("why that score?")).resolves.toMatch(/^Pizza, cheese scores 24 out of 100\./);
  });

  it("sends a typed question down the text path and closes the Live session first", async () => {
    answerTokens(LIVE_ENGINE);
    const { result } = render();
    await act(async () => result.current.start());

    act(() => result.current.sendUserText("is this good for me?"));

    await waitFor(() => expect(local.sendUserText).toHaveBeenCalledWith("is this good for me?"));
    expect(live.close).toHaveBeenCalledTimes(1);
    expect(live.sendUserText).not.toHaveBeenCalled();
    expect(mocks.connectLive).toHaveBeenCalledTimes(1);
  });

  it("never opens a Live session for a typed line, and the mic afterwards does", async () => {
    answerTokens(LIVE_ENGINE);
    const { result } = render({ probeOnMount: true });
    await waitFor(() => expect(result.current.mode).toBe("live"));

    act(() => result.current.sendUserText("what about peanut butter?"));
    await waitFor(() => expect(local.sendUserText).toHaveBeenCalledWith("what about peanut butter?"));
    expect(mocks.connectLive).not.toHaveBeenCalled();

    await act(async () => result.current.start());

    expect(local.close).toHaveBeenCalledTimes(1);
    expect(mocks.connectLive).toHaveBeenCalledTimes(1);
  });

  it("lets the mic start again after a Live session closes itself", async () => {
    answerTokens(LIVE_ENGINE);
    const { result } = render();
    await act(async () => result.current.start());
    const args = mocks.connectLive.mock.calls[0][0] as LiveConnectArgs;

    act(() => args.onEvent({ type: "status", status: "closed" }));
    expect(result.current.status).toBe("closed");

    await act(async () => result.current.start());
    expect(mocks.connectLive).toHaveBeenCalledTimes(2);
  });

  it("keeps a door on Realtime when the token route says realtime", async () => {
    answerTokens({ mode: "live", engine: "realtime", model: "gpt-realtime-2", clientSecret: "secret", expiresAt: null });
    mocks.connectRealtime.mockResolvedValue(fakeHandle());
    const { result } = render();

    await act(async () => result.current.start());

    expect(mocks.connectRealtime).toHaveBeenCalledTimes(1);
    expect(mocks.connectLive).not.toHaveBeenCalled();
  });
});
