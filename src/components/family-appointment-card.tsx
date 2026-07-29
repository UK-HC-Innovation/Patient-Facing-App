"use client";

import React, { useState } from "react";
import {
  FAMILY_APPOINTMENT_COUNTDOWNS,
  activeFamilyAppointment,
  dueFamilyReminder,
  formatFamilySlot,
  overdueFamilyAppointment,
  type FamilyAppointmentCountdownDays
} from "@/domain/family-appointments";
import type {
  FamilyAppointment,
  FamilyAppointmentBarrier,
  FamilyNavigatorState,
  FamilyReminderOffset,
  FamilySoonerConstraint
} from "@/domain/types";
import {
  BTN_CHOICE,
  BTN_PRIMARY,
  CARD_SECTION,
  CONTROL_FOCUS,
  DEMO_BLOCK,
  H2_SECTION,
  NOTICE_INFO
} from "@/components/family-theme";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

// Verified 2026-07-24: the legacy /ncbddd/actearly/concerned.html path 301s here.
const PREP_SOURCE_URL = "https://www.cdc.gov/act-early/";

const REMINDER_KEYS: Record<FamilyReminderOffset, FamilyStringKey> = {
  t14: "apptReminderT14",
  t3: "apptReminderT3",
  t1: "apptReminderT1"
};

const BARRIER_OPTIONS: ReadonlyArray<{ value: FamilyAppointmentBarrier; key: FamilyStringKey }> = [
  { value: "ride", key: "apptBarrierRide" },
  { value: "sibling_care", key: "apptBarrierSiblings" },
  { value: "work_schedule", key: "apptBarrierWork" },
  { value: "none", key: "apptBarrierNone" }
];

const SOONER_OPTIONS: ReadonlyArray<{ value: FamilySoonerConstraint; key: FamilyStringKey }> = [
  { value: "weekday_mornings", key: "soonerMornings" },
  { value: "weekday_afternoons", key: "soonerAfternoons" },
  { value: "any_weekday", key: "soonerAnyWeekday" },
  { value: "needs_notice", key: "soonerNotice" }
];

const COUNTDOWN_KEYS: Record<FamilyAppointmentCountdownDays, FamilyStringKey> = {
  13: "apptDemoTwoWeeks",
  2: "apptDemoFewDays",
  1: "apptDemoTomorrow",
  [-1]: "apptDemoPassed"
};

// A flat step tile, not a speech bubble: the conversation metaphor belongs to
// the composer thread alone; this card is a dashboard section.
function ladderTurn(children: React.ReactNode, key?: string): React.ReactElement {
  return (
    <div key={key} className="min-w-0 rounded-control bg-paper p-3">
      {children}
    </div>
  );
}

