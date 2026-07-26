"use client";

import React from "react";
import { activeFamilyAppointment, formatFamilySlot } from "@/domain/family-appointments";
import { monthsOnList, nextFamilyRung, type FamilyRung } from "@/domain/family-journey";
import type { FamilyNavigatorState } from "@/domain/types";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

// The header points; it never asks. Each rung names the section that owns the
// interaction, and this link is the whole feature's one navigation control — so
// `nextFamilyRung` only raises a rung whose section is on the page for that same
// state. Anything added here needs the matching guard there.
const RUNG_TARGETS: Record<Exclude<FamilyRung["kind"], "quiet">, string> = {
  safety: "family-experience",
  visit: "family-appt-title",
  clinic_now: "family-clinic-now",
  clock: "family-resources",
  checkin: "family-checkin",
  step: "family-followup",
  journal: "family-interview-title"
};

// `clock` carries a week count, so it interpolates separately.
const RUNG_LABEL_KEYS: Record<Exclude<FamilyRung["kind"], "quiet" | "clock">, FamilyStringKey> = {
  safety: "rungSafety",
  visit: "rungVisit",
  clinic_now: "rungClinicNow",
  checkin: "rungCheckin",
  step: "rungStep",
  journal: "rungJournal"
};

function rungLabel(rung: FamilyRung, language: Language): string | null {
  switch (rung.kind) {
    case "quiet":
      return null;
    case "clock":
      return tFamily(language, "rungClock", { weeks: rung.weeksLeft });
    default:
      return tFamily(language, RUNG_LABEL_KEYS[rung.kind]);
  }
}

export type FamilyWaitHeaderProps = {
  family: FamilyNavigatorState;
  language: Language;
  now?: Date;
  /**
   * True while the check-in card is on the page. Only the page knows: the card
   * stays for the rest of the visit once the caregiver starts it, even after
   * that first answer stamps a touch and the month of silence is over.
   */
  checkinOpen?: boolean;
};

export function FamilyWaitHeader({
  family,
  language,
  now = new Date(),
  checkinOpen
}: FamilyWaitHeaderProps) {
  const rung = nextFamilyRung(family, now, { checkinOpen });
  const label = rungLabel(rung, language);
  const referral = family.referral;
  // Elapsed time only. A predicted seen-by date is the one number we will not invent.
  const months = referral ? monthsOnList(referral.referredAt, now) : 0;
  const monthName = referral
    ? new Date(referral.referredAt).toLocaleDateString(language === "es" ? "es" : "en-US", {
        month: "long",
        year: "numeric"
      })
    : "";
  const notes = family.interviews.filter(({ kind }) => kind !== "orientation").length;
  const stepsInMotion = family.steps.filter(
    ({ status }) => status !== "not_for_us" && status !== "enrolled"
  ).length;
  const appointment = activeFamilyAppointment(family.appointments);
  const visitWhen = appointment?.scheduledFor
    ? formatFamilySlot(appointment.scheduledFor, language)
    : null;

  return (
    <section
      data-testid="family-wait-header"
      aria-labelledby="family-wait-title"
      className="rounded-control border border-care/20 bg-white p-4"
    >
      <h2 id="family-wait-title" className="text-xl font-semibold">
        {tFamily(language, "waitHeaderTitle")}
      </h2>
      {referral ? (
        <p className="mt-1 break-words text-sm leading-6 text-ink/80">
          {months >= 1
            ? tFamily(language, "waitHeaderOnList", {
                clinic: referral.clinic,
                month: monthName,
                months
              })
            : tFamily(language, "waitHeaderOnListFresh", {
                clinic: referral.clinic,
                month: monthName
              })}
        </p>
      ) : null}
      <p className="mt-1 break-words text-sm leading-6 text-ink/60">
        {tFamily(language, "waitHeaderNoPrediction")}
      </p>
      {label !== null && rung.kind !== "quiet" ? (
        <a
          href={`#${RUNG_TARGETS[rung.kind]}`}
          data-testid="family-next-rung"
          className="mt-3 inline-flex min-h-12 min-w-0 items-center break-words rounded-control bg-care px-4 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care"
        >
          {label}
        </a>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {notes > 0 ? (
          <span className="rounded-full bg-calm px-3 py-1">
            {tFamily(language, "waitChipNotes", { count: notes })}
          </span>
        ) : null}
        {stepsInMotion > 0 ? (
          <span className="rounded-full bg-calm px-3 py-1">
            {tFamily(language, "waitChipSteps", { count: stepsInMotion })}
          </span>
        ) : null}
        {visitWhen ? (
          <span className="rounded-full bg-calm px-3 py-1">
            {tFamily(language, "waitChipVisit", { when: visitWhen })}
          </span>
        ) : null}
        {family.soonerList ? (
          <span className="rounded-full bg-calm px-3 py-1">
            {tFamily(language, "waitChipSooner")}
          </span>
        ) : null}
      </div>
    </section>
  );
}
