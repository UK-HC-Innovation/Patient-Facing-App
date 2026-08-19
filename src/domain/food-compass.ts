// Food Compass Score 2.0 — deterministic scoring engine.
//
// Every number this app shows or speaks about a food comes from here or from the
// published Table S5 lookup. The model never computes a score; it only says what it
// is looking at. All constants below were read off Table S9/S10 of the Food Compass
// 2.0 supplement (printed pp. 25-30); where the sources disagree, the resolution and
// its evidence are recorded in a comment at the point of use.
//
// Reference unit: per 100 kcal. Pure functions only, data injected by the caller, so
// the ~5 MB of lookup assets never reach a client bundle.

import type { IdentifiedFood, NutritionFacts } from "./types";

export type CompassBand = "encourage" | "moderate" | "minimize";
export type CompassTier = "T1" | "T2";
export type DomainKey = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8" | "D9";

export type FcsFood = {
  code: string;
  description: string;
  group: string;
  fcs2: number;
  fcs1: number;
  nova: number;
  hsr: number;
  nutriScore: string;
  ambiguous: boolean;
};

// The FNDDS 2017-18 panel attached to the ~2/3 of Table S5 foods that join by code.
export type FnddsRecord = {
  desc: string;
  wweia: string | null;
  kcal: number | null;
  protein: number | null;
  carb: number | null;
  sugar: number | null;
  fiber: number | null;
  fat: number | null;
  sfa: number | null;
  mufa: number | null;
  pufa: number | null;
  chol: number | null;
  vitA: number | null;
  vitB1: number | null;
  vitB2: number | null;
  vitB3: number | null;
  vitB6: number | null;
  folate: number | null;
  choline: number | null;
  vitB12: number | null;
  vitC: number | null;
  vitD: number | null;
  vitE: number | null;
  vitK: number | null;
  ca: number | null;
  p: number | null;
  mg: number | null;
  fe: number | null;
  zn: number | null;
  cu: number | null;
  se: number | null;
  k: number | null;
  na: number | null;
  alcohol: number | null;
  water: number | null;
  c8: number | null;
  c10: number | null;
  c12: number | null;
  epa: number | null;
  dha: number | null;
  c183: number | null;
  carotenoidProxy: number | null;
};

// ---------------------------------------------------------------------------
// Core scaling
// ---------------------------------------------------------------------------

/** S(v, l, h, pmin, pmax). Always clips before scaling — the original calculator did not. */
export function scaleScore(value: number, low: number, high: number, pmin: number, pmax: number): number {
  const clipped = Math.min(high, Math.max(low, value));
  return pmin + ((pmax - pmin) * (clipped - low)) / (high - low);
}

/**
 * Natural log, not log10. The supplement writes only "(log)"; ln is established by the
 * CAAI writeup's explicit ln() and by plausibility — e^1.77 ~ 5.9 is a sane 95th-percentile
 * unsaturated:saturated ratio, 10^1.77 ~ 59 is not. The log10 bug is what made the original
 * prototype's extremes inconsistent, so it carries a unit-test tripwire.
 */
export function lnRatioScore(numerator: number | null, denominator: number | null, low: number, high: number): number | null {
  if (numerator === null || denominator === null) {
    return null;
  }
  if (denominator <= 0) {
    // ratio -> +infinity; clip to the top of the range. 0/0 is undefined, so drop it.
    return numerator <= 0 ? null : 10;
  }
  if (numerator <= 0) {
    // ln(0) -> -infinity; clip to the bottom of the range.
    return -10;
  }
  return scaleScore(Math.log(numerator / denominator), low, high, -10, 10);
}

/** Mean of the n entries with the largest absolute score. */
export function topByMagnitude(scores: number[], n: number): number | null {
  if (scores.length === 0) {
    return null;
  }
  const picked = [...scores].sort((a, b) => Math.abs(b) - Math.abs(a)).slice(0, n);
  return picked.reduce((sum, s) => sum + s, 0) / picked.length;
}

// Table S10 cut-points for the three D1 ratios (natural log), and the per-100-kcal
// targets for D2/D3/D7/D8/D9. Exported so the harness, the engine and the unit tests all
// read one copy of every constant.
export const RATIO_CUTPOINTS = {
  unsaturatedToSaturated: [-0.66, 1.77] as const,
  fiberToCarbohydrate: [-7.02, -0.78] as const,
  potassiumToSodium: [-2.02, 3.3] as const
};

// D2, 25% of the RDA/AI per 100 kcal, each scored 0..+10 (verified p. 27).
export const VITAMIN_TARGETS = {
  vitA: 225,
  vitB1: 0.3,
  vitB2: 0.325,
  vitB3: 4,
  vitB6: 0.325,
  folate: 100,
  vitB12: 0.6,
  vitC: 22.5,
  vitD: 3.75,
  vitE: 3.75,
  vitK: 30,
  choline: 137.5
} as const;

