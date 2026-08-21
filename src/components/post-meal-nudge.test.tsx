import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import React from "react";
import { PostMealNudge, postMealNudgeKey } from "./post-meal-nudge";
import type { MealLogEntry } from "@/domain/types";

function plateEntry(id: string): MealLogEntry {
  return {
    id,
    mealId: "plate-1",
    patientId: "patient-1",
    loggedAt: "2026-07-05T13:00:00.000Z",
    food: {
      id: `food-${id}`,
      barcode: null,
      name: id,
      brand: null,
      category: null,
      nutrition: null,
      source: "fndds_lookup",
      ingredientText: null
    },
    flags: [],
    assistantSummary: ""
  };
}

describe("PostMealNudge", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("links to the glucose form with non-causal timing copy", () => {
    render(<PostMealNudge meal={plateEntry("Soup")} language="en" now={new Date("2026-07-05T15:00:00.000Z")} />);

    expect(screen.getByText(/About 2 hours since your Soup/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log a reading" })).toHaveAttribute("href", "/glucose#log-blood-sugar");
  });

  it("stores one dismissal for every sibling in a shared meal", async () => {
    const user = userEvent.setup();
    const first = plateEntry("Soup");
    const { rerender } = render(
      <PostMealNudge meal={first} language="en" now={new Date("2026-07-05T15:00:00.000Z")} />
    );

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(window.sessionStorage.getItem(postMealNudgeKey(first))).toBe("1");
    rerender(<PostMealNudge meal={plateEntry("Oats")} language="en" now={new Date("2026-07-05T15:00:00.000Z")} />);
    await waitFor(() => expect(screen.queryByText(/Oats/)).not.toBeInTheDocument());
  });
});
