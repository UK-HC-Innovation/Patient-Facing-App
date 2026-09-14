import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoState } from "@/domain/fixtures";
import { SWYC_18MO_INSTRUMENT } from "@/domain/instruments/swyc-milestones-18mo";
import { SWYC_30MO_INSTRUMENT } from "@/domain/instruments/swyc-milestones-30mo";
import { getInstrument } from "@/domain/instruments/registry";
import { SWYC_POSI_INSTRUMENT } from "@/domain/instruments/swyc-posi";
import type { FamilyProfile } from "@/domain/types";
import { SwycCheckin } from "./swyc-checkin";

const { dispatch } = vi.hoisted(() => ({ dispatch: vi.fn() }));

vi.mock("@/state/store", () => ({
  useHealthState: () => ({ state: demoState, dispatch })
}));

const profile: FamilyProfile = {
  childFirstName: "Avery",
  birthYear: 2025,
  birthMonth: 1,
  schoolStage: "not_school_age",
  county: "Fayette",
  diagnoses: []
};

async function completeMilestones(user: ReturnType<typeof userEvent.setup>, answer: "Not Yet" | "Very Much") {
  await user.click(screen.getByRole("button", { name: /start/i }));
  for (const option of screen.getAllByRole("radio", { name: answer })) {
    await user.click(option);
  }
  await user.click(screen.getByRole("button", { name: "Submit" }));
}

async function completeLowerRiskPosi(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /start/i }));
  await user.click(screen.getByRole("radio", { name: "Many times a day" }));
  for (const option of screen.getAllByRole("radio", { name: "Always" })) {
    await user.click(option);
  }
  await user.click(screen.getByRole("button", { name: "Submit" }));
}

describe("SwycCheckin", () => {
  beforeEach(() => dispatch.mockReset());

  it.each([
    { label: "SWYC 18-month Milestones", instrument: SWYC_18MO_INSTRUMENT, childAgeMonths: 18 },
    { label: "SWYC 30-month Milestones", instrument: SWYC_30MO_INSTRUMENT, childAgeMonths: 30 }
  ])("records $label before the single shared POSI registry object after explicit continuation", async ({ instrument, childAgeMonths }) => {
    const user = userEvent.setup({ delay: null });
    expect(getInstrument("swyc_posi")).toBe(SWYC_POSI_INSTRUMENT);
    render(
      <SwycCheckin
        childAgeMonths={childAgeMonths}
        language="en"
        milestoneInstrument={instrument}
        profile={profile}
      />
    );

    await completeMilestones(user, "Not Yet");
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      type: "addAssessmentEvent",
      event: { instrumentId: instrument.id }
    });
    expect(screen.getByRole("button", { name: "Continue to POSI" })).toBeVisible();
    expect(screen.queryByText("Does your child bring things to you to show them to you?")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue to POSI" }));
    await completeLowerRiskPosi(user);
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(2));
    expect(dispatch.mock.calls.map(([action]) => action.event?.instrumentId)).toEqual([instrument.id, "swyc_posi"]);
    expect(screen.getByRole("heading", { name: /First Steps.*Bluegrass/i })).toBeVisible();
  });

  it("shows no First Steps action when both Milestones and POSI are lower risk", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <SwycCheckin childAgeMonths={18} language="en" milestoneInstrument={SWYC_18MO_INSTRUMENT} profile={profile} />
    );
    await completeMilestones(user, "Very Much");
    await user.click(screen.getByRole("button", { name: "Continue to POSI" }));
    await completeLowerRiskPosi(user);

    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("heading", { name: /First Steps.*Point of Entry/i })).not.toBeInTheDocument();
  });

  it("shows First Steps when POSI is discuss even with lower-risk Milestones", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <SwycCheckin childAgeMonths={18} language="en" milestoneInstrument={SWYC_18MO_INSTRUMENT} profile={profile} />
    );
    await completeMilestones(user, "Very Much");
    await user.click(screen.getByRole("button", { name: "Continue to POSI" }));
    await user.click(screen.getByRole("button", { name: /start/i }));
    await user.click(screen.getByRole("radio", { name: "A few times a week" }));
    const sometimes = screen.getAllByRole("radio", { name: "Sometimes" });
    await user.click(sometimes[0]);
    await user.click(sometimes[1]);
    const always = screen.getAllByRole("radio", { name: "Always" });
    await user.click(always[2]);
    await user.click(always[3]);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("heading", { name: /First Steps.*Bluegrass/i })).toBeVisible();
  });
});
