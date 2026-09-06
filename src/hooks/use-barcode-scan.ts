"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export type BarcodeDetectorLike = {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorFactory = () => Promise<BarcodeDetectorLike>;

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
const SCAN_INTERVAL_MS = 500;
const CLEAR_AFTER_TICKS = 10;

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
  onBarcode: (barcode: string) => void;
  detectorFactory?: BarcodeDetectorFactory;
}): { activeBarcode: string | null; dismissBarcode: () => void } {
  const { videoRef, enabled, onBarcode, detectorFactory } = args;
  const [activeBarcode, setActiveBarcode] = useState<string | null>(null);
  const onBarcodeRef = useRef(onBarcode);
  onBarcodeRef.current = onBarcode;
  const activeRef = useRef<string | null>(null);
  const dismissedRef = useRef<string | null>(null);
  const dismissBarcode = useCallback(() => {
    // Release camera preemption immediately, without reopening the product still in view.
    dismissedRef.current = activeRef.current;
    activeRef.current = null;
    setActiveBarcode(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const factory = detectorFactory ?? getBarcodeDetectorFactory();
    if (!factory) {
      return;
    }

    let cancelled = false;
    let busy = false;
    let detector: BarcodeDetectorLike | null = null;
    let pendingValue: string | null = null;
    let pendingCount = 0;
    let missTicks = 0;

    const setActive = (value: string | null) => {
      activeRef.current = value;
      setActiveBarcode(value);
    };

    const tick = async () => {
      const video = videoRef.current;
      if (busy || cancelled || !video || video.readyState < 2) {
        return;
      }
      busy = true;
      try {
        if (!detector) {
          detector = await factory();
        }
        const results = await detector.detect(video);
        if (cancelled) {
          return;
        }
        if (results.length > 0) {
          missTicks = 0;
          const value = results[0].rawValue;
          if (value === dismissedRef.current) {
            pendingValue = null;
            pendingCount = 0;
            return;
          }
          if (value === pendingValue) {
            pendingCount += 1;
          } else {
            pendingValue = value;
            pendingCount = 1;
          }
          if (pendingCount >= 2 && value !== activeRef.current) {
            setActive(value);
            onBarcodeRef.current(value);
          }
        } else {
          pendingValue = null;
          pendingCount = 0;
          missTicks += 1;
          // A deliberate move away permits scanning that product again.
          if (missTicks >= 2) dismissedRef.current = null;
          if (missTicks >= CLEAR_AFTER_TICKS && activeRef.current !== null) {
            setActive(null);
          }
        }
      } catch {
        // detection is best-effort per frame
      } finally {
        busy = false;
      }
    };

    const interval = setInterval(tick, SCAN_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, detectorFactory, videoRef]);

  return { activeBarcode, dismissBarcode };
}
