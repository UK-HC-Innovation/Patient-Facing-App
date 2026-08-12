"use client";

import React, { useState } from "react";
import { AiDataDisclosure } from "@/components/ai-data-disclosure";
import { LanguageToggle } from "@/components/language-toggle";
import { ACCESSIBILITY_PREFERENCE_LABELS, ACCESSIBILITY_PREFERENCES } from "@/domain/accessibility";
import { familyAiUseMode, type FamilyAiUseMode } from "@/domain/family-ai-consent";
import type { AiDataMode } from "@/domain/privacy-disclosure";
import { type AccessibilityPreference, type AppState, type AuditEvent } from "@/domain/types";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import { tPrivacy, type Language } from "@/i18n/strings";

function formatLogTime(createdAt: string): string {
  const eventDate = new Date(createdAt);
  return Number.isNaN(eventDate.getTime()) ? "Date unavailable" : eventDate.toLocaleString();
}

const actionLabelMap: Record<AuditEvent["action"], string> = {
  created: "Data created",
  updated: "Data updated",
  ai_generated: "AI response generated",
  shared: "Shared with care team",
  exported: "Data exported",
  deleted: "Demo data deleted",
  crisis_escalated: "Crisis resources shown",
  assessment_recorded: "Check-in recorded",
  screening_scheduled: "Eye screening booked",
  screening_result_confirmed: "Screening result confirmed",
  referral_placed: "Referral placed",
  referral_escalated: "Referral escalated to care team",
  recall_scheduled: "Annual recall scheduled",
  referral_booked: "Referral appointment booked",
  voice_consent_granted: "Voice consent granted",
  voice_session_started: "Voice session started",
  family_ai_send_attempted: "Family online-helper send attempted"
};

const familyHistoryTitleKeys = {
  none: "aiHistoryNoneTitle",
  on_device: "aiHistoryOnDeviceTitle",
  online: "aiHistoryOnlineTitle"
} as const satisfies Record<FamilyAiUseMode, FamilyStringKey>;

const familyHistoryBodyKeys = {
  none: "aiHistoryNoneBody",
  on_device: "aiHistoryOnDeviceBody",
  online: "aiHistoryOnlineBody"
} as const satisfies Record<FamilyAiUseMode, FamilyStringKey>;

type PrivacyPanelProps = {
  state: AppState;
  aiDataMode?: AiDataMode;
  onReset: () => void;
  onExport: () => void;
  onRestoreDefaultDemo?: () => void;
  onUpdateAccessibility?: (preferences: AccessibilityPreference[]) => void;
  onUpdateLanguage?: (language: Language) => void;
};

function getDisplayLabel(event: AuditEvent): string {
  return event.label === event.action ? actionLabelMap[event.action] : event.label;
}

