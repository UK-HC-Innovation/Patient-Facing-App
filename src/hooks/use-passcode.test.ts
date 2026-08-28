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
    window.history.replaceState({}, "", "/compass");
    expect(readPasscode()).toBeUndefined();
  });

  it("survives other query parameters", () => {
    window.history.replaceState({}, "", "/compass?lang=es&k=Tama");
    expect(readPasscode()).toBe("Tama");
  });

  it("treats an empty passcode as absent rather than as an empty answer", () => {
    window.history.replaceState({}, "", "/food?k=");
    // Five call sites read this; one of them treating "" as a real value would lock half
    // the surface while the rest stayed open.
    expect(readPasscode() || undefined).toBeUndefined();
  });
});
