"use client";

import { useMemo } from "react";

/**
 * The demo passcode from `?k=`, in one place.
 *
 * It was parsed identically at five call sites across the two Food Lens doors and the voice
 * session. Production has no `DEMO_PASSCODE` set (removed 2026-08-19), so this is almost
 * always undefined and the AI routes answer without it -- but when it is set, every paid
 * route has to read the same value or half the surface silently locks.
 */
export function readPasscode(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return new URLSearchParams(window.location.search).get("k") ?? undefined;
}

/** Read once per mount: the passcode is a launch parameter, not something that changes under us. */
export function usePasscode(): string | undefined {
  return useMemo(() => readPasscode(), []);
}
