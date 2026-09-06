import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  BARCODE_SCAN_TIMEOUT_MS,
  useBarcodeScan,
  type BarcodeDetectorLike
} from "./use-barcode-scan";

function fakeVideoRef() {
  return { current: { readyState: 4 } as HTMLVideoElement };
}

describe("useBarcodeScan", () => {
  it("returns a barcode only after two reads agree", async () => {
    const detector: BarcodeDetectorLike = {
      detect: vi.fn().mockResolvedValue([{ rawValue: "051000012616" }])
    };
    const detectorFactory = async () => detector;

    const { result } = renderHook(() =>
      useBarcodeScan({ videoRef: fakeVideoRef(), enabled: true, detectorFactory })
    );

    let barcode: string | null = null;
    await act(async () => {
      barcode = await result.current.scan();
    });
    expect(barcode).toBe("051000012616");
    expect(detector.detect).toHaveBeenCalledTimes(2);
  });

  it("rejects a barcode when the two reads disagree", async () => {
    const detector: BarcodeDetectorLike = {
      detect: vi.fn()
        .mockResolvedValueOnce([{ rawValue: "051000012616" }])
        .mockResolvedValueOnce([{ rawValue: "000000000000" }])
    };
    const { result } = renderHook(() =>
      useBarcodeScan({ videoRef: fakeVideoRef(), enabled: true, detectorFactory: async () => detector })
    );
    await expect(result.current.scan()).resolves.toBeNull();
  });

  it("does no detection work when disabled", async () => {
    const detector: BarcodeDetectorLike = { detect: vi.fn() };
    const detectorFactory = vi.fn(async () => detector);
    const { result } = renderHook(() =>
      useBarcodeScan({ videoRef: fakeVideoRef(), enabled: false, detectorFactory })
    );

    await expect(result.current.scan()).resolves.toBeNull();
    expect(detectorFactory).not.toHaveBeenCalled();
    expect(detector.detect).not.toHaveBeenCalled();
  });

  it("falls back when the detector does not settle", async () => {
    vi.useFakeTimers();
    try {
      const detector: BarcodeDetectorLike = {
        detect: vi.fn(() => new Promise<Array<{ rawValue: string }>>(() => undefined))
      };
      const { result } = renderHook(() =>
        useBarcodeScan({ videoRef: fakeVideoRef(), enabled: true, detectorFactory: async () => detector })
      );

      let scan: Promise<string | null> | undefined;
      act(() => {
        scan = result.current.scan();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(BARCODE_SCAN_TIMEOUT_MS);
      });
      await expect(scan).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
