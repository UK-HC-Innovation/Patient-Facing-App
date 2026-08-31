import React, { StrictMode, type PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FoodAuthority } from "@/domain/food-authority";
import type { PackageNutritionDraft } from "@/domain/package-scan";
import type { IdentifiedFood } from "@/domain/types";
import { usePackageScan } from "./use-package-scan";

const draft: PackageNutritionDraft = {
  servingSize: "1 oz (28 g)",
  servingGrams: 28,
  servingsPerContainer: "4",
  selectedColumnHeading: "Amount per serving",
  nutrition: {
    servingSize: "1 oz (28 g)",
    servingGrams: 28,
    basis: "per_serving",
    calories: 130,
    sodiumMg: 180,
    potassiumMg: null,
    totalSugarsG: 2,
    addedSugarsG: 0,
    saturatedFatG: 1,
    fiberG: 5,
    proteinG: 13,
    carbsG: 11,
    totalFatG: 5,
    monoFatG: null,
    polyFatG: null,
    transFatG: 0,
    cholesterolMg: 0,
    calciumMg: null,
    ironMg: null
  },
  rows: [],
  unusableRows: [],
  omittedFields: [],
  ingredientText: "soybeans, sunflower oil, ranch seasoning",
  warnings: [],
  includedDomains: ["D1", "D3", "D8"],
  carveOut: null,
  confidence: 0.96
};

