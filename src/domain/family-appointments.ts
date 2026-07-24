import type { Language } from "@/i18n/strings";
import type {
  DevNeedDomain,
  FamilyAppointment,
  FamilyAppointmentBarrier,
  FamilyReminderOffset
} from "./types";

export const FAMILY_APPOINTMENT_CLINIC = "UK Developmental Pediatrics";

export const REMINDER_OFFSET_DAYS: Record<FamilyReminderOffset, number> = {
  t14: 14,
  t3: 3,
  t1: 1
};

// Demo time-travel targets: inside each reminder window, plus one past the date.
export type FamilyAppointmentCountdownDays = 13 | 2 | 1 | -1;
export const FAMILY_APPOINTMENT_COUNTDOWNS: FamilyAppointmentCountdownDays[] = [13, 2, 1, -1];

// A barrier is a need â€” it routes into the same domains the navigator already
// matches resources for. That is the no-show mechanism: remove the barrier.
export const BARRIER_DOMAINS: Record<Exclude<FamilyAppointmentBarrier, "none">, DevNeedDomain> = {
  ride: "transportation",
  sibling_care: "respite",
  work_schedule: "parent_support"
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildDemoSlotOffers(now: Date): string[] {
  return [21, 28, 35].map((days) => {
    const slot = new Date(now.valueOf() + days * DAY_MS);
    slot.setHours(9, 30, 0, 0);
    return slot.toISOString();
  });
}

export function createFamilyAppointmentOffer(now: Date): FamilyAppointment {
  return {
    id: crypto.randomUUID(),
    clinic: FAMILY_APPOINTMENT_CLINIC,
    offeredSlots: buildDemoSlotOffers(now),
    status: "offered",
    barriers: [],
    barriersAsked: false,
    reminderAcks: [],
    createdAt: now.toISOString()
  };
}

export function activeFamilyAppointment(
  appointments: FamilyAppointment[]
): FamilyAppointment | undefined {
  return appointments.at(-1);
}

export function daysUntilFamilyAppointment(
  appointment: FamilyAppointment,
  now: Date
): number | null {
  if (appointment.scheduledFor === undefined) {
    return null;
  }
  return (new Date(appointment.scheduledFor).valueOf() - now.valueOf()) / DAY_MS;
}

// The most urgent open, unacknowledged reminder â€” one turn at a time. Acking
// the urgent one satisfies the wider windows behind it by construction.
export function dueFamilyReminder(
  appointment: FamilyAppointment,
  now: Date
): FamilyReminderOffset | null {
  if (appointment.status !== "booked" && appointment.status !== "confirmed") {
    return null;
  }
  const days = daysUntilFamilyAppointment(appointment, now);
  if (days === null || days < 0) {
    return null;
  }
  const open = (Object.keys(REMINDER_OFFSET_DAYS) as FamilyReminderOffset[]).filter(
    (offset) => days <= REMINDER_OFFSET_DAYS[offset]
  );
  if (open.length === 0) {
    return null;
  }
  const target = open.reduce((soonest, offset) =>
    REMINDER_OFFSET_DAYS[offset] < REMINDER_OFFSET_DAYS[soonest] ? offset : soonest
  );
  return appointment.reminderAcks.some((ack) => ack.offset === target) ? null : target;
}

export function overdueFamilyAppointment(appointment: FamilyAppointment, now: Date): boolean {
  if (appointment.status !== "booked" && appointment.status !== "confirmed") {
    return false;
  }
  const days = daysUntilFamilyAppointment(appointment, now);
  return days !== null && days < 0;
}

export function formatFamilySlot(slotIso: string, language: Language): string {
  return new Date(slotIso).toLocaleString(language === "es" ? "es" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
