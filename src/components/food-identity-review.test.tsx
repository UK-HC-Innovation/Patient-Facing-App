import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FoodIdentityReview } from "./food-identity-review";

const row = { code: "92410310", description: "Soft drink, cola", group: "9000_Beverages" };

function renderReview(readName?: string | null) {
  render(
    <FoodIdentityReview
      candidate={{ food: row, readName, candidates: [] }}
      language="en"
      onConfirm={vi.fn()}
      onReject={vi.fn()}
    />
  );
}

describe("FoodIdentityReview", () => {
  // Table S5 has no Coca-Cola row, so before spec 30's display-name rule reached the camera
  // path a scanned Coke was confirmed as "Soft drink, cola" and the brand was simply gone.
  it("leads with the printed name and still names the row it scores against", () => {
    renderReview("Coca-Cola Classic");

    expect(screen.getByText(/I think this is Coca-Cola Classic/)).toBeTruthy();
    expect(screen.getByTestId("food-identity-scored-as").textContent).toBe("Scored as Soft drink, cola");
  });

  it("falls back to the row when the camera could not read a name", () => {
    renderReview(null);

    expect(screen.getByText(/I think this is Soft drink, cola/)).toBeTruthy();
    expect(screen.queryByTestId("food-identity-scored-as")).toBeNull();
  });
});
