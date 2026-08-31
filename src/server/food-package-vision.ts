import {
  PACKAGE_FRONT_JSON_SCHEMA,
  PACKAGE_FRONT_SYSTEM_PROMPT,
  PACKAGE_FRONT_USER_PROMPT,
  PACKAGE_NUTRITION_JSON_SCHEMA,
  PACKAGE_NUTRITION_SYSTEM_PROMPT,
  PACKAGE_NUTRITION_USER_PROMPT
} from "@/ai/package-scan-prompts";
import { buildVoiceSafetyIdentifier } from "@/ai/voice-safety-identifier";
import type { FoodPackageProviderConfig } from "@/server/food-package-auth";

export const FOOD_PACKAGE_MAX_IMAGE_CHARS = 3_600_000;
export const FOOD_PACKAGE_MAX_DECODED_IMAGE_BYTES = 2_800_000;
export const FOOD_PACKAGE_MAX_IMAGE_EDGE = 2048;
export const FOOD_PACKAGE_MAX_IMAGE_PIXELS = 4_194_304;
export const FOOD_PACKAGE_PROVIDER_TIMEOUT_MS = 20_000;

export type FoodPackageScanKind = "front" | "nutrition";

export type VerifiedFoodPackageImage = {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
};

const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 1 >= bytes.length) return null;
    const segmentLength = bytes[offset] * 256 + bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (SOF_MARKERS.has(marker)) {
      if (segmentLength < 7) return null;
      const height = bytes[offset + 3] * 256 + bytes[offset + 4];
      const width = bytes[offset + 5] * 256 + bytes[offset + 6];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += segmentLength;
  }
  return null;
}

export function verifyFoodPackageImage(image: string): VerifiedFoodPackageImage | null {
  const prefix = "data:image/jpeg;base64,";
  if (image.length > FOOD_PACKAGE_MAX_IMAGE_CHARS || !image.startsWith(prefix)) return null;
  const encoded = image.slice(prefix.length);
  if (encoded.length === 0 || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    return null;
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(encoded, "base64");
  } catch {
    return null;
  }
  if (
    buffer.length < 4 ||
    buffer.length > FOOD_PACKAGE_MAX_DECODED_IMAGE_BYTES ||
    buffer[0] !== 0xff ||
    buffer[1] !== 0xd8 ||
    buffer[buffer.length - 2] !== 0xff ||
    buffer[buffer.length - 1] !== 0xd9
  ) {
    return null;
  }
  const dimensions = jpegDimensions(buffer);
  if (
    !dimensions ||
    dimensions.width > FOOD_PACKAGE_MAX_IMAGE_EDGE ||
    dimensions.height > FOOD_PACKAGE_MAX_IMAGE_EDGE ||
    dimensions.width * dimensions.height > FOOD_PACKAGE_MAX_IMAGE_PIXELS
  ) {
    return null;
  }
  return { dataUrl: image, width: dimensions.width, height: dimensions.height, bytes: buffer.length };
}

type ResponsesContent = { type?: unknown; text?: unknown };
type ResponsesOutput = { type?: unknown; content?: unknown };

export type FoodPackageProviderMetadata = {
  model: string;
  modelComplete: boolean;
  serviceTier: string;
  serviceTierComplete: boolean;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number } | null;
};

export function foodPackageProviderMetadata(
  value: unknown,
  configuredModel: string
): FoodPackageProviderMetadata {
  if (!value || typeof value !== "object") {
    return {
      model: configuredModel,
      modelComplete: false,
      serviceTier: "unknown",
      serviceTierComplete: false,
      usage: null
    };
  }
  const response = value as { model?: unknown; service_tier?: unknown; usage?: unknown };
  const modelComplete =
    typeof response.model === "string" && response.model.length > 0 && response.model.length <= 200;
  const model = modelComplete ? response.model as string : configuredModel;
  const serviceTierComplete =
    typeof response.service_tier === "string" && /^[a-z][a-z0-9_-]{0,63}$/u.test(response.service_tier);
  const serviceTier = serviceTierComplete ? response.service_tier as string : "unknown";
  if (!response.usage || typeof response.usage !== "object") {
    return { model, modelComplete, serviceTier, serviceTierComplete, usage: null };
  }
  const usage = response.usage as Record<string, unknown>;
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const totalTokens = usage.total_tokens;
  if (
    !Number.isSafeInteger(inputTokens) || (inputTokens as number) < 0 ||
    !Number.isSafeInteger(outputTokens) || (outputTokens as number) < 0 ||
    !Number.isSafeInteger(totalTokens) || (totalTokens as number) < 0
  ) {
    return { model, modelComplete, serviceTier, serviceTierComplete, usage: null };
  }
  return {
    model,
    modelComplete,
    serviceTier,
    serviceTierComplete,
    usage: {
      inputTokens: inputTokens as number,
      outputTokens: outputTokens as number,
      totalTokens: totalTokens as number
    }
  };
}

export function responseOutputText(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const response = value as { status?: unknown; output?: unknown };
  if (response.status !== "completed" || !Array.isArray(response.output)) return null;
  const texts: string[] = [];
  for (const item of response.output as ResponsesOutput[]) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content as ResponsesContent[]) {
      if (part?.type === "refusal") return null;
      if (part?.type === "output_text" && typeof part.text === "string" && part.text.length > 0) {
        texts.push(part.text);
      }
    }
  }
  return texts.length === 1 ? texts[0] : null;
}

export function foodPackageResponsesPayload(args: {
  kind: FoodPackageScanKind;
  image: VerifiedFoodPackageImage;
  model: string;
}): Record<string, unknown> {
  const front = args.kind === "front";
  return {
    model: args.model,
    service_tier: "default",
    store: false,
    reasoning: { effort: "none" },
    max_output_tokens: front ? 350 : 1200,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: front ? PACKAGE_FRONT_SYSTEM_PROMPT : PACKAGE_NUTRITION_SYSTEM_PROMPT }]
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: front ? PACKAGE_FRONT_USER_PROMPT : PACKAGE_NUTRITION_USER_PROMPT },
          { type: "input_image", image_url: args.image.dataUrl, detail: "original" }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: front ? "food_package_front" : "food_package_nutrition",
        strict: true,
        schema: front ? PACKAGE_FRONT_JSON_SCHEMA : PACKAGE_NUTRITION_JSON_SCHEMA
      }
    }
  };
}

export async function callFoodPackageProvider(args: {
  kind: FoodPackageScanKind;
  image: VerifiedFoodPackageImage;
  patientId?: string;
  provider: FoodPackageProviderConfig;
  requestSignal: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort(args.requestSignal.reason);
  if (args.requestSignal.aborted) abort();
  else args.requestSignal.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error("package_scan_timeout")), FOOD_PACKAGE_PROVIDER_TIMEOUT_MS);
  try {
    const response = await (args.fetchImpl ?? fetch)("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.provider.apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": buildVoiceSafetyIdentifier(args.patientId ?? "anonymous")
      },
      body: JSON.stringify(
        foodPackageResponsesPayload({ kind: args.kind, image: args.image, model: args.provider.model })
      ),
      signal: controller.signal
    });
    if (!response.ok) throw new Error("package_provider_failed");
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timeout);
    args.requestSignal.removeEventListener("abort", abort);
  }
}
