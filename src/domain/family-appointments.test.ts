import { describe, expect, it } from "vitest";
import {
  BARRIER_DOMAINS,
  activeFamilyAppointment,
  buildDemoSlotOffers,
  createFamilyAppointmentOffer,
  dueFamilyReminder,
  formatFamilySlot,
  overdueFamilyAppointment
} from "./family-appointments";
import type { FamilyAppointment } from "./types";

const NOW = new Date("2026-07-24T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function bookedAppointment(daysUntil: number, overrides: Partial<FamilyAppointment> = {}): FamilyAppointment {
  return {
    id: "appt-1",
    clinic: "UK Developmental Pediatrics",
    offeredSlots: [],
    scheduledFor: new Date(NOW.valueOf() + daysUntil * DAY_MS).toISOString(),
    status: "booked",
    barriers: [],
    barriersAsked: false,
    reminderAcks: [],
    createdAt: NOW.toISOString(),
    ...overrides
  };
}

describe("buildDemoSlotOffers", () => {
  it("offers three future slots, soonest first", () => {
    const slots = buildDemoSlotOffers(NOW);
    expect(slots).toHaveLength(3);
    const times = slots.map((slot) => new Date(slot).valueOf());
    expect(times[0]).toBeGreaterThan(NOW.valueOf());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe("createFamilyAppointmentOffer", () => {
  it("starts offered with no booking, barriers, or acks", () => {
    const offer = createFamilyAppointmentOffer(NOW);
    expect(offer.status).toBe("offered");
    expect(offer.scheduledFor).toBeUndefined();
    expect(offer.barriersAsked).toBe(false);
    expect(offer.reminderAcks).toEqual([]);
  });
});

describe("activeFamilyAppointment", () => {
  it("returns the latest appointment", () => {
    const first = bookedAppointment(5, { id: "a" });
    const second = bookedAppointment(9, { id: "b" });
    expect(activeFamilyAppointment([first, second])?.id).toBe("b");
    expect(activeFamilyAppointment([])).toBeUndefined();
  });
});

describe("dueFamilyReminder", () => {
  it("is quiet outside every window", () => {
    expect(dueFamilyReminder(bookedAppointment(20), NOW)).toBeNull();
  });

  it("walks t14 -> t3 -> t1 as the visit approaches", () => {
    expect(dueFamilyReminder(bookedAppointment(13), NOW)).toBe("t14");
    expect(dueFamilyReminder(bookedAppointment(2), NOW)).toBe("t3");
    expect(dueFamilyReminder(bookedAppointment(0.5), NOW)).toBe("t1");
  });

  it("stays quiet once the current window is acknowledged", () => {
    const acked = bookedAppointment(2, {
      reminderAcks: [{ offset: "t3", acknowledgedAt: NOW.toISOString() }]
    });
    expect(dueFamilyReminder(acked, NOW)).toBeNull();
  });

  it("re-asks in a tighter window even after an earlier ack", () => {
    const acked = bookedAppointment(0.5, {
      status: "confirmed",
      reminderAcks: [{ offset: "t14", acknowledgedAt: NOW.toISOString() }]
    });
    expect(dueFamilyReminder(acked, NOW)).toBe("t1");
  });

  it("never fires for unbooked, past, completed, or missed visits", () => {
    expect(dueFamilyReminder(bookedAppointment(2, { status: "offered", scheduledFor: undefined }), NOW)).toBeNull();
    expect(dueFamilyReminder(bookedAppointment(-1), NOW)).toBeNull();
    expect(dueFamilyReminder(bookedAppointment(2, { status: "completed" }), NOW)).toBeNull();
    expect(dueFamilyReminder(bookedAppointment(2, { status: "missed" }), NOW)).toBeNull();
  });
});

describe("overdueFamilyAppointment", () => {
  it("flags booked or confirmed visits whose date has passed", () => {
    expect(overdueFamilyAppointment(bookedAppointment(-0.5), NOW)).toBe(true);
    expect(overdueFamilyAppointment(bookedAppointment(0.5), NOW)).toBe(false);
    expect(overdueFamilyAppointment(bookedAppointment(-0.5, { status: "missed" }), NOW)).toBe(false);
  });
});

describe("BARRIER_DOMAINS", () => {
  it("maps every real barrier to a matchable need domain", () => {
    expect(BARRIER_DOMAINS.ride).toBe("transportation");
    expect(BARRIER_DOMAINS.sibling_care).toBe("respite");
    expect(BARRIER_DOMAINS.work_schedule).toBe("parent_support");
  });
});

describe("formatFamilySlot", () => {
  it("renders a readable local time in both languages", () => {
    const slot = "2026-08-14T13:30:00.000Z";
    expect(formatFamilySlot(slot, "en")).toMatch(/14/);
    expect(formatFamilySlot(slot, "es").length).toBeGreaterThan(0);
  });
});
