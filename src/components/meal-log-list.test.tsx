import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
    render(<MealLogList entries={[]} language="en" onAmendTime={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("No meals logged yet.")).toBeInTheDocument();
  });

  it("renders entries with their first flag and summary", () => {
    render(<MealLogList entries={[entry("1", "Soup")]} language="en" onAmendTime={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("Soup")).toBeInTheDocument();
    expect(screen.getByText(/890 mg sodium/)).toBeInTheDocument();
    expect(screen.getByText("High in sodium.")).toBeInTheDocument();
  });

  it("rejects a custom meal time in the future", async () => {
    const user = userEvent.setup();
    const onAmendTime = vi.fn();
    render(
      <MealLogList entries={[entry("1", "Soup")]} language="en" onAmendTime={onAmendTime} onDelete={vi.fn()} />
    );

    await user.click(screen.getByRole("button", { name: "I ate this earlier" }));
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const localFuture = new Date(future.getTime() - future.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    fireEvent.change(screen.getByLabelText("Custom meal time"), { target: { value: localFuture } });
    await user.click(screen.getByRole("button", { name: "Save time" }));

    expect(screen.getByRole("alert")).toHaveTextContent("not in the future");
    expect(onAmendTime).not.toHaveBeenCalled();
  });

  it("requires a second tap before deleting", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<MealLogList entries={[entry("1", "Soup")]} language="en" onAmendTime={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
