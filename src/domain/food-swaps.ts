// Swaps: the one practical change offered after a confirmed food (spec 31 R1 to R5).
//
// Deterministic and published-data only. Eligibility, order and every number come from
// Table S5 and the tables below; no model decides what a better option is. The families,
// preferred targets, exclusions and names are spec 31's first cut, proposed 2026-09-14 and
// pending the nutrition lead's and a Spanish reviewer's sign-off (spec 31 section 10).
//
// Pure functions with the data injected. Only the identify route imports this module, so
// none of it reaches a client bundle (spec 31 R13).

import {
  bandForScore,
  publishedCalorieDensity,
  type CalorieDensity,
  type CompassAlternative,
  type FcsFood,
  type FnddsRecord,
  type LocalizedName,
  type NoScoreSwapId,
  type SwapAction,
  type SwapPool,
  type SwapState
} from "./food-compass";

/** A swap must score at least this much higher (spec 30 R10; spec 31 R2 keeps it). */
export const SWAP_THRESHOLD = 10;
const MAX_SWAPS = 3;

type Family = {
  id: string;
  /** WWEIA category names exactly as they appear in fndds-nutrients.json. */
  categories: readonly string[];
  /** Exact Table S5 descriptions offered ahead of the category, in this order, when they clear the threshold. */
  preferred: readonly string[];
};

/**
 * The first families, by eating occasion (spec 31 section 5). Fried mains have no family:
 * their swap is a preparation action on the same food (R4). Hot and cold cereal are kept
 * apart until the nutrition lead says one is a swap for the other.
 */
export const SWAP_FAMILIES: readonly Family[] = [
  {
    id: "ready_to_eat_cereal",
    categories: ["Ready-to-eat cereal, higher sugar (>21.2g/100g)", "Ready-to-eat cereal, lower sugar (=<21.2g/100g)"],
    preferred: ["Cereal (General Mills Cheerios)"]
  },
  {
    id: "hot_cereal",
    categories: ["Oatmeal", "Grits and other cooked cereals"],
    preferred: ["Oatmeal, regular or quick, made with water, no added fat"]
  },
  {
    id: "salty_snacks",
    categories: [
      "Potato chips",
      "Tortilla, corn, other chips",
      "Popcorn",
      "Pretzels/snack mix",
      "Crackers, excludes saltines",
      "Saltine crackers",
      "Nuts and seeds"
    ],
    preferred: ["Popcorn, air-popped, unbuttered"]
  },
  {
    id: "bread",
    categories: ["Yeast breads", "Rolls and buns", "Bagels and English muffins", "Tortillas", "Biscuits, muffins, quick breads"],
    preferred: ["Bread, whole wheat"]
  },
  {
    id: "rice_and_grains",
    categories: ["Rice", "Pasta, noodles, cooked grains"],
    preferred: ["Rice, brown, cooked, no added fat"]
  },
  {
    id: "starchy_sides",
    categories: [
      "French fries and other fried white potatoes",
      "Mashed potatoes and white potato mixtures",
      "White potatoes, baked or boiled",
      "Other starchy vegetables",
      "Corn"
    ],
    // "addded" is the table's own spelling of that row.
    preferred: ["Potato, baked, peel eaten", "Potato, boiled, from fresh, peel eaten, no addded fat"]
  }
];

/**
 * Sugar-sweetened drinks take a swap with no score (R3). Every scored Tea row carries sugar
 * or milk; the one that does not, hibiscus at 0 kcal, never reaches this code because the
 * route answers rows under 5 kcal per 100 g as not scored.
 */
const SUGAR_SWEETENED_CATEGORIES: ReadonlySet<string> = new Set([
  "Soft drinks",
  "Fruit drinks",
  "Sport and energy drinks",
  "Diet sport and energy drinks",
  "Other diet drinks",
  "Flavored or carbonated water",
  "Enhanced or fortified water",
  "Tea"
]);

/** A WWEIA bucket of mixes, powders and "for use with" rows. Never a pool (R1). */
const NOT_A_POOL = "Not included in a food category";

type ReviewedName = LocalizedName & { recipe?: LocalizedName };

/**
 * Short names for rows that are common swap targets, keyed by exact Table S5 description.
 * A row with no entry shows its own description, in both languages (R4). `recipe` is the
 * search text for the one recipe link on the default swap (R10).
 */
