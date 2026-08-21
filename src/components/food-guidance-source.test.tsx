import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoodGuidanceSource } from "./food-guidance-source";

describe("FoodGuidanceSource", () => {
  it("labels general guidance and states that health data is not used", () => {
    render(<FoodGuidanceSource kind="general" />);

    const source = screen.getByLabelText("Guidance source");
    expect(source).toHaveAttribute("data-guidance-scope", "general");
    expect(source).toHaveTextContent("Food Compass only");
    expect(source).toHaveTextContent("no recent readings or health profile used");
  });

  it("labels personalized guidance in Spanish", () => {
    render(<FoodGuidanceSource kind="personalized" language="es" />);

    const source = screen.getByLabelText("Fuente de la orientación");
    expect(source).toHaveAttribute("data-guidance-scope", "personalized");
    expect(source).toHaveTextContent("considera tus lecturas recientes");
  });
});
