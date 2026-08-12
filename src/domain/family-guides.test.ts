import { describe, expect, it } from "vitest";
import { FAMILY_GUIDE_CATALOG, GUIDE_STRIP_LIMIT, matchFamilyGuides } from "./family-guides";
import { familyResourcePhones, familyResourceTel } from "./family-resource-contact";
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

describe("guide phone provenance", () => {
  // FR-1, extended to the guides by F5e: a number in prose is a number no sweep
  // can see, and 800-525-7746 sat in a step for three specs.
  it("keeps every phone number in a structured contact line, never in prose", () => {
    for (const guide of FAMILY_GUIDE_CATALOG) {
      for (const step of guide.steps) {
        expect(step, `${guide.id} step`).not.toMatch(/\b\d{3}-\d{3}-\d{4}\b/);
      }
      expect(guide.plainSummary, `${guide.id} summary`).not.toMatch(/\b\d{3}-\d{3}-\d{4}\b/);
    }
  });

  it("parses every guide contact with the same reader the org catalog uses", () => {
    const withContact = FAMILY_GUIDE_CATALOG.filter(({ contact }) => contact !== undefined);
    expect(withContact.length).toBeGreaterThan(0);
    for (const guide of withContact) {
      const numbers = familyResourcePhones(guide.contact!);
      expect(numbers.length, guide.id).toBeGreaterThan(0);
      for (const number of numbers) {
        expect(guide.contact).toContain(number);
        expect(familyResourceTel(number)).toMatch(/^tel:\d{3,10}$/);
      }
    }
  });
});

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
      // "Not in the future", not a pinned constant every re-verification pass
      // has to remember to move; family-freshness.test.ts owns the lower bound.
      expect(Date.parse(guide.verifiedAt)).toBeLessThanOrEqual(Date.now());
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

  it("keeps the manually reviewed guide claims faithful to their source wording", () => {
    const behavior = FAMILY_GUIDE_CATALOG.find(({ id }) => id === "medline_behavior")!;
    const firstSteps = FAMILY_GUIDE_CATALOG.find(({ id }) => id === "firststeps_family_guide")!;
    const autism = FAMILY_GUIDE_CATALOG.find(({ id }) => id === "cdc_autism_signs")!;

    expect(behavior.steps.join(" ")).toContain("birth of a sibling, a divorce, or a death");
    expect(firstSteps.ages).toEqual({ min: 0, max: 35 });
    expect(autism.ages?.min).toBe(9);
    expect(autism.steps[0]).toContain("not responding to their name");
    expect(autism.steps[0]).toContain("few or no gestures");
    expect(autism.steps[0]).toContain("not pointing");
  });
});

describe("matchFamilyGuides", () => {
  it("returns only guides that carry the lead domain", () => {
    const matched = matchFamilyGuides(profileAged(24), "early_intervention", NOW);

    expect(matched.map((guide) => guide.id)).toEqual(["firststeps_family_guide"]);
  });

  it("honors the age band on both edges", () => {
    // First Steps serves children under age 3; this inclusive band ends at 35 months.
    expect(matchFamilyGuides(profileAged(35), "early_intervention", NOW).map(({ id }) => id)).toEqual([
      "firststeps_family_guide"
    ]);
    expect(matchFamilyGuides(profileAged(36), "early_intervention", NOW)).toEqual([]);
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
