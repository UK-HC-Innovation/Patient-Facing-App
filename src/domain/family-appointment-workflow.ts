import {
  buildDemoSlotOffers,
  dueFamilyReminder,
  overdueFamilyAppointment
} from "@/domain/family-appointments";
import type {
  FamilyAppointment,
  FamilyAppointmentBarrier,
  FamilyReferral,
  FamilyReminderOffset,
  FamilySoonerConstraint,
  FamilySoonerList
} from "@/domain/types";

export type FamilyAppointmentWorkflowState = {
  referral: FamilyReferral | null;
  appointments: FamilyAppointment[];
  soonerList: FamilySoonerList | null;
};

export type FamilyAppointmentWorkflowEvent =
  | { type: "referred"; referral: FamilyReferral }
  | { type: "seeded"; referral: FamilyReferral; appointment: FamilyAppointment }
  | { type: "offered"; appointment: FamilyAppointment }
  | { type: "withdrawn"; appointmentId: string; at: string }
  | { type: "booked"; appointmentId: string; slot: string; at: string }
  | {
      type: "barriersRecorded";
      appointmentId: string;
      barriers: FamilyAppointmentBarrier[];
      at: string;
    }
  | { type: "reminderAcknowledged"; appointmentId: string; offset: FamilyReminderOffset; at: string }
  | { type: "rescheduleRequested"; appointmentId: string; at: string }
  | { type: "completed"; appointmentId: string; at: string }
  | { type: "missed"; appointmentId: string; at: string }
  | { type: "soonerListJoined"; constraints: FamilySoonerConstraint[]; at: string }
  | { type: "soonerListLeft" };

const BARRIERS: readonly FamilyAppointmentBarrier[] = [
  "ride",
  "sibling_care",
  "work_schedule",
  "none"
];
const SOONER_CONSTRAINTS: readonly FamilySoonerConstraint[] = [
  "weekday_mornings",
  "weekday_afternoons",
  "any_weekday",
  "needs_notice"
];

function exactIso(value: string): boolean {
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) && date.toISOString() === value;
}

function validActionTime(appointment: FamilyAppointment, at: string): boolean {
  return exactIso(at) && exactIso(appointment.createdAt) && at >= appointment.createdAt;
}

function validReferral(referral: FamilyReferral): boolean {
  return referral.clinic.trim().length > 0 && exactIso(referral.referredAt);
}

function validOfferSlotsForAction(appointment: FamilyAppointment): boolean {
  const createdAt = new Date(appointment.createdAt).valueOf();
  return (
    exactIso(appointment.createdAt) &&
    appointment.offeredSlots.length > 0 &&
    new Set(appointment.offeredSlots).size === appointment.offeredSlots.length &&
    appointment.offeredSlots.every(
      (slot) => exactIso(slot) && new Date(slot).valueOf() > createdAt
    )
  );
}

function validOffer(appointment: FamilyAppointment): boolean {
  const createdAt = new Date(appointment.createdAt).valueOf();
  return (
    appointment.id.trim().length > 0 &&
    appointment.clinic.trim().length > 0 &&
    exactIso(appointment.createdAt) &&
    appointment.status === "offered" &&
    appointment.scheduledFor === undefined &&
    !appointment.barriersAsked &&
    appointment.barriers.length === 0 &&
    appointment.reminderAcks.length === 0 &&
    appointment.offeredSlots.length > 0 &&
    new Set(appointment.offeredSlots).size === appointment.offeredSlots.length &&
    appointment.offeredSlots.every(
      (slot) => exactIso(slot) && new Date(slot).valueOf() > createdAt
    )
  );
}

function acceptsOffer(
  state: FamilyAppointmentWorkflowState,
  appointment: FamilyAppointment
): boolean {
  const latest = state.appointments.at(-1);
  if (appointment.supersedesId === undefined) {
    return latest === undefined || latest.status === "missed" || latest.status === "replaced";
  }
  return (
    state.soonerList !== null &&
    latest?.id === appointment.supersedesId &&
    (latest.status === "booked" || latest.status === "confirmed") &&
    latest.scheduledFor !== undefined
  );
}

function updateAppointment(
  state: FamilyAppointmentWorkflowState,
  appointmentId: string,
  update: (appointment: FamilyAppointment) => FamilyAppointment
): FamilyAppointmentWorkflowState {
  const index = state.appointments.findIndex(({ id }) => id === appointmentId);
  if (index < 0) return state;
  const current = state.appointments[index];
  const next = update(current);
  if (next === current) return state;
  const appointments = [...state.appointments];
  appointments[index] = next;
  return { ...state, appointments };
}

