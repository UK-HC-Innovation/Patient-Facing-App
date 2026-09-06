import { demoFoodSeed } from "@/domain/food-seed";
import { resolveBarcode } from "@/domain/food-lookup";
import { barcodeLookupRequestSchema } from "@/domain/schemas";
import type { IdentifiedFood } from "@/domain/types";
import { readBoundedJson } from "@/server/read-bounded-json";

export const dynamic = "force-dynamic";

const cache = new Map<string, IdentifiedFood>();

export async function POST(request: Request): Promise<Response> {
  const body = await readBoundedJson(request, 256);
  if (!body.ok) {
    return Response.json({ error: "invalid_barcode" }, { status: 400 });
  }

  const parsed = barcodeLookupRequestSchema.safeParse(body.value);

  if (!parsed.success) {
    return Response.json({ error: "invalid_barcode" }, { status: 400 });
  }

  const result = await resolveBarcode(parsed.data.barcode, {
    cache,
    seed: demoFoodSeed,
    fdcApiKey: process.env.USDA_FDC_API_KEY ?? null,
    signal: request.signal
  });

  return Response.json(result, {
    headers: { "Cache-Control": "no-store" }
  });
}