export const SWAP_DISPLAY_NAMES: Readonly<Record<string, ReviewedName>> = {
  "Cereal (General Mills Cheerios)": { en: "Cheerios", es: "Cheerios" },
  "Cereal (Uncle Sam)": { en: "Uncle Sam cereal", es: "Cereal Uncle Sam" },
  "Oatmeal, regular or quick, made with water, no added fat": {
    en: "Oatmeal made with water",
    es: "Avena hecha con agua",
    recipe: { en: "oatmeal", es: "avena" }
  },
  "Oat bran cereal, cooked, no added fat": { en: "Oat bran cereal", es: "Cereal de salvado de avena" },
  "Popcorn, air-popped, unbuttered": {
    en: "Air-popped popcorn",
    es: "Palomitas de maíz naturales",
    recipe: { en: "air-popped popcorn", es: "palomitas de maíz naturales" }
  },
  "Bread, whole wheat": { en: "Whole wheat bread", es: "Pan integral", recipe: { en: "whole wheat bread", es: "pan integral" } },
  "Bread, whole wheat, 100%": {
    en: "100% whole wheat bread",
    es: "Pan 100% integral",
    recipe: { en: "whole wheat bread", es: "pan integral" }
  },
  "Tortilla, whole wheat": {
    en: "Whole wheat tortilla",
    es: "Tortilla integral",
    recipe: { en: "whole wheat tortillas", es: "tortillas integrales" }
  },
  "Rice, brown, cooked, no added fat": { en: "Brown rice", es: "Arroz integral", recipe: { en: "brown rice", es: "arroz integral" } },
  "Spaghetti, cooked, whole wheat, fat not added in cooking": {
    en: "Whole wheat spaghetti",
    es: "Espagueti integral",
    recipe: { en: "whole wheat spaghetti", es: "espagueti integral" }
  },
  "Spaghetti, cooked, whole wheat, fat added in cooking": {
    en: "Whole wheat spaghetti",
    es: "Espagueti integral",
    recipe: { en: "whole wheat spaghetti", es: "espagueti integral" }
  },
  "Potato, baked, peel eaten": {
    en: "Baked potato with the skin",
    es: "Papa al horno con cáscara",
    recipe: { en: "baked potato", es: "papa al horno" }
  },
  "Potato, boiled, from fresh, peel eaten, no addded fat": {
    en: "Boiled potato with the skin",
    es: "Papa hervida con cáscara",
    recipe: { en: "boiled potatoes", es: "papas hervidas" }
  },
  "Sweet potato, baked, peel eaten, no added fat": {
    en: "Baked sweet potato",
    es: "Camote al horno",
    recipe: { en: "baked sweet potato", es: "camote al horno" }
  },
  "Sweet potato fries, from fresh, baked": {
    en: "Baked sweet potato fries",
    es: "Papas de camote al horno",
    recipe: { en: "baked sweet potato fries", es: "papas de camote al horno" }
  },
  "Catfish, baked or broiled, no added fat": { en: "Baked catfish", es: "Bagre al horno", recipe: { en: "baked catfish", es: "bagre al horno" } },
  "Catfish, baked or broiled, made with cooking spray": {
    en: "Baked catfish",
    es: "Bagre al horno",
    recipe: { en: "baked catfish", es: "bagre al horno" }
  },
  "Fish, NS as to type, baked or broiled, no added fat": {
    en: "Baked fish",
    es: "Pescado al horno",
    recipe: { en: "baked fish", es: "pescado al horno" }
  },
  "Chicken, breast, roasted, broiled, or baked, skin not eaten": {
    en: "Roasted chicken breast, no skin",
    es: "Pechuga de pollo al horno, sin piel",
    recipe: { en: "baked chicken breast", es: "pechuga de pollo al horno" }
  },
  "Chicken, drumstick, roasted, broiled, or baked, skin not eaten": {
    en: "Roasted drumstick, no skin",
    es: "Pierna de pollo al horno, sin piel",
    recipe: { en: "baked chicken drumsticks", es: "piernas de pollo al horno" }
  },
  "Chicken, thigh, roasted, broiled, or baked, skin not eaten": {
    en: "Roasted chicken thigh, no skin",
    es: "Muslo de pollo al horno, sin piel",
    recipe: { en: "baked chicken thighs", es: "muslos de pollo al horno" }
  },
  "Chicken fillet, grilled": { en: "Grilled chicken", es: "Pollo a la parrilla", recipe: { en: "grilled chicken", es: "pollo a la parrilla" } },
  "Pizza, cheese and vegetables, whole wheat thin crust": {
    en: "Veggie pizza, whole wheat thin crust",
    es: "Pizza de verduras con masa integral delgada",
    recipe: { en: "whole wheat veggie pizza", es: "pizza de verduras integral" }
  },
  "Milk, fat free (skim)": { en: "Fat-free milk", es: "Leche descremada" },
  "Coffee, Latte, nonfat": { en: "Nonfat latte", es: "Latte con leche descremada" }
};

