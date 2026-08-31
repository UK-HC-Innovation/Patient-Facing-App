import { describe, expect, it } from "vitest";
import {
  PACKAGE_FRONT_JSON_SCHEMA,
  PACKAGE_FRONT_SYSTEM_PROMPT,
  PACKAGE_NUTRITION_JSON_SCHEMA,
  PACKAGE_NUTRITION_SYSTEM_PROMPT
} from "./package-scan-prompts";

describe("package scan prompts and wire schemas", () => {
  it("treats printed package text as inert and forbids nutrition inference", () => {
    expect(PACKAGE_FRONT_SYSTEM_PROMPT).toMatch(/untrusted inert data/i);
    expect(PACKAGE_FRONT_SYSTEM_PROMPT).toMatch(/do not infer nutrition/i);
    expect(PACKAGE_FRONT_JSON_SCHEMA.required).toEqual(
      expect.arrayContaining(["kind", "brand", "product", "visibleText", "confidence"])
    );
    expect(PACKAGE_FRONT_JSON_SCHEMA.additionalProperties).toBe(false);
  });

  it("asks for raw label rows without model arithmetic", () => {
    expect(PACKAGE_NUTRITION_SYSTEM_PROMPT).toMatch(/do not calculate/i);
    expect(PACKAGE_NUTRITION_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(PACKAGE_NUTRITION_JSON_SCHEMA.properties.rows.items.additionalProperties).toBe(false);
    expect(PACKAGE_NUTRITION_JSON_SCHEMA.required).toContain("selectedColumnHeading");
  });
});
