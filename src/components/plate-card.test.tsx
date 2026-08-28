import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { summarizePlate, type PlateItem } from "@/domain/plate";
import type { IdentifiedFood } from "@/domain/types";
import { PlateCard } from "./plate-card";

const food: IdentifiedFood = {
  id: "soup",
  barcode: null,
  name: "Soup",
  brand: null,
  category: null,
  nutrition: {
    servingSize: "1 cup",
    servingGrams: 200,
    basis: "per_serving",
    calories: 100,
    sodiumMg: 300,
    potassiumMg: null,
    totalSugarsG: 2,
    addedSugarsG: 0,
    saturatedFatG: 1,
    fiberG: 1,
    proteinG: 3,
    carbsG: 12,
    totalFatG: null,
    monoFatG: null,
    polyFatG: null,
    transFatG: null,
    cholesterolMg: null,
    calciumMg: null,
    ironMg: null
  },
  source: "vision_estimate",
  ingredientText: null
};

const items: PlateItem[] = [
  { id: "item-1", food, servings: 1, compassScore: { fcs: 24, band: "minimize", tier: "T1" } }
];

const twoItems: PlateItem[] = [
  ...items,
  {
    id: "item-2",
    food: { ...food, id: "toast", name: "Toast" },
    servings: 1,
    compassScore: { fcs: 60, band: "moderate", tier: "T1" }
  }
];

describe("PlateCard", () => {
  it("keeps a plate of one a published score rather than an average", () => {
    render(
      <PlateCard
        items={items}
        summary={summarizePlate(items)}
        flags={[]}
        language="en"
        onServingsChange={vi.fn()}
        onRemove={vi.fn()}
        onLog={vi.fn()}
      />
    );

    // Averaging language over a single published number under-claims a real value.
    expect(screen.queryByText(/average/i)).not.toBeInTheDocument();
    expect(screen.getByText("Food Compass 24")).toBeInTheDocument();
  });

  it("labels the display derivation only as plate average and exposes item controls", async () => {
    const user = userEvent.setup();
    const onServingsChange = vi.fn();
    const onRemove = vi.fn();
    const onLog = vi.fn();
    render(
      <PlateCard
        items={twoItems}
        summary={summarizePlate(twoItems)}
        flags={[]}
        language="en"
        onServingsChange={onServingsChange}
        onRemove={onRemove}
        onLog={onLog}
      />
    );

    expect(screen.getByText("Plate average · 2 items")).toBeInTheDocument();
    // The note is what keeps the derivation legible: it says how the number was computed.
    expect(screen.getByText("Average of the items below, weighted by calories.")).toBeInTheDocument();
    expect(screen.getByText("Food Compass 24")).toBeInTheDocument();
    expect(screen.getByText("Some items don't have nutrition info.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Increase servings for Soup" }));
    await user.click(screen.getByRole("button", { name: "Remove Soup" }));
    await user.click(screen.getByRole("button", { name: "Log plate" }));
    expect(onServingsChange).toHaveBeenCalledWith(0, 2);
    expect(onRemove).toHaveBeenCalledWith(0);
    expect(onLog).toHaveBeenCalledTimes(1);
  });
});
