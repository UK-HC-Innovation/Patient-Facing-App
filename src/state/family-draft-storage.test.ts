import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllFamilyDrafts,
  familyDraftStorageKey,
  loadFamilyDraft,
  saveFamilyDraft,
  tombstoneFamilyDraft
} from "./family-draft-storage";

describe("family draft storage", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a versioned caregiver-scoped recovery record", () => {
    saveFamilyDraft("patient-a", "Words still being written", new Date("2026-08-08T12:00:00.000Z"));

    expect(loadFamilyDraft("patient-a")).toBe("Words still being written");
    expect(loadFamilyDraft("patient-b")).toBeNull();
    expect(JSON.parse(localStorage.getItem(familyDraftStorageKey("patient-a")) ?? "null")).toEqual({
      version: 1,
      format: "ladder-family-draft",
      patientId: "patient-a",
      status: "active",
      draft: "Words still being written",
      updatedAt: "2026-08-08T12:00:00.000Z"
    });
  });

  it("uses a cleared tombstone so an older full-state checkpoint cannot resurrect text", () => {
    tombstoneFamilyDraft("patient-a", new Date("2026-08-08T12:00:00.000Z"));

    expect(loadFamilyDraft("patient-a")).toBe("");
    expect(JSON.parse(localStorage.getItem(familyDraftStorageKey("patient-a")) ?? "null")).toEqual({
      version: 1,
      format: "ladder-family-draft",
      patientId: "patient-a",
      status: "cleared",
      updatedAt: "2026-08-08T12:00:00.000Z"
    });
  });

  it("rejects malformed records and clears all scoped drafts", () => {
    localStorage.setItem(familyDraftStorageKey("patient-a"), JSON.stringify({ version: 99, draft: "stale" }));
    expect(loadFamilyDraft("patient-a")).toBeNull();

    saveFamilyDraft("patient-a", "A");
    saveFamilyDraft("patient-b", "B");
    localStorage.setItem("unrelated", "keep");
    clearAllFamilyDrafts();
    expect(loadFamilyDraft("patient-a")).toBeNull();
    expect(loadFamilyDraft("patient-b")).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });
});