// ---------------------------------------------------------------------------
// Fat wording
// ---------------------------------------------------------------------------

const NO_ADDED_FAT = /\b(?:no added fat|no addded fat|fat not added(?: in cooking)?|no fat added|without (?:added )?fat)\b/i;
// "NS as to fat added in cooking" is unknown; "fat added, NS as to fat type" is added.
const FAT_UNKNOWN = /\bNS as to (?:type of )?fat(?: added(?: in cooking)?)?\b(?![a-z ]*type)/i;
const FAT_ADDED =
  /\b(?:fat added(?: in cooking)?|made with (?:[a-z-]+ ){0,3}(?:oil|butter|margarine|lard|shortening|drippings|fat)|cooked with (?:[a-z-]+ ){0,3}(?:oil|butter|margarine|lard|shortening|fat)|with (?:butter|margarine|oil)|fried in (?:[a-z-]+ ){0,2}(?:oil|butter|lard|fat))\b/i;
const FAT_PHRASES = [NO_ADDED_FAT, FAT_UNKNOWN, FAT_ADDED, /\bmade with cooking spray\b/i, /\bNS as to fat type\b/i].map(
  (pattern) => new RegExp(pattern.source, "gi")
);

type FatState = "none" | "unknown" | "added" | "unspecified";

function fatState(description: string): FatState {
  if (NO_ADDED_FAT.test(description)) return "none";
  if (FAT_UNKNOWN.test(description)) return "unknown";
  if (FAT_ADDED.test(description)) return "added";
  return "unspecified";
}

/** R2: a swap that only adds fat or oil is never offered. */
function addsFat(current: string, candidate: string): boolean {
  return fatState(candidate) === "added" && fatState(current) !== "added";
}

// ---------------------------------------------------------------------------
// Description reading
// ---------------------------------------------------------------------------

// Words that carry no food identity; dropped before counting shared words.
const DESCRIPTION_STOPWORDS = new Set([
  "with", "and", "or", "no", "not", "added", "fat", "from", "the", "as", "to", "ns", "nfs",
  "made", "cooked", "fresh", "type", "other", "in", "on", "of", "for", "its", "any", "all"
]);

function contentTokens(description: string): Set<string> {
  return new Set(
    description
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !DESCRIPTION_STOPWORDS.has(token))
  );
}

function sharedTokenCount(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const token of b) {
    if (a.has(token)) count += 1;
  }
  return count;
}

/** "Chicken, wing, fried" and "Cereal (General Mills Cheerios)" read as "chicken" and "cereal". */
function headOf(description: string): string {
  return description.split(",")[0].replace(/\([^()]*\)\s*$/, "").trim().toLowerCase();
}

const QUALIFIER_STOPWORDS = new Set(["with", "and", "or", "the", "a", "an", "of", "in", "on", "as", "to", "ns", "nfs", "cooked", "made", "type", "from"]);

/**
 * Words after the head food, for comparing two rows of one food. Fat wording goes first,
 * because it never makes two rows different foods on its own; a negation stays joined to
 * its word, because "skin eaten" and "skin not eaten" are different foods.
 */
function qualifierWords(description: string): string[] {
  const comma = description.indexOf(",");
  const parenthetical = /\(([^()]*)\)\s*$/.exec(description)?.[1] ?? "";
  let tail = (comma >= 0 ? description.slice(comma + 1) : parenthetical).toLowerCase();
  for (const phrase of FAT_PHRASES) tail = tail.replace(phrase, " ");
  return tail
    .replace(/\b(no|not|without)\s+([a-z]+)/g, "$1_$2")
    .replace(/[^a-z0-9_]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 0 && !QUALIFIER_STOPWORDS.has(word));
}

