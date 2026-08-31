import type { PlateCandidate } from "./plate-scan";

/**
 * The one question worth asking after a plate scan.
 *
 * A photo cannot see the oil. FNDDS can: the same food is listed once "cooked, no added
 * fat" and again "cooked with oil", and the gap between those two rows is most of the
 * calories in a side dish. Detecting that pair is pure string work over the published
 * descriptions -- no model call, no second spend, and the same deterministic re-score by
 * food code that the correction chips already use.
 */

export type PlateRefineLabelKey = "refineNoOil" | "refineWithOil" | "refineFried";
export type PlateRefineOption = { foodId: string; labelKey: PlateRefineLabelKey };
export type PlateRefineQuestion = { question: "refineOilQuestion"; options: PlateRefineOption[] };

type FatPreparation = "none" | "added" | "fried" | "unspecified";

/**
 * Qualifier segments as FNDDS actually writes them, counted off the published table.
 * `core` is set where the segment also carries a cooking fact worth keeping, so
 * "cooked with oil" and "cooked, no added fat" reduce to the same core.
 */
const FAT_SEGMENTS: Array<{ pattern: RegExp; preparation: FatPreparation; core?: string }> = [
  // "no addded fat" is a real typo in the table; the pattern absorbs it rather than
  // silently dropping every potato row that carries it.
  { pattern: /^no a?d+ed fat$/, preparation: "none" },
  { pattern: /^fat not added in cooking$/, preparation: "none" },
  { pattern: /^made without fat$/, preparation: "none" },
  { pattern: /^cooked,? without fat$/, preparation: "none", core: "cooked" },
  { pattern: /^fat added(?: in cooking)?$/, preparation: "added" },
  {
    pattern: /^made with (?:oil|butter|margarine|butter or margarine|animal fat or meat drippings|lard|shortening)$/,
    preparation: "added"
  },
  {
    pattern: /^cooked with (?:oil|butter|margarine|butter or margarine|fat)$/,
    preparation: "added",
    core: "cooked"
  },
  { pattern: /^with butter$/, preparation: "added" },
  { pattern: /^popped in oil$/, preparation: "added" },
  { pattern: /^fried$/, preparation: "fried" },
  { pattern: /^breaded(?: or floured| and fried)?$/, preparation: "fried" },
  {
    pattern: /^ns as to (?:fat|fat added in cooking|fat eaten|type of fat|fat type|type of fat added in cooking)$/,
    preparation: "unspecified"
  }
];

const LABELS: Record<Exclude<FatPreparation, "unspecified">, PlateRefineLabelKey> = {
  none: "refineNoOil",
  added: "refineWithOil",
  fried: "refineFried"
};

export type ParsedPreparation = { core: string; preparation: FatPreparation | null };

export function parseFatPreparation(description: string): ParsedPreparation {
  const core: string[] = [];
  let preparation: FatPreparation | null = null;

  for (const raw of description.split(",")) {
    const segment = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (segment.length === 0) {
      continue;
    }
    const rule = FAT_SEGMENTS.find((entry) => entry.pattern.test(segment));
    if (!rule) {
      core.push(segment);
      continue;
    }
    // A stated preparation outranks an "NS as to fat" that came before it.
    if (preparation === null || preparation === "unspecified") {
      preparation = rule.preparation;
    }
    if (rule.core) {
      core.push(rule.core);
    }
  }

  return { core: core.join("|"), preparation };
}

/**
 * Returns the question only when a candidate is the SAME food prepared differently. Rows
 * that differ by the food itself -- "Rice, white, cooked, glutinous" beside "Rice, white,
 * cooked, no added fat" -- have different cores and never produce one.
 */
export function plateRefineQuestion(
  description: string,
  candidates: PlateCandidate[]
): PlateRefineQuestion | null {
  const matched = parseFatPreparation(description);
  if (matched.core.length === 0) {
    return null;
  }

  const options: PlateRefineOption[] = [];
  const offered = new Set<PlateRefineLabelKey>();
  for (const candidate of candidates) {
    const parsed = parseFatPreparation(candidate.description);
    if (
      parsed.core !== matched.core ||
      parsed.preparation === null ||
      parsed.preparation === "unspecified" ||
      parsed.preparation === matched.preparation
    ) {
      continue;
    }
    const labelKey = LABELS[parsed.preparation];
    if (offered.has(labelKey)) {
      continue;
    }
    offered.add(labelKey);
    options.push({ foodId: candidate.code, labelKey });
  }

  return options.length > 0 ? { question: "refineOilQuestion", options } : null;
}
