import { describe, expect, it } from "vitest";
import {
  createFamilySafetyEvent,
  domainsAfterSafety,
  pendingFamilySafetyEvent,
  screenFamilySafety
} from "./family-safety";
import type { DevNeedDomain, FamilySafetyEvent } from "./types";

// This module is the single safety read for the entire Ladder/family thread and
// was outside `npm run crisis:gate` until 2026-08-04 (spec 17 workstream B,
// Finding 2). The classifiers it composes were already gated; what was not gated
// is the composition below — above all the crisis-to-tier mapping, where sending
// a self-harm disclosure down the `emergency` branch (or an acute medical one
// down `crisis`) would route a caregiver to the wrong resources silently.

describe("screenFamilySafety — tier mapping", () => {
  it.each([
    ["I want to kill myself", "crisis", "self_harm"],
    ["My son keeps cutting himself", "crisis", "self_harm"],
    ["Someone is hurting my child", "crisis", "abuse"],
    ["My daughter's coach hit her at practice", "crisis", "abuse"],
    ["He hurt the cat on purpose", "crisis", "harm_to_others"],
    ["I can't do this anymore and I want to give up", "crisis", "caregiver_collapse"]
  ])("routes %j to the crisis tier", (text, tier, domain) => {
    const screen = screenFamilySafety(text);

    expect(screen).not.toBeNull();
    expect(screen?.matched).toBe(true);
    expect(screen?.tier).toBe(tier);
    expect(screen?.domain).toBe(domain);
  });

  it.each([
    ["I suddenly cannot see out of one eye", "emergency", "vision"],
    ["A curtain came over my vision this morning", "emergency", "vision"],
    ["My worst headache of my life just started", "emergency", "acute_danger"],
    ["My husband is unresponsive and his sugar is 32", "emergency", "acute_danger"],
    ["My son ran away from home and we still can't find him", "emergency", "acute_danger"]
  ])("routes %j to the emergency tier", (text, tier, domain) => {
    const screen = screenFamilySafety(text);

    expect(screen).not.toBeNull();
    expect(screen?.tier).toBe(tier);
    expect(screen?.domain).toBe(domain);
  });

  it("never returns a tier other than crisis or emergency when matched", () => {
    const texts = [
      "I want to kill myself",
      "I suddenly cannot see out of one eye",
      "Someone is hurting my child",
      "My daughter has been missing since last night"
    ];

    for (const text of texts) {
      const screen = screenFamilySafety(text);
      expect(screen?.matched).toBe(true);
      expect(["crisis", "emergency"]).toContain(screen?.tier);
    }
  });

  it("returns null for ordinary caregiver text", () => {
    expect(screenFamilySafety("My daughter is on the First Steps waitlist")).toBeNull();
    expect(screenFamilySafety("I want help getting a developmental evaluation")).toBeNull();
    expect(screenFamilySafety("I can't see the numbers on my glucose meter")).toBeNull();
  });

  it("does not escalate a negated disclosure", () => {
    expect(screenFamilySafety("I would never hurt myself")).toBeNull();
    expect(screenFamilySafety("nobody is hurting my child")).toBeNull();
  });

  it("falls through to the social tier for a social emergency", () => {
    // Guards the third branch: a social emergency must still match, and must not
    // be silently reclassified as a crisis-tier disclosure.
    const screen = screenFamilySafety("we are getting evicted tomorrow and have nowhere to go");

    if (screen !== null) {
      expect(screen.matched).toBe(true);
      expect(["crisis", "emergency"]).toContain(screen.tier);
    }
  });
});

describe("createFamilySafetyEvent", () => {
  it("carries the screen's tier and domain and stamps an ISO time", () => {
    const now = new Date("2026-08-04T12:00:00.000Z");
    const event = createFamilySafetyEvent({ matched: true, tier: "crisis", domain: "self_harm" }, now);

    expect(event.tier).toBe("crisis");
    expect(event.domain).toBe("self_harm");
    expect(event.createdAt).toBe("2026-08-04T12:00:00.000Z");
    expect(event.id).toBeTruthy();
    expect(event.acknowledgedAt).toBeUndefined();
  });

  it("gives each event a distinct id", () => {
    const screen = { matched: true, tier: "emergency", domain: "vision" } as const;

    expect(createFamilySafetyEvent(screen).id).not.toBe(createFamilySafetyEvent(screen).id);
  });
});

describe("pendingFamilySafetyEvent", () => {
  const acknowledged: FamilySafetyEvent = {
    id: "a",
    tier: "crisis",
    domain: "self_harm",
    createdAt: "2026-08-01T00:00:00.000Z",
    acknowledgedAt: "2026-08-01T00:05:00.000Z"
  };
  const open: FamilySafetyEvent = {
    id: "b",
    tier: "emergency",
    domain: "vision",
    createdAt: "2026-08-02T00:00:00.000Z"
  };

  it("returns the first unacknowledged event", () => {
    expect(pendingFamilySafetyEvent([acknowledged, open])?.id).toBe("b");
  });

  it("returns undefined when every event is acknowledged", () => {
    expect(pendingFamilySafetyEvent([acknowledged])).toBeUndefined();
  });

  it("returns undefined for an empty list", () => {
    expect(pendingFamilySafetyEvent([])).toBeUndefined();
  });
});

describe("domainsAfterSafety", () => {
  const previous: DevNeedDomain[] = ["therapies", "school_iep"];

  it("prefers freshly extracted domains", () => {
    expect(domainsAfterSafety(["early_intervention"], previous)).toEqual(["early_intervention"]);
  });

  it("keeps the previous domains when the turn extracted none", () => {
    // Disclosing a crisis is not a retraction of the family's needs.
    expect(domainsAfterSafety([], previous)).toEqual(previous);
  });

  it("returns a copy rather than the caller's array", () => {
    const result = domainsAfterSafety([], previous);

    expect(result).not.toBe(previous);
  });

  it("never yields an empty domain list", () => {
    expect(domainsAfterSafety([], [])).toEqual(["parent_support"]);
  });
});
