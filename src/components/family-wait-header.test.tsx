import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { schoolAgeFamilyState } from "@/domain/family-fixtures";
import type { FamilyAppointment, FamilyInterview, FamilyNavigatorState } from "@/domain/types";
import { FamilyWaitHeader } from "./family-wait-header";

// The e2e suite freezes the clock here; the unit tests share the instant so the
// two stay readable side by side.
const NOW = new Date("2026-07-17T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(NOW.valueOf() - days * DAY_MS).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(NOW.valueOf() + days * DAY_MS).toISOString();
}

function familyState(overrides: Partial<FamilyNavigatorState> = {}): FamilyNavigatorState {
  return { ...schoolAgeFamilyState, ...overrides };
}

function interview(
  id: string,
  kind: FamilyInterview["kind"],
  createdAt = daysAgo(2)
): FamilyInterview {
  return {
    id,
    rawText: "She is pointing at pictures now.",
    source: "typed",
    createdAt,
    extraction: "mock",
    kind
  };
}

function appointment(overrides: Partial<FamilyAppointment> = {}): FamilyAppointment {
  return {
    id: "appointment-1",
    clinic: "UK Developmental Pediatrics",
    offeredSlots: [],
    status: "booked",
    barriers: [],
    barriersAsked: false,
    reminderAcks: [],
    createdAt: daysAgo(3),
    ...overrides
  };
}

describe("FamilyWaitHeader", () => {
  it("reports elapsed time on the list without predicting a date", () => {
    render(
      <FamilyWaitHeader
        family={familyState({
          referral: {
            clinic: "UK Developmental Pediatrics",
            referredAt: "2026-03-15T12:00:00.000Z"
          }
        })}
        language="en"
        now={NOW}
      />
    );

    expect(
      screen.getByText(/On the list at UK Developmental Pediatrics since March 2026/)
    ).toHaveTextContent(/about 4 months so far/);
    expect(screen.getByText(/We can't predict the exact date/)).toBeVisible();
  });

  it("drops the month count inside the first month on the list", () => {
    render(
      <FamilyWaitHeader
        family={familyState({
          referral: {
            clinic: "UK Developmental Pediatrics",
            referredAt: "2026-07-01T12:00:00.000Z"
          }
        })}
        language="en"
        now={NOW}
      />
    );

    expect(
      screen.getByText("On the list at UK Developmental Pediatrics since July 2026.")
    ).toBeVisible();
  });

  it("still renders without a referral", () => {
    render(<FamilyWaitHeader family={familyState()} language="en" now={NOW} />);

    expect(screen.getByRole("heading", { name: "Your Ladder" })).toBeVisible();
    expect(screen.queryByText(/On the list at/)).not.toBeInTheDocument();
  });

  it("points an unacknowledged safety event at the safety message", () => {
    render(
      <FamilyWaitHeader
        family={familyState({
          safetyEvents: [
            { id: "safety-1", tier: "crisis", domain: "self_harm", createdAt: daysAgo(1) }
          ]
        })}
        language="en"
        now={NOW}
      />
    );

    const rung = screen.getByTestId("family-next-rung");
    expect(rung).toHaveTextContent("Please look at the safety message above");
    expect(rung).toHaveAttribute("href", "#family-experience");
  });

  it("shows no rung and no chips when everything is fresh", () => {
    render(<FamilyWaitHeader family={familyState()} language="en" now={NOW} />);

    expect(screen.queryByTestId("family-next-rung")).not.toBeInTheDocument();
    expect(screen.queryByText(/notes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/steps in motion/)).not.toBeInTheDocument();
  });

  it("counts notes, steps in motion, a booked visit, and the earlier-visit list", () => {
    render(
      <FamilyWaitHeader
        family={familyState({
          interviews: [
            interview("i1", "orientation"),
            interview("i2", "note"),
            interview("i3", "checkin")
          ],
          steps: [
            {
              id: "s1",
              resourceId: "first-steps",
              domain: "early_intervention",
              status: "planned",
              plannedAt: daysAgo(3),
              updatedAt: daysAgo(3)
            },
            {
              id: "s2",
              resourceId: "michelle-p",
              domain: "waivers_financial",
              status: "tried",
              plannedAt: daysAgo(6),
              updatedAt: daysAgo(4)
            },
            {
              id: "s3",
              resourceId: "hdi",
              domain: "parent_support",
              status: "enrolled",
              plannedAt: daysAgo(9),
              updatedAt: daysAgo(8)
            },
            {
              id: "s4",
              resourceId: "kypso",
              domain: "school_iep",
              status: "not_for_us",
              plannedAt: daysAgo(9),
              updatedAt: daysAgo(8)
            }
          ],
          appointments: [appointment({ scheduledFor: daysFromNow(20) })],
          soonerList: { optedInAt: daysAgo(2), constraints: ["weekday_mornings"] }
        })}
        language="en"
        now={NOW}
      />
    );

    expect(screen.getByText("2 notes")).toBeVisible();
    expect(screen.getByText("2 steps in motion")).toBeVisible();
    expect(screen.getByText(/^Visit: /)).toBeVisible();
    expect(screen.getByText("On the earlier-visit list")).toBeVisible();
  });

  it("writes one note and one step in the singular", () => {
    render(
      <FamilyWaitHeader
        family={familyState({
          interviews: [interview("i1", "orientation"), interview("i2", "note")],
          steps: [
            {
              id: "s1",
              resourceId: "first_steps_statewide",
              domain: "early_intervention",
              status: "planned",
              plannedAt: daysAgo(3),
              updatedAt: daysAgo(3)
            },
            {
              id: "s2",
              resourceId: "ky_spin",
              domain: "parent_support",
              status: "enrolled",
              plannedAt: daysAgo(9),
              updatedAt: daysAgo(8)
            }
          ]
        })}
        language="en"
        now={NOW}
      />
    );

    expect(screen.getByText("1 note")).toBeVisible();
    expect(screen.getByText("1 step in motion")).toBeVisible();
    expect(screen.queryByText("1 notes")).not.toBeInTheDocument();
    expect(screen.queryByText("1 steps in motion")).not.toBeInTheDocument();
  });

  it("renders in Spanish", () => {
    render(
      <FamilyWaitHeader
        family={familyState({
          referral: {
            clinic: "UK Developmental Pediatrics",
            referredAt: "2026-03-15T12:00:00.000Z"
          },
          interviews: [interview("i1", "note", daysAgo(45))]
        })}
        language="es"
        now={NOW}
      />
    );

    expect(screen.getByRole("heading", { name: "Tu Ladder" })).toBeVisible();
    expect(screen.getByText(/En la lista de UK Developmental Pediatrics desde marzo/)).toBeVisible();
    expect(screen.getByText("1 nota")).toBeVisible();
    expect(screen.getByTestId("family-next-rung")).toHaveTextContent(
      "Chequeo mensual (unos 30 segundos)"
    );
  });
});
