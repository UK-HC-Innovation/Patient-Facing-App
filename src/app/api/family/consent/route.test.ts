import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FAMILY_AI_DISCLOSURE_VERSION } from "@/domain/family-ai-consent";
import {
  FAMILY_AI_SESSION_COOKIE,
  authorizeFamilyAiConsent,
  createFamilyAiSessionToken
} from "@/server/family-ai-auth";
import { POST } from "./route";

function consentRequest(body: unknown, authorized = true): Request {
  const token = authorized ? createFamilyAiSessionToken() : null;
  return new Request("http://localhost/api/family/consent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Cookie: `${FAMILY_AI_SESSION_COOKIE}=${token}` } : {})
    },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  process.env.HEALTH_AI_PROVIDER = "openai";
  process.env.HEALTH_AI_API_KEY = "test-key";
  process.env.DEMO_PASSCODE = "invite-code";
  process.env.FAMILY_AI_SESSION_SECRET = "test-session-secret-that-is-at-least-32-bytes";
});

afterEach(() => {
  delete process.env.HEALTH_AI_PROVIDER;
  delete process.env.HEALTH_AI_API_KEY;
  delete process.env.DEMO_PASSCODE;
  delete process.env.FAMILY_AI_SESSION_SECRET;
});

describe("family AI consent route", () => {
  it("mints a no-store capability bound to the same short-lived session", async () => {
    const request = consentRequest({ disclosureVersion: FAMILY_AI_DISCLOSURE_VERSION });
    const response = await POST(request);
    const payload = (await response.json()) as { capability: string; expiresAt: number };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.expiresAt).toBeGreaterThan(Date.now());
    request.headers.set("X-Ladder-AI-Consent", payload.capability);
    expect(authorizeFamilyAiConsent(request, "interview")).toBe(true);
  });

  it("rejects missing sessions before reading the acknowledgement body", async () => {
    const request = consentRequest(
      { disclosureVersion: FAMILY_AI_DISCLOSURE_VERSION },
      false
    );
    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(request.bodyUsed).toBe(false);
  });

  it("rejects stale disclosure versions and unconfigured deployments", async () => {
    const stale = await POST(consentRequest({ disclosureVersion: "old" }));
    expect(stale.status).toBe(400);

    process.env.HEALTH_AI_API_KEY = "";
    const unconfigured = await POST(
      consentRequest({ disclosureVersion: FAMILY_AI_DISCLOSURE_VERSION })
    );
    expect(unconfigured.status).toBe(503);
  });
});
