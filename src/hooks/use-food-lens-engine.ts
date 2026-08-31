"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FoodAuthority } from "@/domain/food-authority";
import { useFoodCamera, type CameraStatus } from "@/hooks/use-food-camera";
import { useBarcodeScan } from "@/hooks/use-barcode-scan";
import { useLiveFoodScore, type LiveScoreState } from "@/hooks/use-live-food-score";
import { usePasscode } from "@/hooks/use-passcode";

export type FoodLensEngine = {
  camera: ReturnType<typeof useFoodCamera>;
  live: LiveScoreState;
  passcode: string | undefined;
  /** The packaged food currently in frame, or null where the mount has no barcode reader. */
  activeBarcode: string | null;
  cameraStatus: CameraStatus;
  /** Camera denied or absent: the viewfinder gives up its height and the voice bar inverts. */
  cameraBlocked: boolean;
  authority: FoodAuthority;
};

/**
 * Everything both Food Lens doors need to see a food: the camera, the vision loop that
 * scores what it sees, the barcode reader that outranks the loop while a package is in
 * frame, and the demo passcode all three spend against.
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

  const { activeBarcode } = useBarcodeScan({
    videoRef: camera.videoRef,
    enabled: barcode !== undefined && cameraActive,
    onBarcode: (code) => barcode?.onDetect(code)
  });

  const live = useLiveFoodScore({
    videoRef: camera.videoRef,
    grabFrame: camera.grabFrame,
    cameraActive,
    barcodeActive: activeBarcode !== null,
    crisis,
    passcode,
    authority
  });

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
    cameraStatus: camera.status,
    cameraBlocked: camera.status === "denied" || camera.status === "unavailable",
    authority
  };
}
