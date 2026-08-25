"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Thresholds dense enough that the 0.50 pause and the 0.60 resume both land inside one
 * observer notification, without asking the browser for a callback per pixel.
 */
const THRESHOLDS = Array.from({ length: 21 }, (_, index) => index / 20);

/**
 * How much of `element` is inside a viewport `rootHeight` tall, 0-1.
 *
 * Normalised against whichever is shorter -- the element or the viewport -- so a viewfinder
 * taller than the screen can still reach 1 and the resume threshold stays reachable.
 */
export function measureVisibleRatio(rect: DOMRect, rootTop: number, rootHeight: number): number {
  const denominator = Math.min(rect.height, rootHeight);
  if (denominator <= 0) {
    return 0;
  }
  const rootBottom = rootTop + rootHeight;
  const visible = Math.max(0, Math.min(rect.bottom, rootBottom) - Math.max(rect.top, rootTop));
  return Math.max(0, Math.min(1, visible / denominator));
}

/**
 * Reports how much of the viewfinder is on screen, without ever putting that number into
 * React state.
 *
 * The first build of this froze the tab: a scroll event set state, the render swapped the
 * pill copy and mounted an animated node, that changed layout, and layout changed scroll --
 * a loop that saturates the main thread. So measurement is coalesced to one animation frame
 * per scroll burst, the ratio is handed to `onRatio` imperatively, and only the caller's own
 * on/off boolean is allowed to render.
 */
export function useViewfinderVisibility({
  targetRef,
  onRatio,
  enabled = true
}: {
  targetRef: RefObject<HTMLElement | null>;
  onRatio: (ratio: number) => void;
  enabled?: boolean;
}): void {
  const onRatioRef = useRef(onRatio);
  onRatioRef.current = onRatio;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }
    const target = targetRef.current;
    if (!target) {
      return;
    }

    let frame = 0;
    let disposed = false;

    const measure = () => {
      frame = 0;
      if (disposed) {
        return;
      }
      const node = targetRef.current;
      if (!node) {
        return;
      }
      onRatioRef.current(measureVisibleRatio(node.getBoundingClientRect(), 0, window.innerHeight));
    };

    const schedule = () => {
      if (frame !== 0) {
        return;
      }
      frame = window.requestAnimationFrame(measure);
    };

    measure();

    // IntersectionObserver where it exists: the browser does the geometry off the main
    // thread and only calls back when a threshold is actually crossed.
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(schedule, { threshold: THRESHOLDS });
    observer?.observe(target);

    // Still listen to scroll: the observer is throttled by the browser, and a drag that
    // stops mid-threshold would otherwise leave the pill reporting the previous state.
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      disposed = true;
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      observer?.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [enabled, targetRef]);
}
