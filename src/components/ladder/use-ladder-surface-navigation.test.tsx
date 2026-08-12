import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  parseLadderSurfaceLocationUrl,
  parseLadderSurfaceUrl,
  useLadderSurfaceNavigation,
  withLadderSurfaceUrl,
  type LadderSurfaceHistory,
  type LadderSurfaceLocation
} from "@/components/ladder/use-ladder-surface-navigation";
import type { LadderSurface } from "@/components/ladder/ladder-surface-registry";

function memoryHistory(initial?: Partial<LadderSurfaceLocation>): LadderSurfaceHistory & {
  current: LadderSurfaceLocation;
  pushes: LadderSurfaceLocation[];
  emit: () => void;
} {
  const listeners = new Set<() => void>();
  return {
    current: { surface: initial?.surface, hash: initial?.hash ?? "" },
    pushes: [],
    read() {
      return this.current;
    },
    push(location) {
      this.current = { ...location };
      this.pushes.push({ ...location });
    },
    replace(location) {
      this.current = { ...location };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit() {
      for (const listener of listeners) listener();
    }
  };
}

describe("Ladder surface URL helpers", () => {
  it("parses valid surfaces and rejects invalid values", () => {
    expect(parseLadderSurfaceUrl("/ladder?surface=notes")).toBe("notes");
    expect(parseLadderSurfaceUrl("/ladder?surface=unknown")).toBeUndefined();
    expect(parseLadderSurfaceUrl("not a url", "://bad")).toBeUndefined();
    expect(parseLadderSurfaceLocationUrl("/ladder?surface=notes#family-journal")).toEqual({
      surface: "notes",
      hash: "#family-journal"
    });
  });

  it("preserves other query values while writing surface and fragment together", () => {
    expect(withLadderSurfaceUrl("/ladder?lang=es&source=menu#stale", "notes")).toBe(
      "/ladder?lang=es&source=menu&surface=notes"
    );
    expect(
      withLadderSurfaceUrl("/ladder?lang=es&source=menu#stale", "notes", "#family-journal")
    ).toBe("/ladder?lang=es&source=menu&surface=notes#family-journal");
  });
});

describe("useLadderSurfaceNavigation", () => {
  it("restores a valid cold deep link", () => {
    const history = memoryHistory({ surface: "programs" });
    const onSurfaceChange = vi.fn();
    renderHook(() =>
      useLadderSurfaceNavigation({
        requestedSurface: "home",
        available: ["home", "programs"],
        onSurfaceChange,
        history
      })
    );

    expect(onSurfaceChange).toHaveBeenCalledWith("programs");
  });

  it("holds a deep link until persisted state unlocks its surface", () => {
    const history = memoryHistory({ surface: "notes", hash: "#family-journal" });
    const onSurfaceChange = vi.fn();
    const { rerender, result } = renderHook(
      ({ available }) =>
        useLadderSurfaceNavigation({
          requestedSurface: "home",
          available,
          onSurfaceChange,
          history
        }),
      { initialProps: { available: ["home"] as LadderSurface[] } }
    );

    expect(onSurfaceChange).not.toHaveBeenCalled();
    expect(result.current.pendingAnchor).toBeNull();
    rerender({ available: ["home", "notes"] });
    expect(onSurfaceChange).toHaveBeenCalledWith("notes");
    expect(result.current.pendingAnchor).toBe("#family-journal");
  });

  it("pushes tab choices and responds to back or forward navigation", () => {
    const history = memoryHistory();
    const onSurfaceChange = vi.fn();
    const { result } = renderHook(() =>
      useLadderSurfaceNavigation({
        requestedSurface: "home",
        available: ["home", "programs", "notes"],
        onSurfaceChange,
        history
      })
    );

    act(() => result.current.selectSurface("notes"));
    expect(history.current).toEqual({ surface: "notes", hash: "" });
    expect(onSurfaceChange).toHaveBeenLastCalledWith("notes");

    onSurfaceChange.mockClear();
    history.current = { surface: "programs", hash: "" };
    act(() => history.emit());
    expect(onSurfaceChange).toHaveBeenCalledWith("programs");
  });

  it("writes an anchor as one entry and lets an explicit tab escape its stale fragment", () => {
    const history = memoryHistory({ surface: "home" });
    const onSurfaceChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ requestedSurface }) =>
        useLadderSurfaceNavigation({
          requestedSurface,
          available: ["home", "programs"],
          onSurfaceChange,
          history
        }),
      { initialProps: { requestedSurface: "home" as LadderSurface } }
    );

    act(() => result.current.selectAnchor("#family-resources"));
    expect(history.pushes).toEqual([
      { surface: "programs", hash: "#family-resources" }
    ]);
    expect(onSurfaceChange).toHaveBeenLastCalledWith("programs");
    rerender({ requestedSurface: "programs" });

    act(() => result.current.selectSurface("home"));
    expect(history.current).toEqual({ surface: "home", hash: "" });
    rerender({ requestedSurface: "home" });
    act(() => history.emit());
    expect(result.current.activeSurface).toBe("home");
    expect(result.current.pendingAnchor).toBeNull();
  });

  it("lets a registered fragment override a conflicting surface query", () => {
    const history = memoryHistory({ surface: "home", hash: "#family-journal" });
    const onSurfaceChange = vi.fn();
    const { result } = renderHook(() =>
      useLadderSurfaceNavigation({
        requestedSurface: "home",
        available: ["home", "notes"],
        onSurfaceChange,
        history
      })
    );

    expect(onSurfaceChange).toHaveBeenCalledWith("notes");
    expect(result.current.pendingAnchor).toBe("#family-journal");
  });

  it("falls back when a selected surface becomes unavailable", () => {
    const history = memoryHistory({ surface: "visit" });
    const onSurfaceChange = vi.fn();
    const { rerender } = renderHook(
      ({ available }) =>
        useLadderSurfaceNavigation({
          requestedSurface: "visit",
          available,
          onSurfaceChange,
          history
        }),
      { initialProps: { available: ["home", "visit"] as LadderSurface[] } }
    );

    onSurfaceChange.mockClear();
    rerender({ available: ["home"] });
    expect(history.current).toEqual({ surface: "home", hash: "" });
    expect(onSurfaceChange).toHaveBeenCalledWith("home");
  });

  it("does not revive an unavailable history intent after canonicalizing Home", () => {
    const history = memoryHistory({ surface: "programs" });
    const onSurfaceChange = vi.fn();
    const { rerender } = renderHook(
      ({ requestedSurface, available }) =>
        useLadderSurfaceNavigation({
          requestedSurface,
          available,
          onSurfaceChange,
          history
        }),
      {
        initialProps: {
          requestedSurface: "programs" as LadderSurface,
          available: ["home", "programs"] as LadderSurface[]
        }
      }
    );

    history.current = { surface: "visit", hash: "" };
    act(() => history.emit());
    expect(onSurfaceChange).not.toHaveBeenCalled();

    rerender({ requestedSurface: "programs", available: ["home"] });
    expect(history.current).toEqual({ surface: "home", hash: "" });
    expect(onSurfaceChange).toHaveBeenLastCalledWith("home");
    rerender({ requestedSurface: "home", available: ["home"] });
    onSurfaceChange.mockClear();

    rerender({ requestedSurface: "home", available: ["home", "visit"] });
    expect(onSurfaceChange).not.toHaveBeenCalled();
    expect(history.current).toEqual({ surface: "home", hash: "" });
  });
});
