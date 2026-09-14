import type {
  CompassAlternative,
  CompassBand,
  CompassScore,
  CompassTier,
  NoScoreSwapId,
  NotScoreableReason,
  ScoreDomainBreakdown,
  SwapAction,
  SwapState
} from "./food-compass";

/**
 * The Food Compass facts handed to an AI turn — typed, deterministic, and computed before
 * the model is ever called. Nothing here is a request to calculate; the prompt builder
 * closes with "Use the numbers above exactly; do not recompute them."
 */
export type CompassContext =
  | { kind: "carve_out"; reason: NotScoreableReason }
  | {
      kind: "score";
      fcs: number;
      band: CompassBand;
      tier: CompassTier;
      calorieDensityKcalPer100g: number | null;
      calorieDensityEstimated?: boolean;
      /** The same swaps the screen shows, default first (spec 31 R8). */
      alternatives: { description: string; fcs: number; name?: string | null; action?: SwapAction | null }[];
      /** Null for a label estimate, which carries no swap. */
      swapState?: SwapState | null;
      noScoreSwap?: NoScoreSwapId | null;
      domainBreakdown?: ScoreDomainBreakdown | null;
    };

export function toCompassContext(
  score: CompassScore | null,
  alternatives: CompassAlternative[],
  estimatedDomains: ScoreDomainBreakdown | null = null,
  swaps: { state?: SwapState | null; noScoreSwap?: NoScoreSwapId | null } = {}
): CompassContext | null {
  if (!score) {
    return null;
  }
  return {
    kind: "score",
    fcs: score.fcs,
    band: score.band,
    tier: score.tier,
    calorieDensityKcalPer100g: score.calorieDensity.kcalPer100g,
    calorieDensityEstimated: score.calorieDensity.estimate !== undefined,
    domainBreakdown:
      estimatedDomains ??
      (score.domains && score.coverage
        ? { domains: score.domains, coverage: { ...score.coverage, partial: [] } }
        : null),
    alternatives: alternatives.map((alternative) => ({
      description: alternative.description,
      fcs: alternative.fcs,
      name: alternative.displayName?.en ?? null,
      action: alternative.action ?? null
    })),
    swapState: swaps.state ?? null,
    noScoreSwap: swaps.noScoreSwap ?? null
  };
}
