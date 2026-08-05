"use client";

import { ChevronRight } from "lucide-react";
import React from "react";
import { activeFamilyAppointment, formatFamilySlot } from "@/domain/family-appointments";
import { activeFamilyFacts } from "@/domain/family-facts";
import { monthsOnList, nextFamilyRung, type FamilyRung } from "@/domain/family-journey";
import type { FamilyNavigatorState } from "@/domain/types";
import { CONTROL_FOCUS } from "@/components/family-theme";
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
      // No week count when only the birth year is known: the rung points, and
      // the card it points at names the window and offers the one-tap repair.
      return rung.weeksLeft === undefined
        ? tFamily(language, "rungClockRange")
        : tFamily(language, "rungClock", { weeks: rung.weeksLeft });
    default:
      return tFamily(language, RUNG_LABEL_KEYS[rung.kind]);
  }
}

/** "about a month ago" — elapsed time only, in the words a person would use. */
function timeAgo(from: string, now: Date, language: Language): string {
  const days = Math.floor((now.valueOf() - new Date(from).valueOf()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return tFamily(language, "agoToday");
  if (days === 1) return tFamily(language, "agoDaysOne");
  if (days < 30) return tFamily(language, "agoDays", { count: days });
  const months = Math.round(days / 30);
  return months <= 1
    ? tFamily(language, "agoMonthsOne")
    : tFamily(language, "agoMonths", { count: months });
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
  /**
   * True when the caregiver arrived with history. A return visit opens on what
   * changed and what is due — never on interview framing, which is what the
   * audit found the shipped page doing (P3).
   */
  returning?: boolean;
  /** How many places the Programs surface is actually showing. */
  programsCount?: number;
};

/**
 * The front door. On a return visit it answers two questions before anything
 * asks anything: what changed since last time, and what is due now. The doorway
 * rows under it are the only navigation it offers — one labelled row per
 * surface, each carrying the count that makes it worth the tap.
 */
export function FamilyWaitHeader({
  family,
  language,
  now = new Date(),
  checkinOpen,
  returning = false,
  programsCount
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
  const shortMonthName = referral
    ? new Date(referral.referredAt).toLocaleDateString(language === "es" ? "es" : "en-US", {
        month: "long"
      })
    : "";
  const notes = family.interviews.filter(({ kind }) => kind !== "orientation").length;
  const stepsInMotion = family.steps.filter(
    ({ status }) => status !== "not_for_us" && status !== "enrolled"
  ).length;
  const appointment = activeFamilyAppointment(family.appointments);
  const visitWhen =
    appointment?.scheduledFor &&
    (appointment.status === "booked" || appointment.status === "confirmed")
    ? formatFamilySlot(appointment.scheduledFor, language)
    : null;
  const lastInterview = family.interviews.at(-1);
  // Absent means included: what the packet would print if it were opened now.
  const packetNotes = activeFamilyFacts(family.facts).filter(
    ({ includeInSummary }) => includeInSummary !== false
  ).length;

  // One labelled row per surface that exists, each with the count that makes it
  // worth a tap. The hrefs stay in-page anchors so a folded section still opens
  // and a deep load still lands.
  const doorways: Array<{ href: string; key: FamilyStringKey; meta: string }> = [
    ...(family.activeDomains.length > 0 && programsCount !== undefined
      ? [
          {
            href: "#family-resources",
            key: "navResources" as FamilyStringKey,
            meta: tFamily(
              language,
              programsCount === 1 ? "homeDoorProgramsMetaOne" : "homeDoorProgramsMeta",
              { count: programsCount }
            )
          }
        ]
      : []),
    ...(referral
      ? [
          {
            href: "#family-appt-title",
            key: "navVisit" as FamilyStringKey,
            meta: visitWhen ?? tFamily(language, "homeDoorVisitMeta")
          }
        ]
      : []),
    {
      href: "#family-visit-packet",
      key: "navPacket" as FamilyStringKey,
      meta: tFamily(
        language,
        packetNotes === 0
          ? "homeDoorNotesMetaNone"
          : packetNotes === 1
            ? "homeDoorNotesMetaOne"
            : "homeDoorNotesMeta",
        { count: packetNotes }
      )
    }
  ];

  return (
    <section
      data-testid="family-wait-header"
      aria-labelledby="family-wait-title"
      className="min-w-0 rounded-control border border-care/30 bg-white p-4 shadow-sm"
    >
      <h2 id="family-wait-title" className="break-words text-xl font-semibold">
        {tFamily(language, returning ? "homeReturnTitle" : "waitHeaderTitle")}
      </h2>
      {returning && lastInterview ? (
        <p data-testid="family-last-note" className="mt-1 break-words text-sm text-ink/70">
          {tFamily(language, "homeLastNote", {
            date: new Date(lastInterview.createdAt).toLocaleDateString(
              language === "es" ? "es" : "en-US",
              { month: "long", day: "numeric" }
            ),
            ago: timeAgo(lastInterview.createdAt, now, language)
          })}
        </p>
      ) : null}
      {referral ? (
        <p className="mt-1 break-words leading-relaxed text-ink/90">
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
      <p className="mt-1 break-words text-sm leading-6 text-ink/70">
        {tFamily(language, "waitHeaderNoPrediction")}
      </p>
      {label !== null && rung.kind !== "quiet" ? (
        <a
          href={`#${RUNG_TARGETS[rung.kind]}`}
          data-testid="family-next-rung"
          className={`mt-3 inline-flex min-h-12 min-w-0 items-center break-words rounded-control bg-care px-4 py-2 font-semibold text-white ${CONTROL_FOCUS}`}
        >
          {label}
        </a>
      ) : null}
      <div data-testid="family-wait-chips" className="mt-3 flex flex-wrap gap-2 text-sm">
        {notes > 0 ? (
          <span className="rounded-full bg-calm px-3 py-1">
            {tFamily(language, notes === 1 ? "waitChipNotesOne" : "waitChipNotes", { count: notes })}
          </span>
        ) : null}
        {stepsInMotion > 0 ? (
          <span className="rounded-full bg-calm px-3 py-1">
            {tFamily(language, stepsInMotion === 1 ? "waitChipStepsOne" : "waitChipSteps", {
              count: stepsInMotion
            })}
          </span>
        ) : null}
        {referral ? (
          <span className="rounded-full bg-calm px-3 py-1">
            {tFamily(language, "homeChipOnListSince", { month: shortMonthName })}
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
      <nav
        aria-label={tFamily(language, "navOnThisPage")}
        data-testid="family-doorways"
        className="mt-4 border-t border-ink/10 pt-1"
      >
        <ul>
          {doorways.map(({ href, key, meta }) => (
            <li key={href} className="border-b border-care/10 last:border-b-0">
              <a
                href={href}
                className={`flex min-h-12 min-w-0 items-center justify-between gap-3 py-2 no-underline ${CONTROL_FOCUS}`}
              >
                <span className="min-w-0 break-words font-semibold text-ink">
                  {tFamily(language, key)}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-care">
                  {meta}
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