function sameWordSet(left: string[], right: string[]): boolean {
  const a = new Set(left);
  const b = new Set(right);
  return a.size === b.size && [...a].every((word) => b.has(word));
}

/** A manufacturer row ends in a capitalised parenthetical: "Cereal (General Mills Cheerios)". */
function brandWords(description: string): string[] | null {
  const match = /\(([^()]+)\)\s*$/.exec(description);
  if (!match) return null;
  const words = match[1].split(/\s+/).filter((word) => /[a-z]/i.test(word));
  return words.length > 0 && words.every((word) => /^[A-Z0-9]/.test(word)) ? words.map((word) => word.toLowerCase()) : null;
}

/** Honey Nut Cheerios to Cheerios: the same product line with fewer words in its name. */
function isLineSibling(current: string, candidate: string): boolean {
  const a = brandWords(current);
  const b = brandWords(candidate);
  if (!a || !b || headOf(current) !== headOf(candidate)) return false;
  return b.length < a.length && b.every((word) => a.includes(word));
}

// ---------------------------------------------------------------------------
// Preparation actions (R4)
// ---------------------------------------------------------------------------

const FRIED = /\b(?:fried|deep[- ]fried|battered|breaded|tempura)\b/i;
const DRY_HEAT = /\b(?:baked|broiled|grilled|roasted|steamed|poached|boiled|braised)\b/i;
const SKIN_EATEN = /\bskin(?:\/coating)? eaten\b/i;
const SKIN_NOT_EATEN = /\bskin(?:\/coating)? not eaten\b/i;
const WHITE = /\bwhite\b/i;
const WHOLE_GRAIN = /\b(?:whole wheat|whole grain|whole-grain|brown|wild|100% whole)\b/i;
const SWEETENED = /\b(?:pre-?sweetened|presweetened|sweetened|with sugar|frosted)\b/i;
const UNSWEETENED = /\b(?:unsweetened|no sugar added|sugar[- ]free|without sugar)\b/i;
const LOWER_SODIUM = /\b(?:reduced sodium|low sodium|no salt added|lower sodium)\b/i;

// The words each change is allowed to touch. Everything else has to match.
const ACTION_WORDS: Readonly<Record<SwapAction, ReadonlySet<string>>> = {
  bake: new Set([
    "fried", "deep", "battered", "breaded", "tempura", "coated", "coating", "no_coating",
    "baked", "broiled", "grilled", "roasted", "steamed", "poached", "boiled", "braised"
  ]),
  skin_off: new Set(["skin", "eaten", "not_eaten", "coating"]),
  no_added_fat: new Set<string>(),
  whole_grain: new Set(["white", "whole", "wheat", "grain", "brown", "wild", "100"]),
  lower_sodium: new Set(["reduced", "low", "lower", "sodium", "salt", "no_salt", "added"]),
  unsweetened: new Set(["sweetened", "unsweetened", "pre", "presweetened", "sugar", "free", "without_sugar", "no_sugar", "added", "frosted"])
};

function onlyDiffersBy(current: string, candidate: string, action: SwapAction): boolean {
  const keep = (words: string[]) => words.filter((word) => !ACTION_WORDS[action].has(word));
  return sameWordSet(keep(qualifierWords(current)), keep(qualifierWords(candidate)));
}

/** One recognized change between two rows of the same food, or null. */
function detectAction(current: FcsFood, candidate: FcsFood): SwapAction | null {
  if (headOf(current.description) !== headOf(candidate.description)) return null;
  const c = current.description;
  const d = candidate.description;
  const tries: [SwapAction, boolean][] = [
    ["bake", FRIED.test(c) && !FRIED.test(d) && DRY_HEAT.test(d)],
    ["skin_off", SKIN_EATEN.test(c) && SKIN_NOT_EATEN.test(d)],
    ["no_added_fat", fatState(c) === "added" && fatState(d) === "none"],
    ["whole_grain", WHITE.test(c) && !WHOLE_GRAIN.test(c) && WHOLE_GRAIN.test(d)],
    ["lower_sodium", !LOWER_SODIUM.test(c) && LOWER_SODIUM.test(d)],
    ["unsweetened", SWEETENED.test(c) && UNSWEETENED.test(d)]
  ];
  for (const [action, applies] of tries) {
    if (applies && onlyDiffersBy(c, d, action)) return action;
  }
  return null;
}

