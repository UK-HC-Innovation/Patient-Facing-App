/**
 * What a person typed, and what to do with it.
 *
 * Before spec 29 every typed line on the personal door was handed to a live voice session,
 * which needed a working microphone, cost a token, and answered a food name with a
 * paragraph and no number (critique G2, G3, G4). A food name is not a question. It is a
 * lookup, it is deterministic, and it takes milliseconds.
 */

/** More than five and the answer stops being one sentence anyone can act on. */
export const MAX_PLATE_ITEMS = 5;

/**
 * Words that open a question in either language, whatever follows them.
 *
 * Accent-stripped, so `qué` and `que` both land here. `cómo` deliberately does not: the
 * Spanish for "how" and the Spanish for "I eat" are the same letters without the accent, and
 * "como pollo" was opening a paid voice session (spec 30 R5 step 3, finding E03).
 */
const INTERROGATIVE_OPENERS = ["how", "what", "why", "when", "where", "which"];

/** The accented Spanish interrogatives, matched before accents are stripped. */
const ACCENTED_OPENERS = ["cuánto", "cuántos", "cuánta", "cuántas", "qué", "cuál", "cuáles", "cómo"];

/**
 * A modal or copula is only a question opener when a pronoun or a number follows it.
 *
 * "can of soup" is a food; "can I have this" is a question. "is 45 carbs right" is a
 * question because no food is called "is 45". Bare "can", "is", "are", "es", "son", "como"
 * and "por" used to open a session on their own, which is what sent `es un tamal` and
 * `son frijoles` to a paid model instead of the lookup table.
 */
const MODAL_QUESTION =
  /^(?:can|could|should|would|will|do|does|did|is|are|was|were|am|may|might|have|has)\s+(?:the\s+|a\s+|an\s+)?(?:\d|i\b|you\b|it\b|this\b|that\b|these\b|those\b|we\b|they\b|my\b|he\b|she\b|there\b)/i;

/** Spanish modals carry their own subject, so the word alone is the shape. */
const SPANISH_MODAL_OPENERS = ["puedo", "puede", "podria", "podrias", "debo", "deberia", "debemos"];

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Is this a question rather than a food?
 *
 * Deliberately shape-based and local. A model call to decide whether to make a model call
 * is the thing this phase exists to remove.
 */
export function isQuestionLine(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.includes("?") || trimmed.includes("¿")) return true;

  const lowered = trimmed.toLowerCase();
  const accentedFirst = lowered.split(/[\s,]+/)[0]?.replace(/[^a-záéíóúüñ]/g, "") ?? "";
  if (ACCENTED_OPENERS.includes(accentedFirst)) return true;

  const stripped = stripAccents(lowered);
  const first = stripped.split(/[\s,]+/)[0]?.replace(/[^a-z]/g, "") ?? "";
  if (INTERROGATIVE_OPENERS.includes(first) || SPANISH_MODAL_OPENERS.includes(first)) return true;
  return MODAL_QUESTION.test(stripped);
}

/**
 * Prefixes that introduce a correction of the food already on screen.
 *
 * `No, it is a tamale` used to split on the comma into a two-item plate whose first item,
 * "No", scored as Beef and noodles, no sauce (spec 30 R5 step 2, finding E05 neighbourhood).
 * The Spanish copulas are here rather than in the question openers for the same reason:
 * "es un tamal" and "son frijoles" are what a person says when they are telling you what
 * the food is.
 */
