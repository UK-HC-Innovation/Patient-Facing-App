import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FOOD_PACKAGE_MAX_BODY_BYTES,
  FOOD_PACKAGE_DISCLOSURE_VERSION,
  FOOD_PACKAGE_RATE_MAX_KEYS,
  FOOD_PACKAGE_SESSION_COOKIE,
  FOOD_PACKAGE_SESSION_TTL_SECONDS,
  acquireFoodPackageConcurrencyLease,
  allowFoodPackageProviderRequest,
  allowFoodPackageSessionIssuance,
  authorizeFoodPackageRequest,
  createFoodPackageSessionToken,
  foodPackageProviderConfig,
  foodPackageServiceStatus,
  foodPackageSessionCookie,
  foodPackageSessionTokenExpiresAt,
  readBoundedFoodPackageJson,
  resetFoodPackageAuthStateForTest,
  validFoodPackageInvite,
  validFoodPackageSessionToken
} from "@/server/food-package-auth";

const TOKEN_TIME_MS = 1_000_000;

beforeEach(() => {
  vi.stubEnv("FOOD_PACKAGE_SCAN_ENABLED", "1");
  vi.stubEnv("HEALTH_AI_PROVIDER", "openai");
  vi.stubEnv("HEALTH_AI_API_KEY", "provider-key");
  vi.stubEnv("HEALTH_AI_PACKAGE_MODEL", "gpt-5.6-luna");
  vi.stubEnv("DEMO_PASSCODE", "invite-code");
  vi.stubEnv("FOOD_PACKAGE_SESSION_SECRET", "test-session-secret-that-is-at-least-32-bytes");
  resetFoodPackageAuthStateForTest();
});

afterEach(() => {
  resetFoodPackageAuthStateForTest();
  vi.unstubAllEnvs();
});

