import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FAMILY_AI_DISCLOSURE_VERSION } from "@/domain/family-ai-consent";
import { useFamilyAiConsentCapability } from "./use-family-ai-consent-capability";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useFamilyAiConsentCapability", () => {
  it("mints, keeps, and revokes a capability only in mounted React memory", async () => {
    const localWrite = vi.spyOn(Storage.prototype, "setItem");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ capability: "signed-capability", expiresAt: Date.now() + 60_000 }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useFamilyAiConsentCapability(true), {
      wrapper: StrictMode
    });

    await act(async () => {
      await expect(result.current.grant()).resolves.toBe("signed-capability");
    });
    expect(result.current.capability).toBe("signed-capability");
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/family/consent");
    expect(JSON.parse(options.body as string)).toEqual({
      disclosureVersion: FAMILY_AI_DISCLOSURE_VERSION
    });
    expect(options.credentials).toBe("same-origin");
    expect(options.cache).toBe("no-store");
    expect(localWrite).not.toHaveBeenCalled();

    act(() => result.current.revoke());
    expect(result.current.capability).toBeNull();
  });

  it("fails closed when disabled or when minting fails", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const disabled = renderHook(() => useFamilyAiConsentCapability(false));
    await act(async () => {
      await expect(disabled.result.current.grant()).resolves.toBeNull();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    disabled.unmount();

    fetchMock.mockResolvedValue(new Response(JSON.stringify({ capability: null }), { status: 503 }));
    const enabled = renderHook(() => useFamilyAiConsentCapability(true));
    await act(async () => {
      await expect(enabled.result.current.grant()).resolves.toBeNull();
    });
    expect(enabled.result.current.error).toBe(true);
  });

  it("aborts an in-flight mint on unmount", async () => {
    let signal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, options: RequestInit) => {
      signal = options.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result, unmount } = renderHook(() => useFamilyAiConsentCapability(true));

    let pending!: Promise<string | null>;
    act(() => {
      pending = result.current.grant();
    });
    unmount();
    expect(signal?.aborted).toBe(true);
    await expect(pending).resolves.toBeNull();
  });

  it("does not mint twice for rapid repeated acceptance", async () => {
    const fetchMock = vi.fn((_url: string, options: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        options.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError"))
        );
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result, unmount } = renderHook(() => useFamilyAiConsentCapability(true));

    let first!: Promise<string | null>;
    let second!: Promise<string | null>;
    act(() => {
      first = result.current.grant();
      second = result.current.grant();
    });
    await expect(second).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    unmount();
    await expect(first).resolves.toBeNull();
  });

  it("clears the bearer when its server expiry arrives", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T12:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ capability: "short-capability", expiresAt: Date.now() + 1_000 }),
          { status: 200 }
        )
      )
    );
    const { result } = renderHook(() => useFamilyAiConsentCapability(true));
    await act(async () => {
      await result.current.grant();
    });
    expect(result.current.capability).toBe("short-capability");

    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.capability).toBeNull();
  });
});
