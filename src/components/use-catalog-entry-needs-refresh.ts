"use client";

import { useCallback, useSyncExternalStore } from "react";
import { catalogEntryNeedsRefresh } from "@/domain/family-freshness";

const subscribeToNothing = (): (() => void) => () => undefined;
const freshDuringServerRender = (): boolean => false;

/**
 * The catalog clock is client-owned: static HTML always starts neutral, then
 * React takes a hydration-safe snapshot of today's freshness state. There is no
 * external subscription because a normal rerender or page revisit is enough to
 * cross a day-granularity maintenance boundary.
 */
export function useCatalogEntryNeedsRefresh(verifiedAt: string): boolean {
  const getSnapshot = useCallback(
    () => catalogEntryNeedsRefresh({ verifiedAt }),
    [verifiedAt]
  );
  return useSyncExternalStore(subscribeToNothing, getSnapshot, freshDuringServerRender);
}