// D3, each 0..+10 (verified pp. 27-28). Sodium is the one negative, 0..-10 at 575 mg.
// Iodine (37.5 ug) is defined in the table but excluded, verbatim p. 25: "Iodine and
// trans fats attributes were missing across the entire FNDDS 2001-2018 database, and so
// were excluded from the scoring". We exclude it for the same reason.
export const MINERAL_TARGETS = { ca: 250, p: 175, mg: 105, fe: 4.5, zn: 2.75, cu: 0.225, se: 13.75, k: 1175 } as const;
export const SODIUM_TARGET = 575;

// ---------------------------------------------------------------------------
// Final scaling — pinned, never refit
// ---------------------------------------------------------------------------

// Verbatim from the supplement (p. 29 footnote *): the 5th/95th percentiles of the raw
// domain sum across all 58,618 FNDDS 2001-2018 item-rows. The CAAI writeup's
// (-12.43, 29.94)/42.37 is a deviation from the published method and is not used.
// Refitting these against a partial-domain recompute would bake the missing-domain bias
// into the constants, so they stay fixed.
export const RAW_LOW = -12.1;
export const RAW_HIGH = 35.0;
export const RAW_SPAN = 47.1;

export function rawToFcs(raw: number): number {
  const truncated = Math.min(RAW_HIGH, Math.max(RAW_LOW, raw));
  const fcs = Math.round(100 - ((RAW_HIGH - truncated) / RAW_SPAN) * 99);
  return Math.min(100, Math.max(1, fcs));
}

// Bands are from the Food Compass 1.0 paper; the 2.0 supplement does not restate them.
export function bandForScore(fcs: number): CompassBand {
  if (fcs <= 30) {
    return "minimize";
  }
  return fcs >= 70 ? "encourage" : "moderate";
}

// ---------------------------------------------------------------------------
// Scoreability (T3) — checked FIRST on every path
// ---------------------------------------------------------------------------

export type NotScoreableReason = "zero_calorie" | "below_5kcal" | "alcohol" | "infant" | "specialized";

export type Scoreability =
  | { scoreable: true; kcalPer100g: number | null }
  | { scoreable: false; reason: NotScoreableReason };

const ALCOHOL_PATTERN =
  /\b(beer|ale|lager|stout|wine|champagne|prosecco|vodka|whisk(?:e)?y|bourbon|rum|gin|tequila|brandy|liqueur|cognac|schnapps|sake|mead|cocktail|margarita|martini|daiquiri|mojito|sangria|hard cider|hard seltzer)\b/i;
const INFANT_PATTERN = /\b(infant formula|baby food|infant cereal|toddler formula|follow-?up formula|strained baby)\b/i;
const SPECIALIZED_PATTERN =
  /\b(medical food|enteral|tube feeding|meal replacement shake|nutritional supplement drink|oral rehydration|parenteral)\b/i;

/**
 * kcal per 100 g. Basis-dependent by construction: OpenFoodFacts and the demo seed
 * report per declared serving, USDA FDC reports per 100 g. Returns null when the
 * serving mass is unknown — "unknown" is a real answer here, a guess is not.
 */
export function kcalPer100g(nutrition: NutritionFacts | null): number | null {
  if (!nutrition || nutrition.calories === null) {
    return null;
  }
  if (nutrition.basis === "per_100g") {
    return nutrition.calories;
  }
  if (nutrition.servingGrams !== null && nutrition.servingGrams > 0) {
    return (nutrition.calories / nutrition.servingGrams) * 100;
  }
  return null;
}

// Plain water and its zero-calorie relatives are the carve-out people actually type, and
// Table S5 has no row for them -- Food Compass excluded them by definition, so a fuzzy
// search for "water" lands on flavoured bottled waters and would answer a question about
// tap water with a score of 1. This runs before any matching.
const PLAIN_WATER_QUERY =
  /^(?:a |an |some |the |glass of |cup of |bottle of |bottled |ice |iced |tap |plain |sparkling |mineral |still |carbonated |soda |seltzer |club )*(?:water|seltzer|club soda|soda water)$/i;

/**
 * Scoreability of a typed or spoken query, before any lookup. Returns null when the query
 * says nothing decisive and the food's own nutrition facts should decide.
 */
export function classifyQueryScoreability(query: string): Scoreability | null {
  const trimmed = query.trim().replace(/[?.!]+$/, "");
  if (trimmed.length === 0) {
    return null;
  }
  if (PLAIN_WATER_QUERY.test(trimmed)) {
    return { scoreable: false, reason: "zero_calorie" };
  }
  if (ALCOHOL_PATTERN.test(trimmed)) {
    return { scoreable: false, reason: "alcohol" };
  }
  if (INFANT_PATTERN.test(trimmed)) {
    return { scoreable: false, reason: "infant" };
  }
  if (SPECIALIZED_PATTERN.test(trimmed)) {
    return { scoreable: false, reason: "specialized" };
  }
  return null;
}

/**
 * Supplementary Methods 1 (p. 19), verbatim: "We excluded infant formula, baby foods,
 * specialized dietary foods, alcohol, and products providing <5 kcal per 100g".
 * Running the formula on foods outside that domain is what produced the original
 * prototype's nonsense water score.
 */