function authorizedRequest(args: {
  token?: string;
  source?: string;
  nowMs?: number;
} = {}): Request {
  const token = args.token ?? createFoodPackageSessionToken(args.nowMs ?? TOKEN_TIME_MS)!;
  return new Request("https://ladder.test/api/food/package", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${FOOD_PACKAGE_SESSION_COOKIE}=${token}`,
      Origin: "https://ladder.test",
      "Sec-Fetch-Site": "same-origin",
      ...(args.source ? { "x-vercel-forwarded-for": args.source } : {})
    },
    body: "{}"
  });
}

function issuanceRequest(source: string): Request {
  return new Request("https://ladder.test/api/food/package/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://ladder.test",
      "Sec-Fetch-Site": "same-origin",
      "x-vercel-forwarded-for": source
    },
    body: "{}"
  });
}

describe("food package configuration and credentials", () => {
  it("distinguishes an off feature from incomplete provider or auth configuration", () => {
    expect(foodPackageServiceStatus()).toBe("ready");
    expect(foodPackageProviderConfig()).toEqual({
      apiKey: "provider-key",
      model: "gpt-5.6-luna"
    });

    vi.stubEnv("FOOD_PACKAGE_SCAN_ENABLED", "0");
    expect(foodPackageServiceStatus()).toBe("disabled");
    expect(foodPackageProviderConfig()).toBeNull();

    vi.stubEnv("FOOD_PACKAGE_SCAN_ENABLED", "1");
    vi.stubEnv("HEALTH_AI_PACKAGE_MODEL", "");
    expect(foodPackageServiceStatus()).toBe("unconfigured");

    vi.stubEnv("HEALTH_AI_PACKAGE_MODEL", "gpt-5.6-luna");
    vi.stubEnv("FOOD_PACKAGE_SESSION_SECRET", "too-short");
    expect(foodPackageServiceStatus()).toBe("unconfigured");
  });

  it("compares the invite and issues a signed, expiring session cookie", () => {
    expect(validFoodPackageInvite("invite-code")).toBe(true);
    expect(validFoodPackageInvite("invite-codf")).toBe(false);

    const token = createFoodPackageSessionToken(TOKEN_TIME_MS)!;
    expect(token).toContain(`v2.${FOOD_PACKAGE_DISCLOSURE_VERSION}.`);
    const expiresAt = TOKEN_TIME_MS + FOOD_PACKAGE_SESSION_TTL_SECONDS * 1_000;
    expect(validFoodPackageSessionToken(token, TOKEN_TIME_MS + 1)).toBe(true);
    expect(foodPackageSessionTokenExpiresAt(token, TOKEN_TIME_MS + 1)).toBe(expiresAt);

    const replacement = token.endsWith("a") ? "b" : "a";
    expect(validFoodPackageSessionToken(`${token.slice(0, -1)}${replacement}`, TOKEN_TIME_MS + 1)).toBe(
      false
    );
    expect(validFoodPackageSessionToken(token, Number.NaN)).toBe(false);
    expect(validFoodPackageSessionToken(token, expiresAt)).toBe(false);
    expect(foodPackageSessionCookie(token)).toMatch(
      new RegExp(
        `^${FOOD_PACKAGE_SESSION_COOKIE}=.*; Path=/api/food/package; HttpOnly; SameSite=Strict; Max-Age=${FOOD_PACKAGE_SESSION_TTL_SECONDS}`
      )
    );
  });

  it("requires the signed cookie and same-origin request", () => {
    expect(authorizeFoodPackageRequest(authorizedRequest(), TOKEN_TIME_MS + 1)).toBe(true);

    const crossSite = authorizedRequest();
    crossSite.headers.set("Sec-Fetch-Site", "cross-site");
    expect(authorizeFoodPackageRequest(crossSite, TOKEN_TIME_MS + 1)).toBe(false);

    const wrongOrigin = authorizedRequest();
    wrongOrigin.headers.set("Origin", "https://attacker.test");
    expect(authorizeFoodPackageRequest(wrongOrigin, TOKEN_TIME_MS + 1)).toBe(false);

    const missingOrigin = authorizedRequest();
    missingOrigin.headers.delete("Origin");
    expect(authorizeFoodPackageRequest(missingOrigin, TOKEN_TIME_MS + 1)).toBe(false);

    const missingFetchMetadata = authorizedRequest();
    missingFetchMetadata.headers.delete("Sec-Fetch-Site");
    expect(authorizeFoodPackageRequest(missingFetchMetadata, TOKEN_TIME_MS + 1)).toBe(false);

    vi.stubEnv("FOOD_PACKAGE_SCAN_ENABLED", "0");
    expect(authorizeFoodPackageRequest(authorizedRequest(), TOKEN_TIME_MS + 1)).toBe(false);
  });
});

describe("food package request bounds", () => {
  it("uses a four-million-byte general cap and streams JSON within an explicit cap", async () => {
    expect(FOOD_PACKAGE_MAX_BODY_BYTES).toBe(4_000_000);
    await expect(readBoundedFoodPackageJson(authorizedRequest(), 32)).resolves.toEqual({
      ok: true,
      value: {}
    });

    const oversized = new Request("https://ladder.test/api/food/package", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(40) })
    });
    await expect(readBoundedFoodPackageJson(oversized, 32)).resolves.toEqual({
      ok: false,
      status: 413
    });
  });

  it("rejects unsupported content and malformed JSON", async () => {
    const text = new Request("https://ladder.test/api/food/package", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{}"
    });
    await expect(readBoundedFoodPackageJson(text)).resolves.toEqual({ ok: false, status: 415 });

    const malformed = new Request("https://ladder.test/api/food/package", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{"
    });
    await expect(readBoundedFoodPackageJson(malformed)).resolves.toEqual({
      ok: false,
      status: 400
    });
  });
});

describe("food package rate and concurrency gates", () => {
  it("shares issuance attempts by source but keys provider allowance to the session", () => {
    const source = issuanceRequest("203.0.113.10");
    expect(allowFoodPackageSessionIssuance(source, 1_000, 1)).toBe(true);
    expect(allowFoodPackageSessionIssuance(source, 1_001, 1)).toBe(false);

    const firstSession = authorizedRequest({ source: "203.0.113.10" });
    expect(allowFoodPackageProviderRequest(firstSession, TOKEN_TIME_MS + 1, 1)).toBe(true);
    expect(allowFoodPackageProviderRequest(firstSession, TOKEN_TIME_MS + 2, 1)).toBe(false);

    const secondSession = authorizedRequest({ source: "203.0.113.10" });
    expect(allowFoodPackageProviderRequest(secondSession, TOKEN_TIME_MS + 2, 1)).toBe(true);
  });

  it("bounds attacker-controlled issuance keys and reclaims expired buckets", () => {
    for (let index = 0; index < FOOD_PACKAGE_RATE_MAX_KEYS; index += 1) {
      const third = Math.floor(index / 256);
      const fourth = index % 256;
      expect(
        allowFoodPackageSessionIssuance(
          issuanceRequest(`198.18.${third}.${fourth}`),
          1_000,
          1,
          60_000
        )
      ).toBe(true);
    }
    expect(
      allowFoodPackageSessionIssuance(issuanceRequest("203.0.113.200"), 1_001, 1, 60_000)
    ).toBe(false);
    expect(
      allowFoodPackageSessionIssuance(issuanceRequest("203.0.113.200"), 61_001, 1, 60_000)
    ).toBe(true);
  });

  it("denies unauthorized work and releases per-session and process slots idempotently", () => {
    const unauthorized = new Request("https://ladder.test/api/food/package", {
      headers: { Origin: "https://ladder.test" }
    });
    expect(acquireFoodPackageConcurrencyLease(unauthorized, TOKEN_TIME_MS + 1)).toBeNull();

    const firstSession = authorizedRequest();
    const secondSession = authorizedRequest();
    const thirdSession = authorizedRequest();
    const first = acquireFoodPackageConcurrencyLease(firstSession, TOKEN_TIME_MS + 1, 2, 1);
    expect(first).not.toBeNull();
    expect(
      acquireFoodPackageConcurrencyLease(firstSession, TOKEN_TIME_MS + 1, 2, 1)
    ).toBeNull();

    const second = acquireFoodPackageConcurrencyLease(secondSession, TOKEN_TIME_MS + 1, 2, 1);
    expect(second).not.toBeNull();
    expect(
      acquireFoodPackageConcurrencyLease(thirdSession, TOKEN_TIME_MS + 1, 2, 1)
    ).toBeNull();

    first?.release();
    first?.release();
    const third = acquireFoodPackageConcurrencyLease(thirdSession, TOKEN_TIME_MS + 1, 2, 1);
    expect(third).not.toBeNull();
    second?.release();
    third?.release();
  });
});
