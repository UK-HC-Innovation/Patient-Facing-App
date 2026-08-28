import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { GlucoseFoodInsight, GlucoseScoreInsight } from "@/domain/glucose-correlation";
import type { TimeInRange } from "@/domain/glucose-range";
import { GlucoseInsights } from "./glucose-insights";

const timeInRange: TimeInRange = {
  inRange: 9,
  below: 1,
  above: 2,
  total: 12,
  percentInRange: 75,
  windowDays: 14,
  low: 70,
  high: 180
};

const foodInsight: GlucoseFoodInsight = {
  higherCarbMeanMgDl: 205,
  otherMeanMgDl: 150,
  deltaMgDl: 55,
  higherCarbSamples: 3,
  otherSamples: 3,
  message:
    "We noticed your blood-sugar readings after higher-carb meals averaged about 55 mg/dL higher than after your other logged meals. This is an observation from your own logs, not a diagnosis — a good thing to mention to your care team."
};

const scoreInsight: GlucoseScoreInsight = {
  minimizeMeanMgDl: 210,
  otherMeanMgDl: 150,
  deltaMgDl: 60,
  minimizeSamples: 3,
  otherSamples: 3,
  message:
    "After meals with a low-scoring food, your blood sugar ran about 60 mg/dL higher than after your other meals. That's what your own logs show, not a diagnosis — worth mentioning to your care team."
};

describe("GlucoseInsights", () => {
  it("renders both cards and the food link when data is present", () => {
    render(<GlucoseInsights timeInRange={timeInRange} foodInsight={foodInsight} scoreInsight={scoreInsight} />);

    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText(/9 of your last 12 blood-sugar readings/)).toBeInTheDocument();
    expect(screen.getByText(/55 mg\/dL higher/)).toBeInTheDocument();
    expect(screen.getByText(/60 mg\/dL higher/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Check a meal" })).toHaveAttribute("href", "/food");
  });

  it("renders the range card without the pattern card when only range data exists", () => {
    render(<GlucoseInsights timeInRange={timeInRange} foodInsight={null} scoreInsight={null} />);

    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Check a meal" })).not.toBeInTheDocument();
  });

  it("renders nothing when both are null", () => {
    const { container } = render(<GlucoseInsights timeInRange={null} foodInsight={null} scoreInsight={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
