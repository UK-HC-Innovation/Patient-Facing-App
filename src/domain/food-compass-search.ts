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

// "fried chicken" is not the head food of any row, but "Chicken, ..., fried" is a row
// whose head food the query fully contains, while "Rice, fried, with chicken" is not.
// That asymmetry is the difference between fried chicken and chicken fried rice.
const HEAD_SUBSET_BOOST = 1.35;

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

// ---------------------------------------------------------------------------
// Query rewriting (spec 29 P5)
// ---------------------------------------------------------------------------

/**
 * Regional and brand names Table S5 does not carry, rewritten to the row family that
 * actually describes the food. Applied to the raw query before the index sees it, so
 * every caller of the index gets the same answer.
 */
const QUERY_SYNONYMS: { pattern: RegExp; replacement: string }[] = [
  // Ale-8-One is a Kentucky ginger soda. The only "ale" rows are soft drinks anyway.
  { pattern: /\bale\s*-?\s*8(?:\s*-?\s*one)?\b/gi, replacement: "ginger ale" },
  // The table's only Mountain Dew rows are the AMP energy drinks, which is a different
  // product from the soda someone is holding. There is no "citrus" row; a caffeinated
  // fruit-flavoured soft drink is what the table calls this.
  { pattern: /\bmountain\s+dew\b/gi, replacement: "soft drink, fruit flavored, caffeine containing" },
  { pattern: /\bdumplin['’]?s\b/gi, replacement: "dumplings" },
  // The table has no "arroz con pollo" row, and fuzzy matching hands it a Mexican rice
  // soup. Said in English it lands on the dish itself.
  { pattern: /\barroz\s+con\s+pollo\b/gi, replacement: "rice with chicken" },
  // Appalachian soup beans are a pot of pinto beans, not a canned bean soup. Rewriting to
  // the bare head food keeps "cooked" from pulling in the green-bean-with-pinto-beans row.
  { pattern: /\bsoup\s+beans\b/gi, replacement: "pinto beans" }
];

/** Rewrites regional and brand names to the table's own vocabulary. */
export function expandFoodQuery(query: string): string {
  let expanded = query;
  for (const { pattern, replacement } of QUERY_SYNONYMS) {
    expanded = expanded.replace(pattern, replacement);
  }
  return expanded;
}

// Function words carry no identity, in either language the app speaks.
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "with", "without", "in", "on", "for", "some", "my", "is", "it",
  "this", "that", "to", "at", "from", "as", "de", "con", "y", "el", "la", "los", "las", "al", "en",
  "un", "una", "sin"
]);

