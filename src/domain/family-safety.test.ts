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
    ["I suddenly cannot see out of one eye", "emergency", "vision", undefined],
    ["A curtain came over my vision this morning", "emergency", "vision", undefined],
    ["My worst headache of my life just started", "emergency", "acute_danger", undefined],
    ["My husband is unresponsive and his sugar is 32", "emergency", "acute_danger", undefined],
    ["My son ran away from home and we still can't find him", "emergency", "acute_danger", "missing_child"]
  ])("routes %j to the emergency tier", (text, tier, domain, guidance) => {
    const screen = screenFamilySafety(text);

    expect(screen).not.toBeNull();
    expect(screen?.tier).toBe(tier);
    expect(screen?.domain).toBe(domain);
    expect(screen?.guidance).toBe(guidance);
  });

  it("never returns an unsupported tier when matched", () => {
    const texts = [
      "I want to kill myself",
      "I suddenly cannot see out of one eye",
      "Someone is hurting my child",
      "My daughter has been missing since last night"
    ];

    for (const text of texts) {
      const screen = screenFamilySafety(text);
      expect(screen?.matched).toBe(true);
      expect(["crisis", "emergency", "blocked"]).toContain(screen?.tier);
    }
  });

  it("returns null for ordinary caregiver text", () => {
    expect(screenFamilySafety("My daughter is on the First Steps waitlist")).toBeNull();
    expect(screenFamilySafety("I want help getting a developmental evaluation")).toBeNull();
    expect(screenFamilySafety("I can't see the numbers on my glucose meter")).toBeNull();
  });

  it("recognizes child breathing danger and age-modified missing-child reports", () => {
    expect(screenFamilySafety("My child cannot breathe")).toMatchObject({
      matched: true,
      tier: "emergency",
      domain: "acute_danger"
    });
    expect(screenFamilySafety("My 7-year-old daughter is missing")).toMatchObject({
      matched: true,
      tier: "emergency",
      domain: "acute_danger",
      guidance: "missing_child"
    });
  });

  it("does not turn symptom denials or medication soft blocks into emergencies", () => {
    expect(screenFamilySafety("My child has no chest pain and is breathing normally")).toBeNull();
    expect(screenFamilySafety("No shortness of breath")).toBeNull();
    expect(screenFamilySafety("No new confusion")).toBeNull();
    expect(screenFamilySafety("He is not fainting")).toBeNull();
    expect(screenFamilySafety("Should I stop taking lisinopril?")).toEqual({
      matched: true,
      tier: "blocked",
      domain: "medication_change"
    });
  });

  it("does not escalate a negated disclosure", () => {
    expect(screenFamilySafety("I would never hurt myself")).toBeNull();
    expect(screenFamilySafety("nobody is hurting my child")).toBeNull();
    expect(screenFamilySafety("I am not out of insulin and my children are not hungry")).toBeNull();
    expect(screenFamilySafety("I won't be out of insulin")).toBeNull();
    expect(screenFamilySafety("My insulin ran out, but the pharmacy refilled it")).toBeNull();
    expect(screenFamilySafety("Se me acabó la insulina, pero ya la recogí")).toBeNull();
    expect(screenFamilySafety("mi hijo no tiene hambre y no me falta insulina")).toBeNull();
  });

  it("falls through to the social tier for a social emergency", () => {
    // Guards the third branch and its two action routes: both must match without
    // being silently reclassified as crisis-tier disclosures.
    expect(screenFamilySafety("I have no food today")).toMatchObject({
      matched: true,
      tier: "emergency",
      domain: "social",
      guidance: "basic_needs"
    });
    expect(screenFamilySafety("We are out of food and my daughter is hungry")).toMatchObject({
      matched: true,
      tier: "emergency",
      domain: "social",
      guidance: "basic_needs"
    });
    expect(screenFamilySafety("I'm out of insulin")).toMatchObject({
      matched: true,
      tier: "emergency",
      domain: "social",
      guidance: "medication_access"
    });
    expect(screenFamilySafety("No hay comida hoy y me quedé sin insulina")).toMatchObject({
      matched: true,
      tier: "emergency",
      domain: "social",
      guidance: "basic_needs_and_medication_access"
    });
    expect(screenFamilySafety("Hoy no tenemos comida y se me acabó la insulina")).toMatchObject({
      matched: true,
      tier: "emergency",
      domain: "social",
      guidance: "basic_needs_and_medication_access"
    });
    expect(screenFamilySafety("No tengo comida hoy")).toMatchObject({
      matched: true,
      tier: "emergency",
      domain: "social",
      guidance: "basic_needs"
    });
    expect(screenFamilySafety("Mi hija tiene hambre y no tengo insulina")).toMatchObject({
      matched: true,
      tier: "emergency",
      domain: "social",
      guidance: "basic_needs_and_medication_access"
    });
  });
});

describe("createFamilySafetyEvent", () => {
  it("carries the screen's route without its text and stamps an ISO time", () => {
    const now = new Date("2026-08-04T12:00:00.000Z");
    const event = createFamilySafetyEvent(
      { matched: true, tier: "emergency", domain: "acute_danger", guidance: "missing_child" },
      now
    );

    expect(event.tier).toBe("emergency");
    expect(event.domain).toBe("acute_danger");
    expect(event.guidance).toBe("missing_child");
    expect(event.createdAt).toBe("2026-08-04T12:00:00.000Z");
    expect(event.id).toBeTruthy();
    expect(event.acknowledgedAt).toBeUndefined();
    expect(event).not.toHaveProperty("text");
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
