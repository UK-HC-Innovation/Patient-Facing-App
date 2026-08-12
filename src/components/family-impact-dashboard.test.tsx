import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import React from "react";
import {
  LADDER_IMPACT_DEMO_AS_OF,
  LADDER_IMPACT_DEMO_COHORT
} from "@/domain/family-impact-fixtures";
import { buildFamilyImpactSnapshot } from "@/domain/family-impact";
import { FamilyImpactDashboard } from "./family-impact-dashboard";

const AS_OF = new Date(LADDER_IMPACT_DEMO_AS_OF);

describe("FamilyImpactDashboard", () => {
  it("shows the agreed UKHCI measures with their exact denominators", () => {
    const snapshot = buildFamilyImpactSnapshot(LADDER_IMPACT_DEMO_COHORT, AS_OF);
    render(<FamilyImpactDashboard snapshot={snapshot} />);

    expect(screen.getByText("Demo only · synthetic · on-device")).toBeVisible();
    expect(screen.getByText(/No real family data, clinic feed, EHR, scheduler/)).toBeVisible();

    const engagement = screen.getByTestId("impact-engagement-card");
    expect(within(engagement).getByText("58%")).toBeVisible();
    expect(within(engagement).getByText("7 of 12 eligible synthetic families")).toBeVisible();
    expect(within(engagement).getByText(/8 dated journey touches/)).toBeVisible();

    const visits = screen.getByTestId("impact-visits-card");
    expect(within(visits).getByText("75%")).toBeVisible();
    expect(within(visits).getByText("6 completed of 8 outcomes")).toBeVisible();
    expect(within(visits).getByText(/2 of 8 outcomes were missed \(25% no-show\)/)).toBeVisible();

    const experience = screen.getByTestId("impact-experience-card");
    expect(within(experience).getByText("80%")).toBeVisible();
    expect(within(experience).getByText("8 of 10 scored pulses")).toBeVisible();
    expect(within(experience).getByText(/9 synthetic families contributed/)).toBeVisible();

    expect(screen.getByRole("img", { name: "58% engaged; demo target 50%" })).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: "6 completed and 2 missed out of 8 self-reported visit outcomes"
      })
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Distribution of 10 scored patient-experience pulses" })
    ).toBeVisible();
  });

  it("renders denominator-specific empty states instead of zero-percent claims", () => {
    const snapshot = buildFamilyImpactSnapshot([], AS_OF);
    render(<FamilyImpactDashboard snapshot={snapshot} />);

    expect(screen.getAllByText("Not enough data")).toHaveLength(3);
    expect(screen.getByText("0 eligible synthetic families")).toBeVisible();
    expect(screen.getByText("0 self-reported visit outcomes")).toBeVisible();
    expect(screen.getByText("0 scored pulses")).toBeVisible();
    expect(screen.getByText(/No eligible synthetic family records/)).toBeVisible();
    expect(screen.getByText(/No completed or missed visit outcomes/)).toBeVisible();
    expect(screen.getByText(/No scored experience pulses/)).toBeVisible();
    expect(screen.queryByText("0%", { exact: true })).not.toBeInTheDocument();
  });

  it("keeps the source limitation and pilot gates visible", () => {
    const snapshot = buildFamilyImpactSnapshot(LADDER_IMPACT_DEMO_COHORT, AS_OF);
    render(<FamilyImpactDashboard snapshot={snapshot} />);

    const note = screen.getByTestId("impact-source-note");
    expect(note).toHaveTextContent("do not establish real-world impact, causality, a baseline comparison, or statistical confidence");
    expect(note).toHaveTextContent("it sends nothing anywhere");
    expect(note).toHaveTextContent("secure tenant-isolated backend");
  });
});
