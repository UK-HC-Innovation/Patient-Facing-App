import type { Language } from "@/i18n/strings";

export type SpokenFoodSize = "personal" | "small" | "medium" | "regular" | "large" | "extra large" | "family";

export type FoodOrderIntent = {
  kind: "food_order";
  originalText: string;
  restaurant: string | null;
  item: string;
  toppings: string[];
  size: string | null;
  crust: string | null;
  matchQuery: string;
};

export type FoodMatchProvenance = {
  kind: "published_closest_match";
  exact: false;
  matchedAs: string;
  unmatchedDetails: string[];
  note: string;
};

const ORDER_PREFIXES = [
  /^(?:(?:i|we)\s+(?:am|are)\s+|(?:i|we)['’](?:m|re)\s+)(?:ordering|getting|having|eating|buying)\s+/i,
  /^(?:i(?:['’]d| would) like|i want)\s+(?:to\s+)?(?:order|get|have)?\s*/i,
  /^(?:can|could|should|would)\s+(?:i|we)\s+(?:order|get|have)\s+/i,
  /^(?:ordering|order|getting|get|having|have|eating|eat|buying|buy)\s+/i
];

const RESTAURANT_SUFFIX = /\s+(?:from|at)\s+([a-z0-9][a-z0-9&.'’\-\s]*?)[.!?]*$/i;
const CONVERSATIONAL_RESTAURANT =
  /\b(?:this|it)\s+(?:came|comes|is|was)\s+from\s+([a-z0-9][a-z0-9&.'’\-\s]*?)(?=[.!?](?:\s|$)|$)/i;

const TOPPINGS = [
  { name: "pepperoni", pattern: /\bpepperoni\b/i },
  { name: "sausage", pattern: /\bsausage\b/i },
  { name: "bacon", pattern: /\bbacon\b/i },
  { name: "ham", pattern: /\bham\b/i },
  { name: "beef", pattern: /\bbeef\b/i },
  { name: "chicken", pattern: /\bchicken\b/i },
  { name: "mushroom", pattern: /\bmushrooms?\b/i },
  { name: "onion", pattern: /\bonions?\b/i },
  { name: "pepper", pattern: /\bpeppers?\b/i },
  { name: "olive", pattern: /\bolives?\b/i },
  { name: "pineapple", pattern: /\bpineapple\b/i },
  { name: "vegetables", pattern: /\b(?:vegetable|veggie)s?\b/i }
] as const;

const MEAT_TOPPINGS = new Set(["pepperoni", "sausage", "bacon", "ham", "beef", "chicken"]);
const VEGETABLE_TOPPINGS = new Set(["mushroom", "onion", "pepper", "olive", "vegetables"]);

const RESTAURANT_ALIASES: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /^papa\s+john['’]?s$/i, name: "Papa John's" },
  { pattern: /^domino['’]?s$/i, name: "Domino's" },
  { pattern: /^pizza\s+hut$/i, name: "Pizza Hut" }
];

const RESTAURANT_MENTIONS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\bpapa\s+john['’]?s\b/i, name: "Papa John's" },
  { pattern: /\bdomino['’]?s\b/i, name: "Domino's" },
  { pattern: /\bpizza\s+hut\b/i, name: "Pizza Hut" }
];

function canonicalRestaurant(value: string): string {
  const trimmed = value.trim().replace(/[.!?]+$/g, "");
  return RESTAURANT_ALIASES.find((alias) => alias.pattern.test(trimmed))?.name ?? trimmed;
}

function stripOrderPrefix(value: string): { itemText: string; hadOrderPrefix: boolean } {
  for (const prefix of ORDER_PREFIXES) {
    if (prefix.test(value)) {
      return {
        itemText: value.replace(prefix, "").replace(/^(?:a|an|the|some|one)\s+/i, "").trim(),
        hadOrderPrefix: true
      };
    }
  }
  return { itemText: value.trim(), hadOrderPrefix: false };
}

function stripConversationalFoodLead(value: string): string {
  return value
    .replace(/^[\s,.!?;:]+/, "")
    .replace(/^(?:(?:and\s+)?(?:it|this)(?:\s+is|['’]s)\s+)(?:a|an|the|some)?\s*/i, "")
    .trim();
}

function extractCrust(value: string): string | null {
  const cases: Array<{ pattern: RegExp; crust: string }> = [
    { pattern: /\bstuffed(?:[- ]crust)?\b/i, crust: "stuffed" },
    { pattern: /\bthin(?:[- ]crust)?\b/i, crust: "thin" },
    { pattern: /\bmedium\s+crust\b/i, crust: "medium" },
    { pattern: /\bthick(?:[- ]crust)?\b/i, crust: "thick" },
    { pattern: /\bpan(?:[- ]style)?(?:\s+crust)?\b/i, crust: "pan" },
    { pattern: /\boriginal(?:\s+crust)?\b/i, crust: "original" }
  ];
  return cases.find((entry) => entry.pattern.test(value))?.crust ?? null;
}

export function parseSpokenSize(value: string, language: Language): SpokenFoodSize | null {
  const patterns: Array<{ size: SpokenFoodSize; pattern: RegExp }> =
    language === "es"
      ? [
          { size: "extra large", pattern: /\b(?:extra[- ]?grande|extra[- ]?grandes|xl)\b/i },
          { size: "family", pattern: /\b(?:tamano\s+familiar|tamaño\s+familiar|familiar)\b/i },
          { size: "personal", pattern: /\b(?:personal|individual)\b/i },
          { size: "small", pattern: /\bpeque(?:n|ñ)[oa]s?\b/i },
          { size: "medium", pattern: /\bmedian[oa]s?\b/i },
          { size: "regular", pattern: /\b(?:regular|normal)\b/i },
          { size: "large", pattern: /\bgrandes?\b/i }
        ]
      : [
          { size: "extra large", pattern: /\b(?:extra[- ]?large|xl)\b/i },
          { size: "family", pattern: /\bfamily(?:[- ]siz(?:e|ed))?\b/i },
          { size: "personal", pattern: /\b(?:personal|individual)\b/i },
          { size: "small", pattern: /\bsmall\b/i },
          { size: "medium", pattern: /\bmedium\b(?!\s+crust)/i },
          { size: "regular", pattern: /\b(?:regular|normal)\b/i },
          { size: "large", pattern: /\blarge\b/i }
        ];
  return patterns.find(({ pattern }) => pattern.test(value))?.size ?? null;
}

export function servingsForSize(size: SpokenFoodSize | null): number | null {
  switch (size) {
    case "personal":
    case "small":
      return 0.75;
    case "medium":
    case "regular":
      return 1;
    case "large":
      return 1.5;
    case "extra large":
    case "family":
      return 2;
    default:
      return null;
  }
}

function extractSize(value: string): SpokenFoodSize | null {
  return parseSpokenSize(value, "en");
}

function pizzaCategory(toppings: string[]): string {
  if (toppings.includes("pepperoni")) {
    return "Pizza with pepperoni";
  }
  if (toppings.some((topping) => MEAT_TOPPINGS.has(topping))) {
    return "Pizza with meat other than pepperoni";
  }
  if (toppings.some((topping) => VEGETABLE_TOPPINGS.has(topping))) {
    return "Pizza, cheese, with vegetables";
  }
  return "Pizza, cheese";
}

function pizzaMatchQuery(toppings: string[], restaurant: string | null, crust: string | null): string {
  const source = restaurant ? ", from restaurant or fast food" : "";
  const crustQualifier =
    crust === "thin" || crust === "medium" || crust === "thick" || crust === "stuffed"
      ? `${crust} crust`
      : "NS as to type of crust";
  return `${pizzaCategory(toppings)}${source}, ${crustQualifier}`;
}

/**
 * Turns a conversational food order into a deterministic database query. It deliberately
 * does not invent restaurant nutrition: the restaurant and every unsupported qualifier are
 * preserved for the provenance layer instead of being silently discarded.
 */
export function parseFoodOrderIntent(text: string): FoodOrderIntent | null {
  const originalText = text.trim().slice(0, 200);
  if (!originalText) {
    return null;
  }

  const restaurantMatch = CONVERSATIONAL_RESTAURANT.exec(originalText) ?? RESTAURANT_SUFFIX.exec(originalText);
  const restaurant = restaurantMatch ? canonicalRestaurant(restaurantMatch[1]) : null;
  const withoutRestaurant = restaurantMatch
    ? `${originalText.slice(0, restaurantMatch.index)} ${originalText.slice(
        restaurantMatch.index + restaurantMatch[0].length
      )}`.trim()
    : originalText;
  const { itemText: prefixedItemText, hadOrderPrefix } = stripOrderPrefix(withoutRestaurant);
  const itemText = stripConversationalFoodLead(prefixedItemText);
  if (!restaurant && !hadOrderPrefix) {
    return null;
  }
  if (!itemText) {
    return null;
  }

  const toppings = TOPPINGS.filter((entry) => entry.pattern.test(itemText)).map((entry) => entry.name);
  const crust = extractCrust(itemText);
  const size = extractSize(itemText);
  const isPizza = /\bpizza\b/i.test(itemText);

  return {
    kind: "food_order",
    originalText,
    restaurant,
    item: isPizza ? "pizza" : itemText,
    toppings,
    size,
    crust,
    matchQuery: isPizza ? pizzaMatchQuery(toppings, restaurant, crust) : itemText
  };
}

/**
 * Merge short follow-up turns after the camera has already established that the
 * food is pizza. This deliberately lives outside the general parser: "pepperoni"
 * alone must not globally imply pizza, but it is useful context inside that one
 * active camera conversation.
 */
export function mergePizzaOrderRefinement(
  text: string,
  previous: FoodOrderIntent | null = null
): FoodOrderIntent | null {
  const trimmed = text.trim().slice(0, 200);
  if (!trimmed) return null;

  const parsed = parseFoodOrderIntent(trimmed);
  const mentionedRestaurant = RESTAURANT_MENTIONS.find((entry) => entry.pattern.test(trimmed))?.name ?? null;
  const mentionedToppings = TOPPINGS.filter((entry) => entry.pattern.test(trimmed)).map((entry) => entry.name);
  const mentionedCrust = extractCrust(trimmed);
  const mentionedSize = extractSize(trimmed);
  const hasNewDetail = Boolean(
    parsed || mentionedRestaurant || mentionedToppings.length > 0 || mentionedCrust || mentionedSize
  );
  if (!hasNewDetail) return null;

  const restaurant = parsed?.restaurant ?? mentionedRestaurant ?? previous?.restaurant ?? null;
  const toppings = [
    ...new Set([...(previous?.toppings ?? []), ...(parsed?.toppings ?? []), ...mentionedToppings])
  ];
  const crust = parsed?.crust ?? mentionedCrust ?? previous?.crust ?? null;
  const size = parsed?.size ?? mentionedSize ?? previous?.size ?? null;
  const originalText = [previous?.originalText, trimmed].filter(Boolean).join(" ");

  return {
    kind: "food_order",
    originalText,
    restaurant,
    item: "pizza",
    toppings,
    size,
    crust,
    matchQuery: pizzaMatchQuery(toppings, restaurant, crust)
  };
}

/** Canonical text that the existing identify route can parse deterministically. */
export function foodOrderIntentToLookupText(intent: FoodOrderIntent): string {
  const details = [
    intent.size,
    intent.crust ? `${intent.crust} crust` : null,
    intent.toppings.length > 0 ? intent.toppings.join(" and ") : null,
    intent.item
  ].filter((detail): detail is string => Boolean(detail));
  return `I am ordering a ${details.join(" ")}${intent.restaurant ? ` from ${intent.restaurant}` : ""}`;
}

function sameCrust(description: string, crust: string): boolean {
  if (crust === "thin" || crust === "medium" || crust === "thick" || crust === "stuffed") {
    return description.toLowerCase().includes(`${crust} crust`);
  }
  return true;
}

export function buildFoodMatchProvenance(intent: FoodOrderIntent, matchedAs: string): FoodMatchProvenance {
  const normalizedMatch = matchedAs.toLowerCase();
  const unmatchedDetails: string[] = [];

  if (intent.restaurant) {
    unmatchedDetails.push(`${intent.restaurant} exact menu item`);
  }
  for (const topping of intent.toppings) {
    if (topping === "pepperoni") {
      if (!normalizedMatch.includes("pepperoni") || normalizedMatch.includes("other than pepperoni")) {
        unmatchedDetails.push("pepperoni topping");
      }
      continue;
    }
    if (MEAT_TOPPINGS.has(topping)) {
      // FNDDS has a generic "meat other than pepperoni" category, but not a
      // chain-specific sausage/bacon/etc. topping in this restaurant-pizza slice.
      unmatchedDetails.push(`${topping}-specific topping`);
      continue;
    }
    if (!normalizedMatch.includes(topping)) {
      unmatchedDetails.push(`${topping} topping`);
    }
  }
  if (intent.size) {
    unmatchedDetails.push(`${intent.size} size`);
  }
  if (intent.crust && !sameCrust(matchedAs, intent.crust)) {
    unmatchedDetails.push(`${intent.crust} crust`);
  }

  return {
    kind: "published_closest_match",
    exact: false,
    matchedAs,
    unmatchedDetails: [...new Set(unmatchedDetails)],
    note: intent.restaurant
      ? `This is the closest published restaurant category, not ${intent.restaurant} nutrition.`
      : "This is the closest published category, not an exact menu-item score."
  };
}

/** Extra deterministic choices for the correction UI; the primary query remains first. */
export function foodOrderCorrectionQueries(intent: FoodOrderIntent): string[] {
  if (intent.item !== "pizza") {
    return [];
  }

  const source = intent.restaurant ? ", from restaurant or fast food" : "";
  const crustQualifier =
    intent.crust === "thin" || intent.crust === "medium" || intent.crust === "thick" || intent.crust === "stuffed"
      ? `${intent.crust} crust`
      : "NS as to type of crust";
  const categories = ["Pizza with pepperoni", "Pizza with meat other than pepperoni", "Pizza, cheese"];

  return categories
    .map((category) => `${category}${source}, ${crustQualifier}`)
    .filter((query) => query !== intent.matchQuery);
}
