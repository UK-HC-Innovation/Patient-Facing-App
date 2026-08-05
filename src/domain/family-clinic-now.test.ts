import { describe, expect, it } from "vitest";
import { eighteenMonthFamilyState, schoolAgeFamilyState } from "./family-fixtures";
import { familyResourcePhones } from "./family-resource-contact";
import { FAMILY_RESOURCE_CATALOG } from "./family-resources";
import { firstStepsPoeForCounty, resolveFamilyClinicNowTarget } from "./family-clinic-now";
import type { FamilyNavigatorState } from "./types";

const NOW = new Date("2026-07-17T12:00:00.000Z");

function family(overrides: Partial<FamilyNavigatorState>): FamilyNavigatorState {
  return { ...schoolAgeFamilyState, ...overrides };
}

describe("resolveFamilyClinicNowTarget", () => {
  it("keeps a real referral's clinic", () => {
    const target = resolveFamilyClinicNowTarget(
      family({ referral: { clinic: "UK Developmental Pediatrics", referredAt: NOW.toISOString() } }),
      NOW
    );

    expect(target).toEqual({ kind: "referral", clinic: "UK Developmental Pediatrics" });
  });

  // FR-1: the UK entry's contact line is prose, not a number. No number renders.
  it("never invents a number for a clinic the catalog has none for", () => {
    const target = resolveFamilyClinicNowTarget(
      family({ referral: { clinic: "UK Developmental Pediatrics", referredAt: NOW.toISOString() } }),
      NOW
    );

    expect(target).not.toHaveProperty("number");
    expect(target).not.toHaveProperty("tel");
  });

  it("carries a clinic's catalog number verbatim when there is one", () => {
    const entry = FAMILY_RESOURCE_CATALOG.find(
      (resource) => familyResourcePhones(resource.contact).length > 0
    );
    if (!entry) throw new Error("Expected at least one catalog entry with a phone number.");
    const [expected] = familyResourcePhones(entry.contact);

    const target = resolveFamilyClinicNowTarget(
      family({ referral: { clinic: entry.name, referredAt: NOW.toISOString() } }),
      NOW
    );

    expect(target).toMatchObject({
      kind: "referral",
      clinic: entry.name,
      number: expected,
      tel: `tel:${expected.replace(/\D/g, "")}`
    });
  });

  // The branch that used to print the hardcoded demo clinic.
  it("routes a no-referral family on the First Steps clock to their county point of entry", () => {
    const toddler = eighteenMonthFamilyState(NOW);
    const state = family({
      ...toddler,
      referral: null,
      activeDomains: ["early_intervention"],
      profile: { ...toddler.profile!, county: "Pike" }
    });

    const target = resolveFamilyClinicNowTarget(state, NOW);

    expect(target).toMatchObject({ kind: "first_steps", office: "Big Sandy" });
    const poe = firstStepsPoeForCounty("Pike");
    expect(poe).toBeDefined();
    const [expected] = familyResourcePhones(poe!.contact);
    expect(target).toMatchObject({ number: expected, tel: `tel:${expected.replace(/\D/g, "")}` });
  });

  it("falls back to the family's own doctor, naming no one, past the First Steps age", () => {
    const state = family({ referral: null, activeDomains: ["early_intervention"] });

    expect(resolveFamilyClinicNowTarget(state, NOW)).toEqual({ kind: "generic" });
  });

  it("falls back to the family's own doctor when early intervention is not active", () => {
    const state = family({
      ...eighteenMonthFamilyState(NOW),
      referral: null,
      activeDomains: ["school_iep"]
    });

    expect(resolveFamilyClinicNowTarget(state, NOW)).toEqual({ kind: "generic" });
  });

  it("falls back rather than guessing when there is no family at all", () => {
    expect(resolveFamilyClinicNowTarget(null, NOW)).toEqual({ kind: "generic" });
  });
});
