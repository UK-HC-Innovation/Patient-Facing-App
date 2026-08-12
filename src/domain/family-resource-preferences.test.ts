import { describe, expect, it } from "vitest";
import { buildResourceMatches } from "@/domain/family-matching";
import {
  applyFamilyResourcePreferences,
  DEFAULT_FAMILY_RESOURCE_PREFERENCES
} from "@/domain/family-resource-preferences";
import { schoolAgeFamilyState } from "@/domain/family-fixtures";

describe("family resource preferences", () => {
  const baseline = buildResourceMatches(
    schoolAgeFamilyState.profile!,
    ["school_iep", "parent_support"],
    [],
    20
  ).resources;

  it("preserves the exact baseline for neutral preferences", () => {
    expect(
      applyFamilyResourcePreferences(
        baseline,
        DEFAULT_FAMILY_RESOURCE_PREFERENCES,
        schoolAgeFamilyState.profile!.county
      )
    ).toBe(baseline);
  });

  it("changes only order while preserving membership and the direct-intent lead", () => {
    const preferred = applyFamilyResourcePreferences(
      baseline,
      { scope: "local_first", contact: "school_or_provider_first" },
      schoolAgeFamilyState.profile!.county
    );

    expect(preferred[0].resource.id).toBe(baseline[0].resource.id);
    expect(new Set(preferred.map(({ resource }) => resource.id))).toEqual(
      new Set(baseline.map(({ resource }) => resource.id))
    );
    expect(preferred).toHaveLength(baseline.length);
  });
});
