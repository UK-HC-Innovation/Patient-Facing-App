import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTest } from "@/server/rate-limit";
import {
  REALTIME_NONCE_HEADER,
  REALTIME_NONCE_TTL_SECONDS,
  issueRealtimeNonce
} from "@/server/realtime-nonce";
import { POST } from "./route";

type RequestOptions = {
  nonce?: string | null;
  origin?: string | null;
  address?: string | null;
};

function makeRequest(body: unknown, options: RequestOptions = {}): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  const nonce = options.nonce === undefined ? issueRealtimeNonce() : options.nonce;
  if (nonce !== null) headers.set(REALTIME_NONCE_HEADER, nonce);
  const origin = options.origin === undefined ? "http://localhost" : options.origin;
  if (origin !== null) headers.set("Origin", origin);
  if (options.address) headers.set("x-forwarded-for", options.address);

  return new Request("http://localhost/api/realtime/token", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

function mockMint(): ReturnType<typeof vi.fn> {
  // A Response body reads once, so every call needs its own.
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ value: "client-secret", expires_at: 123 }), { status: 200 })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function liveEnv(): void {
  vi.stubEnv("HEALTH_AI_PROVIDER", "openai");
  vi.stubEnv("HEALTH_AI_API_KEY", "test-key");
}

describe("realtime token route", () => {
  beforeEach(() => {
    resetRateLimitsForTest();
    // Pins the nonce signing key so issuing and checking agree no matter which env vars a
    // case stubs. Production derives the key from HEALTH_AI_API_KEY when this is unset.
    vi.stubEnv("REALTIME_NONCE_SECRET", "test-nonce-secret-value");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("blocks with 409 when the client attests an open crisis", async () => {
    const response = await POST(makeRequest({ crisisOpen: true }, { nonce: null }));

    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json).toEqual({ mode: "blocked", reason: "open_red_flag" });
  });

  it("refuses a mint with no nonce", async () => {
    liveEnv();
    const fetchMock = mockMint();

    const response = await POST(makeRequest({ crisisOpen: false }, { nonce: null }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ mode: "error", message: "nonce_required" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a mint whose nonce was tampered with or has expired", async () => {
    liveEnv();
    const fetchMock = mockMint();
    const tampered = [...issueRealtimeNonce().split(".").slice(0, 3), "AAAA"].join(".");
    const expired = issueRealtimeNonce(Date.now() - (REALTIME_NONCE_TTL_SECONDS + 60) * 1000);

    const tamperedResponse = await POST(makeRequest({}, { nonce: tampered }));
    const expiredResponse = await POST(makeRequest({}, { nonce: expired }));

    expect(tamperedResponse.status).toBe(401);
    expect(expiredResponse.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a request whose Origin is not one of the deployed hosts", async () => {
    liveEnv();
    const fetchMock = mockMint();

    const response = await POST(makeRequest({}, { origin: "https://evil.example" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      mode: "error",
      message: "origin_not_allowed"
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mints for a valid nonce from an allowed origin", async () => {
    liveEnv();
    const fetchMock = mockMint();

    const response = await POST(makeRequest({ patientId: "patient-1", crisisOpen: false }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.mode).toBe("live");
    expect(json.clientSecret).toBe("client-secret");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still works with DEMO_PASSCODE unset", async () => {
    liveEnv();
    vi.stubEnv("DEMO_PASSCODE", "");
    mockMint();

    const response = await POST(makeRequest({ patientId: "patient-1" }));

    await expect(response.json()).resolves.toMatchObject({
      mode: "live",
      clientSecret: "client-secret"
    });
  });

  it("keeps falling back to mock when DEMO_PASSCODE is set and the request has none", async () => {
    liveEnv();
    vi.stubEnv("DEMO_PASSCODE", "shared-code");
    const fetchMock = mockMint();

    const response = await POST(makeRequest({ patientId: "patient-1" }));

    await expect(response.json()).resolves.toEqual({ mode: "mock", reason: "locked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 429 on the eleventh mint from one address inside ten minutes", async () => {
    liveEnv();
    const fetchMock = mockMint();
    const address = "203.0.113.7";

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const allowed = await POST(makeRequest({ patientId: "patient-1" }, { address }));
      expect(allowed.status).toBe(200);
    }

    const refused = await POST(makeRequest({ patientId: "patient-1" }, { address }));

    expect(refused.status).toBe(429);
    await expect(refused.json()).resolves.toEqual({ mode: "error", message: "rate_limited" });
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(10);

    const otherPhone = await POST(makeRequest({ patientId: "patient-1" }, { address: "198.51.100.4" }));
    expect(otherPhone.status).toBe(200);
  });

  it("stays in mock mode without an OpenAI provider", async () => {
    vi.stubEnv("HEALTH_AI_PROVIDER", "");
    const response = await POST(makeRequest({ crisisOpen: false }));

    const json = await response.json();
    expect(json.mode).toBe("mock");
  });

  it("sends an OpenAI-Safety-Identifier header on the mint request", async () => {
    liveEnv();
    const fetchMock = mockMint();

    const response = await POST(makeRequest({ patientId: "patient-1", crisisOpen: false }));
    const json = await response.json();

    expect(json.mode).toBe("live");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["OpenAI-Safety-Identifier"]).toMatch(/^pc_voice_/);
  });

  it("reports cloud availability without minting a client secret", async () => {
    liveEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest({ patientId: "patient-1", probe: true }));

    await expect(response.json()).resolves.toEqual({ mode: "live", model: "gpt-realtime-2" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets a probe through without a nonce so a page load never turns voice off", async () => {
    liveEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        POST(makeRequest({ probe: true }, { nonce: null, address: "203.0.113.9" }))
      )
    );

    for (const response of responses) {
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ mode: "live", model: "gpt-realtime-2" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the realtime model env override to the mint payload while keeping marin", async () => {
    liveEnv();
    vi.stubEnv("HEALTH_AI_REALTIME_MODEL", "verified-cheap-model");
    const fetchMock = mockMint();

    const response = await POST(makeRequest({ patientId: "patient-1", crisisOpen: false }));
    const json = await response.json();
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(options.body)) as {
      session: { model: string; audio: { output: { voice: string } } };
    };

    expect(json.model).toBe("verified-cheap-model");
    expect(payload.session.model).toBe("verified-cheap-model");
    expect(payload.session.audio.output.voice).toBe("marin");
  });

  it("accepts the nonce in the body for callers that cannot set a header", async () => {
    liveEnv();
    mockMint();
    const nonce = issueRealtimeNonce();

    const response = await POST(makeRequest({ patientId: "patient-1", nonce }, { nonce: null }));

    await expect(response.json()).resolves.toMatchObject({ mode: "live" });
  });
});
