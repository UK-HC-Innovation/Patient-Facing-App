"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

export type BarcodeDetectorLike = {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorFactory = () => Promise<BarcodeDetectorLike>;

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
export const BARCODE_SCAN_TIMEOUT_MS = 1_500;
const BARCODE_TIMEOUT = Symbol("barcode_timeout");

async function withinScanTimeout<T>(work: Promise<T>): Promise<T | typeof BARCODE_TIMEOUT> {
  let timeoutId: number | undefined;
  const timeout = new Promise<typeof BARCODE_TIMEOUT>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(BARCODE_TIMEOUT), BARCODE_SCAN_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

export function getBarcodeDetectorFactory(): BarcodeDetectorFactory | null {
  if (typeof window === "undefined") {
    return null;
  }
  const native = (window as unknown as { BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
  if (native) {
    return async () => new native({ formats: FORMATS });
  }
  return async () => {
    const mod = await import("barcode-detector/ponyfill");
    const Detector = mod.BarcodeDetector as unknown as new (options?: { formats: string[] }) => BarcodeDetectorLike;
    return new Detector({ formats: FORMATS });
  };
}

export function useBarcodeScan(args: {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  detectorFactory?: BarcodeDetectorFactory;
}): { scan: () => Promise<string | null> } {
  const { videoRef, enabled, detectorFactory } = args;
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const generationRef = useRef(0);

  useEffect(() => () => {
    generationRef.current += 1;
  }, []);

  const scan = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current;
    if (!enabled || !video || video.readyState < 2) {
      return null;
    }
    const factory = detectorFactory ?? getBarcodeDetectorFactory();
    if (!factory) {
      return null;
    }

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    try {
      const result = await withinScanTimeout((async () => {
        detectorRef.current ??= await factory();
        if (generationRef.current !== generation) return null;
        const first = await detectorRef.current.detect(video);
        if (generationRef.current !== generation || first.length === 0) return null;
        const second = await detectorRef.current.detect(video);
        if (generationRef.current !== generation || second.length === 0) return null;
        const value = first[0].rawValue.trim();
        return value.length > 0 && second[0].rawValue.trim() === value ? value : null;
      })());
      if (result === BARCODE_TIMEOUT) {
        if (generationRef.current === generation) generationRef.current += 1;
        return null;
      }
      if (generationRef.current !== generation) return null;
      return result;
    } catch {
      return null;
    }
  }, [detectorFactory, enabled, videoRef]);

  return { scan };
}
