import { act, renderHook } from "@testing-library/react";
import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDictation } from "./use-dictation";

type RecognitionResult = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;

class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];

  lang = "";
  interimResults = true;
  maxAlternatives = 0;
  onresult: ((event: { results: RecognitionResult; resultIndex?: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }
}

function result(transcript: string, isFinal: boolean) {
  return Object.assign([{ transcript }], { isFinal });
}

function installRecognition(): void {
  Object.defineProperty(window, "SpeechRecognition", {
    configurable: true,
    value: MockSpeechRecognition
  });
}

function DictationSupport() {
  const dictation = useDictation({ language: "en", onFinalTranscript: () => undefined });

  return React.createElement("span", null, String(dictation.supported));
}

describe("useDictation", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "SpeechRecognition");
    Reflect.deleteProperty(window, "webkitSpeechRecognition");
    MockSpeechRecognition.instances = [];
  });

  it("keeps speech support out of the deterministic server render", () => {
    installRecognition();

    expect(renderToString(React.createElement(DictationSupport))).toBe("<span>false</span>");
  });

  it("accepts final results once, ignores interim and replayed results, and uses the requested locale", () => {
    installRecognition();
    const onFinalTranscript = vi.fn();
    const { result: hook } = renderHook(() => useDictation({ language: "es", onFinalTranscript }));

    act(() => hook.current.start());

    const recognition = MockSpeechRecognition.instances[0];
    expect(recognition.lang).toBe("es-US");
    expect(recognition.interimResults).toBe(false);
    expect(recognition.maxAlternatives).toBe(1);
    expect(hook.current.listening).toBe(true);

    act(() => {
      recognition.onresult?.({
        resultIndex: 0,
        results: [result("borrador", false), result("presión alta", true)]
      });
      recognition.onresult?.({
        resultIndex: 1,
        results: [result("borrador", false), result("presión alta", true)]
      });
    });

    expect(onFinalTranscript).toHaveBeenCalledTimes(1);
    expect(onFinalTranscript).toHaveBeenCalledWith("presión alta");
  });

  it("stops and detaches recognition on unmount", () => {
    installRecognition();
    const { result: hook, unmount } = renderHook(() =>
      useDictation({ language: "en", onFinalTranscript: () => undefined })
    );

    act(() => hook.current.start());
    const recognition = MockSpeechRecognition.instances[0];
    unmount();

    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(recognition.onresult).toBeNull();
    expect(recognition.onerror).toBeNull();
    expect(recognition.onend).toBeNull();
  });

  it("stops and detaches recognition when hidden", () => {
    installRecognition();
    const onFinalTranscript = vi.fn();
    const { result: hook } = renderHook(() => useDictation({ language: "en", onFinalTranscript }));
    act(() => hook.current.start());
    const recognition = MockSpeechRecognition.instances[0];
    const lateResult = recognition.onresult;
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");

    act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(recognition.onresult).toBeNull();
    act(() => lateResult?.({ results: [result("late words", true)] }));
    expect(onFinalTranscript).not.toHaveBeenCalled();
    visibility.mockRestore();
  });

  it("requires a fresh tap after a locale change or an enabled gate closes", () => {
    installRecognition();
    const onFinalTranscript = vi.fn();
    const { result: hook, rerender } = renderHook(
      ({ language, enabled }: { language: "en" | "es"; enabled: boolean }) =>
        useDictation({ language, enabled, onFinalTranscript }),
      { initialProps: { language: "en", enabled: true } }
    );
    act(() => hook.current.start());
    const englishRecognition = MockSpeechRecognition.instances[0];

    rerender({ language: "es", enabled: true });
    expect(englishRecognition.stop).toHaveBeenCalledTimes(1);
    expect(hook.current.listening).toBe(false);

    act(() => hook.current.start());
    const spanishRecognition = MockSpeechRecognition.instances[1];
    expect(spanishRecognition.lang).toBe("es-US");
    const lateResult = spanishRecognition.onresult;
    rerender({ language: "es", enabled: false });
    expect(spanishRecognition.stop).toHaveBeenCalledTimes(1);
    act(() => lateResult?.({ results: [result("late hidden words", true)] }));
    expect(onFinalTranscript).not.toHaveBeenCalled();
    act(() => hook.current.start());
    expect(MockSpeechRecognition.instances).toHaveLength(2);
  });

  it("reports unsupported without creating a recognition session", () => {
    const { result: hook } = renderHook(() =>
      useDictation({ language: "en", onFinalTranscript: () => undefined })
    );

    expect(hook.current.supported).toBe(false);
    act(() => hook.current.start());
    expect(hook.current.listening).toBe(false);
  });
});
