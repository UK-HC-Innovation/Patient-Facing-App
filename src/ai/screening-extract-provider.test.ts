import { describe, expect, it } from "vitest";
import { parseExtractionPayload } from "./screening-extract-provider";

// Added 2026-08-04 (spec 17 workstream B, Finding 3). This validator is the only
// thing standing between a model reply and a diabetic-retinopathy grade shown to
// a patient, and it had no test of its own.

function valid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    grade: "moderate_npdr",
    dmePresent: false,
    ungradable: false,
    confidence: "high",
    fieldsRead: ["Grade: moderate NPDR"],
    ...overrides
  };
}

describe("parseExtractionPayload — accepts", () => {
  it("a complete graded extraction", () => {
    expect(parseExtractionPayload(valid())).toEqual({
      grade: "moderate_npdr",
      dmePresent: false,
      ungradable: false,
      confidence: "high",
      fieldsRead: ["Grade: moderate NPDR"]
    });
  });

  it.each(["no_dr", "mild_npdr", "moderate_npdr", "severe_npdr", "pdr"])("the %s grade", (grade) => {
    expect(parseExtractionPayload(valid({ grade }))?.grade).toBe(grade);
  });

  it.each(["not_a_report", "retinal_photograph", "unreadable"])(
    "a %s refusal with a null grade",
    (refusal) => {
      const parsed = parseExtractionPayload(
        valid({ grade: null, dmePresent: null, confidence: "low", fieldsRead: [], refusal })
      );

      expect(parsed?.refusal).toBe(refusal);
      expect(parsed?.grade).toBeNull();
    }
  );

  it("an ungradable sheet with no grade and no refusal", () => {
    expect(parseExtractionPayload(valid({ grade: null, ungradable: true }))?.ungradable).toBe(true);
  });

  it("a null dmePresent", () => {
    expect(parseExtractionPayload(valid({ dmePresent: null }))?.dmePresent).toBeNull();
  });

  it("caps fieldsRead at twelve lines and drops non-strings", () => {
    const parsed = parseExtractionPayload(
      valid({ fieldsRead: [...Array.from({ length: 20 }, (_, i) => `line ${i}`), 42, null] })
    );

    expect(parsed?.fieldsRead).toHaveLength(12);
    expect(parsed?.fieldsRead.every((line) => typeof line === "string")).toBe(true);
  });
});

describe("parseExtractionPayload — rejects", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "moderate_npdr"],
    ["a number", 3],
    ["an array", []]
  ])("%s", (_label, raw) => {
    expect(parseExtractionPayload(raw)).toBeNull();
  });

  it.each([
    ["an invented grade", { grade: "very_bad_npdr" }],
    ["a numeric grade", { grade: 3 }],
    ["a non-boolean dmePresent", { dmePresent: "yes" }],
    ["a missing ungradable", { ungradable: undefined }],
    ["a non-boolean ungradable", { ungradable: "no" }],
    ["an invented confidence", { confidence: "very high" }],
    ["a missing confidence", { confidence: undefined }],
    ["a non-array fieldsRead", { fieldsRead: "Grade: moderate NPDR" }],
    ["a missing fieldsRead", { fieldsRead: undefined }],
    ["an invented refusal", { refusal: "blurry" }]
  ])("%s", (_label, overrides) => {
    expect(parseExtractionPayload(valid(overrides))).toBeNull();
  });

  // The clinical line: a reply that claims success, is not ungradable, and
  // carries no grade would let the UI confirm nothing at all.
  it("a null-grade success that is neither ungradable nor a refusal", () => {
    expect(parseExtractionPayload(valid({ grade: null, ungradable: false }))).toBeNull();
  });

  it("never invents a grade from a refusal reply", () => {
    const parsed = parseExtractionPayload(
      valid({ grade: null, dmePresent: null, confidence: "low", fieldsRead: [], refusal: "retinal_photograph" })
    );

    expect(parsed?.grade).toBeNull();
    expect(parsed?.dmePresent).toBeNull();
  });
});
