import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_CAREGIVER_TEXT, schoolAgeFamilyState } from "@/domain/family-fixtures";
import type { FamilyFollowUp, FamilyInterviewResult } from "@/domain/family-interview";
import { FamilyOrientationInterview } from "./family-orientation-interview";

const { extractFamilyInterviewMock, fallbackOverride, push, requestFamilyInterview, speak, stopSpeaking, voice } = vi.hoisted(() => ({
  extractFamilyInterviewMock: vi.fn(),
  fallbackOverride: { current: null as FamilyInterviewResult | null },
  push: vi.fn(),
  requestFamilyInterview: vi.fn(),
  speak: vi.fn(() => Promise.resolve()),
  stopSpeaking: vi.fn(),
  voice: { finalTranscript: null as ((text: string) => void) | null }
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/ai/family-interview-provider", () => ({ requestFamilyInterview }));
vi.mock("@/voice/tts", () => ({
  isSpeaking: () => false,
  speak,
  stopSpeaking,
  subscribeSpeaking: () => () => undefined
}));
vi.mock("@/voice/use-dictation", () => ({
  useDictation: ({ onFinalTranscript }: { onFinalTranscript: (text: string) => void }) => {
    voice.finalTranscript = onFinalTranscript;
    return { supported: true, listening: false, start: vi.fn(), stop: vi.fn() };
  }
}));
vi.mock("@/voice/voice-consent", () => ({
  useVoiceEntry: () => ({ consentRequired: false, grantConsent: vi.fn(), onSessionStart: vi.fn() })
}));
vi.mock("@/domain/family-interview", async () => {
  const actual = await vi.importActual<typeof import("@/domain/family-interview")>("@/domain/family-interview");
  return {
    ...actual,
    extractFamilyInterviewMock: (...args: Parameters<typeof actual.extractFamilyInterviewMock>) => {
      extractFamilyInterviewMock(...args);
      return fallbackOverride.current ?? actual.extractFamilyInterviewMock(...args);
    }
  };
});

const schoolQuestion: FamilyFollowUp = {
  question: "What has the school offered so far?",
  options: ["Nothing yet", "A meeting is planned", "An evaluation was done"]
};
const waiverQuestion: FamilyFollowUp = {
  question: "Have you applied for any state programs yet?",
  options: ["Not yet", "Applied, still waiting", "Not sure"]
};
const helperQuestion: FamilyFollowUp = {
  question: "Who can take over for a few hours?",
  options: ["No one right now", "Family sometimes", "A paid helper"]
};

function result(followUps: FamilyFollowUp[], domain: "school_iep" | "waivers_financial" = "school_iep"): FamilyInterviewResult {
  return {
    facts: [],
    domains: [{ domain, rationale: "The caregiver described a support need." }],
    followUps
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function renderOrientation(overrides: Partial<React.ComponentProps<typeof FamilyOrientationInterview>> = {}) {
  const props: React.ComponentProps<typeof FamilyOrientationInterview> = {
    profile: schoolAgeFamilyState.profile!,
    draft: SAMPLE_CAREGIVER_TEXT,
    // F1a. See family-interview.test.tsx — a consented session, so these keep
    // testing the live path rather than the gate.
    liveAllowed: true,
    language: "en",
    onDraftChange: vi.fn(),
    onInterviewExtracted: vi.fn(),
    onSafetyEscalation: vi.fn(),
    ...overrides
  };
  return { ...render(<FamilyOrientationInterview {...props} />), props };
}

async function submitOpening(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: /find help/i }));
  await screen.findByRole("heading", { name: schoolQuestion.question });
}

beforeEach(() => {
  extractFamilyInterviewMock.mockClear();
  push.mockClear();
  requestFamilyInterview.mockReset();
  speak.mockClear();
  stopSpeaking.mockClear();
  voice.finalTranscript = null;
  fallbackOverride.current = null;
});

describe("FamilyOrientationInterview", () => {
  // The strip is the acknowledgement, and the journal keeps the raw text with a
  // date. Reading your own paragraph back to you is just one more thing to scroll.
  it("does not echo the caregiver's opening text back into the thread", async () => {
    requestFamilyInterview.mockResolvedValueOnce(result([schoolQuestion]));
    renderOrientation();
    await submitOpening();

    expect(screen.queryByText(SAMPLE_CAREGIVER_TEXT)).not.toBeInTheDocument();
    expect(screen.getByRole("log")).toHaveAttribute("aria-relevant", "additions text");
    expect(screen.getByRole("log")).toHaveAttribute("aria-atomic", "false");
    expect(screen.getByRole("log")).not.toHaveAttribute("aria-live");
  });

  // Help first, question second — the whole point of the reordering.
  it("puts the follow-up question below whatever the interlude is showing", async () => {
    requestFamilyInterview.mockResolvedValueOnce(result([schoolQuestion]));
    renderOrientation({
      interlude: <div data-testid="interlude-cards">a resource card</div>
    });
    await submitOpening();

    const cards = screen.getByTestId("interlude-cards");
    const question = screen.getByRole("heading", { name: schoolQuestion.question });
    expect(cards.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Optional — answering sharpens the list.")).toBeVisible();
  });

  it("holds back the sign-off when the caller has cards on screen", async () => {
    requestFamilyInterview.mockResolvedValueOnce(result([]));
    renderOrientation({ showComplete: false });

    fireEvent.click(screen.getByRole("button", { name: /find help/i }));

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: schoolQuestion.question })).not.toBeInTheDocument()
    );
    expect(screen.queryByText("Thanks. That is enough to get you started.")).not.toBeInTheDocument();
  });

  it("submits a chip answer with cumulative live and family-only transcripts", async () => {
    requestFamilyInterview.mockResolvedValueOnce(result([schoolQuestion])).mockResolvedValueOnce(result([]));
    const onInterviewExtracted = vi.fn();
    renderOrientation({ onInterviewExtracted });
    await submitOpening();

    fireEvent.click(screen.getByRole("button", { name: "Nothing yet" }));

    const fullTranscript = `${SAMPLE_CAREGIVER_TEXT}\nQ: ${schoolQuestion.question}\nA: Nothing yet`;
    const familyOnlyTranscript = `${SAMPLE_CAREGIVER_TEXT}\nNothing yet`;
    await waitFor(() => expect(requestFamilyInterview).toHaveBeenCalledTimes(2));
    expect(requestFamilyInterview.mock.calls[1][0]).toEqual(
      expect.objectContaining({ text: fullTranscript, profile: schoolAgeFamilyState.profile, language: "en" })
    );
    await waitFor(() => expect(onInterviewExtracted).toHaveBeenCalledTimes(2));
    expect(onInterviewExtracted.mock.calls[1][1]).toEqual({
      extraction: "live",
      source: "typed",
      rawText: familyOnlyTranscript,
      containsSafetyDisclosure: false
    });
    // The cumulative transcript is what gets re-extracted; the round context
    // carries only the words just written, so per-sentence checks fire once.
    expect(onInterviewExtracted.mock.calls[0][2]).toEqual({ round: 0, newText: SAMPLE_CAREGIVER_TEXT });
    expect(onInterviewExtracted.mock.calls[1][2]).toEqual({ round: 1, newText: "Nothing yet" });
  });

  it("accepts a typed answer shorter than the opening interview minimum", async () => {
    const user = userEvent.setup();
    requestFamilyInterview.mockResolvedValueOnce(result([schoolQuestion])).mockResolvedValueOnce(result([]));
    const onInterviewExtracted = vi.fn();
    renderOrientation({ onInterviewExtracted });
    await submitOpening();

    await user.type(screen.getByRole("textbox", { name: "Or type a short answer" }), "No");
    await user.click(screen.getByRole("button", { name: "Add answer" }));

    await waitFor(() => expect(onInterviewExtracted).toHaveBeenCalledTimes(2));
    expect(requestFamilyInterview.mock.calls[1][0].text).toMatch(/\nA: No$/);
  });

  it("raises the safety banner for a follow-up answer and keeps it off the network", async () => {
    requestFamilyInterview.mockResolvedValueOnce(result([schoolQuestion]));
    const onSafetyEscalation = vi.fn();
    const onInterviewExtracted = vi.fn();
    renderOrientation({ onSafetyEscalation, onInterviewExtracted });
    await submitOpening();

    const crisisText = "I am going to kill myself tonight";
    fireEvent.change(screen.getByRole("textbox", { name: "Or type a short answer" }), { target: { value: crisisText } });
    fireEvent.click(screen.getByRole("button", { name: "Add answer" }));

    expect(onSafetyEscalation).toHaveBeenCalledTimes(1);
    expect(onSafetyEscalation.mock.calls[0][0]).toMatchObject({ matched: true, tier: "crisis" });
    expect(push).not.toHaveBeenCalled();
    // Only the opening call — this answer was extracted locally, never sent.
    expect(requestFamilyInterview).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onInterviewExtracted).toHaveBeenCalledTimes(2));
    expect(onInterviewExtracted.mock.calls[1][1]).toMatchObject({ extraction: "mock" });
  });

  it("never re-opens a cumulative transcript after a later correction masks its crisis text", async () => {
    requestFamilyInterview.mockResolvedValueOnce(result([schoolQuestion]));
    const onInterviewExtracted = vi.fn();
    const onSafetyEscalation = vi.fn();
    renderOrientation({ language: "es", onInterviewExtracted, onSafetyEscalation });
    fireEvent.click(screen.getByRole("button", { name: "Buscar ayuda" }));
    await screen.findByRole("heading", { name: schoolQuestion.question });

    // Force one safe second question so this test reaches the round after the
    // disclosure. The production fallback supplies the question; its content is
    // irrelevant to the privacy invariant under test.
    fallbackOverride.current = result([waiverQuestion]);
    fireEvent.change(screen.getByRole("textbox", { name: "O escribe una respuesta corta" }), {
      target: { value: "mi hija dice que quiere morir" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar respuesta" }));
    await screen.findByRole("heading", { name: waiverQuestion.question });

    // Negation-aware classification of the cumulative text can return to safe
    // here. The original sentence is still in the payload, so the thread-level
    // latch—not the latest classification—must keep both sending and filing shut.
    fireEvent.change(screen.getByRole("textbox", { name: "O escribe una respuesta corta" }), {
      target: { value: "mi hija no dice que quiere morir" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar respuesta" }));

    await waitFor(() => expect(onInterviewExtracted).toHaveBeenCalledTimes(3));
    expect(onSafetyEscalation).toHaveBeenCalledTimes(1);
    expect(requestFamilyInterview).toHaveBeenCalledTimes(1);
    expect(onInterviewExtracted.mock.calls[1][1]).toMatchObject({
      extraction: "mock",
      containsSafetyDisclosure: true
    });
    expect(onInterviewExtracted.mock.calls[2][1]).toMatchObject({
      extraction: "mock",
      containsSafetyDisclosure: true
    });
  });

  it("uses family-only text for the mock fallback and advances to its next safe question", async () => {
    requestFamilyInterview.mockResolvedValueOnce(result([schoolQuestion])).mockResolvedValueOnce(null);
    renderOrientation();
    await submitOpening();

    fireEvent.click(screen.getByRole("button", { name: "Nothing yet" }));

    const familyOnlyTranscript = `${SAMPLE_CAREGIVER_TEXT}\nNothing yet`;
    await screen.findByRole("heading", { name: waiverQuestion.question });
    expect(extractFamilyInterviewMock).toHaveBeenCalledWith(
      familyOnlyTranscript,
      schoolAgeFamilyState.profile,
      expect.any(Date),
      "en"
    );
  });

  it("deduplicates already-asked questions exactly", async () => {
    requestFamilyInterview
      .mockResolvedValueOnce(result([schoolQuestion]))
      .mockResolvedValueOnce(result([schoolQuestion, waiverQuestion], "waivers_financial"));
    renderOrientation();
    await submitOpening();

    fireEvent.click(screen.getByRole("button", { name: "Nothing yet" }));

    await screen.findByRole("heading", { name: waiverQuestion.question });
    expect(screen.getAllByText(schoolQuestion.question)).toHaveLength(1);
  });

  it("stops after two follow-up rounds even when another question is returned", async () => {
    requestFamilyInterview
      .mockResolvedValueOnce(result([schoolQuestion]))
      .mockResolvedValueOnce(result([waiverQuestion], "waivers_financial"))
      .mockResolvedValueOnce(result([helperQuestion]));
    const onInterviewExtracted = vi.fn();
    renderOrientation({ onInterviewExtracted });
    await submitOpening();

    fireEvent.click(screen.getByRole("button", { name: "Nothing yet" }));
    await screen.findByRole("heading", { name: waiverQuestion.question });
    fireEvent.click(screen.getByRole("button", { name: "Not yet" }));

    await screen.findByText("Thanks. That is enough to get you started.");
    expect(screen.queryByRole("heading", { name: helperQuestion.question })).not.toBeInTheDocument();
    expect(onInterviewExtracted).toHaveBeenCalledTimes(3);
  });

  it("ends gracefully before offering a question without enough transcript headroom", async () => {
    const nearLimit = "x".repeat(4293);
    requestFamilyInterview.mockResolvedValueOnce(result([schoolQuestion]));
    renderOrientation({ draft: nearLimit });

    fireEvent.click(screen.getByRole("button", { name: /find help/i }));

    await screen.findByText("Thanks. That is enough to get you started.");
    expect(screen.queryByRole("heading", { name: schoolQuestion.question })).not.toBeInTheDocument();
    expect(requestFamilyInterview).toHaveBeenCalledTimes(1);
  });

  it("guards against double submission while a follow-up request is pending", async () => {
    const pending = deferred<FamilyInterviewResult | null>();
    requestFamilyInterview.mockResolvedValueOnce(result([schoolQuestion])).mockReturnValueOnce(pending.promise);
    renderOrientation();
    await submitOpening();

    const chip = screen.getByRole("button", { name: "Nothing yet" });
    fireEvent.click(chip);
    fireEvent.click(chip);

    expect(requestFamilyInterview).toHaveBeenCalledTimes(2);
    await act(async () => pending.resolve(result([])));
    await screen.findByText("Thanks. That is enough to get you started.");
  });

  it("aborts an old-profile follow-up while preserving the answered thread", async () => {
    const pending = deferred<FamilyInterviewResult | null>();
    requestFamilyInterview.mockResolvedValueOnce(result([schoolQuestion])).mockReturnValueOnce(pending.promise);
    const onInterviewExtracted = vi.fn();
    const { rerender, props } = renderOrientation({ onInterviewExtracted });
    await submitOpening();

    fireEvent.click(screen.getByRole("button", { name: "Nothing yet" }));
    await waitFor(() => expect(requestFamilyInterview).toHaveBeenCalledTimes(2));
    const signal = requestFamilyInterview.mock.calls[1][1].signal as AbortSignal;
    rerender(
      <FamilyOrientationInterview
        {...props}
        profile={{ ...schoolAgeFamilyState.profile!, county: "Perry" }}
      />
    );

    expect(signal.aborted).toBe(true);
    expect(screen.getByText("Nothing yet")).toBeVisible();
    await screen.findByText("Thanks. That is enough to get you started.");
    await act(async () => pending.resolve(result([waiverQuestion], "waivers_financial")));
    expect(onInterviewExtracted).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { name: waiverQuestion.question })).not.toBeInTheDocument();
  });

  it("never speaks aloud on its own", async () => {
    requestFamilyInterview.mockResolvedValueOnce(result([schoolQuestion])).mockResolvedValueOnce(result([]));
    renderOrientation();
    await submitOpening();

    fireEvent.click(screen.getByRole("button", { name: "Nothing yet" }));
    await screen.findByText("Thanks. That is enough to get you started.");

    expect(speak).not.toHaveBeenCalled();
  });

  it("renders the interlude between the transcript and the follow-up turn, and holdTurn hides the turn", async () => {
    requestFamilyInterview.mockResolvedValueOnce(result([schoolQuestion]));
    const interlude = <p data-testid="orientation-interlude">Which county?</p>;
    const { rerender, props } = renderOrientation({ interlude, holdTurn: true });

    fireEvent.click(screen.getByRole("button", { name: /find help/i }));
    await screen.findByTestId("orientation-interlude");
    expect(screen.queryByRole("heading", { name: schoolQuestion.question })).not.toBeInTheDocument();

    rerender(<FamilyOrientationInterview {...props} interlude={interlude} holdTurn={false} />);
    const question = await screen.findByRole("heading", { name: schoolQuestion.question });
    const interludeNode = screen.getByTestId("orientation-interlude");
    expect(
      interludeNode.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  // Editing the child's details is a correction, not a new conversation. The
  // details can now be edited from inside the thread itself, so throwing the
  // thread away would drop the question the caregiver was mid-answer on — and
  // move an unacknowledged safety banner out from the top of the page.
  it("keeps the thread through every profile change, and starts over only on a language switch", async () => {
    requestFamilyInterview.mockResolvedValueOnce(result([schoolQuestion]));
    const emptyProfile = { birthYear: 0, schoolStage: "not_school_age" as const, county: "", diagnoses: [] };
    const { rerender, props } = renderOrientation({ profile: emptyProfile });
    await submitOpening();

    rerender(<FamilyOrientationInterview {...props} profile={schoolAgeFamilyState.profile!} />);
    expect(screen.getByRole("heading", { name: schoolQuestion.question })).toBeVisible();

    rerender(
      <FamilyOrientationInterview {...props} profile={{ ...schoolAgeFamilyState.profile!, county: "Perry" }} />
    );
    expect(screen.getByRole("heading", { name: schoolQuestion.question })).toBeVisible();

    rerender(
      <FamilyOrientationInterview {...props} profile={schoolAgeFamilyState.profile!} language="es" />
    );
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: schoolQuestion.question })).not.toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /buscar ayuda/i })).toBeInTheDocument();
  });

  it("raises the safety banner for a spoken crisis answer and preserves voice provenance", async () => {
    requestFamilyInterview.mockResolvedValueOnce(result([schoolQuestion]));
    const onSafetyEscalation = vi.fn();
    const onInterviewExtracted = vi.fn();
    renderOrientation({ onSafetyEscalation, onInterviewExtracted });
    await submitOpening();

    const crisisText = "I am going to kill myself tonight";
    act(() => voice.finalTranscript?.(crisisText));

    expect(onSafetyEscalation).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(requestFamilyInterview).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onInterviewExtracted).toHaveBeenCalledTimes(2));
    expect(onInterviewExtracted.mock.calls[1][1]).toMatchObject({ extraction: "mock", source: "mixed" });
  });

  it("records a voice follow-up as mixed with the typed opening transcript", async () => {
    requestFamilyInterview.mockResolvedValueOnce(result([schoolQuestion])).mockResolvedValueOnce(result([]));
    const onInterviewExtracted = vi.fn();
    renderOrientation({ onInterviewExtracted });
    await submitOpening();

    act(() => voice.finalTranscript?.("Nothing yet"));

    await waitFor(() => expect(onInterviewExtracted).toHaveBeenCalledTimes(2));
    expect(onInterviewExtracted.mock.calls[1][1]).toEqual(
      expect.objectContaining({ source: "mixed", rawText: `${SAMPLE_CAREGIVER_TEXT}\nNothing yet` })
    );
  });
});