export function classifyScoreability(input: {
  name: string;
  category?: string | null;
  nutrition: NutritionFacts | null;
}): Scoreability {
  const haystack = `${input.name} ${input.category ?? ""}`;

  if (ALCOHOL_PATTERN.test(haystack)) {
    return { scoreable: false, reason: "alcohol" };
  }
  if (INFANT_PATTERN.test(haystack)) {
    return { scoreable: false, reason: "infant" };
  }
  if (SPECIALIZED_PATTERN.test(haystack)) {
    return { scoreable: false, reason: "specialized" };
  }
  if (input.nutrition?.calories === 0) {
    // Holds on every basis, so it is checked even when the serving mass is unknown.
    return { scoreable: false, reason: "zero_calorie" };
  }

  const density = kcalPer100g(input.nutrition);
  if (density !== null && density < 5) {
    return { scoreable: false, reason: "below_5kcal" };
  }
  return { scoreable: true, kcalPer100g: density };
}

// ---------------------------------------------------------------------------
// Calorie density — deliberately separate from the score
// ---------------------------------------------------------------------------

// Food Compass ignores energy density by design, so it is reported alongside the score
// rather than folded into it. Bands follow the standard energy-density classification
// (kcal per gram): very low <0.6, low 0.6-1.5, medium 1.5-4.0, high >4.0.
export type CalorieDensityBand = "very_low" | "low" | "medium" | "high" | "unknown";

export type CalorieDensity = { kcalPer100g: number | null; band: CalorieDensityBand };

export function calorieDensity(nutrition: NutritionFacts | null): CalorieDensity {
  const density = kcalPer100g(nutrition);
  if (density === null) {
    return { kcalPer100g: null, band: "unknown" };
  }
  const rounded = Math.round(density);
  if (density < 60) {
    return { kcalPer100g: rounded, band: "very_low" };
  }
  if (density < 150) {
    return { kcalPer100g: rounded, band: "low" };
  }
  if (density <= 400) {
    return { kcalPer100g: rounded, band: "medium" };
  }
  return { kcalPer100g: rounded, band: "high" };
}

// ---------------------------------------------------------------------------
// T1 — published lookup, zero computation
// ---------------------------------------------------------------------------

export type CompassScore = {
  fcs: number;
  band: CompassBand;
  tier: CompassTier;
  ambiguous: boolean;
  /** Both published values when a food code is listed twice with different scores. */
  range: [number, number] | null;
  calorieDensity: CalorieDensity;
  domains: { key: DomainKey; value: number }[] | null;
  coverage: { included: DomainKey[]; missing: DomainKey[] } | null;
};

const ALL_DOMAINS: DomainKey[] = ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9"];

/**
 * T1: the score IS the published Table S5 value. Nothing is recomputed — a banana is 83
 * because Tufts published 83, and any engine change that "improves" it is wrong.
 */
export function lookupScore(food: FcsFood, siblings: FcsFood[], nutrients: FnddsRecord | null): CompassScore {
  const dupes = food.ambiguous ? siblings.filter((f) => f.code === food.code) : [];
  const range: [number, number] | null =
    dupes.length > 1
      ? [Math.min(...dupes.map((d) => d.fcs2)), Math.max(...dupes.map((d) => d.fcs2))]
      : null;

  return {
    fcs: food.fcs2,
    band: bandForScore(food.fcs2),
    tier: "T1",
    ambiguous: food.ambiguous,
    range,
    calorieDensity: nutrients?.kcal ? calorieDensity(nutrientsToFacts(nutrients)) : { kcalPer100g: null, band: "unknown" },
    domains: null,
    coverage: null
  };
}

/** FNDDS rows are per 100 g edible portion, so the basis is explicit and the mass known. */
export function nutrientsToFacts(record: FnddsRecord): NutritionFacts {
  return {
    servingSize: "per 100 g",
    servingGrams: 100,
    basis: "per_100g",
    calories: record.kcal,
    sodiumMg: record.na,
    potassiumMg: record.k,
    totalSugarsG: record.sugar,
    addedSugarsG: null,
    saturatedFatG: record.sfa,
    fiberG: record.fiber,
    proteinG: record.protein,
    carbsG: record.carb,
    totalFatG: record.fat,
    monoFatG: record.mufa,
    polyFatG: record.pufa,
    transFatG: null,
    cholesterolMg: record.chol,
    calciumMg: record.ca,
    ironMg: record.fe
  };
}

// ---------------------------------------------------------------------------
// T2 — label scoring
// ---------------------------------------------------------------------------

// D5 added-sugar step function, verbatim from Table S10 (p. 28).
export function addedSugarStep(percentEnergy: number): number {
  if (percentEnergy <= 0) return 0;
  if (percentEnergy < 2.5) return -1;
  if (percentEnergy < 5) return -2;
  if (percentEnergy < 10) return -3;
  if (percentEnergy < 15) return -4;
  if (percentEnergy < 20) return -5;
  if (percentEnergy < 30) return -6;
  if (percentEnergy < 40) return -7;
  if (percentEnergy < 50) return -8;
  if (percentEnergy < 60) return -9;
  return -10;
}

