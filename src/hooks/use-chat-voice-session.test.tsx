import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoState } from "@/domain/fixtures";
import type { AppState } from "@/domain/types";
import type { ConnectArgs } from "@/ai/realtime-session";
import type { LiveSessionHandle } from "@/ai/types";
import { useChatVoiceSession } from "./use-chat-voice-session";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  close: vi.fn()
}));

vi.mock("@/ai/realtime-session", () => ({ connectRealtimeSession: mocks.connect }));

function liveResponse(): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify({
    mode: "live",
    clientSecret: "secret",
    model: "gpt-realtime-2",
    expiresAt: null
  })));
}

describe("useChatVoiceSession", () => {
  beforeEach(() => {
    mocks.close.mockClear();
    mocks.connect.mockReset();
    mocks.connect.mockResolvedValue({
      sendUserText: vi.fn(),
      updateInstructions: vi.fn(),
      close: mocks.close,
      getStatus: () => "listening"
    } satisfies LiveSessionHandle);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(liveResponse));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks start before token fetch while crisis support is unacknowledged", async () => {
    const crisisState: AppState = {
      ...demoState,
      aiMessages: [{
        id: "crisis-1",
        mode: "trouble",
        role: "assistant",
        content: "support",
        createdAt: "2026-07-20T12:00:00.000Z",
        safety: "crisis",
        sources: []
      }]
    };
    const { result } = renderHook(() => useChatVoiceSession({
      language: "en",
      getState: () => crisisState,
      onFinalTranscript: vi.fn(),
      onSafetyIntercept: vi.fn()
    }));

    await act(async () => result.current.start());
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("passes guarded chat instructions, no context, and appends final transcript events", async () => {
    const onFinalTranscript = vi.fn();
    const onSafetyIntercept = vi.fn();
    const { result } = renderHook(() => useChatVoiceSession({
      language: "en",
      getState: () => demoState,
      onFinalTranscript,
      onSafetyIntercept
    }));

    await act(async () => result.current.start());
    const args = mocks.connect.mock.calls[0][0] as ConnectArgs;
    expect(args.instructions).toContain("Patient context:");
    expect(args.instructions).toContain("spoken reply");
    expect(args.buildContextMessage()).toBeNull();

    act(() => {
      args.onEvent({ type: "userTranscript", text: "How am I doing?", final: true });
      args.onEvent({ type: "assistantTranscript", text: "Your plan ", final: false });
      args.onEvent({ type: "assistantTranscript", text: "looks steady.", final: true });
    });
    expect(onFinalTranscript).toHaveBeenCalledWith("patient", "How am I doing?");
    expect(onFinalTranscript).toHaveBeenCalledWith("assistant", "looks steady.");

    act(() => args.onEvent({
      type: "safetyIntercept",
      safety: "crisis",
      content: "Get support now.",
      actions: ["crisis_call_988"]
    }));
    expect(onSafetyIntercept).toHaveBeenCalledWith({
      safety: "crisis",
      content: "Get support now.",
      banner: undefined,
      actions: ["crisis_call_988"]
    });
    act(() => args.onEvent({ type: "assistantTranscript", text: "unsafe trailing text", final: true }));
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("closed");
    expect(onFinalTranscript).toHaveBeenCalledTimes(2);
  });

  it("attests crisis state and uses the deterministic input gate", async () => {
    const { result } = renderHook(() => useChatVoiceSession({
      language: "en",
      getState: () => demoState,
      onFinalTranscript: vi.fn(),
      onSafetyIntercept: vi.fn()
    }));
    await act(async () => result.current.start());

    const request = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({ patientId: demoState.patient.id, crisisOpen: false });
    const args = mocks.connect.mock.calls[0][0] as ConnectArgs;
    expect(args.gateTranscript("I want to die")).toMatchObject({ kind: "intercept", safety: "crisis" });
  });
});
