"use client";

import { usePathname } from "next/navigation";
import React, { type ReactNode } from "react";
import { AccessibilityShell } from "@/components/accessibility-shell";
import { APP_SURFACE, type AppSurface } from "@/config/app-surface";
import { HealthStateProvider } from "@/state/store";

export function AppSurfaceBoundary({
  children,
  surface = APP_SURFACE
}: {
  children: ReactNode;
  surface?: AppSurface;
}) {
  const pathname = usePathname();

  if (surface === "foodlens" && pathname === "/food/demo") {
    return <>{children}</>;
  }

  return (
    <HealthStateProvider>
      <AccessibilityShell>{children}</AccessibilityShell>
    </HealthStateProvider>
  );
}
