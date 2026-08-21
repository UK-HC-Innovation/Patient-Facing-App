import type {
  CompassAlternative,
  CompassBand,
  CompassScore,
  CompassTier,
  NotScoreableReason,
  ScoreDomainBreakdown
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
      alternatives: { description: string; fcs: number }[];
      domainBreakdown?: ScoreDomainBreakdown | null;
    };

export function toCompassContext(
  score: CompassScore | null,
  alternatives: CompassAlternative[],
  estimatedDomains: ScoreDomainBreakdown | null = null
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
    domainBreakdown:
      estimatedDomains ??
      (score.domains && score.coverage
        ? { domains: score.domains, coverage: { ...score.coverage, partial: [] } }
        : null),
    alternatives: alternatives.map((alternative) => ({
      description: alternative.description,
      fcs: alternative.fcs
    }))
  };
}
