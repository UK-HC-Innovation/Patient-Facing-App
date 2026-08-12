import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FamilyFollowUpTurn } from "./family-follow-up-turn";

const voice = vi.hoisted(() => ({
  finalTranscript: null as ((text: string) => void) | null,
  start: vi.fn(),
  stop: vi.fn(),
  stopSpeaking: vi.fn()
}));

vi.mock("@/voice/use-dictation", () => ({
  useDictation: ({ onFinalTranscript }: { onFinalTranscript: (text: string) => void }) => {
    voice.finalTranscript = onFinalTranscript;
    return { supported: true, listening: false, start: voice.start, stop: voice.stop };
  }
}));
vi.mock("@/voice/voice-consent", () => ({
  useVoiceEntry: () => ({ consentRequired: false, grantConsent: vi.fn(), onSessionStart: vi.fn() })
}));
vi.mock("@/voice/tts", () => ({
  isSpeaking: () => false,
  stopSpeaking: voice.stopSpeaking,
  subscribeSpeaking: () => () => undefined
}));

const question = {
  question: "What has the school offered so far?",
  options: ["Nothing yet", "A meeting is planned", "An evaluation was done"]
};

describe("FamilyFollowUpTurn", () => {
  beforeEach(() => {
    voice.finalTranscript = null;
    voice.start.mockClear();
    voice.stop.mockClear();
    voice.stopSpeaking.mockClear();
  });

  it("renders suggested answers and submits a chip answer", () => {
    const onAnswer = vi.fn();
    render(
      <FamilyFollowUpTurn
        question={question}
        round={1}
        roundCap={2}
        language="en"
        submitting={false}
        onAnswer={onAnswer}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "A meeting is planned" }));
    expect(onAnswer).toHaveBeenCalledWith("A meeting is planned", "chip");
  });

  it("rejects empty free text and accepts a short typed answer", () => {
    const onAnswer = vi.fn();
    render(
      <FamilyFollowUpTurn
        question={question}
        round={1}
        roundCap={2}
        language="en"
        submitting={false}
        onAnswer={onAnswer}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add answer" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an answer before continuing.");
    expect(onAnswer).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: "Or type a short answer" }), { target: { value: "No" } });
    fireEvent.click(screen.getByRole("button", { name: "Add answer" }));
    expect(onAnswer).toHaveBeenCalledWith("No", "typed");
  });

  it("keeps the visible round counter out of the live-announcement queue", () => {
    render(
      <FamilyFollowUpTurn
        question={question}
        round={2}
        roundCap={2}
        language="en"
        submitting={false}
        onAnswer={vi.fn()}
      />
    );

    expect(screen.getByText("Question 2 of 2")).not.toHaveAttribute("aria-live");
  });

  it("matches a spoken chip label and ordinal locally as voice answers", () => {
    const onAnswer = vi.fn();
    const { rerender } = render(
      <FamilyFollowUpTurn
        question={question}
        round={1}
        roundCap={2}
        language="en"
        submitting={false}
        onAnswer={onAnswer}
      />
    );

    act(() => voice.finalTranscript?.("a meeting is planned!"));
    expect(onAnswer).toHaveBeenCalledWith("A meeting is planned", "voice");

    onAnswer.mockClear();
    rerender(
      <FamilyFollowUpTurn
        question={{ ...question, options: [...question.options] }}
        round={1}
        roundCap={2}
        language="en"
        submitting={false}
        onAnswer={onAnswer}
      />
    );
    act(() => voice.finalTranscript?.("the first one"));
    expect(onAnswer).toHaveBeenCalledWith("Nothing yet", "voice");
  });

  it("matches Spanish ordinals and stages unmatched speech for visual review", () => {
    const onAnswer = vi.fn();
    const spanishQuestion = {
      question: "¿Qué ofreció la escuela?",
      options: ["Nada todavía", "Hay una reunión", "Ya hicieron una evaluación"]
    };
    render(
      <FamilyFollowUpTurn
        question={spanishQuestion}
        round={1}
        roundCap={2}
        language="es"
        submitting={false}
        onAnswer={onAnswer}
      />
    );

    act(() => voice.finalTranscript?.("la primera"));
    expect(onAnswer).toHaveBeenCalledWith("Nada todavía", "voice");

    onAnswer.mockClear();
    act(() => voice.finalTranscript?.("La maestra llamó ayer"));
    expect(onAnswer).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "O escribe una respuesta corta" })).toHaveValue(
      "La maestra llamó ayer"
    );
  });

  it("starts dictation from the mic, stops it on unmount, and never speaks aloud", () => {
    const { unmount } = render(
      <FamilyFollowUpTurn
        question={question}
        round={1}
        roundCap={2}
        language="en"
        submitting={false}
        onAnswer={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Answer by voice" }));
    expect(voice.start).toHaveBeenCalledTimes(1);

    unmount();
    expect(voice.stop).toHaveBeenCalled();
    expect(voice.stopSpeaking).not.toHaveBeenCalled();
  });
});
