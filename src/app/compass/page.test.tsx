import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CompassPage from "./page";

const mocks = vi.hoisted(() => ({
  onFinalTranscript: null as null | ((role: "patient" | "assistant", text: string) => void),
  beforePatientResponse: null as null | ((text: string) => Promise<void>),
  cameraStart: vi.fn(),
  cameraStop: vi.fn(),
  voiceStop: vi.fn()
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
    grabFrame: () => null,
    start: mocks.cameraStart,
    stop: mocks.cameraStop
  })
}));

vi.mock("@/hooks/use-live-food-score", () => ({
  useLiveFoodScore: () => ({ badge: "score", match: pizzaMatch, carveOut: null, armed: true })
}));

vi.mock("@/hooks/use-food-voice-session", () => ({
  useFoodVoiceSession: (args: {
    onFinalTranscript: (role: "patient" | "assistant", text: string) => void;
    beforePatientResponse: (text: string) => Promise<void>;
  }) => {
    mocks.onFinalTranscript = args.onFinalTranscript;
    mocks.beforePatientResponse = args.beforePatientResponse;
    return {
      mode: "mock",
      dataMode: "on_device",
      status: "idle",
      partialAssistantText: "",
      error: null,
      start: vi.fn(),
      startWithContextResponse: vi.fn(),
      stop: mocks.voiceStop,
      sendUserText: vi.fn(),
      requestContextResponse: vi.fn()
    };
  }
}));

describe("CompassPage camera-first conversation", () => {
  beforeEach(() => {
    mocks.onFinalTranscript = null;
    mocks.beforePatientResponse = null;
    mocks.cameraStart.mockClear();
    mocks.cameraStop.mockClear();
    mocks.voiceStop.mockClear();
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

    expect(screen.getByRole("region", { name: "Food camera" })).toBeInTheDocument();
    expect(screen.getByRole("main").lastElementChild).toBe(
      screen.getByRole("region", { name: "Automatic food conversation" })
    );
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

    await waitFor(() => expect(screen.getByLabelText("Order interpretation")).toBeInTheDocument());
    const lastRequest = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body)) as { text: string };
    expect(lastRequest.text).toBe("I am ordering a pepperoni and sausage pizza from Papa John's");
    expect(screen.getByText("Papa John's", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Pepperoni, Sausage", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Food camera" })).toBeInTheDocument();
    expect(screen.queryByText("Camera collapsed")).not.toBeInTheDocument();
  });
});
