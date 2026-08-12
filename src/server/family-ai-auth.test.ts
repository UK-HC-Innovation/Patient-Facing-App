import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FAMILY_AI_SESSION_COOKIE,
  FAMILY_AI_CONSENT_HEADER,
  FAMILY_AI_RATE_MAX_KEYS,
  allowFamilyAiRequest,
  allowFamilyAiSessionIssuance,
  authorizeFamilyAiRequest,
  authorizeFamilyAiConsent,
  createFamilyAiConsentCapability,
  createFamilyAiSessionToken,
  familyAiSessionCookie,
  familyAiSessionTokenExpiresAt,
  readBoundedFamilyJson,
  resetFamilyAiRateLimitsForTest,
  validFamilyAiSessionToken
} from "@/server/family-ai-auth";

beforeEach(() => {
  process.env.DEMO_PASSCODE = "invite-code";
  process.env.FAMILY_AI_SESSION_SECRET = "test-session-secret-that-is-at-least-32-bytes";
  resetFamilyAiRateLimitsForTest();
});

afterEach(() => {
  delete process.env.DEMO_PASSCODE;
  delete process.env.FAMILY_AI_SESSION_SECRET;
});

function authorizedRequest(body = "{}", source?: string): Request {
  const token = createFamilyAiSessionToken(1_000_000)!;
  return new Request("https://ladder.test/api/family/interview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${FAMILY_AI_SESSION_COOKIE}=${token}`,
      Origin: "https://ladder.test",
      "Sec-Fetch-Site": "same-origin",
      ...(source ? { "x-vercel-forwarded-for": source } : {})
    },
    body
  });
}

describe("family AI authorization", () => {
  it("issues signed, expiring, HttpOnly session credentials", () => {
    const token = createFamilyAiSessionToken(1_000_000)!;
    expect(validFamilyAiSessionToken(token, 1_000_001)).toBe(true);
    expect(familyAiSessionTokenExpiresAt(token, 1_000_001)).toBe(2_800_000);
    expect(validFamilyAiSessionToken(`${token.slice(0, -1)}x`, 1_000_001)).toBe(false);
    expect(validFamilyAiSessionToken(token, 1_000_000 + 31 * 60 * 1000)).toBe(false);
    expect(familyAiSessionCookie(token)).toMatch(/HttpOnly; SameSite=Strict/);
  });

  it("requires a same-origin request with the signed cookie", () => {
    expect(authorizeFamilyAiRequest(authorizedRequest(), 1_000_001)).toBe(true);
    const crossSite = authorizedRequest();
    crossSite.headers.set("Sec-Fetch-Site", "cross-site");
    expect(authorizeFamilyAiRequest(crossSite, 1_000_001)).toBe(false);
  });

  it("binds signed consent capabilities to the session, disclosure, purposes, and expiry", () => {
    const request = authorizedRequest();
    const capability = createFamilyAiConsentCapability(request, undefined, 1_000_001);
    expect(capability).not.toBeNull();
    request.headers.set(FAMILY_AI_CONSENT_HEADER, capability!);

    expect(authorizeFamilyAiConsent(request, "interview", 1_000_001)).toBe(true);
    expect(authorizeFamilyAiConsent(request, "recommend", 1_000_001)).toBe(true);

    const interviewOnly = createFamilyAiConsentCapability(
      request,
      undefined,
      1_000_001,
      ["interview"]
    );
    request.headers.set(FAMILY_AI_CONSENT_HEADER, interviewOnly!);
    expect(authorizeFamilyAiConsent(request, "interview", 1_000_001)).toBe(true);
    expect(authorizeFamilyAiConsent(request, "recommend", 1_000_001)).toBe(false);
    request.headers.set(FAMILY_AI_CONSENT_HEADER, capability!);

    const otherSession = authorizedRequest();
    otherSession.headers.set(FAMILY_AI_CONSENT_HEADER, capability!);
    expect(authorizeFamilyAiConsent(otherSession, "interview", 1_000_001)).toBe(false);

    request.headers.set(FAMILY_AI_CONSENT_HEADER, `${capability!.slice(0, -1)}x`);
    expect(authorizeFamilyAiConsent(request, "interview", 1_000_001)).toBe(false);
    request.headers.set(FAMILY_AI_CONSENT_HEADER, capability!);
    expect(authorizeFamilyAiConsent(request, "interview", 2_800_001)).toBe(false);
    expect(createFamilyAiConsentCapability(request, "old-disclosure", 1_000_001)).toBeNull();
  });

  it("reads JSON with content-type and byte limits", async () => {
    await expect(readBoundedFamilyJson(authorizedRequest('{"ok":true}'), 32)).resolves.toEqual({
      ok: true,
      value: { ok: true }
    });
    await expect(readBoundedFamilyJson(authorizedRequest("x".repeat(33)), 32)).resolves.toEqual({
      ok: false,
      status: 413
    });
    const text = authorizedRequest("plain");
    text.headers.set("Content-Type", "text/plain");
    await expect(readBoundedFamilyJson(text)).resolves.toEqual({ ok: false, status: 415 });
  });

  it("limits a session without exposing its cookie as the rate key", () => {
    const request = authorizedRequest();
    expect(allowFamilyAiRequest(request, 1_000, 2, 60_000)).toBe(true);
    expect(allowFamilyAiRequest(request, 1_001, 2, 60_000)).toBe(true);
    expect(allowFamilyAiRequest(request, 1_002, 2, 60_000)).toBe(false);
    expect(allowFamilyAiRequest(request, 61_001, 2, 60_000)).toBe(true);
  });

  it("shares provider and issuance budgets across fresh cookies from one source", () => {
    expect(allowFamilyAiRequest(authorizedRequest("{}", "203.0.113.10"), 1_000, 2)).toBe(true);
    expect(allowFamilyAiRequest(authorizedRequest("{}", "203.0.113.10"), 1_001, 2)).toBe(true);
    expect(allowFamilyAiRequest(authorizedRequest("{}", "203.0.113.10"), 1_002, 2)).toBe(false);
    expect(allowFamilyAiRequest(authorizedRequest("{}", "203.0.113.11"), 1_002, 2)).toBe(true);

    const source = authorizedRequest("{}", "203.0.113.10");
    expect(allowFamilyAiSessionIssuance(source, 2_000, 1, 60_000)).toBe(true);
    expect(allowFamilyAiSessionIssuance(source, 2_001, 1, 60_000)).toBe(false);
    expect(allowFamilyAiSessionIssuance(source, 62_001, 1, 60_000)).toBe(true);
  });

  it("bounds active rate keys and admits new sources after expiration", () => {
    for (let index = 0; index < FAMILY_AI_RATE_MAX_KEYS; index += 1) {
      const third = Math.floor(index / 256);
      const fourth = index % 256;
      expect(
        allowFamilyAiRequest(authorizedRequest("{}", `198.18.${third}.${fourth}`), 1_000, 1, 60_000)
      ).toBe(true);
    }
    expect(allowFamilyAiRequest(authorizedRequest("{}", "203.0.113.200"), 1_001, 1, 60_000)).toBe(false);
    expect(allowFamilyAiRequest(authorizedRequest("{}", "203.0.113.200"), 61_001, 1, 60_000)).toBe(true);
  });
});