export function PrivacyPanel({
  state,
  aiDataMode = "checking",
  onReset,
  onExport,
  onRestoreDefaultDemo,
  onUpdateAccessibility,
  onUpdateLanguage
}: PrivacyPanelProps) {
  const activePreferences = state.patient.accessibilityPreferences ?? [];
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Family text is a separate data path from the voice transport probe above.
  // Attempts are audited before awaiting a reply, so a failed request still
  // counts. `extraction: live` is retained as a compatibility signal for records
  // created before the explicit audit action existed.
  const familySendRecorded =
    state.auditEvents.some(({ action }) => action === "family_ai_send_attempted") ||
    (state.family?.interviews ?? []).some(({ extraction }) => extraction === "live") ||
    state.family?.recommendations?.extraction === "live";
  const familyTextUseMode = familyAiUseMode({
    liveSends: familySendRecorded ? 1 : 0,
    // A draft is browser-stored Ladder text even before it becomes a submitted
    // interview. Count it as on-device activity so Privacy never says the
    // browser contains no Ladder notes while a caregiver's words are saved.
    turnsTaken:
      (state.family?.interviews.length ?? 0) +
      (state.family?.interviewDraft.trim().length ? 1 : 0)
  });

  function togglePreference(preference: AccessibilityPreference) {
    const next = activePreferences.includes(preference)
      ? activePreferences.filter((item) => item !== preference)
      : [...activePreferences, preference];
    onUpdateAccessibility?.(next);
  }

  const eventsNewestFirst = [...state.auditEvents].sort((left, right) => {
    const leftDate = new Date(left.createdAt).getTime();
    const rightDate = new Date(right.createdAt).getTime();

    if (Number.isNaN(leftDate) && Number.isNaN(rightDate)) {
      return 0;
    }

    if (Number.isNaN(leftDate)) {
      return 1;
    }

    if (Number.isNaN(rightDate)) {
      return -1;
    }

    return rightDate - leftDate;
  });

  const displayedEvents = eventsNewestFirst.map((event) => ({
    ...event,
    displayLabel: getDisplayLabel(event)
  }));

  return (
    <div className="grid gap-5">
      <section className="rounded-control border border-care/20 bg-calm p-4">
        <h2 className="text-xl font-semibold">Your privacy promise</h2>
        <p className="mt-2 text-sm leading-6">No ads. No data monetization.</p>
        <p className="mt-2 text-sm leading-6">You control what you share, and you can download or delete your demo data at any time.</p>
        <p className="mt-2 text-sm leading-6">{tPrivacy(state.patient.language, "recordStorage")}</p>
        <AiDataDisclosure mode={aiDataMode} language={state.patient.language} scope="coach" />
        <div
          data-testid="privacy-family-ai-use"
          data-family-ai-use-mode={familyTextUseMode}
          className="mt-3 rounded-control border border-care/20 bg-white/70 p-3"
        >
          <p className="font-semibold text-care">
            {tFamily(state.patient.language, familyHistoryTitleKeys[familyTextUseMode])}
          </p>
          <p className="mt-1 text-sm leading-6 text-ink/80">
            {tFamily(state.patient.language, familyHistoryBodyKeys[familyTextUseMode])}
          </p>
        </div>
      </section>
      <section className="rounded-control border border-ink/10 bg-white p-4">
        <h2 className="text-lg font-semibold">Data controls</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded-control bg-care px-4 py-2 text-sm font-semibold text-white"
            onClick={onExport}
            type="button"
          >
            Export my data
          </button>
          <button
            className="rounded-control border border-pulse px-4 py-2 text-sm font-semibold text-pulse"
            onClick={() => setConfirmingDelete(true)}
            type="button"
          >
            Delete demo data
          </button>
          {onRestoreDefaultDemo ? (
            <button
              className="rounded-control border border-care px-4 py-2 text-sm font-semibold text-care"
              onClick={onRestoreDefaultDemo}
              type="button"
            >
              Restore retinopathy walkthrough
            </button>
          ) : null}
        </div>
        {confirmingDelete ? (
          <div
            aria-label={tPrivacy(state.patient.language, "deleteTitle")}
            className="mt-4 rounded-control border border-pulse/30 bg-pulse/5 p-3"
            role="dialog"
          >
            <h3 className="font-semibold">{tPrivacy(state.patient.language, "deleteTitle")}</h3>
            <p className="mt-1 text-sm leading-6 text-ink/80">{tPrivacy(state.patient.language, "deleteBody")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-control bg-pulse px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  setConfirmingDelete(false);
                  onReset();
                }}
                type="button"
              >
                {tPrivacy(state.patient.language, "deleteConfirm")}
              </button>
              <button
                className="rounded-control border border-ink/20 px-4 py-2 text-sm font-semibold"
                onClick={() => setConfirmingDelete(false)}
                type="button"
              >
                {tPrivacy(state.patient.language, "deleteCancel")}
              </button>
            </div>
          </div>
        ) : null}
      </section>
      {onUpdateAccessibility || onUpdateLanguage ? (
        <section className="rounded-control border border-ink/10 bg-white p-4">
          <h2 className="text-lg font-semibold">Display &amp; access</h2>
          <p className="mt-1 text-sm text-ink/70">Turn on the options that make this easier to use. They apply everywhere.</p>
          {onUpdateLanguage ? (
            <div className="mt-3">
              <LanguageToggle language={state.patient.language} onChange={onUpdateLanguage} />
            </div>
          ) : null}
          {onUpdateAccessibility ? (
            <div className="mt-3 grid gap-2">
              {ACCESSIBILITY_PREFERENCES.map((preference) => (
                <label key={preference} className="flex min-h-12 items-center gap-2 text-sm capitalize">
                  <input
                    checked={activePreferences.includes(preference)}
                    onChange={() => togglePreference(preference)}
                    type="checkbox"
                  />
                  {ACCESSIBILITY_PREFERENCE_LABELS[preference]}
                </label>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
      <section className="rounded-control border border-ink/10 bg-white p-4">
        <h2 className="text-lg font-semibold">Access log</h2>
        {eventsNewestFirst.length === 0 ? (
          <p className="mt-2 text-sm text-ink/70">No activity recorded yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2 text-sm leading-6">
            {displayedEvents.map((event) => (
              <li key={event.id}>
                <strong>{event.displayLabel}</strong> - {formatLogTime(event.createdAt)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
