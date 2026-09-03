import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveScoreState } from "@/hooks/use-live-food-score";

const mocks = vi.hoisted(() => ({
  cameraStop: vi.fn(),
  cameraStart: vi.fn(async () => undefined),
  barcodeScan: vi.fn<() => Promise<string | null>>(),
  liveScan: vi.fn(async () => undefined),
  liveRearm: vi.fn(),
  liveSuspend: vi.fn(),
  liveArgs: null as null | { cameraActive?: boolean }
}));

vi.mock("@/hooks/use-food-camera", () => ({
  useFoodCamera: () => ({
    videoRef: { current: null },
    status: "active" as const,
    start: mocks.cameraStart,
    stop: mocks.cameraStop,
    grabFrame: () => null,
    captureDetailedFrame: async () => null
  })
}));

vi.mock("@/hooks/use-passcode", () => ({ usePasscode: () => undefined }));

vi.mock("@/hooks/use-barcode-scan", () => ({
  useBarcodeScan: () => ({ scan: mocks.barcodeScan })
}));

vi.mock("@/hooks/use-manual-food-score", () => ({
  useManualFoodScore: (args: { cameraActive?: boolean }) => {
    mocks.liveArgs = args;
    return ({
    badge: "idle",
    loopState: "searching",
    match: null,
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
    adoptMatch: vi.fn(),
    suspend: mocks.liveSuspend,
    rearm: mocks.liveRearm,
    setVisibleRatio: vi.fn()
    } satisfies LiveScoreState);
  }
}));

import { useFoodLensEngine } from "./use-food-lens-engine";

describe("useFoodLensEngine authority", () => {
  beforeEach(() => {
    mocks.cameraStop.mockClear();
    mocks.cameraStart.mockClear();
    mocks.barcodeScan.mockReset();
    mocks.barcodeScan.mockResolvedValue(null);
    mocks.liveScan.mockClear();
    mocks.liveRearm.mockClear();
    mocks.liveSuspend.mockClear();
    mocks.liveArgs = null;
  });

  it("advances authority before camera stop/pagehide teardown", () => {
    const { result } = renderHook(() => useFoodLensEngine({ crisis: false }));
    expect(result.current.authority.epoch).toBe(0);

    act(() => result.current.camera.stop());

    expect(mocks.cameraStop).toHaveBeenCalledTimes(1);
    expect(result.current.authority.epoch).toBe(1);
  });

  it("uses the manual scorer and sends no image work before a scan", () => {
    renderHook(() => useFoodLensEngine({ crisis: false }));

    expect(mocks.liveArgs?.cameraActive).toBe(true);
    expect(mocks.barcodeScan).not.toHaveBeenCalled();
    expect(mocks.liveScan).not.toHaveBeenCalled();
  });

  it("lets the package controller decide whether a detected code is new", async () => {
    const onDetect = vi.fn();
    mocks.barcodeScan.mockResolvedValue("123");
    const { result } = renderHook(() => useFoodLensEngine({ crisis: false, barcode: { onDetect } }));

    await act(async () => result.current.scan());

    expect(onDetect).toHaveBeenCalledWith("123");
    expect(mocks.liveScan).not.toHaveBeenCalled();
    expect(result.current.activeBarcode).toBe("123");
  });

  it("falls back to one image scan when no barcode is present", async () => {
    const { result } = renderHook(() => useFoodLensEngine({ crisis: false, barcode: { onDetect: vi.fn() } }));

    await act(async () => result.current.scan());

    expect(mocks.barcodeScan).toHaveBeenCalledTimes(1);
    expect(mocks.liveScan).toHaveBeenCalledTimes(1);
  });
});
