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

describe("PlateCard portion chips", () => {
  const scanned: PlateItem[] = [
    {
      id: "scan-1",
      food,
      servings: 1.5,
      compassScore: { fcs: 89, band: "encourage", tier: "T1" },
      portion: { origin: "vision", basis: "about two cups" }
    }
  ];

  function renderCard(items: PlateItem[], onServingsChange = vi.fn()) {
    render(
      <PlateCard
        items={items}
        summary={summarizePlate(items)}
        flags={[]}
        language="en"
        onServingsChange={onServingsChange}
        onRemove={vi.fn()}
        onLog={vi.fn()}
      />
    );
    return onServingsChange;
  }

  it("names the photo estimate and offers the three corrections", () => {
    renderCard(scanned);
    expect(screen.getByText("Photo estimate: about two cups")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Half that" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "About right" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Double it" })).toBeInTheDocument();
  });

  it("halves and doubles the current servings without snapping", async () => {
    const user = userEvent.setup();
    const onServingsChange = renderCard(scanned);

    await user.click(screen.getByRole("button", { name: "Half that" }));
    expect(onServingsChange).toHaveBeenCalledWith(0, 0.75);

    await user.click(screen.getByRole("button", { name: "Double it" }));
    expect(onServingsChange).toHaveBeenCalledWith(0, 3);
  });

  it('sends "About right" through the same path, so a confirmation still retires the chips', async () => {
    const user = userEvent.setup();
    const onServingsChange = renderCard(scanned);

    await user.click(screen.getByRole("button", { name: "About right" }));
    expect(onServingsChange).toHaveBeenCalledWith(0, 1.5);
  });

  it("hides the chips once the portion is the patient's own", () => {
    renderCard([{ ...scanned[0], portion: { origin: "user", basis: "about two cups" } }]);
    expect(screen.queryByTestId("plate-item-portion-chips")).not.toBeInTheDocument();
    // The basis line stays: it is still where this portion came from.
    expect(screen.getByText("Photo estimate: about two cups")).toBeInTheDocument();
  });

  it("shows no chips on a hand-built plate item", () => {
    renderCard(items);
    expect(screen.queryByTestId("plate-item-portion-chips")).not.toBeInTheDocument();
  });

  it("offers candidate rows only while the scan left some, one tap to swap", async () => {
    const user = userEvent.setup();
    const onSelectCandidate = vi.fn();
    render(
      <PlateCard
        items={scanned}
        summary={summarizePlate(scanned)}
        flags={[]}
        language="en"
        onServingsChange={vi.fn()}
        onRemove={vi.fn()}
        onLog={vi.fn()}
        candidates={{ "scan-1": [{ code: "56204010", description: "Quinoa, fat added", fcs: 81 }] }}
        onSelectCandidate={onSelectCandidate}
      />
    );

    await user.click(screen.getByRole("button", { name: "Quinoa, fat added" }));
    expect(onSelectCandidate).toHaveBeenCalledWith("scan-1", "56204010");
  });
});

describe("PlateCard carb range", () => {
  const scanned: PlateItem[] = [
    {
      id: "scan-1",
      food,
      servings: 1.5,
      compassScore: { fcs: 89, band: "encourage", tier: "T1" },
      portion: { origin: "vision", basis: "about two cups" }
    }
  ];

  function renderCard(items: PlateItem[]) {
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
  }

  it("bands a photo-derived carb number and says why, once, for the whole plate", () => {
    renderCard(scanned);
    // 12 g per serving x 1.5, banded +/-30% and rounded outward to 5 g.
    expect(screen.getByText("about 10–25 g carbs")).toBeInTheDocument();
    expect(screen.getAllByTestId("plate-carb-estimate-note")).toHaveLength(1);
    expect(
      screen.getByText(
        "Carb numbers from a photo are rough. Never use them for insulin math; follow your care team's plan."
      )
    ).toBeInTheDocument();
  });

  it("drops the range the moment the portion is the patient's own", () => {
    renderCard([{ ...scanned[0], portion: { origin: "user", basis: "about two cups" } }]);
    expect(screen.queryByTestId("plate-item-carb-range")).not.toBeInTheDocument();
    expect(screen.queryByTestId("plate-carb-estimate-note")).not.toBeInTheDocument();
  });

  it("shows no range on a hand-built plate item", () => {
    renderCard(items);
    expect(screen.queryByTestId("plate-item-carb-range")).not.toBeInTheDocument();
  });
});
