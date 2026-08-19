import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CompassScore } from "@/domain/food-compass";
import {
  NutritionCompass,
  calorieDensityPlotPosition,
  nutritionScorePlotPosition
} from "./nutrition-compass";

const bananaScore: CompassScore = {
  fcs: 83,
  band: "encourage",
  tier: "T1",
  ambiguous: false,
  range: null,
  calorieDensity: { kcalPer100g: 89, band: "low" },
  domains: null,
  coverage: null
};

describe("NutritionCompass", () => {
  it("shows a readable action before a food is identified", async () => {
    const onRequestFood = vi.fn();
    render(<NutritionCompass onRequestFood={onRequestFood} requestLabel="Plot this order" />);

    expect(screen.getByRole("region", { name: "Nutrition compass" })).toBeInTheDocument();
    expect(screen.getByText("Point at a food or type one to place it on the compass.")).toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-compass-marker")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Plot this order" }));
    expect(onRequestFood).toHaveBeenCalledTimes(1);
  });

  it("plots calorie density on X and nutrition score on Y with a visible text equivalent", () => {
    render(<NutritionCompass foodName="Banana, raw" score={bananaScore} />);

    const marker = screen.getByTestId("nutrition-compass-marker");
    expect(marker).toHaveAttribute("data-x-percent", "33.1");
    expect(marker).toHaveAttribute("data-y-percent", "82.8");
    expect(
      screen.getByText(/Banana, raw: 83 \/ 100 nutrition score · Encourage · Low calorie density · 89 kcal \/ 100 g/)
    ).toBeInTheDocument();
  });

  it("does not invent an X position when calorie density is unavailable", () => {
    render(
      <NutritionCompass
        foodName="Published legacy food"
        score={{ ...bananaScore, calorieDensity: { kcalPer100g: null, band: "unknown" } }}
      />
    );

    expect(screen.queryByTestId("nutrition-compass-marker")).not.toBeInTheDocument();
    expect(screen.getByText("Calorie density unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Published legacy food: 83 \/ 100 nutrition score · calorie density unavailable/)).toBeInTheDocument();
  });

  it("keeps markers inside the plot while preserving density-band boundaries", () => {
    expect(calorieDensityPlotPosition(-10)).toBe(5);
    expect(calorieDensityPlotPosition(60)).toBe(25);
    expect(calorieDensityPlotPosition(150)).toBe(50);
    expect(calorieDensityPlotPosition(400)).toBe(75);
    expect(calorieDensityPlotPosition(1_000)).toBe(95);
    expect(nutritionScorePlotPosition(-10)).toBe(5);
    expect(nutritionScorePlotPosition(100)).toBe(95);
  });
});
