import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoodGuidanceSource } from "./food-guidance-source";

describe("FoodGuidanceSource", () => {
  // The provenance sentence is the accessible name now: an aria-label on this <p> could be
  // announced instead of the sentence itself, so the copy has to be readable on its own.
  it("marks general guidance and states that health data is not used", () => {
    render(<FoodGuidanceSource kind="general" />);

    const source = screen.getByText(/General nutrition advice/);
    expect(source).toHaveAttribute("data-guidance-scope", "general");
    expect(source).toHaveTextContent("not based on your readings or health history");
  });

  it("marks personalized guidance in Spanish", () => {
    render(<FoodGuidanceSource kind="personalized" language="es" />);

    const source = screen.getByText(/tus lecturas recientes/);
    expect(source).toHaveAttribute("data-guidance-scope", "personalized");
    expect(source).toHaveTextContent("tu historial de salud");
  });
});
