import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FOOD_PACKAGE_SESSION_COOKIE,
  createFoodPackageSessionToken,
  resetFoodPackageAuthStateForTest
} from "@/server/food-package-auth";

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

function providerResponse(output: unknown): Response {
  return Response.json({
    status: "completed",
    model: "gpt-5.6-luna-2026-08-15",
    service_tier: "default",
    usage: { input_tokens: 120, output_tokens: 30, total_tokens: 150 },
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }]
  });
}

function authorizedRequest(
  body: unknown,
  contentType = "application/json",
  signal?: AbortSignal
): Request {
  const token = createFoodPackageSessionToken();
  if (!token) throw new Error("test_session_unconfigured");
  return new Request("http://localhost/api/food/package", {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Cookie: `${FOOD_PACKAGE_SESSION_COOKIE}=${token}`,
      Origin: "http://localhost",
      "Sec-Fetch-Site": "same-origin"
    },
    body: JSON.stringify(body),
    signal
  });
}

const nutritionPanel = {
  kind: "nutrition_facts",
  quality: "good",
  servingSizeRaw: "1 oz (28 g)",
  servingsPerContainerRaw: "4",
  columnCount: 1,
  selectedColumnHeading: "Amount per serving",
  rows: [
    { field: "calories", printedLabel: "Calories", printedAmount: "130", printedUnit: null },
    { field: "total_fat", printedLabel: "Total Fat", printedAmount: "5", printedUnit: "g" },
    { field: "saturated_fat", printedLabel: "Saturated Fat", printedAmount: "1", printedUnit: "g" },
    { field: "sodium", printedLabel: "Sodium", printedAmount: "180", printedUnit: "mg" },
    { field: "total_carbohydrate", printedLabel: "Total Carbohydrate", printedAmount: "11", printedUnit: "g" },
    { field: "fiber", printedLabel: "Dietary Fiber", printedAmount: "5", printedUnit: "g" },
    { field: "total_sugars", printedLabel: "Total Sugars", printedAmount: "2", printedUnit: "g" },
    { field: "added_sugars", printedLabel: "Includes Added Sugars", printedAmount: "0", printedUnit: "g" },
    { field: "protein", printedLabel: "Protein", printedAmount: "13", printedUnit: "g" }
  ],
  ingredientTextRaw: "soybeans, sunflower oil, ranch seasoning",
  confidence: 0.96
};

