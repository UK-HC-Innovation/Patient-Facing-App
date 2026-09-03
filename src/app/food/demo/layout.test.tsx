import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { metadata } from "./layout";

describe("the public door's installed identity", () => {
  // Next merges metadata field by field, so anything this layout leaves undeclared silently
  // keeps the patient app's value. Declaring only the title once left the shareable link
  // installing as "My Health" and opening /today.
  it("names its own manifest and icon rather than inheriting the patient app's", () => {
    expect(metadata.manifest).toBe("/food-lens.webmanifest");
    expect(metadata.icons).toEqual({ icon: "/food-lens-icon.svg" });
  });

  it("ships a manifest that opens the food demo, not the blood-pressure app", () => {
    const manifest = JSON.parse(readFileSync("public/food-lens.webmanifest", "utf8"));
    expect(manifest.start_url).toBe("/food/demo");
    expect(manifest.name).toBe("1 good choice");
    expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual(["/food-lens-icon.svg"]);
    // Narrower scope would push the /compass redirect out of the installed window.
    expect(manifest.scope).toBe("/");
  });
});
