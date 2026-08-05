import { CHECKIN_DUE_DAYS, familyLastTouchAt } from "./family-journey";
import { tFamily } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";
import type { FamilyAppointment, FamilyNavigatorState } from "./types";

/**
 * Calendar files, generated on this device.
 *
 * F4a, and the honest half of the "way back" (spec 13 OQ6). There is no server
 * and therefore no push: an in-app reminder can only fire while the app is
 * open, and a closed phone hears nothing. A `.ics` file goes into the calendar
 * the family already uses and fires whether Ladder is open, installed, or
 * forgotten — so it is the channel this app can actually promise. Nothing here
 * touches the network (FR-8).
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** RFC 5545 wants CRLF, and folded lines at 75 octets. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  for (let index = 75; index < line.length; index += 74) {
    parts.push(` ${line.slice(index, index + 74)}`);
  }
  return parts.join("\r\n");
}

/** Escapes the four characters a TEXT value may not carry raw. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function utcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function dateValue(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export type FamilyCalendarEvent = {
  uid: string;
  /** Stamped once by the caller so the same state produces the same file. */
  now: Date;
  summary: string;
  description: string;
  /** All-day events carry a date; a booked visit carries an instant. */
  start: Date;
  allDay: boolean;
  /** Days before the start to alarm, when the event should carry one. */
  alarmDaysBefore?: number;
  alarmDescription?: string;
};

export function buildFamilyIcs(event: FamilyCalendarEvent): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ladder//Family Navigator//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${utcStamp(event.now)}`
  ];

  if (event.allDay) {
    lines.push(
      `DTSTART;VALUE=DATE:${dateValue(event.start)}`,
      `DTEND;VALUE=DATE:${dateValue(new Date(event.start.valueOf() + DAY_MS))}`
    );
  } else {
    lines.push(
      `DTSTART:${utcStamp(event.start)}`,
      // One hour is a guess about length, not about the time, so it is never
      // rendered anywhere the family reads — it only stops calendars from
      // showing a zero-length sliver.
      `DTEND:${utcStamp(new Date(event.start.valueOf() + 60 * 60 * 1000))}`
    );
  }

  lines.push(`SUMMARY:${escapeText(event.summary)}`, `DESCRIPTION:${escapeText(event.description)}`);

  if (event.alarmDaysBefore !== undefined) {
    lines.push(
      "BEGIN:VALARM",
      `TRIGGER:-P${event.alarmDaysBefore}D`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(event.alarmDescription ?? event.summary)}`,
      "END:VALARM"
    );
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** When the monthly check-in comes back around: last touch + 30 days. */
export function familyCheckinDueAt(family: FamilyNavigatorState): Date | null {
  const last = familyLastTouchAt(family);
  if (last === null) return null;
  const at = new Date(last);
  if (Number.isNaN(at.valueOf())) return null;
  return new Date(at.valueOf() + CHECKIN_DUE_DAYS * DAY_MS);
}

export type FamilyIcsFile = { filename: string; text: string };

export function buildFamilyCheckinIcs(
  family: FamilyNavigatorState,
  language: Language,
  now: Date
): FamilyIcsFile | null {
  const due = familyCheckinDueAt(family);
  if (due === null) return null;
  const name = family.profile?.childFirstName ?? tFamily(language, "checkinChildFallback");
  return {
    filename: `${tFamily(language, "icsCheckinFileName")}.ics`,
    text: buildFamilyIcs({
      uid: `ladder-checkin-${dateValue(due)}@ladder.local`,
      now,
      start: due,
      allDay: true,
      summary: tFamily(language, "icsCheckinSummary", { name }),
      description: tFamily(language, "icsCheckinDescription")
    })
  };
}

export function buildFamilyAppointmentIcs(
  appointment: FamilyAppointment,
  language: Language,
  now: Date
): FamilyIcsFile | null {
  if (appointment.scheduledFor === undefined) return null;
  const start = new Date(appointment.scheduledFor);
  if (Number.isNaN(start.valueOf())) return null;
  return {
    filename: `${tFamily(language, "icsVisitFileName")}.ics`,
    text: buildFamilyIcs({
      uid: `ladder-visit-${appointment.id}@ladder.local`,
      now,
      start,
      allDay: false,
      summary: tFamily(language, "icsVisitSummary", { clinic: appointment.clinic }),
      description: tFamily(language, "icsVisitDescription"),
      alarmDaysBefore: 3,
      alarmDescription: tFamily(language, "icsVisitAlarm", { clinic: appointment.clinic })
    })
  };
}
