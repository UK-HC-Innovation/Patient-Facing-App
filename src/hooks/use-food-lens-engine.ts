"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FoodAuthority } from "@/domain/food-authority";
import { useFoodCamera, type CameraStatus } from "@/hooks/use-food-camera";
import { useBarcodeScan } from "@/hooks/use-barcode-scan";
import { useManualFoodScore } from "@/hooks/use-manual-food-score";
import type { LiveScoreState } from "@/hooks/use-live-food-score";
import { usePasscode } from "@/hooks/use-passcode";

export type FoodLensEngine = {
  camera: ReturnType<typeof useFoodCamera>;
  live: LiveScoreState;
  passcode: string | undefined;
  /** The barcode found by the latest explicit scan, or null where no barcode was found. */
  activeBarcode: string | null;
  /** Runs one explicit barcode-or-image scan. No camera frame is captured before this. */
  scan: () => Promise<void>;
  scanPending: boolean;
  clearBarcode: () => void;
  cameraStatus: CameraStatus;
  /** Camera denied or absent: the viewfinder gives up its height and the voice bar inverts. */
  cameraBlocked: boolean;
  authority: FoodAuthority;
};

/**
 * Everything both Food Lens doors need to scan a food: the camera preview, a one-shot
 * barcode check, one image-identification request, and the demo passcode they spend against.
 *
 * What it deliberately does not own: the authority stack. The engine reports what each
 * source currently says; deciding which one wins -- and on what release policy -- is the
 * door's own, because /food's wall-clock correction pin and /food/demo's scene-stability
 * refinement are two different spending disciplines (docs/specs/26 section 4.1).
 */
export function useFoodLensEngine(args: {
  /**
   * A crisis is an explicit disarm, not a side effect. The crisis screen unmounts the
   * camera, so a gate reading visibility alone would pause for the wrong reason and call
   * it correct.
   */
  crisis: boolean;
  /**
   * The barcode reader. Omitted where the mount has no packaged-food path, which keeps the
   * scanner disabled and its detector ponyfill chunk unfetched.
   */
  barcode?: { onDetect: (barcode: string) => void };
}): FoodLensEngine {
  const { crisis, barcode } = args;
  const camera = useFoodCamera();
  const passcode = usePasscode();
  const cameraActive = camera.status === "active";
  const [activeBarcode, setActiveBarcode] = useState<string | null>(null);
  const [scanPending, setScanPending] = useState(false);
  const scanPendingRef = useRef(false);
  const authorityRef = useRef(0);
  const [authorityEpoch, setAuthorityEpoch] = useState(0);
  const invalidateAuthority = useCallback(() => {
    const next = authorityRef.current + 1;
    authorityRef.current = next;
    setAuthorityEpoch(next);
    return next;
  }, []);
  const snapshotAuthority = useCallback(() => authorityRef.current, []);
  const isAuthorityCurrent = useCallback((epoch: number) => authorityRef.current === epoch, []);
  const authority = useMemo<FoodAuthority>(() => ({
    epoch: authorityEpoch,
    snapshot: snapshotAuthority,
    isCurrent: isAuthorityCurrent,
    invalidate: invalidateAuthority
  }), [authorityEpoch, invalidateAuthority, isAuthorityCurrent, snapshotAuthority]);

  const { start, stop } = camera;
  useEffect(() => {
    void start();
  }, [start]);

  const { scan: scanBarcode } = useBarcodeScan({
    videoRef: camera.videoRef,
    enabled: barcode !== undefined && cameraActive
  });

  const liveState = useManualFoodScore({
    grabFrame: camera.grabFrame,
    cameraActive,
    barcodeActive: activeBarcode !== null,
    crisis,
    passcode,
    authority
  });
  const liveScan = liveState.scan;
  const liveSuspend = liveState.suspend;
  const liveRearmState = liveState.rearm;
  const liveDisarmReason = liveState.disarmReason;

  const clearBarcode = useCallback(() => setActiveBarcode(null), []);
  const rearmLive = useCallback(() => {
    clearBarcode();
    liveRearmState();
  }, [clearBarcode, liveRearmState]);
  const live = useMemo<LiveScoreState>(
    () => ({ ...liveState, rearm: rearmLive }),
    [liveState, rearmLive]
  );

  const scan = useCallback(async () => {
    if (scanPendingRef.current || !cameraActive || crisis || liveDisarmReason === "review") {
      return;
    }
    scanPendingRef.current = true;
    setScanPending(true);
    rearmLive();
    setActiveBarcode(null);
    const requestEpoch = snapshotAuthority();
    try {
      const detectedBarcode = barcode ? await scanBarcode() : null;
      if (!isAuthorityCurrent(requestEpoch) || crisis) {
        return;
      }
      if (detectedBarcode) {
        liveSuspend();
        setActiveBarcode(detectedBarcode);
        barcode?.onDetect(detectedBarcode);
        return;
      }
      await liveScan();
    } finally {
      scanPendingRef.current = false;
      setScanPending(false);
    }
  }, [
    barcode,
    cameraActive,
    crisis,
    isAuthorityCurrent,
    liveDisarmReason,
    liveScan,
    liveSuspend,
    rearmLive,
    scanBarcode,
    snapshotAuthority
  ]);

  const stopCamera = useCallback(() => {
    // Stopping media is an authority transition, including pagehide/bfcache teardown.
    // Every live, barcode, and package request that captured the prior epoch becomes inert.
    invalidateAuthority();
    stop();
  }, [invalidateAuthority, stop]);
  const authorityAwareCamera = useMemo(
    () => ({ ...camera, stop: stopCamera }),
    [camera, stopCamera]
  );

  return {
    camera: authorityAwareCamera,
    live,
    passcode,
    activeBarcode,
    scan,
    scanPending,
    clearBarcode,
    cameraStatus: camera.status,
    cameraBlocked: camera.status === "denied" || camera.status === "unavailable",
    authority
  };
}
