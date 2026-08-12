"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { LadderSurface } from "@/components/ladder/ladder-surface-registry";

/**
 * The four Ladder surfaces share the browser viewport. Remembering one offset per
 * surface makes a tab behave like a place rather than one very long document,
 * while keeping every visited panel mounted preserves its local React state.
 */
export function useLadderSurfaceScrollRestoration(
  surface: LadderSurface,
  pendingAnchor: string | null = null
): void {
  const positionsRef = useRef(new Map<LadderSurface, number>());
  const activeRef = useRef(surface);
  const initializedRef = useRef(false);
  const pendingAnchorRef = useRef(pendingAnchor);

  useEffect(() => {
    const remember = (): void => {
      positionsRef.current.set(activeRef.current, Math.max(0, window.scrollY));
    };
    window.addEventListener("scroll", remember, { passive: true });
    const previous = window.history.scrollRestoration;
    try {
      window.history.scrollRestoration = "manual";
    } catch {
      // Older embedded browsers may expose a read-only history object.
    }
    return () => {
      remember();
      window.removeEventListener("scroll", remember);
      try {
        window.history.scrollRestoration = previous;
      } catch {
        // Nothing else is required when the browser owns restoration.
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      activeRef.current = surface;
      positionsRef.current.set(surface, Math.max(0, window.scrollY));
      return;
    }
    if (activeRef.current === surface) {
      if (pendingAnchorRef.current && !pendingAnchor) {
        positionsRef.current.set(surface, Math.max(0, window.scrollY));
      }
      pendingAnchorRef.current = pendingAnchor;
      return;
    }
    // The scroll listener captured the outgoing surface before React hid its
    // panel. Reading here is too late: mounting a shorter destination may have
    // already clamped scrollY and would overwrite the accurate cached offset.
    activeRef.current = surface;
    pendingAnchorRef.current = pendingAnchor;
    // The anchor coordinator owns this transition's final scroll. Restoring a
    // remembered offset first creates a visible jump and can defeat focus.
    if (pendingAnchor) return;
    const top = positionsRef.current.get(surface) ?? 0;
    try {
      window.scrollTo({ top, left: 0, behavior: "auto" });
    } catch {
      // Scroll restoration is progressive enhancement; navigation still works.
    }
  }, [pendingAnchor, surface]);
}
