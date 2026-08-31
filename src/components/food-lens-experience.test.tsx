import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CompassScore } from "@/domain/food-compass";
import {
  FoodLensExperience,
  sharedViewfinderProps,
  type FoodLensView
} from "./food-lens-experience";
import { COMPASS_CAPABILITIES, FOOD_LENS_CAPABILITIES } from "./food-lens-shell";

const score: CompassScore = {
  fcs: 83,
  band: "encourage",
  tier: "T1",
  ambiguous: false,
  range: null,
  calorieDensity: { kcalPer100g: 89, band: "low" },
  domains: null,
  coverage: null
};

const emptyView: FoodLensView = {
  name: null,
  identified: false,
  score: null,
  carveOut: null,
  badge: "idle",
  noMatchCandidates: [],
  noMatch: false,
  candidate: null,
  packageDetected: false
};

function renderExperience(overrides: Partial<React.ComponentProps<typeof FoodLensExperience>> = {}) {
  return render(
    <FoodLensExperience
      capabilities={FOOD_LENS_CAPABILITIES}
      language="en"
      loopState="searching"
      slots={{}}
      view={emptyView}
      viewfinder={<div>camera</div>}
      voiceBar={<p>voice bar</p>}
      whyScore={{ open: false, onClose: () => {}, breakdown: null, tier: "T1" }}
      {...overrides}
    />
  );
}

