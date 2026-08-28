"use client";

import React, { useCallback, type ReactNode, type RefObject } from "react";
import type { Language } from "@/i18n/strings";
import type { CompassScore, NotScoreableReason } from "@/domain/food-compass";
import type { LiveCandidate, LiveLoopState, LiveScoreBadge } from "@/hooks/use-live-food-score";
import type { CameraStatus } from "@/hooks/use-food-camera";
import type { LiveSessionStatus } from "@/ai/types";
import type { CompassBreakdown } from "./compass-score";
import { NutritionCompass } from "./nutrition-compass";
import {
  FoodEmptyState,
  FoodNoMatch,
  FoodVerdict,
  FoodWhyScore
} from "./food-lens-blocks";
import {
  FoodLensShell,
  type FoodLensCapabilities,
  type FoodLensSlot
} from "./food-lens-shell";

/**
 * What the shared layer is allowed to know about the food on screen.
 *
 * Notably absent: where any of it came from. A barcode, a label photo, a correction chip
 * and a spoken refinement all arrive here as the same finished view, so no shared code can
 * grow an opinion about precedence -- that stays whole inside whichever door owns it.
 */
export type FoodLensView = {
  /** Names the food in the verdict, the sticky strip and the viewfinder chip. */
  name: string | null;
  /**
   * Whether a food is actually resolved. Distinct from having a name: a barcode in frame
   * that has not resolved yet still puts its digits on the viewfinder chip.
   */
  identified: boolean;
  score: CompassScore | null;
  carveOut: NotScoreableReason | null;
  /** Drives the viewfinder overlay; each door derives it from its own authority stack. */
  badge: LiveScoreBadge;
  /** The identify route found nothing publishable, and named these instead. */
  noMatchCandidates: LiveCandidate[];
  /** True when the route answered "none" -- distinct from having seen nothing yet. */
  noMatch: boolean;
};

export type FoodLensChart = {
  /** A refinement or a first identify is still in flight. */
  pending?: boolean;
  markerRef?: RefObject<HTMLButtonElement | null>;
  /** Opens the domain breakdown. Absent where there is no breakdown to open. */
  onMarkerTap?: () => void;
};

export type FoodLensWhyScore = {
  open: boolean;
  onClose: () => void;
  breakdown: CompassBreakdown | null;
  tier: CompassScore["tier"];
};

/** Scroll the viewfinder back into view, honouring a reduced-motion preference. */
export function scrollToViewfinder(): void {
  const reduced =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
}

/**
 * The viewfinder props that are the same on any mount. Each door spreads these and adds
 * what only it can know: a retry handler, its own trust pill, its own idle copy, and the
 * name it wants on the score badge.
 */
export function sharedViewfinderProps(args: {
  camera: { videoRef: RefObject<HTMLVideoElement | null>; status: CameraStatus };
  view: FoodLensView;
  language: Language;
  sessionStatus: LiveSessionStatus;
}) {
  const { camera, view, language, sessionStatus } = args;
  return {
    cameraStatus: camera.status,
    height: "100%",
    language,
    scanChip: view.name,
    scoreBadge: view.badge,
    scoreBand: view.score?.band,
    scoreFcs: view.score?.fcs,
    scoreTier: view.score?.tier,
    sessionStatus,
    // The pinned voice bar owns the session status inside the shell, so the viewfinder
    // does not also announce it.
    showVoiceStatus: false,
    videoRef: camera.videoRef
  } as const;
}

/**
 * One Food Lens, wearing whichever capabilities its door hands it.
 *
 * This is the layer that made the two surfaces one product: it assembles the shell, builds
 * the two slots whose content is identical on both mounts (the verdict and the domain
 * breakdown), and passes the rest through in the shell's fixed order. It never imports the
 * patient store, never reads the route, and receives a crisis only as a rendered node --
 * all three are enforced by scripts/check-public-door-store-free.mjs on every check.
 */
