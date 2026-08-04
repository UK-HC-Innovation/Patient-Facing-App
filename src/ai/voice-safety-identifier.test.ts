import { describe, expect, it } from "vitest";
import { buildVoiceSafetyIdentifier } from "./voice-safety-identifier";

// Added 2026-08-04 (spec 17 workstream B, Finding 3). This helper now runs on all
// seven provider routes after workstream C, and was only ever asserted indirectly
// through a single route test's `toMatch(/^pc_voice_/)`.

describe("buildVoiceSafetyIdentifier", () => {
  it("is stable for the same patient id", () => {
    expect(buildVoiceSafetyIdentifier("patient-1")).toBe(buildVoiceSafetyIdentifier("patient-1"));
  });

  it("differs between patient ids", () => {
    expect(buildVoiceSafetyIdentifier("patient-1")).not.toBe(buildVoiceSafetyIdentifier("patient-2"));
  });

  it("uses the documented prefix and a 32-char digest", () => {
    const id = buildVoiceSafetyIdentifier("patient-1");

    expect(id).toMatch(/^pc_voice_[0-9a-f]{32}$/);
  });

  it("never leaks the patient id in the clear", () => {
    // The whole point of the hash: the raw id must not survive into the header.
    const id = buildVoiceSafetyIdentifier("mrn-8675309");

    expect(id).not.toContain("mrn-8675309");
    expect(id).not.toContain("8675309");
  });

  it("changes when the salt changes", () => {
    expect(buildVoiceSafetyIdentifier("patient-1")).not.toBe(
      buildVoiceSafetyIdentifier("patient-1", "different-salt")
    );
  });

  it("handles the anonymous fallback the family and classify routes pass", () => {
    const id = buildVoiceSafetyIdentifier("anonymous");

    expect(id).toMatch(/^pc_voice_[0-9a-f]{32}$/);
    expect(id).toBe(buildVoiceSafetyIdentifier("anonymous"));
  });

  it("handles empty and unicode ids without throwing", () => {
    expect(buildVoiceSafetyIdentifier("")).toMatch(/^pc_voice_[0-9a-f]{32}$/);
    expect(buildVoiceSafetyIdentifier("paciente-Ñ-1")).toMatch(/^pc_voice_[0-9a-f]{32}$/);
  });
});
