"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Starts recording and emits a view event per navigation.
 *
 * Mounted once in the app root layout, which is the only place a pathname read belongs.
 * `scripts/check-public-door-store-free.mjs` forbids `usePathname` in the shared Food Lens
 * layer because a route check there would be a capability decision in disguise; here the
 * pathname is not deciding anything, it is the thing being reported, and it goes through
 * `usageRouteFromPath` so only ids from the closed set are ever emitted.
 *
 * Both the recorder and the vocabulary are pulled in dynamically rather than imported at
 * the top. Mounted in the root layout, a static import puts them on the first load of every
 * route, and `scripts/check-ladder-bundle.mjs` is what noticed -- the Food Lens door had
 * 0.6 KiB of headroom and this feature spent it. Deferring is also just the right shape:
 * usage recording has no business on the critical path of a first paint. The cost is that a
 * visit abandoned before hydration finishes records nothing, which is the correct trade for
 * a diagnostic.
 */
export function UsageBoundary() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    void Promise.all([import("@/domain/usage-event"), import("./recorder")])
      .then(([vocabulary, recorder]) => {
        if (cancelled) return;
        // Idempotent, so calling it on every navigation costs a boolean check.
        recorder.startUsageRecorder();
        recorder.recordUsage({ kind: "view", route: vocabulary.usageRouteFromPath(pathname ?? "/") });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
