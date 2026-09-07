import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const seededBarcode = "051000012616";

afterEach(() => {
  delete process.env.USDA_FDC_API_KEY;
  vi.unstubAllGlobals();
});

/** One Open Food Facts product, shaped the way the live API returns it. */
function offProduct(product: Record<string, unknown>): void {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.includes("openfoodfacts")) {
      return new Response("{}", { status: 404 });
    }
    return new Response(JSON.stringify({ status: 1, product }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }));
}

function lookup(barcode: string): Promise<Response> {
  return POST(new Request("https://example.test/api/food/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode })
  }));
}

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

// Spec 29 P5, from critique findings H6, H7, G9 and N4.
describe("barcode nutrition the label got wrong", () => {
  it("drops the Coca-Cola row and scores the published soft drink instead", async () => {
    // The numbers on screen in the critique: 45,000 mg sodium and more added sugar
    // than carbohydrate, both impossible for one can.
    offProduct({
      product_name: "Coca cola Coca cola can cokes LG",
      brands: "Coca-Cola",
      serving_size: "1 can (390 ml)",
      serving_quantity: 390,
      nutriments: {
        "energy-kcal_serving": 140,
        sodium_serving: 45,
        "added-sugars_serving": 56.5,
        carbohydrates_serving: 39,
        sugars_serving: 39
      }
    });

    const body = (await (await lookup("049000006346")).json()) as Record<string, unknown>;

    expect(body).toMatchObject({
      found: true,
      rejected: "sodium_out_of_range",
      published: { description: "Soft drink, cola", score: { fcs: 1, tier: "T1" } }
    });
    // The broken label is not carried alongside the published row: one food, one score.
    expect((body.food as { nutrition: unknown }).nutrition).toBeNull();
    expect((body.food as { name: string }).name).toBe("Coca Cola");
  });

  it("rejects added sugars above total carbohydrate", async () => {
    offProduct({
      product_name: "Sports Drink",
      serving_size: "12 fl oz (355 g)",
      serving_quantity: 355,
      nutriments: {
        "energy-kcal_serving": 80,
        sodium_serving: 0.16,
        "added-sugars_serving": 40,
        carbohydrates_serving: 21
      }
    });

    const body = (await (await lookup("099999900001")).json()) as Record<string, unknown>;
    expect(body.rejected).toBe("sugars_exceed_carbs");
  });

  it("rejects a label with no serving mass to anchor it", async () => {
    offProduct({
      product_name: "Mystery Snack",
      nutriments: { "energy-kcal_serving": 200, sodium_serving: 0.3 }
    });

    const body = (await (await lookup("099999900002")).json()) as Record<string, unknown>;
    expect(body.rejected).toBe("no_serving_size");
  });
});

describe("a product with a published row", () => {
  it("scores Cheerios at the published 77, not the label estimate of 41", async () => {
    offProduct({
      product_name: "Cheerios Cheerios",
      brands: "General Mills",
      serving_size: "1 1/2 cup (39 g)",
      serving_quantity: 39,
      nutriments: {
        "energy-kcal_serving": 140,
        sodium_serving: 0.19,
        "added-sugars_serving": 1,
        sugars_serving: 2,
        carbohydrates_serving: 29,
        proteins_serving: 5,
        fiber_serving: 4,
        fat_serving: 2.5,
        "saturated-fat_serving": 0.5
      }
    });

    const body = (await (await lookup("016000275287")).json()) as Record<string, unknown>;

    expect(body).toMatchObject({
      found: true,
      food: { name: "Cheerios", barcode: "016000275287" },
      published: {
        code: "57123000",
        description: "Cereal (General Mills Cheerios)",
        score: { fcs: 77, band: "encourage", tier: "T1" }
      }
    });
    expect(body.rejected).toBeUndefined();
  });

  it("keeps the label estimate when the product is not the row the name matched", async () => {
    // Same name, a third of the energy: whatever this is, it is not the cereal.
    offProduct({
      product_name: "Cheerios",
      brands: "General Mills",
      serving_size: "1 cup (100 g)",
      serving_quantity: 100,
      nutriments: { "energy-kcal_serving": 90, sodium_serving: 0.19, carbohydrates_serving: 20 }
    });

    const body = (await (await lookup("016000999999")).json()) as Record<string, unknown>;
    expect(body).toMatchObject({ found: true, food: { name: "Cheerios" } });
    expect(body.published).toBeUndefined();
  });
});

describe("a barcode the product databases do not carry", () => {
  it("names the maker so the ask box has somewhere to start", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: 0 }), { status: 200 })));

    const body = (await (await lookup("028400064002")).json()) as Record<string, unknown>;
    expect(body).toEqual({ found: false, brand: "Frito-Lay", prefill: "Frito-Lay" });
  });

  it("says nothing it cannot back up for an unknown prefix", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: 0 }), { status: 200 })));

    const body = (await (await lookup("999999999999")).json()) as Record<string, unknown>;
    expect(body).toEqual({ found: false });
  });
});
