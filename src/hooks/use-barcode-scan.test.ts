import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBarcodeScan, type BarcodeDetectorLike } from "./use-barcode-scan";

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function fakeVideoRef() {
  return { current: { readyState: 4 } as HTMLVideoElement };
}

describe("useBarcodeScan", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires once after two consecutive detections of the same barcode", async () => {
    const onBarcode = vi.fn();
    let results: Array<{ rawValue: string }> = [{ rawValue: "051000012616" }];
    const detector: BarcodeDetectorLike = { detect: async () => results };
    const detectorFactory = async () => detector;

    const { result } = renderHook(() =>
      useBarcodeScan({ videoRef: fakeVideoRef(), enabled: true, onBarcode, detectorFactory })
    );

    await advance(500);
    expect(onBarcode).not.toHaveBeenCalled();

    await advance(500);
    expect(onBarcode).toHaveBeenCalledTimes(1);
    expect(onBarcode).toHaveBeenCalledWith("051000012616");
    expect(result.current.activeBarcode).toBe("051000012616");

    await advance(2000);
    expect(onBarcode).toHaveBeenCalledTimes(1);

    results = [];
    await advance(5000);
    expect(result.current.activeBarcode).toBeNull();
  });

  it("does nothing when disabled", async () => {
    const onBarcode = vi.fn();
    const detector: BarcodeDetectorLike = { detect: async () => [{ rawValue: "1" }] };
    renderHook(() =>
      useBarcodeScan({ videoRef: fakeVideoRef(), enabled: false, onBarcode, detectorFactory: async () => detector })
    );

    await advance(2000);
    expect(onBarcode).not.toHaveBeenCalled();
  });

  it("dismisses immediately and waits for the dismissed code to leave before accepting it again", async () => {
    const onBarcode = vi.fn();
    let codes = [{ rawValue: "089094026219" }];
    const videoRef = fakeVideoRef();
    const detectorFactory = async () => ({ detect: async () => codes });
    const { result } = renderHook(() => useBarcodeScan({ videoRef, enabled: true, onBarcode, detectorFactory }));
    await advance(1000);
    act(() => result.current.dismissBarcode());
    expect(result.current.activeBarcode).toBeNull();
    await advance(2000);
    expect(onBarcode).toHaveBeenCalledTimes(1);

    codes = [];
    await advance(1000);
    codes = [{ rawValue: "089094026219" }];
    await advance(1000);
    expect(onBarcode).toHaveBeenCalledTimes(2);
    expect(result.current.activeBarcode).toBe("089094026219");

    act(() => result.current.dismissBarcode());
    codes = [{ rawValue: "030000010204" }];
    await advance(1000);
    expect(result.current.activeBarcode).toBe("030000010204");
  });

  it("does not reopen a dismissed barcode from an in-flight detection", async () => {
    const onBarcode = vi.fn();
    let finishDetection: ((codes: Array<{ rawValue: string }>) => void) | undefined;
    const detect = vi.fn().mockResolvedValue([{ rawValue: "089094026219" }]);
    const videoRef = fakeVideoRef();
    const detectorFactory = async () => ({ detect });
    const { result } = renderHook(() => useBarcodeScan({ videoRef, enabled: true, onBarcode, detectorFactory }));
    await advance(1000);
    detect.mockImplementationOnce(() => new Promise((resolve) => { finishDetection = resolve; }));
    await advance(500);
    act(() => result.current.dismissBarcode());
    await act(async () => finishDetection?.([{ rawValue: "089094026219" }]));
    expect(result.current.activeBarcode).toBeNull();
    expect(onBarcode).toHaveBeenCalledTimes(1);
  });
});
