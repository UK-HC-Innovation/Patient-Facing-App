import type { Language } from "@/i18n/strings";
import type { NutritionFacts } from "./types";

const MAX_SERVINGS = 20;

const AMOUNTS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  half: 0.5,
  media: 0.5,
  medio: 0.5
};

const ARTICLES = new Set(["a", "an", "un", "una"]);

const UNITS = new Set([
  "slice",
  "slices",
  "rebanada",
  "rebanadas",
  "cup",
  "cups",
  "taza",
  "tazas",
  "piece",
  "pieces",
  "pieza",
  "piezas",
  "serving",
  "servings",
  "porcion",
  "porciones",
  "bowl",
  "bowls",
  "plato",
  "platos",
  "can",
  "cans",
  "lata",
  "latas",
  "bottle",
  "bottles",
  "botella",
  "botellas",
  "handful",
  "handfuls",
  "punado",
  "punados",
  "scoop",
  "scoops"
]);

const UNITS_BY_LANGUAGE: Record<Language, ReadonlySet<string>> = {
  en: UNITS,
  es: UNITS
};

const INTEGER_FIELDS = ["calories", "sodiumMg", "potassiumMg", "cholesterolMg", "calciumMg", "ironMg"] as const;
const GRAM_FIELDS = [
  "totalSugarsG",
  "addedSugarsG",
  "saturatedFatG",
  "fiberG",
  "proteinG",
  "carbsG",
  "totalFatG",
  "monoFatG",
  "polyFatG",
  "transFatG"
] as const;

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9./\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function parseAmount(token: string): number | null {
  if (/^\d+(\.\d+)?$/.test(token)) {
    return Number(token);
  }
  if (token === "1/2") {
    return 0.5;
  }
  return AMOUNTS[token] ?? null;
}

function capServings(servings: number): number | null {
  if (!Number.isFinite(servings) || servings <= 0) {
    return null;
  }
  return Math.min(servings, MAX_SERVINGS);
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatServings(servings: number): string {
  return Number.isInteger(servings) ? String(servings) : String(roundOneDecimal(servings));
}

export function parsePortionServings(text: string, language: Language): number | null {
  const tokens = normalize(text);
  const units = UNITS_BY_LANGUAGE[language];

  for (let index = 0; index < tokens.length; index += 1) {
    const amount = parseAmount(tokens[index]);
    if (amount === null) {
      continue;
    }
    const next = tokens[index + 1] ?? "";
    const unit = ARTICLES.has(next) ? tokens[index + 2] ?? "" : next;

    if (units.has(unit)) {
      return capServings(amount);
    }
  }

  return null;
}

export function scaleNutrition(nutrition: NutritionFacts, servings: number): NutritionFacts {
  const scaled: NutritionFacts = {
    ...nutrition,
    servingSize: servings === 1 ? nutrition.servingSize : `${formatServings(servings)} x ${nutrition.servingSize}`,
    servingGrams: nutrition.servingGrams === null ? null : roundOneDecimal(nutrition.servingGrams * servings)
  };

  for (const field of INTEGER_FIELDS) {
    const value = nutrition[field];
    scaled[field] = value === null ? null : Math.round(value * servings);
  }

  for (const field of GRAM_FIELDS) {
    const value = nutrition[field];
    scaled[field] = value === null ? null : roundOneDecimal(value * servings);
  }

  return scaled;
}
