import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CompassPage from "./page";

const mocks = vi.hoisted(() => ({
  onFinalTranscript: null as null | ((role: "patient" | "assistant", text: string) => void),
  beforePatientResponse: null as null | ((text: string) => Promise<void>),
  getContext: null as null | (() => { frameDataUrl: string | null }),
  cameraStart: vi.fn(),
  cameraStop: vi.fn(),
  voiceStop: vi.fn(),
  requestContextResponse: vi.fn(),
  startWithContextResponse: vi.fn(),
  liveScan: vi.fn(async () => undefined),
  // Mutable so a test can move the lens onto a different food mid-render.
  liveMatch: null as unknown,
  voiceStatus: "idle" as string,
  voiceMode: "mock" as string
}));

const pizzaMatch = {
  food: { code: "58106000", description: "Pizza, not further specified", group: "8000_Mixed" },
  score: {
    fcs: 22,
    band: "minimize" as const,
    tier: "T1" as const,
    ambiguous: false,
    range: null,
    calorieDensity: { kcalPer100g: 266, band: "medium" as const },
    domains: null,
    coverage: null
  },
  alternatives: [],
  nutrients: null
};

vi.mock("@/hooks/use-food-camera", () => ({
  useFoodCamera: () => ({
    videoRef: { current: null },
    status: "active",
    grabFrame: () => "data:image/jpeg;base64,FRAME",
    start: mocks.cameraStart,
    stop: mocks.cameraStop
  })
}));

vi.mock("@/hooks/use-manual-food-score", () => ({
  useManualFoodScore: () => ({
    badge: "score",
    loopState: "sending",
    match: mocks.liveMatch,
    candidate: null,
    packageDetected: false,
    carveOut: null,
    noMatchCandidates: [],
    noMatch: false,
    armed: true,
    disarmReason: null,
    liveIdentifySucceeded: false,
    scanError: null,
    scan: mocks.liveScan,
    adoptMatch: () => {},
    rearm: () => {},
    setVisibleRatio: () => {}
  })
}));

vi.mock("@/hooks/use-food-voice-session", () => ({
  useFoodVoiceSession: (args: {
    onFinalTranscript: (role: "patient" | "assistant", text: string) => void;
    beforePatientResponse: (text: string) => Promise<void>;
    getContext: () => { frameDataUrl: string | null };
  }) => {
    mocks.onFinalTranscript = args.onFinalTranscript;
    mocks.beforePatientResponse = args.beforePatientResponse;
    mocks.getContext = args.getContext;
    return {
      mode: mocks.voiceMode,
      dataMode: "on_device",
      status: mocks.voiceStatus,
      partialAssistantText: "",
      error: null,
      start: vi.fn(),
      startWithContextResponse: mocks.startWithContextResponse,
      stop: mocks.voiceStop,
      sendUserText: vi.fn(),
      requestContextResponse: mocks.requestContextResponse
    };
  }
}));

