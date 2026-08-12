import { describe, expect, it, vi } from "vitest";
import { tSafety } from "@/i18n/strings";
import { tVoice } from "@/i18n/voice-strings";
import { CARE_TEAM_ACTIONS, CRISIS_ACTIONS } from "./safety-gate";
import { createOutputTranscriptGuard } from "./output-guard";

function harness(language: "en" | "es" = "en") {
  const order: Array<{ kind: "send" | "event"; value: object }> = [];
  const send = vi.fn((value: object) => order.push({ kind: "send", value }));
  const onEvent = vi.fn((value: object) => order.push({ kind: "event", value }));
  return { guard: createOutputTranscriptGuard({ language, send, onEvent }), send, onEvent, order };
}

describe("createOutputTranscriptGuard", () => {
  it.each([
    "You should stop taking lisinopril.",
    "You have diabetes.",
    "Your blood pressure is 180 over 110.",
    "Your A1C is 9.2.",
    "Your blood sugar is 245 mg/dL.",
    "Your child has autism."
  ])("cancels and flushes blocked output before surfacing it: %s", (text) => {
    const { guard, order } = harness();
    guard.observeDelta(text);
    expect(order).toEqual([
      { kind: "send", value: { type: "response.cancel" } },
      { kind: "send", value: { type: "output_audio_buffer.clear" } },
      {
        kind: "event",
        value: {
          type: "safetyIntercept",
          safety: "blocked",
          content: tVoice("en", "outputBlockedCopy"),
          actions: CARE_TEAM_ACTIONS
        }
      }
    ]);
  });

  it("maps crisis output to fixed crisis copy and actions", () => {
    const { guard, onEvent } = harness("es");
    guard.observeDelta("No hay salida. Quiero morir.");
    expect(onEvent).toHaveBeenCalledWith({
      type: "safetyIntercept",
      safety: "crisis",
      content: tSafety("es", "crisisResponse"),
      actions: CRISIS_ACTIONS
    });
  });

  it("blocks medication-change advice written in Spanish", () => {
    const { guard, send, onEvent } = harness("es");

    guard.observeDelta("Debe dejar de tomar lisinopril hoy.");

    expect(send).toHaveBeenCalledWith({ type: "response.cancel" });
    expect(send).toHaveBeenCalledWith({ type: "output_audio_buffer.clear" });
    expect(onEvent).toHaveBeenCalledWith({
      type: "safetyIntercept",
      safety: "blocked",
      content: tVoice("es", "outputBlockedCopy"),
      actions: CARE_TEAM_ACTIONS
    });
  });

  it("accumulates split deltas and trips only once per response", () => {
    const { guard, send, onEvent } = harness();
    guard.observeDelta("You should ");
    guard.observeDelta("change your dose.");
    guard.observeDelta(" You have diabetes.");
    expect(send).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenCalledTimes(1);

    guard.reset();
    guard.observeDelta("You have diabetes.");
    expect(send).toHaveBeenCalledTimes(4);
    expect(onEvent).toHaveBeenCalledTimes(2);
  });

  it.each([
    "Your care plan focuses on blood pressure.",
    "A lower-sodium choice may fit your plan.",
    "Ask your care team before changing medicine.",
    "You mentioned a reading, but I cannot verify a number here."
  ])("allows benign output: %s", (text) => {
    const { guard, send, onEvent } = harness();
    guard.observeDelta(text);
    expect(send).not.toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();
  });
});
