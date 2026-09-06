import { beforeEach, describe, expect, it } from "vitest";
import { RATE_LIMIT_MAX_KEYS, allowWithinWindow, resetRateLimitsForTest } from "./rate-limit";

describe("sliding window rate limit", () => {
  beforeEach(() => {
    resetRateLimitsForTest();
  });

  it("allows the limit and refuses the next one", () => {
    const now = 1_000_000;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(allowWithinWindow("mint", "1.1.1.1", 10, 600_000, now).allowed).toBe(true);
    }
    const refused = allowWithinWindow("mint", "1.1.1.1", 10, 600_000, now);

    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterMs).toBe(600_000);
  });

  it("keys separately by caller and by bucket", () => {
    const now = 1_000_000;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      allowWithinWindow("mint", "1.1.1.1", 10, 600_000, now);
    }

    expect(allowWithinWindow("mint", "2.2.2.2", 10, 600_000, now).allowed).toBe(true);
    expect(allowWithinWindow("probe", "1.1.1.1", 10, 600_000, now).allowed).toBe(true);
  });

  it("frees each hit as it slides out of the window", () => {
    const start = 1_000_000;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      allowWithinWindow("mint", "1.1.1.1", 10, 600_000, start + attempt);
    }
    expect(allowWithinWindow("mint", "1.1.1.1", 10, 600_000, start + 10).allowed).toBe(false);

    // Only the first hit has aged out, so exactly one more gets through.
    expect(allowWithinWindow("mint", "1.1.1.1", 10, 600_000, start + 600_000).allowed).toBe(true);
    expect(allowWithinWindow("mint", "1.1.1.1", 10, 600_000, start + 600_000).allowed).toBe(false);
  });

  it("stops taking new keys rather than evicting a live window", () => {
    const now = 1_000_000;
    for (let key = 0; key < RATE_LIMIT_MAX_KEYS; key += 1) {
      allowWithinWindow("mint", `caller-${key}`, 10, 600_000, now);
    }

    expect(allowWithinWindow("mint", "one-too-many", 10, 600_000, now).allowed).toBe(false);
    expect(allowWithinWindow("mint", "caller-0", 10, 600_000, now).allowed).toBe(true);
  });
});
