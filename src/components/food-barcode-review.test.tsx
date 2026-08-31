import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BarcodeReviewController } from "@/hooks/use-barcode-review";
import type { IdentifiedFood } from "@/domain/types";
import { FoodBarcodeReview } from "./food-barcode-review";

const food: IdentifiedFood = {
  id: "barcode:123",
  barcode: "123",
  name: "Crunchy Edamame Ranch",
  brand: "The Only Bean",
  category: "Bean snacks",
  nutrition: null,
  source: "barcode_off",
  ingredientText: null
};

function controller(overrides: Partial<BarcodeReviewController> = {}): BarcodeReviewController {
  return {
    state: { active: true, status: "review", code: "123", food, resolvedFood: null },
    confirm: vi.fn(),
    reject: vi.fn(),
    retry: vi.fn(async () => undefined),
    cancel: vi.fn(),
    ...overrides
  };
}

describe("FoodBarcodeReview", () => {
  it("shows a candidate without a score and requires confirmation", () => {
    const value = controller();
    render(<FoodBarcodeReview controller={value} language="en" />);

    expect(screen.getByText(/Crunchy Edamame Ranch/)).toBeInTheDocument();
    expect(screen.queryByText(/Food Compass score/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use this product" }));
    expect(value.confirm).toHaveBeenCalledTimes(1);
  });

  it("offers retry and cancel for a miss without advertising cloud photo OCR", () => {
    const value = controller({
      state: { active: true, status: "miss", code: "000", food: null, resolvedFood: null }
    });
    render(<FoodBarcodeReview controller={value} language="en" />);

    expect(screen.getByText(/will not score it/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nutrition Facts instead/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(value.retry).toHaveBeenCalledTimes(1);
  });
});
