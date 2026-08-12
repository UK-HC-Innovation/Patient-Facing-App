import { act, renderHook, waitFor } from "@testing-library/react";
import React, { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFamilyAiSession } from "@/hooks/use-family-ai-session";

beforeEach(() => {
  window.history.replaceState({}, "", "/ladder");
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useFamilyAiSession", () => {
  it("completes one deferred invite exchange under React Strict Mode", async () => {
    window.history.replaceState({}, "", "/ladder#invite=strict-secret");
    let resolveResponse!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );

    const { result } = renderHook(() => useFamilyAiSession(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current).toBe("checking");
    resolveResponse(
      new Response(JSON.stringify({ authorized: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    await waitFor(() => expect(result.current).toBe("authorized"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/family/session",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ passcode: "strict-secret" })
      })
    );
    expect(window.location.href).not.toContain("strict-secret");
  });

  it("ignores and scrubs a legacy query-string invite", async () => {
    window.history.replaceState({}, "", "/ladder?k=secret&surface=notes#family-journal");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ authorized: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useFamilyAiSession());
    await waitFor(() => expect(result.current).toBe("unavailable"));

    expect(window.location.href).not.toContain("secret");
    expect(window.location.search).toBe("?surface=notes");
    expect(window.location.hash).toBe("#family-journal");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/family/session",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("supports a fragment invite so the credential is absent from the HTTP URL", async () => {
    window.history.replaceState({}, "", "/ladder?surface=home#invite=fragment-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ authorized: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    const { result } = renderHook(() => useFamilyAiSession());
    await waitFor(() => expect(result.current).toBe("authorized"));
    expect(window.location.href).not.toContain("fragment-secret");
    expect(window.location.search).toBe("?surface=home");
  });

  it("checks an existing HttpOnly session without offering an unverified capability", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ authorized: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useFamilyAiSession());
    expect(result.current).toBe("checking");
    await waitFor(() => expect(result.current).toBe("unavailable"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/family/session",
      expect.objectContaining({ method: "GET", credentials: "same-origin" })
    );
  });

  it("stands the capability down when the signed session expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T04:00:00.000Z"));
    window.history.replaceState({}, "", "/ladder#invite=short-session");
    const expiresAt = Date.now() + 1_000;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ authorized: true, expiresAt }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useFamilyAiSession());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current).toBe("authorized");

    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(result.current).toBe("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
