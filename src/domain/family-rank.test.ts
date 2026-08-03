import { describe, expect, it } from "vitest";
import {
  coerceLead,
  parseFamilyRankPayload,
  rankFamilyResourcesMock,
  validateHeard,
  validateRankedItems
} from "./family-rank";
import { buildRankCandidates } from "./family-matching";
import { familyStrings } from "@/i18n/family-strings";
import type { FamilyProfile } from "./types";

const profile: FamilyProfile = {
  county: "Breathitt",
  birthYear: 2019,
  schoolStage: "elementary",
  diagnoses: []
};

const RAW_TEXT =
  "He has been kicked out of school several times for violence and acting out. We live in Breathitt County.";

const candidateIds = ["idea_school_discipline", "kde_evaluation_request", "fba_bip_request"];

function item(overrides: Partial<Parameters<typeof validateRankedItems>[0][number]> = {}) {
  return {
    id: "idea_school_discipline",
    why: "A school that keeps sending him home past ten days has to look at whether the behavior is tied to a disability.",
    urgency: "act_now" as const,
    ...overrides
  };
}

describe("validateRankedItems", () => {
  it("keeps a clean recommendation byte-identical", () => {
    const clean = item({ becauseYouSaid: "kicked out of school several times" });
    expect(validateRankedItems([clean], { candidateIds, rawText: RAW_TEXT, language: "en" })).toEqual([
      {
        resourceId: clean.id,
        why: clean.why,
        becauseYouSaid: "kicked out of school several times",
        urgency: "act_now"
      }
    ]);
  });

  it("drops an id the model was never offered", () => {
    const hallucinated = item({ id: "totally_made_up_program" });
    expect(validateRankedItems([hallucinated], { candidateIds, rawText: RAW_TEXT, language: "en" })).toEqual([]);
  });

  it("drops a real catalog id that was outside this family's candidate set", () => {
    const outOfSet = item({ id: "michelle_p_waiver" });
    expect(validateRankedItems([outOfSet], { candidateIds, rawText: RAW_TEXT, language: "en" })).toEqual([]);
  });

  it("strips a why that claims a diagnosis but keeps the card", () => {
    const claiming = item({ why: "Your child has autism, so this program fits." });
    const [validated] = validateRankedItems([claiming], { candidateIds, rawText: RAW_TEXT, language: "en" });

    expect(validated.resourceId).toBe("idea_school_discipline");
    expect(validated.why).toBeUndefined();
  });

  it("strips a why that steers the family to a different program by name", () => {
    const steering = item({ why: "Skip this and call KY-SPIN Parent Center instead." });
    const [validated] = validateRankedItems([steering], { candidateIds, rawText: RAW_TEXT, language: "en" });

    expect(validated.why).toBeUndefined();
  });

  it("drops a quote that is not verbatim caregiver text", () => {
    const paraphrased = item({ becauseYouSaid: "he gets suspended a lot" });
    const [validated] = validateRankedItems([paraphrased], { candidateIds, rawText: RAW_TEXT, language: "en" });

    expect(validated.becauseYouSaid).toBeUndefined();
    expect(validated.why).toBeDefined();
  });

  it("deduplicates repeated ids", () => {
    const validated = validateRankedItems([item(), item()], {
      candidateIds,
      rawText: RAW_TEXT,
      language: "en"
    });
    expect(validated).toHaveLength(1);
  });
});

describe("validateHeard", () => {
  it("passes a grounded narrative through", () => {
    const heard = "You told us school keeps sending him home, and that is where the leverage is.";
    expect(validateHeard(heard, "en")).toBe(heard);
  });

  it("replaces a diagnosis claim with the deterministic line", () => {
    expect(validateHeard("Your child has ADHD and needs support.", "en")).toBe(
      familyStrings.en.rankHeardFallback
    );
  });
});

describe("rankFamilyResourcesMock", () => {
  it("produces the same shape deterministically with no model involved", () => {
    const candidates = buildRankCandidates(profile, ["school_iep"], []).resources;
    const ranked = rankFamilyResourcesMock(
      candidates,
      ["school_iep"],
      RAW_TEXT,
      "en",
      "interview-1",
      new Date("2026-07-21T00:00:00.000Z")
    );

    expect(ranked.extraction).toBe("mock");
    expect(ranked.lead).toBe("school_iep");
    expect(ranked.heard).toBe(familyStrings.en.rankHeardFallback);
    expect(ranked.items).toHaveLength(8);
    expect(ranked.items.every(({ why }) => why === undefined)).toBe(true);
    // An actNow catalog entry keeps its urgency through the deterministic path.
    expect(ranked.items.some(({ urgency }) => urgency === "act_now")).toBe(true);
    for (const { resourceId } of ranked.items) {
      expect(candidates.map(({ resource }) => resource.id)).toContain(resourceId);
    }
  });
});

describe("coerceLead", () => {
  it("keeps a recognized need domain", () => {
    expect(coerceLead("school_iep", ["parent_support"])).toBe("school_iep");
  });

  it("falls back to the family's first active domain for an advisory model label", () => {
    expect(coerceLead("behavioral_support", ["school_iep", "parent_support"])).toBe("school_iep");
    expect(coerceLead(undefined, ["therapies"])).toBe("therapies");
  });

  it("uses parent support when neither source supplies a recognized domain", () => {
    expect(coerceLead("behavioral_support", [])).toBe("parent_support");
  });
});

describe("parseFamilyRankPayload", () => {
  it("rejects off-shape model output instead of trusting it", () => {
    expect(parseFamilyRankPayload(null)).toBeNull();
    expect(parseFamilyRankPayload({ heard: "ok" })).toBeNull();
    expect(
      parseFamilyRankPayload({
        heard: "ok",
        lead: "school_iep",
        recommendations: [{ id: "x", urgency: "whenever" }]
      })
    ).toBeNull();
  });

  it("keeps recommendations when the advisory lead is unknown or omitted", () => {
    expect(
      parseFamilyRankPayload({ heard: "ok", lead: "behavioral_support", recommendations: [] })
    ).toMatchObject({ lead: "behavioral_support", recommendations: [] });
    expect(parseFamilyRankPayload({ heard: "ok", recommendations: [] })).toEqual({
      heard: "ok",
      recommendations: []
    });
  });

  it("accepts a well-formed payload", () => {
    expect(
      parseFamilyRankPayload({
        heard: "Here is what we heard.",
        lead: "school_iep",
        recommendations: [{ id: "idea_school_discipline", why: "because", urgency: "act_now" }]
      })
    ).toMatchObject({ lead: "school_iep" });
  });
});
