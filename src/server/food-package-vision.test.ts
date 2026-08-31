import { describe, expect, it, vi } from "vitest";
import {
  callFoodPackageProvider,
  foodPackageProviderMetadata,
  foodPackageResponsesPayload,
  responseOutputText,
  verifyFoodPackageImage,
  type VerifiedFoodPackageImage
} from "./food-package-vision";

function jpeg(width = 2, height = 3): string {
  const bytes = Buffer.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xd9
  ]);
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

describe("food package image verification", () => {
  it("accepts only bounded JPEG data URLs with declared dimensions", () => {
    expect(verifyFoodPackageImage(jpeg(2048, 2048))).toMatchObject({ width: 2048, height: 2048 });
    expect(verifyFoodPackageImage(jpeg(2049, 2))).toBeNull();
    expect(verifyFoodPackageImage("data:image/png;base64,AAAA")).toBeNull();
    expect(verifyFoodPackageImage("data:image/jpeg;base64,AAAA")).toBeNull();
  });
});

describe("food package Responses contract", () => {
  const image = verifyFoodPackageImage(jpeg()) as VerifiedFoodPackageImage;

  it("uses original detail, strict structured output, no storage, and one bounded call", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }] }))
    );
    await callFoodPackageProvider({
      kind: "front",
      image,
      patientId: "patient-1",
      provider: { apiKey: "secret", model: "gpt-5.6-luna" },
      requestSignal: new AbortController().signal,
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload).toMatchObject({
      store: false,
      reasoning: { effort: "none" },
      max_output_tokens: 350,
      text: { format: { type: "json_schema", strict: true } }
    });
    expect(payload.input[1].content[1]).toMatchObject({ type: "input_image", detail: "original" });
    expect((init.headers as Record<string, string>)["OpenAI-Safety-Identifier"]).toMatch(/^pc_voice_/);
  });

  it("selects one completed message and rejects incomplete, refusal, or mixed responses", () => {
    expect(responseOutputText({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }] })).toBe("ok");
    expect(responseOutputText({ status: "incomplete", output: [] })).toBeNull();
    expect(responseOutputText({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] })).toBeNull();
    expect(responseOutputText({
      status: "completed",
      output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }, { type: "output_text", text: "{}" }] }]
    })).toBeNull();
    expect(responseOutputText({ status: "failed", output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }] })).toBeNull();
  });

  it("builds different output budgets for front and nutrition", () => {
    expect(foodPackageResponsesPayload({ kind: "nutrition", image, model: "gpt-5.6-luna" })).toMatchObject({
      service_tier: "default",
      max_output_tokens: 1200,
      text: { format: { name: "food_package_nutrition" } }
    });
  });

  it("reads the provider's actual model and usage metadata", () => {
    expect(foodPackageProviderMetadata({
      model: "gpt-5.6-luna-2026-08-15",
      service_tier: "default",
      usage: { input_tokens: 120, output_tokens: 30, total_tokens: 150 }
    }, "gpt-5.6-luna")).toEqual({
      model: "gpt-5.6-luna-2026-08-15",
      modelComplete: true,
      serviceTier: "default",
      serviceTierComplete: true,
      usage: { inputTokens: 120, outputTokens: 30, totalTokens: 150 }
    });
    expect(foodPackageProviderMetadata({}, "gpt-5.6-luna")).toEqual({
      model: "gpt-5.6-luna",
      modelComplete: false,
      serviceTier: "unknown",
      serviceTierComplete: false,
      usage: null
    });
  });
});
