import React, { useRef } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { measureVisibleRatio, useViewfinderVisibility } from "./use-viewfinder-visibility";

function rect(top: number, height: number): DOMRect {
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

describe("measureVisibleRatio", () => {
  it("is 1 when the whole viewfinder is inside the viewport and 0 once it is past it", () => {
    expect(measureVisibleRatio(rect(0, 336), 0, 844)).toBe(1);
    expect(measureVisibleRatio(rect(-336, 336), 0, 844)).toBe(0);
  });

  it("reports the fraction still showing mid-scroll", () => {
    expect(measureVisibleRatio(rect(-168, 336), 0, 844)).toBeCloseTo(0.5, 5);
    expect(measureVisibleRatio(rect(-134, 336), 0, 844)).toBeCloseTo(0.6, 2);
  });

  it("normalises against the viewport when the viewfinder is taller than it", () => {
    // Otherwise the resume threshold would be unreachable on a very short screen.
    expect(measureVisibleRatio(rect(0, 900), 0, 400)).toBe(1);
  });

  it("refuses to divide by a collapsed element rather than guessing", () => {
    expect(measureVisibleRatio(rect(0, 0), 0, 844)).toBe(0);
  });
});

function Probe({ onRatio }: { onRatio: (ratio: number) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useViewfinderVisibility({ targetRef: ref, onRatio });
  return <div data-testid="viewfinder" ref={ref} />;
}

describe("useViewfinderVisibility", () => {
  let boundingRect = rect(0, 336);

  beforeEach(() => {
    vi.useFakeTimers();
    boundingRect = rect(0, 336);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => boundingRect);
    window.innerHeight = 844;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("measures once on mount so the loop does not start on a guess", () => {
    const onRatio = vi.fn();
    render(<Probe onRatio={onRatio} />);
    expect(onRatio).toHaveBeenCalledWith(1);
  });

  it("coalesces a scroll burst into one measurement", () => {
    // Measuring per scroll event is what froze the tab: scroll -> measure -> render ->
    // layout -> scroll, until the main thread died.
    const onRatio = vi.fn();
    render(<Probe onRatio={onRatio} />);
    onRatio.mockClear();

    boundingRect = rect(-100, 336);
    act(() => {
      for (let i = 0; i < 40; i += 1) {
        window.dispatchEvent(new Event("scroll"));
      }
      vi.advanceTimersByTime(32);
    });

    expect(onRatio).toHaveBeenCalledTimes(1);
    expect(onRatio).toHaveBeenLastCalledWith(expect.closeTo(236 / 336, 5));
  });
});
