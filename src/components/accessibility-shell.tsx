"use client";

import React, { type ReactNode, useEffect } from "react";
import { accessibilityProfileForPatient } from "@/domain/accessibility";
import { useHealthState } from "@/state/store";

// Applies the patient's accessibility rendering profile at the top of the tree so
// every page inherits large-text, high-contrast, and keyboard-focus affordances.
export function AccessibilityShell({ children }: { children: ReactNode }) {
  const { state } = useHealthState();
  const profile = accessibilityProfileForPatient(state.patient);

  useEffect(() => {
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = state.patient.language;
    return () => {
      document.documentElement.lang = previousLanguage;
    };
  }, [state.patient.language]);

  return (
    <div aria-label={profile.ariaLabel} className={profile.className}>
      {children}
    </div>
  );
}
