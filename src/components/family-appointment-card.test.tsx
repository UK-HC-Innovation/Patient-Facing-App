import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { createFamilyAppointmentOffer } from "@/domain/family-appointments";
import type { FamilyAppointment, FamilyNavigatorState } from "@/domain/types";
import { FamilyAppointmentCard } from "./family-appointment-card";

const DAY_MS = 24 * 60 * 60 * 1000;

function familyState(overrides: Partial<FamilyNavigatorState>): FamilyNavigatorState {
  return {
    profile: {
      birthYear: 2019,
      schoolStage: "elementary",
      county: "Scott",
      diagnoses: []
    },
    referral: { clinic: "UK Developmental Pediatrics", referredAt: new Date().toISOString() },
    appointments: [],
    safetyEvents: [],
    recommendations: null,
    interviewDraft: "",
    screenAnswers: [],
    interviews: [],
    facts: [],
    latestInterviewDomains: [],
    activeDomains: [],
    saved: [],
    alreadyEnrolled: [],
    steps: [],
    pulses: [],
    flags: [],
    soonerList: null,
    packetQuestionIds: [],
    checkinTouchedAt: null,
    ...overrides
  };
}

function handlers() {
  return {
    onSeedReferral: vi.fn(),
    onBook: vi.fn(),
    onBarriers: vi.fn(),
    onAckReminder: vi.fn(),
    onReschedule: vi.fn(),
    onComplete: vi.fn(),
    onMiss: vi.fn(),
    onRebook: vi.fn(),
    onCountdown: vi.fn()
  };
}

