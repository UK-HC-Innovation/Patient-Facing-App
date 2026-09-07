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
  /** Hits the coverage filter rejected, so a miss can still name something (spec 30 R4). */
  rejected?: (query: string, limit?: number) => FoodMatch[];
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
    },

    /**
     * The hits the coverage filter threw away.
     *
     * A typed miss used to answer `candidates: []`, so the "Say one of these instead" chips
     * could not render and the only way forward was to retype (spec 30 R4, A21). These rows
     * were retrieved and then rejected for sharing too few of the query's own words, which
     * is a good reason not to score them and a poor reason to hide them.
     */
    rejected(query: string, limit = 3): FoodMatch[] {
      const trimmed = query.trim();
      if (trimmed.length === 0) {
        return [];
      }
      const expanded = expandFoodQuery(trimmed);
      const queryTokens = contentTokens(normalizeText(expanded));
      const minCovered = queryTokens.length >= 3 ? 2 : 1;
      return index
        .search(expanded)
        .map((hit) => {
          const food = byCode.get(String(hit.id));
          if (!food) return null;
          const words = contentTokens(normalizeText(food.description));
          return { food, score: hit.score, covered: coveredCount(queryTokens, words) };
        })
        .filter((hit): hit is { food: FcsFood; score: number; covered: number } => hit !== null)
        .filter((hit) => queryTokens.length > 0 && hit.covered < minCovered)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ food, score }) => ({ food, score }));
    }
  };
}

// ---------------------------------------------------------------------------
// Reviewed identity (spec 30 R4)
// ---------------------------------------------------------------------------

/**
 * Why a row was published rather than proposed.
 *
 * The rank margin cannot be the gate. Table S5 rows tie constantly, so the margin is 1.00
 * to 1.11 for apple, banana, pinto beans, PB&J, chicken and dumplings, coffee and pizza;
 * only `honey nut cheerios` clears 1.35. Gating on it would ask a question after nearly
 * every input. These four bases say what actually justified the mapping instead.
 */
export type IdentityBasis = "alias" | "head_canonical" | "brand" | "coverage";

/**
 * The reviewed alias table: a normalized query to one row code.
 *
 * Codes checked against src/data/food-compass/fcs2-foods.json on 2026-09-07.
 */
const ALIAS_ROWS: Record<string, string> = {
  // Apple, raw
  manzana: "63101000",
  // Banana, raw
  platano: "63107010",
  banano: "63107010",
  // Cereal (General Mills Cheerios). Plain fails the brand rule because "plain" is the
  // person's word for the absence of a flavour and the row does not carry it.
  "plain cheerios": "57123000"
};

/**
 * The reviewed alias table's other half: a query whose honest answer is a question.
 *
 * Each set is three named rows, in the order they are offered. Nothing here is a default:
 * `frijoles` is pinto, black or refried, and picking one for someone is the mistake this
 * table exists to stop.
 */
const ALIAS_CANDIDATES: Record<string, string[]> = {
  // Pinto / Black / Refried, all from dried with no added fat
  frijoles: ["41104020", "41102020", "41205015"],
  // Whole / reduced fat (2%) / fat free (skim)
  leche: ["11111000", "11112110", "11113000"],
  // Fried with oil / omelet or scrambled / boiled
  huevos: ["31105030", "32104900", "31103000"],
  // Tamale with meat / with chicken / sweet. `tamal` is the Spanish singular of the same
  // word, added because spec 30 P5 requires "es un tamal" to reach these three.
  tamales: ["58103120", "58103130", "53430700"],
  tamale: ["58103120", "58103130", "53430700"],
  tamal: ["58103120", "58103130", "53430700"],
  // Breast skin not eaten / breast skin eaten / thigh skin not eaten
  "pollo asado": ["24122120", "24122110", "24152220"]
};

/** The reference form of a food, which never needs the query to name it. */
const CANONICAL_QUALIFIERS = new Set([
  "raw",
  "plain",
  "fresh",
  "cooked",
  "uncooked",
  "unprepared",
  "no",
  "not",
  "sin",
  "without",
  "ns",
  "nfs",
  "unspecified"
]);

/**
 * Row words that need no support from the query: the canonical qualifiers, plus anything
 * the row itself negates. "Pan Dulce, no topping" is pan dulce; "Chicken, ..., no coating"
 * is still not plain chicken, because wing, skin, eaten, made and oil are not negated.
 */
function canonicalRowTokens(description: string): Set<string> {
  const free = new Set(CANONICAL_QUALIFIERS);
  for (const segment of description.split(",")) {
    let negated = false;
    for (const token of normalizeText(segment).split(" ").filter(Boolean)) {
      if (token === "no" || token === "not" || token === "without" || token === "sin") {
        negated = true;
        continue;
      }
      if (negated) free.add(token);
    }
  }
  return free;
}

/** "no sauce" and "without sauce" are the same claim about a food (spec 30 R4 rule 4). */
function normalizeNegations(text: string): string {
  return text.replace(/\bno\s+/gi, "without ").replace(/\bsin\s+/gi, "without ");
}

function queryContentTokens(query: string): string[] {
  return contentTokens(normalizeText(normalizeNegations(expandFoodQuery(query))));
}

