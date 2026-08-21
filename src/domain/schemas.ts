import { z } from "zod";

export const bpReadingInputSchema = z.object({
  systolic: z.coerce.number().int().min(70).max(260),
  diastolic: z.coerce.number().int().min(40).max(160),
  pulse: z.coerce.number().int().min(30).max(220).nullable(),
  contexts: z.array(
    z.enum(["morning", "evening", "before_medicine", "after_medicine", "after_coffee", "after_resting", "during_symptoms"])
  ).min(1),
  note: z.string().max(280)
}).superRefine((reading, ctx) => {
  if (reading.systolic <= reading.diastolic) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Systolic blood pressure must be greater than diastolic blood pressure.",
      path: ["systolic"]
    });
  }
});

export const glucoseReadingInputSchema = z.object({
  valueMgDl: z.coerce.number().int().min(20).max(600),
  contexts: z.array(
    z.enum(["morning", "evening", "before_medicine", "after_medicine", "after_coffee", "after_resting", "during_symptoms"])
  ).min(1),
  note: z.string().max(280)
});

export const medicationBarrierSchema = z.enum([
  "forgot",
  "ran_out",
  "cost",
  "side_effects",
  "confused",
  "scared",
  "pharmacy_issue",
  "does_not_feel_necessary"
]);

export const careContextInputSchema = z.object({
  title: z.string().min(2).max(80),
  rawText: z.string().trim().min(10).max(5000),
  sourceLabel: z.string().min(2).max(80)
});

export const barcodeSchema = z.string().regex(/^\d{8,14}$/);

const nullableNumber = z.number().finite().nullable();

export const nutritionFactsSchema = z.object({
  servingSize: z.string(),
  calories: nullableNumber,
  sodiumMg: nullableNumber,
  potassiumMg: nullableNumber,
  totalSugarsG: nullableNumber,
  addedSugarsG: nullableNumber,
  saturatedFatG: nullableNumber,
  fiberG: nullableNumber,
  proteinG: nullableNumber,
  carbsG: nullableNumber,
  totalFatG: nullableNumber,
  monoFatG: nullableNumber,
  polyFatG: nullableNumber,
  transFatG: nullableNumber,
  cholesterolMg: nullableNumber,
  calciumMg: nullableNumber,
  ironMg: nullableNumber,
  servingGrams: nullableNumber,
  basis: z.enum(["per_serving", "per_100g"])
});

export const identifiedFoodSchema = z.object({
  id: z.string().min(1),
  barcode: z.string().nullable(),
  name: z.string().min(1),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  nutrition: nutritionFactsSchema.nullable(),
  source: z.enum(["barcode_off", "barcode_fdc", "barcode_seed", "vision_estimate", "label_vision", "fndds_lookup"]),
  ingredientText: z.string().nullable()
});

export const foodLookupResponseSchema = z.discriminatedUnion("found", [
  z.object({ found: z.literal(true), food: identifiedFoodSchema }),
  z.object({ found: z.literal(false) })
]);

export const mealLogEntrySchema = z.object({
  id: z.string().min(1),
  patientId: z.string().min(1),
  loggedAt: z.string().min(1),
  food: identifiedFoodSchema,
  flags: z.array(z.string()),
  assistantSummary: z.string().max(280),
  servings: z.number().finite().positive().optional(),
  mealId: z.string().min(1).nullable().optional(),
  editedAt: z.string().min(1).nullable().optional(),
  // Optional and migration-safe: entries logged before spec 23 simply have no score.
  compassScore: z
    .object({
      fcs: z.number().int().min(1).max(100),
      band: z.enum(["encourage", "moderate", "minimize"]),
      tier: z.enum(["T1", "T2"])
    })
    .optional()
});

// Validates the JSON the vision model returns for a pantry scan. Kept lenient on
// content (free text) but bounded in size/shape so a malformed completion is
// rejected rather than rendered.
export const pantryRecipeSchema = z.object({
  title: z.string().min(1).max(120),
  whyItFits: z.string().min(1).max(400),
  haveItems: z.array(z.string().min(1).max(80)).max(20),
  buyItems: z.array(z.string().min(1).max(80)).max(20),
  watchOut: z.string().max(200).nullable().catch(null)
});

export const pantryResultSchema = z.object({
  detectedItems: z.array(z.string().min(1).max(80)).max(40),
  recipes: z.array(pantryRecipeSchema).max(5)
});
