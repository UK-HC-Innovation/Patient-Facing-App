import { z } from "zod";

// A label photo is transcription, not nutritional estimation. Each field fails
// independently to null so one blurry or implausible value cannot discard the
// rest of a readable panel. The caps are deliberately per-serving and generous.
const nullableLabelNumber = (max: number) =>
  z.number().finite().min(0).max(max).nullable().optional().catch(null).transform((value) => value ?? null);

const nullableLabelText = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional().catch(null).transform((value) => value ?? null);

export const labelExtractionSchema = z.object({
  productName: nullableLabelText(120),
  servingSize: nullableLabelText(120),
  servingGrams: nullableLabelNumber(2_000),
  calories: nullableLabelNumber(2_000),
  sodiumMg: nullableLabelNumber(10_000),
  potassiumMg: nullableLabelNumber(10_000),
  totalSugarsG: nullableLabelNumber(500),
  addedSugarsG: nullableLabelNumber(500),
  saturatedFatG: nullableLabelNumber(300),
  fiberG: nullableLabelNumber(300),
  proteinG: nullableLabelNumber(300),
  carbsG: nullableLabelNumber(500),
  totalFatG: nullableLabelNumber(300),
  monoFatG: nullableLabelNumber(300),
  polyFatG: nullableLabelNumber(300),
  transFatG: nullableLabelNumber(300),
  cholesterolMg: nullableLabelNumber(5_000),
  calciumMg: nullableLabelNumber(10_000),
  ironMg: nullableLabelNumber(500),
  ingredientText: nullableLabelText(5_000)
});
