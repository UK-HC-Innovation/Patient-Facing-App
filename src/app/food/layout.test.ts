import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { metadata } from "./layout";

describe("1 good choice route identity", () => {
  it("uses the new name and a complete social preview", () => {
    expect(metadata.title).toBe("1 good choice");
    expect(metadata.openGraph).toMatchObject({
      title: "1 good choice",
      images: [
        {
          url: "https://patient-centered.vercel.app/og.png",
          width: 1200,
          height: 630
        }
      ]
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "1 good choice"
    });
    expect(existsSync("public/og.png")).toBe(true);
  });
});
