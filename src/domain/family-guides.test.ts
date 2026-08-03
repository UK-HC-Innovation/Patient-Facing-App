import { describe, expect, it } from "vitest";
import { FAMILY_GUIDE_CATALOG, GUIDE_STRIP_LIMIT, matchFamilyGuides } from "./family-guides";
import type { FamilyProfile } from "./types";

const NOW = new Date("2026-07-17T12:00:00.000Z");

// Age in months at NOW is (2026 - birthYear) * 12 + (7 - birthMonth).
function profileAged(months: number): FamilyProfile {
  const birth = new Date(Date.UTC(2026, 6 - months, 1));
  return {
    birthYear: birth.getUTCFullYear(),
    birthMonth: birth.getUTCMonth() + 1,
    schoolStage: "not_school_age",
    county: "Scott",
    diagnoses: []
  };
}

describe("family guide catalog integrity", () => {
  it("uses unique stable ids and dated, cited, https provenance", () => {
    const ids = FAMILY_GUIDE_CATALOG.map((guide) => guide.id);

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const guide of FAMILY_GUIDE_CATALOG) {
      expect(guide.sourceName.length).toBeGreaterThan(0);
      expect(() => new URL(guide.sourceUrl)).not.toThrow();
      expect(new URL(guide.sourceUrl).protocol).toBe("https:");
      expect(guide.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(guide.verifiedAt))).toBe(false);
      expect(Date.parse(guide.verifiedAt)).toBeLessThanOrEqual(Date.parse("2026-07-25"));
    }
  });

  it("keeps every guide short, imperative, and pointed at a real domain", () => {
    for (const guide of FAMILY_GUIDE_CATALOG) {
      expect(guide.title.length).toBeGreaterThan(0);
      expect(guide.plainSummary.length).toBeGreaterThan(0);
      expect(guide.domains.length).toBeGreaterThan(0);
      expect(new Set(guide.domains).size).toBe(guide.domains.length);
      expect(guide.steps.length).toBeGreaterThanOrEqual(3);
      expect(guide.steps.length).toBeLessThanOrEqual(4);
      for (const step of guide.steps) {
        expect(step.trim().length).toBeGreaterThan(0);
      }
      expect(new Set(guide.steps).size).toBe(guide.steps.length);
      if (guide.ages?.min !== undefined && guide.ages.max !== undefined) {
        expect(guide.ages.min).toBeLessThan(guide.ages.max);
      }
    }
  });

  // The verified-or-absent rule: nothing ships with an unchecked link. When a
  // future seed is bot-blocked it carries humanVerify and the card says so.
  it("ships no unchecked seeds in this catalog", () => {
    expect(FAMILY_GUIDE_CATALOG.filter((guide) => guide.humanVerify === true)).toHaveLength(0);
  });
});

describe("matchFamilyGuides", () => {
  it("returns only guides that carry the lead domain", () => {
    const matched = matchFamilyGuides(profileAged(24), "early_intervention", NOW);

    expect(matched.map((guide) => guide.id)).toEqual(["firststeps_family_guide"]);
  });

  it("honors the age band on both edges", () => {
    // firststeps_family_guide is 0–36 months.
    expect(matchFamilyGuides(profileAged(36), "early_intervention", NOW).map(({ id }) => id)).toEqual([
      "firststeps_family_guide"
    ]);
    expect(matchFamilyGuides(profileAged(37), "early_intervention", NOW)).toEqual([]);
    // medline_speech_home is 12–72 months.
    expect(matchFamilyGuides(profileAged(11), "therapies", NOW)).toEqual([]);
    expect(matchFamilyGuides(profileAged(12), "therapies", NOW).map(({ id }) => id)).toEqual([
      "medline_speech_home"
    ]);
  });

  it("caps the strip at two guides in catalog order", () => {
    const matched = matchFamilyGuides(profileAged(30), "diagnosis_education", NOW);

    expect(matched).toHaveLength(GUIDE_STRIP_LIMIT);
    // Three diagnosis_education guides match at 30 months; the catalog order wins.
    expect(matched.map((guide) => guide.id)).toEqual(["cdc_milestones_help", "cdc_milestone_tracker"]);
  });

  it("keeps the direct service guide first and adds neutral education", () => {
    const matched = matchFamilyGuides(
      profileAged(48),
      ["therapies", "diagnosis_education"],
      NOW
    );

    expect(matched.map(({ id }) => id)).toEqual([
      "medline_speech_home",
      "cdc_milestones_help"
    ]);
  });

  it("is deterministic — the same profile and instant give the same list", () => {
    const first = matchFamilyGuides(profileAged(48), "parent_support", NOW);
    const second = matchFamilyGuides(profileAged(48), "parent_support", NOW);

    expect(first.map(({ id }) => id)).toEqual(second.map(({ id }) => id));
    expect(first.map(({ id }) => id)).toEqual(["cdc_milestones_help", "medline_behavior"]);
  });

  it("reads a year-only profile as a January birthday rather than dropping it", () => {
    const yearOnly: FamilyProfile = {
      birthYear: 2024,
      schoolStage: "not_school_age",
      county: "Scott",
      diagnoses: []
    };

    // January 2024 → 30 months at NOW, inside the 0–36 First Steps band.
    expect(matchFamilyGuides(yearOnly, "early_intervention", NOW).map(({ id }) => id)).toEqual([
      "firststeps_family_guide"
    ]);
  });

  it("returns nothing for a domain with no seeded guides or an unusable clock", () => {
    expect(matchFamilyGuides(profileAged(24), "transportation", NOW)).toEqual([]);
    expect(matchFamilyGuides(profileAged(24), "early_intervention", new Date("nope"))).toEqual([]);
  });
});
