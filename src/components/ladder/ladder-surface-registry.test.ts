import { describe, expect, it } from "vitest";
import {
  LADDER_SURFACES,
  availableLadderSurfaces,
  isLadderSurface,
  ladderAnchorId,
  ladderPanelId,
  ladderSurfaceForAnchor,
  ladderTabId
} from "@/components/ladder/ladder-surface-registry";

describe("Ladder surface registry", () => {
  it("owns unique surface, tab, panel, and anchor identifiers", () => {
    const unique = (values: readonly string[]) => new Set(values).size === values.length;

    expect(unique(LADDER_SURFACES.map(({ id }) => id))).toBe(true);
    expect(unique(LADDER_SURFACES.map(({ tabId }) => tabId))).toBe(true);
    expect(unique(LADDER_SURFACES.map(({ panelId }) => panelId))).toBe(true);
    expect(unique(LADDER_SURFACES.flatMap(({ anchors }) => anchors))).toBe(true);
  });

  it("keeps generated ids and anchor ownership aligned with definitions", () => {
    for (const definition of LADDER_SURFACES) {
      expect(ladderTabId(definition.id)).toBe(definition.tabId);
      expect(ladderPanelId(definition.id)).toBe(definition.panelId);
      for (const anchor of definition.anchors) {
        expect(ladderSurfaceForAnchor(`#${encodeURIComponent(anchor)}`)).toBe(definition.id);
      }
    }
  });

  it("always exposes Home and gates the other surfaces from one context", () => {
    expect(
      availableLadderSurfaces({ hasPrograms: false, hasNotes: false, hasVisit: false })
    ).toEqual(["home"]);
    expect(
      availableLadderSurfaces({ hasPrograms: true, hasNotes: true, hasVisit: false })
    ).toEqual(["home", "programs", "notes"]);
  });

  it("parses only registered surfaces and safe anchors", () => {
    expect(isLadderSurface("visit")).toBe(true);
    expect(isLadderSurface("settings")).toBe(false);
    expect(ladderSurfaceForAnchor("#%E0%A4%A")).toBeUndefined();
    expect(ladderAnchorId("#family%20resources")).toBe("family resources");
    expect(ladderAnchorId("#%E0%A4%A")).toBeUndefined();
  });
});
