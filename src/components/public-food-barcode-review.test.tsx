import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FoodAuthority } from "@/domain/food-authority";
import type { IdentifiedFood } from "@/domain/types";
import { PublicFoodBarcodeReview } from "./public-food-barcode-review";

vi.mock("@/components/food-barcode-review-bridge", async () => {
  const ReactModule = await import("react");
  return {
    FoodBarcodeReviewBridge: ({
      barcode,
      onStateChange
    }: {
      barcode: string;
      onStateChange: (state: {
        active: boolean;
        resolvedFood: IdentifiedFood | null;
        barcode: string | null;
      }) => void;
    }) => {
      ReactModule.useLayoutEffect(() => {
        onStateChange({
          active: true,
          barcode,
          resolvedFood: {
            id: barcode,
            barcode,
            name: "Protein Bar",
            brand: "Snickers Marathon",
            category: "Snack bars",
            source: "barcode_off",
            ingredientText: null,
            nutrition: {
              servingSize: "1 bar (55 g)",
              servingGrams: 55,
              basis: "per_serving",
              calories: 220,
              sodiumMg: null,
              potassiumMg: null,
              totalSugarsG: null,
              addedSugarsG: null,
              saturatedFatG: null,
              fiberG: null,
              proteinG: null,
              carbsG: null,
              totalFatG: null,
              monoFatG: null,
              polyFatG: null,
              transFatG: null,
              cholesterolMg: null,
              calciumMg: null,
              ironMg: null
            }
          }
        });
      }, [barcode, onStateChange]);
      return null;
    }
  };
});

function authority(): FoodAuthority {
  let epoch = 0;
  return {
    epoch,
    snapshot: () => epoch,
    isCurrent: (candidate) => candidate === epoch,
    invalidate: () => {
      epoch += 1;
      return epoch;
    }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PublicFoodBarcodeReview", () => {
  it("prefers exact barcode density over a published-row estimate", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          mode: "candidate",
          candidate: {
            food: {
              code: "91781010",
              description: "Snickers Marathon Protein bar",
              group: "1000_Grains"
            }
          }
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          mode: "match",
          match: {
            food: {
              code: "91781010",
              description: "Snickers Marathon Protein bar",
              group: "1000_Grains"
            },
            score: {
              fcs: 58,
              band: "moderate",
              tier: "T1",
              ambiguous: false,
              range: null,
              calorieDensity: {
                kcalPer100g: 415,
                band: "high",
                estimate: {
                  method: "equivalent_food",
                  rangeKcalPer100g: null,
                  sampleCount: null,
                  referenceCode: "53720500",
                  referenceDescription: "Nutrition bar (Snickers Marathon Protein Bar)"
                }
              },
              domains: null,
              coverage: null
            },
            alternatives: [],
            nutrients: null
          },
          candidates: []
        })
      );
    const onMatch = vi.fn();

    render(
      <PublicFoodBarcodeReview
        authority={authority()}
        barcode="0123456789012"
        language="en"
        onDismiss={vi.fn()}
        onMatch={onMatch}
        resumeLive={vi.fn()}
        suspendLive={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "Yes, use this food" }));
    await waitFor(() => expect(onMatch).toHaveBeenCalledTimes(1));

    expect(onMatch.mock.calls[0][0].score.calorieDensity).toEqual({
      kcalPer100g: 400,
      band: "medium"
    });
  });
});
