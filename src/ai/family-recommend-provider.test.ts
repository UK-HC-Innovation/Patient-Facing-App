import { afterEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_CAREGIVER_TEXT, schoolAgeFamilyState } from "@/domain/family-fixtures";
import { requestFamilyRecommendations } from "./family-recommend-provider";

const request = {
  text: SAMPLE_CAREGIVER_TEXT,
  profile: schoolAgeFamilyState.profile!,
  language: "en" as const,
  candidateIds: ["kde_evaluation_request"]
};
const CONSENT = { consentCapability: "signed-consent-capability" } as const;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("requestFamilyRecommendations", () => {
  it("propagates caller cancellation to the active fetch", async () => {
    const fetchMock = vi.fn((_url: string, options: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        options.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError"))
        );
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const caller = new AbortController();

    const pending = requestFamilyRecommendations(request, { signal: caller.signal, ...CONSENT });
    caller.abort();

    await expect(pending).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
  });

  it("does not start a fetch for an already-cancelled request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const caller = new AbortController();
    caller.abort();

    await expect(
      requestFamilyRecommendations(request, { signal: caller.signal, ...CONSENT })
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when abort-controller setup is unavailable", async () => {
    vi.stubGlobal(
      "AbortController",
      class BrokenAbortController {
        constructor() {
          throw new Error("unavailable");
        }
      }
    );

    await expect(requestFamilyRecommendations(request, CONSENT)).resolves.toBeNull();
  });

  it("sends the capability only as a no-store same-origin header", async () => {
    const result = {
      heard: "You asked for school help.",
      lead: "school_iep",
      recommendations: [
        { id: "kde_evaluation_request", why: "You asked about school support.", urgency: "soon" }
      ]
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ mode: "success", data: result }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestFamilyRecommendations(request, CONSENT)).resolves.toEqual(result);
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Ladder-AI-Consent": "signed-consent-capability"
    });
    expect(options.credentials).toBe("same-origin");
    expect(options.cache).toBe("no-store");
  });

  it("does not start fetch without a memory-only consent capability", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestFamilyRecommendations(request)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
