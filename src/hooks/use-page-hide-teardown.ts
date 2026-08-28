"use client";

import { useEffect, useRef } from "react";

/**
 * Release the camera, the microphone and anything else expensive when the page goes away.
 *
 * `visibilitychange` alone misses a mobile tab being swiped shut, and `pagehide` alone
 * misses a backgrounded tab, so both are registered. A camera left running behind a
 * backgrounded tab keeps the indicator light on and keeps costing frames.
 *
 * The stops live in a ref rather than the dependency array on purpose. Callers pass freshly
 * bound closures every render, and re-subscribing on each identity change leaves a window --
 * however small -- where neither listener is attached. Registering once and reading the
 * latest stops at fire time cannot miss an event.
 */
export function usePageHideTeardown(stops: ReadonlyArray<() => void>): void {
  const stopsRef = useRef(stops);
  stopsRef.current = stops;

  useEffect(() => {
    const teardown = () => {
      if (document.hidden) {
        for (const stop of stopsRef.current) {
          stop();
        }
      }
    };
    document.addEventListener("visibilitychange", teardown);
    window.addEventListener("pagehide", teardown);
    return () => {
      document.removeEventListener("visibilitychange", teardown);
      window.removeEventListener("pagehide", teardown);
    };
  }, []);
}
