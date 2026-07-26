import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import {
  createFamilyAppointmentOffer,
  createSoonerAppointmentOffer,
  formatFamilySlot
} from "@/domain/family-appointments";
import type { FamilyAppointment, FamilyNavigatorState, FamilySoonerList } from "@/domain/types";
import { FamilyAppointmentCard } from "./family-appointment-card";

const DAY_MS = 24 * 60 * 60 * 1000;

const ON_LIST: FamilySoonerList = {
  optedInAt: new Date().toISOString(),
  constraints: ["weekday_mornings"]
};

function quietBooking(overrides: Partial<FamilyAppointment> = {}): FamilyAppointment {
  return {
    ...createFamilyAppointmentOffer(new Date()),
    status: "booked",
    scheduledFor: new Date(Date.now() + 20 * DAY_MS).toISOString(),
    barriersAsked: true,
    barriers: ["none"],
    ...overrides
  };
}

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
    onCountdown: vi.fn(),
    onJoinSoonerList: vi.fn(),
    onLeaveSoonerList: vi.fn(),
    onSoonerOffer: vi.fn(),
    onDeclineSoonerOffer: vi.fn()
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

  it("opts into the earlier-visit list with exactly the constraints picked", async () => {
    const callbacks = handlers();
    render(
      <FamilyAppointmentCard
        family={familyState({ appointments: [quietBooking()] })}
        language="en"
        locked={false}
        {...callbacks}
      />
    );

    expect(screen.getByTestId("family-sooner-turn")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Yes, put us on the list" }));

    const confirm = screen.getByRole("button", { name: "Add us" });
    expect(confirm).toBeDisabled();
    const mornings = screen.getByRole("button", { name: "Weekday mornings" });
    expect(mornings).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(mornings);
    await userEvent.click(screen.getByRole("button", { name: "We need 2+ days' notice" }));
    await userEvent.click(screen.getByRole("button", { name: "Any weekday" }));
    await userEvent.click(screen.getByRole("button", { name: "Any weekday" }));

    expect(mornings).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Any weekday" })).toHaveAttribute("aria-pressed", "false");
    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);
    expect(callbacks.onJoinSoonerList).toHaveBeenCalledWith(["weekday_mornings", "needs_notice"]);
  });

  it("stops asking for this visit after 'No thanks' without storing a refusal", async () => {
    const callbacks = handlers();
    render(
      <FamilyAppointmentCard
        family={familyState({ appointments: [quietBooking()] })}
        language="en"
        locked={false}
        {...callbacks}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "No thanks" }));

    expect(screen.queryByTestId("family-sooner-turn")).not.toBeInTheDocument();
    expect(callbacks.onJoinSoonerList).not.toHaveBeenCalled();
    expect(callbacks.onLeaveSoonerList).not.toHaveBeenCalled();
  });

  it("keeps the earlier-visit ask out of every state that already has a question open", () => {
    const props = { language: "en" as const, ...handlers() };
    const booking = quietBooking();
    const { rerender } = render(
      <FamilyAppointmentCard family={familyState({ appointments: [booking] })} locked={false} {...props} />
    );
    expect(screen.getByTestId("family-sooner-turn")).toBeVisible();

    rerender(
      <FamilyAppointmentCard family={familyState({ appointments: [booking] })} locked={true} {...props} />
    );
    expect(screen.queryByTestId("family-sooner-turn")).not.toBeInTheDocument();

    const unanswered = { ...booking, barriersAsked: false, barriers: [] };
    rerender(
      <FamilyAppointmentCard family={familyState({ appointments: [unanswered] })} locked={false} {...props} />
    );
    expect(screen.queryByTestId("family-sooner-turn")).not.toBeInTheDocument();

    const reminderDue = { ...booking, scheduledFor: new Date(Date.now() + 0.5 * DAY_MS).toISOString() };
    rerender(
      <FamilyAppointmentCard family={familyState({ appointments: [reminderDue] })} locked={false} {...props} />
    );
    expect(screen.getByTestId("family-appt-reminder")).toBeVisible();
    expect(screen.queryByTestId("family-sooner-turn")).not.toBeInTheDocument();

    const past = { ...booking, scheduledFor: new Date(Date.now() - 0.5 * DAY_MS).toISOString() };
    rerender(
      <FamilyAppointmentCard family={familyState({ appointments: [past] })} locked={false} {...props} />
    );
    expect(screen.getByTestId("family-appt-overdue")).toBeVisible();
    expect(screen.queryByTestId("family-sooner-turn")).not.toBeInTheDocument();
  });

  it("swaps the ask for a one-tap leave line and unlocks the demo backfill once listed", async () => {
    const callbacks = handlers();
    render(
      <FamilyAppointmentCard
        family={familyState({ appointments: [quietBooking()], soonerList: ON_LIST })}
        language="en"
        locked={false}
        {...callbacks}
      />
    );

    expect(screen.queryByTestId("family-sooner-turn")).not.toBeInTheDocument();
    expect(screen.getByText("On the earlier-visit list — you can leave any time.")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Demo: move the visit closer" }));
    const demoCta = screen.getByRole("button", { name: "An earlier opening appeared (demo)" });
    expect(demoCta).toBeEnabled();
    await userEvent.click(demoCta);
    expect(callbacks.onSoonerOffer).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: "Leave the list" }));
    expect(callbacks.onLeaveSoonerList).toHaveBeenCalledOnce();
  });

  it("keeps the demo backfill disabled until the family is on the list", async () => {
    render(
      <FamilyAppointmentCard
        family={familyState({ appointments: [quietBooking()] })}
        language="en"
        locked={false}
        {...handlers()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Demo: move the visit closer" }));
    expect(screen.getByRole("button", { name: "An earlier opening appeared (demo)" })).toBeDisabled();
  });

  it("offers the single earlier slot and lets the family keep the time they have", async () => {
    const callbacks = handlers();
    const booking = quietBooking();
    const sooner = createSoonerAppointmentOffer(new Date(), ["weekday_mornings"], booking.id);
    render(
      <FamilyAppointmentCard
        family={familyState({ appointments: [booking, sooner], soonerList: ON_LIST })}
        language="en"
        locked={false}
        {...callbacks}
      />
    );

    const slotLabel = formatFamilySlot(sooner.offeredSlots[0], "en");
    await userEvent.click(screen.getByRole("button", { name: slotLabel }));
    expect(callbacks.onBook).toHaveBeenCalledWith(sooner.id, sooner.offeredSlots[0]);

    await userEvent.click(screen.getByRole("button", { name: "Keep our current time" }));
    expect(callbacks.onDeclineSoonerOffer).toHaveBeenCalledWith(sooner.id);
    expect(callbacks.onMiss).not.toHaveBeenCalled();
    expect(callbacks.onReschedule).not.toHaveBeenCalled();
  });

  it("hides the keep-our-time control on a first offer that replaces nothing", () => {
    const { rerender } = render(
      <FamilyAppointmentCard
        family={familyState({ appointments: [createFamilyAppointmentOffer(new Date())] })}
        language="en"
        locked={false}
        {...handlers()}
      />
    );

    expect(screen.queryByRole("button", { name: "Keep our current time" })).not.toBeInTheDocument();

    // Sitting behind a live booking is not what makes an offer an earlier one —
    // only the offer naming the booking it would replace does.
    rerender(
      <FamilyAppointmentCard
        family={familyState({
          appointments: [quietBooking(), createFamilyAppointmentOffer(new Date())],
          soonerList: ON_LIST
        })}
        language="en"
        locked={false}
        {...handlers()}
      />
    );

    expect(screen.queryByRole("button", { name: "Keep our current time" })).not.toBeInTheDocument();
  });

  it("hands the demo backfill the booking it would replace", async () => {
    const callbacks = handlers();
    const booking = quietBooking();
    render(
      <FamilyAppointmentCard
        family={familyState({ appointments: [booking], soonerList: ON_LIST })}
        language="en"
        locked={false}
        {...callbacks}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Demo: move the visit closer" }));
    await userEvent.click(screen.getByRole("button", { name: "An earlier opening appeared (demo)" }));

    expect(callbacks.onSoonerOffer).toHaveBeenCalledWith(booking.id);
  });

  // Rescheduling an accepted backfill puts it back in the offer turn. The visit it
  // replaced is retired by then, so there is no current time to hand back — offering
  // one would be reading a slot the clinic already took.
  it("never offers a retired visit back when the earlier one is rescheduled", () => {
    const replaced = quietBooking({ id: "prior-booking", status: "replaced" });
    const rescheduled: FamilyAppointment = {
      ...createFamilyAppointmentOffer(new Date()),
      supersedesId: replaced.id
    };
    render(
      <FamilyAppointmentCard
        family={familyState({ appointments: [replaced, rescheduled], soonerList: ON_LIST })}
        language="en"
        locked={false}
        {...handlers()}
      />
    );

    expect(screen.queryByRole("button", { name: "Keep our current time" })).not.toBeInTheDocument();
    expect(
      screen.queryByText(formatFamilySlot(replaced.scheduledFor!, "en"), { exact: false })
    ).not.toBeInTheDocument();
  });

  it("asks for a new date if a retired visit is all that is left", () => {
    render(
      <FamilyAppointmentCard
        family={familyState({ appointments: [quietBooking({ status: "replaced" })] })}
        language="en"
        locked={false}
        {...handlers()}
      />
    );

    expect(screen.getByRole("button", { name: "Find a new time" })).toBeVisible();
    expect(screen.queryByTestId("family-appt-reminder")).not.toBeInTheDocument();
    expect(screen.getByTestId("family-appt-live-turn")).toHaveTextContent("Find a new time");
  });

  it("renders the earlier-visit turn in Spanish with reachable tap targets", async () => {
    render(
      <FamilyAppointmentCard
        family={familyState({ appointments: [quietBooking()] })}
        language="es"
        locked={false}
        {...handlers()}
      />
    );

    expect(
      screen.getByText(
        "A veces hay cancelaciones. Si se abriera un horario más temprano, ¿podrían tomarlo con poco aviso?"
      )
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Sí, anótanos en la lista" }));
    for (const label of [
      "Mañanas entre semana",
      "Tardes entre semana",
      "Cualquier día entre semana",
      "Necesitamos 2+ días de aviso",
      "Anótanos"
    ]) {
      const control = screen.getByRole("button", { name: label });
      expect(control.className).toContain("min-h-12");
      expect(control.className).toContain("focus-visible:outline-care");
    }
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
