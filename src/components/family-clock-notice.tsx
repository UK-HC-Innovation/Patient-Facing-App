"use client";

import React, { useState } from "react";
import type { FirstStepsClock } from "@/domain/family-clocks";
import { BTN_SECONDARY, CONTROL_FOCUS, NOTICE_DEADLINE } from "@/components/family-theme";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

function locale(language: Language): string {
  return language === "es" ? "es-US" : "en-US";
}

/** "November 17, 2026" — the cutoff is a UTC instant, so it is read as one. */
function fullDate(date: Date, language: Language): string {
  return date.toLocaleDateString(locale(language), {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

/** "November 2026" — a window edge names a month, never a day it cannot know. */
function monthAndYear(date: Date, language: Language): string {
  return date.toLocaleDateString(locale(language), {
    timeZone: "UTC",
    month: "long",
    year: "numeric"
  });
}

/**
 * The one place the First Steps deadline is put into words.
 *
 * A known birth month earns a week count and a dated cutoff. A birth *year*
 * earns neither — it gets the window the cutoff falls in, plainly blamed on the
 * missing month, plus the one tap that fixes it everywhere the clock appears.
 * The two shapes never borrow each other's copy: "about 14 weeks left" computed
 * from a year is the false precision this component exists to prevent.
 */
export function familyClockLine(
  clock: FirstStepsClock,
  language: Language,
  childName: string
): string {
  if (clock.kind === "dated") {
    return tFamily(language, "clockFirstStepsDated", {
      weeks: clock.weeksLeft,
      date: fullDate(clock.cutoff, language)
    });
  }
  if (clock.earliest === null) {
    return tFamily(language, "clockFirstStepsRangeOpen", {
      name: childName,
      latest: monthAndYear(clock.latest, language)
    });
  }
  return tFamily(language, "clockFirstStepsRange", {
    name: childName,
    earliest: monthAndYear(clock.earliest, language),
    latest: monthAndYear(clock.latest, language)
  });
}

export type FamilyClockNoticeProps = {
  clock: FirstStepsClock;
  language: Language;
  /** The child's first name, or the language's stand-in for it. */
  childName: string;
  /** Shown above the line on the front door, where the clock is not attached to a card. */
  withHeadline?: boolean;
  /**
   * Saves the month the caregiver picks. Absent on cards that only report the
   * clock — the repair is offered once per screen, not once per card.
   */
  onAddBirthMonth?: (birthMonth: number) => void;
  className?: string;
};

export function FamilyClockNotice({
  clock,
  language,
  childName,
  withHeadline = false,
  onAddBirthMonth,
  className
}: FamilyClockNoticeProps) {
  const [picking, setPicking] = useState(false);
  const [saved, setSaved] = useState(false);
  const repairable = clock.kind === "range" && onAddBirthMonth !== undefined;

  return (
    <div data-testid="family-clock-notice" className={`${NOTICE_DEADLINE} ${className ?? ""}`}>
      {withHeadline ? (
        <p className="break-words font-semibold leading-relaxed">
          {tFamily(language, "clockHeadline", { name: childName })}
        </p>
      ) : null}
      <p
        data-testid="family-clock-line"
        data-clock-kind={clock.kind}
        className={`break-words text-sm leading-6 ${withHeadline ? "mt-1" : ""}`}
      >
        {familyClockLine(clock, language, childName)}
      </p>

      {repairable && !saved ? (
        picking ? (
          <div className="mt-3" data-testid="family-clock-month-picker">
            <p id="family-clock-month-label" className="break-words text-sm font-semibold">
              {tFamily(language, "profileBirthMonthLabel")}
            </p>
            <div
              role="group"
              aria-labelledby="family-clock-month-label"
              className="mt-2 flex flex-wrap gap-2"
            >
              {MONTHS.map((month) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => {
                    setSaved(true);
                    setPicking(false);
                    onAddBirthMonth?.(month);
                  }}
                  aria-label={new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString(
                    locale(language),
                    { timeZone: "UTC", month: "long" }
                  )}
                  className={`min-h-12 min-w-12 rounded-control border border-care/30 bg-white px-3 font-semibold text-care ${CONTROL_FOCUS}`}
                >
                  {new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString(locale(language), {
                    timeZone: "UTC",
                    month: "short"
                  })}
                </button>
              ))}
            </div>
            <p className="mt-2 break-words text-xs text-ink/65">
              {tFamily(language, "clockAddBirthMonthHint")}
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              data-testid="family-clock-add-birth-month"
              onClick={() => setPicking(true)}
              className={`mt-3 ${BTN_SECONDARY}`}
            >
              {tFamily(language, "clockAddBirthMonth")}
            </button>
            <p className="mt-1 break-words text-xs text-ink/65">
              {tFamily(language, "clockAddBirthMonthHint")}
            </p>
          </>
        )
      ) : null}

      {saved ? (
        <p role="status" className="mt-2 break-words text-sm font-semibold text-care">
          {tFamily(language, "clockBirthMonthSaved")}
        </p>
      ) : null}
    </div>
  );
}
