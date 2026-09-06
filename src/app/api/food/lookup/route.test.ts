import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const seededBarcode = "051000012616";

afterEach(() => {
  delete process.env.USDA_FDC_API_KEY;
});

describe("POST /api/food/lookup", () => {
  it("accepts the barcode in JSON rather than the request URL", async () => {
    const request = new Request("https://example.test/api/food/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode: seededBarcode })
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      found: true,
      food: { barcode: seededBarcode }
    });
  });

  it("rejects a malformed body without calling an upstream service", async () => {
    const response = await POST(new Request("https://example.test/api/food/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json"
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_barcode" });
  });

  it.each([
    {
      name: "wrong media type",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ barcode: seededBarcode })
    },
    {
      name: "extra properties",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode: seededBarcode, patient: "not-accepted" })
    },
    {
      name: "oversized body",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode: seededBarcode, padding: "x".repeat(300) })
    }
  ])("rejects $name", async ({ headers, body }) => {
    const response = await POST(new Request("https://example.test/api/food/lookup", {
      method: "POST",
      headers,
      body
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_barcode" });
  });
});
