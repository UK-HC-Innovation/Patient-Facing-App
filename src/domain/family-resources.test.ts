import { describe, expect, it } from "vitest";
import type { FamilyProfile } from "./types";
import {
  FAMILY_RESOURCE_CATALOG,
  FIRST_STEPS_POE_BY_COUNTY,
  KY_COUNTIES,
  childAgeYears,
  familyDomainLabel,
  findFamilyResources,
  getFamilyResourceById
} from "./family-resources";

describe("family resource catalog integrity", () => {
  it("contains all 120 unique Kentucky counties and assigns every county to one of 15 POE districts", () => {
    expect(KY_COUNTIES).toHaveLength(120);
    expect(new Set(KY_COUNTIES).size).toBe(120);
    expect(Object.keys(FIRST_STEPS_POE_BY_COUNTY).sort()).toEqual([...KY_COUNTIES].sort());
    expect(new Set(Object.values(FIRST_STEPS_POE_BY_COUNTY)).size).toBe(15);
    expect(FIRST_STEPS_POE_BY_COUNTY.Scott).toBe("Bluegrass");
    expect(FIRST_STEPS_POE_BY_COUNTY.Perry).toBe("Kentucky River");
  });

  it("uses unique stable IDs and valid current source provenance", () => {
    const ids = FAMILY_RESOURCE_CATALOG.map((resource) => resource.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const resource of FAMILY_RESOURCE_CATALOG) {
      expect(() => new URL(resource.sourceUrl)).not.toThrow();
      expect(new URL(resource.sourceUrl).protocol).toMatch(/^https?:$/);
      // Per-entry dates, not one flattened constant: entries added later must be
      // able to say honestly when they were checked.
      expect(resource.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(resource.verifiedAt))).toBe(false);
      expect(Date.parse(resource.verifiedAt)).toBeLessThanOrEqual(Date.parse("2026-07-21"));
    }
  });

  it("contains the exact required stable resource ID set", () => {
    const requiredIds = [
      "autism_society_bluegrass",
      "central_kentucky_riding_for_hope",
      "chadd_kentucky_connections",
      "child_waiver",
      "down_syndrome_louisville",
      "dsack",
      "fba_bip_request",
      "feat_louisville",
      "first_steps_barren_river",
      "first_steps_big_sandy",
      "first_steps_bluegrass",
      "first_steps_buffalo_trace",
      "first_steps_cumberland_valley",
      "first_steps_fivco",
      "first_steps_gateway",
      "first_steps_green_river",
      "first_steps_kentuckiana",
      "first_steps_kentucky_river",
      "first_steps_lake_cumberland",
      "first_steps_lincoln_trail",
      "first_steps_northern_kentucky",
      "first_steps_pennyrile",
      "first_steps_purchase",
      "first_steps_statewide",
      "hcb_waiver",
      "hdi_resource_guide",
      "idea_school_discipline",
      "help_me_grow_ky",
      "kde_age_three_transition",
      "kde_dispute_resolution",
      "kde_evaluation_request",
      "kde_parent_toolbox",
      "kentucky_211",
      "kentucky_autism_training_center",
      "kentucky_protection_advocacy",
      "ky_lend",
      "ky_spin",
      "kynect_resources",
      "lda_kentucky",
      "lexington_therapeutic_recreation",
      "michelle_p_waiver",
      "my_choice_kentucky",
      "ocshcn",
      "scl_waiver",
      "scott_county_exceptional_child_services",
      "scott_county_frysc",
      "sibling_support_project",
      "ssi_children",
      "stable_kentucky",
      "uk_developmental_pediatrics"
    ];

    expect(FAMILY_RESOURCE_CATALOG.map((resource) => resource.id).sort()).toEqual(requiredIds.sort());
  });

  it("uses the current Kentucky regulation for the age-three transition resource", () => {
    const transition = getFamilyResourceById("kde_age_three_transition");

    expect(transition?.sourceUrl).toBe("https://apps.legislature.ky.gov/law/kar/titles/902/030/110/");
    expect(transition?.actNow).toContain("active IFSP");
    expect(transition?.actNow).toContain("IEP by the third birthday");
  });

  it("publishes P&A's current source and service exclusions", () => {
    const protectionAndAdvocacy = getFamilyResourceById("kentucky_protection_advocacy");

    expect(protectionAndAdvocacy?.sourceUrl).toBe("https://kypa.net/what-we-do/");
    expect(protectionAndAdvocacy?.summary).toContain("child custody");
    expect(protectionAndAdvocacy?.summary).toContain("SSI, SSDI, or VA benefits");
  });

  it("flags every source named by the verification policy for human review", () => {
    expect(getFamilyResourceById("ssi_children")?.humanVerify).toBe(true);
    expect(getFamilyResourceById("stable_kentucky")?.humanVerify).toBe(true);
    expect(getFamilyResourceById("sibling_support_project")?.humanVerify).toBe(true);
    // Procedural guidance ships flagged until the citations are checked by hand.
    expect(getFamilyResourceById("idea_school_discipline")?.humanVerify).toBe(true);
    expect(getFamilyResourceById("kde_evaluation_request")?.humanVerify).toBe(true);
    expect(getFamilyResourceById("fba_bip_request")?.humanVerify).toBe(true);
  });
});

