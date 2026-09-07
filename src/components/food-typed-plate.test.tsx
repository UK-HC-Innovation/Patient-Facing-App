import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LiveMatch } from "@/hooks/use-live-food-score";
import type { TypedPlateItem } from "@/hooks/use-typed-food-score";
import { FoodTypedPlate } from "./food-typed-plate";

function match(description: string, fcs: number, band: "encourage" | "moderate" | "minimize"): LiveMatch {
  return {
    food: { code: description, description, group: "test" },
    score: {
      fcs,
      band,
      tier: "T1",
      ambiguous: false,
      range: null,
      calorieDensity: { kcalPer100g: 100, band: "low" },
      domains: null,
      coverage: null
    },
    alternatives: [],
    nutrients: null,
    candidates: []
  } as unknown as LiveMatch;
}

function item(query: string, description: string, fcs: number, band: "encourage" | "moderate" | "minimize"): TypedPlateItem {
  return { query, match: match(description, fcs, band) };
}

describe("FoodTypedPlate", () => {
  // Spec 30 R6, finding E04. Two of the highest-scoring rows in the table, and the plate
  // told someone to cut back on one of them because it was the lower number.
  it("prints no directive when nothing on the plate is in the minimize band", () => {
    render(
      <FoodTypedPlate
        items={[item("apple", "Apple, raw", 95, "encourage"), item("banana", "Banana, raw", 83, "encourage")]}
        language="en"
      />
    );

    expect(screen.getByText("Apple, raw")).toBeInTheDocument();
    expect(screen.getByText("Banana, raw")).toBeInTheDocument();
    expect(screen.queryByText(/Cut back on/)).not.toBeInTheDocument();
  });

  it("prints the directive when the lowest item is one to minimize", () => {
    render(
      <FoodTypedPlate
        items={[
          item("fried chicken", "Chicken, wing, fried", 50, "moderate"),
          item("sweet tea", "Tea, iced, pre-sweetened", 12, "minimize")
        ]}
        language="en"
      />
    );

    expect(screen.getByText("Cut back on Tea, iced, pre-sweetened first.")).toBeInTheDocument();
  });

  it("prints no directive while any item is still unresolved", () => {
    render(
      <FoodTypedPlate
        items={[
          item("sweet tea", "Tea, iced, pre-sweetened", 12, "minimize"),
          item("apple", "Apple, raw", 95, "encourage"),
          { query: "banana pudding", match: null }
        ]}
        language="en"
      />
    );

    expect(screen.queryByText(/Cut back on/)).not.toBeInTheDocument();
  });

  // A05: a plate of seven answered as a plate of five said so.
  it("names what it did not score", () => {
    render(
      <FoodTypedPlate
        dropped={["cake", "soda"]}
        items={[item("rice", "Rice, white", 40, "moderate"), item("beans", "Pinto beans", 95, "encourage")]}
        language="en"
      />
    );

    expect(screen.getByText("Not scored: cake, soda")).toBeInTheDocument();
    expect(screen.queryByText(/Cut back on/)).not.toBeInTheDocument();
  });

  // A14: one lookup that could not run is a retry, not a blank row and not a question.
  it("offers a retry for an item whose lookup could not run", async () => {
    const onRetry = vi.fn();
    render(
      <FoodTypedPlate
        items={[item("apple", "Apple, raw", 95, "encourage"), { query: "banana", match: null, failed: true }]}
        language="en"
        onRetry={onRetry}
      />
    );

    expect(screen.getByText("banana")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledWith("banana");
  });

  it("says No score for a food the table does not carry", () => {
    render(
      <FoodTypedPlate
        items={[item("apple", "Apple, raw", 95, "encourage"), { query: "bojangles combo", match: null }]}
        language="en"
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText("No score")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});