// The five binary additives, -1 each, "maximum contribution of -5" (Table S10).
// The CAAI writeup omits these entirely; the supplement does not, so they stay.
const BINARY_ADDITIVES: { key: string; pattern: RegExp }[] = [
  {
    key: "artificial_sweetener_flavor_color",
    pattern:
      /\b(aspartame|sucralose|acesulfame|saccharin|neotame|advantame|artificial sweetener|artificial flavor|artificial colou?r|fd&c|red 40|red no\. 40|yellow 5|yellow 6|blue 1|blue 2|caramel colou?r)\b/i
  },
  { key: "partially_hydrogenated_oil", pattern: /\bpartially hydrogenated\b/i },
  {
    // The lookbehind matters: "partially hydrogenated soybean oil" is ONE additive, and
    // without it the same ingredient would be penalised twice, once by each pattern.
    key: "interesterified_or_hydrogenated_oil",
    pattern: /\b(interesterified|fully hydrogenated|(?<!partially )hydrogenated (?:palm|soybean|cottonseed|vegetable))\b/i
  },
  { key: "high_fructose_corn_syrup", pattern: /\b(high[- ]fructose corn syrup|hfcs)\b/i },
  { key: "msg", pattern: /\b(monosodium glutamate|\bmsg\b|autolyzed yeast extract)\b/i }
];

// Conservative ultra-processing markers used only for the T2 NOVA proxy.
const UPF_MARKERS =
  /\b(maltodextrin|protein isolate|soy protein concentrate|natural flavou?r|modified (?:corn|food|potato|tapioca) starch|carrageenan|polysorbate|mono- and diglycerides|sodium (?:stearoyl|caseinate)|xanthan gum|guar gum|E4\d{2}|E3\d{2}|dextrose|corn syrup solids)\b/i;

const CURED_MEAT_PATTERN =
  /\b(bacon|ham|frankfurter|hot ?dog|sausage|salami|bologna|pepperoni|pastrami|corned beef|prosciutto|chorizo|jerky|deli meat|luncheon meat|cured|smoked (?:turkey|ham|beef|pork))\b/i;

// Resolved toward the supplement's footnote; see the D5 comment in computeLabelScore.
export const NITRITE_LIMIT_PERCENT = 50;

export type LabelScoreOptions = {
  name: string;
  category?: string | null;
  ingredientText?: string | null;
  /** Gate result from the P1 harness; when false, D6 is omitted rather than guessed. */
  useUpfDetector?: boolean;
};

export type LabelScoreResult = CompassScore & {
  domains: { key: DomainKey; value: number }[];
  coverage: { included: DomainKey[]; missing: DomainKey[] };
  additives: string[];
};

/**
 * T2: score what a package label can actually support. Missing domains contribute 0 to
 * the raw sum — which biases the result, so every T2 score is badged as an estimate and
 * the missing domains are listed to the user rather than hidden.
 */
