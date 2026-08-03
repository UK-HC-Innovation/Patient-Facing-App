import { describe, expect, it } from "vitest";
import { buildStructuredResourceMatches, MAX_DISPLAY_RESOURCES } from "./family-matching";
import { familyResourceServiceArea } from "./family-resource-intent";
import { getFamilyResourceById } from "./family-resources";
import type { DevNeedDomain, FamilyProfile } from "./types";

function profile(
  county: string,
  birthYear: number,
  schoolStage: FamilyProfile["schoolStage"],
  diagnoses: FamilyProfile["diagnoses"] = []
): FamilyProfile {
  return { county, birthYear, schoolStage, diagnoses };
}

function matches(rawText: string, family: FamilyProfile, domains: DevNeedDomain[]) {
  return buildStructuredResourceMatches(family, domains, [], rawText).resources;
}

function ids(rawText: string, family: FamilyProfile, domains: DevNeedDomain[]): string[] {
  return matches(rawText, family, domains).map(({ resource }) => resource.id);
}

describe("Ladder Wave 2 structured resource routing", () => {
  it("gates waiver and specialty cards from F01 while preserving the county First Steps route", () => {
    const rawText =
      "Theo is two. He says mama and no, but not much else, and he still falls a lot when he walks. His doctor said speech and physical therapy could help. I’m his grandmother and I don’t drive, so we need a ride to appointments. I need somebody to tell me who to call first.";
    const result = ids(rawText, profile("Pike", 2024, "not_school_age"), [
      "early_intervention",
      "therapies",
      "transportation"
    ]);

    expect(result.slice(0, 2)).toEqual(["first_steps_big_sandy", "first_steps_statewide"]);
    expect(result).toContain("help_me_grow_ky");
    expect(result).not.toEqual(expect.arrayContaining(["michelle_p_waiver", "child_waiver", "uk_developmental_pediatrics"]));
  });

  it("keeps F03's direct developmental-evaluation options and removes unsupported waivers", () => {
    const rawText =
      "Zoe is four. She covers her ears in busy places, avoids group play, and has trouble with back-and-forth language. She has no diagnosis. I want evidence about whether speech or occupational therapy and a developmental evaluation make sense; I do not want the app to put a label on her.";
    const result = ids(rawText, profile("Fayette", 2022, "preschool"), ["therapies"]);

    expect(result.slice(0, 2)).toEqual(["ocshcn", "uk_developmental_pediatrics"]);
    expect(result).not.toEqual(expect.arrayContaining(["michelle_p_waiver", "child_waiver"]));
  });

  it("ranks F04's removal and behavior-plan protections before dispute escalation", () => {
    const rawText =
      "Gabriel is in fourth grade y ya tiene un IEP. La escuela still calls me to pick him up and sends him home when he gets overloaded. Hemos tenido meetings, pero el plan no está working. I need help with the IEP and what to ask for next.";
    const result = ids(rawText, profile("McCracken", 2017, "elementary"), ["school_iep"]);

    expect(result.slice(0, 3)).toEqual([
      "idea_school_discipline",
      "fba_bip_request",
      "kde_dispute_resolution"
    ]);
    expect(result.indexOf("fba_bip_request")).toBeLessThan(result.indexOf("kde_evaluation_request"));
    expect(result.indexOf("fba_bip_request")).toBeLessThan(result.indexOf("kde_dispute_resolution"));
  });

  it.each([
    [
      "F05",
      "Jordan is twelve and in seventh grade, and I’m frustrated because the story comes out all mixed up. Homework takes hours. He loses papers, forgets directions, cannot stay focused, starts three things and finishes none, and the school says he needs to try harder. I need help deciding whether to ask for an evaluation, an IEP, or a 504.",
      profile("Boone", 2014, "middle")
    ],
    [
      "L03",
      "Maya is ten and in fifth grade. Her teacher and I are concerned about dyslexia and ADHD, but she has not been diagnosed. Reading and homework take hours, and we are waiting for an evaluation.",
      profile("Rowan", 2016, "elementary")
    ]
  ])("ranks %s's evaluation route and excludes discipline/dispute content", (_case, rawText, family) => {
    const result = ids(rawText, family, ["school_iep"]);

    expect(result.slice(0, 3)).toEqual(["kde_evaluation_request", "kde_parent_toolbox", "ky_spin"]);
    expect(result).not.toEqual(expect.arrayContaining(["kde_dispute_resolution", "idea_school_discipline"]));
  });

  it("puts F06's sibling ask first, caps the primary surface, and attributes its action to sibling support", () => {
    const rawText =
      "Sam is seven. He already goes to speech and occupational therapy. I need a break sometimes, his sister needs support too, and I’d like a sports or recreation program where they both feel welcome. Reading long pages is hard for me, so please keep it short.";
    const result = matches(rawText, profile("Warren", 2019, "elementary"), [
      "respite",
      "parent_support",
      "sibling_support",
      "recreation"
    ]);

    expect(result[0]).toMatchObject({ resource: { id: "sibling_support_project" }, domain: "sibling_support" });
    expect(result.slice(0, MAX_DISPLAY_RESOURCES).length).toBeLessThanOrEqual(MAX_DISPLAY_RESOURCES);
    expect(result.slice(0, MAX_DISPLAY_RESOURCES).map(({ resource }) => resource.id)).not.toEqual(
      expect.arrayContaining(["michelle_p_waiver", "child_waiver"])
    );
  });

  it("puts My Choice first for F07's explicit supported-decision-making ask", () => {
    const rawText =
      "Noah is sixteen. He was diagnosed with autism and intellectual disability when he was younger. I know the system and I’m planning for adult transition, supported decision-making, ABLE, and waivers before he turns eighteen. Please do not start at the very beginning.";
    const family = profile("Christian", 2010, "high", [
      { id: "profile-generated-autism-id", label: "autism" },
      { id: "profile-generated-intellectual-id", label: "intellectual_disability" }
    ]);

    expect(ids(rawText, family, ["waivers_financial", "future_planning"])[0]).toBe("my_choice_kentucky");
  });

  it("uses saved diagnosis labels rather than generated ids for diagnosis-gated resources", () => {
    const family = profile("Fayette", 2020, "elementary", [
      { id: "random-profile-id", label: "autism" }
    ]);

    const result = ids("I want local parent support.", family, ["parent_support"]);

    expect(result).toContain("kentucky_autism_training_center");
    expect(result).toContain("autism_society_bluegrass");
  });

  it("does not treat a saved dyslexia diagnosis as a Developmental Pediatrics basis", () => {
    const family = profile("Boone", 2014, "middle", [
      { id: "random-profile-id", label: "dyslexia" }
    ]);

    const result = ids(
      "I need help asking the school for an evaluation for dyslexia.",
      family,
      ["school_iep", "diagnosis_education"]
    );

    expect(result).not.toContain("uk_developmental_pediatrics");
  });

  it("accepts the HCB waiver when an Other diagnosis supplies a physical-disability basis", () => {
    const family = profile("Boone", 2014, "middle", [
      { id: "random-profile-id", label: "other", otherLabel: "Cerebral palsy" }
    ]);

    expect(ids("We need help planning for waivers.", family, ["waivers_financial"])).toContain("hcb_waiver");
  });

  it("ranks L02's county transportation route first and gates unrelated school, waiver, and specialty cards", () => {
    const rawText =
      "Jaylen is eight. We have an occupational therapy referral, but the nearest therapy is more than an hour away and we do not have a reliable ride. I want help finding something we can actually get to.";
    const result = ids(rawText, profile("Breathitt", 2018, "elementary"), ["therapies", "transportation"]);

    expect(result[0]).toBe("lklp_transportation_region_13");
    expect(result.indexOf("lklp_transportation_region_13")).toBeLessThan(result.indexOf("kentucky_211"));
    expect(result).not.toEqual(
      expect.arrayContaining([
        "michelle_p_waiver",
        "child_waiver",
        "uk_developmental_pediatrics",
        "fba_bip_request"
      ])
    );
  });

  it("keeps L04's First Steps route and suppresses unrelated waiver and specialty cards", () => {
    const rawText =
      "Ava is two and uses about six words. We were referred to First Steps for speech therapy, and I want help making sure we get started before the deadline.";
    const family = { ...profile("Perry", 2024, "not_school_age"), birthMonth: 1 };
    const result = ids(rawText, family, ["early_intervention", "therapies"]);

    expect(result.slice(0, 2)).toEqual(["first_steps_kentucky_river", "first_steps_statewide"]);
    expect(result).toContain("kde_age_three_transition");
    expect(result).not.toEqual(
      expect.arrayContaining(["michelle_p_waiver", "child_waiver", "ocshcn", "uk_developmental_pediatrics"])
    );
  });

  it("distinguishes county-serving resources from statewide options", () => {
    expect(familyResourceServiceArea(getFamilyResourceById("lklp_transportation_region_13")!, "Breathitt")).toEqual({
      kind: "county",
      county: "Breathitt"
    });
    expect(familyResourceServiceArea(getFamilyResourceById("kentucky_211")!, "Breathitt")).toEqual({
      kind: "statewide"
    });
  });

  it("uses the honest fallback without restoring ineligible waivers for respite-only intent", () => {
    const result = buildStructuredResourceMatches(
      profile("Boone", 2018, "elementary"),
      ["respite"],
      [],
      "I need a break sometimes."
    );

    expect(result.isFallback).toBe(true);
    expect(result.resources.map(({ resource }) => resource.id)).toEqual([
      "ky_spin",
      "hdi_resource_guide",
      "kynect_resources",
      "kentucky_211"
    ]);
  });
});
