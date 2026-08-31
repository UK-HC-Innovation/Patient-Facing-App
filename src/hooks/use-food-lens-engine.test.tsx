import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveScoreState } from "@/hooks/use-live-food-score";

const mocks = vi.hoisted(() => ({
  cameraStop: vi.fn(),
  cameraStart: vi.fn(async () => undefined),
  barcodeArgs: null as null | { onBarcode: (code: string) => void }
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
  useBarcodeScan: (args: { onBarcode: (code: string) => void }) => {
    mocks.barcodeArgs = args;
    return { activeBarcode: null };
  }
}));

vi.mock("@/hooks/use-live-food-score", () => ({
  useLiveFoodScore: () => ({
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
    adoptMatch: vi.fn(),
    suspend: vi.fn(),
    rearm: vi.fn(),
    setVisibleRatio: vi.fn()
  } satisfies LiveScoreState)
}));

import { useFoodLensEngine } from "./use-food-lens-engine";

describe("useFoodLensEngine authority", () => {
  beforeEach(() => {
    mocks.cameraStop.mockClear();
    mocks.cameraStart.mockClear();
    mocks.barcodeArgs = null;
  });

  it("advances authority before camera stop/pagehide teardown", () => {
    const { result } = renderHook(() => useFoodLensEngine({ crisis: false }));
    expect(result.current.authority.epoch).toBe(0);

    act(() => result.current.camera.stop());

    expect(mocks.cameraStop).toHaveBeenCalledTimes(1);
    expect(result.current.authority.epoch).toBe(1);
  });

  it("lets the package controller decide whether a detected code is new", () => {
    const onDetect = vi.fn();
    const { result } = renderHook(() => useFoodLensEngine({ crisis: false, barcode: { onDetect } }));

    act(() => mocks.barcodeArgs?.onBarcode("123"));

    expect(onDetect).toHaveBeenCalledWith("123");
    expect(result.current.authority.epoch).toBe(0);
  });
});