describe("FamilyAppointmentCard", () => {
  it("offers the demo seed before a referral exists", async () => {
    const callbacks = handlers();
    render(
      <FamilyAppointmentCard
        family={familyState({ referral: null })}
        language="en"
        locked={false}
        {...callbacks}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Show me (demo)" }));

    expect(callbacks.onSeedReferral).toHaveBeenCalledOnce();
  });

  it("books a slot from the offer turn", async () => {
    const offer = createFamilyAppointmentOffer(new Date());
    const callbacks = handlers();
    render(
      <FamilyAppointmentCard
        family={familyState({ appointments: [offer] })}
        language="en"
        locked={false}
        {...callbacks}
      />
    );

    const slotButtons = screen.getAllByRole("button");
    await userEvent.click(slotButtons[0]);

    expect(callbacks.onBook).toHaveBeenCalledWith(offer.id, offer.offeredSlots[0]);
  });

  it("progresses from barriers to reminder to overdue recovery one ask at a time", async () => {
    const callbacks = handlers();
    const offered = createFamilyAppointmentOffer(new Date());
    const booked: FamilyAppointment = {
      ...offered,
      status: "booked",
      scheduledFor: new Date(Date.now() + 0.5 * DAY_MS).toISOString()
    };
    const { rerender } = render(
      <FamilyAppointmentCard
        family={familyState({ appointments: [booked] })}
        language="en"
        locked={false}
        {...callbacks}
      />
    );

    expect(screen.getByText("Is there anything that could make it hard to get to this visit?")).toBeVisible();
    expect(screen.queryByTestId("family-appt-reminder")).not.toBeInTheDocument();
    expect(screen.queryByTestId("family-appt-overdue")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Demo: move the visit closer" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "We need a ride" }));
    expect(callbacks.onBarriers).toHaveBeenCalledWith(booked.id, ["ride"]);

    const barriersAnswered: FamilyAppointment = {
      ...booked,
      barriersAsked: true,
      barriers: ["ride"]
    };
    rerender(
      <FamilyAppointmentCard
        family={familyState({ appointments: [barriersAnswered] })}
        language="en"
        locked={false}
        {...callbacks}
      />
    );
    expect(screen.queryByText("Is there anything that could make it hard to get to this visit?")).not.toBeInTheDocument();
    expect(screen.getByTestId("family-appt-reminder")).toHaveTextContent("tomorrow");
    expect(screen.queryByTestId("family-appt-overdue")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Demo: move the visit closer" })).not.toBeInTheDocument();

    const overdue: FamilyAppointment = {
      ...barriersAnswered,
      scheduledFor: new Date(Date.now() - 0.5 * DAY_MS).toISOString()
    };
    rerender(
      <FamilyAppointmentCard
        family={familyState({ appointments: [overdue] })}
        language="en"
        locked={false}
        {...callbacks}
      />
    );
    expect(screen.queryByText("Is there anything that could make it hard to get to this visit?")).not.toBeInTheDocument();
    expect(screen.queryByTestId("family-appt-reminder")).not.toBeInTheDocument();
    expect(screen.getByTestId("family-appt-overdue")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Demo: move the visit closer" })).not.toBeInTheDocument();
  });

  it("locks the booked controls, disclosure, countdown buttons, and source link while safety is pending", async () => {
    const callbacks = handlers();
    const booked: FamilyAppointment = {
      ...createFamilyAppointmentOffer(new Date()),
      status: "booked",
      scheduledFor: new Date(Date.now() + 20 * DAY_MS).toISOString(),
      barriersAsked: true,
      barriers: ["none"]
    };
    const props = {
      family: familyState({ appointments: [booked] }),
      language: "en" as const,
      ...callbacks
    };
    const { rerender } = render(<FamilyAppointmentCard {...props} locked={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Demo: move the visit closer" }));
    expect(screen.getByRole("button", { name: "About 2 weeks away" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Learn more: CDC, \"Learn the Signs. Act Early.\"" })).toBeVisible();

    rerender(<FamilyAppointmentCard {...props} locked={true} />);

    expect(screen.getByRole("button", { name: "Demo: move the visit closer" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Learn more: CDC, \"Learn the Signs. Act Early.\"" })).not.toBeInTheDocument();
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("closes the demo disclosure across reminder confirmation and reschedule transitions", async () => {
    const callbacks = handlers();
    const offer = createFamilyAppointmentOffer(new Date());
    const booked: FamilyAppointment = {
      ...offer,
      status: "booked",
      scheduledFor: new Date(Date.now() + 20 * DAY_MS).toISOString(),
      barriersAsked: true,
      barriers: ["none"]
    };
    const props = {
      language: "en" as const,
      locked: false,
      ...callbacks
    };
    const { rerender } = render(
      <FamilyAppointmentCard family={familyState({ appointments: [booked] })} {...props} />
    );

    await userEvent.click(screen.getByRole("button", { name: "Demo: move the visit closer" }));
    await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
    expect(callbacks.onCountdown).toHaveBeenCalledWith(booked.id, 1);

    const reminder: FamilyAppointment = {
      ...booked,
      scheduledFor: new Date(Date.now() + 0.5 * DAY_MS).toISOString()
    };
    rerender(<FamilyAppointmentCard family={familyState({ appointments: [reminder] })} {...props} />);
    expect(screen.getByTestId("family-appt-reminder")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Demo: move the visit closer" })).not.toBeInTheDocument();

    const confirmed: FamilyAppointment = {
      ...reminder,
      status: "confirmed",
      reminderAcks: [{ offset: "t1", acknowledgedAt: new Date().toISOString() }]
    };
    rerender(<FamilyAppointmentCard family={familyState({ appointments: [confirmed] })} {...props} />);
    expect(screen.getByRole("button", { name: "Demo: move the visit closer" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.queryByRole("button", { name: "Date passed" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Demo: move the visit closer" }));
    const rescheduled: FamilyAppointment = {
      ...confirmed,
      status: "offered",
      scheduledFor: undefined,
      reminderAcks: [],
      offeredSlots: offer.offeredSlots.map((slot) =>
        new Date(new Date(slot).valueOf() + 40 * DAY_MS).toISOString()
      )
    };
    rerender(<FamilyAppointmentCard family={familyState({ appointments: [rescheduled] })} {...props} />);
    const rebooked: FamilyAppointment = {
      ...rescheduled,
      status: "booked",
      scheduledFor: rescheduled.offeredSlots[0]
    };
    rerender(<FamilyAppointmentCard family={familyState({ appointments: [rebooked] })} {...props} />);
    expect(screen.getByRole("button", { name: "Demo: move the visit closer" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("keeps the concept-demo badge visible and politely announces the active turn", () => {
    const offer = createFamilyAppointmentOffer(new Date());
    const props = {
      language: "en" as const,
      locked: false,
      ...handlers()
    };
    const { rerender } = render(
      <FamilyAppointmentCard family={familyState({ appointments: [offer] })} {...props} />
    );

    expect(screen.getByText("UKHCI Ladder · concept demo — not an official service")).toBeVisible();
    const liveTurn = screen.getByTestId("family-appt-live-turn");
    expect(liveTurn).toHaveAttribute("aria-live", "polite");
    expect(liveTurn).not.toHaveAttribute("role", "status");
    expect(liveTurn).toHaveTextContent("evaluation opening");

    const booked: FamilyAppointment = {
      ...offer,
      status: "booked",
      scheduledFor: offer.offeredSlots[0]
    };
    rerender(<FamilyAppointmentCard family={familyState({ appointments: [booked] })} {...props} />);
    expect(screen.getByTestId("family-appt-live-turn")).toHaveTextContent(
      "anything that could make it hard"
    );
    expect(screen.getByText("UKHCI Ladder · concept demo — not an official service")).toBeVisible();
  });

  it("renders the missed-recovery turn in Spanish", () => {
    const missed: FamilyAppointment = {
      ...createFamilyAppointmentOffer(new Date()),
      status: "missed"
    };
    render(
      <FamilyAppointmentCard
        family={familyState({ appointments: [missed] })}
        language="es"
        locked={false}
        {...handlers()}
      />
    );

    expect(
      screen.getByText("Así es la vida — en esta demo, no pierden su lugar. Busquemos una nueva fecha.")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Buscar nueva fecha" })).toBeVisible();
  });
});
