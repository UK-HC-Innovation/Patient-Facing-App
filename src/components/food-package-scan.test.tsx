import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PackageNutritionDraft } from "@/domain/package-scan";
import type { IdentifiedFood } from "@/domain/types";
import {
  initialPackageScanState,
  type PackageScanController,
  type PackageScanState
} from "@/hooks/use-package-scan";
import { FoodPackageScan } from "./food-package-scan";

const nutrition: PackageNutritionDraft = {
  servingSize: "1 oz (28 g)",
  servingGrams: 28,
  servingsPerContainer: "4",
  selectedColumnHeading: "Amount per serving",
  nutrition: {
    servingSize: "1 oz (28 g)", servingGrams: 28, basis: "per_serving", calories: 130,
    sodiumMg: 180, potassiumMg: null, totalSugarsG: 2, addedSugarsG: 0,
    saturatedFatG: 1, fiberG: 5, proteinG: 13, carbsG: 11, totalFatG: 5,
    monoFatG: null, polyFatG: null, transFatG: 0, cholesterolMg: 0, calciumMg: null, ironMg: null
  },
  rows: [{
    field: "calories", printedLabel: "Calories", printedAmount: "130", printedUnit: null,
    value: 130, normalizedUnit: "kcal", precision: "exact"
  }],
  unusableRows: [],
  omittedFields: ["potassium"],
  ingredientText: "soybeans, sunflower oil",
  warnings: [],
  includedDomains: ["D1", "D3", "D8"],
  carveOut: null,
  confidence: 0.95
};

const barcodeFood: IdentifiedFood = {
  id: "barcode:123",
  barcode: "123",
  name: "Crunchy Edamame Ranch",
  brand: "The Only Bean",
  category: "Bean snacks",
  nutrition: nutrition.nutrition,
  source: "barcode_off",
  ingredientText: nutrition.ingredientText
};

function controller(state: PackageScanState): PackageScanController {
  return {
    state,
    begin: vi.fn(),
    authorize: vi.fn(async () => undefined),
    scanFront: vi.fn(async () => undefined),
    confirmIdentity: vi.fn(),
    scanNutrition: vi.fn(async () => undefined),
    confirmNutrition: vi.fn(),
    onBarcodeDetected: vi.fn(async () => undefined),
    confirmBarcode: vi.fn(),
    rejectBarcode: vi.fn(),
    cancel: vi.fn()
  };
}