/** The normalized key the alias table is written in. */
export function aliasKey(query: string): string {
  return contentTokens(normalizeText(query)).join(" ");
}

function sameTokenSet(left: string[], right: string[]): boolean {
  return (
    left.length > 0 &&
    left.every((token) => tokenPresent(token, right)) &&
    right.every((token) => tokenPresent(token, left))
  );
}

function tailTokens(description: string): string[] {
  return contentTokens(normalizeText(description.split(",").slice(1).join(" ")));
}

/**
 * Does this row's mapping to this query justify publishing a score?
 *
 * Rules 2 to 4 of spec 30 R4. Rule 1 (the alias table) resolves by code and is applied by
 * the caller; rule 5 is the absence of a shortcut, not a rule of its own -- a lone hit runs
 * through exactly these three like any other.
 */
export function identityBasis(description: string, query: string): IdentityBasis | null {
  const queryTokens = queryContentTokens(query);
  if (queryTokens.length === 0) {
    return null;
  }

  // Rule 0, the reviewed rewrites this table already carried: Ale-8 is a ginger ale and
  // Mountain Dew is a caffeinated fruit-flavoured soft drink, both decided in spec 29.
  // A rewritten query that the row then covers is a reviewed one-to-one name mapping.
  if (expandFoodQuery(query) !== query && describesQuery(description, query)) {
    return "alias";
  }

  const rowTokens = contentTokens(normalizeText(description));
  const free = canonicalRowTokens(description);
  const supported = (token: string) => tokenPresent(token, queryTokens) || free.has(token);

  // Rule 2. The head food IS what was typed, and every qualifier after it is either the
  // canonical form or a word the person said.
  if (sameTokenSet(contentTokens(headFood(description)), queryTokens) && tailTokens(description).every(supported)) {
    return "head_canonical";
  }

  // Rule 3. A manufacturer row whose brand and product words the query covers.
  if (brandParenthetical(description) !== null && describesQuery(description, query)) {
    return "brand";
  }

  // Rule 4. Coverage both ways, with the negation normalizer, so nothing in the row is a
  // detail the person never mentioned.
  if (describesQuery(description, query) && rowTokens.every(supported)) {
    return "coverage";
  }

  return null;
}

/** What the typed branch of the identify route should do with one line. */
export type TypedIdentity =
  | { kind: "alias_row"; code: string; candidates: FoodMatch[] }
  | { kind: "alias_candidates"; codes: string[] }
  | { kind: "row"; basis: IdentityBasis; food: FcsFood; candidates: FoodMatch[] }
  /** Search found rows, none of them justified. Named, unscored, waiting for a tap. */
  | { kind: "proposal"; candidates: FoodMatch[] }
  | { kind: "none"; candidates: FoodMatch[] };

export function resolveTypedIdentity(
  index: FoodSearchIndex,
  query: string,
  options: { limit?: number; bestRow?: boolean } = {}
): TypedIdentity {
  const limit = options.limit ?? 10;
  const key = aliasKey(query);
  const aliasRow = ALIAS_ROWS[key];
  const aliasCandidates = ALIAS_CANDIDATES[key];
  const candidates = index.search(query, limit);

  if (aliasRow) {
    return { kind: "alias_row", code: aliasRow, candidates };
  }
  if (aliasCandidates) {
    return { kind: "alias_candidates", codes: aliasCandidates };
  }
  if (candidates.length === 0) {
    return { kind: "none", candidates: index.rejected?.(query, 3) ?? [] };
  }

  const top = candidates[0].food;
  // A plate component the person already named, or an alternatives lookup for a food that
  // is already confirmed. Both are asking "what row is this", not "which food is this".
  if (options.bestRow) {
    return { kind: "row", basis: "coverage", food: top, candidates };
  }
  const basis = identityBasis(top.description, query);
  return basis ? { kind: "row", basis, food: top, candidates } : { kind: "proposal", candidates };
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
    // Spec 30 R4 rule 5. A lone hit used to be confident by virtue of being alone, which is
    // how `pollo asado` became a Puerto Rican chicken-rice soup and `huevos` became huevos
    // rancheros -- and on the camera path it skipped the disambiguation call as well.
    return { candidates, confident: identityBasis(candidates[0].food.description, query) ? candidates[0].food : null };
  }
  const [top, runnerUp] = candidates;
  const confident = runnerUp.score > 0 && top.score / runnerUp.score >= SHORT_CIRCUIT_MARGIN ? top.food : null;
  return { candidates, confident };
}

/**
 * Does one row cover both sides of every "and" / "y" in this line?
 *
 * Spec 30 R5 step 5. `chicken and dumplings` has a row that covers both sides and is one
 * dish; `pizza and salad` has none and is two foods. Splitting first turned "mac and cheese"
 * into a Big Mac and a slice of cheese (finding E02).
 */
export function coversBothSidesOfConjunctions(description: string, line: string): boolean {
  const sides = line.split(/\s+(?:and|y)\s+/i).map((side) => side.trim()).filter((side) => side.length > 0);
  if (sides.length < 2) {
    return false;
  }
  const words = contentTokens(normalizeText(description));
  return sides.every((side) => {
    const tokens = contentTokens(normalizeText(expandFoodQuery(side)));
    return tokens.length > 0 && coveredCount(tokens, words) === tokens.length;
  });
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