export function computeLabelScore(nutrition: NutritionFacts, options: LabelScoreOptions): LabelScoreResult {
  const kcal = nutrition.calories;
  const domains: { key: DomainKey; value: number }[] = [];
  const included: DomainKey[] = [];
  const ingredients = options.ingredientText ?? "";
  const haystack = `${options.name} ${options.category ?? ""} ${ingredients}`;

  const perKcalFactor = kcal !== null && kcal > 0 ? 100 / kcal : null;
  const per100kcal = (value: number | null): number | null =>
    value === null || perKcalFactor === null ? null : value * perKcalFactor;

  // --- D1 nutrient ratios (mean of the ratios whose gates pass) ---
  const ratios: number[] = [];
  if (kcal !== null && kcal > 0) {
    const fat = nutrition.totalFatG;
    let unsaturated: number | null = null;
    if (nutrition.monoFatG !== null || nutrition.polyFatG !== null) {
      unsaturated = (nutrition.monoFatG ?? 0) + (nutrition.polyFatG ?? 0);
    } else if (fat !== null && nutrition.saturatedFatG !== null) {
      // The one documented place a null is read as 0: a missing trans figure is
      // negligible next to total fat, and dropping the ratio entirely loses more.
      unsaturated = Math.max(0, fat - nutrition.saturatedFatG - (nutrition.transFatG ?? 0));
    }
    if (fat !== null && (fat * 9) / kcal >= 0.1) {
      const s = lnRatioScore(unsaturated, nutrition.saturatedFatG, -0.66, 1.77);
      if (s !== null) {
        ratios.push(s);
      }
    }
    if (nutrition.carbsG !== null && (nutrition.carbsG * 4) / kcal >= 0.1) {
      const s = lnRatioScore(nutrition.fiberG, nutrition.carbsG, -7.02, -0.78);
      if (s !== null) {
        ratios.push(s);
      }
    }
    const kPer = per100kcal(nutrition.potassiumMg);
    const naPer = per100kcal(nutrition.sodiumMg);
    if (kPer !== null && naPer !== null && kPer >= 10 && naPer >= 10) {
      const s = lnRatioScore(nutrition.potassiumMg, nutrition.sodiumMg, -2.02, 3.3);
      if (s !== null) {
        ratios.push(s);
      }
    }
  }
  if (ratios.length > 0) {
    domains.push({ key: "D1", value: ratios.reduce((a, b) => a + b, 0) / ratios.length });
    included.push("D1");
  }

  // --- D3 minerals, partial: sodium always, calcium/iron/potassium when declared ---
  const mineralScores: number[] = [];
  const ca = per100kcal(nutrition.calciumMg);
  const fe = per100kcal(nutrition.ironMg);
  const k = per100kcal(nutrition.potassiumMg);
  const na = per100kcal(nutrition.sodiumMg);
  if (ca !== null) mineralScores.push(scaleScore(ca, 0, 250, 0, 10));
  if (fe !== null) mineralScores.push(scaleScore(fe, 0, 4.5, 0, 10));
  if (k !== null) mineralScores.push(scaleScore(k, 0, 1175, 0, 10));
  if (na !== null) mineralScores.push(scaleScore(na, 0, 575, 0, -10));
  const d3 = topByMagnitude(mineralScores, 5);
  if (d3 !== null) {
    domains.push({ key: "D3", value: d3 });
    included.push("D3");
  }

  // --- D5 additives ---
  const additives = BINARY_ADDITIVES.filter((a) => a.pattern.test(ingredients)).map((a) => a.key);
  const addedSugarPercent = (() => {
    if (kcal === null || kcal <= 0 || nutrition.addedSugarsG === null) {
      return null;
    }
    return ((nutrition.addedSugarsG * 4) / kcal) * 100;
  })();
  const curedMeat = CURED_MEAT_PATTERN.test(haystack);
  if (addedSugarPercent !== null || additives.length > 0 || curedMeat) {
    const parts: number[] = [];
    if (addedSugarPercent !== null) {
      parts.push(addedSugarStep(addedSugarPercent));
    }
    // Nitrite proxy. Ledger 1: Table S10 (p. 28) prints a 25% limit, footnote para. (p. 29)
    // describes "50% energy from processed/cured meat ... with linear scaling down to 0%".
    // The P1 harness could not discriminate them — the input (FPED processed-meat energy
    // share) exists in neither source file, and every near-pure cured-meat row clips to -10
    // under both slopes. Resolved on documentary grounds toward the footnote, which states
    // an operational rule rather than a bare cell, and which the CAAI implementation follows.
    // A keyword-identified cured meat is ~100% of its own calories, so the choice is inert here.
    if (curedMeat) {
      parts.push(scaleScore(100, 0, NITRITE_LIMIT_PERCENT, 0, -10));
    }
    if (parts.length > 0 || additives.length > 0) {
      const mean = parts.length > 0 ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
      domains.push({ key: "D5", value: mean - additives.length });
      included.push("D5");
    }
  }

  // --- D6 processing, conservative ultra-processed detector only ---
  if (options.useUpfDetector !== false) {
    const ultraProcessed = additives.length > 0 || UPF_MARKERS.test(ingredients);
    if (ultraProcessed) {
      // NOVA 4 -> S_NOVA = -10; fermentation and frying are unknown from a label, so
      // both half-weight attributes score 0 -> D6 = (-10 + 0 + 0) / 2.
      domains.push({ key: "D6", value: -5 });
      included.push("D6");
    }
  }

  // --- D7 specific lipids, partial: cholesterol and trans fat when declared ---
  const lipids: { score: number; weight: number }[] = [];
  const chol = per100kcal(nutrition.cholesterolMg);
  if (chol !== null) {
    lipids.push({ score: scaleScore(chol, 0, 75, 0, -10), weight: 0.5 });
  }
  if (nutrition.transFatG !== null && kcal !== null && kcal > 0) {
    const transPercent = ((nutrition.transFatG * 9) / kcal) * 100;
    lipids.push({ score: scaleScore(transPercent, 0, 30, 0, -10), weight: 1.0 });
  }
  if (lipids.length > 0) {
    domains.push({ key: "D7", value: 0.5 * aggregateLipids(lipids) });
    included.push("D7");
  }

  // --- D8 fibre and protein ---
  const fiberPer = per100kcal(nutrition.fiberG);
  const proteinPer = per100kcal(nutrition.proteinG);
  if (fiberPer !== null || proteinPer !== null) {
    const sFiber = fiberPer === null ? 0 : scaleScore(fiberPer, 0, 9.5, 0, 10);
    const sProtein = proteinPer === null ? 0 : scaleScore(proteinPer, 0, 14, 0, 10);
    domains.push({ key: "D8", value: (sFiber + 0.5 * sProtein) / 1.5 });
    included.push("D8");
  }

  const raw = domains.reduce((sum, d) => sum + d.value, 0);
  const fcs = rawToFcs(raw);

  return {
    fcs,
    band: bandForScore(fcs),
    tier: "T2",
    ambiguous: false,
    range: null,
    calorieDensity: calorieDensity(nutrition),
    domains,
    coverage: { included, missing: ALL_DOMAINS.filter((d) => !included.includes(d)) },
    additives
  };
}