export function FoodLensExperience({
  language,
  capabilities,
  view,
  loopState,
  onVisibleRatio,
  viewfinder,
  voiceBar,
  whyScore,
  chart,
  slots,
  crisis = null,
  collapsedViewfinder = false,
  voiceBarOffsetPx = 0,
  verdictRegionLabel,
  onSelectCandidate,
  emptyStateChildren,
  wrapper
}: {
  language: Language;
  capabilities: FoodLensCapabilities;
  view: FoodLensView;
  loopState: LiveLoopState;
  onVisibleRatio?: (ratio: number) => void;
  viewfinder: ReactNode;
  voiceBar: ReactNode;
  whyScore: FoodLensWhyScore;
  chart?: FoodLensChart;
  /** Everything the doors build for themselves, in the shell's fixed order. */
  slots: Partial<Record<FoodLensSlot, ReactNode>>;
  crisis?: ReactNode | null;
  collapsedViewfinder?: boolean;
  voiceBarOffsetPx?: number;
  /** The public mount names its result region; the personal one does not need to. */
  verdictRegionLabel?: string;
  onSelectCandidate?: (foodId: string) => void;
  /** A store-backed mount can offer a food you have had before; a store-free one cannot. */
  emptyStateChildren?: ReactNode;
  wrapper?: (children: ReactNode) => ReactNode;
}) {
  const backToCamera = useCallback(() => scrollToViewfinder(), []);

  const verdict = view.carveOut ? (
    <FoodVerdict carveOutReason={view.carveOut} foodName={view.name} language={language} score={null} />
  ) : view.score ? (
    <FoodVerdict carveOutReason={null} foodName={view.name} language={language} score={view.score} />
  ) : view.noMatch || view.noMatchCandidates.length > 0 ? (
    <FoodNoMatch candidates={view.noMatchCandidates} language={language} onSelect={onSelectCandidate} />
  ) : view.identified ? null : (
    <FoodEmptyState language={language} offersSavedPicks={emptyStateChildren !== undefined}>
      {emptyStateChildren}
    </FoodEmptyState>
  );

  // A carve-out has no chart at all. Plotting a point for a food outside the score's range
  // would put a number on screen one line after the product said there is none to give
  // (spec 25 section 6) -- so this rule now holds on both doors, not just the personal one.
  const chartSlot = view.carveOut ? null : view.score ? (
    <NutritionCompass
      foodName={view.identified ? view.name : null}
      language={language}
      markerRef={chart?.markerRef}
      onMarkerTap={chart?.onMarkerTap}
      score={view.score}
      state={chart?.pending ? "pending" : "idle"}
    />
  ) : chart?.pending || view.noMatch || capabilities.chartPlaceholder ? (
    <NutritionCompass
      foodName={null}
      language={language}
      score={null}
      state={chart?.pending ? "pending" : view.noMatch ? "no_match" : "idle"}
    />
  ) : null;

  const shell = (
    <FoodLensShell
      capabilities={capabilities}
      collapsedViewfinder={collapsedViewfinder}
      crisis={crisis}
      foodName={view.identified ? view.name : null}
      foodScore={view.score ? { fcs: view.score.fcs, band: view.score.band } : null}
      language={language}
      loopState={loopState}
      onBackToCamera={backToCamera}
      onVisibleRatio={onVisibleRatio}
      slots={{
        ...slots,
        chart: chartSlot,
        verdict: verdictRegionLabel ? (
          <div aria-label={verdictRegionLabel} className="min-w-0" role="region">
            {verdict}
          </div>
        ) : (
          verdict
        ),
        whyScore: (
          <FoodWhyScore
            breakdown={whyScore.breakdown}
            language={language}
            onClose={whyScore.onClose}
            open={whyScore.open}
            tier={whyScore.tier}
          />
        )
      }}
      viewfinder={viewfinder}
      voiceBar={voiceBar}
      voiceBarOffsetPx={voiceBarOffsetPx}
    />
  );

  return <>{wrapper ? wrapper(shell) : shell}</>;
}
