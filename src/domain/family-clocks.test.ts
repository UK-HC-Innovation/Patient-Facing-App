import { describe, expect, it } from "vitest";
import {
  CLOCK_WARNING_WEEKS,
  firstStepsClock,
  firstStepsWeeksLeft,
  hasEnrolledFirstSteps
} from "./family-clocks";
import { eighteenMonthFamilyState, schoolAgeFamilyState } from "./family-fixtures";
import { getFamilyResourceById, isFirstStepsResource } from "./family-resources";
import type { FamilyProfile, FamilyResourceStep, FamilyStepStatus } from "./types";

const NOW = new Date("2026-07-17T12:00:00.000Z");

function profile(overrides: Partial<FamilyProfile> = {}): FamilyProfile {
  return {
    childFirstName: "Avery",
    birthYear: 2024,
    birthMonth: 1,
    schoolStage: "not_school_age",
    county: "Fayette",
    diagnoses: [],
    ...overrides
  };
}

function step(resourceId: string, status: FamilyStepStatus): FamilyResourceStep {
  return {
    id: `step-${resourceId}`,
    resourceId,
    domain: "early_intervention",
    status,
    plannedAt: "2026-06-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z"
  };
}

describe("isFirstStepsResource", () => {
  it("covers the statewide entry and every generated point of entry", () => {
    expect(isFirstStepsResource("first_steps_statewide")).toBe(true);
    expect(isFirstStepsResource("first_steps_kentucky_river")).toBe(true);
    expect(isFirstStepsResource("kde_age_three_transition")).toBe(false);
    expect(isFirstStepsResource("michelle_p_waiver")).toBe(false);
  });
});

describe("firstStepsClock", () => {
  it("counts the weeks to the 45-day cutoff before the third birthday, and dates it", () => {
    // Born 2024-01 ⇒ third birthday 2027-01-01 ⇒ cutoff 2026-11-17, 122.5 days out.
    expect(firstStepsClock(profile(), NOW, false)).toEqual({
      kind: "dated",
      weeksLeft: 17,
      cutoff: new Date("2026-11-17T00:00:00.000Z")
    });
  });

  it("goes quiet once the family is enrolled", () => {
    expect(firstStepsClock(profile(), NOW, true)).toBeNull();
  });

  // P5: a week count computed from a birth *year* is a number the app cannot
  // know. The honest answer is the window, and whose birthday decides it.
  it("gives a dated window, and no week count, when only the birth year is known", () => {
    const clock = firstStepsClock(profile({ birthMonth: undefined }), NOW, false);
    expect(clock).toEqual({
      kind: "range",
      earliest: new Date("2026-11-17T00:00:00.000Z"),
      latest: new Date("2027-11-16T00:00:00.000Z")
    });
    expect(firstStepsWeeksLeft(clock)).toBeNull();
  });

  it("says the cutoff may already have passed once the earliest one has", () => {
    // Born 2024, month unknown, read in Dec 2026: a Jan-born child's cutoff is
    // behind us, a Dec-born child's is a year out. Both are still true.
    const clock = firstStepsClock(
      profile({ birthMonth: undefined }),
      new Date("2026-12-01T12:00:00.000Z"),
      false
    );
    expect(clock).toEqual({
      kind: "range",
      earliest: null,
      latest: new Date("2027-11-16T00:00:00.000Z")
    });
  });

  it("stops counting once the cutoff has passed", () => {
    // Born 2023-08 ⇒ third birthday 2026-08-01 ⇒ cutoff 2026-06-17, already behind us.
    expect(firstStepsClock(profile({ birthYear: 2023, birthMonth: 8 }), NOW, false)).toBeNull();
  });

  it("says nothing once every possible cutoff is behind us", () => {
    expect(firstStepsClock(profile({ birthYear: 2022, birthMonth: 3 }), NOW, false)).toBeNull();
    // Born 2022, month unknown: the latest possible cutoff was Nov 2025.
    expect(firstStepsClock(profile({ birthYear: 2022, birthMonth: undefined }), NOW, false)).toBeNull();
  });

  it("leaves an 18-month-old alone — the cutoff is over a year away", () => {
    const eighteenMonths = eighteenMonthFamilyState(NOW).profile;
    expect(eighteenMonths).not.toBeNull();
    expect(firstStepsClock(eighteenMonths!, NOW, false)).toBeNull();
  });

  it("never reports fewer than one week while the cutoff is still ahead", () => {
    // Born 2023-09 ⇒ cutoff 2026-07-18, half a day away.
    expect(firstStepsClock(profile({ birthYear: 2023, birthMonth: 9 }), NOW, false)).toMatchObject({
      kind: "dated",
      weeksLeft: 1
    });
  });

  it("holds the warning window at 26 weeks", () => {
    expect(CLOCK_WARNING_WEEKS).toBe(26);
    // Born 2024-03 ⇒ cutoff 2027-01-15, 181.5 days ⇒ 25 weeks: inside the window.
    expect(firstStepsClock(profile({ birthYear: 2024, birthMonth: 3 }), NOW, false)).toMatchObject({
      kind: "dated",
      weeksLeft: 25
    });
    // Born 2024-04 ⇒ cutoff 2027-02-15, 212.5 days ⇒ 30 weeks: outside it.
    expect(firstStepsClock(profile({ birthYear: 2024, birthMonth: 4 }), NOW, false)).toBeNull();
  });

  it("measures a year-only window from the earliest possible cutoff", () => {
    // Born 2025, month unknown, read July 2026: earliest cutoff Nov 2027 is far
    // outside the six-month window, so nothing shows yet.
    expect(firstStepsClock(profile({ birthYear: 2025, birthMonth: undefined }), NOW, false)).toBeNull();
  });

  // The repair the redesign offers: one month, and the same profile stops
  // guessing everywhere the clock appears.
  it("turns into a dated cutoff the moment a birth month arrives", () => {
    const before = firstStepsClock(profile({ birthMonth: undefined }), NOW, false);
    const after = firstStepsClock(profile({ birthMonth: 3 }), NOW, false);
    expect(before?.kind).toBe("range");
    expect(after).toEqual({
      kind: "dated",
      weeksLeft: 25,
      cutoff: new Date("2027-01-15T00:00:00.000Z")
    });
  });
});

