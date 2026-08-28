import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { FoodSavedPicks } from "./food-saved-picks";

describe("FoodSavedPicks", () => {
  it("renders favorites and recents and selects by bare code", async () => {
    const onSelect = vi.fn();
    render(
      <FoodSavedPicks
        favorites={[
          {
            foodId: "63107010",
            description: "Banana, raw",
            fcs: 83,
            band: "encourage",
            starredAt: "2026-08-21T12:00:00.000Z"
          }
        ]}
        recents={[{ foodId: "58106540", description: "Pizza with pepperoni", fcs: 23, band: "minimize" }]}
        language="en"
        onSelect={onSelect}
      />
    );

    expect(screen.getByText("Foods you've had before")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "See Banana, raw again" }));
    expect(onSelect).toHaveBeenCalledWith("63107010");
  });

  it("renders nothing without saved or recent foods", () => {
    const { container } = render(<FoodSavedPicks favorites={[]} recents={[]} language="es" onSelect={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
