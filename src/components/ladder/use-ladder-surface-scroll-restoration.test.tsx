import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LadderSurface } from "@/components/ladder/ladder-surface-registry";
import { useLadderSurfaceScrollRestoration } from "./use-ladder-surface-scroll-restoration";

describe("useLadderSurfaceScrollRestoration", () => {
  afterEach(() => vi.restoreAllMocks());

  it("remembers a separate viewport offset for each visited surface", () => {
    let scrollY = 0;
    vi.spyOn(window, "scrollY", "get").mockImplementation(() => scrollY);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation((options) => {
      scrollY = typeof options === "object"
        ? (options as ScrollToOptions).top ?? 0
        : Number(options);
    });
    const { rerender, unmount } = renderHook(
      ({ surface }: { surface: LadderSurface }) => useLadderSurfaceScrollRestoration(surface),
      { initialProps: { surface: "home" } }
    );

    scrollY = 640;
    act(() => window.dispatchEvent(new Event("scroll")));
    // A short destination can clamp the viewport before the layout effect runs.
    // That post-commit value must not overwrite Home's scroll-event snapshot.
    scrollY = 120;
    rerender({ surface: "programs" });
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "auto" });

    scrollY = 180;
    act(() => window.dispatchEvent(new Event("scroll")));
    rerender({ surface: "home" });
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 640, left: 0, behavior: "auto" });
    unmount();
  });

  it("lets an anchor own its transition and restores the browser setting on cleanup", () => {
    Object.defineProperty(window.history, "scrollRestoration", {
      configurable: true,
      writable: true,
      value: "auto"
    });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const { rerender, unmount } = renderHook(
      ({ surface, anchor }: { surface: LadderSurface; anchor: string | null }) =>
        useLadderSurfaceScrollRestoration(surface, anchor),
      { initialProps: { surface: "home", anchor: null } }
    );

    expect(window.history.scrollRestoration).toBe("manual");
    rerender({ surface: "notes", anchor: "#family-visit-packet" });
    expect(scrollTo).not.toHaveBeenCalled();

    unmount();
    expect(window.history.scrollRestoration).toBe("auto");
  });
});
