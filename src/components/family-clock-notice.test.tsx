import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { FamilyClockNotice, familyClockLine } from "./family-clock-notice";

const DATED = {
  kind: "dated" as const,
  weeksLeft: 14,
  cutoff: new Date("2026-11-17T00:00:00.000Z")
};

const RANGE = {
  kind: "range" as const,
  earliest: new Date("2026-11-17T00:00:00.000Z"),
  latest: new Date("2027-11-16T00:00:00.000Z")
};

describe("familyClockLine", () => {
  it("counts weeks and names the date when the birth month is known", () => {
    expect(familyClockLine(DATED, "en", "Mateo")).toBe(
      "About 14 weeks left to start First Steps — referrals close November 17, 2026. After the cutoff, the school system takes over referrals."
    );
  });

  // P5. The audit's finding was "About 15 weeks left" printed from a birth
  // *year*; a caveat sentence underneath does not undo the number.
  it("names a window, and never a week count, when only the year is known", () => {
    const line = familyClockLine(RANGE, "en", "Mateo");
    expect(line).toBe(
      "We only know Mateo's birth year, so the cutoff lands between November 2026 and November 2027 — it depends on their birthday."
    );
    expect(line).not.toMatch(/weeks/);
  });

  it("stays true once the earliest possible cutoff has passed", () => {
    const line = familyClockLine({ ...RANGE, earliest: null }, "en", "Mateo");
    expect(line).toMatch(/may already have passed/);
    expect(line).toMatch(/November 2027/);
    expect(line).not.toMatch(/weeks/);
  });

  it("reads the cutoff in UTC, so the date does not slide with the reader's clock", () => {
    // A local-time render of this instant is November 16 west of Greenwich.
    expect(familyClockLine(DATED, "en", "Mateo")).toContain("November 17, 2026");
  });

  it("speaks Spanish", () => {
    expect(familyClockLine(RANGE, "es", "Mateo")).toMatch(
      /Solo sabemos el año de nacimiento de Mateo/
    );
  });
});

describe("FamilyClockNotice", () => {
  it("offers the one-tap repair only for a window, and only where it is wired up", () => {
    const { unmount } = render(
      <FamilyClockNotice clock={RANGE} language="en" childName="Mateo" onAddBirthMonth={vi.fn()} />
    );
    expect(screen.getByTestId("family-clock-add-birth-month")).toBeVisible();
    expect(screen.getByText("Month only — not the full birthday.")).toBeVisible();
    unmount();

    // A dated clock has nothing to repair.
    const dated = render(
      <FamilyClockNotice clock={DATED} language="en" childName="Mateo" onAddBirthMonth={vi.fn()} />
    );
    expect(screen.queryByTestId("family-clock-add-birth-month")).not.toBeInTheDocument();
    dated.unmount();

    // And a card that only reports the clock does not offer it either: the
    // repair belongs once per screen, not once per card.
    render(<FamilyClockNotice clock={RANGE} language="en" childName="Mateo" />);
    expect(screen.queryByTestId("family-clock-add-birth-month")).not.toBeInTheDocument();
  });

  it("takes a month and nothing more", async () => {
    const user = userEvent.setup();
    const onAddBirthMonth = vi.fn();
    render(
      <FamilyClockNotice
        clock={RANGE}
        language="en"
        childName="Mateo"
        onAddBirthMonth={onAddBirthMonth}
      />
    );

    await user.click(screen.getByTestId("family-clock-add-birth-month"));
    // Twelve choices, no day, no year: the picker cannot collect a birthday.
    const picker = screen.getByTestId("family-clock-month-picker");
    expect(picker.querySelectorAll("button")).toHaveLength(12);
    await user.click(screen.getByRole("button", { name: "March" }));

    expect(onAddBirthMonth).toHaveBeenCalledWith(3);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Saved. The cutoff date is named everywhere the clock appears."
    );
    expect(screen.queryByTestId("family-clock-add-birth-month")).not.toBeInTheDocument();
  });

  it("leads with the plain reason the deadline exists when it is the front door's own card", () => {
    render(
      <FamilyClockNotice clock={RANGE} language="en" childName="Mateo" withHeadline />
    );
    expect(
      screen.getByText("First Steps stops taking new referrals 45 days before Mateo turns 3.")
    ).toBeVisible();
  });
});
