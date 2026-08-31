import { describe, expect, it, vi } from "vitest";
import { resolveBarcode, type FoodLookupDeps } from "./food-lookup";
import type { IdentifiedFood } from "./types";

function seedFood(barcode: string, source: IdentifiedFood["source"] = "barcode_seed"): IdentifiedFood {
  return {
    id: barcode,
    barcode,
    name: `Food ${barcode}`,
    brand: null,
    category: null,
    nutrition: null,
    source,
    ingredientText: null
  };
}

function offResponse(name: string) {
  return {
    ok: true,
    json: async () => ({ status: 1, product: { product_name: name, nutriments: {} } })
  } as unknown as Response;
}

function fdcResponse(name: string, barcode: string) {
  return {
    ok: true,
    json: async () => ({ foods: [{ description: name, gtinUpc: barcode, foodNutrients: [] }] })
  } as unknown as Response;
}

function notFoundResponse() {
  return { ok: true, json: async () => ({ status: 0 }) } as unknown as Response;
}

function baseDeps(overrides: Partial<FoodLookupDeps> = {}): FoodLookupDeps {
  return {
    cache: new Map(),
    seed: {},
    fdcApiKey: null,
    ...overrides
  };
}

describe("resolveBarcode", () => {
  it("returns a cache hit without touching the network", async () => {
    const fetchImpl = vi.fn();
    const cache = new Map<string, IdentifiedFood>([["123", seedFood("123")]]);

    const result = await resolveBarcode("123", baseDeps({ cache, fetchImpl: fetchImpl as unknown as typeof fetch }));

    expect(result).toEqual({ found: true, food: seedFood("123") });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns a seed hit before the network and writes through to cache", async () => {
    const fetchImpl = vi.fn();
    const cache = new Map<string, IdentifiedFood>();
    const seed = { "999": seedFood("999") };

    const result = await resolveBarcode("999", baseDeps({ cache, seed, fetchImpl: fetchImpl as unknown as typeof fetch }));

    expect(result).toEqual({ found: true, food: seedFood("999") });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(cache.get("999")).toEqual(seedFood("999"));
  });

  it("uses Open Food Facts when there is no cache or seed hit", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(offResponse("Off Food"));

    const result = await resolveBarcode("555", baseDeps({ fetchImpl: fetchImpl as unknown as typeof fetch }));

    expect(result.found).toBe(true);
    expect(result.found && result.food.source).toBe("barcode_off");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back to FDC when OFF misses and a key is present", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(notFoundResponse())
      .mockResolvedValueOnce(fdcResponse("Fdc Food", "555"));

    const result = await resolveBarcode("555", baseDeps({ fdcApiKey: "DEMO_KEY", fetchImpl: fetchImpl as unknown as typeof fetch }));

    expect(result.found).toBe(true);
    expect(result.found && result.food.source).toBe("barcode_fdc");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("skips FDC when no key is configured", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(notFoundResponse());

    const result = await resolveBarcode("555", baseDeps({ fetchImpl: fetchImpl as unknown as typeof fetch }));

    expect(result).toEqual({ found: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns not found when every source misses", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(notFoundResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => ({ foods: [] }) } as unknown as Response);

    const result = await resolveBarcode("555", baseDeps({ fdcApiKey: "DEMO_KEY", fetchImpl: fetchImpl as unknown as typeof fetch }));

    expect(result).toEqual({ found: false });
  });

  it("swallows a network error and falls through", async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error("boom"));

    const result = await resolveBarcode("555", baseDeps({ fetchImpl: fetchImpl as unknown as typeof fetch }));

    expect(result).toEqual({ found: false });
  });

  it("propagates a caller abort and never falls through from OFF to FDC", async () => {
    const controller = new AbortController();
    let upstreamSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      upstreamSignal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        upstreamSignal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    });
    const lookup = resolveBarcode("555", baseDeps({
      fdcApiKey: "DEMO_KEY",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      signal: controller.signal
    }));

    controller.abort(new DOMException("page hidden", "AbortError"));

    await expect(lookup).rejects.toMatchObject({ name: "AbortError" });
    expect(upstreamSignal?.aborted).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
