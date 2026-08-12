import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FAMILY_AI_SESSION_COOKIE,
  FAMILY_AI_SESSION_ISSUE_LIMIT,
  resetFamilyAiRateLimitsForTest
} from "@/server/family-ai-auth";
import { GET, POST } from "./route";

beforeEach(() => {
  vi.stubEnv("HEALTH_AI_PROVIDER", "openai");
  vi.stubEnv("HEALTH_AI_API_KEY", "provider-key");
  vi.stubEnv("DEMO_PASSCODE", "invite-code");
  vi.stubEnv("FAMILY_AI_SESSION_SECRET", "test-session-secret-that-is-at-least-32-bytes");
  resetFamilyAiRateLimitsForTest();
});

afterEach(() => vi.unstubAllEnvs());

function inviteRequest(passcode: string): Request {
  return new Request("https://ladder.test/api/family/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode })
  });
}

describe("family AI session route", () => {
  it("exchanges a credential-only body for an HttpOnly cookie", async () => {
    const response = await POST(inviteRequest("invite-code"));
    expect(await response.json()).toEqual({ authorized: true, expiresAt: expect.any(Number) });
    expect(response.headers.get("set-cookie")).toMatch(
      new RegExp(`^${FAMILY_AI_SESSION_COOKIE}=.*HttpOnly; SameSite=Strict`)
    );
  });

  it("rejects a wrong invite and fails closed without auth configuration", async () => {
    expect((await POST(inviteRequest("wrong"))).status).toBe(401);
    vi.stubEnv("FAMILY_AI_SESSION_SECRET", "");
    expect((await POST(inviteRequest("invite-code"))).status).toBe(503);
  });

  it("rejects a cross-site exchange before reading the invite", async () => {
    const pending = inviteRequest("invite-code");
    pending.headers.set("Sec-Fetch-Site", "cross-site");

    const response = await POST(pending);

    expect(response.status).toBe(403);
    expect(pending.bodyUsed).toBe(false);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("reports an existing valid cookie without returning the token to script", async () => {
    const exchange = await POST(inviteRequest("invite-code"));
    const cookie = exchange.headers.get("set-cookie")!.split(";", 1)[0];
    const status = await GET(
      new Request("https://ladder.test/api/family/session", { headers: { Cookie: cookie } })
    );

    expect(await status.json()).toEqual({ authorized: true, expiresAt: expect.any(Number) });
    expect(status.headers.get("set-cookie")).toBeNull();
  });

  it("limits invite attempts before reading another credential body", async () => {
    for (let attempt = 0; attempt < FAMILY_AI_SESSION_ISSUE_LIMIT; attempt += 1) {
      expect((await POST(inviteRequest("wrong"))).status).toBe(401);
    }
    const pending = inviteRequest("invite-code");
    const response = await POST(pending);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(pending.bodyUsed).toBe(false);
  });
});