// The table lists one food under several codes from different survey years: grits with
// cheese scores 35 under one and 45 under another. Survey wording never makes a swap (R2).
const SURVEY_WORDS = new Set([
  "cooked", "regular", "quick", "instant", "corn", "hominy", "ns", "as", "to", "nfs", "further",
  "specified", "home", "recipe", "purchased", "bakery", "at"
]);

function sameFood(current: FcsFood, candidate: FcsFood): boolean {
  if (headOf(current.description) !== headOf(candidate.description)) return false;
  const keep = (words: string[]) => words.filter((word) => !SURVEY_WORDS.has(word));
  return sameWordSet(keep(qualifierWords(current.description)), keep(qualifierWords(candidate.description)));
}

// ---------------------------------------------------------------------------
// Exclusions (R1)
// ---------------------------------------------------------------------------

const TOPPING_ROW = /^topping from\b/i;
const ORGAN_MEAT =
  /\b(?:liver|livers|gizzards?|giblets|kidneys?|tripe|brains?|chitterlings|variety meats)\b|\b(?:chicken|beef|pork|turkey|lamb|veal) hearts?\b/i;
const SUBSTITUTE = /\b(?:substitute|cereal beverage)\b/i;
const RAW = /\braw\b/i;
const RAW_PROTEIN_GROUPS = new Set(["5000_MPE", "5800_Seafood"]);
const CATCH_ALL = /\b(?:NFS|NS as to|not further specified)\b/i;

function excludedTarget(current: FcsFood, candidate: FcsFood, candidateCategory: string | null): boolean {
  const c = current.description;
  const d = candidate.description;
  if (TOPPING_ROW.test(d)) return true;
  if (ORGAN_MEAT.test(d) && !ORGAN_MEAT.test(c)) return true;
  if (SUBSTITUTE.test(d) && !SUBSTITUTE.test(c)) return true;
  if (RAW.test(d) && RAW_PROTEIN_GROUPS.has(candidate.group) && !RAW.test(c)) return true;
  return candidateCategory === NOT_A_POOL;
}

function isSugarSweetened(food: FcsFood, category: string | null): boolean {
  if (category !== null && SUGAR_SWEETENED_CATEGORIES.has(category)) return true;
  return category === "Coffee" && SWEETENED.test(food.description);
}

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

export type SwapIndex = {
  /** A row's WWEIA category, or the one its head food's rows carry (R1, pre-2017 rows). */
  categoryOf: (food: FcsFood) => string | null;
  byCategory: ReadonlyMap<string, readonly FcsFood[]>;
  byHeadGroup: ReadonlyMap<string, readonly FcsFood[]>;
  byDescription: ReadonlyMap<string, FcsFood>;
  familyByCategory: ReadonlyMap<string, Family>;
  nutrients: Record<string, FnddsRecord | undefined>;
};

// A pre-2017 row takes its head food's category when at least 60% of at least two rows agree.
const INHERIT_MIN_ROWS = 2;
const INHERIT_SHARE = 0.6;

const indexCache = new WeakMap<readonly FcsFood[], SwapIndex>();

function headGroupKey(food: FcsFood): string {
  return `${food.group}|${headOf(food.description)}`;
}

export function swapIndexFor(foods: readonly FcsFood[], nutrients: Record<string, FnddsRecord | undefined>): SwapIndex {
  const cached = indexCache.get(foods);
  if (cached) return cached;

  const rows = foods.filter((food) => !food.ambiguous);
  const ownCategory = (food: FcsFood) => nutrients[food.code]?.wweia ?? null;
  const counts = new Map<string, Map<string, number>>();
  const byHeadGroup = new Map<string, FcsFood[]>();
  const byDescription = new Map<string, FcsFood>();
  for (const food of rows) {
    const key = headGroupKey(food);
    const group = byHeadGroup.get(key) ?? [];
    group.push(food);
    byHeadGroup.set(key, group);
    if (!byDescription.has(food.description)) byDescription.set(food.description, food);
    const category = ownCategory(food);
    if (category) {
      const tally = counts.get(key) ?? new Map<string, number>();
      tally.set(category, (tally.get(category) ?? 0) + 1);
      counts.set(key, tally);
    }
  }

  const inherited = new Map<string, string | null>();
  const categoryOf = (food: FcsFood): string | null => {
    const own = ownCategory(food);
    if (own) return own;
    const memo = inherited.get(food.code);
    if (memo !== undefined) return memo;
    const tally = counts.get(headGroupKey(food));
    let result: string | null = null;
    if (tally) {
      const total = [...tally.values()].reduce((sum, n) => sum + n, 0);
      const [best, n] = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      if (total >= INHERIT_MIN_ROWS && n / total >= INHERIT_SHARE) result = best;
    }
    inherited.set(food.code, result);
    return result;
  };

  const byCategory = new Map<string, FcsFood[]>();
  for (const food of rows) {
    const category = categoryOf(food);
    if (!category) continue;
    const list = byCategory.get(category) ?? [];
    list.push(food);
    byCategory.set(category, list);
  }

  const familyByCategory = new Map<string, Family>();
  for (const family of SWAP_FAMILIES) {
    for (const category of family.categories) familyByCategory.set(category, family);
  }

  const index: SwapIndex = { categoryOf, byCategory, byHeadGroup, byDescription, familyByCategory, nutrients };
  indexCache.set(foods, index);
  return index;
}

