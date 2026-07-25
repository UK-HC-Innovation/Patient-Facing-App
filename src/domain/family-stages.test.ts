import { describe, expect, it } from "vitest";
import type { FamilyNavigatorState, FamilyProfile } from "./types";
import { backdatedDiagnosisMonth, buildFamilyStages } from "./family-stages";

function familyWith(profile: FamilyProfile): FamilyNavigatorState {
  return {
    profile,
    referral: null,
    appointments: [],
    safetyEvents: [],
    recommendations: null,
    interviewDraft: "",
    screenAnswers: [],
    interviews: [],
    facts: [],
    latestInterviewDomains: [],
    activeDomains: [],
    saved: [],
    alreadyEnrolled: [],
    steps: [],
    pulses: [],
    flags: [],
    soonerList: null,
    packetQuestionIds: []
  };
}

describe("buildFamilyStages", () => {
  it("builds the now, next, and later beats", () => {
    const family = familyWith({
      childFirstName: "Riley",
      birthYear: 2017,
      schoolStage: "elementary",
      county: "Scott",
      diagnoses: [
        { id: "dyslexia", label: "dyslexia", diagnosedAt: "2026-05" },
        { id: "adhd", label: "adhd", diagnosedAt: "2026-05" }
      ]
    });

    const stages = buildFamilyStages(family, new Date("2026-07-17T12:00:00.000Z"));

    expect(stages).toMatchObject([
      { id: "waiver-apply", timing: "now", domains: ["waivers_financial"] },
      { id: "school-arc", timing: "now", domains: ["school_iep"] },
      { id: "parent-connection", timing: "now", domains: ["parent_support"] },
      { id: "sibling-respite", timing: "next", domains: ["sibling_support", "respite"] }
    ]);
    const waiver = stages.find(({ id }) => id === "waiver-apply");
    expect(waiver?.title).toBe("Ask how to apply for the Michelle P. Waiver");
    expect(waiver?.description).toContain("Kentucky determines eligibility and waitlist placement");
    expect(waiver?.description).not.toMatch(/establish(?:es)? (?:an )?earlier place/i);
  });

  it("builds Casey's First Steps and age-three transition beats", () => {
    const family = familyWith({
      birthYear: 2024,
      schoolStage: "not_school_age",
      county: "Perry",
      diagnoses: [{ id: "speech", label: "speech_language" }]
    });

    expect(buildFamilyStages(family, new Date("2026-07-17T12:00:00.000Z"))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "first-steps", timing: "now", domains: ["early_intervention"] }),
        expect.objectContaining({
          id: "age-three-transition",
          timing: "now",
          domains: ["early_intervention", "school_iep"]
        })
      ])
    );
  });

  it("moves diagnosis nudges through next, later, and now from the most recent diagnosis month", () => {
    const family = familyWith({
      childFirstName: "Riley",
      birthYear: 2017,
      birthMonth: 4,
      schoolStage: "elementary",
      county: "Scott",
      diagnoses: [
        { id: "older", label: "dyslexia", diagnosedAt: "2026-02" },
        { id: "recent", label: "adhd", diagnosedAt: "2026-07" }
      ]
    });

    const timingAt = (iso: string, id: string) =>
      buildFamilyStages(family, new Date(iso)).find((stage) => stage.id === id)?.timing;

    expect(timingAt("2026-07-17T12:00:00.000Z", "waiver-apply")).toBe("now");
    expect(timingAt("2026-07-17T12:00:00.000Z", "parent-connection")).toBe("next");
    expect(timingAt("2026-07-17T12:00:00.000Z", "sibling-respite")).toBe("later");
    expect(timingAt("2026-08-01T00:00:00.000Z", "parent-connection")).toBe("now");
    expect(timingAt("2026-09-01T00:00:00.000Z", "sibling-respite")).toBe("next");
    expect(timingAt("2026-10-01T00:00:00.000Z", "sibling-respite")).toBe("now");
  });

  it("backdates diagnosis data with UTC month math without mutating or replacing the clock", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");

    expect(backdatedDiagnosisMonth(now, 0)).toBe("2026-07");
    expect(backdatedDiagnosisMonth(now, 1)).toBe("2026-06");
    expect(backdatedDiagnosisMonth(now, 6)).toBe("2026-01");
    expect(backdatedDiagnosisMonth(now, 8)).toBe("2025-11");
    expect(now.toISOString()).toBe("2026-07-17T12:00:00.000Z");
  });

  it("renders every stage body from approved linted templates in both languages", () => {
    const family = familyWith({
      birthYear: 2009,
      birthMonth: 7,
      schoolStage: "high",
      county: "Scott",
      diagnoses: [{ id: "diagnosis", label: "intellectual_disability", diagnosedAt: "2026-01" }]
    });
    const now = new Date("2026-07-17T12:00:00.000Z");

    for (const language of ["en", "es"] as const) {
      const stages = buildFamilyStages(family, now, language);
      expect(stages.length).toBeGreaterThan(0);
      for (const stage of stages) {
        expect(stage.description.length).toBeGreaterThan(20);
        expect(stage.templateId).toMatch(/^family_stage_.+_v1$/);
      }
    }
  });

  it("maps infant checkpoints into linked stages using the caregiver name", () => {
    const family = familyWith({
      childFirstName: "Baby",
      birthYear: 2026,
      birthMonth: 7,
      schoolStage: "not_school_age",
      county: "Scott",
      diagnoses: []
    });
    const stages = buildFamilyStages(
      family,
      new Date("2026-07-20T12:00:00.000Z"),
      "en",
      "Jordan"
    ).filter(({ id }) => id.startsWith("perinatal-check-"));

    expect(stages).toMatchObject([
      { id: "perinatal-check-1-month", timing: "next", href: "/checkin/perinatal" },
      { id: "perinatal-check-2-month", timing: "later", href: "/checkin/perinatal" },
      { id: "perinatal-check-4-month", timing: "later", href: "/checkin/perinatal" },
      { id: "perinatal-check-6-month", timing: "later", href: "/checkin/perinatal" }
    ]);
    for (const stage of stages) {
      expect(stage.description).toContain("Jordan");
      expect(stage.description).not.toContain("Baby");
      expect(stage.templateId).toBe("perinatal_check_nudge_v1");
    }
  });

  it("suppresses perinatal stages without birth month or a nonblank caregiver name", () => {
    const preciseProfile = {
      childFirstName: "Baby",
      birthYear: 2026,
      birthMonth: 7,
      schoolStage: "not_school_age" as const,
      county: "Scott",
      diagnoses: []
    };
    const now = new Date("2026-07-20T12:00:00.000Z");

    expect(
      buildFamilyStages(familyWith({ ...preciseProfile, birthMonth: undefined }), now, "en", "Jordan")
        .some(({ id }) => id.startsWith("perinatal-check-"))
    ).toBe(false);
    for (const caregiverName of [undefined, "   "]) {
      expect(
        buildFamilyStages(familyWith(preciseProfile), now, "en", caregiverName)
          .some(({ id }) => id.startsWith("perinatal-check-"))
      ).toBe(false);
    }
  });

  it("uses exact UTC birth-month age for the 2-year-3-month transition trigger", () => {
    const family = familyWith({
      birthYear: 2024,
      birthMonth: 5,
      schoolStage: "not_school_age",
      county: "Perry",
      diagnoses: []
    });

    const before = buildFamilyStages(family, new Date("2026-07-31T23:59:00.000Z"));
    const atTrigger = buildFamilyStages(family, new Date("2026-08-01T00:00:00.000Z"));

    expect(before.some(({ id }) => id === "age-three-transition")).toBe(false);
    expect(atTrigger.some(({ id }) => id === "age-three-transition")).toBe(true);
  });

  it("does not fire a month-precise transition early but fires conservatively for year-only age", () => {
    const base: FamilyProfile = {
      birthYear: 2024,
      schoolStage: "not_school_age",
      county: "Perry",
      diagnoses: []
    };
    const now = new Date("2026-01-15T12:00:00.000Z");

    expect(buildFamilyStages(familyWith({ ...base, birthMonth: 12 }), now).map(({ id }) => id)).toEqual([
      "first-steps"
    ]);
    expect(buildFamilyStages(familyWith(base), now).map(({ id }) => id)).toEqual([
      "first-steps",
      "age-three-transition"
    ]);
  });

  it("fires future-planning thresholds from UTC month math and conservatively for year-only data", () => {
    const base: FamilyProfile = {
      birthYear: 2012,
      schoolStage: "middle",
      county: "Scott",
      diagnoses: []
    };
    const before = new Date("2026-11-30T23:30:00.000Z");

    expect(buildFamilyStages(familyWith({ ...base, birthMonth: 12 }), before)).toEqual([]);
    expect(
      buildFamilyStages(familyWith({ ...base, birthMonth: 12 }), new Date("2026-11-30T23:30:00-05:00"))
    ).toMatchObject([{ id: "mission-transition" }]);
    expect(buildFamilyStages(familyWith({ ...base, birthMonth: 12 }), new Date("2026-12-01T00:00:00.000Z"))).toMatchObject([
      { id: "mission-transition", timing: "now", domains: ["future_planning"] }
    ]);
    expect(buildFamilyStages(familyWith(base), new Date("2026-01-01T00:00:00.000Z"))).toMatchObject([
      { id: "mission-transition", timing: "now", domains: ["future_planning"] }
    ]);

    const ageSeventeen = familyWith({ ...base, birthYear: 2009 });
    expect(buildFamilyStages(ageSeventeen, new Date("2026-01-01T00:00:00.000Z")).map(({ id }) => id)).toEqual([
      "mission-transition",
      "before-eighteen"
    ]);
  });

  it("surfaces the school-enrollment trigger throughout a possible year-only age-four year", () => {
    const yearOnly = familyWith({
      birthYear: 2022,
      schoolStage: "preschool",
      county: "Perry",
      diagnoses: []
    });

    expect(buildFamilyStages(yearOnly, new Date("2026-01-01T00:00:00.000Z"))).toMatchObject([
      { id: "school-enrollment", timing: "now", domains: ["school_iep"] }
    ]);
  });

  it("keeps First Steps visible throughout a year when a year-only child could still be under three", () => {
    const yearOnly = familyWith({
      birthYear: 2024,
      schoolStage: "not_school_age",
      county: "Perry",
      diagnoses: []
    });

    expect(
      buildFamilyStages(yearOnly, new Date("2027-12-31T23:59:00.000Z")).some(
        ({ id, timing }) => id === "first-steps" && timing === "now"
      )
    ).toBe(true);
  });

  it("uses eligibility-safe First Steps copy when the month-only age may be inside the final cutoff", () => {
    const possibleCutoff = familyWith({
      birthYear: 2023,
      birthMonth: 8,
      schoolStage: "not_school_age",
      county: "Perry",
      diagnoses: []
    });
    const stage = buildFamilyStages(possibleCutoff, new Date("2026-07-17T12:00:00.000Z")).find(
      ({ id }) => id === "first-steps"
    );

    expect(stage?.title).toBe("Contact First Steps now");
    expect(stage?.title).not.toMatch(/^start\b/i);
    expect(stage?.description).toContain("confirm whether the referral window remains open");
    expect(stage?.description).toContain("transition options if it does not");
    expect(stage?.description).not.toContain("only the birth year is known");
  });

  it("bounds before-eighteen to precise age 17 and year-only ranges that may intersect age 17", () => {
    const preciseBase: FamilyProfile = {
      birthYear: 2008,
      birthMonth: 9,
      schoolStage: "post_high",
      county: "Scott",
      diagnoses: []
    };
    const preciseSeventeen = buildFamilyStages(
      familyWith(preciseBase),
      new Date("2026-08-01T00:00:00.000Z")
    );
    const preciseEighteen = buildFamilyStages(
      familyWith({ ...preciseBase, birthMonth: 8 }),
      new Date("2026-08-01T00:00:00.000Z")
    );

    expect(preciseSeventeen.map(({ id }) => id)).toEqual(["mission-transition", "before-eighteen"]);
    expect(preciseSeventeen.find(({ id }) => id === "before-eighteen")?.timing).toBe("now");
    expect(preciseEighteen.map(({ id }) => id)).toEqual(["mission-transition"]);

    const yearOnlyEighteen = buildFamilyStages(
      familyWith({ ...preciseBase, birthYear: 2008, birthMonth: undefined }),
      new Date("2026-08-01T00:00:00.000Z")
    );
    const yearOnlyNineteen = buildFamilyStages(
      familyWith({ ...preciseBase, birthYear: 2007, birthMonth: undefined }),
      new Date("2026-08-01T00:00:00.000Z")
    );

    expect(yearOnlyEighteen.map(({ id }) => id)).toEqual(["mission-transition", "before-eighteen"]);
    expect(yearOnlyNineteen.map(({ id }) => id)).toEqual(["mission-transition"]);
  });

  it("discloses conservative timing on every year-only age stage and not on month-precise stages", () => {
    const yearOnlyProfiles: FamilyProfile[] = [
      { birthYear: 2024, schoolStage: "not_school_age", county: "Perry", diagnoses: [] },
      { birthYear: 2022, schoolStage: "preschool", county: "Perry", diagnoses: [] },
      { birthYear: 2009, schoolStage: "high", county: "Scott", diagnoses: [] }
    ];
    const yearOnlyStages = yearOnlyProfiles.flatMap((profile) =>
      buildFamilyStages(familyWith(profile), new Date("2026-07-17T12:00:00.000Z"))
    );
    const ageStageIds = [
      "first-steps",
      "age-three-transition",
      "school-enrollment",
      "mission-transition",
      "before-eighteen"
    ];

    for (const id of ageStageIds) {
      expect(yearOnlyStages.find((stage) => stage.id === id)?.description).toContain(
        "Timing is shown early because only the birth year is known."
      );
    }

    const monthPreciseProfiles: FamilyProfile[] = [
      { birthYear: 2024, birthMonth: 4, schoolStage: "not_school_age", county: "Perry", diagnoses: [] },
      { birthYear: 2022, birthMonth: 7, schoolStage: "preschool", county: "Perry", diagnoses: [] },
      { birthYear: 2009, birthMonth: 7, schoolStage: "high", county: "Scott", diagnoses: [] }
    ];
    const monthPreciseStages = monthPreciseProfiles.flatMap((profile) =>
      buildFamilyStages(familyWith(profile), new Date("2026-07-17T12:00:00.000Z"))
    );

    for (const stage of monthPreciseStages.filter(({ id }) => ageStageIds.includes(id))) {
      expect(stage.description).not.toContain("only the birth year is known");
    }
  });

  it("does not treat post-high as diagnosed school age", () => {
    const postHigh = familyWith({
      birthYear: 2017,
      schoolStage: "post_high",
      county: "Scott",
      diagnoses: [{ id: "adhd", label: "adhd" }]
    });

    const stages = buildFamilyStages(postHigh, new Date("2026-07-17T12:00:00.000Z"));

    expect(stages.some(({ id }) => id === "school-arc")).toBe(false);
    expect(stages.map(({ id }) => id)).toEqual(["waiver-apply", "parent-connection", "sibling-respite"]);
  });

  it("returns no stages without a profile", () => {
    expect(buildFamilyStages({ ...familyWith({ birthYear: 2024, schoolStage: "not_school_age", county: "Perry", diagnoses: [] }), profile: null }, new Date())).toEqual([]);
  });
});
