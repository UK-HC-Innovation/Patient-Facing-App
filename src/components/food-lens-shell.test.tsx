import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMPASS_CAPABILITIES,
  FOOD_LENS_CAPABILITIES,
  FOOD_LENS_SLOT_ORDER,
  STATUS_STRIP_HEIGHT_PX,
  FoodLensShell
} from "./food-lens-shell";

function domRect(top: number, height: number): DOMRect {
  return {
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 390,
    width: 390,
    x: 0,
    y: top,
    toJSON: () => ({})
  } as DOMRect;
}

let boundingRect = domRect(0, 336);

function scrollTo(rect: DOMRect) {
  boundingRect = rect;
  act(() => {
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(32);
  });
}

function strip() {
  return screen.getByRole("region", { name: "1 good choice status" });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  boundingRect = domRect(0, 336);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => boundingRect);
  window.innerHeight = 844;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function renderShell(overrides: Partial<React.ComponentProps<typeof FoodLensShell>> = {}) {
  return render(
    <FoodLensShell
      capabilities={FOOD_LENS_CAPABILITIES}
      foodName="Banana, raw"
      foodScore={{ fcs: 83, band: "encourage" }}
      language="en"
      loopState="sending"
      slots={{ verdict: <p>verdict block</p> }}
      viewfinder={<div>camera</div>}
      voiceBar={<p>voice bar</p>}
      {...overrides}
    />
  );
}

describe("FoodLensShell", () => {
  it("renders the slots in their fixed order and nothing at all for an empty one", () => {
    renderShell({
      slots: {
        // Deliberately out of order: the shell, not the caller, decides the ranking.
        attribution: <p>attribution block</p>,
        verdict: <p>verdict block</p>,
        chart: null,
        nutrients: <p>nutrients block</p>
      }
    });

    const content = screen.getByRole("region", { name: "About this food" });
    expect(content.textContent).toBe("verdict blocknutrients blockattribution block");
    expect(screen.queryByText("chart block")).not.toBeInTheDocument();
    expect(FOOD_LENS_SLOT_ORDER.indexOf("verdict")).toBeLessThan(FOOD_LENS_SLOT_ORDER.indexOf("attribution"));
  });

  it("switches the strip from loop status to name and score at the same height", () => {
    renderShell();

    expect(strip()).toHaveAttribute("data-strip-mode", "loop");
    expect(strip()).toHaveTextContent("Reading the camera");
    expect(strip()).toHaveStyle({ height: `${STATUS_STRIP_HEIGHT_PX}px` });

    // Less than half the viewfinder left on screen.
    scrollTo(domRect(-200, 336));
    expect(strip()).toHaveAttribute("data-strip-mode", "food");
    expect(strip()).toHaveTextContent("Banana, raw · 83");
    expect(strip()).toHaveStyle({ height: `${STATUS_STRIP_HEIGHT_PX}px` });

    // Back above the pause line but below the resume line: still the food mode.
    scrollTo(domRect(-150, 336));
    expect(strip()).toHaveAttribute("data-strip-mode", "food");

    scrollTo(domRect(-100, 336));
    expect(strip()).toHaveAttribute("data-strip-mode", "loop");
  });

  it("re-renders 44 pixels rather than the content region when the strip flips", () => {
    let renders = 0;
    function Probe() {
      renders += 1;
      return <p>verdict block</p>;
    }
    // A stable element, exactly as a page hands it in: React must bail out of re-rendering
    // it when the shell's own on/off boolean changes.
    const probe = <Probe />;
    renderShell({ slots: { verdict: probe } });
    expect(renders).toBe(1);

    scrollTo(domRect(-200, 336));
    expect(strip()).toHaveAttribute("data-strip-mode", "food");
    expect(renders).toBe(1);
  });

  it("keeps the camera button a capability rather than a route check", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onBackToCamera = vi.fn();
    const { unmount } = renderShell({ onBackToCamera });
    scrollTo(domRect(-200, 336));
    await user.click(screen.getByRole("button", { name: "Back to the camera" }));
    expect(onBackToCamera).toHaveBeenCalledTimes(1);
    unmount();

    boundingRect = domRect(0, 336);
    renderShell({ capabilities: COMPASS_CAPABILITIES, onBackToCamera });
    scrollTo(domRect(-200, 336));
    expect(screen.queryByRole("button", { name: "Back to the camera" })).not.toBeInTheDocument();
  });

  it("reports the ratio to the loop so both agree on when frames stop", () => {
    const onVisibleRatio = vi.fn();
    renderShell({ onVisibleRatio });
    expect(onVisibleRatio).toHaveBeenLastCalledWith(1);

    scrollTo(domRect(-200, 336));
    expect(onVisibleRatio).toHaveBeenLastCalledWith(expect.closeTo(136 / 336, 5));
  });

  it("shows no pill at all where the camera is unavailable", () => {
    renderShell({ loopState: "unavailable" });
    expect(strip()).not.toHaveTextContent("Reading the camera");
    expect(strip()).not.toHaveTextContent("Camera paused");
    expect(strip()).not.toHaveTextContent("Looking for food");
  });

  it("stops being the shell during a crisis", () => {
    renderShell({ crisis: <p>crisis lock</p> });
    expect(screen.getByText("crisis lock")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Food camera" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "1 good choice status" })).not.toBeInTheDocument();
    expect(screen.queryByText("voice bar")).not.toBeInTheDocument();
  });
});
