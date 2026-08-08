import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_CAREGIVER_TEXT, schoolAgeFamilyState } from "@/domain/family-fixtures";
import {
  extractFamilyInterviewMock,
  type FamilyFollowUp,
  type FamilyInterviewFact,
  type FamilyInterviewResult
} from "@/domain/family-interview";
import type { DevNeedDomain, FamilyProfile } from "@/domain/types";
import { FamilyInterview, sanitizeResult } from "./family-interview";

const FIXED_NOW = new Date("2026-07-30T12:00:00.000Z");

function liveInterviewResult(
  facts: FamilyInterviewFact[],
  domains: DevNeedDomain[],
  followUps: FamilyFollowUp[] = []
): FamilyInterviewResult {
  return {
    facts,
    domains: domains.map((domain) => ({
      domain,
      rationale: "Provider rationale."
    })),
    followUps
  };
}

const { push, requestFamilyInterview } = vi.hoisted(() => ({ push: vi.fn(), requestFamilyInterview: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/ai/family-interview-provider", () => ({ requestFamilyInterview }));

type FakeSpeechResult = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type FakeResult = { results: ArrayLike<FakeSpeechResult>; resultIndex?: number };
type RecognitionInstance = {
  continuous: boolean;
  onresult: ((event: FakeResult) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};

let recognition: RecognitionInstance | undefined;

function speechResult(transcript: string, isFinal = true): FakeResult {
  return { results: [Object.assign([{ transcript }], { isFinal })] };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function installSpeech(): void {
  function FakeRecognition() {
    recognition = {
      continuous: false,
      onresult: null,
      onerror: null,
      onend: null,
      start: vi.fn(),
      stop: vi.fn()
    };
    return recognition;
  }
  (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = FakeRecognition;
}

function renderInterview(overrides: Partial<React.ComponentProps<typeof FamilyInterview>> = {}) {
  const props: React.ComponentProps<typeof FamilyInterview> = {
    profile: schoolAgeFamilyState.profile!,
    draft: SAMPLE_CAREGIVER_TEXT,
    passcode: "secret",
    // F1a. These cases exercise the live path, so they stand in for a caregiver
    // who accepted the online-helper disclosure. The gate itself is covered by
    // family-ai-consent.test.ts and family-network-silence.test.tsx.
    liveAllowed: true,
    language: "en",
    onDraftChange: vi.fn(),
    onExtracted: vi.fn(),
    ...overrides
  };
  return { ...render(<FamilyInterview {...props} />), props };
}

beforeEach(() => {
  push.mockClear();
  requestFamilyInterview.mockReset();
  requestFamilyInterview.mockResolvedValue(null);
  recognition = undefined;
});

afterEach(() => {
  vi.useRealTimers();
  delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
});

describe("FamilyInterview", { timeout: 20_000 }, () => {
  it("uses the deterministic fallback whenever live extraction returns null", async () => {
    const onExtracted = vi.fn();
    renderInterview({ onExtracted });
    fireEvent.click(screen.getByRole("button", { name: /find help/i }));

    await waitFor(() => expect(onExtracted).toHaveBeenCalledTimes(1));
    expect(onExtracted.mock.calls[0][0].domains.map(({ domain }: { domain: string }) => domain)).toEqual([
      "school_iep",
      "waivers_financial",
      "parent_support"
    ]);
    expect(onExtracted.mock.calls[0].slice(1)).toEqual([
      { extraction: "mock", source: "typed", rawText: SAMPLE_CAREGIVER_TEXT }
    ]);
  });

  it("falls back locally when the provider throws and sanitizes unsafe live rationales", async () => {
    requestFamilyInterview.mockRejectedValueOnce(new Error("unexpected"));
    const onExtracted = vi.fn();
    renderInterview({ onExtracted });
    fireEvent.click(screen.getByRole("button", { name: /find help/i }));
    await waitFor(() =>
      expect(onExtracted).toHaveBeenCalledWith(expect.any(Object), {
        extraction: "mock",
        source: "typed",
        rawText: SAMPLE_CAREGIVER_TEXT
      })
    );

    const neutralText = "We would like some general guidance today.";
    const interviewInput = screen.getByRole("textbox", {
      name: /what would you like help with/i
    });
    fireEvent.change(
      interviewInput,
      { target: { value: neutralText } }
    );
    await waitFor(() => expect(interviewInput).toHaveValue(neutralText));
    requestFamilyInterview.mockResolvedValueOnce({
      facts: [],
      domains: [{ domain: "school_iep", rationale: "Riley has dyslexia." }],
      followUps: []
    });
    fireEvent.click(screen.getByRole("button", { name: /find help/i }));
    await waitFor(() => expect(onExtracted).toHaveBeenCalledTimes(2));
    expect(onExtracted.mock.calls[1]).toEqual([
      { facts: [], domains: [{ domain: "school_iep" }], followUps: [] },
      { extraction: "live", source: "typed", rawText: neutralText }
    ]);
  });

  it("sanitizes live follow-ups and keeps safe questions with chips", async () => {
    requestFamilyInterview.mockResolvedValueOnce({
      facts: [],
      domains: [{ domain: "school_iep" }],
      followUps: [
        { question: "Does Riley have autism?", options: ["Maybe"] },
        { question: "Would First Steps help?", options: ["Maybe"] },
        { question: "What has the teacher noticed?", options: ["Nothing yet", "Reading is hard"] }
      ]
    });
    const onExtracted = vi.fn();
    renderInterview({ onExtracted });

    fireEvent.click(screen.getByRole("button", { name: /find help/i }));

    await waitFor(() => expect(onExtracted).toHaveBeenCalledTimes(1));
    expect(onExtracted.mock.calls[0][0].followUps).toEqual([
      { question: "What has the teacher noticed?", options: ["Nothing yet", "Reading is hard"] }
    ]);
  });

  it("drops an unsupported live diagnosis fact even when its source snippet is verbatim", async () => {
    requestFamilyInterview.mockResolvedValueOnce({
      facts: [
        { label: "Grade", value: "second grade", sourceSnippet: "second grade" },
        { label: "Reported diagnosis", value: "autism", sourceSnippet: "second grade" },
        { label: "Observation", value: "autism", sourceSnippet: "second grade" },
        {
          label: "Reported diagnosis",
          value: "dyslexia",
          sourceSnippet: "He was just diagnosed with dyslexia"
        },
        {
          label: "About school and learning",
          value: "You wrote about school and learning",
          sourceSnippet: "reading is really hard for him"
        }
      ],
      domains: [{ domain: "school_iep", rationale: "The caregiver described school concerns." }],
      followUps: []
    });
    const onExtracted = vi.fn();
    renderInterview({
      profile: {
        ...schoolAgeFamilyState.profile!,
        diagnoses: [...schoolAgeFamilyState.profile!.diagnoses, { id: "profile-autism", label: "autism" }]
      },
      onExtracted
    });

    fireEvent.click(screen.getByRole("button", { name: /find help/i }));

    await waitFor(() => expect(onExtracted).toHaveBeenCalledTimes(1));
    expect(onExtracted.mock.calls[0][0].facts).toEqual([
      { label: "Grade", value: "second grade", sourceSnippet: "second grade" },
      {
        label: "Reported diagnosis",
        value: "dyslexia",
        sourceSnippet: "He was just diagnosed with dyslexia"
      },
      {
        label: "About school and learning",
        value: "You wrote about school and learning",
        sourceSnippet:
          "My son is in second grade and reading is really hard for him."
      }
    ]);
  });

  it.each([
    "honestly she's been saying she wants to die",
    "mi hija dice que quiere morir",
    "quiero morir",
    "me quiero matar",
    "ya no quiero vivir",
    "mi hijo dice que ya no quiere vivir",
    "mi hija se está cortando",
    "I have chest pain and cannot breathe",
    "There is no food today"
  ])("raises the safety banner and keeps the turn on-device: %s", async (text) => {
    const onExtracted = vi.fn();
    const onSafetyEscalation = vi.fn();
    renderInterview({ draft: text, onExtracted, onSafetyEscalation });
    fireEvent.click(screen.getByRole("button", { name: /find help/i }));

    await waitFor(() => expect(onSafetyEscalation).toHaveBeenCalledTimes(1));
    expect(onSafetyEscalation.mock.calls[0][0]).toMatchObject({ matched: true });
    // The disclosure never leaves the device, and the conversation continues:
    // extraction still runs, on the deterministic local path.
    expect(requestFamilyInterview).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    await waitFor(() => expect(onExtracted).toHaveBeenCalledTimes(1));
    expect(onExtracted.mock.calls[0][1]).toMatchObject({ extraction: "mock", rawText: text });
  });

  it("does not let a late empty draft wipe words the caregiver already typed", async () => {
    // Stored state hydrates a tick after mount and can deliver an empty draft
    // after the first keystroke. Losing the caregiver's sentence there also
    // leaves the submit button disabled with no explanation.
    const onExtracted = vi.fn();
    const { rerender } = renderInterview({ draft: "" });

    const textarea = screen.getByLabelText("What would you like help with?");
    fireEvent.change(textarea, { target: { value: "He keeps getting sent home from school." } });
    expect(screen.getByRole("button", { name: /find help/i })).toBeEnabled();

    rerender(
      <FamilyInterview
        profile={schoolAgeFamilyState.profile!}
        draft=""
        language="en"
        onDraftChange={vi.fn()}
        onExtracted={onExtracted}
      />
    );

    expect(textarea).toHaveValue("He keeps getting sent home from school.");
    expect(screen.getByRole("button", { name: /find help/i })).toBeEnabled();
  });

  it("uses compile-enforced family strings for its static chrome", () => {
    renderInterview({ draft: "A usable family interview" });

    expect(screen.getByLabelText("What would you like help with?")).toBeVisible();
    expect(screen.getByRole("button", { name: "Find help" })).toBeVisible();
    expect(screen.getByText("25 of 5000 characters")).toBeVisible();
  });

  it("keeps long-form description recognition continuous with an explicit active state", async () => {
    installSpeech();
    renderInterview({ draft: "" });

    fireEvent.click(await screen.findByRole("button", { name: "Start speaking" }));

    expect(recognition?.continuous).toBe(true);
    expect(recognition?.start).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Done recording" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Listening — keep talking. Tap Done recording when you are finished."
    );
  });

  it("restarts a browser-ended session and keeps appending the full description", async () => {
    installSpeech();
    const onDraftChange = vi.fn();
    renderInterview({ draft: "", onDraftChange });
    fireEvent.click(await screen.findByRole("button", { name: "Start speaking" }));
    vi.useFakeTimers();

    act(() => recognition?.onresult?.(speechResult("a complete first segment")));
    act(() => recognition?.onend?.());

    expect(screen.getByRole("status")).toHaveTextContent("Still listening — reconnecting the microphone…");
    act(() => vi.runOnlyPendingTimers());
    expect(recognition?.start).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent(/listening.*keep talking/i);

    act(() => recognition?.onresult?.(speechResult("and the rest of the description")));
    expect(screen.getByRole("textbox", { name: /what would you like help with/i })).toHaveValue(
      "a complete first segment and the rest of the description"
    );
    expect(onDraftChange).toHaveBeenLastCalledWith(
      "a complete first segment and the rest of the description"
    );
  });

  it("stops only when Done recording is tapped and never restarts afterward", async () => {
    installSpeech();
    renderInterview({ draft: "A description worth reviewing" });
    fireEvent.click(await screen.findByRole("button", { name: "Start speaking" }));
    vi.useFakeTimers();
    const ended = recognition?.onend;

    fireEvent.click(screen.getByRole("button", { name: "Done recording" }));
    act(() => ended?.());
    act(() => vi.runOnlyPendingTimers());

    expect(recognition?.stop).toHaveBeenCalledTimes(1);
    expect(recognition?.start).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Recording finished — review your description before finding help."
    );
    expect(screen.getByRole("button", { name: "Start speaking" })).toBeVisible();
  });

  it("preserves accepted words and reports when a browser restart fails", async () => {
    installSpeech();
    renderInterview({ draft: "" });
    fireEvent.click(await screen.findByRole("button", { name: "Start speaking" }));
    vi.useFakeTimers();
    act(() => recognition?.onresult?.(speechResult("words already accepted")));
    recognition?.start.mockImplementationOnce(() => {
      throw new Error("restart failed");
    });

    act(() => recognition?.onend?.());
    act(() => vi.runOnlyPendingTimers());

    expect(screen.getByRole("textbox", { name: /what would you like help with/i })).toHaveValue(
      "words already accepted"
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Recording stopped — your words were saved. Tap Start speaking to continue."
    );
    expect(screen.getByRole("button", { name: "Start speaking" })).toBeVisible();
  });

  it("shows the continuous description controls and status in Spanish", async () => {
    installSpeech();
    renderInterview({ draft: "", language: "es" });

    fireEvent.click(await screen.findByRole("button", { name: "Empezar a hablar" }));

    expect(screen.getByRole("button", { name: "Terminar grabación" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Escuchando — sigue hablando. Toca Terminar grabación cuando hayas terminado."
    );
  });

  it("appends repeated final speech transcripts with one space and never auto-submits", async () => {
    installSpeech();
    const onDraftChange = vi.fn();
    const onExtracted = vi.fn();
    renderInterview({ draft: "Existing words", onDraftChange, onExtracted });
    const mic = await screen.findByRole("button", { name: /start speaking|stop listening/i });
    fireEvent.click(mic);

    act(() => recognition?.onresult?.(speechResult("first final")));
    act(() => recognition?.onresult?.(speechResult("second final")));

    expect(screen.getByLabelText(/what would you like help with/i)).toHaveValue("Existing words first final second final");
    expect(onDraftChange).toHaveBeenLastCalledWith("Existing words first final second final");
    expect(requestFamilyInterview).not.toHaveBeenCalled();
    expect(onExtracted).not.toHaveBeenCalled();
  });

  it("ignores a browser replay of the same final speech result index", async () => {
    installSpeech();
    const onDraftChange = vi.fn();
    renderInterview({ draft: "Existing words", onDraftChange });
    fireEvent.click(await screen.findByRole("button", { name: /start speaking|stop listening/i }));
    const repeatedFinal = speechResult("one final phrase");

    act(() => recognition?.onresult?.(repeatedFinal));
    act(() => recognition?.onresult?.(repeatedFinal));

    expect(screen.getByLabelText(/what would you like help with/i)).toHaveValue(
      "Existing words one final phrase"
    );
    expect(onDraftChange).toHaveBeenCalledTimes(1);
  });

  it("ignores interim speech results", async () => {
    installSpeech();
    renderInterview({ draft: "Existing words" });
    fireEvent.click(await screen.findByRole("button", { name: /start speaking|stop listening/i }));
    act(() => recognition?.onresult?.(speechResult("not final", false)));
    expect(screen.getByLabelText(/what would you like help with/i)).toHaveValue("Existing words");
  });

  it.each([
    ["", "This came from the microphone", "voice"],
    ["Existing typed words", "then the microphone", "mixed"]
  ])("emits %s plus speech with %s provenance", async (draft, transcript, expectedSource) => {
    installSpeech();
    const onExtracted = vi.fn();
    renderInterview({ draft, onExtracted });
    fireEvent.click(await screen.findByRole("button", { name: /start speaking|stop listening/i }));
    act(() => recognition?.onresult?.(speechResult(transcript)));
    fireEvent.click(screen.getByRole("button", { name: /find help/i }));
    await waitFor(() =>
      expect(onExtracted).toHaveBeenCalledWith(expect.any(Object), {
        extraction: "mock",
        source: expectedSource,
        rawText: draft ? `${draft} ${transcript}` : transcript
      })
    );
  });

  it("refuses an over-cap transcript, shows the current count, and disables the mic near the cap", async () => {
    installSpeech();
    const nearCap = "x".repeat(4950);
    const { unmount } = renderInterview({ draft: nearCap });
    const mic = await screen.findByRole("button", { name: /start speaking|stop listening/i });
    expect(mic).toBeDisabled();
    expect(screen.getByText("4950 of 5000 characters")).toBeInTheDocument();
    unmount();

    renderInterview({ draft: "x".repeat(4940) });
    const activeMic = await screen.findByRole("button", { name: /start speaking|stop listening/i });
    fireEvent.click(activeMic);
    act(() => recognition?.onresult?.(speechResult("y".repeat(100))));
    expect(screen.getByRole("alert")).toHaveTextContent(/5000|too long|maximum/i);
    expect(screen.getByLabelText(/what would you like help with/i)).toHaveValue("x".repeat(4940));
    expect(recognition?.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Start speaking" })).toBeVisible();
  });

  it("shows typed over-cap errors without truncating and keeps typed entry usable without speech", () => {
    renderInterview({ draft: "Typed entry works" });
    expect(screen.queryByRole("button", { name: /start speaking|stop listening/i })).not.toBeInTheDocument();
    const input = screen.getByLabelText(/what would you like help with/i);
    fireEvent.change(input, { target: { value: "x".repeat(5001) } });
    expect(input).toHaveValue("x".repeat(5001));
    expect(screen.getByRole("alert")).toHaveTextContent(/5000|too long|maximum/i);
    expect(screen.getByRole("button", { name: /find help/i })).toBeDisabled();
  });

  it("stops speech recognition on unmount", async () => {
    installSpeech();
    const { unmount } = renderInterview({ draft: "A usable interview draft" });
    fireEvent.click(await screen.findByRole("button", { name: /start speaking|stop listening/i }));
    const lateResult = recognition?.onresult;
    unmount();
    expect(recognition?.stop).toHaveBeenCalled();
    expect(recognition?.onresult).toBeNull();
    expect(recognition?.onerror).toBeNull();
    expect(recognition?.onend).toBeNull();
    act(() => lateResult?.(speechResult("late final")));
  });

  it("freezes one atomic mixed-source submission and ignores edits or late speech while pending", async () => {
    installSpeech();
    const liveResult = {
      facts: [
        {
          label: "Grade",
          value: "fourth grade",
          sourceSnippet: "Existing fourth grade spoken concern"
        }
      ],
      domains: [{ domain: "school_iep" as const, rationale: "Riley has dyslexia." }],
      followUps: []
    };
    const pending = deferred<typeof liveResult | null>();
    requestFamilyInterview.mockReturnValueOnce(pending.promise);
    const onDraftChange = vi.fn();
    const onExtracted = vi.fn();
    renderInterview({ draft: "Existing fourth grade", onDraftChange, onExtracted });
    fireEvent.click(await screen.findByRole("button", { name: /start speaking|stop listening/i }));
    act(() => recognition?.onresult?.(speechResult("spoken concern")));
    const rawText = "Existing fourth grade spoken concern";
    const lateResult = recognition?.onresult;

    fireEvent.click(screen.getByRole("button", { name: /find help/i }));
    expect(screen.getByRole("textbox", { name: /what would you like help with/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /start speaking|stop listening/i })).toBeDisabled();
    expect(recognition?.stop).toHaveBeenCalledTimes(1);
    expect(recognition?.onresult).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: /what would you like help with/i }), { target: { value: "changed while pending" } });
    act(() => lateResult?.(speechResult("late final")));
    expect(screen.getByRole("textbox", { name: /what would you like help with/i })).toHaveValue(rawText);

    await act(async () => pending.resolve(liveResult));
    await waitFor(() =>
      expect(onExtracted).toHaveBeenCalledWith(
        {
          facts: [
            {
              label: "Grade",
              value: "fourth grade",
              sourceSnippet: "fourth grade"
            },
            {
              label: "About school and learning",
              value: "You wrote about school and learning",
              sourceSnippet: rawText
            }
          ],
          domains: [
            {
              domain: "school_iep",
              rationale:
                "You mentioned school, an IEP, or help with reading."
            }
          ],
          followUps: []
        },
        { extraction: "live", source: "mixed", rawText }
      )
    );
    expect(requestFamilyInterview).toHaveBeenCalledTimes(1);
    expect(requestFamilyInterview).toHaveBeenCalledWith(expect.objectContaining({ text: rawText }));
    expect(onExtracted).toHaveBeenCalledTimes(1);
    expect(onDraftChange).toHaveBeenLastCalledWith(rawText);
  });

  it("guards a rapid double submit with one provider request and one callback", async () => {
    const pending = deferred<null>();
    requestFamilyInterview.mockReturnValueOnce(pending.promise);
    const onExtracted = vi.fn();
    renderInterview({ onExtracted });
    const form = screen.getByLabelText(/what would you like help with/i).closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(requestFamilyInterview).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve(null));
    await waitFor(() => expect(onExtracted).toHaveBeenCalledTimes(1));
    expect(onExtracted).toHaveBeenCalledWith(expect.any(Object), {
      extraction: "mock",
      source: "typed",
      rawText: SAMPLE_CAREGIVER_TEXT
    });
  });

  it("invalidates a pending submission when its external draft is replaced and reconciles the latest draft", async () => {
    const draftA = "Riley was diagnosed with dyslexia.";
    const draftB = "Casey is in grade 4.";
    const profileA = { ...schoolAgeFamilyState.profile!, childFirstName: "Riley" };
    const profileB = profileA;
    const pending = deferred<null>();
    requestFamilyInterview.mockReturnValueOnce(pending.promise);
    const onDraftChange = vi.fn();
    const onExtracted = vi.fn();
    const baseProps = {
      passcode: "secret",
      liveAllowed: true,
      language: "en" as const,
      onDraftChange,
      onExtracted
    };
    const { rerender } = render(<FamilyInterview {...baseProps} draft={draftA} profile={profileA} />);

    fireEvent.click(screen.getByRole("button", { name: /find help/i }));
    rerender(<FamilyInterview {...baseProps} draft={draftB} profile={profileB} />);
    expect(screen.getByRole("textbox", { name: /what would you like help with/i })).toHaveValue(draftA);

    await act(async () => pending.resolve(null));
    await waitFor(() => expect(screen.getByRole("textbox", { name: /what would you like help with/i })).toHaveValue(draftB));
    expect(onExtracted).not.toHaveBeenCalled();
    expect(requestFamilyInterview.mock.calls[0][0]).toEqual(
      expect.objectContaining({ text: draftA, profile: profileA })
    );

    fireEvent.click(screen.getByRole("button", { name: /find help/i }));
    await waitFor(() => expect(onExtracted).toHaveBeenCalledTimes(1));
    expect(requestFamilyInterview.mock.calls[1][0]).toEqual(
      expect.objectContaining({ text: draftB, profile: profileB })
    );
    expect(onExtracted.mock.calls[0]).toEqual([
      {
        facts: [
          { label: "Grade", value: "grade 4", sourceSnippet: "grade 4" },
          {
            label: "About school and learning",
            value: "You wrote about school and learning",
            sourceSnippet: draftB
          }
        ],
        domains: [{ domain: "school_iep", rationale: "You mentioned school, an IEP, or help with reading." }],
        followUps: [
          {
            question: "What has the school offered so far?",
            options: ["Nothing yet", "A meeting is planned", "An evaluation was done"]
          }
        ]
      },
      { extraction: "mock", source: "typed", rawText: draftB }
    ]);
  });

  it("invalidates a pending submission when the profile is replaced without changing the draft", async () => {
    const draft = "Riley is in fourth grade.";
    const profileA = { ...schoolAgeFamilyState.profile!, childFirstName: "Riley" };
    const profileB = { ...schoolAgeFamilyState.profile!, childFirstName: "Casey", county: "Perry" };
    const pending = deferred<null>();
    requestFamilyInterview.mockReturnValueOnce(pending.promise);
    const onExtracted = vi.fn();
    const baseProps = {
      draft,
      passcode: "secret",
      liveAllowed: true,
      language: "en" as const,
      onDraftChange: vi.fn(),
      onExtracted
    };
    const { rerender } = render(<FamilyInterview {...baseProps} profile={profileA} />);

    fireEvent.click(screen.getByRole("button", { name: /find help/i }));
    rerender(<FamilyInterview {...baseProps} profile={profileB} />);
    await act(async () => pending.resolve(null));

    await waitFor(() => expect(screen.getByRole("button", { name: /find help/i })).toBeEnabled());
    expect(onExtracted).not.toHaveBeenCalled();
  });
});

describe("live result reconciliation", () => {
  it("replaces F01's professional speech snippet with Theo's direct words", () => {
    const text =
      "Theo is two. He says mama and no, but not much else, and he still falls a lot when he walks. His doctor said speech and physical therapy could help. I’m his grandmother and I don’t drive, so we need a ride to appointments. I need somebody to tell me who to call first.";
    const profile: FamilyProfile = {
      childFirstName: "Theo",
      birthYear: 2024,
      birthMonth: 5,
      schoolStage: "not_school_age",
      county: "Pike",
      diagnoses: []
    };
    const sanitized = sanitizeResult(
      liveInterviewResult(
        [
          {
            label: "About talking",
            value: "Talking may need support",
            sourceSnippet:
              "His doctor said speech and physical therapy could help."
          }
        ],
        ["therapies"]
      ),
      profile,
      text,
      "en",
      FIXED_NOW
    );
    const talking = sanitized.facts.find(
      ({ label }) => label === "About talking"
    );

    expect(talking?.sourceSnippet).toContain("mama and no");
    expect(talking?.sourceSnippet).not.toMatch(/doctor/i);
    expect(sanitized.domains.map(({ domain }) => domain)).toEqual([
      "early_intervention",
      "therapies",
      "transportation"
    ]);
  });

  it("removes F06's fabricated child facts and rebuilds its follow-up", () => {
    const text =
      "Sam is seven. He already goes to speech and occupational therapy. I need a break sometimes, his sister needs support too, and I’d like a sports or recreation program where they both feel welcome. Reading long pages is hard for me, so please keep it short.";
    const profile: FamilyProfile = {
      childFirstName: "Sam",
      birthYear: 2019,
      schoolStage: "elementary",
      county: "Fayette",
      diagnoses: []
    };
    const sanitized = sanitizeResult(
      liveInterviewResult(
        [
          {
            label: "About talking",
            value: "Sam needs speech therapy",
            sourceSnippet: "Invented speech difficulty"
          },
          {
            label: "About moving",
            value: "Sam needs occupational therapy",
            sourceSnippet: "Invented motor difficulty"
          },
          {
            label: "About school and learning",
            value: "Sam needs reading help",
            sourceSnippet: "Invented school difficulty"
          },
          {
            label: "Access status",
            value: "Waiting for speech therapy",
            sourceSnippet: "Provider-created wait"
          },
          {
            label: "Grade",
            value: "Sam needs speech therapy",
            sourceSnippet:
              "Invented speech difficulty disguised as Grade"
          }
        ],
        ["therapies", "school_iep"],
        [
          {
            question: "What kind of therapy does Sam still need?",
            options: ["Speech", "Occupational"]
          }
        ]
      ),
      profile,
      text,
      "en",
      FIXED_NOW
    );

    expect(sanitized.facts).toEqual([]);
    expect(sanitized.domains).toEqual([
      {
        domain: "respite",
        rationale: "You said you need a break from caregiving."
      },
      {
        domain: "parent_support",
        rationale:
          "You said you feel overwhelmed or unsure where to start."
      },
      {
        domain: "sibling_support",
        rationale: "You asked about help for a brother or sister."
      },
      {
        domain: "recreation",
        rationale:
          "You asked about clubs, sports, horses, or things to do."
      }
    ]);
    expect(sanitized.followUps).toEqual([
      {
        question: "Who can take over for a few hours?",
        options: [
          "No one right now",
          "Family sometimes",
          "A paid helper"
        ]
      }
    ]);
  });

  it("removes Spanish current-service and caregiver-self live facts", () => {
    const text =
      "Sam tiene siete años. Actualmente recibe terapia del habla y terapia ocupacional. Necesito un descanso a veces, su hermana también necesita apoyo, y me gustaría un programa de deportes o recreación donde ambos se sientan bienvenidos. Me cuesta leer páginas largas, así que por favor sea breve.";
    const profile: FamilyProfile = {
      childFirstName: "Sam",
      birthYear: 2019,
      schoolStage: "elementary",
      county: "Fayette",
      diagnoses: []
    };
    const sanitized = sanitizeResult(
      liveInterviewResult(
        [
          {
            label: "Sobre el habla",
            value: "Sam necesita terapia del habla",
            sourceSnippet: "Dificultad inventada del habla"
          },
          {
            label: "Sobre el movimiento",
            value: "Sam necesita terapia ocupacional",
            sourceSnippet: "Dificultad motora inventada"
          },
          {
            label: "Sobre la escuela y el aprendizaje",
            value: "Sam necesita apoyo de lectura",
            sourceSnippet: "Dificultad escolar inventada"
          },
          {
            label: "Estado de acceso",
            value: "Esperando terapia del habla",
            sourceSnippet: "Espera creada por el proveedor"
          },
          {
            label: "Grado",
            value: "Sam necesita terapia del habla",
            sourceSnippet:
              "Dificultad inventada disfrazada de grado"
          }
        ],
        ["therapies", "school_iep"]
      ),
      profile,
      text,
      "es",
      FIXED_NOW
    );

    expect(sanitized.facts).toEqual([]);
    expect(sanitized.domains).toEqual([
      {
        domain: "respite",
        rationale: "Dijiste que necesitas un descanso del cuidado."
      },
      {
        domain: "parent_support",
        rationale:
          "Dijiste que te sientes abrumada o que no sabes por dónde empezar."
      },
      {
        domain: "sibling_support",
        rationale: "Preguntaste por ayuda para un hermano o hermana."
      },
      {
        domain: "recreation",
        rationale:
          "Preguntaste por clubes, deportes, caballos o actividades."
      }
    ]);
    expect(sanitized.followUps).toEqual([
      {
        question: "¿Quién puede encargarse por unas horas?",
        options: [
          "Nadie por ahora",
          "A veces la familia",
          "Una persona de apoyo pagada"
        ]
      }
    ]);
  });

  it.each([
    ["I go to speech therapy.", "en", "About talking"],
    ["I see a speech therapist.", "en", "About talking"],
    ["I am in speech therapy.", "en", "About talking"],
    ["I completed speech therapy.", "en", "About talking"],
    ["Voy a terapia del habla.", "es", "Sobre el habla"],
    ["Veo a una terapeuta del habla.", "es", "Sobre el habla"],
    ["Estoy en terapia del habla.", "es", "Sobre el habla"],
    ["Terminé terapia del habla.", "es", "Sobre el habla"]
  ] as const)(
    "removes adversarial child therapy recall for caregiver current/history grammar: %s",
    (text, language, speechLabel) => {
      const providerSource = "Provider-created child speech need";
      const sanitized = sanitizeResult(
        liveInterviewResult(
          [
            {
              label: speechLabel,
              value: "Speech therapy is needed",
              sourceSnippet: providerSource
            }
          ],
          ["therapies"]
        ),
        schoolAgeFamilyState.profile!,
        text,
        language,
        FIXED_NOW
      );

      expect(
        sanitized.facts.some(
          ({ sourceSnippet }) => sourceSnippet === providerSource
        )
      ).toBe(false);
      expect(
        sanitized.domains.some(({ domain }) => domain === "therapies")
      ).toBe(false);
    }
  );

  it.each([
    [
      "My child needs speech therapy.",
      "en",
      "Provider therapy summary",
      "Speech and occupational therapy are needed."
    ],
    [
      "Mi hijo necesita terapia del habla.",
      "es",
      "Resumen de terapia del proveedor",
      "Se necesitan terapia del habla y terapia ocupacional."
    ]
  ] as const)(
    "drops a requested live fact when any claimed target is locally absent: %s",
    (text, language, liveLabel, providerSource) => {
      const sanitized = sanitizeResult(
        liveInterviewResult(
          [
            {
              label: liveLabel,
              value: providerSource,
              sourceSnippet: providerSource
            }
          ],
          []
        ),
        schoolAgeFamilyState.profile!,
        text,
        language,
        FIXED_NOW
      );

      expect(
        sanitized.facts.some(
          ({ sourceSnippet }) => sourceSnippet === providerSource
        )
      ).toBe(false);
    }
  );

  it.each([
    ["Mary Jane currently needs OT.", "Mary Jane", "en"],
    ["Mary Jane needs OT.", "Mary Jane", "en"],
    [
      "María José actualmente necesita terapia del habla.",
      "María José",
      "es"
    ],
    ["María José necesita terapia del habla.", "María José", "es"],
    [
      "Mary Jane currently needs speech and occupational therapy.",
      "Mary Jane",
      "en"
    ],
    [
      "María José actualmente necesita terapia del habla y terapia ocupacional.",
      "María José",
      "es"
    ],
    ["Mary Jane is looking for OT.", "Mary Jane", "en"],
    ["María José busca terapia del habla.", "María José", "es"],
    ["He is looking for OT.", "Alex", "en"],
    ["Ella está buscando terapia ocupacional.", "Alex", "es"],
    ["Mary Jane needs OT for Alex.", "Alex", "en"],
    [
      "María José necesita terapia del habla para Alex.",
      "Alex",
      "es"
    ],
    ["My child currently needs occupational therapy.", "Alex", "en"],
    ["Mi hijo actualmente necesita terapia del habla.", "Alex", "es"],
    ["My child needs speech and occupational therapy.", "Alex", "en"],
    [
      "Mi hijo necesita terapia del habla y terapia ocupacional.",
      "Alex",
      "es"
    ]
  ] as const)(
    "keeps explicit child-subject service requests and beneficiaries supported through live reconciliation: %s",
    (text, childFirstName, language) => {
      const profile: FamilyProfile = {
        ...schoolAgeFamilyState.profile!,
        childFirstName
      };
      const sanitized = sanitizeResult(
        liveInterviewResult([], []),
        profile,
        text,
        language,
        FIXED_NOW
      );

      expect(sanitized.domains.map(({ domain }) => domain)).toEqual([
        "therapies"
      ]);
    }
  );

  it.each([
    ["Mary Jane currently needs OT.", "en"],
    [
      "Mary Jane currently needs speech and occupational therapy.",
      "en"
    ],
    ["María José actualmente necesita terapia del habla.", "es"],
    [
      "María José actualmente necesita terapia del habla y terapia ocupacional.",
      "es"
    ],
    ["Mary Jane is looking for OT.", "en"],
    ["María José busca terapia del habla.", "es"]
  ] as const)(
    "does not assign an unmatched named service request to the profile child: %s",
    (text, language) => {
      const sanitized = sanitizeResult(
        liveInterviewResult([], ["therapies"]),
        {
          ...schoolAgeFamilyState.profile!,
          childFirstName: "Alex"
        },
        text,
        language,
        FIXED_NOW
      );

      expect(sanitized.facts).toEqual([]);
      expect(sanitized.domains).toEqual([]);
    }
  );

  it.each([
    ["I say hello, but not much else.", "en", "About talking", null],
    ["Yo digo hola, pero nada más.", "es", "Sobre el habla", null],
    [
      "He says hello, but not much else.",
      "en",
      "About talking",
      "He says hello"
    ],
    [
      "Él dice hola, pero nada más.",
      "es",
      "Sobre el habla",
      "Él dice hola"
    ]
  ] as const)(
    "binds an elliptical limited-language tail through live reconciliation: %s",
    (text, language, speechLabel, childSnippet) => {
      const providerSource = "Provider-created child speech need";
      const sanitized = sanitizeResult(
        liveInterviewResult(
          [
            {
              label: speechLabel,
              value: "Speech support is needed",
              sourceSnippet: providerSource
            }
          ],
          ["therapies"]
        ),
        schoolAgeFamilyState.profile!,
        text,
        language,
        FIXED_NOW
      );
      const localSpeech = sanitized.facts.find(
        ({ label, sourceSnippet }) =>
          label === speechLabel && sourceSnippet !== providerSource
      );

      expect(
        sanitized.facts.some(
          ({ sourceSnippet }) => sourceSnippet === providerSource
        )
      ).toBe(false);
      expect(localSpeech?.sourceSnippet ?? null).toBe(childSnippet);
      expect(
        sanitized.domains.some(({ domain }) => domain === "therapies")
      ).toBe(childSnippet !== null);
    }
  );

  it("removes L01's positive-only Spanish therapy output", () => {
    const text =
      "Este mes la maestra dice que las transiciones siguen siendo difíciles, pero Sofía está usando más palabras con una amiga.";
    const profile: FamilyProfile = {
      childFirstName: "Sofía",
      birthYear: 2018,
      schoolStage: "elementary",
      county: "Jefferson",
      diagnoses: []
    };
    const sanitized = sanitizeResult(
      liveInterviewResult(
        [
          {
            label: "Sobre el habla",
            value: "El habla puede necesitar apoyo",
            sourceSnippet: "Sofía necesita terapia"
          }
        ],
        ["therapies"],
        [
          {
            question: "¿Qué terapia necesita Sofía?",
            options: ["Habla"]
          }
        ]
      ),
      profile,
      text,
      "es",
      FIXED_NOW
    );

    expect(sanitized.facts).toEqual([
      {
        label: "Sobre la escuela y el aprendizaje",
        value: "Escribiste sobre la escuela y el aprendizaje",
        sourceSnippet:
          "Este mes la maestra dice que las transiciones siguen siendo difíciles"
      }
    ]);
    expect(sanitized.domains).toEqual([
      {
        domain: "school_iep",
        rationale:
          "Mencionaste la escuela, un IEP o ayuda con la lectura."
      }
    ]);
    expect(sanitized.followUps).toEqual([
      {
        question: "¿Qué ha ofrecido la escuela hasta ahora?",
        options: [
          "Nada todavía",
          "Hay una reunión planeada",
          "Ya hicieron una evaluación"
        ]
      }
    ]);
  });

  it("adds L03's literal burden and evaluation details to shallow live output", () => {
    const text =
      "Maya is ten and in fifth grade. Her teacher and I are concerned about dyslexia and ADHD, but she has not been diagnosed. Reading and homework take hours, and we are waiting for an evaluation.";
    const profile: FamilyProfile = {
      childFirstName: "Maya",
      birthYear: 2016,
      schoolStage: "elementary",
      county: "Fayette",
      diagnoses: []
    };
    const sanitized = sanitizeResult(
      liveInterviewResult(
        [
          {
            label: "Grade",
            value: "fifth grade",
            sourceSnippet: "fifth grade"
          }
        ],
        ["school_iep"]
      ),
      profile,
      text,
      "en",
      FIXED_NOW
    );

    expect(sanitized.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Impact on daily life",
          sourceSnippet: "Reading and homework take hours"
        }),
        expect.objectContaining({
          label: "Evaluation status",
          sourceSnippet: "we are waiting for an evaluation."
        })
      ])
    );
    expect(
      sanitized.facts.some(
        ({ label }) => label === "Reported diagnosis"
      )
    ).toBe(false);
  });

  it.each([
    [
      "He completed occupational therapy last year and does not need it now.",
      {
        facts: [],
        domains: [],
        followUps: [
          {
            question: "What part of a typical day is hardest?",
            options: ["Mornings", "Afternoons", "Bedtime"]
          },
          {
            question: "Who helps your family right now?",
            options: ["No one", "Family or friends", "A professional"]
          }
        ]
      }
    ],
    [
      "His therapist stopped coming and we still need OT.",
      {
        facts: [],
        domains: [
          {
            domain: "therapies",
            rationale: "You mentioned speech, talking, or therapy."
          }
        ],
        followUps: []
      }
    ]
  ] as const)(
    "reconciles historical and lost therapy differently: %s",
    (text, expected) => {
      const sanitized = sanitizeResult(
        liveInterviewResult(
          [
            {
              label: "About moving",
              value: "Moving may need support",
              sourceSnippet: "Provider-created motor need"
            }
          ],
          ["therapies"]
        ),
        schoolAgeFamilyState.profile!,
        text,
        "en",
        FIXED_NOW
      );
      expect(sanitized).toEqual(expected);
    }
  );

  it("preserves unrelated safe live recall when local support is absent", () => {
    const fact = {
      label: "Family logistics",
      value: "Appointment planning may help",
      sourceSnippet: "Provider summary"
    };
    const followUp = {
      question: "Who helps coordinate appointments?",
      options: ["Family", "Clinic"]
    };
    const sanitized = sanitizeResult(
      liveInterviewResult([fact], ["transportation"], [followUp]),
      schoolAgeFamilyState.profile!,
      "We need help keeping track of appointments.",
      "en",
      FIXED_NOW
    );

    expect(sanitized.facts).toEqual([fact]);
    expect(sanitized.domains.map(({ domain }) => domain)).toEqual([
      "transportation"
    ]);
    expect(sanitized.followUps).toEqual([followUp]);
  });

  it("uses the injected clock for early-intervention reconciliation", () => {
    const profile: FamilyProfile = {
      childFirstName: "Avery",
      birthYear: 2024,
      birthMonth: 8,
      schoolStage: "not_school_age",
      county: "Fayette",
      diagnoses: []
    };
    const live = liveInterviewResult(
      [],
      ["early_intervention", "therapies"]
    );
    const text = "My child has trouble talking.";

    expect(
      sanitizeResult(
        live,
        profile,
        text,
        "en",
        new Date("2026-07-30T12:00:00.000Z")
      ).domains.map(({ domain }) => domain)
    ).toEqual(["early_intervention", "therapies"]);
    expect(
      sanitizeResult(
        live,
        profile,
        text,
        "en",
        new Date("2030-07-30T12:00:00.000Z")
      ).domains.map(({ domain }) => domain)
    ).toEqual(["therapies"]);
  });

  it("removes live early intervention for physical-therapy-only text", () => {
    const profile: FamilyProfile = {
      childFirstName: "Avery",
      birthYear: 2024,
      birthMonth: 8,
      schoolStage: "not_school_age",
      county: "Fayette",
      diagnoses: []
    };
    const sanitized = sanitizeResult(
      liveInterviewResult(
        [],
        ["early_intervention", "therapies"]
      ),
      profile,
      "We need physical therapy.",
      "en",
      FIXED_NOW
    );
    expect(sanitized.domains.map(({ domain }) => domain)).toEqual([
      "therapies"
    ]);
  });

  it("reconciles deterministic fallback idempotently", () => {
    const text = "My child has trouble talking and needs a ride.";
    const profile: FamilyProfile = {
      childFirstName: "Avery",
      birthYear: 2024,
      birthMonth: 8,
      schoolStage: "not_school_age",
      county: "Fayette",
      diagnoses: []
    };
    const local = extractFamilyInterviewMock(
      text,
      profile,
      FIXED_NOW,
      "en"
    );

    expect(
      sanitizeResult(local, profile, text, "en", FIXED_NOW)
    ).toEqual(local);
  });

  it.each([
    [
      "He stopped talking, and he currently receives physical therapy.",
      "en",
      "About moving",
      {
        question: "Has anyone talked with you about therapy visits?",
        options: ["Not yet", "We are on a list", "We go now"]
      }
    ],
    [
      "Él dejó de hablar, y actualmente recibe terapia física.",
      "es",
      "Sobre el movimiento",
      {
        question: "¿Alguien te ha hablado sobre visitas de terapia?",
        options: ["Todavía no", "Estamos en una lista", "Vamos ahora"]
      }
    ]
  ] as const)(
    "targets regression from its own clause rather than another modality: %s",
    (text, language, motorLabel, expectedFollowUp) => {
      const sanitized = sanitizeResult(
        liveInterviewResult(
          [
            {
              label: motorLabel,
              value: "Provider-created motor regression",
              sourceSnippet: "Provider-created motor regression"
            }
          ],
          ["therapies"],
          [
            {
              question: "Provider follow-up that must be replaced",
              options: ["Provider option"]
            }
          ]
        ),
        schoolAgeFamilyState.profile!,
        text,
        language,
        FIXED_NOW
      );

      expect(
        sanitized.facts.some(
          ({ sourceSnippet }) =>
            sourceSnippet === "Provider-created motor regression"
        )
      ).toBe(false);
      expect(sanitized.followUps).toEqual([expectedFollowUp]);
    }
  );

  it.each([
    [
      "He used to talk while walking but now he no longer talks.",
      "en",
      "About talking",
      "About moving"
    ],
    [
      "Antes hablaba mientras caminaba pero ya no habla.",
      "es",
      "Sobre el habla",
      "Sobre el movimiento"
    ],
    [
      "He used to walk while talking but now he no longer walks.",
      "en",
      "About moving",
      "About talking"
    ],
    [
      "Antes caminaba mientras hablaba pero ya no camina.",
      "es",
      "Sobre el movimiento",
      "Sobre el habla"
    ],
    [
      "He forgot how to climb the stairs.",
      "en",
      "About moving",
      "About talking"
    ],
    [
      "Olvidó cómo subir las escaleras.",
      "es",
      "Sobre el movimiento",
      "Sobre el habla"
    ]
  ] as const)(
    "reconciles regression by its acquired-skill verb: %s",
    (text, language, regressionTargetLabel, contextualLabel) => {
      const regressionTargetSource = "Provider regression target";
      const contextualSource = "Provider contextual modality";
      const sanitized = sanitizeResult(
        liveInterviewResult(
          [
            {
              label: regressionTargetLabel,
              value: regressionTargetSource,
              sourceSnippet: regressionTargetSource
            },
            {
              label: contextualLabel,
              value: contextualSource,
              sourceSnippet: contextualSource
            }
          ],
          []
        ),
        schoolAgeFamilyState.profile!,
        text,
        language,
        FIXED_NOW
      );

      expect(
        sanitized.facts.some(
          ({ sourceSnippet }) =>
            sourceSnippet === regressionTargetSource
        )
      ).toBe(false);
      expect(
        sanitized.facts.some(
          ({ sourceSnippet }) => sourceSnippet === contextualSource
        )
      ).toBe(true);
    }
  );

  it.each([
    [
      "I stopped talking, but he stopped walking.",
      "en",
      "he stopped walking.",
      "Change you noticed",
      "Possible loss of skills — from your words"
    ],
    [
      "He stopped walking, but I stopped talking.",
      "en",
      "He stopped walking",
      "Change you noticed",
      "Possible loss of skills — from your words"
    ],
    [
      "Dejé de hablar, pero él dejó de caminar.",
      "es",
      "él dejó de caminar.",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras"
    ],
    [
      "Él dejó de caminar, pero yo dejé de hablar.",
      "es",
      "Él dejó de caminar",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras"
    ],
    [
      "I used to talk with him, but he no longer does.",
      "en",
      "I used to talk with him, but he no longer does.",
      "Change you noticed",
      "Possible loss of skills — from your words"
    ],
    [
      "I used to talk with him, but now he no longer does.",
      "en",
      "I used to talk with him, but now he no longer does.",
      "Change you noticed",
      "Possible loss of skills — from your words"
    ],
    [
      "Yo antes hablaba con él, pero él ya no.",
      "es",
      "Yo antes hablaba con él, pero él ya no.",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras"
    ],
    [
      "Yo antes hablaba con él, pero ahora él ya no.",
      "es",
      "Yo antes hablaba con él, pero ahora él ya no.",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras"
    ]
  ] as const)(
    "keeps child regression authoritative beside caregiver regression: %s",
    (
      text,
      language,
      childSnippet,
      regressionLabel,
      regressionValue
    ) => {
      const providerSource =
        "Provider-created mixed-actor regression";
      const sanitized = sanitizeResult(
        liveInterviewResult(
          [
            {
              label: regressionLabel,
              value: regressionValue,
              sourceSnippet: providerSource
            }
          ],
          ["therapies"]
        ),
        schoolAgeFamilyState.profile!,
        text,
        language,
        FIXED_NOW
      );

      expect(
        sanitized.facts.some(
          ({ sourceSnippet }) => sourceSnippet === providerSource
        )
      ).toBe(false);
      expect(
        sanitized.facts.some(
          ({ label, sourceSnippet }) =>
            label === regressionLabel &&
            sourceSnippet === childSnippet
        )
      ).toBe(true);
      expect(sanitized.domains.map(({ domain }) => domain)).toEqual([
        "therapies"
      ]);
    }
  );

  it.each([
    [
      "He lost skills.",
      "en",
      "Change you noticed",
      "Possible loss of skills — from your words",
      "Provider says words were lost."
    ],
    [
      "Perdió habilidades.",
      "es",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras",
      "El proveedor dice que perdió palabras."
    ],
    [
      "He stopped talking.",
      "en",
      "Change you noticed",
      "Possible loss of skills — from your words",
      "Provider says words were lost."
    ],
    [
      "Él dejó de hablar.",
      "es",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras",
      "El proveedor dice que perdió palabras."
    ],
    [
      "He forgot how to climb the stairs.",
      "en",
      "Change you noticed",
      "Possible loss of skills — from your words",
      "Provider says words were lost."
    ],
    [
      "Olvidó cómo subir las escaleras.",
      "es",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras",
      "El proveedor dice que perdió palabras."
    ]
  ] as const)(
    "replaces exact live regression evidence with the local literal fact: %s",
    (
      text,
      language,
      regressionLabel,
      regressionValue,
      providerSource
    ) => {
      const sanitized = sanitizeResult(
        liveInterviewResult(
          [
            {
              label: regressionLabel,
              value: regressionValue,
              sourceSnippet: providerSource
            }
          ],
          []
        ),
        schoolAgeFamilyState.profile!,
        text,
        language,
        FIXED_NOW
      );

      expect(
        sanitized.facts.some(
          ({ sourceSnippet }) => sourceSnippet === providerSource
        )
      ).toBe(false);
      expect(
        sanitized.facts.some(
          ({ label, sourceSnippet }) =>
            label === regressionLabel && sourceSnippet === text
        )
      ).toBe(true);
    }
  );

  it.each([
    [
      "I stopped talking after my stroke.",
      "en",
      "Change you noticed",
      "Possible loss of skills — from your words"
    ],
    [
      "I had a stroke and stopped talking.",
      "en",
      "Change you noticed",
      "Possible loss of skills — from your words"
    ],
    [
      "I had a stroke, and then stopped talking.",
      "en",
      "Change you noticed",
      "Possible loss of skills — from your words"
    ],
    [
      "I stopped saying words.",
      "en",
      "Change you noticed",
      "Possible loss of skills — from your words"
    ],
    [
      "I no longer talk.",
      "en",
      "Change you noticed",
      "Possible loss of skills — from your words"
    ],
    [
      "I used to talk but no longer do.",
      "en",
      "Change you noticed",
      "Possible loss of skills — from your words"
    ],
    [
      "He used to talk with me, but I no longer do.",
      "en",
      "Change you noticed",
      "Possible loss of skills — from your words"
    ],
    [
      "He used to talk with me, but now I no longer do.",
      "en",
      "Change you noticed",
      "Possible loss of skills — from your words"
    ],
    [
      "I currently receive speech therapy and stopped talking.",
      "en",
      "Change you noticed",
      "Possible loss of skills — from your words"
    ],
    [
      "I lost words.",
      "en",
      "Change you noticed",
      "Possible loss of skills — from your words"
    ],
    [
      "I lost skills.",
      "en",
      "Change you noticed",
      "Possible loss of skills — from your words"
    ],
    [
      "I forgot how to walk.",
      "en",
      "Change you noticed",
      "Possible loss of skills — from your words"
    ],
    [
      "Dejé de hablar después de mi derrame cerebral.",
      "es",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras"
    ],
    [
      "Tuve un derrame cerebral y dejé de hablar.",
      "es",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras"
    ],
    [
      "Tuve un derrame cerebral, y luego dejé de hablar.",
      "es",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras"
    ],
    [
      "Dejé de decir palabras.",
      "es",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras"
    ],
    [
      "Ya no hablo.",
      "es",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras"
    ],
    [
      "Yo antes hablaba pero ya no.",
      "es",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras"
    ],
    [
      "Él antes hablaba conmigo, pero yo ya no.",
      "es",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras"
    ],
    [
      "Él antes hablaba conmigo, pero ahora yo ya no.",
      "es",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras"
    ],
    [
      "Actualmente recibo terapia del habla y dejé de hablar.",
      "es",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras"
    ],
    [
      "Perdí palabras.",
      "es",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras"
    ],
    [
      "Perdí habilidades.",
      "es",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras"
    ],
    [
      "Olvidé cómo caminar.",
      "es",
      "Cambio que notaste",
      "Posible pérdida de habilidades — según tus palabras"
    ]
  ] as const)(
    "drops exact live regression recall when the loss belongs to the caregiver: %s",
    (text, language, regressionLabel, regressionValue) => {
      const providerSource = "Provider-created child regression";
      const sanitized = sanitizeResult(
        liveInterviewResult(
          [
            {
              label: regressionLabel,
              value: regressionValue,
              sourceSnippet: providerSource
            }
          ],
          []
        ),
        schoolAgeFamilyState.profile!,
        text,
        language,
        FIXED_NOW
      );

      expect(
        sanitized.facts.some(
          ({ sourceSnippet }) => sourceSnippet === providerSource
        )
      ).toBe(false);
      expect(
        sanitized.facts.some(({ label }) => label === regressionLabel)
      ).toBe(false);
    }
  );

  it.each([
    [
      "I stopped talking after my stroke.",
      "en",
      "About talking",
      "Provider-created child speech regression"
    ],
    [
      "I had a stroke and stopped talking.",
      "en",
      "About talking",
      "Provider-created child speech regression"
    ],
    [
      "I had a stroke, and then stopped talking.",
      "en",
      "About talking",
      "Provider-created child speech regression"
    ],
    [
      "I stopped saying words.",
      "en",
      "About talking",
      "Provider-created child speech regression"
    ],
    [
      "I no longer talk.",
      "en",
      "About talking",
      "Provider-created child speech regression"
    ],
    [
      "I currently receive speech therapy and stopped talking.",
      "en",
      "About talking",
      "Provider-created child speech regression"
    ],
    [
      "I forgot how to walk.",
      "en",
      "About moving",
      "Provider-created child motor regression"
    ],
    [
      "Dejé de hablar después de mi derrame cerebral.",
      "es",
      "Sobre el habla",
      "Regresión del habla creada por el proveedor"
    ],
    [
      "Tuve un derrame cerebral y dejé de hablar.",
      "es",
      "Sobre el habla",
      "Regresión del habla creada por el proveedor"
    ],
    [
      "Tuve un derrame cerebral, y luego dejé de hablar.",
      "es",
      "Sobre el habla",
      "Regresión del habla creada por el proveedor"
    ],
    [
      "Dejé de decir palabras.",
      "es",
      "Sobre el habla",
      "Regresión del habla creada por el proveedor"
    ],
    [
      "Ya no hablo.",
      "es",
      "Sobre el habla",
      "Regresión del habla creada por el proveedor"
    ],
    [
      "Actualmente recibo terapia del habla y dejé de hablar.",
      "es",
      "Sobre el habla",
      "Regresión del habla creada por el proveedor"
    ],
    [
      "Olvidé cómo caminar.",
      "es",
      "Sobre el movimiento",
      "Regresión motora creada por el proveedor"
    ]
  ] as const)(
    "drops target-specific live recall and its domain for caregiver regression: %s",
    (text, language, liveLabel, providerSource) => {
      const sanitized = sanitizeResult(
        liveInterviewResult(
          [
            {
              label: liveLabel,
              value: providerSource,
              sourceSnippet: providerSource
            }
          ],
          ["therapies"]
        ),
        schoolAgeFamilyState.profile!,
        text,
        language,
        FIXED_NOW
      );

      expect(
        sanitized.facts.some(
          ({ sourceSnippet }) => sourceSnippet === providerSource
        )
      ).toBe(false);
      expect(sanitized.domains.map(({ domain }) => domain)).toEqual([]);
    }
  );

  it.each([
    [
      "He currently receives speech therapy.",
      "en",
      "Provider therapy summary",
      "Speech and occupational therapy are needed."
    ],
    [
      "Actualmente recibe terapia del habla.",
      "es",
      "Resumen de terapia del proveedor",
      "Se necesitan terapia del habla y terapia ocupacional."
    ],
    [
      "He currently receives occupational therapy.",
      "en",
      "About talking",
      "Speech and occupational therapy are needed."
    ],
    [
      "Actualmente recibe terapia ocupacional.",
      "es",
      "Sobre el habla",
      "Se necesitan terapia del habla y terapia ocupacional."
    ]
  ] as const)(
    "drops a mixed live fact when any claimed target is locally contradicted: %s",
    (text, language, liveLabel, providerSource) => {
      const sanitized = sanitizeResult(
        liveInterviewResult(
          [
            {
              label: liveLabel,
              value: providerSource,
              sourceSnippet: providerSource
            }
          ],
          []
        ),
        schoolAgeFamilyState.profile!,
        text,
        language,
        FIXED_NOW
      );

      expect(
        sanitized.facts.some(
          ({ sourceSnippet }) => sourceSnippet === providerSource
        )
      ).toBe(false);
    }
  );

  it.each([
    [
      "We need help keeping track of appointments.",
      "en",
      "Provider therapy summary",
      "Speech and occupational therapy are needed."
    ],
    [
      "Necesitamos ayuda para organizar las citas.",
      "es",
      "Resumen de terapia del proveedor",
      "Se necesitan terapia del habla y terapia ocupacional."
    ],
    [
      "We need help keeping track of appointments.",
      "en",
      "About talking",
      "Speech and occupational therapy are needed."
    ],
    [
      "Necesitamos ayuda para organizar las citas.",
      "es",
      "Sobre el habla",
      "Se necesitan terapia del habla y terapia ocupacional."
    ]
  ] as const)(
    "retains a mixed live fact only when every claimed target is locally absent: %s",
    (text, language, liveLabel, providerSource) => {
      const sanitized = sanitizeResult(
        liveInterviewResult(
          [
            {
              label: liveLabel,
              value: providerSource,
              sourceSnippet: providerSource
            }
          ],
          []
        ),
        schoolAgeFamilyState.profile!,
        text,
        language,
        FIXED_NOW
      );

      expect(
        sanitized.facts.some(
          ({ sourceSnippet }) => sourceSnippet === providerSource
        )
      ).toBe(true);
    }
  );

  it.each([
    [
      "I need my own speech therapy and OT for my son.",
      "en",
      "About talking",
      "Provider caregiver speech claim",
      "About moving",
      "Provider child motor claim",
      ["therapies"]
    ],
    [
      "I need OT for my son and my own speech therapy.",
      "en",
      "About talking",
      "Provider caregiver speech claim",
      "About moving",
      "Provider child motor claim",
      ["therapies"]
    ],
    [
      "Necesito mi propia terapia del habla y terapia ocupacional para mi hijo.",
      "es",
      "Sobre el habla",
      "Afirmación del habla del cuidador",
      "Sobre el movimiento",
      "Afirmación motora del niño",
      ["therapies"]
    ],
    [
      "Necesito terapia ocupacional para mi hijo y mi propia terapia del habla.",
      "es",
      "Sobre el habla",
      "Afirmación del habla del cuidador",
      "Sobre el movimiento",
      "Afirmación motora del niño",
      ["therapies"]
    ],
    [
      "I need my own OT and speech therapy for my son.",
      "en",
      "About moving",
      "Provider caregiver motor claim",
      "About talking",
      "Provider child speech claim",
      ["early_intervention", "therapies"]
    ],
    [
      "I need speech therapy for my son and my own OT.",
      "en",
      "About moving",
      "Provider caregiver motor claim",
      "About talking",
      "Provider child speech claim",
      ["early_intervention", "therapies"]
    ],
    [
      "Necesito mi propia terapia ocupacional y terapia del habla para mi hijo.",
      "es",
      "Sobre el movimiento",
      "Afirmación motora del cuidador",
      "Sobre el habla",
      "Afirmación del habla del niño",
      ["early_intervention", "therapies"]
    ],
    [
      "Necesito terapia del habla para mi hijo y mi propia terapia ocupacional.",
      "es",
      "Sobre el movimiento",
      "Afirmación motora del cuidador",
      "Sobre el habla",
      "Afirmación del habla del niño",
      ["early_intervention", "therapies"]
    ]
  ] as const)(
    "keeps only the child-owned modality in a coordinated mixed-owner request: %s",
    (
      text,
      language,
      excludedLabel,
      excludedSource,
      supportedLabel,
      supportedSource,
      expectedDomains
    ) => {
      const profile: FamilyProfile = {
        ...schoolAgeFamilyState.profile!,
        birthYear: 2024,
        birthMonth: 8,
        schoolStage: "not_school_age"
      };
      const sanitized = sanitizeResult(
        liveInterviewResult(
          [
            {
              label: excludedLabel,
              value: excludedSource,
              sourceSnippet: excludedSource
            },
            {
              label: supportedLabel,
              value: supportedSource,
              sourceSnippet: supportedSource
            }
          ],
          ["early_intervention", "therapies"]
        ),
        profile,
        text,
        language,
        FIXED_NOW
      );

      expect(
        sanitized.facts.some(
          ({ sourceSnippet }) => sourceSnippet === excludedSource
        )
      ).toBe(false);
      expect(
        sanitized.facts.some(
          ({ sourceSnippet }) => sourceSnippet === supportedSource
        )
      ).toBe(true);
      expect(sanitized.domains.map(({ domain }) => domain)).toEqual(
        expectedDomains
      );
    }
  );

  it.each([
    [
      "I need my own speech therapy and OT forms for my son.",
      "en",
      "About moving",
      "Safe provider motor observation"
    ],
    [
      "I need my own speech therapy and OT appointments for my son.",
      "en",
      "About moving",
      "Safe provider motor observation"
    ],
    [
      "I need my own speech therapy and OT paperwork for my son.",
      "en",
      "About moving",
      "Safe provider motor observation"
    ],
    [
      "Necesito mi propia terapia del habla y formularios de terapia ocupacional para mi hijo.",
      "es",
      "Sobre el movimiento",
      "Observación motora segura del proveedor"
    ],
    [
      "Necesito mi propia terapia del habla y citas de terapia ocupacional para mi hijo.",
      "es",
      "Sobre el movimiento",
      "Observación motora segura del proveedor"
    ],
    [
      "Necesito mi propia terapia del habla y papeleo de terapia ocupacional para mi hijo.",
      "es",
      "Sobre el movimiento",
      "Observación motora segura del proveedor"
    ]
  ] as const)(
    "keeps administrative service words from excluding safe live modality recall: %s",
    (text, language, liveLabel, providerSource) => {
      const sanitized = sanitizeResult(
        liveInterviewResult(
          [
            {
              label: liveLabel,
              value: providerSource,
              sourceSnippet: providerSource
            }
          ],
          []
        ),
        schoolAgeFamilyState.profile!,
        text,
        language,
        FIXED_NOW
      );

      expect(
        sanitized.facts.some(
          ({ sourceSnippet }) => sourceSnippet === providerSource
        )
      ).toBe(true);
    }
  );

  it.each([
    ["He lost skills.", "en", "About talking", "Change you noticed"],
    [
      "Perdió habilidades.",
      "es",
      "Sobre el habla",
      "Cambio que notaste"
    ],
    [
      "He stopped pointing.",
      "en",
      "About talking",
      "Change you noticed"
    ],
    [
      "Dejó de señalar.",
      "es",
      "Sobre el habla",
      "Cambio que notaste"
    ]
  ] as const)(
    "preserves a targeted live fact when local regression names no such modality: %s",
    (text, language, liveLabel, regressionLabel) => {
      const providerSource = "Provider speech observation";
      const sanitized = sanitizeResult(
        liveInterviewResult(
          [
            {
              label: liveLabel,
              value: providerSource,
              sourceSnippet: providerSource
            }
          ],
          []
        ),
        schoolAgeFamilyState.profile!,
        text,
        language,
        FIXED_NOW
      );

      expect(
        sanitized.facts.some(
          ({ sourceSnippet }) => sourceSnippet === providerSource
        )
      ).toBe(true);
      expect(
        sanitized.facts.some(({ label }) => label === regressionLabel)
      ).toBe(true);
    }
  );
});
