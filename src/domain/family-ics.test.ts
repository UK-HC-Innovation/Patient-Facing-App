import { describe, expect, it } from "vitest";
import { schoolAgeFamilyState } from "./family-fixtures";
import {
  buildFamilyAppointmentIcs,
  buildFamilyCheckinIcs,
  buildFamilyIcs,
  familyCheckinDueAt
} from "./family-ics";
import type { FamilyAppointment, FamilyNavigatorState } from "./types";

const NOW = new Date("2026-07-17T12:00:00.000Z");

function lines(text: string): string[] {
  return text.split("\r\n");
}

const touched: FamilyNavigatorState = {
  ...schoolAgeFamilyState,
  profile: { ...schoolAgeFamilyState.profile!, childFirstName: "Riley" },
  interviews: [
    {
      id: "interview-1",
      rawText: "reading is hard",
      source: "typed",
      createdAt: "2026-07-10T12:00:00.000Z",
      extraction: "mock",
      kind: "note"
    }
  ],
  checkinTouchedAt: null
};

describe("buildFamilyIcs", () => {
  it("writes a calendar a phone will open, with CRLF line endings", () => {
    const text = buildFamilyIcs({
      uid: "u-1",
      now: NOW,
      start: new Date("2026-08-09T00:00:00.000Z"),
      allDay: true,
      summary: "Check in",
      description: "Open Ladder"
    });

    expect(lines(text)[0]).toBe("BEGIN:VCALENDAR");
    expect(lines(text).at(-2)).toBe("END:VCALENDAR");
    expect(text.endsWith("\r\n")).toBe(true);
    expect(text).toContain("UID:u-1");
    expect(text).toContain("DTSTAMP:20260717T120000Z");
    expect(text).toContain("DTSTART;VALUE=DATE:20260809");
    // An all-day event's DTEND is exclusive, so it is the next day.
    expect(text).toContain("DTEND;VALUE=DATE:20260810");
  });

  it("escapes the characters a TEXT value may not carry raw", () => {
    const text = buildFamilyIcs({
      uid: "u-2",
      now: NOW,
      start: NOW,
      allDay: false,
      summary: "Visit; with, commas",
      description: "Line one\nline two \\ backslash"
    });

    expect(text).toContain("SUMMARY:Visit\\; with\\, commas");
    expect(text).toContain("DESCRIPTION:Line one\\nline two \\\\ backslash");
  });

  it("folds a long line rather than shipping one a parser will reject", () => {
    const text = buildFamilyIcs({
      uid: "u-3",
      now: NOW,
      start: NOW,
      allDay: false,
      summary: "x".repeat(200),
      description: "short"
    });

    for (const line of lines(text)) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
    // Continuation lines are the folded remainder, marked by a leading space.
    expect(lines(text).some((line) => line.startsWith(" x"))).toBe(true);
  });

  it("carries an alarm only when one is asked for", () => {
    const withAlarm = buildFamilyIcs({
      uid: "u-4",
      now: NOW,
      start: NOW,
      allDay: false,
      summary: "Visit",
      description: "",
      alarmDaysBefore: 3,
      alarmDescription: "Three days out"
    });
    expect(withAlarm).toContain("BEGIN:VALARM");
    expect(withAlarm).toContain("TRIGGER:-P3D");
    expect(withAlarm).toContain("DESCRIPTION:Three days out");

    expect(
      buildFamilyIcs({ uid: "u-5", now: NOW, start: NOW, allDay: false, summary: "x", description: "" })
    ).not.toContain("VALARM");
  });
});

describe("familyCheckinDueAt", () => {
  it("is the last touch plus the check-in window", () => {
    expect(familyCheckinDueAt(touched)?.toISOString()).toBe("2026-08-09T12:00:00.000Z");
  });

  it("is nothing at all for a family that has never touched anything", () => {
    expect(familyCheckinDueAt({ ...touched, interviews: [] })).toBeNull();
  });
});

describe("buildFamilyCheckinIcs", () => {
  it("names the child and dates the file at the next check-in", () => {
    const file = buildFamilyCheckinIcs(touched, "en", NOW)!;

    expect(file.filename).toBe("ladder-check-in.ics");
    expect(file.text).toContain("SUMMARY:Ladder check-in — how is Riley doing?");
    expect(file.text).toContain("DTSTART;VALUE=DATE:20260809");
    // Same state, same file: nothing here reads a live clock but DTSTAMP.
    expect(buildFamilyCheckinIcs(touched, "en", NOW)!.text).toBe(file.text);
  });

  it("falls back to plain wording when we have no name, in both languages", () => {
    const anonymous = { ...touched, profile: { ...touched.profile!, childFirstName: undefined } };

    expect(buildFamilyCheckinIcs(anonymous, "en", NOW)!.text).toContain("how is your child doing?");
    const spanish = buildFamilyCheckinIcs(anonymous, "es", NOW)!;
    expect(spanish.filename).toBe("chequeo-ladder.ics");
    expect(spanish.text).toContain("¿cómo va tu hijo o hija?");
  });

  it("offers nothing when there is no next check-in to name", () => {
    expect(buildFamilyCheckinIcs({ ...touched, interviews: [] }, "en", NOW)).toBeNull();
  });
});

describe("buildFamilyAppointmentIcs", () => {
  const appointment: FamilyAppointment = {
    id: "appt-1",
    clinic: "UK Developmental Pediatrics",
    offeredSlots: [],
    scheduledFor: "2026-09-15T14:30:00.000Z",
    status: "booked",
    barriers: [],
    barriersAsked: true,
    reminderAcks: [],
    createdAt: "2026-07-01T12:00:00.000Z"
  };

  it("writes the visit with a three-day alarm", () => {
    const file = buildFamilyAppointmentIcs(appointment, "en", NOW)!;

    expect(file.filename).toBe("ladder-visit.ics");
    expect(file.text).toContain("DTSTART:20260915T143000Z");
    expect(file.text).toContain("SUMMARY:Evaluation visit — UK Developmental Pediatrics");
    expect(file.text).toContain("TRIGGER:-P3D");
    expect(file.text).toContain("UID:ladder-visit-appt-1@ladder.local");
  });

  it("writes nothing for a visit with no time yet, or an unreadable one", () => {
    expect(buildFamilyAppointmentIcs({ ...appointment, scheduledFor: undefined }, "en", NOW)).toBeNull();
    expect(buildFamilyAppointmentIcs({ ...appointment, scheduledFor: "not a date" }, "en", NOW)).toBeNull();
  });
});
