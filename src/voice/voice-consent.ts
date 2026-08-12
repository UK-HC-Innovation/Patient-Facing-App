"use client";

import { useCallback, useEffect, useState, type Dispatch } from "react";
import { recordAuditEvent } from "@/domain/audit";
import { useOptionalHealthState, type HealthAction } from "@/state/store";

/** Legacy device-wide key. It is deliberately ignored and removed on deletion. */
export const VOICE_CONSENT_KEY = "home-health-voice-consent";
export const VOICE_SESSION_CONSENT_PREFIX = `${VOICE_CONSENT_KEY}:v2:`;

export function voiceConsentStorageKey(patientId?: string): string {
  return `${VOICE_SESSION_CONSENT_PREFIX}${encodeURIComponent(patientId ?? "anonymous")}`;
}

export function isVoiceConsentGranted(patientId?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(voiceConsentStorageKey(patientId)) === "true";
  } catch {
    return false;
  }
}

export function markVoiceConsentGranted(patientId?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(voiceConsentStorageKey(patientId), "true");
  } catch {
    // The mounted component still remembers consent if session storage is blocked.
  }
}

export function revokeVoiceConsent(patientId?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(voiceConsentStorageKey(patientId));
  } catch {
    // Revocation still closes the mounted voice controls through React state.
  }
}

export type VoiceEntryContext = {
  patientId: string;
  dispatch: Dispatch<HealthAction>;
};

export function useVoiceEntry(explicit?: VoiceEntryContext): {
  consentRequired: boolean;
  grantConsent: () => void;
  revokeConsent: () => void;
  onSessionStart: (surface: string) => void;
} {
  const healthState = useOptionalHealthState();
  const patientId = explicit?.patientId ?? healthState?.state.patient.id;
  const dispatch = explicit?.dispatch ?? healthState?.dispatch;
  const [consentRequired, setConsentRequired] = useState(() => !isVoiceConsentGranted(patientId));

  useEffect(() => {
    setConsentRequired(!isVoiceConsentGranted(patientId));
  }, [patientId]);

  const grantConsent = useCallback((): void => {
    markVoiceConsentGranted(patientId);
    setConsentRequired(false);
    if (!dispatch || !patientId) return;
    dispatch({
      type: "addAuditEvent",
      event: recordAuditEvent(patientId, "voice_consent_granted", "Voice consent granted")
    });
  }, [dispatch, patientId]);

  const revokeConsent = useCallback((): void => {
    revokeVoiceConsent(patientId);
    setConsentRequired(true);
  }, [patientId]);

  const onSessionStart = useCallback(
    (surface: string): void => {
      if (!dispatch || !patientId) return;
      dispatch({
        type: "addAuditEvent",
        event: recordAuditEvent(
          patientId,
          "voice_session_started",
          `Voice session started — ${surface}`
        )
      });
    },
    [dispatch, patientId]
  );

  return { consentRequired, grantConsent, revokeConsent, onSessionStart };
}
