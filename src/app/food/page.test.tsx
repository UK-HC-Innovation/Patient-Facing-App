/**
 * The personal door's current-choice contract (spec 30 R1, R2, A02, A03, A09, A14, A15).
 *
 * E01, reproduced here first as the failing baseline: on `/food`, typing `pizza` and then
 * `water` left pizza's verdict, its alternatives and Log this on screen, because
 * `handleTypedLine` acted on `question` and `match` and ignored `carve_out` and `none`,
 * nothing cleared `live.match`, and the typed hook held no authority.
 *
 * P0 marked all five `it.fails` as the reproduction. A1's reducer landed, so they are
 * ordinary tests now: each one fails on 5ea7f1c and passes here.
 */
import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyPatientState } from "@/domain/fixtures";
import type { AppState } from "@/domain/types";
import type { HealthAction } from "@/state/store";
import FoodPage from "./page";

const mocks = vi.hoisted(() => ({
  state: null as AppState | null,
  dispatch: vi.fn(),
  cameraStatus: "denied" as string,
  cameraStart: vi.fn(),
  cameraStop: vi.fn(),
  liveMatch: null as unknown,
  liveCandidate: null as unknown,
  adoptMatch: vi.fn(),
  rearm: vi.fn(),
  suspend: vi.fn(),
  scan: vi.fn(async () => undefined),
  sendUserText: vi.fn(),
  voiceStop: vi.fn(),
  voiceStatus: "idle" as string,
  voiceMode: "mock" as string
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));
vi.mock("@/state/store", () => ({
  useHealthState: () => ({ state: mocks.state, dispatch: mocks.dispatch })
}));
vi.mock("@/hooks/use-food-camera", () => ({
  useFoodCamera: () => ({
    videoRef: { current: null },
    status: mocks.cameraStatus,
    grabFrame: () => null,
    captureDetailedFrame: () => null,
    start: mocks.cameraStart,
    stop: mocks.cameraStop
  })
}));
vi.mock("@/hooks/use-barcode-scan", () => ({ useBarcodeScan: () => ({ scan: async () => null }) }));
vi.mock("@/hooks/use-manual-food-score", () => ({
  useManualFoodScore: () => ({
    badge: mocks.liveMatch ? "score" : "idle",
    loopState: "unavailable",
    match: mocks.liveMatch,
    candidate: mocks.liveCandidate,
    packageDetected: false,
    carveOut: null,
    noMatchCandidates: [],
    noMatch: false,
    armed: false,
    disarmReason: null,
    liveIdentifySucceeded: false,
    scanError: null,
    scan: mocks.scan,
    adoptMatch: mocks.adoptMatch,
    suspend: mocks.suspend,
    rearm: mocks.rearm,
    setVisibleRatio: () => {}
  })
}));
vi.mock("@/hooks/use-food-voice-session", () => ({
  useFoodVoiceSession: () => ({
    mode: mocks.voiceMode,
    dataMode: "on_device",
    status: mocks.voiceStatus,
    partialAssistantText: "",
    error: null,
    start: vi.fn(),
    stop: mocks.voiceStop,
    sendUserText: mocks.sendUserText
  })
}));

function applyAction(action: HealthAction): void {
  const state = mocks.state as AppState;
  if (action.type === "addAiMessage") {
    mocks.state = { ...state, aiMessages: [...state.aiMessages, action.message] };
  }
}

function identifyResponse(body: unknown) {
  return { json: () => Promise.resolve(body) };
}

const pizzaMatch = {
  food: { code: "58106000", description: "Pizza, not further specified", group: "8000_Mixed" },
  tier: "T1",
  score: {
    fcs: 22,
    band: "minimize",
    tier: "T1",
    ambiguous: false,
    range: null,
    calorieDensity: { kcalPer100g: 266, band: "medium" },
    domains: null,
    coverage: null
  },
  alternatives: [
    {
      code: "63101000",
      description: "Apple, raw",
      fcs: 95,
      calorieDensity: { kcalPer100g: 52, band: "low" }
    }
  ],
  nutrients: null
};

async function ask(text: string) {
  const user = userEvent.setup();
  const box = screen.getAllByRole("textbox")[0];
  await user.clear(box);
  await user.type(box, text);
  await user.click(screen.getByRole("button", { name: "Ask" }));
}

describe("FoodPage: one current choice", () => {
  beforeEach(() => {
    mocks.state = emptyPatientState();
    mocks.dispatch.mockReset();
    mocks.dispatch.mockImplementation(applyAction);
    mocks.liveMatch = null;
    mocks.liveCandidate = null;
    mocks.adoptMatch.mockReset();
    mocks.adoptMatch.mockImplementation((match: unknown) => {
      mocks.liveMatch = match;
    });
    mocks.sendUserText.mockReset();
    mocks.cameraStatus = "denied";
    mocks.voiceMode = "mock";
    mocks.voiceStatus = "idle";
  });

  // A02. This is E01: on 5ea7f1c the pizza verdict was still on screen after `water`.
  it("replaces a scored food with the exclusion state when the next line is not scoreable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(identifyResponse({ mode: "match", match: pizzaMatch, candidates: [] }))
      .mockResolvedValueOnce(identifyResponse({ mode: "carve_out", reason: "zero_calorie" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<FoodPage />);
    await ask("pizza");
    await waitFor(() => expect(screen.getByTestId("food-verdict")).toBeInTheDocument());
    expect(screen.getByTestId("food-verdict")).toHaveTextContent("22");

    await ask("water");

    await waitFor(() => expect(screen.queryByTestId("food-verdict")).not.toBeInTheDocument());
    expect(screen.queryByTestId("food-alternatives")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log this" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("textbox")[0]).toBeEnabled();
  });

  // A02, the second half: an unknown food replaces the score with a usable correction.
  it("replaces a scored food with the no-match state when the next line misses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(identifyResponse({ mode: "match", match: pizzaMatch, candidates: [] }))
      .mockResolvedValueOnce(
        identifyResponse({
          mode: "none",
          candidates: [{ code: "63101000", description: "Apple, raw", fcs: 95 }]
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<FoodPage />);
    await ask("pizza");
    await waitFor(() => expect(screen.getByTestId("food-verdict")).toBeInTheDocument());

    await ask("xyzzy plugh");

    await waitFor(() => expect(screen.getByTestId("food-no-match")).toBeInTheDocument());
    expect(screen.queryByTestId("food-verdict")).not.toBeInTheDocument();
    expect(screen.queryByTestId("food-alternatives")).not.toBeInTheDocument();
  });

  // A03. Two fruit rows replace pizza, and nothing tells anyone to cut back on a banana.
  it("replaces a scored food with a typed plate, with no cut-back directive on two high scores", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(identifyResponse({ mode: "match", match: pizzaMatch, candidates: [] }))
      .mockResolvedValueOnce(
        identifyResponse({
          mode: "match",
          match: { ...pizzaMatch, food: { code: "63101000", description: "Apple, raw", group: "6000" }, score: { ...pizzaMatch.score, fcs: 95, band: "encourage" } },
          candidates: []
        })
      )
      .mockResolvedValueOnce(
        identifyResponse({
          mode: "match",
          match: { ...pizzaMatch, food: { code: "63107010", description: "Banana, raw", group: "6000" }, score: { ...pizzaMatch.score, fcs: 83, band: "encourage" } },
          candidates: []
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<FoodPage />);
    await ask("pizza");
    await waitFor(() => expect(screen.getByTestId("food-verdict")).toBeInTheDocument());

    await ask("apple, banana");

    await waitFor(() => expect(screen.getByText("Apple, raw")).toBeInTheDocument());
    expect(screen.getByText("Banana, raw")).toBeInTheDocument();
    expect(screen.queryByTestId("food-verdict")).not.toBeInTheDocument();
    expect(screen.queryByTestId("food-alternatives")).not.toBeInTheDocument();
    expect(screen.queryByText(/Cut back on/)).not.toBeInTheDocument();
  });

  // A15. A question must cancel the lookup it interrupted, never let it swap the card.
  it("cancels an in-flight lookup when the next line is a question", async () => {
    let released: ((value: unknown) => void) | undefined;
    const fetchMock = vi.fn().mockImplementationOnce(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((resolve, reject) => {
          released = resolve;
          init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<FoodPage />);
    await ask("pizza");
    await ask("how many calories?");

    await act(async () => {
      released?.(identifyResponse({ mode: "match", match: pizzaMatch, candidates: [] }));
    });

    expect(mocks.sendUserText).toHaveBeenCalledWith("how many calories?");
    expect(screen.queryByTestId("food-verdict")).not.toBeInTheDocument();
  });

  // A14. One failed item is unchecked with a retry. It never becomes a question.
  it("keeps a plate a plate when one item fails to resolve", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        identifyResponse({
          mode: "match",
          match: { ...pizzaMatch, food: { code: "63101000", description: "Apple, raw", group: "6000" }, score: { ...pizzaMatch.score, fcs: 95, band: "encourage" } },
          candidates: []
        })
      )
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    render(<FoodPage />);
    await ask("apple, banana");

    await waitFor(() => expect(screen.getByText("Apple, raw")).toBeInTheDocument());
    expect(screen.getByText("banana")).toBeInTheDocument();
    expect(mocks.sendUserText).not.toHaveBeenCalled();
    expect(screen.queryByText(/Cut back on/)).not.toBeInTheDocument();
  });
});