const CORRECTION_PREFIXES = [
  /^no[,.]\s*/i,
  /^actually[,.]?\s+/i,
  /^en\s+realidad[,.]?\s+/i,
  /^it['’]?s\s+(?:a|an)\s+/i,
  /^it\s+is\s+(?:a|an)\s+/i,
  /^that['’]?s\s+(?:a|an)\s+/i,
  /^es\s+(?:un|una)\s+/i,
  /^son\s+(?:unos|unas)\s+/i,
  /^es\s+/i,
  /^son\s+/i
];

export type CorrectionLine = {
  /** The line with any correction prefix removed. */
  text: string;
  /** Whether a prefix was stripped, so the caller knows this replaces the current food. */
  corrected: boolean;
};

export function stripCorrectionPrefix(text: string): CorrectionLine {
  let value = text.trim();
  let corrected = false;
  // Twice at most: "No, actually a tamale" is one correction, not a loop to exhaust.
  for (let pass = 0; pass < 2; pass += 1) {
    const prefix = CORRECTION_PREFIXES.find((pattern) => pattern.test(value));
    if (!prefix) break;
    const next = value.replace(prefix, "").trim();
    if (next.length === 0) break;
    value = next;
    corrected = true;
  }
  // "No, actually a tamale" leaves an article behind. Only after a prefix was stripped, so
  // "a pizza" typed on its own is left exactly as it was said.
  if (corrected) {
    const withoutArticle = value.replace(/^(?:a|an|the|un|una|el|la)\s+/i, "").trim();
    if (withoutArticle.length > 0) value = withoutArticle;
  }
  return { text: value, corrected };
}

/** Separators that always mean a second food: a list, a plus, or "with a" second thing. */
const LIST_PATTERN = /\s*(?:,|\+|\bwith a\b|\bcon un\b|\bcon una\b)\s*/gi;
/** Adding "and" / "y", used only once a whole-line lookup has failed to justify one dish. */
const CONJUNCTION_PATTERN = /\s*(?:,|\+|\band\b|\by\b|\bwith a\b|\bcon un\b|\bcon una\b)\s*/gi;

const LEADING_NOISE = /^(?:and|y|plus|a|an|the|some|my|una?|el|la|los|las|unos|unas)\s+/i;

/** ", and a Mountain Dew" is one food with two words of glue in front of it. */
function trimLeadingNoise(part: string): string {
  let value = part.trim();
  for (let pass = 0; pass < 3 && LEADING_NOISE.test(value); pass += 1) {
    value = value.replace(LEADING_NOISE, "").trim();
  }
  return value;
}

export type PlateLineSplit = {
  /** Up to MAX_PLATE_ITEMS foods, in the order they were typed. */
  items: string[];
  /**
   * Everything past the cap, kept rather than discarded.
   *
   * The splitter used to `slice(0, 5)` and return, so items six and seven left no trace and
   * a seven-item plate was presented as a complete answer to five of them (spec 30 R5).
   */
  dropped: string[];
};

function split(text: string, pattern: RegExp): PlateLineSplit {
  const parts = text
    .split(pattern)
    .map(trimLeadingNoise)
    .filter((part) => part.length > 1);

  if (parts.length <= 1) {
    const single = text.trim();
    return { items: single.length > 0 ? [single] : [], dropped: [] };
  }
  return { items: parts.slice(0, MAX_PLATE_ITEMS), dropped: parts.slice(MAX_PLATE_ITEMS) };
}

/**
 * Splits one typed line into the foods on the plate, on a list separator only.
 *
 * "2 slices of pepperoni pizza, side salad with ranch, and a Mountain Dew" is three foods,
 * not one unmatchable string. Every persona who typed a plate got "We don't have a score
 * for that one. Try a simpler name." (critique G4).
 *
 * "and" is deliberately NOT a separator here (spec 30 R5 step 5). It used to be, which
 * turned "mac and cheese" into a Big Mac and a slice of cheese and "chicken and dumplings"
 * into two foods, while the row for the whole dish was never tried. A line joined only by
 * "and" goes to the whole-line lookup first and splits through splitConjunctionLine below
 * only when nothing justified covers both sides.
 *
 * "with a" splits, plain "with" does not: "green beans cooked with bacon" is one food and
 * "side salad with a roll" is two.
 */
export function splitPlateLine(text: string): PlateLineSplit {
  return split(text, LIST_PATTERN);
}

/** The same split, with "and" and "y" added, for a line no single dish row covered. */
export function splitConjunctionLine(text: string): PlateLineSplit {
  return split(text, CONJUNCTION_PATTERN);
}

/** Does this line join its parts with "and" / "y" alone? */
export function hasConjunction(text: string): boolean {
  return /\s(?:and|y)\s/i.test(text) && splitPlateLine(text).items.length <= 1;
}
