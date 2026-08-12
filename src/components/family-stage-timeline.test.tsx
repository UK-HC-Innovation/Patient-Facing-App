import { render as rtlRender, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { schoolAgeFamilyState } from "@/domain/family-fixtures";
import { openAllFamilyFolds } from "@/test/family-folds";
import { FamilyStageTimeline } from "./family-stage-timeline";

// The timeline is a folded reference section; these tests are about what is
// inside it, so every render opens it first.
function render(ui: React.ReactElement): ReturnType<typeof rtlRender> {
  const result = rtlRender(ui);
  openAllFamilyFolds();
  return result;
}

describe("FamilyStageTimeline", () => {
  it("surfaces diagnosis stages by due month and backdates diagnosis data through an explicit demo control", async () => {
    const user = userEvent.setup();
    const onBackdateDiagnoses = vi.fn();
    const now = new Date("2026-07-17T12:00:00.000Z");
    render(
      <FamilyStageTimeline
        family={schoolAgeFamilyState}
        language="en"
        now={now}
        simulationEnabled
        onBackdateDiagnoses={onBackdateDiagnoses}
      />
    );

    const current = screen.getByRole("region", { name: "Now" });
    const next = screen.getByRole("region", { name: "Next" });
    expect(within(current).getByRole("heading", { name: "Talk to another parent" })).toBeVisible();
    expect(within(next).getByRole("heading", { name: "Look into help for siblings and a break for you" })).toBeVisible();

    const disclosure = screen.getByRole("button", { name: "Demo timeline control" });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "Demo timeline control" })).not.toBeInTheDocument();
    await user.click(disclosure);

    const control = screen.getByRole("group", { name: "Demo timeline control" });
    expect(within(control).getByText(/does not change the clock on your device/i)).toBeVisible();
    await user.click(within(control).getByRole("button", { name: "Set diagnosis dates to 6 months ago" }));

    expect(onBackdateDiagnoses).toHaveBeenCalledWith(6, now);
  });

  it("does not show diagnosis backdating controls without a diagnosis", () => {
    render(
      <FamilyStageTimeline
        family={{
          ...schoolAgeFamilyState,
          profile: { ...schoolAgeFamilyState.profile!, diagnoses: [] }
        }}
        language="en"
        now={new Date("2026-07-17T12:00:00.000Z")}
        simulationEnabled
        onBackdateDiagnoses={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Demo timeline control" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Demo timeline control" })).not.toBeInTheDocument();
  });

  it("distinguishes a missing profile from a valid profile with no matching stages", () => {
    const { rerender } = render(
      <FamilyStageTimeline
        family={{ ...schoolAgeFamilyState, profile: null }}
        language="en"
        now={new Date("2026-07-17T12:00:00Z")}
      />
    );

    expect(screen.getByText("Add your county and your child's birth year to see what comes next.")).toBeVisible();

    rerender(
      <FamilyStageTimeline
        family={{
          ...schoolAgeFamilyState,
          profile: {
            ...schoolAgeFamilyState.profile!,
            birthMonth: 1,
            diagnoses: [],
            schoolStage: "elementary"
          }
        }}
        language="en"
        now={new Date("2026-07-17T12:00:00Z")}
      />
    );

    expect(screen.queryByText("Add your county and your child's birth year to see what comes next.")).not.toBeInTheDocument();
    expect(screen.getByText("Nothing to plan for right now based on what you have told us.")).toBeVisible();
  });

  it("links perinatal stages to the caregiver check-in while existing stages stay non-links", () => {
    render(
      <FamilyStageTimeline
        family={{
          ...schoolAgeFamilyState,
          profile: {
            childFirstName: "Baby",
            birthYear: 2026,
            birthMonth: 7,
            schoolStage: "not_school_age",
            county: "Scott",
            diagnoses: []
          }
        }}
        language="en"
        now={new Date("2026-07-20T12:00:00.000Z")}
        nudgeFirstName="Jordan"
      />
    );

    expect(screen.getByRole("link", { name: "Start your 1-month check-in" })).toHaveAttribute(
      "href",
      "/checkin/perinatal"
    );
    expect(screen.getByRole("heading", { name: "Contact First Steps now" }).closest("a")).toBeNull();
  });

  it("does not infer perinatal stages from a birth year alone", () => {
    render(
      <FamilyStageTimeline
        family={{
          ...schoolAgeFamilyState,
          profile: {
            birthYear: 2026,
            schoolStage: "not_school_age",
            county: "Scott",
            diagnoses: []
          }
        }}
        language="en"
        now={new Date("2026-07-20T12:00:00.000Z")}
        nudgeFirstName="Jordan"
      />
    );

    expect(screen.queryByRole("link", { name: /check-in/i })).not.toBeInTheDocument();
  });
});
