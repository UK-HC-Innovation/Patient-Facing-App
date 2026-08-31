"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  classifyScoreability,
  computeLabelScore,
  type CompassAlternative,
  type CompassScore,
  type NotScoreableReason
} from "@/domain/food-compass";
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
  options: { passcode?: string; enabled?: boolean } = {}
): CompassScoreState {
  const enabled = options.enabled !== false;

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

  // A package-front identity is display evidence, not a catalogue key. Label-photo
  // foods therefore never feed their name back into fuzzy FNDDS matching, even for
  // alternatives; barcode and explicit catalogue foods retain the existing path.
  const foodName = food?.source === "label_vision" ? null : food?.name ?? null;
  useEffect(() => {
    const id = (requestId.current += 1);
    if (!foodName || !local.score) {
      setAlternatives([]);
      setAlternativesLoading(false);
      return;
    }
    setAlternativesLoading(true);
    void fetch("/api/food/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: foodName, passcode: options.passcode })
    })
      .then((response) => response.json())
      .then((json: unknown) => {
        if (id !== requestId.current) {
          return;
        }
        const match = (json as { match?: { alternatives?: CompassAlternative[] } }).match;
        setAlternatives(match?.alternatives ?? []);
      })
      .catch(() => {
        if (id === requestId.current) {
          setAlternatives([]);
        }
      })
      .finally(() => {
        if (id === requestId.current) {
          setAlternativesLoading(false);
        }
      });
  }, [foodName, local.score, options.passcode]);

  return { ...local, alternatives, alternativesLoading };
}
