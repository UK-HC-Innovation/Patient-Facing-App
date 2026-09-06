import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import React from "react";
import { WeekInFoodCard } from "./week-in-food-card";

const summary = {
  meals: 4,
  scoredMeals: 3,
  avgFcs: 61,
  bandCounts: { encourage: 1, moderate: 1, minimize: 1 },
  best: { name: "Banana", fcs: 83 },
  worst: { name: "Soda", fcs: 18 }
};

describe("WeekInFoodCard", () => {
  it("shows the weekly score summary and links back to 1 good choice", () => {
    render(<WeekInFoodCard summary={summary} language="en" />);

    expect(screen.getByRole("heading", { name: "Week in Food" })).toBeInTheDocument();
    expect(screen.getByText("61")).toBeInTheDocument();
    expect(screen.getByText("Encourage: 1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open 1 good choice" })).toHaveAttribute("href", "/food");
  });

  it("renders Spanish copy", () => {
    render(<WeekInFoodCard summary={summary} language="es" />);
    expect(screen.getByRole("heading", { name: "Semana de Comidas" })).toBeInTheDocument();
  });
});