export function FamilyAppointmentCard({
  family,
  language,
  locked,
  onSeedReferral,
  onBook,
  onBarriers,
  onAckReminder,
  onReschedule,
  onComplete,
  onMiss,
  onRebook,
  onCountdown,
  onJoinSoonerList,
  onLeaveSoonerList,
  onSoonerOffer,
  onDeclineSoonerOffer
}: {
  family: FamilyNavigatorState;
  language: Language;
  locked: boolean;
  onSeedReferral: () => void;
  onBook: (appointmentId: string, slot: string) => void;
  onBarriers: (appointmentId: string, barriers: FamilyAppointmentBarrier[]) => void;
  onAckReminder: (appointmentId: string, offset: FamilyReminderOffset) => void;
  onReschedule: (appointmentId: string) => void;
  onComplete: (appointmentId: string) => void;
  onMiss: (appointmentId: string) => void;
  onRebook: () => void;
  onCountdown: (appointmentId: string, daysUntil: FamilyAppointmentCountdownDays) => void;
  onJoinSoonerList: (constraints: FamilySoonerConstraint[]) => void;
  onLeaveSoonerList: () => void;
  /** Takes the booking the backfill would replace — the visit on screen. */
  onSoonerOffer: (supersedesId: string) => void;
  onDeclineSoonerOffer: (appointmentId: string) => void;
}) {
  const [demoControlFor, setDemoControlFor] = useState<string | null>(null);
  // Session-only: "No thanks" quiets the ask for this visit. A refusal is never
  // stored — re-offering next session is honest, and the family may have moved.
  const [soonerRefused, setSoonerRefused] = useState(false);
  const [soonerPicking, setSoonerPicking] = useState(false);
  const [soonerPicks, setSoonerPicks] = useState<FamilySoonerConstraint[]>([]);
  const now = new Date();
  const appointment = activeFamilyAppointment(family.appointments);
  const reminder = appointment ? dueFamilyReminder(appointment, now) : null;
  const overdue = appointment ? overdueFamilyAppointment(appointment, now) : false;
  const demoControlKey =
    appointment?.scheduledFor === undefined
      ? null
      : `${appointment.id}:${appointment.status}:${appointment.scheduledFor}`;
  const demoControlOpen = demoControlKey !== null && demoControlFor === demoControlKey;

  const primaryButton = BTN_PRIMARY;
  const secondaryButton = BTN_CHOICE;

  // A backfill offer names the visit it would replace, and declining hands that
  // visit back. "Keep our current time" therefore only appears while that visit
  // is still a time the family holds — never once it has been retired.
  const priorBooking =
    appointment?.status === "offered" && appointment.supersedesId !== undefined
      ? family.appointments.find(({ id }) => id === appointment.supersedesId)
      : undefined;
  const soonerOffer =
    priorBooking !== undefined &&
    (priorBooking.status === "booked" || priorBooking.status === "confirmed") &&
    priorBooking.scheduledFor !== undefined;

  // One ask at a time: the earlier-visit turn only speaks in the card's quiet
  // states — never over the barriers question, a due reminder, or an overdue visit.
  const soonerQuiet =
    !locked &&
    family.referral !== null &&
    appointment !== undefined &&
    (appointment.status === "offered" ||
      ((appointment.status === "booked" || appointment.status === "confirmed") &&
        appointment.barriersAsked &&
        !reminder &&
        !overdue));

  // In the card's quiet states the earlier-visit turn is the last thing said, so
  // it is also what the live region has to name. One flag each, read by the turn
  // and by the announcer, so the two cannot drift apart.
  const soonerListed = soonerQuiet && family.soonerList !== null;
  const soonerAsk = soonerQuiet && family.soonerList === null && !soonerRefused;

  function toggleSoonerPick(value: FamilySoonerConstraint): void {
    setSoonerPicks((picks) =>
      picks.includes(value) ? picks.filter((pick) => pick !== value) : [...picks, value]
    );
  }

  function soonerBlock(): React.ReactNode {
    if (soonerListed) {
      return ladderTurn(
        <div data-testid="family-sooner-status">
          <p className="break-words text-sm leading-6">{tFamily(language, "soonerOnList")}</p>
          <button
            type="button"
            disabled={locked}
            onClick={onLeaveSoonerList}
            className={`mt-3 ${secondaryButton}`}
          >
            {tFamily(language, "soonerLeave")}
          </button>
        </div>,
        "sooner-status"
      );
    }
    if (!soonerAsk) {
      return null;
    }
    return ladderTurn(
      <div data-testid="family-sooner-turn">
        <p className="break-words font-semibold">{tFamily(language, "soonerQuestion")}</p>
        {soonerPicking ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {SOONER_OPTIONS.map(({ value, key }) => (
                <button
                  key={value}
                  type="button"
                  disabled={locked}
                  aria-pressed={soonerPicks.includes(value)}
                  onClick={() => toggleSoonerPick(value)}
                  className={`${secondaryButton} ${soonerPicks.includes(value) ? "bg-care/20" : ""}`}
                >
                  {tFamily(language, key)}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={locked || soonerPicks.length === 0}
              onClick={() => onJoinSoonerList(soonerPicks)}
              className={`mt-3 ${primaryButton}`}
            >
              {tFamily(language, "soonerConfirm")}
            </button>
          </>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={locked}
              onClick={() => setSoonerPicking(true)}
              className={primaryButton}
            >
              {tFamily(language, "soonerYes")}
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => setSoonerRefused(true)}
              className={secondaryButton}
            >
              {tFamily(language, "soonerNo")}
            </button>
          </div>
        )}
      </div>,
      "sooner-ask"
    );
  }

  function bookedBody(active: FamilyAppointment): React.ReactNode {
    const when = active.scheduledFor ? formatFamilySlot(active.scheduledFor, language) : "";
    return (
      <>
        {ladderTurn(
          <p className="break-words font-semibold">
            {tFamily(language, active.status === "confirmed" ? "apptConfirmedLine" : "apptBookedLine", { when })}
          </p>,
          "booked-line"
        )}
        {ladderTurn(
          <div>
            <p className="break-words font-semibold">{tFamily(language, "apptPrepTitle")}</p>
            <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm leading-6 text-ink/80">
              <li>{tFamily(language, "apptPrepBullet1")}</li>
              <li>{tFamily(language, "apptPrepBullet2")}</li>
              <li>{tFamily(language, "apptPrepBullet3")}</li>
            </ul>
            {locked ? (
              <span className="mt-2 inline-flex min-h-12 items-center text-sm font-semibold text-ink/50">
                {tFamily(language, "apptPrepSource")}
              </span>
            ) : (
              <a
                href={PREP_SOURCE_URL}
                target="_blank"
                rel="noreferrer"
                className={`mt-2 inline-flex min-h-12 items-center text-sm font-semibold text-care underline ${CONTROL_FOCUS}`}
              >
                {tFamily(language, "apptPrepSource")}
              </a>
            )}
          </div>,
          "prep"
        )}
        {!active.barriersAsked ? (
          ladderTurn(
            <div>
              <p className="break-words font-semibold">{tFamily(language, "apptBarriersQuestion")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {BARRIER_OPTIONS.map(({ value, key }) => (
                  <button
                    key={value}
                    type="button"
                    disabled={locked}
                    onClick={() => onBarriers(active.id, [value])}
                    className={secondaryButton}
                  >
                    {tFamily(language, key)}
                  </button>
                ))}
              </div>
            </div>,
            "barriers-ask"
          )
        ) : (
          <p className="min-w-0 rounded-control bg-calm/50 p-3 text-sm leading-6">
            {tFamily(
              language,
              active.barriers.every((barrier) => barrier === "none")
                ? "apptBarriersNoneThanks"
                : "apptBarriersThanks"
            )}
          </p>
        )}
        {active.barriersAsked && reminder ? (
          ladderTurn(
            <div data-testid="family-appt-reminder">
              <p className="break-words font-semibold">
                {tFamily(language, REMINDER_KEYS[reminder], { clinic: active.clinic, when })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onAckReminder(active.id, reminder)}
                  className={primaryButton}
                >
                  {tFamily(language, "apptReminderConfirm")}
                </button>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onReschedule(active.id)}
                  className={secondaryButton}
                >
                  {tFamily(language, "apptReminderReschedule")}
                </button>
              </div>
            </div>,
            "reminder"
          )
        ) : null}
        {active.barriersAsked && overdue ? (
          ladderTurn(
            <div data-testid="family-appt-overdue">
              <p className="break-words font-semibold">{tFamily(language, "apptOverdueQuestion")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={locked} onClick={() => onComplete(active.id)} className={primaryButton}>
                  {tFamily(language, "apptOverdueWent")}
                </button>
                <button type="button" disabled={locked} onClick={() => onMiss(active.id)} className={secondaryButton}>
                  {tFamily(language, "apptOverdueMissed")}
                </button>
              </div>
            </div>,
            "overdue"
          )
        ) : null}
        {active.scheduledFor !== undefined && active.barriersAsked && !reminder && !overdue ? (
          <div className={DEMO_BLOCK}>
            <button
              type="button"
              disabled={locked}
              aria-expanded={demoControlOpen}
              aria-controls="family-appt-demo-panel"
              onClick={() => setDemoControlFor(demoControlOpen ? null : demoControlKey)}
              className={`flex min-h-12 w-full min-w-0 flex-wrap items-center gap-2 rounded-control text-left text-sm font-semibold text-ink/60 disabled:cursor-not-allowed disabled:opacity-50 ${CONTROL_FOCUS}`}
            >
              {tFamily(language, "apptDemoControlsTitle")}
            </button>
            {demoControlOpen ? (
              <fieldset
                id="family-appt-demo-panel"
                disabled={locked}
                aria-label={tFamily(language, "apptDemoControlsTitle")}
                className="mt-2 flex flex-wrap gap-2"
              >
                {FAMILY_APPOINTMENT_COUNTDOWNS.map((daysUntil) => (
                  <button
                    key={daysUntil}
                    type="button"
                    disabled={locked}
                    onClick={() => onCountdown(active.id, daysUntil)}
                    className={`min-h-12 min-w-0 break-words rounded-control border border-ink/25 bg-white px-3 py-2 text-sm font-semibold text-ink/70 disabled:cursor-not-allowed disabled:opacity-50 ${CONTROL_FOCUS}`}
                  >
                    {tFamily(language, COUNTDOWN_KEYS[daysUntil])}
                  </button>
                ))}
                <button
                  type="button"
                  data-testid="family-sooner-demo"
                  disabled={locked || family.soonerList === null}
                  onClick={() => onSoonerOffer(active.id)}
                  className={`min-h-12 min-w-0 break-words rounded-control border border-ink/25 bg-white px-3 py-2 text-sm font-semibold text-ink/70 disabled:cursor-not-allowed disabled:opacity-50 ${CONTROL_FOCUS}`}
                >
                  {tFamily(language, "soonerDemoCta")}
                </button>
              </fieldset>
            ) : null}
          </div>
        ) : null}
        {soonerBlock()}
      </>
    );
  }

  let body: React.ReactNode;
  if (family.referral === null) {
    body = ladderTurn(
      <div>
        <p className="break-words text-sm leading-6 text-ink/75">{tFamily(language, "apptJoinDemoBody")}</p>
        <button type="button" disabled={locked} onClick={onSeedReferral} className={`mt-3 ${primaryButton}`}>
          {tFamily(language, "apptJoinDemoCta")}
        </button>
      </div>,
      "seed"
    );
    // A retired visit is only ever last if the booking that replaced it was
    // dropped as unreadable on load. There is no time left to show, so the card
    // asks for a new one rather than reading the old slot back as current.
  } else if (!appointment || appointment.status === "missed" || appointment.status === "replaced") {
    body = (
      <>
        {appointment?.status === "missed"
          ? ladderTurn(<p className="break-words font-semibold">{tFamily(language, "apptMissedLine")}</p>, "missed")
          : null}
        {ladderTurn(
          <button type="button" disabled={locked} onClick={onRebook} className={primaryButton}>
            {tFamily(language, "apptRebookCta")}
          </button>,
          "rebook"
        )}
      </>
    );
  } else if (appointment.status === "offered") {
    body = (
      <>
        {ladderTurn(
          <div data-sooner-offer={soonerOffer ? "true" : undefined}>
            <p className="break-words text-sm leading-6 text-ink/75">
              {tFamily(language, "apptOnListLine", { clinic: appointment.clinic })}
            </p>
            <p className="mt-1 break-words font-semibold">{tFamily(language, "apptOfferQuestion")}</p>
            <div className="mt-3 grid gap-2">
              {appointment.offeredSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  disabled={locked}
                  onClick={() => onBook(appointment.id, slot)}
                  className={secondaryButton}
                >
                  {formatFamilySlot(slot, language)}
                </button>
              ))}
            </div>
            {soonerOffer ? (
              <button
                type="button"
                disabled={locked}
                onClick={() => onDeclineSoonerOffer(appointment.id)}
                className={`mt-3 ${secondaryButton}`}
              >
                {tFamily(language, "soonerDecline")}
              </button>
            ) : null}
          </div>,
          "offer"
        )}
        {soonerBlock()}
      </>
    );
  } else if (appointment.status === "completed") {
    body = ladderTurn(
      <p className="break-words font-semibold">{tFamily(language, "apptCompletedLine")}</p>,
      "completed"
    );
  } else {
    body = bookedBody(appointment);
  }

  let activeTurnAnnouncement: string;
  if (family.referral === null) {
    activeTurnAnnouncement = tFamily(language, "apptJoinDemoBody");
  } else if (!appointment || appointment.status === "replaced") {
    activeTurnAnnouncement = tFamily(language, "apptRebookCta");
  } else if (appointment.status === "missed") {
    activeTurnAnnouncement = tFamily(language, "apptMissedLine");
  } else if (appointment.status === "offered") {
    activeTurnAnnouncement = tFamily(language, "apptOfferQuestion");
  } else if (appointment.status === "completed") {
    activeTurnAnnouncement = tFamily(language, "apptCompletedLine");
  } else if (!appointment.barriersAsked) {
    activeTurnAnnouncement = tFamily(language, "apptBarriersQuestion");
  } else if (reminder) {
    activeTurnAnnouncement = tFamily(language, REMINDER_KEYS[reminder], {
      clinic: appointment.clinic,
      when: appointment.scheduledFor ? formatFamilySlot(appointment.scheduledFor, language) : ""
    });
  } else if (overdue) {
    activeTurnAnnouncement = tFamily(language, "apptOverdueQuestion");
  } else if (soonerAsk) {
    activeTurnAnnouncement = tFamily(language, "soonerQuestion");
  } else if (soonerListed) {
    activeTurnAnnouncement = tFamily(language, "soonerOnList");
  } else {
    activeTurnAnnouncement = tFamily(
      language,
      appointment.status === "confirmed" ? "apptConfirmedLine" : "apptBookedLine",
      { when: appointment.scheduledFor ? formatFamilySlot(appointment.scheduledFor, language) : "" }
    );
  }

  return (
    <section
      data-testid="family-appointment-card"
      aria-labelledby="family-appt-title"
      className={CARD_SECTION}
    >
      <p className="mb-2 inline-flex rounded-full border border-ink/20 px-3 py-1 text-xs font-medium text-ink/60">
        {tFamily(language, "demoBadge")}
      </p>
      <h2 id="family-appt-title" className={`${H2_SECTION} scroll-mt-4`}>
        {tFamily(language, "apptSectionTitle")}
      </h2>
      <p className="mt-1 text-sm leading-6 text-ink/60">{tFamily(language, "apptSectionIntro")}</p>
      <p
        data-testid="family-appt-live-turn"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {tFamily(language, "apptSectionTitle")}: {activeTurnAnnouncement}
      </p>
      {locked ? (
        <p className={`mt-2 text-sm font-medium ${NOTICE_INFO}`}>
          {tFamily(language, "apptSafetyHold")}
        </p>
      ) : null}
      <div className="mt-4 space-y-3">{body}</div>
    </section>
  );
}