describe("hasEnrolledFirstSteps", () => {
  it("is true for an enrolled First Steps step", () => {
    expect(hasEnrolledFirstSteps(schoolAgeFamilyState)).toBe(false);
    expect(
      hasEnrolledFirstSteps({
        ...schoolAgeFamilyState,
        steps: [step("first_steps_kentucky_river", "in_touch")]
      })
    ).toBe(false);
    expect(
      hasEnrolledFirstSteps({
        ...schoolAgeFamilyState,
        steps: [step("michelle_p_waiver", "enrolled")]
      })
    ).toBe(false);
    expect(
      hasEnrolledFirstSteps({
        ...schoolAgeFamilyState,
        steps: [step("michelle_p_waiver", "enrolled"), step("first_steps_statewide", "enrolled")]
      })
    ).toBe(true);
  });

  // A save written before the step tracker existed records enrollment only in
  // `alreadyEnrolled`; the sanitizer backfills `steps` to an empty array.
  it("is true when only the enrollment list knows, as on a pre-tracker save", () => {
    expect(
      hasEnrolledFirstSteps({
        ...schoolAgeFamilyState,
        alreadyEnrolled: ["first_steps_bluegrass"],
        steps: []
      })
    ).toBe(true);
    expect(
      hasEnrolledFirstSteps({
        ...schoolAgeFamilyState,
        alreadyEnrolled: ["michelle_p_waiver", "ky-spin"],
        steps: []
      })
    ).toBe(false);
  });

  // The toggle deliberately invents no step for a resource the catalog dropped,
  // so the tracker alone would resurrect the deadline for a family already in.
  it("is true for an enrolled point of entry the catalog no longer lists", () => {
    expect(getFamilyResourceById("first_steps_retired_poe")).toBeUndefined();
    expect(
      hasEnrolledFirstSteps({
        ...schoolAgeFamilyState,
        alreadyEnrolled: ["first_steps_retired_poe"],
        steps: []
      })
    ).toBe(true);
  });

  it("retires the countdown for a pre-tracker family already in First Steps", () => {
    const legacy = {
      ...schoolAgeFamilyState,
      profile: profile({ birthYear: 2023, birthMonth: 12 }),
      alreadyEnrolled: ["first_steps_bluegrass"],
      steps: []
    };
    expect(firstStepsClock(legacy.profile, NOW, false)).not.toBeNull();
    expect(firstStepsClock(legacy.profile, NOW, hasEnrolledFirstSteps(legacy))).toBeNull();
  });
});
