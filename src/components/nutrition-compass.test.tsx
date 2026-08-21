import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CompassScore } from "@/domain/food-compass";
import {
  NutritionCompass,
  calorieDensityPlotPosition,
  nutritionQuadrant,
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
  it("shows a camera-first waiting state before a food is identified", () => {
    render(<NutritionCompass />);

    expect(screen.getByRole("region", { name: "Food Compass score vs calorie density" })).toBeInTheDocument();
    expect(screen.getByText("Point the camera at a food to place it on the chart.")).toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-compass-marker")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("plots nutrition score on X and calorie density on Y with four-quadrant guidance", () => {
    render(<NutritionCompass foodName="Banana, raw" score={bananaScore} />);

    const marker = screen.getByTestId("nutrition-compass-marker");
    expect(marker).toHaveAttribute("data-x-percent", "83");
    expect(marker).toHaveAttribute("data-y-percent", "9.9");
    expect(marker).toHaveAttribute("data-quadrant", "choose_often");
    expect(
      screen.getByText(/Banana, raw: 83 \/ 100 Food Compass score · 0.89 kcal\/g \(89 kcal \/ 100 g\) · Choose often quadrant/)
    ).toBeInTheDocument();
  });

  it("does not invent a Y position when calorie density is unavailable", () => {
    render(
      <NutritionCompass
        foodName="Published legacy food"
        score={{ ...bananaScore, calorieDensity: { kcalPer100g: null, band: "unknown" } }}
      />
    );

    expect(screen.queryByTestId("nutrition-compass-marker")).not.toBeInTheDocument();
    expect(screen.getByText("Calorie density unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Published legacy food: 83 \/ 100 Food Compass score · calorie density unavailable/)).toBeInTheDocument();
  });

  it("localizes chart chrome and the deterministic caption in Spanish", () => {
    render(<NutritionCompass foodName="Banana, raw" language="es" score={bananaScore} />);

    const chart = screen.getByRole("region", {
      name: "Puntaje Food Compass frente a densidad calórica"
    });
    expect(chart).toHaveTextContent("X: puntaje Food Compass · Y: densidad calórica (kcal/g)");
    expect(chart).toHaveTextContent("Elige con frecuencia");
    expect(chart).toHaveTextContent(
      "Banana, raw: puntaje Food Compass 83 de 100 · 0.89 kcal/g (89 kcal / 100 g) · cuadrante Elige con frecuencia."
    );
  });

  it("keeps markers inside the 0–9 kcal/g plot and classifies all four quadrants", () => {
    expect(calorieDensityPlotPosition(-10)).toBe(4);
    expect(calorieDensityPlotPosition(225)).toBe(25);
    expect(calorieDensityPlotPosition(900)).toBe(96);
    expect(calorieDensityPlotPosition(1_000)).toBe(96);
    expect(nutritionScorePlotPosition(-10)).toBe(4);
    expect(nutritionScorePlotPosition(100)).toBe(96);
    expect(nutritionQuadrant(69, 250)).toBe("limit");
    expect(nutritionQuadrant(70, 250)).toBe("moderate");
    expect(nutritionQuadrant(69, 249)).toBe("be_mindful");
    expect(nutritionQuadrant(70, 249)).toBe("choose_often");
  });
});
