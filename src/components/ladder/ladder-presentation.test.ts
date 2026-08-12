import { describe, expect, it } from "vitest";
import {
  createLadderSessionState,
  ladderSessionReducer
} from "@/components/ladder/ladder-session-reducer";
import type { LadderSessionEvent } from "@/components/ladder/ladder-session-types";
import { deriveLadderPresentation } from "@/components/ladder/ladder-presentation";
import { eighteenMonthFamilyState } from "@/domain/family-fixtures";
import type { FamilyNavigatorState } from "@/domain/types";

const NOW = new Date("2026-08-09T12:00:00.000Z");

function familyWithHistory(): FamilyNavigatorState {
  const family = eighteenMonthFamilyState(NOW);
  return {
    ...family,
    activeDomains: ["early_intervention"],
    latestInterviewDomains: ["early_intervention"],
    interviews: [
      {
        id: "interview-1",
        rawText: "I want help finding speech resources.",
        source: "typed",
        createdAt: "2026-07-01T12:00:00.000Z",
        extraction: "mock",
        kind: "orientation"
      }
    ]
  };
}

describe("deriveLadderPresentation", () => {
  it("keeps simulation out of the family posture and unavailable surfaces", () => {
    const family = familyWithHistory();
    const baseVisit = { referral: family.referral, appointments: [], soonerList: null };
    let session = createLadderSessionState("unset");
    session = ladderSessionReducer(session, {
      type: "simulation.visitTransitioned",
      base: baseVisit,
      event: {
        type: "seeded",
        referral: { clinic: "Demo clinic", referredAt: NOW.toISOString() },
        appointment: {
          id: "demo-offer",
          clinic: "Demo clinic",
          createdAt: NOW.toISOString(),
          offeredSlots: ["2026-10-01T12:00:00.000Z"],
          status: "offered",
          barriersAsked: false,
          barriers: [],
          reminderAcks: []
        }
      }
    });

    const demo = deriveLadderPresentation({
      family,
      session,
      simulationEnabled: true,
      wallClock: NOW,
      wroteThisSession: false
    });
    const familyPosture = deriveLadderPresentation({
      family,
      session,
      simulationEnabled: false,
      wallClock: NOW,
      wroteThisSession: false
    });

    expect(demo.surfaces).toContain("visit");
    expect(familyPosture.surfaces).not.toContain("visit");
    expect(familyPosture.postureFamily?.referral).toBeNull();
    expect(family.referral).toBeNull();
  });

  it("gives safety and clinic-now states precedence over routine asks", () => {
    const family = familyWithHistory();
    const safetyFamily: FamilyNavigatorState = {
      ...family,
      safetyEvents: [
        {
          id: "safety-1",
          tier: "crisis",
          domain: "self_harm",
          createdAt: NOW.toISOString()
        }
      ],
      steps: [
        {
          id: "step-1",
          resourceId: "resource-1",
          domain: "early_intervention",
          status: "planned",
          plannedAt: "2026-06-01T12:00:00.000Z",
          updatedAt: "2026-06-01T12:00:00.000Z"
        }
      ]
    };
    const presentation = deriveLadderPresentation({
      family: safetyFamily,
      session: createLadderSessionState("unset"),
      simulationEnabled: false,
      wallClock: NOW,
      wroteThisSession: false
    });

    expect(presentation.pendingSafetyEvent?.id).toBe("safety-1");
    expect(presentation.activeAsk).toBe("none");
    expect(presentation.checkinVisible).toBe(false);
    expect(presentation.followupStep).toBeUndefined();
  });

  it("uses one priority order for basics, consent, and return-visit asks", () => {
    const family = familyWithHistory();
    const session = createLadderSessionState("unset");
    const shared = {
      session,
      simulationEnabled: false,
      wallClock: NOW,
      wroteThisSession: false,
      aiChoiceAvailable: true,
      reviewAvailable: true
    } as const;

    const basics = deriveLadderPresentation({
      ...shared,
      family: { ...family, profile: null }
    });
    const consent = deriveLadderPresentation({ ...shared, family });

    expect(basics.activeAsk).toBe("basics");
    expect(basics.checkinVisible).toBe(false);
    expect(basics.followupStep).toBeUndefined();
    expect(consent.activeAsk).toBe("ai_consent");
    expect(consent.checkinVisible).toBe(false);
    expect(consent.followupStep).toBeUndefined();
  });

  it("lets a caregiver defer optional basics without mutating family data", () => {
    const family = { ...familyWithHistory(), profile: null };
    const snapshot = structuredClone(family);
    const session = ladderSessionReducer(createLadderSessionState("granted"), {
      type: "disclosure.basicsDeferred"
    });
    const presentation = deriveLadderPresentation({
      family,
      session,
      simulationEnabled: false,
      wallClock: NOW,
      wroteThisSession: false
    });

    expect(presentation.activeAsk).not.toBe("basics");
    expect(family).toEqual(snapshot);
    expect(family.profile).toBeNull();
  });

  it("maintains presentation invariants across deterministic event sequences", () => {
    const family = familyWithHistory();
    const events: LadderSessionEvent[] = [
      { type: "surface.requested", surface: "visit" },
      { type: "composer.opened" },
      { type: "checkin.started" },
      { type: "checkin.partChanged", part: "probe" },
      { type: "checkin.skipped" },
      { type: "disclosure.heardToggled" },
      { type: "disclosure.basicsToggled" },
      { type: "disclosure.basicsDeferred" },
      { type: "ai.consentAnswered", consent: "granted" },
      { type: "ai.consentAnswered", consent: "declined" },
      { type: "thread.activityChanged", active: true },
      { type: "thread.activityChanged", active: false },
      { type: "simulation.clockAdvanced", days: 31 },
      { type: "simulation.reset" }
    ];
    let seed = 0x5eed1234;
    let session = createLadderSessionState("unset");

    for (let index = 0; index < 500; index += 1) {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      session = ladderSessionReducer(session, events[seed % events.length]);
      const presentation = deriveLadderPresentation({
        family,
        session,
        simulationEnabled: index % 2 === 0,
        wallClock: NOW,
        wroteThisSession: index % 5 === 0
      });

      expect(presentation.surfaces[0]).toBe("home");
      expect(presentation.surfaces).toContain(presentation.resolvedSurface);
      expect(["none", "basics", "ai_consent", "checkin", "stale_step"]).toContain(
        presentation.activeAsk
      );
      expect(presentation.pendingSafetyEvent && presentation.checkinVisible).toBeFalsy();
      expect(presentation.openFlag && presentation.checkinVisible).toBeFalsy();
      expect(presentation.checkinVisible && presentation.followupStep).toBeFalsy();
      if (index % 2 === 1) {
        expect(presentation.surfaces).not.toContain("visit");
        expect(presentation.postureFamily?.referral).toBeNull();
      }
    }
  });
});
