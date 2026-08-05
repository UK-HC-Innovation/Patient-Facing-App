"use client";

import React, { useCallback, useEffect, useState } from "react";
import { downloadTextFile } from "@/components/family-download";
import { BTN_SECONDARY, CARD_SECTION_PAPER, CONTROL_FOCUS } from "@/components/family-theme";
import { buildFamilyCheckinIcs, familyCheckinDueAt } from "@/domain/family-ics";
import { checkInDue } from "@/domain/family-journey";
import type { FamilyNavigatorState } from "@/domain/types";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

/**
 * The way back (F4a/F4c, deciding spec 13 OQ6).
 *
 * Nothing in Ladder ever brought a family back. The two channels here are both
 * real, and the copy says which is which: the calendar file fires with the app
 * closed and the phone in a drawer, and the in-app notification can only speak
 * while Ladder is open on this phone. There is no server and therefore no push,
 * and no line here implies one.
 */
const REMINDER_KEY = "ladder-checkin-reminder";

type Receipt =
  | "remindCalendarSaved"
  | "remindCalendarFailed"
  | "remindInAppOn"
  | "remindInAppBlocked"
  | "remindInAppUnsupported";

function readOptIn(): boolean {
  try {
    return window.localStorage.getItem(REMINDER_KEY) === "true";
  } catch {
    return false;
  }
}

function writeOptIn(value: boolean): void {
  try {
    window.localStorage.setItem(REMINDER_KEY, value ? "true" : "false");
  } catch {
    // A phone that refuses storage keeps the toggle for this visit only.
  }
}

async function showCheckinNotification(language: Language): Promise<void> {
  const options: NotificationOptions = {
    body: tFamily(language, "remindNotificationBody"),
    tag: "ladder-checkin-reminder",
    // The service worker opens whatever the notification names, so this one
    // lands on Ladder rather than the blood-pressure app's Today page.
    data: { url: "/ladder" }
  };
  const title = tFamily(language, "remindNotificationTitle");

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, options);
    return;
  }
  new Notification(title, options);
}

export type FamilyCheckinReminderProps = {
  family: FamilyNavigatorState;
  language: Language;
  now: Date;
};

export function FamilyCheckinReminder({ family, language, now }: FamilyCheckinReminderProps) {
  const [optedIn, setOptedIn] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const due = familyCheckinDueAt(family);

  useEffect(() => {
    setOptedIn(readOptIn());
  }, []);

  // The whole honest scope of the in-app channel: a check-in that is already
  // due, on a phone with Ladder open, once per visit.
  useEffect(() => {
    if (!optedIn || !checkInDue(family, now)) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    let cancelled = false;
    void (async () => {
      try {
        if (!cancelled) await showCheckinNotification(language);
      } catch {
        // A refused notification is not worth interrupting the family with; the
        // check-in card is on this same screen either way.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately once per mount: this is a nudge, not a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optedIn]);

  const enable = useCallback(async (): Promise<void> => {
    if (typeof Notification === "undefined") {
      setReceipt("remindInAppUnsupported");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setReceipt("remindInAppBlocked");
        return;
      }
    } catch {
      setReceipt("remindInAppBlocked");
      return;
    }
    writeOptIn(true);
    setOptedIn(true);
    setReceipt("remindInAppOn");
  }, []);

  function saveCalendarFile(): void {
    const file = buildFamilyCheckinIcs(family, language, now);
    if (file === null || !downloadTextFile(file.filename, file.text, "text/calendar;charset=utf-8")) {
      setReceipt("remindCalendarFailed");
      return;
    }
    setReceipt("remindCalendarSaved");
  }

  if (due === null) return null;

  return (
    <section
      id="family-remind"
      data-testid="family-checkin-reminder"
      aria-labelledby="family-remind-title"
      className={CARD_SECTION_PAPER}
    >
      <h2 id="family-remind-title" className="break-words text-lg font-semibold">
        {tFamily(language, "remindTitle")}
      </h2>
      <p className="mt-1 break-words leading-relaxed text-ink/80">
        {tFamily(language, "remindNextLine", {
          date: due.toLocaleDateString(language === "es" ? "es" : "en-US", {
            month: "long",
            day: "numeric",
            year: "numeric"
          })
        })}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="family-checkin-ics"
          onClick={saveCalendarFile}
          className={BTN_SECONDARY}
        >
          {tFamily(language, "remindCalendar")}
        </button>
        {optedIn ? null : (
          <button
            type="button"
            data-testid="family-checkin-notify"
            onClick={() => {
              void enable();
            }}
            className={`inline-flex min-h-12 min-w-0 items-center break-words rounded-control border border-ink/25 px-4 py-2 text-sm font-semibold text-ink/75 ${CONTROL_FOCUS}`}
          >
            {tFamily(language, "remindInApp")}
          </button>
        )}
      </div>
      <p className="mt-2 break-words text-sm leading-6 text-ink/70">
        {tFamily(language, "remindCalendarWhy")}
      </p>
      {/* The limit is not a footnote: it is the feature's whole boundary. */}
      <p className="mt-1 break-words text-sm leading-6 text-ink/70">
        {tFamily(language, "remindInAppLimit")}
      </p>
      <p
        role="status"
        aria-live="polite"
        data-testid="family-remind-receipt"
        className="mt-2 min-h-12 break-words text-sm font-semibold text-care"
      >
        {receipt === null ? "" : tFamily(language, receipt)}
      </p>
    </section>
  );
}
