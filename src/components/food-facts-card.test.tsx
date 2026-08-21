import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { dayTotalBarTone, FoodFactsCard } from "./food-facts-card";
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

  it("offers Add to plate beside the single-food log action", async () => {
    const user = userEvent.setup();
    const onAddToPlate = vi.fn();
    render(
      <FoodFactsCard
        food={soup}
        flags={[]}
        logged={false}
        canLog
        onLog={() => {}}
        onAddToPlate={onAddToPlate}
        language="en"
        {...portionProps}
      />
    );

    await user.click(screen.getByRole("button", { name: "Add to plate" }));
    expect(onAddToPlate).toHaveBeenCalledTimes(1);
  });

  it("shows prior-food history and keeps the paired number diabetes-only", () => {
    const { rerender } = render(
      <FoodFactsCard
        food={soup}
        flags={[]}
        history={{ date: "Jan 12", postMealReading: 178 }}
        logged={false}
        canLog
        onLog={() => {}}
        language="en"
        {...portionProps}
      />
    );

    expect(screen.getByText("You logged this on Jan 12.")).toBeInTheDocument();
    expect(screen.queryByText(/178 mg\/dL/)).not.toBeInTheDocument();

    rerender(
      <FoodFactsCard
        food={soup}
        flags={[]}
        history={{ date: "Jan 12", postMealReading: 178 }}
        showGlucoseHistory
        logged={false}
        canLog
        onLog={() => {}}
        language="en"
        {...portionProps}
      />
    );
    expect(screen.getByText(/178 mg\/dL/)).toHaveTextContent("not a diagnosis");
  });

  it("renders today's totals with fixed amber and red thresholds and an incomplete marker", () => {
    expect(dayTotalBarTone(79)).toBe("default");
    expect(dayTotalBarTone(80)).toBe("amber");
    expect(dayTotalBarTone(100)).toBe("red");

    render(
      <FoodFactsCard
        food={soup}
        flags={[]}
        dayTotals={[
          {
            nutrient: "sodiumMg",
            flagKey: "flagSodium",
            unit: "mg",
            total: 1200,
            dailyLimit: 1500,
            percent: 80,
            incomplete: true
          },
          {
            nutrient: "carbsG",
            flagKey: "flagCarbs",
            unit: "g",
            total: 200,
            dailyLimit: 200,
            percent: 100,
            incomplete: false
          }
        ]}
        logged={false}
        canLog
        onLog={() => {}}
        language="en"
        {...portionProps}
      />
    );

    expect(screen.getByText("Today so far")).toBeInTheDocument();
    expect(screen.getByText("Some logged foods are missing this value.")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /Sodium/ }).firstElementChild).toHaveAttribute(
      "data-tone",
      "amber"
    );
    expect(screen.getByRole("progressbar", { name: /Carbs/ }).firstElementChild).toHaveAttribute("data-tone", "red");
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
    expect(screen.getByText("Why this score?")).toBeInTheDocument();
    expect(screen.getByText("Minerals")).toBeInTheDocument();
    expect(screen.getByText("-5")).toBeInTheDocument();
    expect(screen.getByText(/Not assessable: Vitamins, Food ingredients/)).toBeInTheDocument();
    // score 19 with no closer better option: saying "already one of the best" would be a lie
    expect(screen.getByText(/No closer option with a higher score/)).toBeInTheDocument();
  });

  it("labels a T1 breakdown as an estimate while preserving the published score", () => {
    render(
      <FoodFactsCard
        canLog
        compassScore={{ ...score, fcs: 83, tier: "T1", domains: null, coverage: null }}
        estimatedDomains={{
          domains: [{ key: "D3", value: 4.25 }],
          coverage: { included: ["D3"], missing: ["D4"], partial: ["D5", "D9"] }
        }}
        flags={[]}
        food={soup}
        language="en"
        logged={false}
        onLog={() => {}}
        onPortionChange={() => {}}
        portionServings={1}
      />
    );

    expect(screen.getByText("83")).toBeInTheDocument();
    expect(screen.getByText(/published number stands/i)).toBeInTheDocument();
    expect(screen.getByText("+4.3")).toBeInTheDocument();
    expect(screen.getByText(/Not assessable: Food ingredients/)).toBeInTheDocument();
    expect(screen.getByText(/Only partly assessable: Additives, Phytochemicals/)).toBeInTheDocument();
  });

  it("offers a localized favorite toggle for T1 scores only", async () => {
    const onToggleFavorite = vi.fn();
    const { rerender } = render(
      <FoodFactsCard
        canLog
        compassScore={{ ...score, tier: "T1", domains: null, coverage: null }}
        favorite={false}
        flags={[]}
        food={soup}
        language="en"
        logged={false}
        onLog={() => {}}
        onPortionChange={() => {}}
        onToggleFavorite={onToggleFavorite}
        portionServings={1}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Add Campbell's Chicken Noodle Soup to favorites" }));
    expect(onToggleFavorite).toHaveBeenCalledOnce();

    rerender(
      <FoodFactsCard
        canLog
        compassScore={score}
        flags={[]}
        food={soup}
        language="en"
        logged={false}
        onLog={() => {}}
        onPortionChange={() => {}}
        onToggleFavorite={onToggleFavorite}
        portionServings={1}
      />
    );
    expect(screen.queryByRole("button", { name: /favorites/i })).not.toBeInTheDocument();
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
