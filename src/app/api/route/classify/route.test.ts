import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const ALLOWED = ["/plan", "/glucose"];

function request(body: unknown): Request {
  return new Request("http://localhost/api/route/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function toolCall(args: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(args) } }] } }]
    }),
    { status: 200 }
  );
}

function configureLiveProvider(): void {
  vi.stubEnv("HEALTH_AI_PROVIDER", "openai");
  vi.stubEnv("HEALTH_AI_API_KEY", "test-key");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("route classify route", () => {
  it("defers to the coach without calling the provider when the utterance or hrefs are empty", async () => {
    configureLiveProvider();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(POST(request({ utterance: "", allowedHrefs: ALLOWED })).then((r) => r.json())).resolves.toEqual({
      kind: "coach",
      confidence: 0
    });
    await expect(POST(request({ utterance: "open my plan", allowedHrefs: [] })).then((r) => r.json())).resolves.toEqual({
      kind: "coach",
      confidence: 0
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("defers to the coach without calling the provider when no live provider is configured", async () => {
    vi.stubEnv("HEALTH_AI_PROVIDER", "");
    vi.stubEnv("HEALTH_AI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ utterance: "open my plan", allowedHrefs: ALLOWED }));

    await expect(response.json()).resolves.toEqual({ kind: "coach", confidence: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Drift fix (spec 17 workstream C): classify is reached on every home-composer
  // submission and was the only credit-spending route with no passcode gate.
  it("spends no credits when DEMO_PASSCODE is set and the request omits or fails it", async () => {
    configureLiveProvider();
    vi.stubEnv("DEMO_PASSCODE", "secret");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      POST(request({ utterance: "open my plan", allowedHrefs: ALLOWED })).then((r) => r.json())
    ).resolves.toEqual({ kind: "coach", confidence: 0 });
    await expect(
      POST(request({ utterance: "open my plan", allowedHrefs: ALLOWED, passcode: "wrong" })).then((r) => r.json())
    ).resolves.toEqual({ kind: "coach", confidence: 0 });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls the provider when the passcode matches and sends a safety identifier", async () => {
    configureLiveProvider();
    vi.stubEnv("DEMO_PASSCODE", "secret");
    const fetchMock = vi.fn().mockResolvedValue(toolCall({ kind: "navigate", href: "/plan", confidence: 0.9 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({ utterance: "open my plan", allowedHrefs: ALLOWED, passcode: "secret" })
    );

    await expect(response.json()).resolves.toEqual({ kind: "navigate", href: "/plan", confidence: 0.9 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["OpenAI-Safety-Identifier"]).toBeTruthy();
  });

  it("calls the provider with no passcode gate when DEMO_PASSCODE is unset (local dev)", async () => {
    configureLiveProvider();
    const fetchMock = vi.fn().mockResolvedValue(toolCall({ kind: "coach", confidence: 0.4 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ utterance: "why is my sugar high", allowedHrefs: ALLOWED }));

    await expect(response.json()).resolves.toEqual({ kind: "coach", confidence: 0.4 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("defers to the coach when the provider errors or replies off-shape", async () => {
    configureLiveProvider();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    await expect(
      POST(request({ utterance: "open my plan", allowedHrefs: ALLOWED })).then((r) => r.json())
    ).resolves.toEqual({ kind: "coach", confidence: 0 });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(
      POST(request({ utterance: "open my plan", allowedHrefs: ALLOWED })).then((r) => r.json())
    ).resolves.toEqual({ kind: "coach", confidence: 0 });
  });

  it("never returns an href outside the allowed list", async () => {
    configureLiveProvider();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(toolCall({ kind: "navigate", href: "/evil", confidence: 0.99 }))
    );

    const response = await POST(request({ utterance: "open my plan", allowedHrefs: ALLOWED }));

    // The href is dropped and the decision downgrades to `coach`; the model's own
    // confidence rides along, so assert on the shape rather than the number.
    const decision = (await response.json()) as { kind: string; href?: string };
    expect(decision.kind).toBe("coach");
    expect(decision.href).toBeUndefined();
  });
});