export function familyAppointmentWorkflowReducer(
  state: FamilyAppointmentWorkflowState,
  event: FamilyAppointmentWorkflowEvent
): FamilyAppointmentWorkflowState {
  switch (event.type) {
    case "referred":
      return state.referral === null && validReferral(event.referral)
        ? { ...state, referral: event.referral }
        : state;
    case "seeded":
      return state.referral === null &&
        validReferral(event.referral) &&
        event.appointment.clinic === event.referral.clinic &&
        validOffer(event.appointment)
        ? { referral: event.referral, appointments: [event.appointment], soonerList: null }
        : state;
    case "offered":
      return state.referral !== null &&
        event.appointment.clinic === state.referral.clinic &&
        validOffer(event.appointment) &&
        !state.appointments.some(({ id }) => id === event.appointment.id) &&
        acceptsOffer(state, event.appointment)
        ? { ...state, appointments: [...state.appointments, event.appointment] }
        : state;
    case "withdrawn": {
      const appointment = state.appointments.find(({ id }) => id === event.appointmentId);
      return appointment?.status === "offered" &&
        appointment.scheduledFor === undefined &&
        validActionTime(appointment, event.at)
        ? {
            ...state,
            appointments: state.appointments.filter(({ id }) => id !== event.appointmentId)
          }
        : state;
    }
    case "booked": {
      const booked = updateAppointment(state, event.appointmentId, (appointment) => {
        const slotTime = new Date(event.slot).valueOf();
        return appointment.status === "offered" &&
          appointment.scheduledFor === undefined &&
          appointment.reminderAcks.length === 0 &&
          validOfferSlotsForAction(appointment) &&
          validActionTime(appointment, event.at) &&
          appointment.offeredSlots.includes(event.slot) &&
          Number.isFinite(slotTime) &&
          slotTime > new Date(event.at).valueOf()
          ? { ...appointment, scheduledFor: event.slot, status: "booked" }
          : appointment;
      });
      const supersedesId = booked.appointments.find(({ id }) => id === event.appointmentId)
        ?.supersedesId;
      if (booked === state || supersedesId === undefined) return booked;
      return {
        ...booked,
        appointments: booked.appointments.map((appointment) =>
          appointment.id === supersedesId &&
          (appointment.status === "booked" || appointment.status === "confirmed")
            ? { ...appointment, status: "replaced" }
            : appointment
        )
      };
    }
    case "barriersRecorded": {
      const coherent =
        event.barriers.length > 0 &&
        new Set(event.barriers).size === event.barriers.length &&
        event.barriers.every((barrier) => BARRIERS.includes(barrier)) &&
        (!event.barriers.includes("none") || event.barriers.length === 1);
      if (!coherent) return state;
      return updateAppointment(state, event.appointmentId, (appointment) =>
        (appointment.status === "booked" || appointment.status === "confirmed") &&
        !appointment.barriersAsked &&
        appointment.scheduledFor !== undefined &&
        validActionTime(appointment, event.at)
          ? { ...appointment, barriers: [...event.barriers], barriersAsked: true }
          : appointment
      );
    }
    case "reminderAcknowledged":
      return updateAppointment(state, event.appointmentId, (appointment) =>
        validActionTime(appointment, event.at) &&
        dueFamilyReminder(appointment, new Date(event.at)) === event.offset
          ? {
              ...appointment,
              status: "confirmed",
              reminderAcks: [
                ...appointment.reminderAcks,
                { offset: event.offset, acknowledgedAt: event.at }
              ]
            }
          : appointment
      );
    case "rescheduleRequested":
      return updateAppointment(state, event.appointmentId, (appointment) =>
        (appointment.status === "booked" || appointment.status === "confirmed") &&
        appointment.scheduledFor !== undefined &&
        validActionTime(appointment, event.at)
          ? {
              ...appointment,
              offeredSlots: buildDemoSlotOffers(new Date(event.at)),
              status: "offered",
              scheduledFor: undefined,
              reminderAcks: [],
              supersedesId: undefined
            }
          : appointment
      );
    case "completed":
    case "missed":
      return updateAppointment(state, event.appointmentId, (appointment) =>
        validActionTime(appointment, event.at) && overdueFamilyAppointment(appointment, new Date(event.at))
          ? { ...appointment, status: event.type }
          : appointment
      );
    case "soonerListJoined": {
      const valid =
        state.referral !== null &&
        exactIso(event.at) &&
        event.constraints.length > 0 &&
        new Set(event.constraints).size === event.constraints.length &&
        event.constraints.every((constraint) => SOONER_CONSTRAINTS.includes(constraint));
      return valid
        ? { ...state, soonerList: { optedInAt: event.at, constraints: [...event.constraints] } }
        : state;
    }
    case "soonerListLeft":
      return state.soonerList === null ? state : { ...state, soonerList: null };
  }
}