describe("FoodPackageScan", () => {
  it("keeps the cloud action behind an explicit tap and disclosure", () => {
    const inactive = controller(initialPackageScanState);
    const { rerender } = render(<FoodPackageScan cloudEnabled controller={inactive} language="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Scan a package" }));
    expect(inactive.begin).toHaveBeenCalledTimes(1);

    const disclosure = controller({
      ...initialPackageScanState,
      active: true,
      epoch: 1,
      session: { status: "disclosure" }
    });
    rerender(<FoodPackageScan cloudEnabled controller={disclosure} language="en" />);
    expect(screen.getByText(/sent to OpenAI/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(disclosure.authorize).toHaveBeenCalledTimes(1);
  });

  it("requires confirmation before a barcode product is used", () => {
    const barcode = controller({
      ...initialPackageScanState,
      active: true,
      epoch: 1,
      barcode: { status: "review", code: "123", food: barcodeFood }
    });
    render(<FoodPackageScan cloudEnabled={false} controller={barcode} language="en" />);
    expect(screen.getByText(/Barcode found/i)).toHaveTextContent("Crunchy Edamame Ranch");
    fireEvent.click(screen.getByRole("button", { name: "Use this product" }));
    expect(barcode.confirmBarcode).toHaveBeenCalledTimes(1);
  });

  it("shows every extracted label row before accepting nutrition", () => {
    const review = controller({
      ...initialPackageScanState,
      active: true,
      epoch: 1,
      session: { status: "ready", expiresAt: Date.now() + 60_000 },
      nutrition: { status: "review", draft: nutrition }
    });
    render(<FoodPackageScan cloudEnabled controller={review} language="en" />);
    expect(screen.getByTestId("package-nutrition-readback")).toHaveTextContent("Calories");
    expect(screen.getByTestId("package-nutrition-readback")).toHaveTextContent("130");
    expect(screen.getByTestId("package-nutrition-readback")).toHaveTextContent("potassium");
    expect(screen.getByTestId("package-nutrition-readback")).toHaveTextContent("Basis: per serving");
    fireEvent.click(screen.getByRole("button", { name: "Use these numbers" }));
    expect(review.confirmNutrition).toHaveBeenCalledTimes(1);
  });

  it("lets a patient retake nutrition after confirming it first", () => {
    const confirmed = controller({
      ...initialPackageScanState,
      active: true,
      epoch: 1,
      session: { status: "ready", expiresAt: Date.now() + 60_000 },
      nutrition: { status: "confirmed", draft: nutrition }
    });
    render(<FoodPackageScan cloudEnabled controller={confirmed} language="en" />);

    fireEvent.click(screen.getByRole("button", { name: "Retake" }));
    expect(confirmed.scanNutrition).toHaveBeenCalledTimes(1);
  });

  it("keeps expired-session drafts recoverable and exposes a retry", () => {
    const expired = controller({
      ...initialPackageScanState,
      active: true,
      epoch: 2,
      session: { status: "error", message: "Your package scan session expired." },
      nutrition: { status: "confirmed", draft: nutrition }
    });
    render(<FoodPackageScan cloudEnabled controller={expired} language="en" />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(expired.authorize).toHaveBeenCalledTimes(1);
    expect(expired.state.nutrition.status).toBe("confirmed");
  });

  it("provides visible keyboard focus styling for the photo picker and alert semantics for rescans", () => {
    const rescan = controller({
      ...initialPackageScanState,
      active: true,
      epoch: 1,
      session: { status: "ready", expiresAt: Date.now() + 60_000 },
      identity: { status: "needs_rescan", reason: "poor_quality" }
    });
    const { rerender } = render(<FoodPackageScan cloudEnabled controller={rescan} language="en" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    const idle = controller({
      ...initialPackageScanState,
      active: true,
      epoch: 1,
      session: { status: "ready", expiresAt: Date.now() + 60_000 }
    });
    rerender(<FoodPackageScan cloudEnabled controller={idle} language="en" />);
    const picker = screen.getByText("Choose a package-front photo").closest("label");
    expect(picker).toHaveClass("focus-within:ring-2");
    expect(screen.getByText("Choose a Nutrition Facts photo")).toBeInTheDocument();

    const columns = controller({
      ...initialPackageScanState,
      active: true,
      epoch: 2,
      session: { status: "ready", expiresAt: Date.now() + 60_000 },
      nutrition: { status: "needs_rescan", reason: "multiple_columns" }
    });
    rerender(<FoodPackageScan cloudEnabled controller={columns} language="en" />);
    expect(screen.getByRole("alert")).toHaveTextContent("per-serving column");
  });

  it("withholds resolution while barcode and front identity conflict", () => {
    const conflict = controller({
      ...initialPackageScanState,
      active: true,
      epoch: 1,
      identity: {
        status: "confirmed",
        identity: { displayName: "Green Valley Edamame Ranch", brand: "Green Valley" },
        candidate: {
          brand: "Green Valley", product: "Edamame", flavor: "Ranch",
          displayName: "Green Valley Edamame Ranch", visibleText: ["Green Valley", "Edamame"],
          confidence: 0.95, quality: "good"
        }
      },
      barcode: { status: "conflict", code: "123", food: { ...barcodeFood, name: "Cool Ranch Doritos", brand: "Doritos" } }
    });
    render(<FoodPackageScan cloudEnabled controller={conflict} language="en" />);
    expect(screen.getByText("The barcode and package front disagree")).toBeInTheDocument();
    expect(screen.getByText("Package front: Green Valley Edamame Ranch")).toBeInTheDocument();
    expect(screen.getByText("Barcode record: Doritos Cool Ranch Doritos")).toBeInTheDocument();
    expect(screen.getByText(/No score is shown/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retake" }));
    expect(conflict.rejectBarcode).toHaveBeenCalledTimes(1);
    expect(conflict.scanFront).toHaveBeenCalledTimes(1);
  });

  it("offers an explicit retry after a barcode lookup error", () => {
    const failed = controller({
      ...initialPackageScanState,
      active: true,
      epoch: 1,
      barcode: { status: "error", code: "123" }
    });
    render(<FoodPackageScan cloudEnabled controller={failed} language="en" />);

    expect(screen.getByText(/lookup was interrupted or unavailable/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(failed.onBarcodeDetected).toHaveBeenCalledWith("123");
  });

  it("lets the patient cancel authorization and barcode lookup progress", () => {
    const authorizing = controller({
      ...initialPackageScanState,
      active: true,
      epoch: 1,
      session: { status: "authorizing" }
    });
    const { rerender } = render(<FoodPackageScan cloudEnabled controller={authorizing} language="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(authorizing.cancel).toHaveBeenCalledTimes(1);

    const barcode = controller({
      ...initialPackageScanState,
      active: true,
      epoch: 2,
      barcode: { status: "looking_up", code: "123" }
    });
    rerender(<FoodPackageScan cloudEnabled controller={barcode} language="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(barcode.cancel).toHaveBeenCalledTimes(1);
  });

  it("restores focus to the package launcher after the flow closes", () => {
    const active = controller({
      ...initialPackageScanState,
      active: true,
      epoch: 1,
      session: { status: "disclosure" }
    });
    const { rerender } = render(<FoodPackageScan cloudEnabled controller={active} language="en" />);
    expect(screen.getByRole("heading", { name: "Before you take a package photo" })).toHaveFocus();

    const inactive = controller(initialPackageScanState);
    rerender(<FoodPackageScan cloudEnabled controller={inactive} language="en" />);
    expect(screen.getByRole("button", { name: "Scan a package" })).toHaveFocus();
  });
});
