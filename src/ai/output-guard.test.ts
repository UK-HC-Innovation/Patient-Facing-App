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
    "Your child has autism.",
    "To cover 45 grams of carbs you would need about 4 units of insulin.",
    "Your insulin-to-carb ratio of 1:10 makes this plate about 3 units.",
    "Yes, this is safe for your peanut allergy.",
    "Your 4-year-old can eat this."
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

describe("createOutputTranscriptGuard leaves honest food answers alone", () => {
  it.each([
    "Carb numbers from a photo are rough. Never use them for insulin math; follow your care team's plan.",
    "This plate is about 40 g of carbs.",
    "This is high in peanuts.",
    "Check the label and ask your care team about the peanut allergy."
  ])("does not cancel: %s", (text) => {
    const { guard, send, onEvent } = harness();
    guard.observeDelta(text);
    expect(send).not.toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();
  });
});
