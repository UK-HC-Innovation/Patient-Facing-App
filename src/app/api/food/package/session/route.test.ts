import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FOOD_PACKAGE_DISCLOSURE_VERSION,
  FOOD_PACKAGE_SESSION_COOKIE,
  FOOD_PACKAGE_SESSION_ISSUE_LIMIT,
  FOOD_PACKAGE_SESSION_TTL_SECONDS,
  resetFoodPackageAuthStateForTest
} from "@/server/food-package-auth";
import { GET, POST } from "./route";

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
  vi.useRealTimers();
  resetFoodPackageAuthStateForTest();
  vi.unstubAllEnvs();
});

function sessionRequest(
  body: unknown,
  headers: Record<string, string> = {}
): Request {
  return new Request("https://ladder.test/api/food/package/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://ladder.test",
      "Sec-Fetch-Site": "same-origin",
      ...headers
    },
    body: JSON.stringify(body)
  });
}

function validSessionRequest(passcode = "invite-code"): Request {
  return sessionRequest({
    passcode,
    disclosureVersion: FOOD_PACKAGE_DISCLOSURE_VERSION
  });
}

describe("food package session route", () => {
  it("fails closed before reading a body when the feature is disabled", async () => {
    vi.stubEnv("FOOD_PACKAGE_SCAN_ENABLED", "0");
    const pending = validSessionRequest();

    const response = await POST(pending);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authorized: false, mode: "disabled" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(pending.bodyUsed).toBe(false);
  });

  it("reports enabled-but-incomplete configuration without reading a credential", async () => {
    vi.stubEnv("HEALTH_AI_PACKAGE_MODEL", "");
    const pending = validSessionRequest();

    const response = await POST(pending);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ authorized: false, mode: "unconfigured" });
    expect(pending.bodyUsed).toBe(false);
  });

  it("rejects cross-site exchange before reading the invite", async () => {
    const pending = validSessionRequest();
    pending.headers.set("Sec-Fetch-Site", "cross-site");

    const response = await POST(pending);

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(pending.bodyUsed).toBe(false);
  });

  it("requires the current package-image disclosure version", async () => {
    const response = await POST(
      sessionRequest({ passcode: "invite-code", disclosureVersion: "old-disclosure" })
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("locks a wrong invite and exchanges a valid one for a scoped HttpOnly cookie", async () => {
    const wrong = await POST(validSessionRequest("wrong"));
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ authorized: false, mode: "locked" });
    expect(wrong.headers.get("set-cookie")).toBeNull();

    const response = await POST(validSessionRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authorized: true, expiresAt: expect.any(Number) });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toMatch(
      new RegExp(
        `^${FOOD_PACKAGE_SESSION_COOKIE}=.*; Path=/api/food/package; HttpOnly; SameSite=Strict; Max-Age=${FOOD_PACKAGE_SESSION_TTL_SECONDS}`
      )
    );
  });

  it("attests session responses only when a release evaluator injects a run secret", async () => {
    vi.stubEnv("PACKAGE_LABEL_EVAL_ATTESTATION", "opaque-eval-run");
    vi.stubEnv("PACKAGE_LABEL_EVAL_SOURCE_REVISION", "commit+dirty.hash");
    vi.stubEnv("PACKAGE_LABEL_EVAL_BUILD_ID", "build-12345678");

    const response = await POST(validSessionRequest());

    expect(response.headers.get("X-Ladder-Eval-Attestation")).toBe("opaque-eval-run");
    expect(response.headers.get("X-Ladder-Eval-Source-Revision")).toBe("commit+dirty.hash");
    expect(response.headers.get("X-Ladder-Eval-Build-Id")).toBe("build-12345678");
  });

  it("reports an existing valid cookie without exposing or refreshing its token", async () => {
    const exchange = await POST(validSessionRequest());
    const cookie = exchange.headers.get("set-cookie")!.split(";", 1)[0];
    const status = await GET(
      new Request("https://ladder.test/api/food/package/session", {
        headers: {
          Cookie: cookie,
          Origin: "https://ladder.test",
          "Sec-Fetch-Site": "same-origin"
        }
      })
    );

    expect(await status.json()).toEqual({ authorized: true, expiresAt: expect.any(Number) });
    expect(status.headers.get("set-cookie")).toBeNull();
    expect(status.headers.get("cache-control")).toBe("no-store");
  });

  it("expires status at the signed credential boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
    const exchange = await POST(validSessionRequest());
    const cookie = exchange.headers.get("set-cookie")!.split(";", 1)[0];
    vi.advanceTimersByTime(FOOD_PACKAGE_SESSION_TTL_SECONDS * 1_000);

    const status = await GET(
      new Request("https://ladder.test/api/food/package/session", {
        headers: {
          Cookie: cookie,
          Origin: "https://ladder.test",
          "Sec-Fetch-Site": "same-origin"
        }
      })
    );

    expect(await status.json()).toEqual({ authorized: false });
  });

  it("enforces the one-kilobyte streaming body cap", async () => {
    const oversized = validSessionRequest("x".repeat(1_100));
    const response = await POST(oversized);

    expect(response.status).toBe(413);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rate-limits invite attempts before reading the next credential body", async () => {
    for (let attempt = 0; attempt < FOOD_PACKAGE_SESSION_ISSUE_LIMIT; attempt += 1) {
      expect((await POST(validSessionRequest("wrong"))).status).toBe(401);
    }
    const pending = validSessionRequest();
    const response = await POST(pending);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(pending.bodyUsed).toBe(false);
  });
});