// ---------------------------------------------------------------------------
// The finder
// ---------------------------------------------------------------------------

export type SwapResult = {
  state: SwapState;
  noScoreSwap: NoScoreSwapId | null;
  /** Published-row swaps, default first, at most three. After a no-score swap they are "more". */
  alternatives: CompassAlternative[];
};

const POOL_RANK: Readonly<Record<SwapPool, number>> = { line: 0, action: 1, preferred: 2, category: 3, family: 4 };

type Found = { food: FcsFood; pool: SwapPool; action: SwapAction | null; order: number };

function compareDensity(left: CalorieDensity, right: CalorieDensity): number {
  // An observed density outranks a cohort estimate, as the old list's tie-break did.
  const provenance = Number(left.estimate !== undefined) - Number(right.estimate !== undefined);
  if (provenance !== 0) return provenance;
  const a = left.kcalPer100g;
  const b = right.kcalPer100g;
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function collapseKey(description: string): string {
  let key = description.toLowerCase();
  for (const phrase of FAT_PHRASES) key = key.replace(phrase, " ");
  return key
    .replace(/\bns as to [a-z ]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toAlternative(entry: Found, index: SwapIndex, isDefault: boolean): CompassAlternative {
  const food = entry.food;
  const name = SWAP_DISPLAY_NAMES[food.description];
  return {
    code: food.code,
    description: food.description,
    fcs: food.fcs2,
    band: bandForScore(food.fcs2),
    calorieDensity: publishedCalorieDensity(food, index.nutrients[food.code] ?? null),
    pool: entry.pool,
    action: entry.action,
    displayName: name ? { en: name.en, es: name.es } : null,
    recipeQuery:
      isDefault && name?.recipe ? { en: `${name.recipe.en} recipe`, es: `receta de ${name.recipe.es}` } : null
  };
}

/**
 * The swap, or the line that stands in for one, for a confirmed published row.
 *
 * Pools in order: a product-line sibling, a preparation action on the same food, the
 * family's preferred targets, the row's own WWEIA category, then the family's other
 * categories. There is no food-group fallback: it is how fried chicken used to reach
 * chicken liver (spec 31 E04).
 */
export function findSwaps(food: FcsFood, index: SwapIndex): SwapResult {
  const category = index.categoryOf(food);
  const family = category ? index.familyByCategory.get(category) ?? null : null;
  const sugarSweetened = isSugarSweetened(food, category);
  const found = new Map<string, Found>();
  let higherExists = false;

  const consider = (candidate: FcsFood, pool: SwapPool, action: SwapAction | null = null, order = 0) => {
    if (candidate.ambiguous || candidate.code === food.code || candidate.fcs2 <= food.fcs2) return;
    const candidateCategory = index.categoryOf(candidate);
    if (excludedTarget(food, candidate, candidateCategory)) return;
    const kcal = index.nutrients[candidate.code]?.kcal;
    if (kcal !== null && kcal !== undefined && kcal < 5) return;
    if (sugarSweetened && isSugarSweetened(candidate, candidateCategory)) return;
    // Frying already carries fat, so "bake it instead" may name a row baked with oil.
    if (action !== "bake" && addsFat(food.description, candidate.description)) return;
    if (pool !== "action" && sameFood(food, candidate)) return;
    higherExists = true;
    if (candidate.fcs2 < food.fcs2 + SWAP_THRESHOLD) return;
    const previous = found.get(candidate.code);
    if (!previous || POOL_RANK[pool] < POOL_RANK[previous.pool]) {
      found.set(candidate.code, { food: candidate, pool, action, order });
    }
  };

  for (const candidate of index.byHeadGroup.get(headGroupKey(food)) ?? []) {
    if (isLineSibling(food.description, candidate.description)) {
      consider(candidate, "line");
      continue;
    }
    const action = detectAction(food, candidate);
    if (action) consider(candidate, "action", action);
  }
  if (family) {
    family.preferred.forEach((description, position) => {
      const row = index.byDescription.get(description);
      if (row) consider(row, "preferred", null, position);
    });
  }
  if (category && category !== NOT_A_POOL) {
    for (const candidate of index.byCategory.get(category) ?? []) consider(candidate, "category");
  }
  if (family) {
    for (const other of family.categories) {
      if (other === category) continue;
      for (const candidate of index.byCategory.get(other) ?? []) consider(candidate, "family");
    }
  }

  const foodTokens = contentTokens(food.description);
  const currentFat = fatState(food.description);
  const preferred = new Set(family?.preferred ?? []);
  const overlapCache = new Map<string, number>();
  const overlap = (candidate: FcsFood) => {
    let value = overlapCache.get(candidate.code);
    if (value === undefined) {
      value = sharedTokenCount(foodTokens, contentTokens(candidate.description));
      overlapCache.set(candidate.code, value);
    }
    return value;
  };
  const density = (candidate: FcsFood) => publishedCalorieDensity(candidate, index.nutrients[candidate.code] ?? null);

  const ordered = [...found.values()].sort((a, b) => {
    if (a.pool !== b.pool) return POOL_RANK[a.pool] - POOL_RANK[b.pool];
    if (a.pool === "preferred" && a.order !== b.order) return a.order - b.order;
    if (a.pool === "action") {
      // Within one kind of change: the family's preferred row, then the row that keeps the
      // current fat wording (brown rice with no added fat beats wild rice, fat unknown),
      // then the higher score.
      const byPreference = Number(!preferred.has(a.food.description)) - Number(!preferred.has(b.food.description));
      if (byPreference !== 0) return byPreference;
      const byFat = Number(fatState(a.food.description) !== currentFat) - Number(fatState(b.food.description) !== currentFat);
      if (byFat !== 0) return byFat;
      if (a.food.fcs2 !== b.food.fcs2) return b.food.fcs2 - a.food.fcs2;
    }
    const catchAll = Number(CATCH_ALL.test(a.food.description)) - Number(CATCH_ALL.test(b.food.description));
    if (catchAll !== 0) return catchAll;
    const shared = overlap(b.food) - overlap(a.food);
    if (shared !== 0) return shared;
    if (a.food.fcs2 !== b.food.fcs2) return b.food.fcs2 - a.food.fcs2;
    const byDensity = compareDensity(density(a.food), density(b.food));
    if (byDensity !== 0) return byDensity;
    return a.food.description.localeCompare(b.food.description);
  });

  // One entry per food, and one per action: three rows that differ only in fat wording,
  // or three ways to take the skin off, are one suggestion.
  const picked: Found[] = [];
  const seenFoods = new Set<string>();
  const seenActions = new Set<SwapAction>();
  for (const entry of ordered) {
    const key = collapseKey(entry.food.description);
    if (seenFoods.has(key) || (entry.action && seenActions.has(entry.action))) continue;
    seenFoods.add(key);
    if (entry.action) seenActions.add(entry.action);
    picked.push(entry);
    if (picked.length === MAX_SWAPS) break;
  }

  const alternatives = picked.map((entry, position) => toAlternative(entry, index, position === 0 && !sugarSweetened));
  const state: SwapState = sugarSweetened
    ? "no_score_swap"
    : alternatives.length > 0
      ? "swap"
      : food.fcs2 >= 70
        ? "affirm"
        : higherExists
          ? "similar"
          : "none_higher";

  return {
    state,
    noScoreSwap: sugarSweetened ? (category === "Coffee" ? "black_coffee" : "water_or_unsweetened_tea") : null,
    alternatives
  };
}

/** R3: Food Compass excludes foods under 5 kcal per 100 g, even where Table S5 lists a score. */
export function belowFiveKcal(nutrients: FnddsRecord | null): boolean {
  return nutrients !== null && nutrients.kcal !== null && nutrients.kcal < 5;
}
