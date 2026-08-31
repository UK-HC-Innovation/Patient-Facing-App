import React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePageHideTeardown } from "./use-page-hide-teardown";

function Probe({ stops }: { stops: ReadonlyArray<() => void> }) {
  usePageHideTeardown(stops);
  return <p>probe</p>;
}

function hide(hidden: boolean) {
  return vi.spyOn(document, "hidden", "get").mockReturnValue(hidden);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePageHideTeardown", () => {
  it("releases everything when the tab is backgrounded", () => {
    const camera = vi.fn();
    const voice = vi.fn();
    hide(true);
    render(<Probe stops={[camera, voice]} />);

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(camera).toHaveBeenCalledTimes(1);
    expect(voice).toHaveBeenCalledTimes(1);
  });

  it("also catches a tab being swiped shut, which visibilitychange can miss", () => {
    const stop = vi.fn();
    hide(false);
    render(<Probe stops={[stop]} />);

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("leaves a still-visible page alone", () => {
    const stop = vi.fn();
    hide(false);
    render(<Probe stops={[stop]} />);

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(stop).not.toHaveBeenCalled();
  });

  it("runs the latest stops without ever unsubscribing between renders", () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = render(<Probe stops={[first]} />);

    // Callers rebind these every render. Re-subscribing on each new identity would leave a
    // window with no listener attached at all, so the hook holds them in a ref instead.
    view.rerender(<Probe stops={[second]} />);
    hide(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops listening once the surface unmounts", () => {
    const stop = vi.fn();
    const view = render(<Probe stops={[stop]} />);
    view.unmount();

    hide(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(stop).not.toHaveBeenCalled();
  });
});
