// Fuzzy food matching over the published Table S5 descriptions.
//
// Split out from food-compass.ts so the pure scoring engine (and anything a client
// component imports) never pulls minisearch into the bundle. Only the identify API
// route builds an index.

import MiniSearch from "minisearch";
import type { FcsFood } from "./food-compass";

export type FoodMatch = { food: FcsFood; score: number };

export type FoodSearchIndex = {
  search: (query: string, limit?: number) => FoodMatch[];
};

// FNDDS carries catch-all rows that exist for survey coding, not for a person asking
// about a food: "NS as to fat", "other flavors", "NFS". They are legitimate matches but
// they are never the best answer to a bare food name, so their relevance is discounted.
const CATCH_ALL_ROW = /\b(NS as to|NFS|not further specified|other flavou?rs?|other types?|unspecified)\b/i;

// The canonical reference form of a whole food in FNDDS.
const CANONICAL_FORM = /,\s*(raw|no added fat|plain)\b/i;

/**
 * Table S5 descriptions produce exact scoring ties constantly — every "Banana ..." row
 * scores 10.78 for the query "banana" — so text relevance alone leaves the winner to
 * insertion order. This orders the near-ties by published, deterministic properties:
 * least processed first (a bare food name means the food, not a manufactured product of
 * that name), then the canonical form, then the simplest description.
 */
function canonicalRank(food: FcsFood): number[] {
  return [
    CATCH_ALL_ROW.test(food.description) ? 1 : 0,
    food.nova,
    CANONICAL_FORM.test(food.description) ? 0 : 1,
    food.description.length
  ];
}

function compareCanonical(a: FcsFood, b: FcsFood): number {
  const left = canonicalRank(a);
  const right = canonicalRank(b);
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return left[i] - right[i];
    }
  }
  return a.code.localeCompare(b.code);
}

/** Candidates within this fraction of the top score are treated as a tie. */
const TIE_BAND = 0.98;

// FNDDS descriptions are "Head food, qualifiers, qualifiers". BM25 alone favours the
// shortest text, which hands "pizza" to "Pizza rolls" and "Dessert pizza" over the
// "Pizza, cheese ..." family. When the head food IS what the user typed, that is a much
// stronger relevance signal than length, so it is boosted directly.
const HEAD_MATCH_BOOST = 1.6;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function headFood(description: string): string {
  return normalizeText(description.split(",")[0]);
}

// A single prominent food is what the vision prompt returns, so recall matters more than
// precision here: prefix + fuzzy matching catches "doritos" -> "Tortilla chips, nacho
// cheese flavor (Doritos)" and "cesar salad" -> "Caesar salad".
export function buildFoodSearchIndex(foods: FcsFood[]): FoodSearchIndex {
  // Ambiguous (twice-listed) codes share an id, so index the first occurrence only;
  // lookupScore still reports both published values via the range.
  const byCode = new Map<string, FcsFood>();
  for (const food of foods) {
    if (!byCode.has(food.code)) {
      byCode.set(food.code, food);
    }
  }

  const index = new MiniSearch<FcsFood>({
    fields: ["description"],
    storeFields: ["code"],
    idField: "code",
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boostDocument: (id) => (CATCH_ALL_ROW.test(byCode.get(String(id))?.description ?? "") ? 0.85 : 1)
    }
  });
  index.addAll([...byCode.values()]);

  return {
    search(query: string, limit = 10): FoodMatch[] {
      const trimmed = query.trim();
      if (trimmed.length === 0) {
        return [];
      }
      const normalizedQuery = normalizeText(trimmed);
      const hits = index
        .search(trimmed)
        .map((hit) => {
          const food = byCode.get(String(hit.id));
          const boost = food && headFood(food.description) === normalizedQuery ? HEAD_MATCH_BOOST : 1;
          return { food, score: hit.score * boost };
        })
        .filter((hit): hit is FoodMatch => hit.food !== undefined)
        .sort((a, b) => b.score - a.score);

      if (hits.length === 0) {
        return [];
      }

      // Re-order only within the tie band; genuine relevance gaps are left alone.
      const cutoff = hits[0].score * TIE_BAND;
      const tied = hits.filter((hit) => hit.score >= cutoff).sort((a, b) => compareCanonical(a.food, b.food));
      const rest = hits.filter((hit) => hit.score < cutoff);
      return [...tied, ...rest].slice(0, limit);
    }
  };
}

/**
 * Deterministic short-circuit for the identify route: when the top hit leads the runner-up
 * by this margin the disambiguation model call is skipped entirely, which is what keeps the
 * live camera loop cheap and what makes typed scoring work under the mock provider.
 */
export const SHORT_CIRCUIT_MARGIN = 1.35;

export function matchFood(
  index: FoodSearchIndex,
  query: string,
  limit = 10
): { candidates: FoodMatch[]; confident: FcsFood | null } {
  const candidates = index.search(query, limit);
  if (candidates.length === 0) {
    return { candidates, confident: null };
  }
  if (candidates.length === 1) {
    return { candidates, confident: candidates[0].food };
  }
  const [top, runnerUp] = candidates;
  const confident = runnerUp.score > 0 && top.score / runnerUp.score >= SHORT_CIRCUIT_MARGIN ? top.food : null;
  return { candidates, confident };
}
