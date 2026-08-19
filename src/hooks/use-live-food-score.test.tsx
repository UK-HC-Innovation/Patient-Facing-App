import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTO_DISARM_MS,
  LIVE_INTERVAL_MS,
  SCENE_CHANGE_THRESHOLD,
  VISION_RESTORE_MS,
  meanAbsoluteDifference,
  useLiveFoodScore,
  type LiveMatch
} from "./use-live-food-score";

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
  nutrients: null
};

// testing-library's waitFor polls on real timers, which deadlocks against vi.useFakeTimers.
// Flushing the microtask queue inside act() is what these assertions actually need.
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function jsonResponse(body: unknown): Response {
  return { json: () => Promise.resolve(body) } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

function setup(overrides: Partial<Parameters<typeof useLiveFoodScore>[0]> = {}, clock = { value: 0 }) {
  // jsdom has no canvas backend, so frameSignature() returns null and every tick counts as
  // a scene change. That is the conservative branch, and it isolates the throttle,
  // in-flight, visibility and preemption behaviour under test here.
  const video = document.createElement("video");
  const ref = { current: video };
  return renderHook((props: Partial<Parameters<typeof useLiveFoodScore>[0]>) =>
    useLiveFoodScore({
      videoRef: ref,
      grabFrame: () => "data:image/jpeg;base64,AAAA",
      cameraActive: true,
      barcodeActive: false,
      now: () => clock.value,
      ...overrides,
      ...props
    })
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn().mockResolvedValue(jsonResponse({ mode: "match", match: MATCH }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("meanAbsoluteDifference", () => {
  it("is zero for an identical scene and large for an inverted one", () => {
    expect(meanAbsoluteDifference([10, 20, 30], [10, 20, 30])).toBe(0);
    expect(meanAbsoluteDifference([0, 0, 0], [255, 255, 255])).toBe(255);
  });

  it("treats a small camera wobble as the same scene", () => {
    expect(meanAbsoluteDifference([100, 100, 100], [102, 99, 101])).toBeLessThan(SCENE_CHANGE_THRESHOLD);
  });

  it("refuses to compare mismatched signatures rather than guessing", () => {
    expect(meanAbsoluteDifference([1, 2], [1])).toBe(Number.POSITIVE_INFINITY);
    expect(meanAbsoluteDifference([], [])).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("useLiveFoodScore", () => {
  it("fires once immediately on arm so the first score does not wait an interval", async () => {
    setup();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throttles to one call per interval", async () => {
    setup();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(LIVE_INTERVAL_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Half an interval later, still two.
    await act(async () => {
      vi.advanceTimersByTime(LIVE_INTERVAL_MS / 2);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("skips a tick while a call is still in flight", async () => {
    let release: (value: Response) => void = () => {};
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        })
    );
    setup();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(LIVE_INTERVAL_MS * 3);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      release(jsonResponse({ mode: "match", match: MATCH }));
    });
    await act(async () => {
      vi.advanceTimersByTime(LIVE_INTERVAL_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("skips ticks while the tab is hidden", async () => {
    setup();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const spy = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    await act(async () => {
      vi.advanceTimersByTime(LIVE_INTERVAL_MS * 4);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    spy.mockReturnValue(false);
    await act(async () => {
      vi.advanceTimersByTime(LIVE_INTERVAL_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("hides the badge and stops spending when the route reports locked", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ mode: "locked" }));
    const { result } = setup();
    await flush();

    await flush();
    expect(result.current.badge).toBe("hidden");
    await act(async () => {
      vi.advanceTimersByTime(LIVE_INTERVAL_MS * 5);
    });
    // The first call was the probe; there is no second.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows a carve-out with no number at all", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ mode: "carve_out", reason: "zero_calorie" }));
    const { result } = setup();
    await flush();

    await flush();
    expect(result.current.badge).toBe("carve_out");
    expect(result.current.match).toBeNull();
  });

  it("stands down while a barcode is active and restores a fresh vision match on clear", async () => {
    const clock = { value: 1_000 };
    const { result, rerender } = setup({}, clock);
    await flush();
    await flush();
    expect(result.current.match?.score.fcs).toBe(83);
    const callsBefore = fetchMock.mock.calls.length;

    await act(async () => {
      rerender({ barcodeActive: true });
    });
    expect(result.current.match).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(LIVE_INTERVAL_MS * 4);
    });
    expect(fetchMock).toHaveBeenCalledTimes(callsBefore);

    clock.value += VISION_RESTORE_MS - 1_000;
    await act(async () => {
      rerender({ barcodeActive: false });
    });
    expect(result.current.match?.score.fcs).toBe(83);
  });

  it("clears rather than restoring a vision match older than the restore window", async () => {
    const clock = { value: 1_000 };
    const { result, rerender } = setup({}, clock);
    await flush();
    await flush();
    expect(result.current.match?.score.fcs).toBe(83);

    await act(async () => {
      rerender({ barcodeActive: true });
    });

    clock.value += VISION_RESTORE_MS + 1;
    fetchMock.mockResolvedValue(jsonResponse({ mode: "none", candidates: [] }));
    await act(async () => {
      rerender({ barcodeActive: false });
    });
    expect(result.current.match).toBeNull();
  });

  it("hides the badge entirely when the camera is not running", () => {
    const { result } = setup({ cameraActive: false });
    expect(result.current.badge).toBe("hidden");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips the call when the scene has not changed, and gives up after three minutes", async () => {
    // Give jsdom a canvas that always returns the same pixels: a camera held still.
    const constantPixels = new Uint8ClampedArray(32 * 32 * 4).fill(120);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: () => {},
      getImageData: () => ({ data: constantPixels })
    } as unknown as CanvasRenderingContext2D);

    const clock = { value: 0 };
    const video = document.createElement("video");
    Object.defineProperty(video, "videoWidth", { value: 640 });
    const ref = { current: video };
    const { result } = renderHook(() =>
      useLiveFoodScore({
        videoRef: ref,
        grabFrame: () => "data:image/jpeg;base64,AAAA",
        cameraActive: true,
        barcodeActive: false,
        now: () => clock.value
      })
    );

    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The first tick records the signature; every tick after it matches, so nothing is sent.
    for (let i = 0; i < 4; i += 1) {
      clock.value += LIVE_INTERVAL_MS;
      await act(async () => {
        vi.advanceTimersByTime(LIVE_INTERVAL_MS);
      });
    }
    expect(fetchMock).toHaveBeenCalledTimes(2); // only the first tick, which had no previous signature

    clock.value += AUTO_DISARM_MS;
    await act(async () => {
      vi.advanceTimersByTime(LIVE_INTERVAL_MS);
    });
    await flush();
    expect(result.current.badge).toBe("hidden");

    // Disarmed for good: no further spend even if the scene later changes.
    constantPixels.fill(10);
    await act(async () => {
      vi.advanceTimersByTime(LIVE_INTERVAL_MS * 3);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
