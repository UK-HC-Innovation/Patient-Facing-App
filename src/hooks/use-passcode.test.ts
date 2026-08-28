import { afterEach, describe, expect, it } from "vitest";
import { readPasscode } from "./use-passcode";

afterEach(() => {
  window.history.replaceState({}, "", "/food");
});

describe("readPasscode", () => {
  it("reads the demo passcode off the launch URL", () => {
    window.history.replaceState({}, "", "/food?k=Tama");
    expect(readPasscode()).toBe("Tama");
  });

  it("is undefined with no passcode, which is how production runs", () => {
    window.history.replaceState({}, "", "/food/demo");
    expect(readPasscode()).toBeUndefined();
  });

  it("survives other query parameters", () => {
    window.history.replaceState({}, "", "/food/demo?lang=es&k=Tama");
    expect(readPasscode()).toBe("Tama");
  });

  it("reports an empty passcode as the empty string, which every caller must treat as absent", () => {
    window.history.replaceState({}, "", "/food?k=");
    // URLSearchParams gives back "", not null. Pinning the real value rather than a coerced
    // one, because five call sites read this and one of them sending "" to a passcode-gated
    // route would lock half the surface while the rest stayed open.
    expect(readPasscode()).toBe("");
  });
});