const barcodeFood: IdentifiedFood = {
  id: "barcode:123",
  barcode: "123",
  name: "Crunchy Edamame Ranch",
  brand: "The Only Bean",
  category: "Bean snacks",
  nutrition: draft.nutrition,
  source: "barcode_off",
  ingredientText: draft.ingredientText
};

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function harness(options: { strict?: boolean; captureDetailedFrame?: () => Promise<string | null> } = {}) {
  let epoch = 0;
  const authority: FoodAuthority = {
    get epoch() {
      return epoch;
    },
    snapshot: () => epoch,
    isCurrent: (candidate) => candidate === epoch,
    invalidate: () => {
      epoch += 1;
      return epoch;
    }
  };
  const suspendLive = vi.fn(() => {
    authority.invalidate();
  });
  const resumeLive = vi.fn(() => {
    authority.invalidate();
  });
  const useHarness = () => usePackageScan({
      enabled: true,
      authority,
      passcode: "invite",
      patientId: "p1",
      captureDetailedFrame: options.captureDetailedFrame ?? (async () => "data:image/jpeg;base64,photo"),
      suspendLive,
      resumeLive
    });
  const StrictWrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;
  const hook = options.strict
    ? renderHook(useHarness, { wrapper: StrictWrapper })
    : renderHook(useHarness);
  return { ...hook, authority, suspendLive, resumeLive };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("usePackageScan", () => {
  it("publishes no label food until identity and nutrition are separately confirmed", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/session")) return Promise.resolve(response({ authorized: true, expiresAt: Date.now() + 60_000 }));
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (body.kind === "front") {
        return Promise.resolve(response({
          mode: "front",
          candidate: {
            brand: "The Only Bean",
            product: "Crunchy Edamame",
            flavor: "Ranch",
            displayName: "The Only Bean Crunchy Edamame Ranch",
            visibleText: ["Crunchy Edamame", "Ranch"],
            confidence: 0.96,
            quality: "good"
          }
        }));
      }
      return Promise.resolve(response({ mode: "nutrition", draft }));
    });
    const { result } = harness();

    act(() => result.current.begin());
    expect(result.current.state.session.status).toBe("disclosure");
    await act(async () => result.current.authorize());
    expect(result.current.state.session.status).toBe("ready");

    await act(async () => result.current.scanFront());
    expect(result.current.state.identity.status).toBe("review");
    expect(result.current.state.resolvedFood).toBeNull();
    act(() => result.current.confirmIdentity("The Only Bean Crunchy Edamame Ranch"));
    expect(result.current.state.identity.status).toBe("confirmed");
    expect(result.current.state.resolvedFood).toBeNull();

    await act(async () => result.current.scanNutrition());
    expect(result.current.state.nutrition.status).toBe("review");
    expect(result.current.state.resolvedFood).toBeNull();
    act(() => result.current.confirmNutrition());
    expect(result.current.state.resolvedFood).toMatchObject({
      name: "Crunchy Edamame Ranch",
      brand: "The Only Bean",
      source: "label_vision"
    });

    fetchMock.mockResolvedValueOnce(response({ found: false }));
    await act(async () => result.current.onBarcodeDetected("000"));
    expect(result.current.state.barcode.status).toBe("miss");
    expect(result.current.state.resolvedFood?.source).toBe("label_vision");
  });

  it("keeps a barcode result as an unscored candidate until confirmation", async () => {
    fetchMock.mockResolvedValue(response({ found: true, food: barcodeFood }));
    const { result } = harness();

    await act(async () => result.current.onBarcodeDetected("123"));
    expect(result.current.state.barcode.status).toBe("review");
    expect(result.current.state.resolvedFood).toBeNull();
    act(() => result.current.confirmBarcode());
    expect(result.current.state.barcode.status).toBe("confirmed");
    expect(result.current.state.resolvedFood?.id).toBe(barcodeFood.id);
  });

  it("pins the same barcode for the package session but lets a different code take over", async () => {
    const secondFood = { ...barcodeFood, id: "barcode:456", barcode: "456", name: "Different product" };
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve(response({ found: true, food: String(input).endsWith("456") ? secondFood : barcodeFood }))
    );
    const { result } = harness();

    await act(async () => result.current.onBarcodeDetected("123"));
    act(() => result.current.confirmBarcode());
    expect(result.current.state.barcode.status).toBe("confirmed");

    await act(async () => result.current.onBarcodeDetected("123"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.state.barcode.status).toBe("confirmed");

    await act(async () => result.current.onBarcodeDetected("456"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.state.barcode).toMatchObject({ status: "review", code: "456" });
    expect(result.current.state.resolvedFood).toBeNull();
  });

  it("lets the same barcode retry after a transient lookup error", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ invalid: true }))
      .mockResolvedValueOnce(response({ found: true, food: barcodeFood }));
    const { result } = harness();

    await act(async () => result.current.onBarcodeDetected("123"));
    expect(result.current.state.barcode).toEqual({ status: "error", code: "123" });

    await act(async () => result.current.onBarcodeDetected("123"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.state.barcode).toMatchObject({ status: "review", code: "123" });
  });

  it("lets the same barcode retry after a label action aborts its pending lookup", async () => {
    let barcodeSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/session")) {
        return Promise.resolve(response({ authorized: true, expiresAt: Date.now() + 60_000 }));
      }
      if (url.includes("/lookup?")) {
        barcodeSignal = init?.signal as AbortSignal | undefined;
        return new Promise<Response>((_resolve, reject) => {
          barcodeSignal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
        });
      }
      return Promise.resolve(response({ mode: "needs_rescan", kind: "front", reason: "poor_quality" }));
    });
    const { result } = harness();
    act(() => result.current.begin());
    await act(async () => result.current.authorize());
    let lookup = Promise.resolve();
    act(() => {
      lookup = result.current.onBarcodeDetected("123");
    });
    await act(async () => Promise.resolve());

    await act(async () => result.current.scanFront());
    await act(async () => lookup);
    expect(barcodeSignal?.aborted).toBe(true);

    fetchMock.mockResolvedValueOnce(response({ found: true, food: barcodeFood }));
    await act(async () => result.current.onBarcodeDetected("123"));
    expect(result.current.state.barcode).toMatchObject({ status: "review", code: "123" });
  });

  it("preserves review state while reauthorizing after a package-route 401", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ authorized: true, expiresAt: Date.now() + 60_000 }))
      .mockResolvedValueOnce(response({ mode: "locked" }, 401))
      .mockResolvedValueOnce(response({ authorized: true, expiresAt: Date.now() + 120_000 }));
    const { result } = harness();
    act(() => result.current.begin());
    await act(async () => result.current.authorize());

    await act(async () => result.current.scanFront());
    expect(result.current.state.session.status).toBe("error");
    expect(result.current.state.identity.status).toBe("needs_rescan");

    await act(async () => result.current.authorize());
    expect(result.current.state.session.status).toBe("ready");
    expect(result.current.state.identity.status).toBe("needs_rescan");
  });

  it("leaves interrupted authorization recoverable after a barcode miss", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/session")) {
        return new Promise<Response>((_resolve, reject) => {
          (init?.signal as AbortSignal | undefined)?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true }
          );
        });
      }
      return Promise.resolve(response({ found: false }));
    });
    const { result } = harness();
    act(() => result.current.begin());
    let authorization = Promise.resolve();
    act(() => {
      authorization = result.current.authorize();
    });
    await act(async () => Promise.resolve());
    expect(result.current.state.session.status).toBe("authorizing");

    await act(async () => result.current.onBarcodeDetected("123"));
    await act(async () => authorization);

    expect(result.current.state.barcode.status).toBe("miss");
    expect(result.current.state.session.status).toBe("error");
    expect(result.current.state.session).toMatchObject({ message: expect.stringMatching(/interrupted/i) });
  });

  it("reauthorizes an expired local session before preparing or sending an image", async () => {
    fetchMock.mockResolvedValue(response({ authorized: true, expiresAt: Date.now() + 1_000 }));
    const captureDetailedFrame = vi.fn(async () => "data:image/jpeg;base64,photo");
    const { result } = harness({ captureDetailedFrame });
    act(() => result.current.begin());
    await act(async () => result.current.authorize());

    await act(async () => result.current.scanNutrition());

    expect(result.current.state.session.status).toBe("error");
    expect(captureDetailedFrame).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores a front response that arrives after cancel invalidates authority", async () => {
    let releaseFront: (response: Response) => void = () => undefined;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input).endsWith("/session")) {
        return Promise.resolve(response({ authorized: true, expiresAt: Date.now() + 60_000 }));
      }
      return new Promise<Response>((resolve) => {
        releaseFront = resolve;
      });
    });
    const { result } = harness();
    act(() => result.current.begin());
    await act(async () => result.current.authorize());

    let scanPromise: Promise<void> = Promise.resolve();
    act(() => {
      scanPromise = result.current.scanFront();
    });
    act(() => result.current.cancel());
    await act(async () => {
      releaseFront(response({ mode: "front", candidate: { displayName: "Wrong late result" } }));
      await scanPromise;
    });
    expect(result.current.state.active).toBe(false);
    expect(result.current.state.identity.status).toBe("idle");
  });

  it("leaves the reading state after image preparation fails", async () => {
    fetchMock.mockResolvedValue(response({ authorized: true, expiresAt: Date.now() + 60_000 }));
    const { result } = harness({ captureDetailedFrame: async () => null });
    act(() => result.current.begin());
    await act(async () => result.current.authorize());

    await act(async () => result.current.scanFront());

    expect(result.current.state.identity.status).toBe("needs_rescan");
    expect(result.current.state.error).toMatch(/could not prepare/i);
  });

  it("commits async results under React Strict Effects", async () => {
    fetchMock.mockResolvedValue(response({ authorized: true, expiresAt: Date.now() + 60_000 }));
    const { result } = harness({ strict: true });
    act(() => result.current.begin());

    await act(async () => result.current.authorize());

    expect(result.current.state.session.status).toBe("ready");
  });

  it("resumes the live lens when a standalone barcode candidate is rejected", async () => {
    fetchMock.mockResolvedValue(response({ found: true, food: barcodeFood }));
    const { result, resumeLive } = harness();
    await act(async () => result.current.onBarcodeDetected("123"));

    act(() => result.current.rejectBarcode());

    expect(result.current.state.active).toBe(false);
    expect(result.current.state.barcode.status).toBe("idle");
    expect(resumeLive).toHaveBeenCalledTimes(1);
  });

  it("aborts an in-flight front scan when a barcode takes authority", async () => {
    let packageSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/session")) return Promise.resolve(response({ authorized: true, expiresAt: Date.now() + 60_000 }));
      if (url.includes("/lookup?")) return Promise.resolve(response({ found: true, food: barcodeFood }));
      packageSignal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        packageSignal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    });
    const { result } = harness();
    act(() => result.current.begin());
    await act(async () => result.current.authorize());
    let front: Promise<void> = Promise.resolve();
    act(() => {
      front = result.current.scanFront();
    });
    await act(async () => Promise.resolve());

    await act(async () => result.current.onBarcodeDetected("123"));
    await act(async () => front);

    expect(packageSignal?.aborted).toBe(true);
    expect(result.current.state.identity.status).toBe("needs_rescan");
    expect(result.current.state.barcode.status).toBe("review");
  });

  it("aborts and unsticks a package request after an external authority transition", async () => {
    let packageSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/session")) return Promise.resolve(response({ authorized: true, expiresAt: Date.now() + 60_000 }));
      packageSignal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        packageSignal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    });
    const { result, authority, rerender } = harness();
    act(() => result.current.begin());
    await act(async () => result.current.authorize());
    let front: Promise<void> = Promise.resolve();
    act(() => {
      front = result.current.scanFront();
    });
    await act(async () => Promise.resolve());

    act(() => {
      authority.invalidate();
      rerender();
    });
    await act(async () => front);

    expect(packageSignal?.aborted).toBe(true);
    expect(result.current.state.identity.status).toBe("needs_rescan");
  });
});
