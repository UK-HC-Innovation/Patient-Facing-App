import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  VOICE_CONSENT_KEY,
  VOICE_SESSION_CONSENT_PREFIX,
  isVoiceConsentGranted,
  markVoiceConsentGranted,
  revokeVoiceConsent,
  voiceConsentStorageKey,
  useVoiceEntry
} from "./voice-consent";
import { VoiceConsentSheet } from "./voice-consent-sheet";

const dispatch = vi.fn();

vi.mock("@/state/store", () => ({
  useOptionalHealthState: () => ({ state: { patient: { id: "patient-voice" } }, dispatch })
}));

function ConsentHarness() {
  const entry = useVoiceEntry();
  return entry.consentRequired ? (
    <VoiceConsentSheet language="en" onAccept={entry.grantConsent} onCancel={() => undefined} />
  ) : (
    <button type="button" onClick={() => entry.onSessionStart("family")}>Start microphone</button>
  );
}

describe("voice consent", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    dispatch.mockClear();
  });

  it("round-trips a caregiver-scoped session flag and ignores the legacy device-wide flag", () => {
    localStorage.setItem(VOICE_CONSENT_KEY, "true");
    expect(isVoiceConsentGranted("patient-a")).toBe(false);

    markVoiceConsentGranted("patient-a");
    expect(sessionStorage.getItem(voiceConsentStorageKey("patient-a"))).toBe("true");
    expect(isVoiceConsentGranted("patient-a")).toBe(true);
    expect(isVoiceConsentGranted("patient-b")).toBe(false);
    expect([...Array(sessionStorage.length)].map((_, index) => sessionStorage.key(index))).toEqual([
      `${VOICE_SESSION_CONSENT_PREFIX}patient-a`
    ]);

    revokeVoiceConsent("patient-a");
    expect(isVoiceConsentGranted("patient-a")).toBe(false);
  });

  it("renders the consent sheet before first mic use and audits consent and session start", () => {
    render(<ConsentHarness />);
    expect(screen.getByRole("dialog", { name: "Before you use voice" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start microphone" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "I understand, use voice" }));

    expect(screen.getByRole("button", { name: "Start microphone" })).toBeInTheDocument();
    expect(dispatch).toHaveBeenCalledWith({
      type: "addAuditEvent",
      event: expect.objectContaining({
        patientId: "patient-voice",
        action: "voice_consent_granted",
        label: "Voice consent granted"
      })
    });

    fireEvent.click(screen.getByRole("button", { name: "Start microphone" }));
    expect(dispatch).toHaveBeenLastCalledWith({
      type: "addAuditEvent",
      event: expect.objectContaining({
        action: "voice_session_started",
        label: "Voice session started — family"
      })
    });
  });

  it("starts with consent satisfied only for the current caregiver context", () => {
    markVoiceConsentGranted("patient-voice");
    const { result } = renderHook(() => useVoiceEntry());
    expect(result.current.consentRequired).toBe(false);

    act(() => result.current.onSessionStart("chat"));
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("can revoke consent immediately in the mounted session", () => {
    markVoiceConsentGranted("patient-voice");
    const { result } = renderHook(() => useVoiceEntry());
    expect(result.current.consentRequired).toBe(false);

    act(() => result.current.revokeConsent());

    expect(result.current.consentRequired).toBe(true);
    expect(isVoiceConsentGranted("patient-voice")).toBe(false);
  });
});
