import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoState } from "@/domain/fixtures";
import type { IdentifiedFood } from "@/domain/types";
import type { ConnectArgs } from "@/ai/realtime-session";
import { useFoodVoiceSession } from "./use-food-voice-session";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  close: vi.fn()
}));

vi.mock("@/ai/realtime-session", () => ({ connectRealtimeSession: mocks.connect }));
vi.mock("@/ai/local-coach-session", () => ({ openLocalCoachSession: vi.fn() }));

const food: IdentifiedFood = {
  id: "food-1",
  barcode: "12345678",
  name: "Soup",
  brand: "Demo",
  category: "soup",
  nutrition: null,
  source: "barcode_seed",
  ingredientText: null
};

describe("useFoodVoiceSession context injection", () => {
  beforeEach(() => {
    mocks.close.mockClear();
    mocks.connect.mockReset();
    mocks.connect.mockResolvedValue({
      sendUserText: vi.fn(),
      updateInstructions: vi.fn(),
      close: mocks.close,
      getStatus: () => "listening"
    });
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(
      new Response(JSON.stringify({ mode: "live", clientSecret: "secret", model: "gpt-realtime-2", expiresAt: null }))
    )));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps food wire behavior and re-sends full JSON after a stop/restart", async () => {
    const getState = () => demoState;
    const getContext = () => ({
      frameDataUrl: "data:image/jpeg;base64,abc",
      identifiedFood: food,
      flagTexts: ["High sodium"]
    });
    const { result } = renderHook(() => useFoodVoiceSession({
      language: "en",
      getState,
      getContext,
      onFinalTranscript: vi.fn(),
      onSafetyIntercept: vi.fn()
    }));

    await act(async () => result.current.start());
    const firstBuilder = mocks.connect.mock.calls[0][0].buildContextMessage as () => { text: string; imageDataUrl: string };
    const first = firstBuilder();
    const repeat = firstBuilder();
    expect(first.imageDataUrl).toBe("data:image/jpeg;base64,abc");
    expect(first.text).toContain(JSON.stringify(food));
    expect(first.text).toContain("Precomputed flags: High sodium.");
    expect(repeat.text).toContain('{"foodData":"unchanged"}');

    act(() => result.current.stop());
    await act(async () => result.current.start());
    const restartedBuilder = mocks.connect.mock.calls[1][0].buildContextMessage as () => { text: string };
    expect(restartedBuilder().text).toContain(JSON.stringify(food));
  });

  it("closes on a safety intercept and suppresses trailing transcript events", async () => {
    const onFinalTranscript = vi.fn();
    const onSafetyIntercept = vi.fn();
    const { result } = renderHook(() => useFoodVoiceSession({
      language: "en",
      getState: () => demoState,
      getContext: () => ({ frameDataUrl: null, identifiedFood: null, flagTexts: [] }),
      onFinalTranscript,
      onSafetyIntercept
    }));

    await act(async () => result.current.start());
    const args = mocks.connect.mock.calls[0][0] as ConnectArgs;

    act(() => args.onEvent({
      type: "safetyIntercept",
      safety: "blocked",
      content: "Ask your care team.",
      actions: ["call_clinic"]
    }));
    act(() => args.onEvent({ type: "assistantTranscript", text: "unsafe trailing text", final: true }));

    expect(onSafetyIntercept).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("closed");
    expect(onFinalTranscript).not.toHaveBeenCalled();
  });
});
