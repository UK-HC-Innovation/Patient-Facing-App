import { describe, expect, it } from "vitest";
import { demoState } from "@/domain/fixtures";
import type { AppState, FamilySafetyEvent } from "@/domain/types";
import { hasUnacknowledgedCrisis } from "./selectors";

function withFamilySafetyEvent(event: FamilySafetyEvent): AppState {
  return {
    ...demoState,
    family: {
      profile: null,
      profileProvenance: "stated",
      referral: null,
      appointments: [],
      safetyEvents: [event],
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
    }
  };
}

describe("hasUnacknowledgedCrisis", () => {
  it("does not treat a pending family medication soft block as a crisis lock", () => {
    expect(
      hasUnacknowledgedCrisis(
        withFamilySafetyEvent({
          id: "blocked-1",
          tier: "blocked",
          domain: "medication_change",
          createdAt: "2026-08-12T12:00:00.000Z"
        })
      )
    ).toBe(false);
  });

  it.each(["crisis", "emergency"] as const)("still locks for pending family %s events", (tier) => {
    expect(
      hasUnacknowledgedCrisis(
        withFamilySafetyEvent({
          id: `${tier}-1`,
          tier,
          domain: tier === "crisis" ? "self_harm" : "acute_danger",
          createdAt: "2026-08-12T12:00:00.000Z"
        })
      )
    ).toBe(true);
  });
});