describe("FoodLensExperience", () => {
  it("shows an unscored camera candidate until the patient confirms it", () => {
    const onConfirmIdentity = vi.fn();
    renderExperience({
      onConfirmIdentity,
      onRejectIdentity: vi.fn(),
      view: {
        ...emptyView,
        name: "Edamame, cooked",
        candidate: {
          food: { code: "11113000", description: "Edamame, cooked", group: "vegetables" },
          candidates: []
        }
      }
    });

    expect(screen.queryByTestId("food-verdict")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes, use this food" }));
    expect(onConfirmIdentity).toHaveBeenCalledWith("11113000");
  });

  it("renders package detection as an explicit no-score abstention", () => {
    renderExperience({ view: { ...emptyView, packageDetected: true } });
    expect(screen.getByText("This looks packaged")).toBeInTheDocument();
    expect(screen.queryByTestId("food-verdict")).not.toBeInTheDocument();
  });

  it("keeps the public capability set incapable of asking for anything typed", () => {
    renderExperience({
      capabilities: COMPASS_CAPABILITIES,
      view: { ...emptyView, name: "Banana, raw", identified: true, score }
    });

    // Decision 5 re-proven one layer up from the shell: the box is never rendered, not
    // hidden, and the public strip has nowhere to send anyone back to.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to the camera" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-guidance-scope="personalized"]')).toBeNull();
  });

  it("builds one verdict from the view, whatever identified the food", () => {
    const { container } = renderExperience({
      view: { ...emptyView, name: "Banana, raw", identified: true, score }
    });

    expect(screen.getByTestId("food-verdict")).toHaveTextContent("83");
    expect(screen.getByTestId("food-verdict")).toHaveTextContent("One of the better choices");
    // The name belongs to whichever of the strip and the verdict is carrying it, never both:
    // in jsdom the viewfinder measures as off screen, so the strip has it.
    const named = Array.from(container.querySelectorAll("p")).filter(
      (node) => node.textContent?.includes("Banana, raw")
    );
    expect(named).toHaveLength(1);
  });

  it("offers a food you have had before only where there is somewhere to have had one", () => {
    const { unmount } = renderExperience({ emptyStateChildren: <p>saved picks</p> });
    expect(screen.getByText("saved picks")).toBeInTheDocument();
    expect(screen.getByTestId("food-empty")).toHaveTextContent("pick one you've had before");
    unmount();

    renderExperience({ capabilities: COMPASS_CAPABILITIES });
    // A store-free door has no recents, so it does not promise any.
    expect(screen.getByTestId("food-empty")).not.toHaveTextContent("pick one you've had before");
  });

  it("names the result region only for the door that asks for it", () => {
    const { unmount } = renderExperience({ view: { ...emptyView, identified: true, score } });
    expect(screen.queryByRole("region", { name: "Food result" })).not.toBeInTheDocument();
    unmount();

    renderExperience({
      capabilities: COMPASS_CAPABILITIES,
      verdictRegionLabel: "Food result",
      view: { ...emptyView, identified: true, score }
    });
    expect(screen.getByRole("region", { name: "Food result" })).toBeInTheDocument();
  });

  it("offers the published categories the route named when nothing matched", () => {
    const onSelectCandidate = vi.fn();
    renderExperience({
      onSelectCandidate,
      view: {
        ...emptyView,
        noMatch: true,
        noMatchCandidates: [{ code: "1", description: "Soup, tomato", fcs: 55 }]
      }
    });

    expect(screen.getByRole("button", { name: "Soup, tomato" })).toBeInTheDocument();
  });

  it("wraps itself in whatever chrome the door supplies, and imports none of it", () => {
    renderExperience({ wrapper: (children) => <main data-testid="door-chrome">{children}</main> });
    expect(screen.getByTestId("door-chrome")).toContainElement(screen.getByRole("region", { name: "About this food" }));
  });
});

describe("sharedViewfinderProps", () => {
  it("hands over the props both doors agree on, and no name for the badge", () => {
    const camera = { videoRef: { current: null }, status: "active" as const };
    const props = sharedViewfinderProps({
      camera,
      view: { ...emptyView, name: "Campbell's Chicken Noodle Soup", identified: true, score },
      language: "en",
      sessionStatus: "idle"
    });

    expect(props.scanChip).toBe("Campbell's Chicken Noodle Soup");
    expect(props.scoreFcs).toBe(83);
    // The pinned voice bar owns the session status inside the shell.
    expect(props.showVoiceStatus).toBe(false);
    // scoreName stays a door decision: /food badges the bare name because the chip beside
    // it already carries the brand.
    expect("scoreName" in props).toBe(false);
  });
});

describe("FoodLensExperience — the shared quadrant chart", () => {
  const plot = () => screen.queryByTestId("nutrition-compass");

  it("plots a scored food on either door", () => {
    renderExperience({ view: { ...emptyView, name: "Banana, raw", identified: true, score } });
    expect(plot()).toBeInTheDocument();
    expect(screen.getByTestId("nutrition-compass-marker")).toBeInTheDocument();
  });

  it("gives a carve-out no chart at all, on either door", () => {
    // Spec 25 section 6: the product just said there is no number for this food. A plotted
    // point one line later would put one back. This used to hold on /food only.
    const { unmount } = renderExperience({
      view: { ...emptyView, name: "Water", identified: true, carveOut: "zero_calorie" }
    });
    expect(plot()).not.toBeInTheDocument();
    unmount();

    renderExperience({
      capabilities: COMPASS_CAPABILITIES,
      view: { ...emptyView, name: "Water", identified: true, carveOut: "zero_calorie" }
    });
    expect(plot()).not.toBeInTheDocument();
  });

  it("says it is still working while a refinement is in flight", () => {
    renderExperience({ chart: { pending: true } });
    expect(plot()).toHaveAttribute("aria-busy", "true");
    expect(plot()).toHaveTextContent("Checking this food");
  });

  it("says so when the lens saw something with no published score", () => {
    // The parity /food gained: the plot names the outcome instead of vanishing.
    renderExperience({ view: { ...emptyView, noMatch: true } });
    expect(plot()).toHaveTextContent("No match yet");
    expect(plot()).not.toHaveAttribute("aria-busy", "true");
  });

  it("leaves the personal empty screen to the recents row, and holds the public one open", () => {
    const { unmount } = renderExperience();
    expect(plot()).not.toBeInTheDocument();
    unmount();

    // The public door's chart is the centrepiece of the page, so it waits visibly.
    renderExperience({ capabilities: COMPASS_CAPABILITIES });
    expect(plot()).toBeInTheDocument();
  });
});
