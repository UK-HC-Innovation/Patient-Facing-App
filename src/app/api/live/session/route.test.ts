import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTest } from "@/server/rate-limit";
import { REALTIME_NONCE_HEADER, issueRealtimeNonce } from "@/server/realtime-nonce";
import { POST as startTokenRequest } from "../../realtime/token/route";
import { POST } from "./route";

const OFFER = "v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n";
const ANSWER = "v=0\r\no=- 1 2 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\n";

const START = {
  sdp: OFFER,
  instructions: "Speak briefly.",
  language: "en",
  patientId: "patient-1",
  crisisOpen: false
};

type RequestOptions = { nonce?: string | null; origin?: string | null; address?: string };

function request(url: string, body: unknown, options: RequestOptions = {}): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  const nonce = options.nonce === undefined ? issueRealtimeNonce() : options.nonce;
  if (nonce !== null) headers.set(REALTIME_NONCE_HEADER, nonce);
  const origin = options.origin === undefined ? "http://localhost" : options.origin;
  if (origin !== null) headers.set("Origin", origin);
  if (options.address) headers.set("x-forwarded-for", options.address);
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) });
}

function startRequest(body: unknown, options: RequestOptions = {}): Request {
  return request("http://localhost/api/live/session", body, options);
}

function upstream(response: () => Response = () =>
  new Response(JSON.stringify({ session: { id: "live_123" }, transport: { type: "webrtc", sdp: ANSWER } }), {
    status: 200
  })
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string) =>
    url.includes("/v1/realtime/client_secrets")
      ? new Response(JSON.stringify({ value: "client-secret", expires_at: 123 }), { status: 200 })
      : response()
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function liveEnv(languages = "en"): void {
  vi.stubEnv("HEALTH_AI_PROVIDER", "openai");
  vi.stubEnv("HEALTH_AI_API_KEY", "test-key");
  vi.stubEnv("HEALTH_AI_LIVE_LANGUAGES", languages);
  vi.stubEnv("DEMO_PASSCODE", "");
}

describe("live session route", () => {
  beforeEach(() => {
    resetRateLimitsForTest();
    vi.stubEnv("REALTIME_NONCE_SECRET", "test-nonce-secret-value");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("blocks an open crisis before any other check", async () => {
    liveEnv();
    const fetchMock = upstream();

    const response = await POST(startRequest({ ...START, crisisOpen: true }, { nonce: null, origin: "https://evil.example" }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ mode: "blocked", reason: "open_red_flag" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses another site's page", async () => {
    liveEnv();
    const fetchMock = upstream();

    const response = await POST(startRequest(START, { origin: "https://evil.example" }));

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a start that never loaded our page", async () => {
    liveEnv();
    const fetchMock = upstream();

    const response = await POST(startRequest(START, { nonce: null }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ mode: "error", message: "nonce_required" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers mock on a build with no provider, with no key, or without the passcode", async () => {
    const fetchMock = upstream();

    vi.stubEnv("HEALTH_AI_PROVIDER", "mock");
    await expect((await POST(startRequest(START))).json()).resolves.toEqual({ mode: "mock", reason: "provider_mock" });

    vi.stubEnv("HEALTH_AI_PROVIDER", "openai");
    vi.stubEnv("HEALTH_AI_API_KEY", "");
    await expect((await POST(startRequest(START))).json()).resolves.toEqual({ mode: "mock", reason: "no_api_key" });

    liveEnv();
    vi.stubEnv("DEMO_PASSCODE", "shared-code");
    await expect((await POST(startRequest(START))).json()).resolves.toEqual({ mode: "mock", reason: "locked" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses when the Live engine is off for this language", async () => {
    const fetchMock = upstream();

    liveEnv("");
    const off = await POST(startRequest(START));
    expect(off.status).toBe(409);
    await expect(off.json()).resolves.toEqual({ mode: "error", message: "live_engine_off" });

    liveEnv("en");
    const spanish = await POST(startRequest({ ...START, language: "es" }));
    expect(spanish.status).toBe(409);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a body that is not an offer, and one with no instructions", async () => {
    liveEnv();
    const fetchMock = upstream();

    expect((await POST(startRequest({ ...START, sdp: "hello" }))).status).toBe(400);
    expect((await POST(startRequest({ ...START, sdp: `v=0${"a".repeat(70_000)}` }))).status).toBe(400);
    expect((await POST(startRequest({ ...START, instructions: "   " }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts a client-delegation session with the offer and nothing else", async () => {
    liveEnv();
    const fetchMock = upstream();

    const response = await POST(startRequest(START));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      mode: "live",
      engine: "live",
      model: "gpt-live-1",
      sessionId: "live_123",
      sdp: ANSWER
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/live/sessions");
    expect(options.method).toBe("POST");
    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["OpenAI-Safety-Identifier"]).toMatch(/^pc_voice_/);
    // Exactly this shape: OpenAI rejects unknown fields, and `store` would keep a recording.
    expect(JSON.parse(String(options.body))).toEqual({
      session: {
        model: "gpt-live-1",
        instructions: "Speak briefly.",
        audio: { output: { voice: "marin" } },
        delegation: { type: "client" }
      },
      transport: { type: "webrtc", sdp: OFFER }
    });
  });

  it("starts Spanish when Spanish is switched on, and passes a model override", async () => {
    liveEnv("en,es");
    vi.stubEnv("HEALTH_AI_LIVE_MODEL", "gpt-live-1-2026-09-10");
    const fetchMock = upstream();

    const response = await POST(startRequest({ ...START, language: "es" }));

    await expect(response.json()).resolves.toMatchObject({ mode: "live", model: "gpt-live-1-2026-09-10" });
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body)).session.model).toBe("gpt-live-1-2026-09-10");
  });

  it("answers 502 when OpenAI refuses, sends no answer, or cannot be reached", async () => {
    liveEnv();

    upstream(() => new Response(JSON.stringify({ error: { message: "nope" } }), { status: 400 }));
    const refused = await POST(startRequest(START));
    expect(refused.status).toBe(502);
    await expect(refused.json()).resolves.toEqual({ mode: "error", message: "session_request_failed" });

    upstream(() => new Response(JSON.stringify({ session: { id: "live_123" } }), { status: 200 }));
    const noAnswer = await POST(startRequest(START));
    expect(noAnswer.status).toBe(502);
    await expect(noAnswer.json()).resolves.toEqual({ mode: "error", message: "no_session" });

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    const unreachable = await POST(startRequest(START));
    expect(unreachable.status).toBe(502);
    await expect(unreachable.json()).resolves.toEqual({ mode: "error", message: "session_request_error" });
  });

  it("shares one spend window with the realtime token route", async () => {
    liveEnv();
    upstream();
    const address = "203.0.113.30";

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const minted = await startTokenRequest(
        request("http://localhost/api/realtime/token", { patientId: "patient-1" }, { address })
      );
      expect(minted.status).toBe(200);
    }

    const refused = await POST(startRequest(START, { address }));
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
