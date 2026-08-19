import { t, type Language } from "@/i18n/strings";
import type { FoodFlag } from "./food-flags";
import type { IdentifiedFood, MealLogEntry } from "./types";
import type { CompassBand, CompassTier } from "./food-compass";

const SUMMARY_MAX = 240;

function summarize(text: string | null): string {
  if (!text) {
    return "";
  }
  const trimmed = text.trim();
  if (trimmed.length <= SUMMARY_MAX) {
    return trimmed;
  }
  const clipped = trimmed.slice(0, SUMMARY_MAX);
  const lastSpace = clipped.lastIndexOf(" ");
  const base = lastSpace > SUMMARY_MAX / 2 ? clipped.slice(0, lastSpace) : clipped;
  return `${base.trimEnd()}…`;
}

export function buildMealLogEntry(args: {
  patientId: string;
  food: IdentifiedFood | null;
  flags: FoodFlag[];
  lastAssistantText: string | null;
  language: Language;
  now?: Date;
  id?: string;
  compassScore?: { fcs: number; band: CompassBand; tier: CompassTier } | null;
}): MealLogEntry {
  const id = args.id ?? crypto.randomUUID();
  const food: IdentifiedFood = args.food ?? {
    id,
    barcode: null,
    name: t(args.language, "unknownFood"),
    brand: null,
    category: null,
    nutrition: null,
    source: "vision_estimate",
    ingredientText: null
  };

  return {
    id,
    patientId: args.patientId,
    loggedAt: (args.now ?? new Date()).toISOString(),
    food,
    flags: args.flags.map((flag) => flag.text),
    assistantSummary: summarize(args.lastAssistantText),
    // Optional by design: an entry logged without a score simply has no compassScore key,
    // which is what keeps every meal logged before spec 23 valid.
    ...(args.compassScore ? { compassScore: args.compassScore } : {})
  };
}
