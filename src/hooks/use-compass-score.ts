"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  classifyScoreability,
  computeLabelScore,
  type CompassAlternative,
  type CompassScore,
  type NotScoreableReason
} from "@/domain/food-compass";
import type { FoodAuthority } from "@/domain/food-authority";
import type { IdentifiedFood } from "@/domain/types";

export type CompassScoreState = {
  score: CompassScore | null;
  carveOut: NotScoreableReason | null;
  alternatives: CompassAlternative[];
  alternativesLoading: boolean;
};

/**
 * Scores a barcode/label food on the client.
 *
 * The scoring engine is pure and carries no data, so the T2 number is computed here with
 * no network call, no model spend and no waiting. Only the "better options" list needs the
 * published table, which is server-only, so that alone is fetched.
 *
 * The food passed in must be the UNSCALED one. Portion edits round nutrition to integers,
 * and a per-100-kcal score computed off rounded values would wobble as the user taps
 * servings up and down — the score is a property of the food, not of how much is on the plate.
 */
export function useCompassScore(
  food: IdentifiedFood | null,
  options: { passcode?: string; enabled?: boolean; authority?: FoodAuthority } = {}
): CompassScoreState {
  const enabled = options.enabled !== false;
  const authority = options.authority;

  const local = useMemo<{ score: CompassScore | null; carveOut: NotScoreableReason | null }>(() => {
    if (!food || !enabled) {
      return { score: null, carveOut: null };
    }
    const labelDerived = food.source === "label_vision";
    const scoreability = classifyScoreability({
      // Package-front text is identity evidence only. It cannot turn otherwise identical
      // confirmed label values into an alcohol/infant/specialized carve-out.
      name: labelDerived ? "" : food.name,
      category: labelDerived ? null : food.category,
      nutrition: food.nutrition
    });
    if (!scoreability.scoreable) {
      return { score: null, carveOut: scoreability.reason };
    }
    if (!food.nutrition || food.nutrition.calories === null) {
      return { score: null, carveOut: null };
    }
    return {
      score: computeLabelScore(food.nutrition, {
        name: food.name,
        category: food.category,
        ingredientText: food.ingredientText,
        allowIdentityHeuristics: !labelDerived
      }),
      carveOut: null
    };
  }, [food, enabled]);

  const [alternatives, setAlternatives] = useState<CompassAlternative[]>([]);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  const requestId = useRef(0);

  // Package names are not catalogue keys. Fuzzy words such as "powder drink mix"
  // can retrieve lemonade for a protein powder, including unrelated alternatives.
  // Keep confirmed package nutrition local until an exact catalogue mapping exists.
  const foodName = food?.source === "label_vision" || food?.source.startsWith("barcode_")
    ? null : food?.name ?? null;
  useEffect(() => {
    const id = (requestId.current += 1);
    if (!foodName || !local.score) {
      setAlternatives([]);
      setAlternativesLoading(false);
      return;
    }
    // Spec 30 R2, finding E12. The request id alone cannot tell that the food this list is
    // about has been replaced by a camera, a barcode or a typed line while it was in flight.
    const requestEpoch = authority?.snapshot() ?? null;
    const stillCurrent = () =>
      id === requestId.current && (requestEpoch === null || authority?.isCurrent(requestEpoch) !== false);
    setAlternativesLoading(true);
    void fetch("/api/food/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: foodName, passcode: options.passcode })
    })
      .then((response) => response.json())
      .then((json: unknown) => {
        if (!stillCurrent()) {
          return;
        }
        const match = (json as { match?: { alternatives?: CompassAlternative[] } }).match;
        setAlternatives(match?.alternatives ?? []);
      })
      .catch(() => {
        if (stillCurrent()) {
          setAlternatives([]);
        }
      })
      .finally(() => {
        if (id === requestId.current) {
          setAlternativesLoading(false);
        }
      });
  }, [authority, foodName, local.score, options.passcode]);

  return { ...local, alternatives, alternativesLoading };
}
