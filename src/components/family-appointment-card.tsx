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
  FamilyReminderOffset
} from "@/domain/types";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

const CONTROL_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care";

const PREP_SOURCE_URL = "https://www.cdc.gov/ncbddd/actearly/concerned.html";

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

const COUNTDOWN_KEYS: Record<FamilyAppointmentCountdownDays, FamilyStringKey> = {
  13: "apptDemoTwoWeeks",
  2: "apptDemoFewDays",
  1: "apptDemoTomorrow",
  [-1]: "apptDemoPassed"
};

function ladderTurn(children: React.ReactNode, key?: string): React.ReactElement {
  return (
    <div key={key} className="mr-auto max-w-[90%] rounded-control border border-ink/10 bg-white p-3">
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
  onCountdown
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
}) {
  const [demoControlFor, setDemoControlFor] = useState<string | null>(null);
  const now = new Date();
  const appointment = activeFamilyAppointment(family.appointments);
  const reminder = appointment ? dueFamilyReminder(appointment, now) : null;
  const overdue = appointment ? overdueFamilyAppointment(appointment, now) : false;
  const demoControlKey =
    appointment?.scheduledFor === undefined
      ? null
      : `${appointment.id}:${appointment.status}:${appointment.scheduledFor}`;
  const demoControlOpen = demoControlKey !== null && demoControlFor === demoControlKey;

  const primaryButton = `min-h-12 min-w-0 break-words rounded-control bg-care px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${CONTROL_FOCUS}`;
  const secondaryButton = `min-h-12 min-w-0 break-words rounded-control border border-care/30 bg-care/5 px-4 py-2 text-left font-semibold text-care disabled:cursor-not-allowed disabled:opacity-50 ${CONTROL_FOCUS}`;

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
          <p className="ml-auto max-w-[90%] rounded-control bg-care/10 p-3 text-sm leading-6">
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
          <div className="border-t border-care/10 pt-3">
            <button
              type="button"
              disabled={locked}
              aria-expanded={demoControlOpen}
              aria-controls="family-appt-demo-panel"
              onClick={() => setDemoControlFor(demoControlOpen ? null : demoControlKey)}
              className={`min-h-12 w-full min-w-0 rounded-control text-left text-sm font-semibold text-ink/70 disabled:cursor-not-allowed disabled:opacity-50 ${CONTROL_FOCUS}`}
            >
              {tFamily(language, "apptDemoControlsTitle")}
            </button>
            {demoControlOpen ? (
              <fieldset
                id="family-appt-demo-panel"
                disabled={locked}
                aria-label={tFamily(language, "apptDemoControlsTitle")}
                className="mt-2 flex flex-wrap gap-2 rounded-control border border-care/20 bg-calm/40 p-3"
              >
                {FAMILY_APPOINTMENT_COUNTDOWNS.map((daysUntil) => (
                  <button
                    key={daysUntil}
                    type="button"
                    disabled={locked}
                    onClick={() => onCountdown(active.id, daysUntil)}
                    className={secondaryButton}
                  >
                    {tFamily(language, COUNTDOWN_KEYS[daysUntil])}
                  </button>
                ))}
              </fieldset>
            ) : null}
          </div>
        ) : null}
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
  } else if (!appointment || appointment.status === "missed") {
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
    body = ladderTurn(
      <div>
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
      </div>,
      "offer"
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
  } else if (!appointment) {
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
      className="rounded-control border border-care/20 bg-white p-4"
    >
      <p className="mb-2 inline-flex rounded-full bg-calm px-3 py-1 text-xs font-semibold text-care">
        {tFamily(language, "demoBadge")}
      </p>
      <h2 id="family-appt-title" className="text-xl font-semibold">
        {tFamily(language, "apptSectionTitle")}
      </h2>
      <p className="mt-1 text-sm leading-6 text-ink/75">{tFamily(language, "apptSectionIntro")}</p>
      <p
        data-testid="family-appt-live-turn"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {tFamily(language, "apptSectionTitle")}: {activeTurnAnnouncement}
      </p>
      {locked ? (
        <p className="mt-2 rounded-control bg-note/30 p-3 text-sm font-medium">
          {tFamily(language, "apptSafetyHold")}
        </p>
      ) : null}
      <div className="mt-4 space-y-3">{body}</div>
    </section>
  );
}
