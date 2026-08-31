import { demoFoodSeed } from "@/domain/food-seed";
import { resolveBarcode } from "@/domain/food-lookup";
import { barcodeSchema } from "@/domain/schemas";
import type { IdentifiedFood } from "@/domain/types";

export const dynamic = "force-dynamic";

const cache = new Map<string, IdentifiedFood>();

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const parsed = barcodeSchema.safeParse(searchParams.get("barcode"));

  if (!parsed.success) {
    return Response.json({ error: "invalid_barcode" }, { status: 400 });
  }

  const result = await resolveBarcode(parsed.data, {
    cache,
    seed: demoFoodSeed,
    fdcApiKey: process.env.USDA_FDC_API_KEY ?? null,
    signal: request.signal
  });

  return Response.json(result, {
    headers: { "Cache-Control": "no-store" }
  });
}