/**
 * Ledger 5, resolved empirically in P1: "weighted average of the top 3 by |score|" reads
 * as a weighted MEAN, sum(w*s)/sum(w). Measured on the clean validation subset (110 foods
 * whose D4/D5 contributions are provably zero) the mean gives a bias-corrected MAE of
 * 2.70 FCS points against the published scores versus 3.35 for a weighted sum. It is also
 * the only reading that keeps D7 inside the +/-10 every other domain occupies.
 */
export function aggregateLipids(lipids: { score: number; weight: number }[]): number {
  const top3 = [...lipids].sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, 3);
  const weightSum = top3.reduce((sum, l) => sum + l.weight, 0);
  if (weightSum === 0) {
    return 0;
  }
  return top3.reduce((sum, l) => sum + l.score * l.weight, 0) / weightSum;
}

// ---------------------------------------------------------------------------
// Alternatives
// ---------------------------------------------------------------------------

export type CompassAlternative = {
  code: string;
  description: string;
  fcs: number;
  band: CompassBand;
  calorieDensity: CalorieDensity;
  recipeSearchUrl: string;
};

export type AlternativePreferences = {
  preferHigherScore?: boolean;
  preferLowerCalorieDensity?: boolean;
};

export function recipeSearchUrl(description: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${description} recipe`)}`;
}

const MIN_IMPROVEMENT = 10;

