import type { FamilyStringKey } from "@/i18n/family-strings";

export type LadderSurface = "home" | "programs" | "notes" | "visit";
export type LadderIconKey = "home" | "programs" | "notes" | "visit";

export type LadderSurfaceContext = {
  hasPrograms: boolean;
  hasNotes: boolean;
  hasVisit: boolean;
};

export type LadderSurfaceDefinition = {
  id: LadderSurface;
  labelKey: FamilyStringKey;
  icon: LadderIconKey;
  tabId: `ladder-tab-${LadderSurface}`;
  panelId: `ladder-panel-${LadderSurface}`;
  anchors: readonly string[];
  available: (context: LadderSurfaceContext) => boolean;
};

export const LADDER_SURFACES = [
  {
    id: "home",
    labelKey: "tabHome",
    icon: "home",
    tabId: "ladder-tab-home",
    panelId: "ladder-panel-home",
    anchors: [
      "family-experience",
      "family-interview-title",
      "family-checkin",
      "family-remind",
      "family-followup",
      "family-clinic-now",
      "family-timeline",
      "family-timeline-title"
    ],
    available: () => true
  },
  {
    id: "programs",
    labelKey: "tabPrograms",
    icon: "programs",
    tabId: "ladder-tab-programs",
    panelId: "ladder-panel-programs",
    anchors: ["family-resources", "family-resources-title", "family-guides"],
    available: ({ hasPrograms }) => hasPrograms
  },
  {
    id: "notes",
    labelKey: "tabNotes",
    icon: "notes",
    tabId: "ladder-tab-notes",
    panelId: "ladder-panel-notes",
    anchors: ["family-journal", "family-journal-title", "family-visit-packet"],
    available: ({ hasNotes }) => hasNotes
  },
  {
    id: "visit",
    labelKey: "tabVisit",
    icon: "visit",
    tabId: "ladder-tab-visit",
    panelId: "ladder-panel-visit",
    anchors: ["family-appt-title"],
    available: ({ hasVisit }) => hasVisit
  }
] as const satisfies readonly LadderSurfaceDefinition[];

export const LADDER_SURFACE_ORDER = LADDER_SURFACES.map(({ id }) => id);

const SURFACE_BY_ID = new Map<LadderSurface, LadderSurfaceDefinition>(
  LADDER_SURFACES.map((definition) => [definition.id, definition])
);

const SURFACE_BY_ANCHOR = new Map<string, LadderSurface>(
  LADDER_SURFACES.flatMap(({ id, anchors }) => anchors.map((anchor) => [anchor, id] as const))
);

export function isLadderSurface(value: string | null | undefined): value is LadderSurface {
  return value !== undefined && value !== null && SURFACE_BY_ID.has(value as LadderSurface);
}

export function ladderSurfaceDefinition(surface: LadderSurface): LadderSurfaceDefinition {
  return SURFACE_BY_ID.get(surface)!;
}

export function ladderTabId(surface: LadderSurface): `ladder-tab-${LadderSurface}` {
  return ladderSurfaceDefinition(surface).tabId;
}

export function ladderPanelId(surface: LadderSurface): `ladder-panel-${LadderSurface}` {
  return ladderSurfaceDefinition(surface).panelId;
}

export function availableLadderSurfaces(context: LadderSurfaceContext): LadderSurface[] {
  return LADDER_SURFACES.filter((definition) => definition.available(context)).map(({ id }) => id);
}

export function ladderSurfaceForAnchor(hash: string): LadderSurface | undefined {
  const id = ladderAnchorId(hash);
  return id ? SURFACE_BY_ANCHOR.get(id) : undefined;
}

export function ladderAnchorId(hash: string): string | undefined {
  if (hash.length <= 1) return undefined;
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return undefined;
  }
}
