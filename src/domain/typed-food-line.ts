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

const QUESTION_OPENERS = [
  // English
  "how",
  "what",
  "why",
  "when",
  "where",
  "which",
  "can",
  "could",
  "is",
  "are",
  "was",
  "does",
  "do",
  "did",
  "should",
  "will",
  "would",
  "am",
  "may",
  "might",
  // Spanish
  "cuanto",
  "cuantos",
  "cuanta",
  "cuantas",
  "que",
  "qué",
  "cual",
  "cuál",
  "como",
  "cómo",
  "puedo",
  "puede",
  "debo",
  "es",
  "son",
  "por"
];

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
  const first = stripAccents(trimmed.toLowerCase()).split(/[\s,]+/)[0]?.replace(/[^a-z]/g, "") ?? "";
  return QUESTION_OPENERS.some((opener) => stripAccents(opener) === first);
}

const SPLIT_PATTERN = /\s*(?:,|\+|\band\b|\by\b|\bwith a\b|\bcon un\b|\bcon una\b)\s*/gi;

const LEADING_NOISE = /^(?:a|an|the|some|my|una?|el|la|los|las|unos|unas)\s+/i;

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

/**
 * Splits one typed line into the foods on the plate.
 *
 * "2 slices of pepperoni pizza, side salad with ranch, and a Mountain Dew" is three foods,
 * not one unmatchable string. Every persona who typed a plate got "We don't have a score
 * for that one. Try a simpler name." (critique G4).
 *
 * "with a" splits, plain "with" does not: "green beans cooked with bacon" is one food and
 * "side salad with a roll" is two.
 */
export function splitPlateLine(text: string): PlateLineSplit {
  const parts = text
    .split(SPLIT_PATTERN)
    .map((part) => part.trim().replace(LEADING_NOISE, "").trim())
    .filter((part) => part.length > 1);

  if (parts.length <= 1) {
    const single = text.trim();
    return { items: single.length > 0 ? [single] : [], dropped: [] };
  }
  return { items: parts.slice(0, MAX_PLATE_ITEMS), dropped: parts.slice(MAX_PLATE_ITEMS) };
}
