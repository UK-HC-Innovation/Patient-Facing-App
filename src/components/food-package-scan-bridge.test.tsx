import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FoodAuthority } from "@/domain/food-authority";
import { FoodPackageScanBridge } from "./food-package-scan-bridge";

const mocks = vi.hoisted(() => ({
  barcodeHandlers: [] as Array<ReturnType<typeof vi.fn>>,
  cancel: vi.fn(),
  onCancelChange: vi.fn(),
  onStateChange: vi.fn()
}));

vi.mock("@/hooks/use-package-scan", () => ({
  usePackageScan: () => {
    const onBarcodeDetected = vi.fn(async () => undefined);
    mocks.barcodeHandlers.push(onBarcodeDetected);
    return {
      cancel: mocks.cancel,
      onBarcodeDetected,
      state: {
        active: false,
        barcode: { status: "idle" },
        resolvedFood: null
      }
    };
  }
}));

vi.mock("@/components/food-package-scan", () => ({
  FoodPackageScan: () => null
}));

function authority(epoch: number): FoodAuthority {
  return {
    epoch,
    snapshot: () => epoch,
    isCurrent: (candidate) => candidate === epoch,
    invalidate: () => epoch + 1
  };
}

function totalBarcodeCalls() {
  return mocks.barcodeHandlers.reduce((total, handler) => total + handler.mock.calls.length, 0);
}

describe("FoodPackageScanBridge", () => {
  beforeEach(() => {
    mocks.barcodeHandlers.length = 0;
    mocks.cancel.mockReset();
    mocks.onCancelChange.mockReset();
    mocks.onStateChange.mockReset();
  });

  it("does not reopen a dismissed barcode when only the controller callback changes", async () => {
    const sharedProps = {
      barcode: "123",
      captureDetailedFrame: async () => null,
      language: "en" as const,
      onCancelChange: mocks.onCancelChange,
      onStateChange: mocks.onStateChange,
      patientId: "p1",
      resumeLive: vi.fn(),
      suspendLive: vi.fn()
    };
    const view = render(<FoodPackageScanBridge {...sharedProps} authority={authority(0)} />);

    await waitFor(() => expect(totalBarcodeCalls()).toBe(1));
    view.rerender(<FoodPackageScanBridge {...sharedProps} authority={authority(1)} />);
    await waitFor(() => expect(mocks.barcodeHandlers.length).toBeGreaterThan(1));
    expect(totalBarcodeCalls()).toBe(1);

    view.rerender(<FoodPackageScanBridge {...sharedProps} barcode={null} authority={authority(2)} />);
    view.rerender(<FoodPackageScanBridge {...sharedProps} authority={authority(3)} />);
    await waitFor(() => expect(totalBarcodeCalls()).toBe(2));
  });
});
