import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CompassScore } from "@/domain/food-compass";
import { FoodNoMatch, FoodVerdict, FoodWhyScore } from "./food-lens-blocks";

const score: CompassScore = {
  fcs: 24,
  band: "minimize",
  tier: "T1",
  ambiguous: false,
  range: null,
  calorieDensity: { kcalPer100g: 266, band: "medium" },
  domains: null,
  coverage: null
};

describe("FoodVerdict", () => {
  it("says the band, the sentence and the number once each", () => {
    render(
      <FoodVerdict carveOutReason={null} foodName="Pizza with pepperoni" language="en" score={score} />
    );

    // The chip carries the published band, not the chart's quadrant name.
    expect(screen.getByText("Minimize")).toBeInTheDocument();
    expect(screen.getByText("A lot of calories for the nutrition you get.")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("of 100")).toBeInTheDocument();
    expect(screen.getByText("Pizza with pepperoni · 2.7 kcal/g")).toBeInTheDocument();
  });

  it("gives a carve-out the verdict's position and no number slot at all", () => {
    render(<FoodVerdict carveOutReason="zero_calorie" foodName="Water" language="en" score={null} />);

    // A dimmed dash would read as a bad score, so there is no figure and no scale.
    expect(screen.queryByText("of 100")).not.toBeInTheDocument();
    expect(screen.queryByText("Food Compass score")).not.toBeInTheDocument();
    expect(screen.getByText(/There is no number to show you here/)).toBeInTheDocument();
  });

  it("localizes the verdict sentence", () => {
    render(<FoodVerdict carveOutReason={null} foodName="Plátano" language="es" score={{ ...score, band: "encourage", fcs: 83 }} />);
    expect(screen.getByText("Una de las mejores opciones que puedes elegir.")).toBeInTheDocument();
  });
});

describe("FoodNoMatch", () => {
  it("offers at most three published categories instead of a dead end", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <FoodNoMatch
        candidates={[
          { code: "1", description: "Soup, chicken noodle", fcs: 40 },
          { code: "2", description: "Soup, tomato", fcs: 55 },
          { code: "3", description: "Soup, vegetable", fcs: 61 },
          { code: "4", description: "Soup, beef", fcs: 33 }
        ]}
        language="en"
        onSelect={onSelect}
      />
    );

    expect(screen.getByText(/No published score for that one/)).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Soup, tomato" }));
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("says only the honest sentence when the route named no categories", () => {
    render(<FoodNoMatch candidates={[]} language="en" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("FoodWhyScore", () => {
  const breakdown = {
    domains: [
      { key: "D1" as const, value: 4.2 },
      { key: "D2" as const, value: -1.5 }
    ],
    coverage: { included: ["D1" as const, "D2" as const], missing: ["D8" as const], partial: [] }
  };

  it("renders nothing until the chart marker opens it", () => {
    const { container } = render(
      <FoodWhyScore breakdown={breakdown} language="en" onClose={() => {}} open={false} tier="T1" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("takes focus to its heading so it never opens below the fold", () => {
    render(<FoodWhyScore breakdown={breakdown} language="en" onClose={() => {}} open tier="T1" />);
    const heading = screen.getByRole("heading", { name: "Why this score?" });
    expect(heading).toHaveFocus();
    expect(screen.getByText("+4.2")).toBeInTheDocument();
    expect(screen.getByText("-1.5")).toBeInTheDocument();
  });
});