describe("CompassPage camera-first conversation", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/food/demo");
    mocks.onFinalTranscript = null;
    mocks.beforePatientResponse = null;
    mocks.getContext = null;
    mocks.liveMatch = pizzaMatch;
    mocks.voiceStatus = "idle";
    mocks.voiceMode = "mock";
    mocks.requestContextResponse.mockClear();
    mocks.startWithContextResponse.mockClear();
    mocks.cameraStart.mockClear();
    mocks.cameraStop.mockClear();
    mocks.voiceStop.mockClear();
    mocks.liveScan.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses a spoken restaurant refinement without collapsing the camera or exposing a text form", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            mode: "match",
            match: {
              food: {
                code: "58106540",
                description: "Pizza with pepperoni, from restaurant or fast food, NS as to type of crust",
                group: "8000_Mixed"
              },
              score: { ...pizzaMatch.score, fcs: 23, calorieDensity: { kcalPer100g: 282, band: "medium" } },
              alternatives: [],
              nutrients: null,
              interpretation: {
                kind: "food_order",
                originalText: "This came from Papa John's. It is a pepperoni and sausage pizza.",
                restaurant: "Papa John's",
                item: "pizza",
                toppings: ["pepperoni", "sausage"],
                size: null,
                crust: null,
                matchQuery: "Pizza with pepperoni, from restaurant or fast food, NS as to type of crust"
              },
              provenance: {
                kind: "published_closest_match",
                exact: false,
                matchedAs: "Pizza with pepperoni, from restaurant or fast food, NS as to type of crust",
                unmatchedDetails: ["Papa John's exact menu item", "sausage-specific topping"],
                note: "This is the closest published restaurant category, not Papa John's nutrition."
              }
            },
            candidates: []
          })
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<CompassPage />);

    const camera = screen.getByRole("region", { name: "Food camera" });
    const conversation = screen.getByRole("region", { name: "Conversation" });
    expect(camera).toBeInTheDocument();
    // The camera keeps the top of the scroll surface; the conversation lives below it in the
    // content region rather than replacing it.
    expect(camera.compareDocumentPosition(conversation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByLabelText("Describe a food or order")).not.toBeInTheDocument();
    expect(mocks.onFinalTranscript).not.toBeNull();

    act(() => {
      mocks.onFinalTranscript?.("patient", "This came from Papa John's.");
    });
    await act(async () => mocks.beforePatientResponse?.("This came from Papa John's."));
    act(() => {
      mocks.onFinalTranscript?.("patient", "It is pepperoni and sausage.");
    });
    await act(async () => mocks.beforePatientResponse?.("It is pepperoni and sausage."));

    await waitFor(() => expect(screen.getByLabelText("Your order")).toBeInTheDocument());
    const lastRequest = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body)) as { text: string };
    expect(lastRequest.text).toBe("I am ordering a pepperoni and sausage pizza from Papa John's");
    expect(screen.getByText("Papa John's", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Pepperoni, Sausage", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Food camera" })).toBeInTheDocument();
    expect(screen.queryByText("Camera collapsed")).not.toBeInTheDocument();
  });

  it("uses Spanish chrome from the mount-time query without adding a text input", () => {
    window.history.replaceState({}, "", "/food/demo?lang=es");

    render(<CompassPage />);

    expect(screen.getByRole("heading", { name: "1 good choice" })).toBeInTheDocument();
    expect(screen.getByText("University of Kentucky")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Cámara de alimentos" })).toBeInTheDocument();
    expect(screen.getAllByText("22").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Consejo general de nutrición/)[0]).toHaveAttribute(
      "data-guidance-scope",
      "general"
    );
    expect(screen.getByText("1 good choice:")).toBeInTheDocument();
    expect(screen.getByText(/Veo Pizza, not further specified/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

/**
 * Behaviors the public door owns today that nothing pinned before spec 26 P1.
 *
 * They are the reason the authority stack stays per-mount: a spoken refinement suppresses
 * the camera frame and releases only on scene stability, which is a different spending
 * discipline from /food's wall-clock correction pin. Anything that later tries to unify
 * the two has to keep these true.
 */
describe("CompassPage spoken-refinement authority", () => {
  // Own reset: these cases mutate liveMatch/voiceMode and the sibling describe's beforeEach
  // does not reach them, so without it a leaked banana match makes the pizza precondition
  // silently untrue and the refinement assertions run against the wrong scene.
  beforeEach(() => {
    window.history.replaceState({}, "", "/food/demo");
    mocks.onFinalTranscript = null;
    mocks.beforePatientResponse = null;
    mocks.getContext = null;
    mocks.liveMatch = pizzaMatch;
    mocks.voiceStatus = "idle";
    mocks.voiceMode = "mock";
    mocks.requestContextResponse.mockClear();
    mocks.startWithContextResponse.mockClear();
    mocks.cameraStart.mockClear();
    mocks.cameraStop.mockClear();
    mocks.voiceStop.mockClear();
    mocks.liveScan.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const banana = {
    food: { code: "63107010", description: "Banana, raw", group: "2000_Fruit" },
    score: { ...pizzaMatch.score, fcs: 83, band: "encourage" as const },
    alternatives: [],
    nutrients: null
  };

  function stubIdentify() {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          mode: "match",
          match: {
            food: {
              code: "58106540",
              description: "Pizza with pepperoni, from restaurant or fast food, NS as to type of crust",
              group: "8000_Mixed"
            },
            score: { ...pizzaMatch.score, fcs: 23 },
            alternatives: [],
            nutrients: null
          },
          candidates: []
        })
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("never attaches an unrequested camera frame to voice context", async () => {
    stubIdentify();
    render(<CompassPage />);

    expect(mocks.getContext?.().frameDataUrl).toBeNull();

    await act(async () => mocks.beforePatientResponse?.("This came from Papa John's, pepperoni."));

    expect(mocks.getContext?.().frameDataUrl).toBeNull();
  });

  it("keeps voice context image-free when a different food is shown", async () => {
    stubIdentify();
    const view = render(<CompassPage />);
    await act(async () => mocks.beforePatientResponse?.("This came from Papa John's, pepperoni."));

    mocks.liveMatch = banana;
    await act(async () => view.rerender(<CompassPage />));

    expect(mocks.getContext?.().frameDataUrl).toBeNull();
  });

  it("clears the pizza order context when the user starts a new scan", async () => {
    const fetchMock = stubIdentify();
    const view = render(<CompassPage />);
    await act(async () => mocks.beforePatientResponse?.("This came from Papa John's, pepperoni."));
    const callsWithPizzaContext = fetchMock.mock.calls.length;

    await act(async () => mocks.beforePatientResponse?.("with sausage"));
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsWithPizzaContext);

    await act(async () => {
      screen.getByRole("button", { name: "Tap to scan again" }).click();
    });
    expect(mocks.liveScan).toHaveBeenCalledTimes(1);
    mocks.liveMatch = banana;
    await act(async () => view.rerender(<CompassPage />));

    const callsAfterReset = fetchMock.mock.calls.length;
    await act(async () => mocks.beforePatientResponse?.("with sausage"));
    expect(fetchMock.mock.calls.length).toBe(callsAfterReset);
  });

  it("asks a live session for a context response instead of restarting it", async () => {
    stubIdentify();
    mocks.voiceMode = "live";
    mocks.voiceStatus = "listening";
    render(<CompassPage />);

    // Restarting a session that is already listening would talk over the patient.
    expect(mocks.requestContextResponse).toHaveBeenCalled();
    expect(mocks.startWithContextResponse).not.toHaveBeenCalled();
  });
});
