import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  REALTIME_NONCE_TTL_SECONDS,
  issueRealtimeNonce,
  validRealtimeNonce
} from "./realtime-nonce";

describe("realtime page nonce", () => {
  beforeEach(() => {
    vi.stubEnv("REALTIME_NONCE_SECRET", "test-nonce-secret-value");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a nonce it just issued", () => {
    expect(validRealtimeNonce(issueRealtimeNonce())).toBe(true);
  });

  it("issues a different nonce every time", () => {
    expect(issueRealtimeNonce()).not.toBe(issueRealtimeNonce());
  });

  it("refuses nothing, junk, and the wrong shape", () => {
    expect(validRealtimeNonce(undefined)).toBe(false);
    expect(validRealtimeNonce(null)).toBe(false);
    expect(validRealtimeNonce("")).toBe(false);
    expect(validRealtimeNonce("rt1.abc")).toBe(false);
    expect(validRealtimeNonce(`v1.${Math.floor(Date.now() / 1000) + 60}.a.b`)).toBe(false);
  });

  it("refuses a nonce past its expiry", () => {
    const stale = issueRealtimeNonce(Date.now() - (REALTIME_NONCE_TTL_SECONDS + 60) * 1000);
    expect(validRealtimeNonce(stale)).toBe(false);
  });

  it("refuses an expiry further out than we ever issue", () => {
    const nonce = issueRealtimeNonce();
    const overreaching = issueRealtimeNonce(Date.now() + (REALTIME_NONCE_TTL_SECONDS + 600) * 1000);
    expect(validRealtimeNonce(nonce)).toBe(true);
    expect(validRealtimeNonce(overreaching)).toBe(false);
  });

  it("refuses a nonce signed with another deployment's secret", () => {
    const elsewhere = issueRealtimeNonce();
    vi.stubEnv("REALTIME_NONCE_SECRET", "a-different-secret-value");
    expect(validRealtimeNonce(elsewhere)).toBe(false);
  });

  it("falls back to the API key so two instances of one deployment agree", () => {
    vi.stubEnv("REALTIME_NONCE_SECRET", "");
    vi.stubEnv("HEALTH_AI_API_KEY", "sk-test-shared-across-instances");
    const nonce = issueRealtimeNonce();
    expect(validRealtimeNonce(nonce)).toBe(true);

    vi.stubEnv("HEALTH_AI_API_KEY", "sk-test-rotated");
    expect(validRealtimeNonce(nonce)).toBe(false);
  });
});
