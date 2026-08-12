"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isLadderSurface,
  ladderSurfaceForAnchor,
  type LadderSurface
} from "@/components/ladder/ladder-surface-registry";

export type LadderSurfaceLocation = {
  surface: LadderSurface | undefined;
  hash: string;
};

export type LadderSurfaceHistory = {
  read: () => LadderSurfaceLocation;
  push: (location: LadderSurfaceLocation) => void;
  replace: (location: LadderSurfaceLocation) => void;
  subscribe: (listener: () => void) => () => void;
};

export function parseLadderSurfaceUrl(url: string, base = "http://localhost"): LadderSurface | undefined {
  try {
    const value = new URL(url, base).searchParams.get("surface");
    return isLadderSurface(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function parseLadderSurfaceLocationUrl(
  url: string,
  base = "http://localhost"
): LadderSurfaceLocation {
  try {
    const parsed = new URL(url, base);
    const value = parsed.searchParams.get("surface");
    return {
      surface: isLadderSurface(value) ? value : undefined,
      hash: parsed.hash
    };
  } catch {
    return { surface: undefined, hash: "" };
  }
}

/**
 * Writes the surface and fragment as one browser-history entry. An explicit
 * tab choice passes an empty hash, so a fragment from an earlier doorway can
 * never pull the caregiver back to its old surface.
 */
export function withLadderSurfaceUrl(
  url: string,
  surface: LadderSurface,
  hash = "",
  base = "http://localhost"
): string {
  const next = new URL(url, base);
  next.searchParams.set("surface", surface);
  next.hash = hash;
  return `${next.pathname}${next.search}${next.hash}`;
}

function sameLocation(left: LadderSurfaceLocation, right: LadderSurfaceLocation): boolean {
  return left.surface === right.surface && left.hash === right.hash;
}

export const browserLadderSurfaceHistory: LadderSurfaceHistory = {
  read: () => parseLadderSurfaceLocationUrl(window.location.href),
  push: ({ surface, hash }) => {
    if (!surface) return;
    window.history.pushState(
      window.history.state,
      "",
      withLadderSurfaceUrl(window.location.href, surface, hash)
    );
  },
  replace: ({ surface, hash }) => {
    if (!surface) return;
    window.history.replaceState(
      window.history.state,
      "",
      withLadderSurfaceUrl(window.location.href, surface, hash)
    );
  },
  subscribe: (listener) => {
    window.addEventListener("popstate", listener);
    window.addEventListener("hashchange", listener);
    return () => {
      window.removeEventListener("popstate", listener);
      window.removeEventListener("hashchange", listener);
    };
  }
};

export type LadderSurfaceNavigation = {
  activeSurface: LadderSurface;
  pendingAnchor: string | null;
  selectSurface: (surface: LadderSurface) => void;
  replaceSurface: (surface: LadderSurface) => void;
  selectAnchor: (hash: string) => void;
  settleAnchor: () => void;
};

type UseLadderSurfaceNavigationOptions = {
  requestedSurface: LadderSurface;
  available: readonly LadderSurface[];
  onSurfaceChange: (surface: LadderSurface) => void;
  history?: LadderSurfaceHistory;
};

export function useLadderSurfaceNavigation({
  requestedSurface,
  available,
  onSurfaceChange,
  history = browserLadderSurfaceHistory
}: UseLadderSurfaceNavigationOptions): LadderSurfaceNavigation {
  const availableKey = available.join("|");
  const availableRef = useRef(available);
  const requestedRef = useRef(requestedSurface);
  const pendingLocationRef = useRef<LadderSurfaceLocation | undefined>(undefined);
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
  availableRef.current = available;
  requestedRef.current = requestedSurface;

  const resolveLocation = useCallback(
    (location: LadderSurfaceLocation): void => {
      // A registered fragment is more specific than a conflicting query value.
      // This also makes old shared links self-heal without an intermediate tab.
      const anchorSurface = ladderSurfaceForAnchor(location.hash);
      const requested = anchorSurface ?? location.surface ?? "home";
      if (!availableRef.current.includes(requested)) {
        pendingLocationRef.current = location;
        return;
      }

      pendingLocationRef.current = undefined;
      setPendingAnchor(anchorSurface ? location.hash : null);
      if (requestedRef.current !== requested) onSurfaceChange(requested);
    },
    [onSurfaceChange]
  );

  const selectSurface = useCallback(
    (surface: LadderSurface) => {
      const next = availableRef.current.includes(surface) ? surface : "home";
      const location = { surface: next, hash: "" } satisfies LadderSurfaceLocation;
      pendingLocationRef.current = undefined;
      setPendingAnchor(null);
      if (!sameLocation(history.read(), location)) history.push(location);
      if (requestedRef.current !== next) onSurfaceChange(next);
    },
    [history, onSurfaceChange]
  );

  const replaceSurface = useCallback(
    (surface: LadderSurface) => {
      const next = availableRef.current.includes(surface) ? surface : "home";
      const location = { surface: next, hash: "" } satisfies LadderSurfaceLocation;
      pendingLocationRef.current = undefined;
      setPendingAnchor(null);
      if (!sameLocation(history.read(), location)) history.replace(location);
      if (requestedRef.current !== next) onSurfaceChange(next);
    },
    [history, onSurfaceChange]
  );

  const selectAnchor = useCallback(
    (hash: string) => {
      const owner = ladderSurfaceForAnchor(hash);
      if (!owner) return;
      const location = { surface: owner, hash } satisfies LadderSurfaceLocation;
      if (!availableRef.current.includes(owner)) {
        pendingLocationRef.current = location;
        return;
      }
      pendingLocationRef.current = undefined;
      setPendingAnchor(hash);
      if (!sameLocation(history.read(), location)) history.push(location);
      if (requestedRef.current !== owner) onSurfaceChange(owner);
    },
    [history, onSurfaceChange]
  );

  const settleAnchor = useCallback(() => setPendingAnchor(null), []);

  // Resolve the cold URL after mount. If persisted family state has not hydrated
  // yet, keep an unavailable deep link pending instead of erasing it as Home;
  // the availability effect below activates it when that surface appears.
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      resolveLocation(history.read());
      return;
    }

    const pending = pendingLocationRef.current;
    if (pending) {
      const owner = ladderSurfaceForAnchor(pending.hash);
      const requested = owner ?? pending.surface;
      if (requested && availableRef.current.includes(requested)) {
        resolveLocation(pending);
        return;
      }
    }

    if (!availableRef.current.includes(requestedRef.current)) {
      const home = { surface: "home", hash: "" } satisfies LadderSurfaceLocation;
      pendingLocationRef.current = undefined;
      history.replace(home);
      setPendingAnchor(null);
      onSurfaceChange("home");
    }
  }, [availableKey, history, onSurfaceChange, resolveLocation]);

  useEffect(
    () => history.subscribe(() => resolveLocation(history.read())),
    [history, resolveLocation]
  );

  const activeSurface = available.includes(requestedSurface) ? requestedSurface : "home";
  return useMemo(
    () => ({
      activeSurface,
      pendingAnchor,
      selectSurface,
      replaceSurface,
      selectAnchor,
      settleAnchor
    }),
    [activeSurface, pendingAnchor, replaceSurface, selectAnchor, selectSurface, settleAnchor]
  );
}
