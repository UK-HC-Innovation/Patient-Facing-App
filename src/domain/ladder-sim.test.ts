import { afterEach, describe, expect, it, vi } from "vitest";
import { ladderSimEnabled } from "./ladder-sim";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ladderSimEnabled", () => {
  it("defaults on, so every existing demo behaves exactly as before", () => {
    vi.stubEnv("NEXT_PUBLIC_LADDER_SIM", undefined as unknown as string);
    expect(ladderSimEnabled()).toBe(true);
  });

  it("turns off for the values a person actually writes in an env file", () => {
    for (const value of ["0", "false", "off", "FALSE", " off "]) {
      vi.stubEnv("NEXT_PUBLIC_LADDER_SIM", value);
      expect(ladderSimEnabled(), value).toBe(false);
    }
  });

  it("stays on for anything else, because a typo must not silently ship the simulation off", () => {
    for (const value of ["1", "true", "on", "yes", ""]) {
      vi.stubEnv("NEXT_PUBLIC_LADDER_SIM", value);
      expect(ladderSimEnabled(), value).toBe(true);
    }
  });
});
