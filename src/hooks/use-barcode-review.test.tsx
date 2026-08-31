import React, { StrictMode, type PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FoodAuthority } from "@/domain/food-authority";
import type { IdentifiedFood } from "@/domain/types";
import { useBarcodeReview } from "./use-barcode-review";

const barcodeFood: IdentifiedFood = {
  id: "barcode:123",
  barcode: "123",
  name: "Crunchy Edamame Ranch",
  brand: "The Only Bean",
  category: "Bean snacks",
  nutrition: null,
  source: "barcode_off",
  ingredientText: null
};

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function harness(initialBarcode: string | null = null, enabled = true, strict = false) {
  let barcode = initialBarcode;
  let isEnabled = enabled;
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
  const suspendLive = vi.fn(() => authority.invalidate());
  const resumeLive = vi.fn(() => authority.invalidate());
  const StrictWrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;
  const hook = renderHook(
    () => useBarcodeReview({
      enabled: isEnabled,
      barcode,
      authority,
      suspendLive,
      resumeLive
    }),
    strict ? { wrapper: StrictWrapper } : undefined
  );
  return {
    ...hook,
    authority,
    resumeLive,
    suspendLive,
    setBarcode(next: string | null) {
      barcode = next;
      hook.rerender();
    },
    setEnabled(next: boolean) {
      isEnabled = next;
      hook.rerender();
    }
  };
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

describe("useBarcodeReview", () => {
  it("keeps a database hit unscored until explicit confirmation", async () => {
    fetchMock.mockResolvedValue(response({ found: true, food: barcodeFood }));
    const { result, setBarcode } = harness();

    act(() => setBarcode("123"));
    await waitFor(() => expect(result.current.state.status).toBe("review"));
    expect(result.current.state.resolvedFood).toBeNull();

    act(() => result.current.confirm());
    expect(result.current.state.status).toBe("confirmed");
    expect(result.current.state.resolvedFood?.id).toBe("barcode:123");
  });

  it("keeps a mount-time lookup alive through React Strict Effects cleanup", async () => {
    let resolveLookup: (value: Response) => void = () => undefined;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => {
      resolveLookup = resolve;
    }));
    const { result } = harness("123", true, true);

    await act(async () => {
      resolveLookup(response({ found: true, food: barcodeFood }));
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.state.status).toBe("review"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.state.resolvedFood).toBeNull();
  });

  it("preserves a candidate after the barcode leaves the frame", async () => {
    fetchMock.mockResolvedValue(response({ found: true, food: barcodeFood }));
    const { result, setBarcode } = harness("123");
    await waitFor(() => expect(result.current.state.status).toBe("review"));

    act(() => setBarcode(null));
    expect(result.current.state).toMatchObject({ status: "review", code: "123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lets a different barcode preempt the prior review", async () => {
    const secondFood = { ...barcodeFood, id: "barcode:456", barcode: "456", name: "Roasted Chickpeas" };
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve(response({ found: true, food: String(input).endsWith("456") ? secondFood : barcodeFood }))
    );
    const { result, setBarcode } = harness("123");
    await waitFor(() => expect(result.current.state.status).toBe("review"));

    act(() => setBarcode("456"));
    await waitFor(() => expect(result.current.state).toMatchObject({ status: "review", code: "456" }));
    expect(result.current.state.resolvedFood).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("cannot commit a stale response after cancel", async () => {
    let resolveLookup: (value: Response) => void = () => undefined;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => {
      resolveLookup = resolve;
    }));
    const { result, setBarcode, resumeLive } = harness();
    act(() => setBarcode("123"));
    await waitFor(() => expect(result.current.state.status).toBe("looking_up"));

    act(() => result.current.cancel());
    await act(async () => {
      resolveLookup(response({ found: true, food: barcodeFood }));
      await Promise.resolve();
    });
    expect(result.current.state.status).toBe("idle");
    expect(resumeLive).toHaveBeenCalledTimes(1);
  });

  it("retries only after an explicit action and never scores a miss", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ found: false }))
      .mockResolvedValueOnce(response({ found: true, food: barcodeFood }));
    const { result } = harness("123");
    await waitFor(() => expect(result.current.state.status).toBe("miss"));
    expect(result.current.state.resolvedFood).toBeNull();
    await act(async () => result.current.retry());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.state.status).toBe("review");
  });

  it("does no lookup when disabled", async () => {
    const { result } = harness("123", false);
    await act(async () => Promise.resolve());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe("idle");
  });
});
