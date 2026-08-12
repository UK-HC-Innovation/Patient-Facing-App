import { describe, expect, it } from "vitest";
import {
  familyAppointmentWorkflowReducer,
  type FamilyAppointmentWorkflowState
} from "@/domain/family-appointment-workflow";
import { createFamilyAppointmentOffer, FAMILY_APPOINTMENT_CLINIC } from "@/domain/family-appointments";

describe("familyAppointmentWorkflowReducer", () => {
  it("seeds and books a visit without mutating its input", () => {
    const now = new Date("2026-08-08T12:00:00.000Z");
    const initial: FamilyAppointmentWorkflowState = {
      referral: null,
      appointments: [],
      soonerList: null
    };
    const appointment = createFamilyAppointmentOffer(now);
    const seeded = familyAppointmentWorkflowReducer(initial, {
      type: "seeded",
      referral: { clinic: FAMILY_APPOINTMENT_CLINIC, referredAt: now.toISOString() },
      appointment
    });
    const booked = familyAppointmentWorkflowReducer(seeded, {
      type: "booked",
      appointmentId: appointment.id,
      slot: appointment.offeredSlots[0],
      at: now.toISOString()
    });

    expect(initial).toEqual({ referral: null, appointments: [], soonerList: null });
    expect(seeded.appointments[0].status).toBe("offered");
    expect(booked.appointments[0]).toMatchObject({
      status: "booked",
      scheduledFor: appointment.offeredSlots[0]
    });
  });

  it("records barriers only in the visit overlay", () => {
    const now = new Date("2026-08-08T12:00:00.000Z");
    const offer = createFamilyAppointmentOffer(now);
    const booked: FamilyAppointmentWorkflowState = {
      referral: { clinic: FAMILY_APPOINTMENT_CLINIC, referredAt: now.toISOString() },
      appointments: [
        { ...offer, status: "booked", scheduledFor: offer.offeredSlots[0] }
      ],
      soonerList: null
    };
    const next = familyAppointmentWorkflowReducer(booked, {
      type: "barriersRecorded",
      appointmentId: offer.id,
      barriers: ["ride"],
      at: now.toISOString()
    });

    expect(next.appointments[0].barriers).toEqual(["ride"]);
    expect(booked.appointments[0].barriers).toEqual([]);
  });
});