describe("POST /api/food/package", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetFoodPackageAuthStateForTest();
    process.env.FOOD_PACKAGE_SCAN_ENABLED = "1";
    process.env.FOOD_PACKAGE_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
    process.env.DEMO_PASSCODE = "invite";
    process.env.HEALTH_AI_PROVIDER = "openai";
    process.env.HEALTH_AI_API_KEY = "secret";
    process.env.HEALTH_AI_PACKAGE_MODEL = "gpt-5.6-luna";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("fails closed before reading the body or spending when disabled", async () => {
    process.env.FOOD_PACKAGE_SCAN_ENABLED = "0";
    process.env.PACKAGE_LABEL_EVAL_ATTESTATION = "opaque-run";
    process.env.PACKAGE_LABEL_EVAL_SOURCE_REVISION = "source-revision";
    process.env.PACKAGE_LABEL_EVAL_BUILD_ID = "build-12345678";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { POST } = await import("./route");
    const result = await POST(new Request("http://localhost/api/food/package", { method: "POST" }));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ mode: "disabled" });
    expect(result.headers.get("x-ladder-eval-attestation")).toBe("opaque-run");
    expect(result.headers.get("x-ladder-eval-source-revision")).toBe("source-revision");
    expect(result.headers.get("x-ladder-eval-build-id")).toBe("build-12345678");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires the signed same-origin package session", async () => {
    const { POST } = await import("./route");
    const result = await POST(
      new Request("http://localhost/api/food/package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "front", image: jpeg() })
      })
    );
    expect(result.status).toBe(401);
    expect(await result.json()).toEqual({ mode: "locked" });
  });

  it("returns an unscored front candidate and calls the provider exactly once", async () => {
    process.env.PACKAGE_LABEL_EVAL_ATTESTATION = "opaque-run";
    process.env.PACKAGE_LABEL_EVAL_SOURCE_REVISION = "source-revision";
    process.env.PACKAGE_LABEL_EVAL_BUILD_ID = "build-12345678";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      providerResponse({
        kind: "single_package",
        quality: "good",
        brand: "The Only Bean",
        product: "Crunchy Edamame",
        flavor: "Ranch",
        visibleText: ["The Only Bean", "Crunchy Edamame", "Ranch"],
        confidence: 0.96
      })
    );
    const { POST } = await import("./route");
    const result = await POST(authorizedRequest({ kind: "front", image: jpeg(), patientId: "p1" }));
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      mode: "front",
      candidate: { displayName: "The Only Bean Crunchy Edamame Ranch" }
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.headers.get("x-ladder-package-model")).toBe("gpt-5.6-luna-2026-08-15");
    expect(result.headers.get("x-ladder-model-complete")).toBe("1");
    expect(result.headers.get("x-ladder-service-tier")).toBe("default");
    expect(result.headers.get("x-ladder-service-tier-complete")).toBe("1");
    expect(result.headers.get("x-ladder-upstream-calls")).toBe("1");
    expect(result.headers.get("x-ladder-usage-complete")).toBe("1");
    expect(result.headers.get("x-ladder-total-tokens")).toBe("150");
    expect(result.headers.get("x-ladder-eval-attestation")).toBe("opaque-run");
    expect(result.headers.get("x-ladder-eval-source-revision")).toBe("source-revision");
    expect(result.headers.get("x-ladder-eval-build-id")).toBe("build-12345678");
  });

  it("abstains on generic-only or low-evidence identity instead of substituting a product", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      providerResponse({
        kind: "single_package",
        quality: "good",
        brand: null,
        product: "Ranch Snack",
        flavor: "Ranch",
        visibleText: ["Ranch", "Snack"],
        confidence: 0.99
      })
    );
    const { POST } = await import("./route");
    const result = await POST(authorizedRequest({ kind: "front", image: jpeg() }));
    expect(await result.json()).toEqual({
      mode: "needs_rescan",
      kind: "front",
      reason: "insufficient_evidence"
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns a deterministic per-serving nutrition draft from one provider call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse(nutritionPanel));
    const { POST } = await import("./route");

    const result = await POST(authorizedRequest({ kind: "nutrition", image: jpeg() }));

    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      mode: "nutrition",
      draft: {
        servingSize: "1 oz (28 g)",
        servingGrams: 28,
        servingsPerContainer: "4",
        nutrition: { basis: "per_serving", calories: 130, sodiumMg: 180, proteinG: 13 }
      }
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("abstains on a dual-column nutrition panel instead of choosing a column", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse({
      ...nutritionPanel,
      kind: "ambiguous_columns",
      columnCount: 2,
      selectedColumnHeading: null
    }));
    const { POST } = await import("./route");

    const result = await POST(authorizedRequest({ kind: "nutrition", image: jpeg() }));

    expect(await result.json()).toEqual({
      mode: "needs_rescan",
      kind: "nutrition",
      reason: "ambiguous_columns"
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["malformed JSON", {
      status: "completed",
      model: "gpt-5.6-luna-2026-08-15",
      usage: { input_tokens: 120, output_tokens: 30, total_tokens: 150 },
      output: [{ type: "message", content: [{ type: "output_text", text: "not-json" }] }]
    }],
    ["provider refusal", {
      status: "completed",
      model: "gpt-5.6-luna-2026-08-15",
      usage: { input_tokens: 120, output_tokens: 30, total_tokens: 150 },
      output: [{ type: "message", content: [{ type: "refusal", refusal: "cannot comply" }] }]
    }],
    ["incomplete response", {
      status: "incomplete",
      model: "gpt-5.6-luna-2026-08-15",
      usage: { input_tokens: 120, output_tokens: 30, total_tokens: 150 },
      output: []
    }]
  ])("fails closed on %s", async (_label, providerBody) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(providerBody));
    const { POST } = await import("./route");

    const result = await POST(authorizedRequest({ kind: "front", image: jpeg() }));

    expect(result.status).toBe(502);
    expect(await result.json()).toEqual({ mode: "error", message: "The scan could not be read. Try again." });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("propagates client cancellation to the one provider request", async () => {
    let upstreamSignal: AbortSignal | null = null;
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      upstreamSignal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        upstreamSignal?.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true }
        );
      });
    });
    const controller = new AbortController();
    const { POST } = await import("./route");
    const pending = POST(authorizedRequest({ kind: "front", image: jpeg() }, "application/json", controller.signal));
    await vi.waitFor(() => expect(upstreamSignal).not.toBeNull());

    controller.abort();
    const result = await pending;

    expect((upstreamSignal as AbortSignal | null)?.aborted).toBe(true);
    expect(result.status).toBe(502);
    expect(await result.json()).toEqual({ mode: "error", message: "Package scanning is unavailable right now." });
  });

  it("rejects a non-JPEG before provider spend", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { POST } = await import("./route");
    const result = await POST(
      authorizedRequest({ kind: "front", image: "data:image/png;base64,AAAA" })
    );
    expect(result.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