describe("findFamilyResources", () => {
  it("normalizes a County suffix and ranks an exact county match first", () => {
    expect(findFamilyResources({ county: "Scott County", domain: "school_iep", childAgeYears: 9 })[0]?.id).toBe(
      "scott_county_exceptional_child_services"
    );
  });

  it("ranks the correct local First Steps POE before statewide resources", () => {
    const results = findFamilyResources({ county: "Perry", domain: "early_intervention", childAgeYears: 2 });

    expect(results[0]?.id).toBe("first_steps_kentucky_river");
    expect(results.some((resource) => resource.id === "first_steps_statewide")).toBe(true);
  });

  it("falls back to statewide resources when no county-specific resource matches", () => {
    const results = findFamilyResources({ county: "Boone", domain: "sibling_support", childAgeYears: 8 });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((resource) => resource.counties.includes("statewide"))).toBe(true);
    expect(results.map((resource) => resource.id)).toContain("sibling_support_project");
  });

  it("filters resources outside the inclusive age range", () => {
    const toddlerResults = findFamilyResources({ county: "Perry", domain: "early_intervention", childAgeYears: 2 });
    const schoolAgeResults = findFamilyResources({ county: "Perry", domain: "early_intervention", childAgeYears: 9 });

    expect(toddlerResults.map((resource) => resource.id)).toContain("first_steps_kentucky_river");
    expect(schoolAgeResults.map((resource) => resource.id)).not.toContain("first_steps_kentucky_river");
    expect(schoolAgeResults.map((resource) => resource.id)).not.toContain("first_steps_statewide");
  });

  it("includes exact minimum, exact maximum, and fractional age boundaries", () => {
    const atBirth = findFamilyResources({ county: "Perry", domain: "early_intervention", childAgeYears: 0, limit: 20 });
    const atFirstStepsMax = findFamilyResources({
      county: "Perry",
      domain: "early_intervention",
      childAgeYears: 3,
      limit: 20
    });
    const belowTransition = findFamilyResources({
      county: "Perry",
      domain: "school_iep",
      childAgeYears: 2.24,
      limit: 20
    });
    const atTransitionMin = findFamilyResources({
      county: "Perry",
      domain: "school_iep",
      childAgeYears: 2.25,
      limit: 20
    });
    const atTransitionMax = findFamilyResources({ county: "Perry", domain: "school_iep", childAgeYears: 4, limit: 20 });

    expect(atBirth.map((resource) => resource.id)).toContain("first_steps_kentucky_river");
    expect(atFirstStepsMax.map((resource) => resource.id)).toContain("first_steps_kentucky_river");
    expect(belowTransition.map((resource) => resource.id)).not.toContain("kde_age_three_transition");
    expect(atTransitionMin.map((resource) => resource.id)).toContain("kde_age_three_transition");
    expect(atTransitionMax.map((resource) => resource.id)).toContain("kde_age_three_transition");
  });

  it("applies the limit after county-first sorting and handles zero", () => {
    expect(findFamilyResources({ county: "Scott", domain: "school_iep", childAgeYears: 9, limit: 1 })).toHaveLength(1);
    expect(findFamilyResources({ county: "Scott", domain: "school_iep", childAgeYears: 9, limit: 1 })[0]?.id).toBe(
      "scott_county_exceptional_child_services"
    );
    expect(findFamilyResources({ county: "Scott", domain: "school_iep", childAgeYears: 9, limit: 0 })).toEqual([]);
  });

  it("keeps direct ID lookup independent of enrollment state", () => {
    expect(getFamilyResourceById("michelle_p_waiver")?.id).toBe("michelle_p_waiver");
  });

  it("resolves the verified LKLP Region 13 transportation resource by stable ID", () => {
    expect(getFamilyResourceById("lklp_transportation_region_13")).toMatchObject({
      id: "lklp_transportation_region_13",
      counties: expect.arrayContaining(["Breathitt"]),
      domains: expect.arrayContaining(["transportation"])
    });
  });
});

describe("family resource helpers", () => {
  it("labels each domain in plain language", () => {
    expect(familyDomainLabel("school_iep")).toBe("School and IEP support");
    expect(familyDomainLabel("waivers_financial")).toBe("Waivers and financial support");
  });

  it("calculates month-precise age when birth month is present and stays conservative for year-only profiles", () => {
    const withMonth: FamilyProfile = {
      birthYear: 2017,
      birthMonth: 8,
      schoolStage: "elementary",
      county: "Scott",
      diagnoses: []
    };
    const yearOnly: FamilyProfile = { ...withMonth, birthMonth: undefined };

    expect(childAgeYears(withMonth, new Date("2026-07-17T12:00:00Z"))).toBeCloseTo(8 + 11 / 12);
    expect(childAgeYears(yearOnly, new Date("2026-07-17T12:00:00Z"))).toBe(9);
  });

  it("returns 2.25 years at 2 years 3 months and surfaces the transition resource end to end", () => {
    const profile: FamilyProfile = {
      birthYear: 2024,
      birthMonth: 4,
      schoolStage: "not_school_age",
      county: "Perry",
      diagnoses: []
    };
    const age = childAgeYears(profile, new Date("2026-07-17T12:00:00Z"));
    const resources = findFamilyResources({
      county: profile.county,
      domain: "early_intervention",
      childAgeYears: age,
      limit: 20
    });

    expect(age).toBe(2.25);
    expect(resources.map((resource) => resource.id)).toContain("kde_age_three_transition");
  });
});
