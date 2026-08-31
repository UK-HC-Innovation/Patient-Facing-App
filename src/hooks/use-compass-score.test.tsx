import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IdentifiedFood } from "@/domain/types";
import { useCompassScore } from "./use-compass-score";

const food: IdentifiedFood = {
  id: "label:test",
  barcode: null,
  name: "Edamame Ranch",
  brand: "Green Valley",
  category: "Bean snack",
  source: "label_vision",
  ingredientText: "soybeans, sunflower oil",
  nutrition: {
    servingSize: "1 oz (28 g)", servingGrams: 28, basis: "per_serving", calories: 130,
    sodiumMg: 180, potassiumMg: null, totalSugarsG: 2, addedSugarsG: 0,
    saturatedFatG: 1, fiberG: 5, proteinG: 13, carbsG: 11, totalFatG: 5,
    monoFatG: null, polyFatG: null, transFatG: 0, cholesterolMg: 0, calciumMg: null, ironMg: null
  }
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useCompassScore", () => {
  it("scores confirmed label nutrition locally without fuzzy-matching the package-front name", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCompassScore(food));

    expect(result.current.score?.tier).toBe("T2");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["vodka", "infant formula", "medical food"])(
    "keeps label scoreability invariant when the front name is edited to %s",
    (name) => {
      vi.stubGlobal("fetch", vi.fn());
      const edited = { ...food, name, category: name };
      const { result } = renderHook(() => useCompassScore(edited));

      expect(result.current.carveOut).toBeNull();
      expect(result.current.score?.tier).toBe("T2");
    }
  );
});
