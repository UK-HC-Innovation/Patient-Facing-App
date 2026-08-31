import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoState } from "@/domain/fixtures";
import type { IdentifiedFood } from "@/domain/types";
import type { ConnectArgs } from "@/ai/realtime-session";
import { specificNumberAssertions } from "@/ai/output-guard";
import { useFoodVoiceSession } from "./use-food-voice-session";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  openLocal: vi.fn(),
  close: vi.fn(),
  requestContextResponse: vi.fn(),
  sendUserText: vi.fn()
}));

vi.mock("@/ai/realtime-session", () => ({ connectRealtimeSession: mocks.connect }));
vi.mock("@/ai/local-coach-session", () => ({ openLocalCoachSession: mocks.openLocal }));

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
    mocks.requestContextResponse.mockClear();
    mocks.sendUserText.mockClear();
    mocks.connect.mockReset();
    mocks.openLocal.mockReset();
    const session = {
      sendUserText: mocks.sendUserText,
      requestContextResponse: mocks.requestContextResponse,
      updateInstructions: vi.fn(),
      close: mocks.close,
      getStatus: () => "listening"
    };
    mocks.connect.mockResolvedValue(session);
    mocks.openLocal.mockResolvedValue(session);
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
      flagTexts: ["High sodium"],
      historyLine:
        "The patient has logged this same food before (Jan 12); a glucose reading followed within the usual window — the number is on their screen.",
      dayTotalsLine: "Today's logged nutrition totals: sodium 1200 of 1500 mg (80%).",
      plateLine:
        "Plate items and per-item Food Compass scores: Soup: 24 (minimize); Oats: 82 (encourage). Display-only plate average: 67 (moderate). Call this the plate average, never a Food Compass Score for a food."
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
    expect(first.text).toContain(getContext().historyLine);
    expect(first.text).toContain(getContext().dayTotalsLine);
    expect(first.text).toContain(getContext().plateLine);
    expect(first.text).toContain("plate average: 67");
    expect(first.text.endsWith("Use the numbers above exactly; do not recompute them.")).toBe(true);
    expect(specificNumberAssertions.some((pattern) => pattern.test(getContext().historyLine))).toBe(false);
    expect(repeat.text).toContain('{"foodData":"unchanged"}');

    act(() => result.current.stop());
    await act(async () => result.current.start());
    const restartedBuilder = mocks.connect.mock.calls[1][0].buildContextMessage as () => { text: string };
    expect(restartedBuilder().text).toContain(JSON.stringify(food));
  });

  it("strips raw package-label OCR from realtime and fallback voice context", async () => {
    const packageFood: IdentifiedFood = {
      ...food,
      id: "label-food-1",
      source: "label_vision",
      ingredientText: "SECRET RAW OCR INGREDIENTS"
    };
    const getContext = () => ({
      frameDataUrl: null,
      identifiedFood: packageFood,
      flagTexts: []
    });
    const { result } = renderHook(() => useFoodVoiceSession({
      language: "en",
      getState: () => demoState,
      getContext,
      onFinalTranscript: vi.fn(),
      onSafetyIntercept: vi.fn()
    }));

    await act(async () => result.current.start());
    const builder = mocks.connect.mock.calls[0][0].buildContextMessage as () => { text: string };
    const contextMessage = builder().text;
    expect(contextMessage).not.toContain("SECRET RAW OCR INGREDIENTS");
    expect(contextMessage).toContain('"ingredientText":null');

    act(() => result.current.stop());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ mode: "mock", reason: "provider_unavailable" }))
    ));
    await act(async () => result.current.start());
    const localInit = mocks.openLocal.mock.calls[0][0] as { getContext: () => { identifiedFood: IdentifiedFood | null } };
    expect(localInit.getContext().identifiedFood?.ingredientText).toBeNull();
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

  it("requests a context-first assistant turn only when explicitly starting the automatic flow", async () => {
    const { result } = renderHook(() => useFoodVoiceSession({
      language: "en",
      getState: () => demoState,
      getContext: () => ({ frameDataUrl: null, identifiedFood: food, flagTexts: [] }),
      onFinalTranscript: vi.fn(),
      onSafetyIntercept: vi.fn()
    }));

    await act(async () => result.current.start());
    expect(mocks.requestContextResponse).not.toHaveBeenCalled();
    act(() => result.current.stop());

    await act(async () => result.current.startWithContextResponse());
    expect(mocks.requestContextResponse).toHaveBeenCalledTimes(1);

    act(() => result.current.requestContextResponse());
    expect(mocks.requestContextResponse).toHaveBeenCalledTimes(2);
  });

  it("opens the probed transport before sending the first typed question", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ mode: "mock", reason: "provider_mock" }))
    ));
    const { result } = renderHook(() => useFoodVoiceSession({
      language: "en",
      getState: () => demoState,
      getContext: () => ({ frameDataUrl: null, identifiedFood: food, flagTexts: [] }),
      onFinalTranscript: vi.fn(),
      onSafetyIntercept: vi.fn(),
      probeOnMount: true
    }));

    await waitFor(() => expect(result.current.mode).toBe("mock"));
    expect(mocks.openLocal).not.toHaveBeenCalled();

    act(() => result.current.sendUserText("Can I have this for lunch?"));

    await waitFor(() => expect(mocks.sendUserText).toHaveBeenCalledWith("Can I have this for lunch?"));
    expect(mocks.openLocal).toHaveBeenCalledTimes(1);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("does not deliver a queued typed question into a restarted session", async () => {
    let resolveFirstConnection: ((handle: {
      sendUserText: ReturnType<typeof vi.fn>;
      requestContextResponse: ReturnType<typeof vi.fn>;
      updateInstructions: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      getStatus: () => "listening";
    }) => void) | null = null;
    const staleSend = vi.fn();
    const staleClose = vi.fn();
    mocks.connect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstConnection = resolve;
        })
    );
    const { result } = renderHook(() => useFoodVoiceSession({
      language: "en",
      getState: () => demoState,
      getContext: () => ({ frameDataUrl: null, identifiedFood: food, flagTexts: [] }),
      onFinalTranscript: vi.fn(),
      onSafetyIntercept: vi.fn()
    }));

    act(() => result.current.sendUserText("stale question"));
    await waitFor(() => expect(mocks.connect).toHaveBeenCalledTimes(1));
    act(() => result.current.stop());
    await act(async () => result.current.start());

    await act(async () => {
      resolveFirstConnection?.({
        sendUserText: staleSend,
        requestContextResponse: vi.fn(),
        updateInstructions: vi.fn(),
        close: staleClose,
        getStatus: () => "listening"
      });
      await Promise.resolve();
    });

    expect(staleClose).toHaveBeenCalledTimes(1);
    expect(staleSend).not.toHaveBeenCalled();
    expect(mocks.sendUserText).not.toHaveBeenCalled();
  });

  it("closes a session that finishes connecting after the user already stopped", async () => {
    let resolveConnection: ((handle: {
      sendUserText: ReturnType<typeof vi.fn>;
      requestContextResponse: ReturnType<typeof vi.fn>;
      updateInstructions: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      getStatus: () => "listening";
    }) => void) | null = null;
    const lateClose = vi.fn();
    const lateResponse = vi.fn();
    mocks.connect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveConnection = resolve;
        })
    );
    const { result } = renderHook(() => useFoodVoiceSession({
      language: "en",
      getState: () => demoState,
      getContext: () => ({ frameDataUrl: null, identifiedFood: food, flagTexts: [] }),
      onFinalTranscript: vi.fn(),
      onSafetyIntercept: vi.fn()
    }));

    let startPromise: Promise<void> | undefined;
    act(() => {
      startPromise = result.current.startWithContextResponse();
    });
    await waitFor(() => expect(mocks.connect).toHaveBeenCalledTimes(1));
    act(() => result.current.stop());
    await act(async () => {
      resolveConnection?.({
        sendUserText: vi.fn(),
        requestContextResponse: lateResponse,
        updateInstructions: vi.fn(),
        close: lateClose,
        getStatus: () => "listening"
      });
      await startPromise;
    });

    expect(lateClose).toHaveBeenCalledTimes(1);
    expect(lateResponse).not.toHaveBeenCalled();
    expect(result.current.status).toBe("closed");
  });
});
