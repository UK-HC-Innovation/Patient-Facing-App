import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useManualFoodScore } from "./use-manual-food-score";
import type { LiveMatch } from "./use-live-food-score";

const MATCH: LiveMatch = {
  food: { code: "63107010", description: "Banana, raw", group: "2000_Fruit" },
  score: {
    fcs: 83,
    band: "encourage",
    tier: "T1",
    ambiguous: false,
    range: null,
    calorieDensity: { kcalPer100g: 89, band: "low" },
    domains: null,
    coverage: null
  },
  alternatives: [],
  nutrients: null,
  candidates: []
};

function response(body: unknown): Response {
  return { json: async () => body } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

function setup(grabFrame: () => string | null = () => "data:image/jpeg;base64,AAAA") {
  return renderHook(() => useManualFoodScore({
    grabFrame,
    cameraActive: true,
    barcodeActive: false
  }));
}

describe("useManualFoodScore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn().mockResolvedValue(response({ mode: "none", candidates: [] }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sends nothing over time and one image after one tap", async () => {
    const { result } = setup();
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => result.current.scan());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.noMatch).toBe(true);

    await act(async () => vi.advanceTimersByTime(60_000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not send when the camera has no frame", async () => {
    const { result } = setup(() => null);

    await act(async () => result.current.scan());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.scanError).toBe("camera_not_ready");
  });

  it("keeps an image proposal unscored until it is adopted", async () => {
    fetchMock.mockResolvedValue(response({
      mode: "candidate",
      candidate: { food: MATCH.food },
      candidates: []
    }));
    const { result } = setup();

    await act(async () => result.current.scan());
    expect(result.current.candidate?.food.code).toBe(MATCH.food.code);
    expect(result.current.match).toBeNull();
    expect(result.current.disarmReason).toBe("review");

    act(() => result.current.adoptMatch(MATCH));
    expect(result.current.candidate).toBeNull();
    expect(result.current.match?.score.fcs).toBe(83);
  });

  it("shows quota failure and never retries it", async () => {
    fetchMock.mockResolvedValue(response({ mode: "error", reason: "provider_quota" }));
    const { result } = setup();

    await act(async () => result.current.scan());
    await act(async () => vi.advanceTimersByTime(60_000));

    expect(result.current.scanError).toBe("provider_quota");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
