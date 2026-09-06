"use client";

import { usePathname } from "next/navigation";
import React, { type ReactNode } from "react";
import { AccessibilityShell } from "@/components/accessibility-shell";
import { HealthStateProvider } from "@/state/store";

/** /compass is a permanent 308 onto this, so one path covers the whole public door. */
export const PUBLIC_DOOR_PATH = "/food/demo";

/**
 * Decides whether a route gets the patient store at all.
 *
 * The public door is provider-free on every build, not just the Azure one. Local and
 * production used to mount the store here and write a stranger's browser a full patient
 * record the page never showed them (critique N9). Nothing about that was surface
 * specific, so the surface no longer takes part in the decision.
 */
export function AppSurfaceBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === PUBLIC_DOOR_PATH) {
    return <>{children}</>;
  }

  return (
    <HealthStateProvider>
      <AccessibilityShell>{children}</AccessibilityShell>
    </HealthStateProvider>
  );
}