function contentTokens(normalized: string): string[] {
  return normalized.split(" ").filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

/** Word-level containment, tolerant of the plural/singular split between query and row. */
function tokenPresent(token: string, words: string[]): boolean {
  return words.some(
    (word) =>
      word === token ||
      (token.length >= 4 && word.startsWith(token)) ||
      (word.length >= 4 && token.startsWith(word))
  );
}

function coveredCount(queryTokens: string[], words: string[]): number {
  return queryTokens.filter((token) => tokenPresent(token, words)).length;
}

/**
 * Rows that are a real answer to some query but almost never to the one that retrieved
 * them: "fried chicken" is not chicken liver, "Mountain Dew" is not an energy drink, and
 * "mashed potatoes with gravy" is not a frozen sirloin dinner. Each demotion is released
 * as soon as the query itself says that word, so someone asking for liver still gets it.
 */
const DEMOTED_ROWS: { row: RegExp; keepWhenQuerySays: RegExp }[] = [
  {
    row: /\b(?:liver|livers|gizzard|gizzards|hearts?|kidneys?|giblets?|tripe|brain)\b/i,
    keepWhenQuerySays: /\b(?:liver|gizzard|heart|kidney|giblet|tripe|brain|organ)/i
  },
  { row: /\bmeatless\b/i, keepWhenQuerySays: /\b(?:meatless|vegan|vegetarian|veggie)\b/i },
  { row: /\bfrozen meal\b/i, keepWhenQuerySays: /\b(?:frozen|tv dinner)\b/i },
  { row: /\benergy drink\b/i, keepWhenQuerySays: /\benergy\b/i },
  { row: /\bAMP\b/, keepWhenQuerySays: /\bamp\b/i },
  // A box of dry mix is not the food people mean by its name; cornbread is the clearest
  // case, where the mix row scores 1 and the home recipe scores 33.
  { row: /\b(?:from|prepared from|dry)\s+mix\b/i, keepWhenQuerySays: /\bmix\b/i }
];

// FNDDS marks a manufacturer product with a trailing, capitalised parenthetical:
// "Cereal (General Mills Cheerios)". A lower-case parenthetical is a qualifier, not a
// brand: "Chicken, leg (drumstick and thigh), fried".
const TRAILING_PARENTHETICAL = /\(([^()]+)\)\s*$/;

function brandParenthetical(description: string): string | null {
  const match = TRAILING_PARENTHETICAL.exec(description);
  if (!match) {
    return null;
  }
  const words = match[1].split(/\s+/).filter((word) => /[a-z]/i.test(word));
  if (words.length === 0) {
    return null;
  }
  return words.every((word) => /^[A-Z0-9]/.test(word)) ? match[1] : null;
}

function isDemoted(food: FcsFood, query: string, queryTokens: string[]): boolean {
  for (const { row, keepWhenQuerySays } of DEMOTED_ROWS) {
    if (row.test(food.description) && !keepWhenQuerySays.test(query)) {
      return true;
    }
  }
  const brand = brandParenthetical(food.description);
  if (brand === null) {
    return false;
  }
  const brandTokens = contentTokens(normalizeText(brand));
  if (brandTokens.length === 0 || brandTokens.some((token) => tokenPresent(token, queryTokens))) {
    return false;
  }
  // The manufacturer is missing from the query, but the product name may not be: nobody
  // types "Big Mac (McDonalds)", and that row is still the right answer to "big mac".
  const withoutBrand = contentTokens(normalizeText(food.description.replace(TRAILING_PARENTHETICAL, "")));
  return coveredCount(queryTokens, withoutBrand) < queryTokens.length;
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
      const expanded = expandFoodQuery(trimmed);
      const normalizedQuery = normalizeText(expanded);
      const queryTokens = contentTokens(normalizedQuery);
      // A one-word query has one word to find. A longer one has to agree with the row on
      // more than a single word, which is what keeps "Bojangles chicken supremes combo"
      // off "Fun Fruits Creme Supremes".
      const minCovered = queryTokens.length >= 3 ? 2 : 1;

      const hits = index
        .search(expanded)
        .map((hit) => {
          const food = byCode.get(String(hit.id));
          if (!food) {
            return null;
          }
          const words = contentTokens(normalizeText(food.description));
          const head = headFood(food.description);
          const headWords = contentTokens(head);
          const boost =
            head === normalizedQuery
              ? HEAD_MATCH_BOOST
              : headWords.length > 0 && headWords.every((token) => tokenPresent(token, queryTokens))
                ? HEAD_SUBSET_BOOST
                : 1;
          return {
            food,
            score: hit.score * boost,
            demoted: isDemoted(food, expanded, queryTokens),
            covered: coveredCount(queryTokens, words)
          };
        })
        .filter((hit): hit is { food: FcsFood; score: number; demoted: boolean; covered: number } => hit !== null)
        // The row has to share the query's own words. Without this a restaurant name the
        // table does not carry retrieves whatever it fuzzy-matched and scores it.
        .filter((hit) => queryTokens.length === 0 || hit.covered >= minCovered)
        .sort((a, b) => (a.demoted === b.demoted ? b.score - a.score : Number(a.demoted) - Number(b.demoted)));

      if (hits.length === 0) {
        return [];
      }

      // Re-order only within the tie band; genuine relevance gaps are left alone. A
      // demoted row never re-enters the band it was pushed out of.
      const leading = hits.filter((hit) => hit.demoted === hits[0].demoted);
      const cutoff = leading[0].score * TIE_BAND;
      const tied = leading.filter((hit) => hit.score >= cutoff).sort((a, b) => compareCanonical(a.food, b.food));
      const rest = [...leading.filter((hit) => hit.score < cutoff), ...hits.filter((hit) => hit.demoted !== hits[0].demoted)];
      return [...tied, ...rest].slice(0, limit).map(({ food, score }) => ({ food, score }));
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

/**
 * Does this row actually describe what was typed? Used by the barcode path, where the
 * product name is the only identity evidence and a loose match would publish the wrong
 * published score under the right barcode.
 */
export function describesQuery(description: string, query: string): boolean {
  const queryTokens = contentTokens(normalizeText(expandFoodQuery(query)));
  if (queryTokens.length === 0) {
    return false;
  }
  const words = contentTokens(normalizeText(description));
  return coveredCount(queryTokens, words) === queryTokens.length;
}
