import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { FoodFactsCard } from "./food-facts-card";
import type { FoodFlag } from "@/domain/food-flags";
import type { IdentifiedFood } from "@/domain/types";
import { scaleNutrition } from "@/domain/portion";

const soup: IdentifiedFood = {
  id: "051000012616",
  barcode: "051000012616",
  name: "Chicken Noodle Soup",
  brand: "Campbell's",
  category: "Soups",
  nutrition: {
    servingSize: "1/2 cup",
    calories: 60,
    sodiumMg: 890,
    potassiumMg: 100,
    totalSugarsG: 1,
    addedSugarsG: 0,
    saturatedFatG: 0.5,
    fiberG: 1,
    proteinG: 3,
    carbsG: 8,
    totalFatG: null,
    monoFatG: null,
    polyFatG: null,
    transFatG: null,
    cholesterolMg: null,
    calciumMg: null,
    ironMg: null,
    servingGrams: null,
    basis: "per_serving"
  },
  source: "barcode_seed",
  ingredientText: null
};

const flags: FoodFlag[] = [{ id: "nutrient-sodiumMg", severity: "warning", text: "890 mg sodium — 59% of your 1500 mg daily limit" }];
const portionProps = { portionServings: 1, onPortionChange: () => {} };

describe("FoodFactsCard", () => {
  it("renders the food name and flags", () => {
    render(<FoodFactsCard food={soup} flags={flags} logged={false} canLog onLog={() => {}} language="en" {...portionProps} />);
    expect(screen.getByText("Campbell's Chicken Noodle Soup")).toBeInTheDocument();
    expect(screen.getByText(/890 mg sodium/)).toBeInTheDocument();
    expect(screen.getByText(/Personalized: considers your recent readings and health profile/)).toBeInTheDocument();
  });

  it("calls onLog when the log button is pressed", async () => {
    const onLog = vi.fn();
    const user = userEvent.setup();
    render(<FoodFactsCard food={soup} flags={flags} logged={false} canLog onLog={onLog} language="en" {...portionProps} />);
    await user.click(screen.getByRole("button", { name: "Log this" }));
    expect(onLog).toHaveBeenCalledTimes(1);
  });

  it("shows the logged confirmation instead of the button", () => {
    render(<FoodFactsCard food={soup} flags={flags} logged canLog onLog={() => {}} language="en" {...portionProps} />);
    expect(screen.getByText("Added to your meals")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log this" })).not.toBeInTheDocument();
  });

  it("shows the estimate badge for vision-estimated food", () => {
    render(
      <FoodFactsCard
        food={{ ...soup, source: "vision_estimate" }}
        flags={[]}
        logged={false}
        canLog
        onLog={() => {}}
        language="en"
        {...portionProps}
      />
    );
    expect(screen.getByText("Estimate from photo")).toBeInTheDocument();
  });

  it("renders Spanish strings", () => {
    render(<FoodFactsCard food={soup} flags={[]} logged={false} canLog onLog={() => {}} language="es" {...portionProps} />);
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it("updates the serving assumption and scaled nutrition when servings change", async () => {
    const user = userEvent.setup();

    function PortionHarness() {
      const [portionServings, setPortionServings] = React.useState(1);
      const food =
        portionServings === 1 || soup.nutrition === null
          ? soup
          : { ...soup, nutrition: scaleNutrition(soup.nutrition, portionServings) };

      return (
        <FoodFactsCard
          food={food}
          flags={[]}
          logged={false}
          canLog
          onLog={() => {}}
          language="en"
          portionServings={portionServings}
          onPortionChange={setPortionServings}
        />
      );
    }

    render(<PortionHarness />);

    expect(screen.getByText("Assuming 1 serving(s) - tap to change.")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Increase servings" }));

    expect(screen.getByText("Assuming 2 serving(s) - tap to change.")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("discloses the spoken-size serving assumption", () => {
    render(
      <FoodFactsCard
        food={soup}
        flags={[]}
        logged={false}
        canLog
        onLog={() => {}}
        language="en"
        portionServings={1.5}
        spokenSize="large"
        onPortionChange={() => {}}
      />
    );

    expect(screen.getByText("large ≈ 1.5 servings — adjust?")).toBeInTheDocument();
  });

  it("offers deterministic correction chips for camera matches only", async () => {
    const user = userEvent.setup();
    const onCorrection = vi.fn();
    const candidates = [{ code: "123", description: "Plantain, cooked", fcs: 61 }];
    const { rerender } = render(
      <FoodFactsCard
        food={{ ...soup, id: "fndds:63107010", source: "fndds_lookup" }}
        flags={[]}
        logged={false}
        canLog
        onCorrection={onCorrection}
        correctionCandidates={candidates}
        onLog={() => {}}
        language="en"
        {...portionProps}
      />
    );

    await user.click(screen.getByRole("button", { name: "Plantain, cooked" }));
    expect(onCorrection).toHaveBeenCalledWith("123");

    rerender(
      <FoodFactsCard
        food={soup}
        flags={[]}
        logged={false}
        canLog
        onCorrection={onCorrection}
        correctionCandidates={candidates}
        onLog={() => {}}
        language="en"
        {...portionProps}
      />
    );
    expect(screen.queryByText("Not this?")).not.toBeInTheDocument();
  });
});

describe("FoodFactsCard — Food Compass row", () => {
  const score = {
    fcs: 19,
    band: "minimize" as const,
    tier: "T2" as const,
    ambiguous: false,
    range: null,
    calorieDensity: { kcalPer100g: 480, band: "high" as const },
    domains: [{ key: "D3" as const, value: -5 }],
    coverage: { included: ["D3" as const], missing: ["D2" as const, "D4" as const] }
  };

  it("shows the score, the band, the estimate badge and what the label could not cover", () => {
    render(
      <FoodFactsCard
        canLog
        compassAlternatives={[]}
        compassScore={score}
        flags={[]}
        food={soup}
        language="en"
        logged={false}
        onLog={() => {}}
        onPortionChange={() => {}}
        portionServings={1}
      />
    );

    expect(screen.getByText("19")).toBeInTheDocument();
    expect(screen.getByText("Minimize")).toBeInTheDocument();
    expect(screen.getByText(/General nutrition: Food Compass only/)).toBeInTheDocument();
    expect(screen.getByText("Estimate from label")).toBeInTheDocument();
    expect(screen.getByText(/Not scored from this label: D2, D4/)).toBeInTheDocument();
    // score 19 with no closer better option: saying "already one of the best" would be a lie
    expect(screen.getByText(/No closer option with a higher score/)).toBeInTheDocument();
  });

  it("shows carve-out copy and no number at all for a food outside the score's range", () => {
    render(
      <FoodFactsCard
        canLog
        compassCarveOut="zero_calorie"
        flags={[]}
        food={soup}
        language="en"
        logged={false}
        onLog={() => {}}
        onPortionChange={() => {}}
        portionServings={1}
      />
    );

    expect(screen.getByText(/Water is the best choice there is/)).toBeInTheDocument();
    expect(screen.queryByText("Food Compass score")).not.toBeInTheDocument();
  });
});
