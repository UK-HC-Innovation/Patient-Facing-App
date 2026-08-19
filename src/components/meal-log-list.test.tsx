import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import React from "react";
import { MealLogList } from "./meal-log-list";
import type { MealLogEntry } from "@/domain/types";

function entry(id: string, name: string): MealLogEntry {
  return {
    id,
    patientId: "patient-1",
    loggedAt: "2026-07-05T12:00:00.000Z",
    food: { id, barcode: null, name, brand: null, category: null, nutrition: null, source: "barcode_seed", ingredientText: null },
    flags: ["890 mg sodium — 59% of your 1500 mg daily limit"],
    assistantSummary: "High in sodium."
  };
}

describe("MealLogList", () => {
  it("shows an empty state when there are no meals", () => {
    render(<MealLogList entries={[]} language="en" />);
    expect(screen.getByText("No meals logged yet.")).toBeInTheDocument();
  });

  it("renders entries with their first flag and summary", () => {
    render(<MealLogList entries={[entry("1", "Soup")]} language="en" />);
    expect(screen.getByText("Soup")).toBeInTheDocument();
    expect(screen.getByText(/890 mg sodium/)).toBeInTheDocument();
    expect(screen.getByText("High in sodium.")).toBeInTheDocument();
  });
});
