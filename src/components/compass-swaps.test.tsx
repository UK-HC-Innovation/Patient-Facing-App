/**
 * Spec 31 R5 and R6: one swap with more on request, a comparison in place, and one line
 * where there is no swap. No heading and no sort control over an empty list.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CompassAlternative } from "@/domain/food-compass";
import { CompassSwaps } from "./compass-score";

const density = { kcalPer100g: 372, band: "medium" } as CompassAlternative["calorieDensity"];

function swap(partial: Partial<CompassAlternative> & Pick<CompassAlternative, "code" | "description" | "fcs">): CompassAlternative {
  return {
    band: partial.fcs >= 70 ? "encourage" : partial.fcs <= 30 ? "minimize" : "moderate",
    calorieDensity: density,
    pool: "category",
    action: null,
    displayName: null,
    recipeQuery: null,
    ...partial
  };
}

const current = {
  name: "Honey Nut Cheerios",
  fcs: 58,
  band: "moderate" as const,
  calorieDensity: { kcalPer100g: 376, band: "medium" } as CompassAlternative["calorieDensity"]
};

describe("CompassSwaps", () => {
  it("prints one line and no heading for each state that has no swap", () => {
    const { rerender } = render(
      <CompassSwaps alternatives={[]} current={current} language="en" noScoreSwap={null} state="affirm" />
    );
    expect(screen.getByText("A good choice as it is.")).toBeInTheDocument();
    expect(screen.queryByText("Try instead")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();

    rerender(<CompassSwaps alternatives={[]} current={current} language="en" noScoreSwap={null} state="similar" />);
    expect(screen.getByText("Similar foods score about the same.")).toBeInTheDocument();

    rerender(<CompassSwaps alternatives={[]} current={current} language="en" noScoreSwap={null} state="none_higher" />);
    expect(screen.getByText("Nothing similar scores higher.")).toBeInTheDocument();

    // Nothing similar to compare: no line at all rather than a rank claim nobody checked.
    rerender(<CompassSwaps alternatives={[]} current={current} language="en" noScoreSwap={null} state="none" />);
    expect(screen.queryByTestId("food-alternatives")).not.toBeInTheDocument();

    rerender(<CompassSwaps alternatives={[]} current={current} language="es" noScoreSwap={null} state="affirm" />);
    expect(screen.getByText("Es una buena elección tal como está.")).toBeInTheDocument();
  });

  it("shows one swap under its reviewed name and the rest only on request", async () => {
    const user = userEvent.setup();
    render(
      <CompassSwaps
        alternatives={[
          swap({ code: "57123000", description: "Cereal (General Mills Cheerios)", fcs: 77, pool: "line", displayName: { en: "Cheerios", es: "Cheerios" } }),
          swap({ code: "2", description: "Cereal (Uncle Sam)", fcs: 85 }),
          swap({ code: "3", description: "Cereal, toasted oat", fcs: 80 })
        ]}
        current={current}
        language="en"
        noScoreSwap={null}
        state="swap"
      />
    );

    expect(screen.getByText("Try instead")).toBeInTheDocument();
    expect(screen.getByText("Cheerios")).toBeInTheDocument();
    expect(screen.getByText("Scored as Cereal (General Mills Cheerios)")).toBeInTheDocument();
    expect(screen.queryByText("Cereal (Uncle Sam)")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More swaps (2)" }));
    expect(screen.getByText("Cereal (Uncle Sam)")).toBeInTheDocument();
    expect(screen.getByText("Cereal, toasted oat")).toBeInTheDocument();
  });

  it("leads a preparation swap with the action and names the row under it", () => {
    render(
      <CompassSwaps
        alternatives={[swap({ code: "26107123", description: "Catfish, baked or broiled, no added fat", fcs: 83, pool: "action", action: "bake" })]}
        current={{ ...current, name: "Catfish, battered, fried", fcs: 66 }}
        language="en"
        noScoreSwap={null}
        state="swap"
      />
    );
    expect(screen.getByText("Bake, broil or grill it")).toBeInTheDocument();
    expect(screen.getByText("Scored as Catfish, baked or broiled, no added fat")).toBeInTheDocument();
  });

  it("compares in place and hands the choice back to the door", async () => {
    const user = userEvent.setup();
    const onUse = vi.fn();
    render(
      <CompassSwaps
        alternatives={[swap({ code: "57123000", description: "Cereal (General Mills Cheerios)", fcs: 77, displayName: { en: "Cheerios", es: "Cheerios" } })]}
        current={current}
        language="en"
        noScoreSwap={null}
        onUse={onUse}
        state="swap"
      />
    );

    expect(screen.queryByRole("button", { name: "Use this instead" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Cheerios/ }));
    expect(screen.getByText(/Honey Nut Cheerios · 58/)).toBeInTheDocument();
    expect(screen.getByText(/Cheerios · 77/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Use this instead" }));
    expect(onUse).toHaveBeenCalledWith({ kind: "published", code: "57123000", description: "Cereal (General Mills Cheerios)" });
  });

  it("offers water or unsweetened tea with no number for a sugary drink", async () => {
    const user = userEvent.setup();
    const onUse = vi.fn();
    render(
      <CompassSwaps
        alternatives={[]}
        current={{ ...current, name: "Sweet tea", fcs: 12, band: "minimize" }}
        language="en"
        noScoreSwap="water_or_unsweetened_tea"
        onUse={onUse}
        state="no_score_swap"
      />
    );

    expect(screen.getByText("Water or unsweetened tea")).toBeInTheDocument();
    expect(screen.getByText("Almost no calories, so there's no score for it.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Water or unsweetened tea/ }));
    await user.click(screen.getByRole("button", { name: "Use this instead" }));
    expect(onUse).toHaveBeenCalledWith({ kind: "no_score", id: "water_or_unsweetened_tea" });
  });

  it("links one recipe search, from the default swap only", async () => {
    const user = userEvent.setup();
    render(
      <CompassSwaps
        alternatives={[
          swap({
            code: "56205018",
            description: "Rice, brown, cooked, no added fat",
            fcs: 69,
            displayName: { en: "Brown rice", es: "Arroz integral" },
            recipeQuery: { en: "brown rice recipe", es: "receta de arroz integral" }
          }),
          swap({ code: "2", description: "Rice, wild, 100%, cooked, no added fat", fcs: 73 })
        ]}
        current={{ ...current, name: "Rice, white, cooked, no added fat", fcs: 23, band: "minimize" }}
        language="en"
        noScoreSwap={null}
        state="swap"
      />
    );

    await user.click(screen.getByRole("button", { name: "More swaps (1)" }));
    const links = screen.getAllByRole("link", { name: "Recipes (web search)" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "https://www.google.com/search?q=brown%20rice%20recipe");
  });
});