// Words that carry no food identity; dropped before comparing two descriptions.
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
    if (a.has(token)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Deterministic, published-data only: no model decides what a better option is.
 *
 * The candidate pool is the WWEIA category the food belongs to, not its Table S5 food
 * group. The S5 groups are far too coarse to suggest a swap with — 8000_Mixed alone holds
 * 2,551 foods, so a group-ranked answer to "pizza" is "Ceviche, 100", which is true and
 * useless. WWEIA is the USDA's own 148-category grouping and comes from the same joined
 * data, so "pizza" answers with a better pizza and "nacho cheese Doritos" answers with
 * bean chips. About a third of Table S5 predates FNDDS 2017-18 and has no WWEIA category;
 * those fall back to the S5 group narrowed to candidates that share a content word, which
 * turns "taco burger" into a turkey burger rather than a grapefruit.
 *
 * Never an ambiguous (twice-listed) row, never another food pinned at the tail the current
 * food already sits at, and always at least 10 points better. The toggles only reorder the
 * qualifying set; they never widen it.
 */
export function findAlternatives(
  food: FcsFood,
  all: FcsFood[],
  nutrientsByCode: Record<string, FnddsRecord | undefined>,
  preferences: AlternativePreferences = {},
  limit = 3
): CompassAlternative[] {
  if (food.fcs2 === 100) {
    return [];
  }

  const category = nutrientsByCode[food.code]?.wweia ?? null;
  const foodTokens = contentTokens(food.description);
  const seen = new Set<string>();

  const candidates: { food: FcsFood; overlap: number }[] = [];
  for (const candidate of all) {
    if (candidate.ambiguous || candidate.code === food.code) {
      continue;
    }
    if (candidate.fcs2 < food.fcs2 + MIN_IMPROVEMENT) {
      continue;
    }
    if (food.fcs2 === 1 && candidate.fcs2 === 1) {
      continue;
    }
    const overlap = sharedTokenCount(foodTokens, contentTokens(candidate.description));
    if (category !== null) {
      if ((nutrientsByCode[candidate.code]?.wweia ?? null) !== category) {
        continue;
      }
    } else if (candidate.group !== food.group || overlap === 0) {
      continue;
    }
    const key = candidate.description.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    candidates.push({ food: candidate, overlap });
  }

  const densityOf = (code: string): number => {
    const value = nutrientsByCode[code]?.kcal;
    // Foods with no joined nutrient panel sort last rather than pretending to be light.
    return value === null || value === undefined ? Number.POSITIVE_INFINITY : value;
  };

  // All four toggle combinations are distinct and observable. Default is the nearest
  // better swap; "highest score" makes the score the primary key; "lowest calorie density"
  // makes density the primary key unless the score toggle is also on.
  const densityFirst = preferences.preferLowerCalorieDensity === true && preferences.preferHigherScore !== true;
  const scoreFirst = preferences.preferHigherScore === true;

  const sorted = [...candidates].sort((a, b) => {
    if (densityFirst) {
      const diff = densityOf(a.food.code) - densityOf(b.food.code);
      if (diff !== 0) {
        return diff;
      }
    } else if (!scoreFirst && b.overlap !== a.overlap) {
      return b.overlap - a.overlap;
    }
    if (b.food.fcs2 !== a.food.fcs2) {
      return b.food.fcs2 - a.food.fcs2;
    }
    if (preferences.preferLowerCalorieDensity) {
      const diff = densityOf(a.food.code) - densityOf(b.food.code);
      if (diff !== 0) {
        return diff;
      }
    }
    if (b.overlap !== a.overlap) {
      return b.overlap - a.overlap;
    }
    return a.food.description.localeCompare(b.food.description);
  });

  return sorted.slice(0, limit).map(({ food: candidate }) => {
    const record = nutrientsByCode[candidate.code];
    return {
      code: candidate.code,
      description: candidate.description,
      fcs: candidate.fcs2,
      band: bandForScore(candidate.fcs2),
      calorieDensity: record ? calorieDensity(nutrientsToFacts(record)) : { kcalPer100g: null, band: "unknown" },
      recipeSearchUrl: recipeSearchUrl(candidate.description)
    };
  });
}

// ---------------------------------------------------------------------------
// Full-domain recompute
// ---------------------------------------------------------------------------

export type FullScoreContext = {
  /** NOVA class 1-4. Mixed dishes carry an energy-weighted non-integer class. */
  nova: number;
  /** % of calories from yogurt + cheese; keyword-fermented foods pass 100. */
  fermentedEnergyPercent: number;
  fried: boolean;
  /** Dairy gets half weight on the unsaturated:saturated ratio (ledger 3). */
  dairy: boolean;
  /** FPED-derived; absent from both source files, so the harness passes null. */
  addedSugarPercentEnergy: number | null;
  processedMeatPercentEnergy: number | null;
  binaryAdditiveCount: number;
  /**
   * Publication parity. Table S5 was produced with trans fat excluded (missing across
   * FNDDS 2001-2018, p. 25) and the binary additives applied to only 321 brand-matched
   * items (p. 27 footnote), so a fair comparison excludes both.
   */
  includeTransFat: boolean;
  transPercentEnergy: number | null;
  flavonoidsMg: number | null;
};

export type FullScoreResult = {
  fcs: number;
  raw: number;
  domains: { key: DomainKey; value: number }[];
};

const NOVA_SCORE: Record<number, number> = { 1: 10, 2: 7.5, 3: 5, 4: -10 };

/** NOVA 2.0 points only (+10/+7.5/+5/-10). The FCS 1.0 table -10/-2/-1/0 is never mixed in. */
export function novaScore(nova: number): number {
  const clamped = Math.min(4, Math.max(1, nova));
  if (Number.isInteger(clamped)) {
    return NOVA_SCORE[clamped];
  }
  // Mixed dishes carry a non-integer class; interpolate linearly between the neighbours.
  const low = Math.floor(clamped);
  const high = Math.ceil(clamped);
  return NOVA_SCORE[low] + (NOVA_SCORE[high] - NOVA_SCORE[low]) * (clamped - low);
}

/**
 * All nine domains from a full FNDDS nutrient panel. D4 (FPED cup/oz equivalents) has no
 * source in either input file and is always omitted; the caller decides what that means.
 */
export function computeFullScore(record: FnddsRecord, context: FullScoreContext): FullScoreResult {
  const kcal = record.kcal;
  if (kcal === null || kcal <= 0) {
    return { fcs: 1, raw: RAW_LOW, domains: [] };
  }
  const f = 100 / kcal;
  const per = (value: number | null): number | null => (value === null ? null : value * f);
  const domains: { key: DomainKey; value: number }[] = [];

  // --- D1 ---
  const unsaturated =
    record.mufa !== null || record.pufa !== null
      ? (record.mufa ?? 0) + (record.pufa ?? 0)
      : record.fat !== null && record.sfa !== null
        ? Math.max(0, record.fat - record.sfa)
        : null;
  const ratios: { score: number; weight: number }[] = [];
  if (record.fat !== null && (record.fat * 9) / kcal >= 0.1) {
    const s = lnRatioScore(unsaturated, record.sfa, ...RATIO_CUTPOINTS.unsaturatedToSaturated);
    if (s !== null) {
      ratios.push({ score: s, weight: context.dairy ? 0.5 : 1 });
    }
  }
  if (record.carb !== null && (record.carb * 4) / kcal >= 0.1) {
    const s = lnRatioScore(record.fiber, record.carb, ...RATIO_CUTPOINTS.fiberToCarbohydrate);
    if (s !== null) {
      ratios.push({ score: s, weight: 1 });
    }
  }
  const kPer = per(record.k);
  const naPer = per(record.na);
  if (kPer !== null && naPer !== null && kPer >= 10 && naPer >= 10) {
    const s = lnRatioScore(record.k, record.na, ...RATIO_CUTPOINTS.potassiumToSodium);
    if (s !== null) {
      ratios.push({ score: s, weight: 1 });
    }
  }
  if (ratios.length > 0) {
    // Ledger 3, resolved empirically in P1 on 54 plain-dairy rows: "given half weight for
    // the scoring of the Unsaturated:saturated fat ratio" means halve that ratio SCORE and
    // then plain-average the passing ratios (dairy r = 0.919, bias-corrected MAE 2.38),
    // not weight 0.5 inside a weighted mean with denominator 2.5 (r = 0.847, bcMAE 2.61).
    domains.push({ key: "D1", value: ratios.reduce((sum, r) => sum + r.score * r.weight, 0) / ratios.length });
  }

  // --- D2 / D3 (mean of the top 5 by |score|) ---
  const vitamins: number[] = [];
  for (const [key, target] of Object.entries(VITAMIN_TARGETS)) {
    const value = per(record[key as keyof FnddsRecord] as number | null);
    if (value !== null) {
      vitamins.push(scaleScore(value, 0, target, 0, 10));
    }
  }
  const d2 = topByMagnitude(vitamins, 5);
  if (d2 !== null) {
    domains.push({ key: "D2", value: d2 });
  }

  const minerals: number[] = [];
  for (const [key, target] of Object.entries(MINERAL_TARGETS)) {
    const value = per(record[key as keyof FnddsRecord] as number | null);
    if (value !== null) {
      minerals.push(scaleScore(value, 0, target, 0, 10));
    }
  }
  if (naPer !== null) {
    minerals.push(scaleScore(naPer, 0, SODIUM_TARGET, 0, -10));
  }
  const d3 = topByMagnitude(minerals, 5);
  if (d3 !== null) {
    domains.push({ key: "D3", value: d3 });
  }

  // --- D5 ---
  const d5Parts: number[] = [];
  if (context.addedSugarPercentEnergy !== null) {
    d5Parts.push(addedSugarStep(context.addedSugarPercentEnergy));
  }
  if (context.processedMeatPercentEnergy !== null) {
    d5Parts.push(scaleScore(context.processedMeatPercentEnergy, 0, NITRITE_LIMIT_PERCENT, 0, -10));
  }
  if (d5Parts.length > 0 || context.binaryAdditiveCount > 0) {
    const mean = d5Parts.length > 0 ? d5Parts.reduce((a, b) => a + b, 0) / d5Parts.length : 0;
    domains.push({ key: "D5", value: mean - context.binaryAdditiveCount });
  }

  // --- D6 ---
  domains.push({
    key: "D6",
    value:
      (novaScore(context.nova) +
        0.5 * scaleScore(context.fermentedEnergyPercent, 0, 50, 0, 10) +
        0.5 * (context.fried ? -10 : 0)) /
      2
  });

  // --- D7 (top 3 by |score|, weighted; domain x0.5) ---
  const lipids: { score: number; weight: number }[] = [];
  // FNDDS reports fatty acids in GRAMS while the EPA+DHA target is 62.5 MILLIGRAMS.
  // Converting once, here, is the whole of that unit fix.
  const epaDhaMg = ((record.epa ?? 0) + (record.dha ?? 0)) * 1000 * f;
  lipids.push({ score: scaleScore(epaDhaMg, 0, 62.5, 0, 10), weight: 1 });
  if (context.includeTransFat && context.transPercentEnergy !== null) {
    lipids.push({ score: scaleScore(context.transPercentEnergy, 0, 30, 0, -10), weight: 1 });
  }
  lipids.push({ score: scaleScore((record.c183 ?? 0) * f, 0, 0.4, 0, 10), weight: 0.5 });
  lipids.push({
    score: scaleScore(((record.c8 ?? 0) + (record.c10 ?? 0) + (record.c12 ?? 0)) * f, 0, 0.32, 0, 10),
    weight: 0.5
  });
  if (record.chol !== null) {
    lipids.push({ score: scaleScore(record.chol * f, 0, 75, 0, -10), weight: 0.5 });
  }
  domains.push({ key: "D7", value: 0.5 * aggregateLipids(lipids) });

  // --- D8 ---
  domains.push({
    key: "D8",
    value:
      (scaleScore(per(record.fiber) ?? 0, 0, 9.5, 0, 10) + 0.5 * scaleScore(per(record.protein) ?? 0, 0, 14, 0, 10)) /
      1.5
  });

  // --- D9 (x0.5) ---
  const flavonoidScore = scaleScore(context.flavonoidsMg === null ? 0 : context.flavonoidsMg * f, 0, 23.53, 0, 10);
  const carotenoidScore = scaleScore((record.carotenoidProxy ?? 0) * f, 0, 8746.81, 0, 10);
  domains.push({ key: "D9", value: 0.5 * ((flavonoidScore + carotenoidScore) / 2) });

  const raw = domains.reduce((sum, d) => sum + d.value, 0);
  return { fcs: rawToFcs(raw), raw, domains };
}

/**
 * A published-lookup food as an IdentifiedFood, so a T1 match can flow through the same
 * card, flags and meal log as a barcode scan.
 *
 * The source is `fndds_lookup`, deliberately not `vision_estimate`: the estimate badge is
 * keyed to that value and a published score is not an estimate. FNDDS rows are per 100 g,
 * which the serving size states outright.
 */
export function toIdentifiedFood(food: FcsFood, nutrients: FnddsRecord | null): IdentifiedFood {
  return {
    id: `fndds:${food.code}`,
    barcode: null,
    name: food.description,
    brand: null,
    category: food.group,
    nutrition: nutrients ? nutrientsToFacts(nutrients) : null,
    source: "fndds_lookup",
    ingredientText: null
  };
}
