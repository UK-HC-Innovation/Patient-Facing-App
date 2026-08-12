import { describe, expect, it } from "vitest";
import { buildFamilyStages } from "./family-stages";
import type { FamilyNavigatorState, FamilyProfile } from "./types";

const NOW = new Date("2026-07-20T12:00:00.000Z");

function familyAt(ageMonths: number): FamilyNavigatorState {
  const birth = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - ageMonths, 1));
  const profile: FamilyProfile = {
    childFirstName: "Avery",
    birthYear: birth.getUTCFullYear(),
    birthMonth: birth.getUTCMonth() + 1,
    schoolStage: "not_school_age",
    county: "Fayette",
    diagnoses: []
  };
  return {
    profile,
    profileProvenance: "stated",
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
    resourcePreferences: { scope: "no_preference", contact: "no_preference" },
    saved: [],
    alreadyEnrolled: [],
    steps: [],
    pulses: [],
    flags: [],
    soonerList: null,
    packetQuestionIds: [],
    checkinTouchedAt: null
  };
}

describe("P4 Your child's development development stages", () => {
  it.each([
    [17, []],
    [18, ["development-check-18-month"]],
    [22, ["development-check-18-month"]],
    [23, []],
    [28, []],
    [29, ["development-check-30-month"]],
    [34, ["development-check-30-month"]],
    [35, []]
  ] as const)("uses exact development windows at %i months", (ageMonths, expected) => {
    const development = buildFamilyStages(familyAt(ageMonths), NOW).filter(({ id }) => id.startsWith("development"));
    expect(development.map(({ id }) => id)).toEqual(expected);
    expect(development.every(({ href }) => href === "/checkin#for-family")).toBe(true);
    expect(development.every(({ href }) => !href?.includes("swyc"))).toBe(true);
  });

  it("renders the neutral approved development nudge in both languages", () => {
    for (const language of ["en", "es"] as const) {
      const stage = buildFamilyStages(familyAt(18), NOW, language).find(({ id }) => id === "development-check-18-month");
      expect(stage).toMatchObject({ templateId: "development_check_nudge_v1", href: "/checkin#for-family" });
      expect(stage?.description).not.toMatch(/SWYC|diagnos|license|licencia/i);
    }
  });
});
